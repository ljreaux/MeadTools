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
