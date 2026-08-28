# Web Resource Sync

A local tool for editing Power Apps (Dataverse) web resources (HTML/JS/CSS) from files on
your machine, instead of re-uploading content through the maker portal by hand.

- Sign in and browse your Dataverse environments, solutions, and web resources
- Link a web resource to a local file; edits you save in VS Code show up live in the app
- Create, update, publish, and delete web resources without leaving the tool

## One-time setup

### 1. Register an Entra ID app

1. Go to the [Azure Portal → App registrations](https://portal.azure.com) → **New registration**.
2. Name it (e.g. "Web Resource Sync"), leave supported account types as needed for your tenant.
3. Under **Authentication**, add a platform: **Single-page application**, redirect URI
   `http://localhost:5173/redirect.html`.
4. Under **API permissions**, add **Dynamics CRM** → Delegated permissions → `user_impersonation`.
   Grant admin consent if your tenant requires it.
5. Copy the **Application (client) ID** and your **tenant ID** (or use `common` for
   multi-tenant/personal accounts).

### 2. Enable CORS on your Dataverse environment

1. Go to the [Power Platform Admin Center](https://admin.powerplatform.microsoft.com) →
   your environment → **Settings** → **Product** → **Features**.
2. Under **Cross-Origin Resource Sharing (CORS)**, add `http://localhost:5173` (the dev
   server origin) to the allowed origins list. Add your production origin too if you deploy
   this tool somewhere.

### 3. Configure the app

```
cp web/.env.example web/.env.local
```

Edit `web/.env.local` with your client ID and tenant ID from step 1.

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

Link data is stored locally in `.webresourcesync/` in this repo (git-ignored) — nothing
about your local files is sent anywhere except the content you explicitly publish.
