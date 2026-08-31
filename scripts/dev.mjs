import { spawn } from "node:child_process";

// Spawns both workspace dev servers with stdio inherited directly (no multiplexing
// layer) and stdio: "inherit" — concurrently's stdout piping was silently deadlocking
// the server child on Windows before it could even finish loading its own imports.
const children = [
  spawn("npm", ["run", "dev", "-w", "server"], { stdio: "inherit", shell: true }),
  spawn("npm", ["run", "dev", "-w", "web"], { stdio: "inherit", shell: true }),
];

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
for (const child of children) child.on("exit", shutdown);
