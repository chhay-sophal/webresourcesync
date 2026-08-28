import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_AAD_CLIENT_ID;
const tenantId = import.meta.env.VITE_AAD_TENANT_ID ?? "common";

if (!clientId) {
  throw new Error(
    "VITE_AAD_CLIENT_ID is not set. Copy web/.env.example to web/.env.local and fill it in."
  );
}

const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: "/redirect.html",
    postLogoutRedirectUri: "/",
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

/** Global Discovery Service resource, used to list the user's Dataverse environments. */
export const DISCOVERY_RESOURCE = "https://globaldisco.crm.dynamics.com";

/**
 * Acquires a bearer token for a Dataverse (or Global Discovery) resource, silently when
 * possible and falling back to an interactive popup the first time a new resource/tenant
 * needs consent.
 */
export async function getAccessToken(resourceBaseUrl: string): Promise<string> {
  const account = msalInstance.getActiveAccount() ?? msalInstance.getAllAccounts()[0];
  if (!account) {
    throw new Error("No signed-in account. Sign in first.");
  }
  const request = { scopes: [`${resourceBaseUrl}/.default`], account };
  try {
    const result = await msalInstance.acquireTokenSilent(request);
    return result.accessToken;
  } catch {
    const result = await msalInstance.acquireTokenPopup(request);
    return result.accessToken;
  }
}
