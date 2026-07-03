import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packagesDirectory = new URL("../packages/", import.meta.url);
const forbiddenImports = [
  {
    pattern: /^(?:next|next\/)/,
    reason: "Next.js belongs to apps/web"
  },
  {
    pattern: /^(?:react|react-dom)(?:\/|$)/,
    reason: "shared domain packages must remain UI-framework independent"
  },
  {
    pattern: /^@prisma(?:\/|$)/,
    reason: "Prisma models are persistence details, not public contracts"
  },
  {
    pattern: /^@\//,
    reason: "the @/ alias belongs to apps/web"
  },
  {
    pattern: /(?:^|\/)apps\/web(?:\/|$)/,
    reason: "shared packages cannot depend on the web application"
  }
];

async function sourceFiles(directory) {
  directory = directory instanceof URL ? fileURLToPath(directory) : directory;
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return /\.[cm]?[jt]sx?$/.test(entry.name) ? [entryPath] : [];
    })
  );
  return files.flat();
}

const packageEntries = await readdir(packagesDirectory, { withFileTypes: true });
const violations = [];
const importPattern =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']/g;

for (const packageEntry of packageEntries) {
  if (!packageEntry.isDirectory()) continue;
  const sourceDirectory = new URL(
    `${packageEntry.name}/src/`,
    packagesDirectory
  );
  let files;
  try {
    files = await sourceFiles(sourceDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") continue;
    throw error;
  }

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      const forbidden = forbiddenImports.find(({ pattern }) =>
        pattern.test(specifier)
      );
      if (forbidden) {
        violations.push(
          `${path.relative(process.cwd(), file)} imports "${specifier}": ${forbidden.reason}`
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Shared package boundary violations:\n");
  console.error(violations.map((violation) => `- ${violation}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Shared package boundaries are clean.");
}
