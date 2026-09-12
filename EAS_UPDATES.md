# EAS Update (OTA) — The Cut v2

JS/UI-only changes can be pushed to installed TestFlight / App Store builds
with `eas update`. Native changes still need a new binary.

## Runtime version

`app.json` uses:

```json
"runtimeVersion": { "policy": "fingerprint" }
```

Expo SDK 57 supports this. EAS hashes native code, config plugins, and native
dependencies so an OTA is only applied to binaries that actually match. Do not
switch this to `appVersion` unless we have to — that policy only changes when
`expo.version` is bumped, so a forgotten bump can ship incompatible JS to older
installs.

## Channels

`eas.json` maps build profiles to update channels:

| Profile       | Channel       | Command |
|---------------|---------------|---------|
| production    | production    | `eas build --profile production` / `eas update --branch production` |
| preview       | preview       | internal builds |
| development   | development   | dev client |

Production builds and production updates share the `production` channel.

## What qualifies for `eas update`

Safe (JS bundle only — no new native binary):

- Screen / component layout, styling, copy
- React Navigation structure (still JS)
- Fetch / API client logic, filters, ranking display
- Bug fixes that do not add native modules
- Asset files already bundled as JS-accessible resources (e.g. existing images
  referenced from JS), within Expo’s update size limits

Still requires `eas build` then `eas submit`:

- Adding or upgrading a native package (`npx expo install` of something with
  native code, e.g. `expo-camera`, `expo-notifications`)
- App icon, splash, display name, bundle identifier
- iOS/Android permissions (`infoPlist`, `android.permissions`)
- SDK upgrades, config plugins, or `app.json` native keys
- Anything that changes the fingerprint (native runtime)

If in doubt, run a production build. Fingerprint mismatch means the OTA will
simply not apply — it will not brick the install.

## eas.json and the fingerprint (do not blank submit)

SDK 57's `@expo/fingerprint` (0.20.12) hashes the **entire** `eas.json` as an
`easBuild` source. That includes `submit.production.ios` (`appleId`,
`ascAppId`, `appleTeamId`), even though those fields only talk to App Store
Connect and never touch native code.

The first OTA test only reached TestFlight **build 4**
(`runtimeVersion` `37e006ce048783324c56a40ec49872b8642b5123`) after temporarily
emptying the submit block. Putting the credentials back changed the hash, so a
normal `eas update` would have published against a different runtime and
silently never arrived on that binary.

What we did **not** use, and why:

- `.fingerprintignore` listing `eas.json` — supported, but it drops the whole
  file. Build-relevant keys (`channel`, `ios.buildConfiguration`,
  `android.gradleCommand`) would stop affecting the hash, and removing the
  source entirely would **not** match build 4's existing fingerprint.
- `sourceSkips: ['EasJson']` — documented on later `@expo/fingerprint`
  versions, **not present** in the SDK 57 package we ship with (SourceSkips
  stops at `ExpoConfigExtraSection`).

The supported fix in this SDK is `fingerprint.config.js` at the project root,
using `fileHookTransform` (see Expo Fingerprint docs: "Customize sources
before fingerprint hashing"). Before hashing, submit profiles are emptied so
credentials can live in `eas.json` while `cli` / `build` fields stay in the
hash.

Verified 10 Sep 2026: with submit credentials present and **not** blanked,
`npx expo-updates fingerprint:generate --platform ios` returned
`37e006ce048783324c56a40ec49872b8642b5123`. A follow-up
`eas update --branch production --environment production` published iOS
runtime `37e006ce048783324c56a40ec49872b8642b5123` (same as build 4):
https://expo.dev/accounts/thecutgolf-app/projects/the-cut-v2-preview/updates/024a3a07-5fe6-4973-bd7a-b3c890da1e24
Do not strip submit from `eas.json` before publishing updates.
Keep `fingerprint.config.js` in the repo so local `eas update` and EAS Build
use the same transform.

## Publish an OTA (after testers have this binary)

```bash
eas update --branch production --environment production --message "short description of the JS change"
```

Updates are checked on launch / foreground, not mid-session. Testers should
background the app and reopen it (sometimes twice) to pick up the new bundle.

## First binary with OTA support

The production iOS build that first included `expo-updates` is the last one
that needs a full TestFlight review for a pure JS/UI change, as long as the
fingerprint still matches.

## Submit (non-interactive)

`eas.json` `submit.production.ios` is filled in for the shared App Store
Connect app (`com.provailai.thecut`):

- `appleId`: `hello@provailai.co.uk`
- `ascAppId`: `6781390680`
- `appleTeamId`: `3VJMFZXJVD`

```bash
eas submit --platform ios --id <build-id>
```
