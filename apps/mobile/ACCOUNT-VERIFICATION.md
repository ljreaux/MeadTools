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

## Product-update email preferences (#604) — November 25, 2026

Tested on the iPhone 18 Pro simulator (iOS 27.0) against the seeded account
in the existing local development database. The final email-only build was
rechecked after removing all-device sign-out.

| Check | Result |
| --- | --- |
| Product-update email preference | Opt-in and opt-out each showed save confirmation. The existing account API and database confirmed both changes. The seeded account was returned to its original opted-out setting. |
| Android device | Pending. |

Seeded sign-in and the existing release-email GET and PATCH passed against
the local backend. Mobile tests, lint and typecheck and API client, API
contract and i18n checks passed.

## Account deletion request draft (#605) — November 26, 2026

| Check | Result |
| --- | --- |
| iOS Simulator | Cancel dismissed the account dialog. Continuing opened the local MeadTools request form in Safari. |
| Web form | With the contact endpoint stubbed locally, a failed request showed an error and kept both fields available for retry. A successful retry showed confirmation and cleared the fields. The stub checked the expected request payload both times. |
| Form before JavaScript loads | The fallback uses POST so the browser keeps the name and email out of the URL. |
| Android device | Pending. |

The test used synthetic contact details. The stub sent no email and no
account was deleted. Support inbox delivery and whole-account erasure were
outside this check.

## Android pass — November 27, 2026

Tested at `60a40ae5` on the Medium Phone API 36.1 emulator with a native debug
client, Metro started with a clean cache, the local web server, and the existing
seeded account in the normal local database. Unless a row says otherwise, every
check used the real local backend.

| Check | Result |
| --- | --- |
| Signed-in profile | Pass. Showed the seeded email, the public username **MeadTools User**, Premium status, 494 prompt credits, and the email preference. The Google avatar setting was hidden on the password-only account. |
| Username validation | Pass. A whitespace-only entry showed “Enter a public username.” and sent no request. |
| Username save and persistence | Pass. `␣␣MeadTools Android Profile␣␣` saved through `PATCH /api/auth/account-info` and showed confirmation. The database held the trimmed value, and the value was still shown after a force stop and relaunch. The original **MeadTools User** was then saved back through the app. |
| Save button accessibility | Fixed, then pass. After a save, Android kept "busy" as the button description. The button now has an explicit label, like Start Brew in `new-brew.tsx`. After the restoring save, it read “Save username”. |
| Google avatar | Pass with fixture. A temporary `google_id` (`local-606-avatar-fixture`) and a local image URL exposed the switch on the same account. Turning it on saved, showed confirmation, and displayed the image beside the email. The switch was still on after relaunch. Turning it off saved and removed the image. The original Google fields (none, switch off) were restored. Google OAuth and a real Google image host were not checked. |
| Premium active, expired, and free | Pass. A temporary manual membership on the test account (`local-601-premium-cost-check`, shared with the recipe cost check and removed afterward) showed “Premium is active through Nov 29, 2026.” After its end date moved into the past, pull to refresh showed “Your Premium access has expired.” After it was revoked, pull to refresh showed “Free account.” |
| Prompt credits | Pass. 494 credits remained visible in all three states, with no prices or purchase controls. The ledger was not recomputed independently. |
| Product-update email | Pass. Opt-in and opt-out each saved through `PATCH /api/account/release-emails` and showed “Product update preference saved.” The database changed from `false` to `true` and back to `false`, the original setting. |
| Deletion dialog | Pass. Cancel dismissed the dialog and kept the app in front. Open Request Form opened Chrome at the local `/account-deletion` page, which showed empty name and email fields. Nothing was submitted, and Back returned to the app. |
| Support inbox delivery | Pass. With approval, one clearly labelled test message (“TEST ONLY — please ignore … not an account deletion request”) was sent from the local web contact form. The contact form uses the same `/api/contact` endpoint and support inbox as the deletion form. The real SMTP server accepted it: the endpoint returned 200 after a 3.6-second send, and the page showed “Your message has been sent!” The deletion form itself was not submitted, because its fixed message reads as a real deletion request. Larry confirmed that the message arrived in the support inbox. |

Mobile tests (112) and the Mobile typecheck passed with the label fix.
