# Web Resource Sync

A local tool for editing Power Apps (Dataverse) web resources (HTML/JS/CSS) from files on
your machine, instead of re-uploading content through the maker portal by hand.

- Sign in and browse your Dataverse environments, solutions, and web resources
- Link a web resource to a local file; edits you save in VS Code show up live in the app
- Create, update, publish, and delete web resources without leaving the tool

## Sign-in — no app registration needed

There's no setup step. Click **Sign in** and your default browser opens to a normal
Microsoft sign-in page; approve it and you're in.

This works by reusing Microsoft's own published client ID for XRM tooling (the same one
[XrmToolBox](https://www.xrmtoolbox.com/) and the Dataverse `ServiceClient`/`pac cli` use —
see [Microsoft's docs](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/authenticate-oauth)),
so you don't need to register an Entra app or ask a tenant admin to grant consent for a
custom one. The backend runs the sign-in itself (opens your system browser, catches the
redirect on a local port, exchanges the code for tokens) and proxies every Dataverse call
server-to-server, so there's no browser CORS setup on the environment either.

Two caveats worth knowing:
- Microsoft documents this client ID as a prototyping/sample credential, not a
  long-term-guaranteed one — it could be revoked or changed without notice.
- If your tenant's admin has locked down **all** user consent (not just unverified
  third-party apps), even this will hit the same admin-consent wall a custom app would —
  that's a deliberate security boundary only an admin can lift.

## Running

```
npm install
npm run dev
```

This starts the backend (file watcher + local API) on port 4000 and the frontend dev
server on port 5173. Open http://localhost:5173.

## How linking works

The backend watches a folder on your machine that you choose in the app. Each web resource
can be linked to one file in that folder. When you save the file, the app shows it as
"modified" immediately; click **Publish** to push the new content to Dataverse and publish it.

Link data and your cached sign-in tokens are stored locally in `.webresourcesync/` in this
repo (git-ignored) — nothing about your local files is sent anywhere except the content you
explicitly publish.
