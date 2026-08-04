import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const nextRoot = path.dirname(require.resolve("next/package.json"));
const nextBin = path.join(nextRoot, "dist/bin/next");

const port = process.env.PORT || "3000";
// Never use process.env.HOSTNAME — Railway sets it to the container name,
// and Next then binds to an unreachable address → edge 502.
const host = "0.0.0.0";

console.log(`[web] listening on http://${host}:${port}`);
console.log(`[web] next bin: ${nextBin}`);

const child = spawn(
  process.execPath,
  [nextBin, "start", "--hostname", host, "--port", String(port)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      // Prevent next from reading Railway's container HOSTNAME
      HOSTNAME: host,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
