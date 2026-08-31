import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  PublicClientApplication,
  type AccountInfo,
  type ICachePlugin,
} from "@azure/msal-node";
import open from "open";
import { readConfig, writeConfig } from "./linksStore.js";

/**
 * Microsoft's published sample/native client for XRM tooling (used by XrmToolBox, the
 * Dataverse ServiceClient, and pac cli). Reusing it means users sign in with their own
 * Microsoft account without us registering an app or anyone granting admin consent for a
 * custom app — the tradeoff is Microsoft documents it as a prototyping credential, not a
 * long-term guaranteed one. See README for details.
 */
const CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d";
const DEFAULT_AUTHORITY = "https://login.microsoftonline.com/organizations";

const CACHE_PATH = path.join(process.cwd(), ".webresourcesync", "msal-cache.json");
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

const cachePlugin: ICachePlugin = {
  beforeCacheAccess: async (cacheContext) => {
    try {
      const data = await fs.readFile(CACHE_PATH, "utf-8");
      cacheContext.tokenCache.deserialize(data);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  },
  afterCacheAccess: async (cacheContext) => {
    if (cacheContext.cacheHasChanged) {
      await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
      await fs.writeFile(CACHE_PATH, cacheContext.tokenCache.serialize(), "utf-8");
    }
  },
};

const pca = new PublicClientApplication({
  auth: { clientId: CLIENT_ID, authority: DEFAULT_AUTHORITY },
  cache: { cachePlugin },
});

/**
 * Picks the account this tool is "signed in as". Guest users can end up with multiple
 * cached accounts (e.g. one per tenant they've signed into) — pin to whichever one last
 * completed a login rather than an arbitrary first entry.
 */
async function getAccount(): Promise<AccountInfo | null> {
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (accounts.length === 0) return null;
  const config = await readConfig();
  const pinned = accounts.find((a) => a.homeAccountId === config.activeHomeAccountId);
  return pinned ?? accounts[0];
}

async function setActiveAccount(account: AccountInfo | null): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, activeHomeAccountId: account?.homeAccountId ?? null });
}

function createLoopbackServer(): Promise<{
  redirectUri: string;
  waitForCode: () => Promise<string>;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;
    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>Signed in. You can close this window and return to Web Resource Sync.</body></html>");
      if (code) resolveCode(code);
      else if (error) rejectCode(new Error(url.searchParams.get("error_description") ?? error));
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start loopback sign-in listener"));
        return;
      }
      resolve({
        redirectUri: `http://localhost:${address.port}`,
        waitForCode: () => {
          const timeout = new Promise<string>((_, rej) =>
            setTimeout(() => rej(new Error("Sign-in timed out")), LOGIN_TIMEOUT_MS)
          );
          return Promise.race([codePromise, timeout]);
        },
        close: () => server.close(),
      });
    });
  });
}

interface InteractiveOptions {
  /** Overrides the app-level authority, e.g. to target a specific tenant a guest belongs to. */
  authority?: string;
  loginHint?: string;
}

async function acquireTokenInteractive(scopes: string[], opts: InteractiveOptions = {}) {
  const { redirectUri, waitForCode, close } = await createLoopbackServer();
  try {
    const authCodeUrl = await pca.getAuthCodeUrl({
      scopes,
      redirectUri,
      authority: opts.authority,
      loginHint: opts.loginHint,
    });
    await open(authCodeUrl);
    const code = await waitForCode();
    const result = await pca.acquireTokenByCode({
      code,
      scopes,
      redirectUri,
      authority: opts.authority,
    });
    if (!result) throw new Error("Sign-in did not return a token");
    return result;
  } finally {
    close();
  }
}

/**
 * Acquires a bearer token for a Dataverse (or Power Platform API) resource, silently when
 * a cached refresh token covers it, falling back to an interactive system-browser sign-in
 * the first time a new resource needs consent. The fallback is anchored to the signed-in
 * account's own tenant, since a plain re-prompt can otherwise resolve to the user's home
 * tenant instead of the guest tenant the resource actually lives in.
 */
export async function getAccessToken(resourceBaseUrl: string): Promise<string> {
  const scopes = [`${resourceBaseUrl}/.default`];
  const account = await getAccount();
  if (!account) {
    const result = await acquireTokenInteractive(scopes);
    await setActiveAccount(result.account);
    return result.accessToken;
  }
  try {
    const result = await pca.acquireTokenSilent({ account, scopes });
    return result.accessToken;
  } catch {
    const result = await acquireTokenInteractive(scopes, {
      authority: `https://login.microsoftonline.com/${account.tenantId}`,
      loginHint: account.username,
    });
    return result.accessToken;
  }
}

export const POWER_PLATFORM_RESOURCE = "https://api.powerplatform.com";

export async function getAuthStatus(): Promise<{ signedIn: boolean; username?: string }> {
  const account = await getAccount();
  return account ? { signedIn: true, username: account.username } : { signedIn: false };
}

/**
 * @param tenant Domain (e.g. "contoso.onmicrosoft.com") or tenant ID to sign into. Needed
 * for guest accounts — signing in without it resolves to the user's home tenant, which
 * won't see environments in a tenant they're only a guest in.
 */
export async function login(tenant?: string): Promise<{ username: string }> {
  const authority = tenant ? `https://login.microsoftonline.com/${tenant}` : undefined;
  const result = await acquireTokenInteractive([`${POWER_PLATFORM_RESOURCE}/.default`], { authority });
  if (!result.account) throw new Error("Sign-in completed but no account was returned");
  await setActiveAccount(result.account);
  return { username: result.account.username };
}

export async function logout(): Promise<void> {
  const account = await getAccount();
  if (account) {
    await pca.getTokenCache().removeAccount(account);
  }
  await setActiveAccount(null);
  await fs.rm(CACHE_PATH, { force: true });
}
