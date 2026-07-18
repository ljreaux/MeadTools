type BackfillOptions = {
  all: boolean;
  brewIds: string[];
  execute: boolean;
};

export {};

function usage() {
  return [
    "Usage:",
    "  npm run brew:rebuild-abv --workspace @meadtools/web -- --brew-id <brew-id> [--execute]",
    "  npm run brew:rebuild-abv --workspace @meadtools/web -- --all [--execute]",
    "",
    "The command defaults to a dry run. It uses DATABASE_URL from the current environment."
  ].join("\n");
}

function parseOptions(args: string[]): BackfillOptions {
  const options: BackfillOptions = { all: false, brewIds: [], execute: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--all") {
      options.all = true;
      continue;
    }
    if (arg === "--brew-id") {
      const brewId = args[index + 1];
      if (!brewId || brewId.startsWith("--")) throw new Error(usage());
      options.brewIds.push(brewId);
      index += 1;
      continue;
    }
    if (arg === "--execute") {
      options.execute = true;
      continue;
    }
    if (arg === "--dry-run") continue;
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}\n\n${usage()}`);
  }

  if (options.all === (options.brewIds.length > 0)) throw new Error(usage());
  return options;
}

const options = parseOptions(process.argv.slice(2));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set by the target environment before running this backfill."
  );
}

const [{ default: prisma }, { rebuildEstimatedAbvEntriesForBrew }] =
  await Promise.all([
    import("../lib/prisma"),
    import("../lib/db/brews")
  ]);

try {
  const brewIds = options.all
    ? (
        await prisma.brews.findMany({
          where: { user_id: { not: null } },
          select: { id: true },
          orderBy: { id: "asc" }
        })
      ).map((brew) => brew.id)
    : options.brewIds;

  if (!options.execute) {
    console.log(
      `Dry run: ${brewIds.length} brew${brewIds.length === 1 ? "" : "s"} would have estimated ABV entries rebuilt. Re-run with --execute to write changes.`
    );
  } else {
    for (const brewId of brewIds) {
      await rebuildEstimatedAbvEntriesForBrew(brewId);
    }
    console.log(
      `Rebuilt estimated ABV entries for ${brewIds.length} brew${brewIds.length === 1 ? "" : "s"}.`
    );
  }
} finally {
  await prisma.$disconnect();
}
