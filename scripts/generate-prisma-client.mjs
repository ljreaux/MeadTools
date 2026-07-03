import { spawnSync } from "node:child_process";

const placeholderDatabaseUrl =
  "postgresql://prisma:prisma@localhost:5432/prisma";
const result = spawnSync("prisma", ["generate"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || placeholderDatabaseUrl,
    DATABASE_DIRECT_URL:
      process.env.DATABASE_DIRECT_URL ||
      process.env.DATABASE_URL ||
      placeholderDatabaseUrl
  }
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
