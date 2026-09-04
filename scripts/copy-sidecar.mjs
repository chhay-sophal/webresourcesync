import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const src = path.join(repoRoot, "server/dist-bundle/server-win.exe");
const destDir = path.join(repoRoot, "src-tauri/binaries");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, path.join(destDir, "server-x86_64-pc-windows-msvc.exe"));
console.log("Copied sidecar binary into src-tauri/binaries/");