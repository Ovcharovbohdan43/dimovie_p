import { spawn } from "node:child_process";

const port = process.env.PORT || "3000";
const host = "0.0.0.0";

console.log(`[web] starting next on http://${host}:${port}`);

const child = spawn(
  "next",
  ["start", "--hostname", host, "--port", String(port)],
  {
    stdio: "inherit",
    shell: true,
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
