import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");

const port = process.env.PORT || "3000";
const host = "0.0.0.0";

const env = {
  ...process.env,
  HOSTNAME: host,
  PORT: String(port),
};

// Docker standalone (WORKDIR = apps/web)
const standaloneHere = path.join(webRoot, "server.js");
// Local monorepo build
const standaloneLocal = path.join(
  webRoot,
  ".next",
  "standalone",
  "apps",
  "web",
  "server.js",
);

const serverJs = fs.existsSync(standaloneHere)
  ? standaloneHere
  : fs.existsSync(standaloneLocal)
    ? standaloneLocal
    : null;

if (!serverJs) {
  console.error(
    "[web] standalone server.js not found — run `npm run build` first",
  );
  process.exit(1);
}

console.log(`[web] listening on http://${host}:${port}`);
console.log(`[web] server: ${serverJs}`);

const child = spawn(process.execPath, [serverJs], {
  stdio: "inherit",
  env,
  cwd: path.dirname(serverJs),
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
