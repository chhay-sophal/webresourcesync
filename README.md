# Web Resource Sync

![Build check](https://github.com/chhay-sophal/webresourcesync/actions/workflows/build-check.yml/badge.svg)

A desktop tool for editing Power Apps (Dataverse) web resources (HTML/JS/CSS) from files on
your machine, instead of re-uploading content through the maker portal by hand.

- Sign in and browse your Dataverse environments, solutions, and web resources
- Link a web resource to a local file; edits you save in VS Code show up live in the app
- Create, update, publish, and delete web resources without leaving the tool
- Checks for updates on launch, with a one-click Update button when a new version's out

## Install

Grab the latest installer from [Releases](https://github.com/chhay-sophal/webresourcesync/releases)
and run it — no other setup needed. CI builds installers for Windows, macOS, and Linux on every
release, but **only Windows has actually been run and verified so far** — treat the macOS/Linux
builds as untested until someone confirms otherwise.

The installer is currently unsigned, so Windows SmartScreen will likely warn that it's from
an "unknown publisher" the first time you run it — click **More info → Run anyway** to
proceed.

## Sign-in — no app registration needed

There's no setup step. Click **Sign in** and your default browser opens to a normal
Microsoft sign-in page; approve it and you're in.

This works by reusing Microsoft's own published client ID for XRM tooling (the same one
[XrmToolBox](https://www.xrmtoolbox.com/) and the Dataverse `ServiceClient`/`pac cli` use —
see [Microsoft's docs](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-oauth)),
so you don't need to register an Entra app or ask a tenant admin to grant consent for a
custom one. The app runs the sign-in itself (opens your system browser, catches the
redirect on a local port, exchanges the code for tokens) and proxies every Dataverse call
server-to-server, so there's no browser CORS setup on the environment either.

Two caveats worth knowing:
- Microsoft documents this client ID as a prototyping/sample credential, not a
  long-term-guaranteed one — it could be revoked or changed without notice.
- If your tenant's admin has locked down **all** user consent (not just unverified
  third-party apps), even this will hit the same admin-consent wall a custom app would —
  that's a deliberate security boundary only an admin can lift.

## How linking works

The app watches a folder on your machine that you choose in it. Each web resource can be
linked to one file in that folder. When you save the file, the app shows it as "modified"
immediately; click **Publish** to push the new content to Dataverse and publish it.

Link data and your cached sign-in tokens are stored locally on your machine (in the app's own
data folder) — nothing about your local files is sent anywhere except the content you
explicitly publish.

## Development

This is an npm workspaces monorepo (`server/` — the Express + Dataverse/auth backend,
`web/` — the React frontend) wrapped in a Tauri desktop shell (`src-tauri/`).

### Run it as a plain web app

```
npm install
npm run dev
```

Starts the backend on port 4000 and the Vite dev server on port 5173. Open
http://localhost:5173. Useful for quick frontend iteration without touching Rust/Tauri.

### Run it as the desktop app

```
npm install -D @tauri-apps/cli   # first time only
npx tauri dev
```

Opens the real native window, with the backend running as a Tauri sidecar process — this is
what actually ships, so it's the more representative way to test a change.

### Build the installer

```
npm run prepare-sidecar --workspace server   # bundles + packages the backend into a standalone .exe
npx tauri build                              # builds the frontend, compiles Tauri, produces the installer
```

Since the updater plugin is enabled (`bundle.createUpdaterArtifacts`), Tauri needs a signing key
present or this fails at the very last step even though the installer itself built fine - set
`TAURI_SIGNING_PRIVATE_KEY` (and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if the key has one) in your
shell first. Any valid keypair works for a local build (`npx tauri signer generate`) - it only
needs to match the real key for an update to actually verify at runtime, which doesn't matter
for a build you're just testing locally.

On Windows this produces both an NSIS installer and an MSI, at
`src-tauri/target/release/bundle/{nsis,msi}/`. `.github/workflows/` has two CI workflows that do
this same thing automatically across Windows, macOS, and Linux: `build-check.yml` on every
push/PR (uploads the installers as build artifacts), and `release.yml` on a pushed version tag
(attaches them to a draft GitHub Release).

### Tests

```
npm test --workspace web
npm test --workspace server
```

### Releases and auto-update

The app checks for updates on launch (`@tauri-apps/plugin-updater`) and shows an Update
button next to the version number in the header when one's available. This requires
`release.yml` to sign each release with a private key matching the public key in
`src-tauri/tauri.conf.json`'s `plugins.updater.pubkey` — set as the `TAURI_SIGNING_PRIVATE_KEY`
and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repo secrets. If you rotate keys (`npx tauri signer
generate`), update both the secrets and the `pubkey` in `tauri.conf.json` together, or existing
installs won't recognize new releases as valid updates.

`build-check.yml` signs with its own throwaway keypair (hardcoded in the workflow, not a
secret) just to satisfy Tauri's build-time requirement that *something* signs the artifact -
it's never used to actually verify a real update, which is also why build-check keeps working
for pull requests from forks that can't access repo secrets.

## License

[MIT](LICENSE)
