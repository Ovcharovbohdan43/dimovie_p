import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextRoot = path.dirname(require.resolve("next/package.json"));
const nextBin = path.join(nextRoot, "dist/bin/next");

const port = process.env.PORT || "3000";
const host = process.env.HOSTNAME || "0.0.0.0";

console.log(`[web] listening on http://${host}:${port}`);
console.log(`[web] next bin: ${nextBin}`);

const child = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", host, "--port", String(port)],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
