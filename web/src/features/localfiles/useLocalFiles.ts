import { useCallback, useEffect, useState } from "react";
import { BACKEND_ORIGIN } from "../../api/backend";
import { getLocalConfig, listLocalFiles, setWatchedRoot, type LocalFile } from "../../api/local";

interface FileEvent {
  type: "added" | "changed" | "removed";
  path: string;
}

export function useLocalFiles() {
  const [root, setRoot] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [modifiedPaths, setModifiedPaths] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const result = await listLocalFiles();
    setRoot(result.root);
    setFiles(result.files);
  }, []);

  useEffect(() => {
    getLocalConfig().then((c) => setRoot(c.watchedRoot));
    refresh();

    // Same reasoning as BACKEND_ORIGIN in api/backend.ts: this must be the backend's own
    // absolute address, not one relative to window.location (Tauri's internal origin in the
    // packaged app has no /ws route of its own).
    const wsUrl = `${BACKEND_ORIGIN.replace(/^http/, "ws")}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (ev) => {
      const event = JSON.parse(ev.data) as FileEvent;
      if (event.type === "removed") {
        setFiles((f) => f.filter((x) => x.path !== event.path));
        return;
      }
      setFiles((f) => {
        const entry: LocalFile = { path: event.path, mtimeMs: Date.now() };
        const idx = f.findIndex((x) => x.path === event.path);
        if (idx === -1) return [...f, entry];
        const copy = [...f];
        copy[idx] = entry;
        return copy;
      });
      if (event.type === "changed") {
        setModifiedPaths((m) => new Set(m).add(event.path));
      }
    };
    return () => ws.close();
  }, [refresh]);

  const setRootFolder = useCallback(async (newRoot: string) => {
    const config = await setWatchedRoot(newRoot);
    setRoot(config.watchedRoot);
    await refresh();
  }, [refresh]);

  const clearModified = useCallback((path: string) => {
    setModifiedPaths((m) => {
      const copy = new Set(m);
      copy.delete(path);
      return copy;
    });
  }, []);

  return { root, files, modifiedPaths, setRootFolder, clearModified, refresh };
}
