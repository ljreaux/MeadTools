# Read-only mobile POC verification

Tracking issue: [#346](https://github.com/ljreaux/MeadTools/issues/346).
This record is for the read-only companion at preview commit `49c885697`
(PR #412). Update the result column only after an actual device check.

## Build and install evidence — October 4, 2026

| Check | Result | Evidence |
| --- | --- | --- |
| iOS preview build | Pass | EAS build `3baa33a7-cbfb-4432-8b23-1c0d393c3057` finished for `49c885697`; Simulator build. |
| Android preview build | Pass | EAS build `bf6efea3-d758-4c55-af49-a0c2e81b2063` finished for `49c885697`. |
| German follow-up iOS preview build | Pass | EAS build `024de306-c914-4205-9c09-b5e0e2ce302e` finished for Weblate commit `f7080b0cc`. |
| German follow-up Android preview build | In progress | EAS build `da1586fb-88cb-4937-83f2-325d5b200322` started for `f7080b0cc`. |
| iOS development client | Pass | Metro bundled the timeline branch, and the project owner saw recent activity rows on the iPhone 17 Simulator. The installed client required opening through Expo CLI; launching its icon had shown an older embedded bundle. |
| Android preview install and launch | Pass for installation and process launch | The APK installed on a fresh `MeadTools_POC_API_36_1` emulator and `com.meadtools.mobile` started. The original emulator was preserved because its existing app used a different signing key. |
| Preview build gate | Fix prepared; live confirmation pending | A merge with English timeline strings started both EAS preview builds before Weblate. `eas/checkout` fetches one commit, so the previous `HEAD^` check silently missed English changes. The new gate fetches the push's previous commit and is covered by a shallow-checkout regression test. |

## Manual smoke test

Use a preview test account. Do not put passwords, tokens, screenshots of account
data, or backend responses in this document. Record **pass**, **fail**, or
**blocked** with the device and date after each check.

| Flow | iOS Simulator | Android emulator | How to check |
| --- | --- | --- | --- |
| Password sign-in | Pending | Pass: owner reset the preview password and signed in on October 4 | Sign in to the preview backend. |
| Session restore | Pending | Pass: owner fully closed and reopened the Android app on October 4 | Close the app completely, relaunch, and confirm the session remains usable. |
| Active brew list | Observed during timeline check; formal check pending | Pass: owner confirmed the list on October 4 | Confirm active brews, stage, volume, and entry counts. |
| Brew overview | Observed during timeline check; formal check pending | Pass: owner confirmed the overview on October 4 | Open an active brew and compare targets and ingredients with the web preview. |
| Recent activity | Pass: owner confirmed rows on October 4 | Pass: owner confirmed rows and scrolling on October 4 | Open a brew with entries; check newest-first dates, measurements, additions, notes, and long-list scrolling. |
| English layout | Timeline observed; full flow pending | Pending | Check labels, dates, number formatting, and text wrapping. |
| German layout | Pending device check | Pending updated preview build and device check | Weblate commit `f7080b0cc` added all 23 new timeline keys. Set the device language to German and repeat list, overview, and timeline checks. German suggestions still need human review. |
| Loading and empty states | Pending | Pending | Observe first load and use a test account without active brews. |
| Expired session | Pending | Pending | Use a test session that the preview backend rejects and confirm sign-in recovery. |
| Offline recovery | Pending | Pending | With an active session, disconnect only the test device, refresh, reconnect, and retry. |
| Server error recovery | Pending | Pending | Use a controlled preview or mock backend error, then retry; do not disrupt the shared preview backend. |

The verification branch moves stale-data refresh errors to the top of the brew
list and detail screen and adds pull-to-refresh on brew detail. These changes
still need a device check; the completed preview builds above contain the
earlier timeline code.

Google sign-in also needs device checks. The preview environment currently has
an iOS client ID but no Android client ID, so the Android preview shows password
sign-in only. Record Google sign-in as a separate follow-up if it is required
for this POC decision.

## Current decision

**POC sign-off is pending.** The build pipeline and the Android/iOS read-only
happy paths have positive evidence, but German device rendering and the
error/recovery states have not passed the manual smoke test. Do not close #346
or call the read-only POC complete until those checks are recorded.

The next product work would be one gravity measurement with an idempotent offline
outbox. Timeline filtering and organizing ingredients by stage are useful later
enhancements; neither changes the read-only POC's current result.
