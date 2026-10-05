import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const notesPath = "packages/i18n/locales/en/default.json";
const datedKey = /^\d{4}-\d{2}-\d{2}$/;
const allowedProducts = new Set([
  "web",
  "mobile",
  "mobilePreview",
  "chat",
  "api",
]);

function validDate(date) {
  return (
    datedKey.test(date) &&
    !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) &&
    new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  );
}

function validEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (typeof entry.title !== "string" || !entry.title.trim()) return false;
  if (typeof entry.summary !== "string" || !entry.summary.trim()) return false;
  const products = entry.products;
  if (!products || typeof products !== "object" || Array.isArray(products))
    return false;
  const sections = Object.entries(products);
  return (
    sections.length > 0 &&
    sections.every(
      ([product, section]) =>
        allowedProducts.has(product) &&
        Array.isArray(section?.items) &&
        section.items.length > 0 &&
        section.items.every((item) => typeof item === "string" && item.trim()),
    )
  );
}

export function evaluateNoteGate({
  baseEntries,
  headEntries,
  labels,
  body,
  initialDraftChanged = false,
}) {
  const changed = Object.entries(headEntries).filter(
    ([date, entry]) =>
      JSON.stringify(baseEntries[date]) !== JSON.stringify(entry),
  );
  const malformed = changed.find(
    ([date, entry]) => !validDate(date) || !validEntry(entry),
  );
  if (malformed) {
    return {
      ok: false,
      reason: `Changed release entry ${malformed[0]} is invalid.`,
    };
  }
  if (changed.length > 0) {
    return {
      ok: true,
      reason: `Dated release notes changed: ${changed.map(([date]) => date).join(", ")}.`,
    };
  }
  if (initialDraftChanged) {
    return labels.includes("initial-release-ready")
      ? {
          ok: true,
          reason:
            "Initial promotion includes a reviewed internal release-note draft; publish the dated entry after production verification.",
        }
      : {
          ok: false,
          reason:
            "Initial promotion is awaiting review. Add initial-release-ready only after reviewing the exact PR diff; publish dated notes after production verification.",
        };
  }
  if (labels.includes("bug-fix-only")) {
    const rationale = body.match(/^Bug-fix rationale:\s*(.+)$/im)?.[1]?.trim();
    if (rationale && rationale.length >= 20) {
      return {
        ok: true,
        reason: "Maintainer-labeled bug-only exemption with rationale.",
      };
    }
    return {
      ok: false,
      reason:
        "bug-fix-only requires a PR body line: Bug-fix rationale: <at least 20 characters>.",
    };
  }
  return {
    ok: false,
    reason:
      "Add or update a dated product release entry, or request the reviewed bug-fix-only exemption.",
  };
}

function readEntriesAt(sha) {
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error("Expected a full commit SHA.");
  const json = execFileSync("git", ["show", `${sha}:${notesPath}`], {
    encoding: "utf8",
  });
  return JSON.parse(json).releaseNotes?.entries ?? {};
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("GITHUB_EVENT_PATH is required.");
  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const pr = event.pull_request;
  if (!pr || pr.base.ref !== "main")
    throw new Error("Expected a pull request into main.");
  const result = evaluateNoteGate({
    baseEntries: readEntriesAt(pr.base.sha),
    headEntries: readEntriesAt(pr.head.sha),
    labels: pr.labels.map((label) => label.name),
    body: pr.body ?? "",
    initialDraftChanged:
      pr.head.ref === "preview" &&
      Boolean(
        execFileSync(
          "git",
          [
            "diff",
            "--name-only",
            pr.base.sha,
            pr.head.sha,
            "--",
            "docs/releases/initial-promotion-draft.md",
          ],
          { encoding: "utf8" },
        ).trim(),
      ),
  });
  console.log(result.reason);
  if (!result.ok) process.exitCode = 1;
}
