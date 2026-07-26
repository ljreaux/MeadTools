# PR check overrides

Use these labels only when a known, unrelated failure should not block a pull
request. They apply only to the pull request validation run; the normal
`preview` or `main` push validation still runs after merge.

| Label | Skips |
| --- | --- |
| `skip-web-check` | Typecheck, test, and verify OpenAPI |
| `skip-mobile-check` | Typecheck and export mobile |

The affected-app classification and Vercel preview are deliberately not
skippable with these labels. Remove an override label once it is no longer
needed.
