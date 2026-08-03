import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));

function lightningcssLoads() {
  try {
    require("lightningcss");
    return true;
  } catch {
    return false;
  }
}

if (lightningcssLoads()) {
  process.exit(0);
}

if (process.platform !== "linux" || process.arch !== "x64") {
  console.warn(
    "lightningcss native binding missing; skipping auto-install on this platform",
  );
  process.exit(0);
}

console.log(
  "lightningcss native missing — installing linux-x64-gnu bindings for Railway/Linux…",
);
execSync(
  "npm install --no-save --no-package-lock lightningcss-linux-x64-gnu@1.32.0 @tailwindcss/oxide-linux-x64-gnu@4.3.3",
  { stdio: "inherit", cwd: dirname(root) },
);

if (!lightningcssLoads()) {
  console.error("lightningcss still fails to load after native install");
  process.exit(1);
}
