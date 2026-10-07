# Epidom POS for Android (Play Store / APK)

The Android app is the Epidom website packaged as a **Trusted Web Activity**
(TWA): a real installable app (Play Store listing, or an `.apk` you hand out
yourself) that runs the live site full-screen in Chrome's engine. It is the same
app the cashier already uses in the browser, so:

- updates ship with every web deploy, with no new app release needed;
- **offline works the same way**: the service worker keeps the screens on the
  device, Offline Mode mirrors the menu, orders, staff and stock, and sales made
  without a connection queue on the device and sync on reconnect
  (`docs/OFFLINE_POS.md`);
- Bluetooth receipt printers work (Chrome on Android supports Web Bluetooth).

You only rebuild the Android package to change its name, icon, start page or
signing key.

> The build files and the signing key are **not** kept in this repo. Build in
> `android/twa/` (git-ignored) and keep the keystore somewhere safe: losing it
> means you can never update the Play listing again.

## One-time setup

1. Install [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap):
   `npm i -g @bubblewrap/cli`. On first run it offers to download a JDK and the
   Android SDK for you. Accept.
2. Generate the project from the live web manifest:

   ```bash
   mkdir -p android/twa && cd android/twa
   bubblewrap init --manifest https://epidom.fr/manifest.webmanifest
   ```

   Answer the prompts with:

   | Prompt             | Value                                  |
   | ------------------ | -------------------------------------- |
   | Domain             | `epidom.fr`                            |
   | URL path           | `/go/dashboard` (the manifest's start) |
   | Application name   | `Epidom POS`                           |
   | Short name         | `Epidom`                               |
   | Application ID     | `fr.epidom.pos`                        |
   | Display mode       | `standalone`                           |
   | Status bar color   | `#18181B` (manifest `theme_color`)     |
   | Splash color       | `#FFFFFF`                              |
   | Icon / maskable    | keep the 512 px icons it found         |
   | Push notifications | Yes (delegated to Chrome)              |
   | Signing key        | create a new one, and store it safely  |

3. Build: `bubblewrap build`. You get:
   - `app-release-bundle.aab`: upload this to Play Console;
   - `app-release-signed.apk`: install it directly on a tablet (sideload) if
     the client doesn't want to go through the Play Store.

## Make it open full-screen (Digital Asset Links)

Without this step the app works but shows a slim browser bar at the top.

1. Get the fingerprint(s):
   - upload key: `bubblewrap fingerprint` (or `keytool -list -v -keystore android.keystore`);
   - after the first Play upload: **Play Console → Setup → App signing → SHA-256**
     (Play re-signs the app, so devices see this one).
2. Set them in Vercel (Production), comma-separated:
   `ANDROID_TWA_SHA256_FINGERPRINTS=AA:BB:…,11:22:…`
   (and `ANDROID_TWA_PACKAGE_NAME` if you didn't use `fr.epidom.pos`).
3. Redeploy, then check
   `curl https://epidom.fr/.well-known/assetlinks.json`: it should list the
   package and fingerprints. Until the variables are set it answers `[]`.

Details: `docs/ENVIRONMENT.md` → "Android app".

## Notes

- **Offline data lives in Chrome's storage for epidom.fr.** Clearing Chrome's
  site data for epidom.fr clears the app's offline copy and any sales not yet
  synced. Tell staff to sync (Offline & Sync → Sync now) before clearing anything.
- The first launch needs internet once: to download the app's screens and to
  sign in.
- iPad / iPhone: Apple doesn't accept a website wrapper like this in the App
  Store. Install from Safari instead (Share → Add to Home Screen); offline works
  the same way there.
