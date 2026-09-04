import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { fileWatcher, type FileEvent } from "./fileWatcher.js";
import { readConfig } from "./linksStore.js";
import { authRouter } from "./routes/auth.js";
import { configRouter } from "./routes/config.js";
import { dataverseRouter } from "./routes/dataverse.js";
import { filesRouter } from "./routes/files.js";
import { linksRouter } from "./routes/links.js";

const moduleDir = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.use(cors());
// Default 100kb limit is too small for base64-encoded web resource content (JS/CSS files
// easily exceed that once JSON-escaped), so raise it well above Dataverse's own ~5MB cap.
app.use(express.json({ limit: "25mb" }));

app.use("/api/config", configRouter);
app.use("/api/files", filesRouter);
app.use("/api/links", linksRouter);
app.use("/api/auth", authRouter);
app.use("/api/dataverse", dataverseRouter);

if (isProd) {
  const webDist = path.join(moduleDir, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const httpServer = createServer(app);
// Interactive sign-in can leave a request open for minutes while the user completes
// the browser flow; disable Node's default request/headers timeouts for that.
httpServer.requestTimeout = 0;
httpServer.headersTimeout = 0;
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

function broadcast(event: FileEvent) {
  const payload = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

fileWatcher.on("file-event", broadcast);

async function main() {
  const config = await readConfig();
  if (config.watchedRoot) {
    await fileWatcher.setRoot(config.watchedRoot);
  }
  httpServer.listen(PORT, "127.0.0.1", () => {
    console.log(`webresourcesync server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
