# PR check overrides

Use these labels only when a known, unrelated failure should not block a pull
request. The normal `preview` or `main` push validation still runs after merge.

| Label               | Skips                                                  |
| ------------------- | ------------------------------------------------------ |
| `skip-web-check`    | Typecheck, test, and verify OpenAPI; Vercel PR preview |
| `skip-mobile-check` | Typecheck and export mobile                            |

Vercel reads `skip-web-check` using its pull request and repository system
environment variables. Ensure **Automatically expose System Environment
Variables** is enabled in the Vercel project settings. If GitHub cannot be
reached, Vercel builds the preview rather than skipping it. Remove an override
label once it is no longer needed.
