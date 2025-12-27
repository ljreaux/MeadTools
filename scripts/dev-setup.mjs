import { existsSync, copyFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32", // cross-platform
    ...opts
  });

  if (res.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

function tryRun(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts
  });
  return res.status === 0;
}

function loadEnvLocal() {
  // keep it simple: just read I18NEXUS_API_KEY / ALLOW_DB_RESET if present
  // devs can still run setup without dotenv; we won't hard-fail here.
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return {};

  const text = readFileSync(envPath, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^"|"$/g, "");
    out[key] = val;
  }
  return out;
}

function ensureEnvLocal() {
  const local = path.resolve(process.cwd(), ".env.local");
  const example = path.resolve(process.cwd(), ".env.example");

  if (existsSync(local)) return;

  if (!existsSync(example)) {
    throw new Error("Missing .env.example — cannot bootstrap .env.local");
  }

  copyFileSync(example, local);
  console.log(
    "✅ Created .env.local from .env.example (edit values as needed)"
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDb() {
  // uses container healthcheck. If you named the service differently, adjust `db`.
  // We poll `docker compose ps` until "healthy" shows up.
  const maxMs = 60_000;
  const start = Date.now();

  while (Date.now() - start < maxMs) {
    const ok = tryRun("docker", ["compose", "ps"]);
    if (!ok) {
      await sleep(1500);
      continue;
    }

    // Cheap + reliable: check health via `docker inspect`
    // Get container id for the service
    const res = spawnSync("docker", ["compose", "ps", "-q", "db"], {
      encoding: "utf8",
      shell: process.platform === "win32"
    });

    const id = (res.stdout || "").trim();
    if (!id) {
      await sleep(1500);
      continue;
    }

    const inspect = spawnSync(
      "docker",
      ["inspect", "-f", "{{.State.Health.Status}}", id],
      { encoding: "utf8", shell: process.platform === "win32" }
    );

    const status = (inspect.stdout || "").trim();
    if (status === "healthy") {
      console.log("✅ DB is healthy");
      return;
    }

    await sleep(1500);
  }

  throw new Error("DB did not become healthy in time");
}

async function main() {
  ensureEnvLocal();
  const envLocal = loadEnvLocal();

  console.log("▶ Starting docker db...");
  run("docker", ["compose", "up", "-d"]);

  await waitForDb();

  console.log("▶ Pushing Prisma schema...");
  run("npx", ["prisma", "db", "push"]);

  console.log("▶ Seeding database...");
  // Force opt-in for destructive ops (your seed guard expects this)
  const env = { ...process.env, ALLOW_DB_RESET: "true" };
  run("npx", ["prisma", "db", "seed"], { env });

  // i18nexus optional
  const key = process.env.I18NEXUS_API_KEY || envLocal.I18NEXUS_API_KEY;
  if (key && key.length > 0) {
    console.log("▶ Pulling translations from i18nexus...");
    run("npx", ["i18nexus", "pull"]);
  } else {
    console.log("ℹ Skipping i18nexus pull (no I18NEXUS_API_KEY set)");
  }

  console.log("\n✅ Dev setup complete.");
  console.log("Next:");
  console.log("  npm run dev");
}

main().catch((e) => {
  console.error("\n❌ dev:setup failed:", e.message || e);
  process.exit(1);
});
