import { defineConfig, env } from "prisma/config";

// Dedicated test configuration never loads application .env files.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DATABASE_DIRECT_URL"),
  },
});
