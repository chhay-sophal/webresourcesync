import { Router } from "express";
import { promises as fs } from "node:fs";
import { fileWatcher } from "../fileWatcher.js";
import { readConfig, writeConfig } from "../linksStore.js";

export const configRouter = Router();

configRouter.get("/", async (_req, res) => {
  const config = await readConfig();
  res.json(config);
});

configRouter.put("/", async (req, res) => {
  const { watchedRoot } = req.body as { watchedRoot: string | null };
  if (watchedRoot) {
    try {
      const stat = await fs.stat(watchedRoot);
      if (!stat.isDirectory()) {
        res.status(400).json({ error: "watchedRoot is not a directory" });
        return;
      }
    } catch {
      res.status(400).json({ error: "watchedRoot does not exist" });
      return;
    }
  }
  await writeConfig({ watchedRoot });
  await fileWatcher.setRoot(watchedRoot);
  res.json({ watchedRoot });
});
