import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function branchSyncPlan({ sameCommit, mainContainsPreview, previewContainsMain, sameTree }) {
  if (sameCommit || previewContainsMain) return "unchanged";
  if (mainContainsPreview) return "fast-forward-preview";
  return sameTree ? "reconcile-preview" : "review-required";
}

export function synchronizeReleaseBranches() {
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
  const contains = (ancestor, descendant) => {
    try { git("merge-base", "--is-ancestor", ancestor, descendant); return true; }
    catch (error) { if (error.status === 1) return false; throw error; }
  };
  git("fetch", "origin", "main", "preview");
  const main = git("rev-parse", "origin/main");
  const preview = git("rev-parse", "origin/preview");
  const mainTree = git("rev-parse", `${main}^{tree}`);
  const plan = branchSyncPlan({
    sameCommit: main === preview,
    mainContainsPreview: contains(preview, main),
    previewContainsMain: contains(main, preview),
    sameTree: mainTree === git("rev-parse", `${preview}^{tree}`),
  });
  if (plan === "unchanged") {
    console.log("Preview already contains main; staged preview work remains unchanged.");
    return;
  }
  if (plan === "review-required") {
    throw new Error("Divergent branches contain different files. Merge reviewed main changes into preview through a PR; no refs were changed.");
  }
  // Identical trees permit an ancestry-only merge, with no conflict resolution or
  // file changes. Both parents are retained; main is never updated by this job.
  const target = plan === "fast-forward-preview" ? main : git(
    "-c", "user.name=MeadTools Branch Sync",
    "-c", "user.email=branch-sync@users.noreply.github.com",
    "commit-tree", mainTree, "-p", preview, "-p", main,
    "-m", "Reconcile identical reviewed release histories into preview",
  );
  // A normal push fails if preview advanced concurrently. Never force a ref.
  git("push", "origin", `${target}:refs/heads/preview`);
  console.log(`${plan}: updated preview without changing main.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  synchronizeReleaseBranches();
}
