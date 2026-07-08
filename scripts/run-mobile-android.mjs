import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const mobileRoot = path.join(workspaceRoot, "apps", "mobile");
const env = {
  ...process.env,
  NODE_PATH: path.join(mobileRoot, "node_modules")
};

if (process.platform === "darwin") {
  env.JAVA_HOME = execFileSync("/usr/libexec/java_home", ["-v", "17"], {
    encoding: "utf8"
  }).trim();
}

const expo = path.join(mobileRoot, "node_modules", ".bin", "expo");
const result = spawnSync(expo, ["run:android"], {
  cwd: mobileRoot,
  env,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
