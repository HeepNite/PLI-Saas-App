# Android kiosk release build

The studio tablet runs a signed **release** build (not debug): no debuggable flag, no WebView remote debugging.

## Signing key

- The keystore lives **outside the repository** at `~/.pli-kiosk/pli-kiosk-release.jks` (alias `pli-kiosk`).
- `~/.pli-kiosk/keystore.properties` (mode 600) holds `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
- The password is also in the macOS Keychain as `pli-kiosk-release-keystore`.
- Certificate SHA-256: `d6f84f502ca257eff78e5bcd41b441c2a19f43d2fb7d399002fb776800ed12e6`.
- **Back up the keystore and its password.** Losing them means the installed app can no longer be updated in place.

## Build

```sh
cd native-kiosk
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ANDROID_HOME=$HOME/Library/Android/sdk \
./gradlew --no-daemon \
  -PPLI_APPROVED_HTTPS_ORIGIN=https://pli.palladiumlatin.art \
  -PPLI_NATIVE_COLLECTION_ENABLED=true \
  -PPLI_RELEASE_KEYSTORE_PROPERTIES=$HOME/.pli-kiosk/keystore.properties \
  -PPLI_VERSION_CODE=<increment every release> \
  -PPLI_VERSION_NAME=<x.y.z> \
  :androidApp:testDebugUnitTest :androidApp:assembleRelease
```

Output: `androidApp/build/outputs/apk/release/androidApp-release.apk`. Verify with `apksigner verify --print-certs`.

## Install

Release and debug builds are signed with different keys: switching from a debug install requires uninstalling the
debug app first (this clears app data, so the staff terminal session must be signed in again). Release-to-release
updates install in place with `adb install -r` as long as the version code increases.

Code shrinking (R8) is intentionally off until Stripe Terminal keep rules are verified on device.
