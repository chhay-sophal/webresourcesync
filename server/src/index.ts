import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import { fileWatcher, type FileEvent } from "./fileWatcher.js";
import { readConfig } from "./linksStore.js";
import { configRouter } from "./routes/config.js";
import { filesRouter } from "./routes/files.js";
import { linksRouter } from "./routes/links.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const isProd = process.env.NODE_ENV === "production";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/config", configRouter);
app.use("/api/files", filesRouter);
app.use("/api/links", linksRouter);

if (isProd) {
  const webDist = path.join(__dirname, "../../web/dist");
  app.use(express.static(webDist));
  app.get("*", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const httpServer = createServer(app);
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
  httpServer.listen(PORT, () => {
    console.log(`webresourcesync server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
