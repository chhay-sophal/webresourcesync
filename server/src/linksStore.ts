import { promises as fs } from "node:fs";
import path from "node:path";

const STORE_DIR = path.join(process.cwd(), ".webresourcesync");
const CONFIG_PATH = path.join(STORE_DIR, "config.json");
const LINKS_PATH = path.join(STORE_DIR, "links.json");

export interface Config {
  watchedRoot: string | null;
}

export interface Link {
  id: string;
  environmentUniqueName: string;
  solutionUniqueName: string;
  webresourceId: string;
  webresourceName: string;
  localPath: string;
}

async function ensureStoreDir() {
  await fs.mkdir(STORE_DIR, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(filePath: string, data: unknown) {
  await ensureStoreDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function readConfig(): Promise<Config> {
  return readJson<Config>(CONFIG_PATH, { watchedRoot: null });
}

export async function writeConfig(config: Config): Promise<void> {
  await writeJson(CONFIG_PATH, config);
}

export async function readLinks(): Promise<Link[]> {
  return readJson<Link[]>(LINKS_PATH, []);
}

export async function writeLinks(links: Link[]): Promise<void> {
  await writeJson(LINKS_PATH, links);
}

export async function addLink(link: Link): Promise<void> {
  const links = await readLinks();
  const withoutExisting = links.filter(
    (l) => l.webresourceId !== link.webresourceId
  );
  withoutExisting.push(link);
  await writeLinks(withoutExisting);
}

export async function removeLink(id: string): Promise<void> {
  const links = await readLinks();
  await writeLinks(links.filter((l) => l.id !== id));
}
