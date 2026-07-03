import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: "../../.env.local" });
config({ path: "../../.env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DATABASE_DIRECT_URL")
  }
});
