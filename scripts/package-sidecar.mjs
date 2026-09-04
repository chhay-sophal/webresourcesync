import { exec as pkgExec } from "@yao-pkg/pkg";
import { copyFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Maps the current Node platform/arch to the pkg target (which Node runtime to embed) and
 * the Rust target triple Tauri's sidecar convention expects the binary to be suffixed with
 * (binaries/server-<triple>[.exe]). Each CI runner (and your own dev machine) only ever needs
 * to build for itself - pkg does the rest by bundling a prebuilt Node binary for that target,
 * not by actually cross-compiling. */
function resolveTarget() {
  const { platform, arch } = process;
  if (platform === "win32" && arch === "x64") {
    return { pkgTarget: "node22-win-x64", rustTriple: "x86_64-pc-windows-msvc", exe: ".exe" };
  }
  if (platform === "darwin" && arch === "arm64") {
    return { pkgTarget: "node22-macos-arm64", rustTriple: "aarch64-apple-darwin", exe: "" };
  }
  if (platform === "darwin" && arch === "x64") {
    return { pkgTarget: "node22-macos-x64", rustTriple: "x86_64-apple-darwin", exe: "" };
  }
  if (platform === "linux" && arch === "x64") {
    return { pkgTarget: "node22-linux-x64", rustTriple: "x86_64-unknown-linux-gnu", exe: "" };
  }
  throw new Error(`No known sidecar packaging target for platform=${platform} arch=${arch}`);
}

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const { pkgTarget, rustTriple, exe } = resolveTarget();
const bundlePath = path.join(repoRoot, "server/dist-bundle/server.cjs");
const packagedPath = path.join(repoRoot, `server/dist-bundle/server${exe}`);
const destDir = path.join(repoRoot, "src-tauri/binaries");
const destPath = path.join(destDir, `server-${rustTriple}${exe}`);

await pkgExec([bundlePath, "--targets", pkgTarget, "--output", packagedPath]);

mkdirSync(destDir, { recursive: true });
copyFileSync(packagedPath, destPath);
console.log(`Packaged for ${pkgTarget} and copied to src-tauri/binaries/server-${rustTriple}${exe}`);
