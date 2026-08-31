import { Router } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileWatcher } from "../fileWatcher.js";
import { pickFolderNative } from "../folderPicker.js";

const WATCHED_EXTENSIONS = new Set([".html", ".htm", ".js", ".css"]);

async function walk(dir: string, root: string): Promise<
  { path: string; mtimeMs: number }[]
> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: { path: string; mtimeMs: number }[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walk(absolute, root)));
    } else if (WATCHED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      const stat = await fs.stat(absolute);
      results.push({
        path: path.relative(root, absolute).split(path.sep).join("/"),
        mtimeMs: stat.mtimeMs,
      });
    }
  }
  return results;
}

/** Resolves a client-supplied relative path against the watched root, rejecting escapes. */
function resolveWithinRoot(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root) + path.sep;
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error("Path escapes watched root");
  }
  return resolved;
}

export const filesRouter = Router();

filesRouter.post("/pick-folder", async (_req, res) => {
  try {
    const selectedPath = await pickFolderNative();
    res.json({ path: selectedPath });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

filesRouter.get("/", async (_req, res) => {
  const root = fileWatcher.getRoot();
  if (!root) {
    res.json({ root: null, files: [] });
    return;
  }
  try {
    const files = await walk(root, root);
    res.json({ root, files });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

filesRouter.get("/content", async (req, res) => {
  const root = fileWatcher.getRoot();
  const relativePath = req.query.path;
  if (!root || typeof relativePath !== "string") {
    res.status(400).json({ error: "No watched root or missing path" });
    return;
  }
  try {
    const absolute = resolveWithinRoot(root, relativePath);
    const content = await fs.readFile(absolute, "utf-8");
    res.json({ path: relativePath, content });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});
