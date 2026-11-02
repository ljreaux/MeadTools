// A reviewed policy update is separate from code promotion and publication.
// Keep this list explicit: a directory-wide exception could ship application code.
export const policyPaths = new Set([
  ".agents/skills/meadtools-monthly-release/SKILL.md",
  ".github/workflows/monthly-release-window.yml",
  ".github/workflows/main-release-notes.yml",
  ".github/workflows/quality.yml",
  "scripts/monthly-release-window.mjs",
  "scripts/monthly-release-window.test.mjs",
  "scripts/check-pr-release-notes.mjs",
  "scripts/check-pr-release-notes.test.mjs",
  "scripts/release-policy.mjs",
  "scripts/release-policy.test.mjs",
  "scripts/quality-impact.test.mjs",
  "docs/monthly-release-gate.md",
  "docs/monthly-release-notes.md",
  "docs/releases/monthly-record-template.md",
]);

export function policyDiffPassed(files) {
  return Array.isArray(files) && files.length > 0 && files.every(file =>
    policyPaths.has(file.path) &&
    ["added", "modified"].includes(file.status));
}

export function policyApproval(pr, expectedHead) {
  const labels = new Set(pr.labels.map(({ name }) => name));
  const body = pr.body ?? "";
  return pr.state === "open" && !pr.draft && pr.base.ref === "main" &&
    /^release\/policy-/.test(pr.head.ref) &&
    pr.head.repo?.full_name === pr.base.repo?.full_name &&
    labels.has("release-ready") && labels.has("policy-ready") &&
    !["publication-ready", "bug-fix-only", "hotfix-ready", "initial-release-ready", "skip-web-check", "skip-mobile-check", "build-mobile-production"].some(label => labels.has(label)) &&
    /^Policy approval: Larry Reaux approved this workflow policy change\.\s*$/m.test(body) &&
    body.match(/^Release-ready head:\s*([a-f0-9]{40})\s*$/im)?.[1] === pr.head.sha &&
    body.match(/^Release-ready base:\s*([a-f0-9]{40})\s*$/im)?.[1] === pr.base.sha &&
    /^Mobile production build: skip\s*$/m.test(body) &&
    (!expectedHead || expectedHead === pr.head.sha);
}
