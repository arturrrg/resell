# Resell offers and native preparation

Offer creation lives in the main **Offers** workspace. **Publish on 999.md** authorizes automatic preparation and one free publication attempt for each selected account. Successful marketplace responses bind the exact advert ID to the saved draft, then return to Inventory. Paid services, account verification and unknown results stop automation. The separate sandbox remains available for transfer-engine regression testing.

## Main workflow

1. Open Offers and choose **New offer**.
2. Fill Romanian and Russian titles, description, asking price/currency, device specifications and contact/location details. Unknown values remain empty.
3. Add up to ten JPEG, PNG or WebP photos. Tap a photo to make it the cover, move it or remove it. Photos are normalized locally, keep orientation and have a maximum 2,400-pixel long edge. Total prepared photos must fit within 25 MB.
4. Review the photo gallery and full draft. Changes save automatically.
5. In the installed Android app, connect the marketplace account once, then choose **Prepare on 999.md**. The app signs in when needed and begins filling the matching creator automatically; there is no second **Fill @account** tap. Security challenges still require the user.
6. Automatic publishing requires a fully retained transfer, the matching public account, a known positive free-placement allowance and a unique enabled Publish control. Validation errors (including a missing confirmed phone number) appear in the preparation panel. No publication is retried automatically.
7. A verified UpsertAd/PublishAd response records the exact advert ID. A single-account run returns to Inventory. Multiple accounts continue automatically through the same saved draft, then remain on its Review screen. Pending moderation is shown separately. The completion notice dismisses after ten visible seconds; hidden tabs and background time do not count. Profile monitoring checks the matching ID and owner; it does not select the newest or a similarly titled advert. **Back to Resell** without a verified response pauses the queue.

**Price by account** is an optional collapsed section below the asking price. Empty overrides use the main price and currency. Selected amounts are shown in the account picker and snapshotted into the queue, including resumed runs. Only the current account's amount is transferred to 999.md. The marketplace status is a compact two-line pill at the top left with a return arrow.

### Live automation check — 15 November 2026

The ten-photo test draft reached the official creator with 100% completion and three free placements remaining on @arturgarstea. The inspected action is **Publică și continuă**. One automatic click was attempted; 999.md rejected it with **Publicarea anunțurilor este posibilă doar cu un număr de telefon confirmat.** No UpsertAd/PublishAd request was sent and no advert was created. Full public-listing and Inventory ID verification still requires the account owner to confirm a phone number, then continue testing. The automated tests exercise the inspected label, one-click behavior, wrong account/origin, exhausted or unknown quota, ambiguous/disabled controls, dialogs and the real phone-verification rejection.

After the owner confirmed the phone number, the resumed automatic submission returned `UpsertAd → AD_STATE_PUBLIC`, advert **105904154**. Resell automatically returned to Inventory, persisted the completed receipt and linked exactly `https://999.md/ro/105904154`. Independent public-profile and importer reads confirmed @arturgarstea, the exact title, 13,000 MDL, all ten marketplace-hosted photos and the saved description. No paid service was selected. Evidence is stored locally in `.native-tools/verified-phone-publication.log`, `.native-tools/published-listing-verification.json` and `.native-tools/resell-published-inventory.png`.

999.md's tested free-account limits are 100 characters per title, 2,000 description characters and ten photos. The editor validates these before handing off. It does not invent a translation or claim uploaded photos succeeded merely because a FileList was assigned: completion checks retained fields and marketplace-returned photo previews.

The website cannot attach photos or fill another site's form across origins. Its preparation sheet provides **Copy titles**, **Copy description**, an ordered photo ZIP, an offer JSON export and the official creator link. Sign in to the same Resell account in Android to open the automatically synced draft for native filling. Android is the supported native autofill platform.

## Drafts and private cloud storage

Inventory hides a publication when a complete, successful scan of its exact account confirms that the advert ID is no longer public, or its direct refresh confirms the advert is unavailable. Partial scans and network failures retain saved data. Absence is persisted even when deletion happens before the first profile import. Publication receipts, drafts, photos and sales history are retained; a later public reappearance restores the same monitored record. Account monitoring runs about once per minute while the app is in the foreground; server feed caches can add up to one minute.

Confirmed missing publications create a reminder above Drafts. The user enters profit in MDL (zero is allowed) and presses **Confirm & remove draft**. This atomically removes the original editable draft and photo blobs, marks its cloud tombstone, and creates one metadata-only Sales archive with the confirmed profit. Confirmation is idempotent, with no second deletion prompt. The archive syncs privately and remains available to Sales after the draft is gone. Manual **Mark as sold** actions and the right-swipe sale gesture have been removed. A public reappearance dismisses an unconfirmed reminder and retains the draft. Other marketplace copies are not remotely deleted by this local close action.

Drafts and templates stay separate from monitored public inventory cards. Sold offer metadata powers Sales without removing the saved photo blobs; Undo restores the draft. Each workspace uses its own versioned IndexedDB database, including actual photo blobs. Permanent signed-in accounts automatically sync metadata through the private resell_offer_drafts table and photo files through the private resell-offer-photos bucket. The migration is supabase/migrations/20261112213000_private_offer_drafts.sql.

Only the owning verified account can read or write its drafts and photo paths. Guest sessions and public read-only inventory links cannot open these drafts. Writes use expected server versions; conflicting local changes are preserved in a copy. Uploads finish before metadata is committed, and obsolete files are cleaned up after a successful commit. Reconnect/focus and a foreground timer pick up changes. Local drafts remain available when the network is down.

## Saved 999.md sign-in on Android

Open **Account → Marketplace accounts** to manage up to twenty device-local connections per Resell workspace. Email logins retain their full credential, while official sign-in automatically records the real public username for avatars and monitoring. The Accounts and Account sheets use the same outer width. The password is encrypted with an Android Keystore AES-256-GCM key, excluded from Android cloud/device-transfer backups, and never included in Supabase sync, draft exports or local inventory databases. The settings form clears the entered password after saving.

During an active preparation, credentials are passed only to the exact official Simpals login route for the 999.md project and its official return URL. Known cookie consent is accepted automatically. The sign-in sequence waits two seconds for hydration, one second between fields and one second before submitting once. Its observer remains active if hydration replaces the form. Manual nonempty fields, including edits made during the delay, are left alone. Invalid credentials, OTP and security challenges require the user; they are not bypassed or repeatedly submitted.

The observed Simpals confirmation route drops projectId and retains only redirectUrl. That route is accepted only on the exact official host/path with the HTTPS 999.md /__sid-auth return; a supplied wrong projectId is still rejected. The exact visible Continue-to-999.md control is pressed after a 1.5-second settling delay, with at most four clicks spaced two seconds apart if hydration ignores a click. The native creator then starts filling once the configured public account matches. Publish remains manual.

The official Continue action is an anchor wrapping a button with identical text. The selector collapses only ancestor/descendant matches into one action, validates the link's HTTPS 999.md authentication-return destination (including its observed language prefix), and rejects separate matching controls or unrelated links. It does not construct or log the service's authentication query parameters.

Mobile price editing and verification select the visible dialog containing input[name="2.value"], rather than the first generic dialog, and wait for its enabled Apply control. The specific #add-form-progress tutorial is recognized by its instructional text and dismissed through its own close control. Unrelated tutorials, payment dialogs and hidden dialogs are not selected.

This version has one marketplace session per app, not simultaneous multi-account containers. Changing the Resell workspace or saved login clears that marketplace cookie session before preparing. Automatic filling compares a saved public username with the creator's account and waits on a mismatch. Email logins establish the configured native session first; no public username is inferred from an email address. The account is checked again throughout filling. Passwords are not available to website or desktop settings in this release.

## Android build

The current generated Android project belongs to the main application identifier **md.maison.reseller**, preserving its upgrade data. The earlier sandbox project is retained under the ignored .native-tools/android-sandbox-project directory. Never initialize sandbox configuration over the main generated project; use a separate checkout for sandbox native builds.

```powershell
npm ci
. ./scripts/android-env.ps1
npm run android:init
npm run android:windows
# Standard configured Android environments:
npm run android:dev
npm run android:build -- --apk --debug --target aarch64
```

Set VITE_API_BASE_URL to the HTTPS deployment before native compilation. The server must allow the exact Tauri WebView origins using ALLOWED_ORIGINS. The production Resell deployment is configured for http://tauri.localhost, https://tauri.localhost and tauri://localhost. Arbitrary cross-origin fetch is not exposed.

Native prebuilds copy tracked Android sources, credential-backup exclusions and trusted bundled scripts into the generated project on Windows, macOS and Linux. The Windows helper handles only Tauri's specific symbolic-link packaging denial with an ordinary library copy; it does not change OS security settings.

Installed tools on this Windows machine: C++ Build Tools 2022, Rust 1.99.1, Microsoft OpenJDK 21.0.13, SDK platforms 36/37, build tools 36/37, NDK 27.2.12479018 and ARM64 Rust Android target. The ARM64 debug APK is src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk. It is a development build, not a Play Store release.

## Browser fixture and checks

```powershell
npm run dev
npm run typecheck
npm run build
npm run build:offer-sandbox
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml --features offer-sandbox
```

The isolated browser fixture is http://localhost:1420/offer-sandbox.html. It models the inspected creator controls and cannot publish. A passing fixture does not prove real marketplace acceptance.

## Observed verification

### Mobile interface refinement — 13 November 2026

The inventory header keeps Paste and Search on the logo row. Paste starts expanded; choosing Search swaps the expanded control. A translucent graphite surface separates navigation from photography. Drafts use full-bleed covers and a hold/menu action sheet for editing, preview and confirmed deletion. The editor combines Offers, Details, Photos, Review and Delete in one toolbar.

Phone specifications use searchable custom pickers, including existing inventory values and an Other option. New drafts start with 100% battery health; existing drafts retain their values. Hold a photo to reorder it, or use Alt + arrow keys. Android provides system haptic feedback. Background sync retains unchanged photo/blob references so autosaves and cloud reads do not reload thumbnail URLs.

Android preparation requires an encrypted device-local 999.md connection. A bounded page observer inspects consent, setup-guide, creator, sign-in, continuation and challenge state before using the corresponding known action. A native route watcher also handles delayed sign-in navigation. Challenges remain manual, and preparation never clicks Publish. The device connection implementation remains Android-only.

Validation: 101 automated tests, TypeScript, production web build, two host Rust safety tests and the ARM64 Android build passed. Browser checks covered the mobile header at 320/393 pixels, desktop header bounds at 1440 pixels, draft hold actions and preview, editor toolbar, model picker and keyboard photo reordering. Direct finger drag feel and haptic strength require physical interaction; these checks do not establish a frame-rate guarantee.

The redesigned build was installed successfully over the existing main Android app at 10:28 on 13 November. Phone screenshots verified the Paste/Search swap, preserved inventory and ten-photo draft, full-bleed draft covers, compact editor toolbar and redesigned connection sheet. Preparing the complete draft with no saved connection opened the required Connect & continue sheet and did not navigate to the creator. A browser check confirmed an existing photo's object URL stayed unchanged when reordered. The production deployment `dpl_43dABwcyGF3dGjavaCgXxc9VBp8f` reached READY at https://resell-workspace.vercel.app; its public page loaded successfully. No advert was published in this refinement pass. Evidence: resell-mobile-command-bar.png, resell-offers-refined.png and resell-required-marketplace-connection.png.

On 12–13 November 2026, on a Xiaomi M2003J15SC running Android 12 / WebView 156.0.8078.47:

- The isolated Android app transferred ten distinct numbered photographs to the real creator. The report showed **100%** and **10 photos accepted**. The official gallery showed 01–10 in order, with 01 as cover. Evidence: resell-android-ten-photos-ready.png and resell-android-ten-photo-order.png.
- Earlier real two-photo tests verified both titles, Romanian/Russian description and paragraphs, Apple / iPhone 15 Pro, used condition, private seller, iOS, 256 GB, 8 GB RAM, separate 94% battery health and 3274 mAh capacity, Chișinău and MDL, USD and EUR through actual native transfers. No advert was published.
- The main Resell app was built and installed over the existing identifier. Inventory, account session and saved draft/photo data survived updates. Its new Offers editor and photo review were checked on the phone.
- The main account's ten-photo test draft synced automatically: one cloud draft, ten metadata references and ten actual private storage objects. Database tests verified owner isolation, denial for other/guest accounts, private photo paths and stale-revision rejection inside a rolled-back transaction.
- Automatic cookie acceptance worked on the real official page. The corrected asynchronous sign-in sequence submitted both fields; the first saved credentials were rejected by Simpals. Saved sign-in succeeded after saving the supplied credentials, but did not complete reliably after subsequent app updates. The final transfer run therefore used authorized manual Simpals sign-in and the official Continue button. Automatic sign-in persistence/continuation remains a separate unresolved issue; no password or token was inspected or placed in cloud storage.
- The website was deployed to https://resell-workspace.vercel.app. Production APIs now return the correct native origin headers and deny an unapproved origin. A supplied public advert imported successfully in about 1.4 seconds in one smoke run; this is an observation, not an instant-import guarantee. Current bank selling rates were returned successfully.
- All 97 automated tests, TypeScript, web production build and both host Rust safety tests passed. Initial JavaScript was 98.43 KB gzip; offer editing and cloud code load separately. Small-phone layout was checked at 320 × 740; larger breakpoint checks are recorded when completed.

Remaining verification: simultaneous marketplace-account containers, interrupted large-photo uploads, expired handoffs, switching accounts during filling, physical frame-rate/CLS measurements and ten full-size camera-photo performance. The ten-photo fixture proves count, identity and ordering, not a network-speed guarantee. If Android kills the process during external Google sign-in, reopen the saved draft and prepare again; the pending handoff is memory-only. Direct Simpals credentials avoid that app switch.

## Main-app acceptance completed — 13 November 2026

### Automatic preparation acceptance — 13 November 2026

The final Android build was installed through the normal APK installer after MIUI repeatedly rejected USB installation. Its installed APK SHA-256 matched the built APK exactly. The Resell session, marketplace connection, inventory and ten-photo draft survived the updates. A temporary USB-loopback APK download server was stopped and its port mapping removed after installation.

The saved-credentials run reached the official Simpals confirmation page automatically using the slower sign-in sequence. Subsequent corrected runs automatically pressed the link-wrapped Continue action and started filling the matching @arturgarstea creator without an extra Fill tap. The final run passed the corrected price editor, dismissed the recognized tutorial and finished with **100% Completat**, **10 photos accepted**, **Ready for your review**, and no missing supplied fields. The test used the existing Romanian/Russian titles, original three-paragraph description, 13000 MDL, Apple / iPhone 15 Pro, used/private seller, iOS, Chișinău, 256 GB, 8 GB RAM, 94% battery health and 3274 mAh. No Publish or promotion action was performed. The unpublished completed form was left open for review. Evidence: resell-automatic-preparation.png.

All 106 automated tests, TypeScript, production web build and the ARM64 Android build passed. The two host Rust origin-safety checks also passed during this change. The earlier notes about unreliable sign-in/continuation describe the previous builds; this section records the corrected automatic flow. CAPTCHA/OTP handling and simultaneous marketplace-account containers remain manual/unimplemented respectively,.

The corrected main Android build was installed successfully with the existing package identifier, then its saved ten-photo draft was prepared on the real 999.md creator. The new cookie banner dismissed automatically. The first-step Intro.js guide closed through its own skip control; device type was selected automatically. Inspection identified that the offer-type modal has no data-testid/id, unlike the device/specification pickers, so it now uses its exact inspected heading instead of the first generic dialog.

The final run reached **100% Completat** and **10 photos accepted**, with a ready report and no missing supplied fields. Direct visual checks confirmed Vând, Smartphone-uri, Chișinău, 13000 MDL, Apple, iPhone 15 Pro, private seller, used condition, iOS, 3274 mAh, 94% battery health, 256 GB and 8 GB RAM. Both Romanian/Russian titles and the complete three-paragraph original Unicode description matched the saved fixture. The official gallery showed all ten distinct numbered photos, 01–10 in order, with 01 marked Principala. No Publish, paid-placement or account-settings action was performed. The unpublished form was left at its gallery for review.

Evidence: resell-main-ten-photos-ready.png, resell-main-ten-photo-order.png, resell-main-description.png, resell-main-specifications.png and resell-main-battery-memory.png. The final test suite has 97 passing tests, including mixed cookie banners, delayed hydration, guide dismissal, cancellation and untagged offer-type picker isolation. TypeScript and Android builds passed. Automatic saved-login reliability after updates remains unverified/unfinished; this successful transfer used manual sign-in.


## Sequential accounts — 1.6.20

Manage device-encrypted 999.md credentials from Account → Marketplace accounts.
When preparing a valid draft, select the desired accounts in the chooser. Resell
fills the first account's creator; inspect it and press Publish yourself. A
verified public/awaiting-moderation creation returns to Resell, records that
account's result and prepares the next selected account. After the last account
it returns to the draft's Review screen. Keep Resell in the foreground.

Payment, validation failures, an unknown response or returning manually pause
the queue. Review the marketplace before resuming an uncertain creation to avoid
duplicate adverts. Stopping the queue keeps a local recovery copy of its receipts.
Credentials never enter this queue, cloud sync or exports. A killed process has
no trusted native receipt and therefore pauses instead of silently repeating.
The real post-publication return remains unverified because no advert was
published in development; the two-account test used isolated fixture receipts.
