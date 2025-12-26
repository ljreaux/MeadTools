// prisma/runMigration.ts
import { migrateLegacyData } from "./migrateLegacyData";

async function main() {
  await migrateLegacyData({
    dryRun: false, // flip to true first
    limit: undefined // or 5 to test
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
