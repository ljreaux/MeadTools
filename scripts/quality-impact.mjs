import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const dependencyNames = (manifest) => Object.keys({
  ...manifest.dependencies, ...manifest.devDependencies,
  ...manifest.optionalDependencies, ...manifest.peerDependencies,
});

// Read both revisions: removed dependencies and deleted workspaces still matter.
export function readQualitySnapshot(revision) {
  const read = (file) => {
    if (!revision) return JSON.parse(readFileSync(file, "utf8"));
    const result = spawnSync("git", ["show", `${revision}:${file}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Cannot read ${file} at ${revision}`);
    return JSON.parse(result.stdout);
  };
  let files;
  if (revision) {
    const result = spawnSync("git", ["ls-tree", "-r", "--name-only", revision], { encoding: "utf8" });
    if (result.status !== 0) throw new Error("Cannot list workspace manifests");
    files = result.stdout.split("\n").filter((file) => /^(apps|packages)\/[^/]+\/package.json$/.test(file));
  } else {
    files = ["apps", "packages"].flatMap((directory) => readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory()).map((entry) => `${directory}/${entry.name}/package.json`));
  }
  let lock;
  try { lock = read("package-lock.json"); } catch { lock = null; }
  return { manifests: Object.fromEntries(files.map((file) => [path.posix.dirname(file), read(file)])), lock };
}

export function mobileWorkspaces(snapshot) {
  const byName = new Map(Object.entries(snapshot.manifests).map(([directory, manifest]) => [manifest.name, directory]));
  const visited = new Set();
  function visit(directory) {
    if (visited.has(directory)) return;
    const manifest = snapshot.manifests[directory];
    if (!manifest) throw new Error(`Missing workspace ${directory}`);
    visited.add(directory);
    for (const name of dependencyNames(manifest)) {
      if (byName.has(name)) visit(byName.get(name));
      else if (name.startsWith("@meadtools/")) throw new Error(`Unknown workspace ${name}`);
    }
  }
  visit("apps/mobile");
  // Mobile imports i18n through the hoisted workspace although its manifest
  // does not yet declare it. Keep coverage until that dependency is declared.
  visit("packages/i18n");
  return visited;
}

function mobileLockEntries(snapshot) {
  if (snapshot.lock.lockfileVersion !== 3 || !snapshot.lock.packages) throw new Error("Unsupported lockfile");
  const packages = snapshot.lock.packages;
  const entries = new Map();
  function visit(location) {
    if (entries.has(location)) return;
    const entry = packages[location];
    if (!entry) throw new Error(`Missing lock entry ${location}`);
    entries.set(location, entry);
    if (entry.link) return visit(entry.resolved);
    for (const name of dependencyNames(entry)) {
      let directory = location;
      let resolved;
      while (true) {
        const candidate = `${directory ? `${directory}/` : ""}node_modules/${name}`;
        if (packages[candidate]) { resolved = candidate; break; }
        if (!directory) break;
        directory = path.posix.dirname(directory);
        if (directory === ".") directory = "";
      }
      // Optional/peer dependencies may legitimately be absent on this platform.
      if (resolved) visit(resolved);
      else if (!entry.optionalDependencies?.[name] && !entry.peerDependencies?.[name]) throw new Error(`Unresolved dependency ${name}`);
    }
  }
  for (const directory of mobileWorkspaces(snapshot)) visit(directory);
  return Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
}

export function isMobileQualityAffected(changedPaths, before, after) {
  try {
    const workspaces = new Set([...mobileWorkspaces(before), ...mobileWorkspaces(after)]);
    if (changedPaths.some((file) =>
      !file.startsWith("packages/i18n/locales/") && (
      file === "package.json" || file === "tsconfig.base.json" ||
      file.startsWith(".github/") || file.startsWith("scripts/") ||
      [".npmrc", ".node-version", ".nvmrc"].includes(file) ||
      [...workspaces].some((directory) => file.startsWith(`${directory}/`)) ||
      (file.startsWith("packages/") && !Object.keys({ ...before.manifests, ...after.manifests }).some((directory) => file.startsWith(`${directory}/`)))
    ))) return true;
    if (changedPaths.includes("package-lock.json")) {
      return JSON.stringify(mobileLockEntries(before)) !== JSON.stringify(mobileLockEntries(after));
    }
    return false;
  } catch {
    return true;
  }
}
