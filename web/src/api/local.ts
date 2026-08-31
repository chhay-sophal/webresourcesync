import { backendJson } from "./backend";

export interface LocalConfig {
  watchedRoot: string | null;
}

export interface LocalFile {
  path: string;
  mtimeMs: number;
}

export interface ResourceLink {
  id: string;
  environmentUniqueName: string;
  solutionUniqueName: string;
  webresourceId: string;
  webresourceName: string;
  localPath: string;
}

export function getLocalConfig(): Promise<LocalConfig> {
  return backendJson<LocalConfig>("/config");
}

export function setWatchedRoot(watchedRoot: string): Promise<LocalConfig> {
  return backendJson<LocalConfig>("/config", {
    method: "PUT",
    body: JSON.stringify({ watchedRoot }),
  });
}

export function listLocalFiles(): Promise<{ root: string | null; files: LocalFile[] }> {
  return backendJson<{ root: string | null; files: LocalFile[] }>("/files");
}

/** Opens a native folder-picker dialog on the machine running the backend. Returns null
 * if the user cancelled. */
export async function pickFolder(): Promise<string | null> {
  const { path } = await backendJson<{ path: string | null }>("/files/pick-folder", {
    method: "POST",
  });
  return path;
}

export async function getLocalFileContent(path: string): Promise<string> {
  const { content } = await backendJson<{ path: string; content: string }>(
    `/files/content?path=${encodeURIComponent(path)}`
  );
  return content;
}

export function listLinks(): Promise<ResourceLink[]> {
  return backendJson<ResourceLink[]>("/links");
}

export function createLink(link: Omit<ResourceLink, "id">): Promise<ResourceLink> {
  return backendJson<ResourceLink>("/links", {
    method: "POST",
    body: JSON.stringify(link),
  });
}

export function deleteLink(id: string): Promise<void> {
  return backendJson<void>(`/links/${id}`, { method: "DELETE" });
}
