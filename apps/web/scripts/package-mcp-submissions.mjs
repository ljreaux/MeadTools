import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm, chmod, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const args = process.argv.slice(2);
const copyPublic = !args.includes("--no-public");
const output = path.resolve(root, args.find((arg) => arg !== "--no-public") ?? "release-drafts/mcp-marketplaces");
const source = path.join(root, "integrations/chatgpt/meadtools");
const manifest = JSON.parse(await readFile(path.join(source, "plugin.json"), "utf8"));
const settings = manifest.extensions["com.openai"];
assert.equal(settings.review.test_cases.positive.length, 5);
assert.equal(settings.review.test_cases.negative.length, 3);
for (const [field, limit] of Object.entries({
  displayName: 30, shortDescription: 30, longDescription: 4000, developerName: 80
})) {
  const value = settings.interface[field];
  assert.ok(typeof value === "string" && value.trim().length > 0 && value.length <= limit, field);
}
for (const [field, minimum] of [["logo", 256], ["composerIcon", 48]]) {
  const relative = settings.interface[field];
  assert.ok(relative.startsWith("./assets/") && !relative.includes(".."), field);
  const data = await readFile(path.join(source, relative));
  const metadata = await sharp(data).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, metadata.height);
  assert.ok(metadata.width >= minimum && data.length <= 5 * 1024 * 1024, field);
}

await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(tmpdir(), "meadtools-mcp-package-"));
const artifacts = [];
try {
  // Explicit inventories keep credentials, hidden bindings and unrelated source out.
  const inventories = {
    "meadtools-chatgpt-0.1.0-draft.zip": [
      ["plugin.json", "integrations/chatgpt/meadtools/plugin.json"],
      ["mcp.json", "integrations/chatgpt/meadtools/mcp.json"],
      ["assets/logo.png", "integrations/chatgpt/meadtools/assets/logo.png"],
      ["assets/composer-icon.png", "integrations/chatgpt/meadtools/assets/composer-icon.png"]
    ],
    "meadtools-chatgpt-0.1.0.zip": [
      ["plugin.json", "integrations/chatgpt/meadtools/plugin.json"],
      ["mcp.json", "integrations/chatgpt/meadtools/mcp.json"],
      ["assets/logo.png", "integrations/chatgpt/meadtools/assets/logo.png"],
      ["assets/composer-icon.png", "integrations/chatgpt/meadtools/assets/composer-icon.png"],
      ["README.md", "integrations/chatgpt/install-README.md"]
    ],
    "meadtools-claude-0.1.0.zip": [
      [".claude-plugin/plugin.json", "integrations/claude/meadtools/.claude-plugin/plugin.json"],
      [".claude-plugin/icon.png", "integrations/chatgpt/meadtools/assets/logo.png"],
      [".mcp.json", "integrations/claude/meadtools/mcp.json"],
      ["README.md", "integrations/claude/meadtools/README.md"],
      ["LICENSE", "LICENSE"]
    ],
    "meadtools-claude-preparation-draft.zip": [
      ["listing.md", "integrations/claude/listing.md"],
      ["logo.png", "integrations/chatgpt/meadtools/assets/logo.png"],
      ["review-materials.md", "docs/mcp-marketplace-submission-materials.md"],
      ["mcp-marketplace-recording-run-sheet.md", "docs/mcp-marketplace-recording-run-sheet.md"]
    ]
  };
  for (const [name, entries] of Object.entries(inventories)) {
    const folder = path.join(staging, name.replace(".zip", ""));
    for (const [destination, original] of entries) {
      await mkdir(path.dirname(path.join(folder, destination)), { recursive: true });
      await copyFile(path.join(root, original), path.join(folder, destination));
    }
    const files = entries.map(([destination]) => destination);
    const customerDownload = name === "meadtools-chatgpt-0.1.0.zip" || name === "meadtools-claude-0.1.0.zip";
    let savedManifest = manifest;
    if (name === "meadtools-chatgpt-0.1.0.zip") {
      savedManifest = structuredClone(manifest);
      delete savedManifest.extensions["com.openai"].review;
      delete savedManifest.extensions["com.openai"].publication;
      await writeFile(path.join(folder, "plugin.json"), JSON.stringify(savedManifest, null, 2) + "\n");
    }
    if (name === "meadtools-claude-preparation-draft.zip") {
      await writeFile(path.join(folder, "review-cases.json"), JSON.stringify(settings.review.test_cases, null, 2) + "\n");
      files.push("review-cases.json");
    }
    // Always create a new archive: updating an old ZIP could preserve obsolete entries.
    // Fixed timestamps, permissions and ZIP timezone avoid byte changes when only
    // the build time, source permissions or developer timezone changes.
    const archiveTime = new Date("2000-01-01T00:00:00Z");
    for (const file of files) {
      await chmod(path.join(folder, file), 0o644);
      await utimes(path.join(folder, file), archiveTime, archiveTime);
    }
    const zip = path.join(staging, name);
    execFileSync("zip", ["-q", "-X", zip, ...files], {
      cwd: folder,
      env: { ...process.env, TZ: "UTC" }
    });
    const actual = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n");
    assert.deepEqual(actual.sort(), [...files].sort(), name);
    assert.equal(execFileSync("unzip", ["-t", zip], { encoding: "utf8" }).includes("No errors detected"), true);
    if (name.includes("chatgpt")) {
      const saved = JSON.parse(execFileSync("unzip", ["-p", zip, "plugin.json"], { encoding: "utf8" }));
      assert.deepEqual(saved, savedManifest);
    }
    const destination = path.join(output, name);
    await copyFile(zip, destination);
    if (customerDownload && copyPublic) {
      const publicFolder = path.join(root, "apps/web/public/downloads/mcp");
      await mkdir(publicFolder, { recursive: true });
      await copyFile(zip, path.join(publicFolder, name));
    }
    const bytes = await readFile(destination);
    const hash = createHash("sha256").update(bytes).digest("hex");
    artifacts.push({ name, bytes: bytes.length, sha256: hash, files: actual, customerDownload });
    console.log(`${destination} (${bytes.length} bytes)`);
  }
  await writeFile(path.join(output, "inventory.json"), JSON.stringify({
    status: "draft-not-submission-ready",
    missing: ["verified demo recording URL", "published reviewed MCP privacy wording", "production reviewer verification", "publisher/domain and portal validation"],
    artifacts
  }, null, 2) + "\n");
} finally {
  await rm(staging, { recursive: true, force: true });
}
