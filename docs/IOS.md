# Build and install Resell on iPhone

Resell reuses the React/TypeScript app and Rust/Tauri commands on iOS. The iOS
side of the marketplace plugin is Swift: it stores 999.md credentials in the
iOS Keychain, verifies the account in the in-app WebView, runs the same offer
preparation page scripts, provides haptic feedback, and captures/recover photos
using the iPhone camera. Camera photos and their pending recovery record stay
in the app's private container. Inventory continues to use the existing local
database and optional Supabase sync.

## Requirements

- A Mac running a supported macOS version, with full Xcode installed and opened
  once (Command Line Tools alone are not enough for iOS).
- Node.js 22.12 or newer, Rust, and CocoaPods on the Mac.
- An iPhone connected by USB or paired in Xcode. Sign in to Xcode with an Apple
  Account and select a development team for the app target.

On the Mac, install the iOS Rust targets and CocoaPods once:

```sh
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
brew install cocoapods
```

Tauri's current iOS prerequisites and device workflow are documented in its
[prerequisites](https://v2.tauri.app/start/prerequisites/) and
[mobile development guide](https://v2.tauri.app/develop/).

## First iPhone development install

1. Put this repository on the Mac (clone it or copy it; do not include
   `.env.local` in a public repository). Install dependencies with `npm ci`.
2. Create a private `.env.local` from the existing deployment settings. Keep
   the same browser-safe Supabase URL/key and set `VITE_API_BASE_URL` to the
   deployed HTTPS API base. Never put a Supabase service-role or database
   secret in a `VITE_` variable.
3. Generate the Xcode project once:

   ```sh
   npm run ios:init
   ```

4. Connect and unlock the iPhone, tap **Trust** if prompted, and enable
   **Settings → Privacy & Security → Developer Mode** on the phone if iOS asks
   (then restart and confirm). Open the generated project under
   `src-tauri/gen/apple` in Xcode, select the Resell app target, then under
   **Signing & Capabilities** enable automatic signing and choose your
   **Personal Team** or paid team. Use a unique bundle identifier if Xcode
   reports that the configured one is already registered.
5. From the Mac, run the development app directly on the connected phone (use
   the exact device name shown by Xcode if prompted):

   ```sh
   npm run ios:dev -- "Your iPhone name" --host
   ```

   Or open Xcode through Tauri and select the phone as the run destination:

   ```sh
   npm run ios:dev -- --open --host
   ```

The Mac and iPhone should be on the same network. The app then installs and
launches from Xcode. If iOS requests local network access for the development
server, allow it. This permission is needed only for the development build's
connection to Vite. When using `--open`, keep the Tauri CLI process running
while Xcode is open.

## Installing a release

For an install directly from Xcode, choose the iPhone as the run destination
and press **Run**. To create a signed distribution archive, use Xcode's
**Product → Archive** and distribute through TestFlight or the App Store. The
Tauri release command is:

```sh
npm run ios:build
```

Apple signing is required for device installs. A free Personal Team is enough
for personal development installs, but Apple-issued Personal Team provisioning
profiles expire after 7 days, so the app must be rebuilt/reinstalled
periodically. TestFlight and App Store distribution require Apple Developer
Program membership. See Apple's [device install and signing guide](https://developer.apple.com/documentation/xcode/building-and-running-an-app)
and [developer account details](https://developer.apple.com/help/account/basics/about-your-developer-account).

## Current verification boundary

The iOS Swift plugin and Tauri wiring are in source, but this Windows workspace
cannot run Xcode or install on an iPhone. The first Mac build is the point to
resolve any Xcode/Swift toolchain issues, then verify camera permission and
recovery, account sign-in/verification, offer preparation, inventory sync, and
relaunch behavior on a physical device. Saved Android credentials are
device-local and will not automatically transfer to iPhone; reconnect the
999.md account in Resell on the iPhone.
