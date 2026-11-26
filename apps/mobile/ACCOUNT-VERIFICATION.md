# Mobile Account verification

## Profile, username, and avatar (#602) — November 25, 2026

Tested on the iPhone 18 Pro simulator (iOS 27.0) with the Expo development
client, the local web server, and the existing seeded user in the local
development database.

| Check | Result |
| --- | --- |
| Signed-in profile | The Account tab showed the seeded email and existing public username. The Google avatar setting was hidden on the password-only account. |
| Username validation and save | A whitespace-only entry showed “Enter a public username.” A padded valid entry saved as **MeadTools iOS Profile**. The app showed confirmation, the database held the trimmed value, and the value appeared after relaunch. |
| Google avatar | A temporary Google link and local image URL exposed the switch on the same seeded account. Turning it on saved the preference and displayed the image. The switch remained on after relaunch. Turning it off saved again and removed the image. Google OAuth itself was outside this check. |
| Android device | Pending. |

The Google fixture fields were restored after testing. The seeded user's public
username remains **MeadTools iOS Profile** for review.

Mobile tests, lint, and typecheck passed, along with shared API client and API
contract tests and typechecks and i18n tests. Regenerating the contracts and
OpenAPI updated the generated types and aliases. The published OpenAPI spec
stayed the same.

## Premium and credit status (#603) — November 25, 2026

Tested on the iPhone 18 Pro simulator (iOS 27.0) with the Expo development
client and seeded user in the existing local database. The local web server
was restarted with Premium access enabled to exercise the active state.

| Check | Result |
| --- | --- |
| Active | The restored manual membership showed its local access-through date. |
| Expired | After temporarily moving the membership end date into the past, **Refresh account status** showed **Your Premium access has expired.** |
| Free | The same refresh showed **Free account** while the membership was temporarily marked revoked. |
| Membership recorded, access disabled | Before enabling Premium on the local server, the app showed that benefits were currently unavailable. |
| Prompt credits | The seeded balance of **1,000** remained visible in every state. The card exposed a refresh action and displayed no prices or purchase controls. |
| Android device | Pending. |

The seeded membership's original end date and revocation state were restored.
The credit ledger required no test changes.

Mobile tests, lint, and typecheck passed. Web tests and typecheck passed. The
API client and contract tests and typechecks, i18n tests, and Premium domain
tests passed. Contract and OpenAPI
regeneration produced no file changes. The Premium and credit endpoints remain
excluded from the public API reference.
