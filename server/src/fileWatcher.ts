import { EventEmitter } from "node:events";
import path from "node:path";
import chokidar, { type FSWatcher } from "chokidar";

const WATCHED_EXTENSIONS = new Set([".html", ".htm", ".js", ".css"]);

export type FileEvent =
  | { type: "added"; path: string }
  | { type: "changed"; path: string }
  | { type: "removed"; path: string };

class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private root: string | null = null;

  getRoot() {
    return this.root;
  }

  async setRoot(root: string | null) {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.root = root;
    if (!root) return;

    this.watcher = chokidar.watch(root, {
      ignoreInitial: true,
      ignored: (filePath, stats) => {
        if (!stats?.isFile()) return false;
        return !WATCHED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
      },
    });

    this.watcher
      .on("add", (filePath) => this.emitEvent("added", filePath))
      .on("change", (filePath) => this.emitEvent("changed", filePath))
      .on("unlink", (filePath) => this.emitEvent("removed", filePath));
  }

  private emitEvent(type: FileEvent["type"], absolutePath: string) {
    if (!this.root) return;
    const relativePath = path.relative(this.root, absolutePath);
    this.emit("file-event", { type, path: relativePath } satisfies FileEvent);
  }
}

export const fileWatcher = new FileWatcher();
