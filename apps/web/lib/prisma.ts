import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    `Database URL not found. Make sure DATABASE_URL is defined in the .env file.`
  );
}

const prisma = new PrismaClient({
  datasources: {
    db: { url },
  },
});

export default prisma;
