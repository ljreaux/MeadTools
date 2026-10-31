# Application impact and mobile quality

The existing **Determine affected apps** job in `quality.yml` runs
`scripts/app-impact.mjs --quality --github-output`. Its mobile output gates
mobile TypeScript, runtime configuration tests, Expo compatibility, and Android
export together. Classification tests run in that job even for documentation PRs.
No skip label is needed for ordinary web/MCP features.

Quality follows Mobile's workspace dependencies recursively, including dev,
optional, and peer dependencies. It uses the union of base and head manifests
so removed dependencies retain coverage. Mobile currently imports i18n without
listing it in its manifest; the classifier explicitly includes that workspace.
Changes anywhere in a consumed workspace require validation, except locale-only
changes. Packages outside that graph (such as recipe-agent and recipe-workflows)
do not require mobile validation. Unknown package paths conservatively do.

Root package.json (including overrides), shared TypeScript configuration, npm/Node
configuration, scripts, and GitHub CI configuration require mobile validation.
These deliberately conservative tooling rules avoid maintaining an incomplete
list of scripts that could influence builds. Documentation alone does not.

For npm v3 lockfiles, compare all entries reachable from Mobile and its consumed
workspaces in both revisions, following nested npm resolution and workspace links.
A lockfile change can affect Mobile even alongside a web manifest change; a web
manifest is not evidence that every dependency update is web-only. Unsupported
lockfiles, unresolved required dependencies, missing revisions, or invalid
manifests fall back to running checks. Root manifest changes also remain
conservative even if the lockfile appears unrelated.

Release classification remains separate: existing Vercel/EAS callers retain the
translation migration pause, English/Weblate deferral, and German artifact build
rules. Quality validates source changes immediately, regardless of release
pauses or translation batches. English changes in a web feature therefore do not
force Expo checks. Web and Desktop keep their existing package classification.

Regression coverage includes the path list from original #466 feature commit
`5e7a8a4d1a8f0b631e4d812a5067492126f92b30`, before its Expo updates, plus real
Mobile dependency paths and lockfile closure changes. Run `npm run test:workflows`.
