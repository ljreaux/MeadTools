import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const labels = {
  web: "Web",
  mobile: "Mobile",
  mobilePreview: "Mobile preview progress — no production Mobile release",
  chat: "Chat assistant",
  api: "API and integrations",
};
const order = Object.keys(labels);
const source = new URL(
  "../packages/i18n/locales/en/default.json",
  import.meta.url,
);

export function renderReleaseArtifacts(
  date,
  entry,
  baseUrl = "https://meadtools.com",
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Use a YYYY-MM-DD release date.");
  if (!entry?.title || !entry?.summary || !entry?.products)
    throw new Error("A complete release entry is required.");
  const shipped = order.filter(
    (product) => product !== "mobilePreview" && entry.products[product],
  );
  if (shipped.length === 0)
    throw new Error("No shipped product; record a no-change cycle instead.");
  const url = `${baseUrl.replace(/\/$/, "")}/release-notes/${date}`;
  const sections = order
    .filter((product) => entry.products[product])
    .map((product) => {
      const items = entry.products[product].items;
      return `## ${labels[product]}\n\n${items.map((item) => `- ${item}`).join("\n")}`;
    });
  const github =
    [`# ${entry.title}`, entry.summary, ...sections, `Full notes: ${url}`].join(
      "\n\n",
    ) + "\n";
  const emails = Object.fromEntries(
    shipped.map((product) => [
      product,
      {
        subject: `MeadTools ${labels[product]} update — ${entry.title}`,
        text:
          [
            `DRAFT — review and remove this line before sending.`,
            entry.summary,
            `${labels[product]}:`,
            ...entry.products[product].items.map((item) => `- ${item}`),
            `Full release notes: ${url}`,
            `Unsubscribe from ${labels[product]} release emails: {{unsubscribe_url}}`,
            `MeadTools mailing address: {{postal_address}}`,
          ].join("\n\n") + "\n",
      },
    ]),
  );
  return { github, emails, tag: `release-${date}` };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const date = process.argv[2];
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      "Usage: node scripts/prepare-release-artifacts.mjs YYYY-MM-DD [output-directory]",
    );
  }
  execFileSync(
    "node",
    [
      fileURLToPath(
        new URL("./check-release-note-entries.mjs", import.meta.url),
      ),
    ],
    { stdio: "inherit" },
  );
  const translations = JSON.parse(await readFile(source, "utf8"));
  const entry = translations.releaseNotes?.entries?.[date];
  if (!entry) throw new Error(`No published release note entry for ${date}.`);
  const { github, emails, tag } = renderReleaseArtifacts(date, entry);
  const directory = resolve(process.argv[3] ?? `release-drafts/${date}`);
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "github-release.md"), github, {
    flag: "wx",
  });
  for (const [product, email] of Object.entries(emails)) {
    await writeFile(
      resolve(directory, `${product}-email.txt`),
      `Subject: ${email.subject}\n\n${email.text}`,
      { flag: "wx" },
    );
  }
  console.log(
    `Prepared ${Object.keys(emails).length} product email drafts and GitHub Release body in ${directory}. Suggested tag: ${tag}`,
  );
}
