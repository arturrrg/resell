# Resell

See [project structure and cleanup](docs/PROJECT_STRUCTURE.md) for the directory map and housekeeping commands.

Production: https://resell-workspace.vercel.app

A private local-first workspace for electronics resellers. Create offers, reuse phone templates and monitor published 999.md adverts in a photograph-focused inventory. React, TypeScript, Vite, Vercel functions and Rust/Tauri 2. No marketplace API credentials are needed. A separate Offers workspace creates unpublished phone drafts. Supabase account inventories sync automatically; existing guest inventories stay recoverable during account setup.

## Offers, templates and monitored inventory

Inventory shows verified publications prepared through Resell. In Account, **Include other 999.md offers** also monitors public adverts created outside Resell from accounts connected on this device. This optional setting belongs to this device; saved monitored records still sync privately. Updates run every five minutes while the app is visible, and on foreground/reconnect after a one-minute cooldown. Updates retain saved details on failure and never interpret a missing advert as a sale. Previously imported records remain in local/cloud storage and backups; the new collection does not delete them.

Connect marketplace accounts in Account → Marketplace accounts. Android saves credentials with Keystore encryption. After official sign-in, the authenticated cabinet link supplies the real public username, including for email logins. This verified identity is saved automatically; its public avatar is fetched from 999.md's known CDN. Default or unavailable avatars use initials. Passwords never enter Supabase, offer exports or public profile requests. Existing email connections can use **Sign in to verify profile** once.

The stacked-layers button in Offers opens Templates. The plus beside its title creates a template; tap a saved template to create an independent offer with its specifications and text. Templates never contain photos; add fresh photos to each offer. Existing template photographs are removed during the local schema upgrade and cloud sync, while the original offers keep their photos. The template's actions menu contains Edit, Duplicate and Delete; Back from editing returns to the library. Create multiple named templates for the same phone, or use an offer's actions menu to **Save as template**. Offer actions also contain Sold and Delete. The empty Inventory screen's **Create an offer** button opens a new draft directly. Only the user presses Publish on 999.md.

## Run the website

For iPhone setup, native feature coverage, signing, and installation steps, see
[docs/IOS.md](docs/IOS.md). iOS builds require macOS and Xcode.

Requires Node.js 22.12+ (tested with Node.js 26 on Windows).

```powershell
npm ci
npm run dev
```

Open http://localhost:1420. `start.bat` starts the same development environment. Vite serves the screen and proxies the shared TypeScript importer on port 4175. Internet access is required to update marketplace offers. Existing records can be used without contacting 999.md.

```powershell
npm run typecheck
npm run build
```

The production build is in `web/dist`. `npm run preview` serves that build for visual checks; it does not run server functions. Use `npm run dev` for local marketplace updates.

## Deploy on Vercel

Import this repository into your own Vercel account with the repository root as the project root. Existing `vercel.json` selects `npm run build`, `web/dist`, and the `/api/import-999` function. No marketplace API key is needed. Keep the existing hostname when upgrading to preserve browser inventory; otherwise export a backup from the old hostname first.

Marketplace monitoring uses the same-origin /api/profile-offers endpoint. The retained /api/import-999 endpoint enriches monitored cards with specifications and descriptions; there is no paste-link import field. For native builds, set `VITE_API_BASE_URL=https://your-project.vercel.app` before building. Set the deployed function's `ALLOWED_ORIGINS` to the comma-separated origins used by your native WebViews, for example `http://tauri.localhost,https://tauri.localhost,tauri://localhost`. A configured endpoint must use HTTPS.

## Automatic private Supabase storage

The supplied project is linked through the Supabase CLI. Production uses VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Only these browser-safe values belong in frontend configuration. A database password, secret key or service-role key must never appear in a VITE_ variable. Local .env.local is excluded from Git and deployment uploads. VITE_PUBLIC_APP_URL sets the public origin for links copied from a local or native installation.

Accounts use email verification followed by password creation, preserving the exact existing guest identity. Sign-in, sign-out and password recovery are available in the account controls. Account inventory is isolated by row-level database policies and separate local databases. Legacy guest inventories can still be opened on the same browser or connected with a private recovery link. Permanent accounts use sign-in across devices; legacy links cannot open permanent account inventories.

Public email verification and password reset require a custom SMTP sender in Supabase Authentication settings. The default sender only serves project-team addresses. No SMTP credentials were supplied, so public email delivery is not verified. Keep email confirmations enabled. Configure a sender, then exercise verification, password creation, password login on a second device and recovery with real inboxes before considering signup fully operational. The account-linking setting and database migrations have been applied to the supplied project.

Swipe an offer right to record a sale and its net profit in MDL; swipe left to request deletion. Short swipes return to rest. Sold offers leave the draft list and remain in Sales, where Undo restores the original offer and its photos. Templates, sale history and recorded profit save locally and sync privately with the account. Filters support device specifications, seller, location, currencies, media, asking price and price/date sorting. Active filters outline the trigger without adding a badge.

The current local inventory is copied into its own automatic workspace on first connection; original device IDs, timestamps, photos, corrections and records are retained. Existing permanent sessions from older versions remain usable. New changes save locally first, then upload automatically. Every committed local change triggers an automatic sync after a short debounce; other tabs are notified too. Focus, reconnect and a 15-second foreground timer pick up changes from connected devices. There is no manual Sync button. A listing's canonical identity is unique within its workspace. Deletion tombstones prevent unchanged offline copies from resurrecting cards. Concurrent local edits during requests remain pending; writes from different connected devices use the last server-accepted change, retaining ten previous server versions and three bounded local recovery snapshots.

Whole device records are stored, including descriptions, characteristics, corrections, prices, photo/video links and embedded local photo data. External marketplace and Vimeo media remain hosted by their source services; URL references do not constitute archived video files. There is no arbitrary media-download proxy.

Migrations in supabase/migrations create the record, history, workspace membership and hashed-link tables. New guest sessions can only access their own inventory or a workspace explicitly granted by a valid private link. Membership and link tables cannot be queried or modified directly through the public client. Guest session creation uses Supabase's normal rate limits. The configuration enables automatic guest sessions without changing other undeclared project settings.

The optional `node tests/live-workspaces.mjs` check exercises guest sessions, full-record round trips, linked-device updates, recovery, outsider isolation, and invalid links. It creates tagged disposable fixtures and writes `tests/.live-workspace-cleanup.sql`; remove those fixtures afterwards with the linked Supabase CLI using `db query --remote --file tests/.live-workspace-cleanup.sql --yes`. The check never uses the owner's real application session or inventory.

## Inventory and recovery

IndexedDB retains devices across refreshes and restarts. The existing internal database and native app identifier are retained for upgrade compatibility. Schema version 2 snapshots legacy devices and offers before migration and retains their IDs, timestamps, photos and unused fields. Legacy asking prices become My price; public asking prices stay unknown until refreshed. Source availability remains distinct from inventory availability.

Refresh replaces source facts, price, description and photos. Legacy corrections, private prices and inventory availability remain preserved internally. The visible card shows its identity, public price, media and original description.

The visible interface has one custom filter sheet for phone characteristics, sale state, price, media and sorting. The preferences menu, private price and availability controls have been removed. Backup and recovery utilities remain in the storage layer for compatibility. Exports include devices, corrections, embedded local images and legacy offers. Remote photographs remain URLs and require their source host. Restore validates the backup and replaces records in one transaction; the previous inventory remains available through the storage recovery utility. Maison and VEYRA v1 backups remain accepted by the storage utilities. Legacy Maison remote tables are not touched. New Resell cloud sync uses separate, private tables. Export remote-only legacy records from the old application before upgrading.

## Importer behavior

The endpoint only accepts HTTPS 999.md numeric advert paths and validates redirects. It enforces a 12-second fetch deadline and 4 MB response limit. It reads public HTML/JSON without executing marketplace scripts. CAPTCHA, authorization and rate-limit failures are reported rather than bypassed. Five-minute source caching (up to 100 adverts) and request throttling (20 requests per minute per client per server instance) limit repeated requests. These in-memory limits are per function instance; configure Vercel Firewall limits for deployment-wide enforcement if required.

The parser recognizes Romanian and Russian labels, prefers visible descriptions, excludes the marketplace's hidden measurement copy and keeps legitimate repeated calls to action. Battery health and mAh capacity are separate. Missing fields remain empty. Gallery images are deduplicated, loaded lazily and initially use thumbnails when the source URL supports them. Original images load on carousel interaction. Successful cacheable images use a bounded browser cache.

## Native builds

Install Rust and Tauri 2's platform prerequisites. On Windows, install the C++ build tools and WebView2, then run `npm run desktop:dev` or `npm run desktop:build`.

For Android, install Android Studio, SDK, NDK and Java; set `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME`; run `npm run android:init`, then `npm run android:dev` or `npm run android:build`. On this configured Windows machine, `. ./scripts/android-env.ps1` and `npm run android:windows` build the ARM64 debug APK with an ordinary-copy fallback for Windows symbolic-link restrictions. Native builds automatically install the tracked Android activity, marketplace plugin, credential-backup exclusions and bundled scripts into the generated project.

For iOS, use macOS with Xcode, the iOS SDK, Rust and CocoaPods; run `npm run ios:init`, then `npm run ios:dev` or `npm run ios:build`. Distribution requires your own signing credentials. Native source links use the official Tauri opener plugin. Generated Resell icons are included for desktop, Android and iOS.

Offer creation is integrated into the main **Offers** workspace. Drafts and selected photographs save locally, then sync privately for signed-in accounts using the `resell_offer_drafts` table and private `resell-offer-photos` bucket. Deploy `supabase/migrations/20261112213000_private_offer_drafts.sql` before enabling this workspace against a new Supabase project. Public read-only inventory links cannot read offer drafts or their photos. Android **Prepare on 999.md** opens the official creator, confirms the destination account, and fills the draft without publishing. Website users receive text-copy, ordered-photo ZIP and draft-export tools. See [offer creation, native tests and iPhone requirements](docs/OFFER_SANDBOX.md). The generated Android project now belongs to the main `md.maison.reseller` application; the earlier sandbox project is retained separately under the ignored `.native-tools` folder.

## Verification

TypeScript checks, the production build and all 97 automated tests pass as of 13 November 2026, including loading compiled server entrypoints in plain Node ESM. Earlier browser verification used the supplied public advert https://999.md/ro/88610685: import, 6 unique photographs, price extraction, refresh, nonduplicated description, carousel controls, private price and availability persistence after reload. The responsive layout was inspected at 390 × 844.

The main production JavaScript is approximately 103.14 KB gzip. Supabase is loaded separately (59.58 KB gzip); the Vimeo helper adds about 8 KB gzip on video-bearing cards. These are separate chunks, not a total authenticated startup download of 102 KB. The [navigation and performance audit](docs/PERFORMANCE.md) records the 100/500-record search comparison, responsive UI checks and remaining measurement limits. Rust is installed and the two native origin/destination safety tests pass. A separate ARM64 Android offer sandbox was built, installed on a Xiaomi running Android 12, and tested on the real 999.md creator without publishing. The main Android app was also built and installed with preserved inventory, account session and cloud-synced ten-photo draft. iOS, physical carousel frame rates and real-photo CLS targets remain unverified. Marketplace markup and public access can change; the live advert is retained as a regression fixture.

## Current interface

Resell always opens in dark mode. Paste starts importing automatically; Enter is available as an alternative. Routine progress/success text and device counts are hidden. Errors remain visible and dismissible. The input shows a small cancellable activity indicator while an import is running.

One custom filter sheet contains phone characteristics, sale state, price, media and sorting. The media gallery loops in both directions using arrows, horizontal trackpad movement, swipes or keyboard arrows. Select a photo or video to open the glass viewer; Escape, its close control or the backdrop closes it. Descriptions remain visible in a bounded scrollable region without an expander.

Public Vimeo, YouTube and directly accessible marketplace MP4/WebM/MOV links are recognized. Video connections and up to three public Vimeo/direct clips are warmed before selection on each of at most two nearby cards. Muted playback buffers the first frame, then pauses; the same players are reused when opening or switching videos. This bounds background work for large inventories. Opening the viewer starts playback muted. Vimeo and direct videos have custom glass controls for play/pause, seeking, mute, replay and fullscreen (with an expanded in-app fallback). YouTube retains its host player. Vimeo's supported embed settings are requested subject to the video owner's account and embedding permissions. A blurred poster and spinner remain until playback starts at the video's actual dimensions, so a cropped landscape thumbnail never shrinks into a portrait video. The replay screen uses the same soft backdrop. Video playback depends on the host continuing to permit embedding; no restricted video content is fetched or bypassed. The supplied advert 80735381 was verified with eight photos and three Vimeo videos, including actual playback and looping from 11/11 to 1/11.

### Layout and media refinements

The compact search shares the mobile logo row. Inputs indicate focus on their rounded outer surfaces. Header and card spacing were checked at a 1920 × 1080 content viewport: the current two-card inventory had no document overflow. Larger inventories still scroll normally.

The enlarged viewer keeps a fixed viewport-dependent frame while navigating. Photos are contained fully with soft blurred background fill; transitions are clipped inside rounded corners. Neighboring photos are prefetched and decoded before navigation; the previous photo remains during a short slide/fade transition. The image cache is bounded and reduced-motion preferences disable transitions. Vimeo’s helper is loaded separately when a nearby video-bearing card is prepared. Instant playback cannot be guaranteed on a cold connection, slow network or unavailable host.

### Currency estimates and characteristics

MDL prices show approximate EUR and USD equivalents using maib’s published branch cash selling rates (vânzare), before fees. Rates are checked on startup, on returning to the app and every five minutes while visible. The server fetches the public bank page and caches it for five minutes. The tooltip states the bank, rate type, effective date, last check and numeric rates used. Old reference-feed browser caches are discarded. Invalid or more-than-48-hour-old bank dates are rejected. Still-valid cached rates may be reused on temporary network failures, explicitly marked as last available. No marketplace or currency API key is required. The development server and Vercel both expose GET `/api/exchange-rates`.

New imports and listing refreshes retain every public characteristics label/value, including fields outside the normalized device schema. Cards display original Romanian/Russian labels and values in a compact scrollable table. Existing cards show known fields until refreshed. These characteristics persist through reloads and backup/restore.

Characteristics display three rows in each of two columns (six visible fields), with scrolling for additional fields. Wider desktop cards accommodate the table, with long labels/values available through their tooltips. All extracted fields remain available through scrolling.

The fixed viewer is at most 1120 px wide with a 720 px media area, shrinking only to fit the viewport. Navigating between portrait/landscape images or videos does not move its navigation controls. Compact 16:9 card previews fill the frame with cover cropping; the enlarged viewer contains the complete photograph with soft background fill.

Automatic refresh updates one card at a time. Card footers contain the source/seller links and deletion control. Unchanged cards retain their object references, image state and carousel positions. Deletion uses a custom accessible dialog with Cancel as its initial focus. Seller names and validated 999.md profile links appear beside the advert link; refresh existing records to backfill missing names.

Production verification on 11 November 2026: public homepage, live importer (80735381: 8 photos, 3 videos, asking price and seller), bank rates, browser import/save and persistence after reload all passed. Supabase CLI login, project linking, schema migration and confirmation redirects were applied. Live SQL checks proved account isolation, anonymous denial, recovery versions and tombstones, with all fixtures rolled back. Automatic guest sessions and private-link synchronization were subsequently verified against the live Supabase API with disposable fixtures; no app sign-in is required.

## Automatic source refresh and the Resell domain

Source-linked cards are refreshed automatically when their last successful check is at least 15 minutes old. Legacy cards without a check timestamp are eligible immediately. The queue runs while the app is open, visible and online, gives visible cards priority, and pauses while a modal viewer is open, an offer is being edited, or media is being swiped. Requests are sequential and separated by at least five seconds; a shared IndexedDB lease prevents duplicate work across tabs. Large inventories rotate through this queue rather than requesting every listing at once. Each automatic request bypasses the importer’s five-minute listing cache.

A successful refresh updates current public facts, asking price, media and source text, retains explicit corrections and private inventory fields, then syncs automatically. Unchanged media arrays retain their references so galleries and preloaded players are preserved. Failures keep the last good details and show a small per-card retry icon only when needed; they never advance the successful-check timestamp. Transient retries back off from one to five minutes. Marketplace restrictions retain five-minute to one-hour cooldowns; removed listings retry after an hour. A due failed-attempt retry takes precedence over the normal 15-minute successful-check interval. Marketplace rate limits and browser challenges pause the queue. Refreshes finishing after deletion cannot recreate a card.

The Vercel project is resell-inventory and its public production domain is https://resell-workspace.vercel.app. The old Maison address remains available for existing browser data. Private links copied there now open the same cloud inventory on the new domain; browser sessions themselves do not transfer between origins. Connect using that private link when moving an existing inventory, rather than assuming a fresh browser/domain belongs to the same workspace. Both addresses are attached to the same project and follow production deployments.

Source refresh status uses a footer spinner while checking and a retry icon on failure. Healthy cards have neither. The saved error, failed-attempt time, last successful check and next retry are available in its custom details sheet. The last failure and its time are retained after recovery. Transport errors now retain a sanitized underlying connection code in the response and server log; historical generic fetch errors cannot identify their original DNS/TLS/reset cause.

## Read-only viewing and sales history

Share inventory creates a random 128-bit viewing code and a QR for the same fragment-only URL. The sign-up screen's View shared inventory accepts a code or link, without sign-in. Scanning the QR with a phone camera opens the viewing page. The server returns an explicit whitelist of public card fields; expected/recorded profit, notes, corrections metadata, owner IDs and sold records are excluded. A viewing code grants no database membership or write access. The owner can revoke it with Stop sharing; open viewers recheck every 15 seconds and clear their cards if access is revoked. Screenshots or information already viewed cannot be recalled. Original guest recovery links remain legacy editing credentials and are no longer presented as viewing links.

Mark as sold preserves the device, sold timestamp and profit snapshot in the private inventory record, with a five-second undo window before hiding it from the active grid. No background deletion is required; reopening the app derives archived state from the saved timestamp. The Sales & profit control displays entered profit totals, monthly bars and a recoverable sales history. Return to inventory clears the sale snapshot; expected profit stays available. These records sync and are included in backups. Totals reflect user-entered profit in MDL, not independently calculated accounting profit. A missing amount is labeled unrecorded.

Sharing creation now requires a verified permanent account at both the interface and database layers. Guest share codes cannot be viewed, and new legacy guest editing links can no longer be created. Existing guest records stay saved for conversion during sign-up. The guest workspace bypass has been removed; viewing codes remain available without sign-in. Public sign-up still requires the SMTP setup described above. Profit is edited inline beside sale status in each card footer; the header remains available while scrolling with a reduced-motion-compatible floating treatment.

Existing guest inventories with saved records resume automatically on their original browser during the account rollout. There is no Continue my workspace button. Guest inventories cannot create sharing links; new users can sign up or open a read-only viewing code. Signed-in accounts remain separate and private.

### Optional email codes (not enabled)

The working production signup flow still uses Supabase's default email confirmation link. Supabase's hosted configuration API rejected code-only template customization for this project's free/default email provider. No SMTP sender was supplied, and the user chose to retain the existing provider. The optional code-entry component, helpers and verification email template are prepared in source for a future supported sender; they are not wired into production signup. The example template configuration under supabase/templates is intentionally separate from the active config.toml. Do not enable the code-entry screen until the hosted email body contains the OTP token and a real inbox test succeeds.

## Import and QR latency (12 November 2026)

The importer now parses and scopes the advert DOM once and reuses its seller, description and characteristic data. It shares simultaneous in-flight requests for the same advert, keeps the existing five-minute successful-result cache, and preserves refresh cache bypass, throttling, redirect validation and the 12-second/4-MB limits. The first photo starts loading while the completed listing commits locally. Function execution is configured for Frankfurt (fra1), nearer to the Moldovan marketplace than the former iad1 region.

Environment: Windows, Node.js 26.7.0, the same local fixture benchmark before/after, four sequential parses per fixture. For the 538,851-byte listing, baseline parse times were 772.6/398.0/361.9/397.6 ms, versus 356.6/114.7/108.2/98.3 ms after sharing the DOM. For the 549,475-byte video listing, baseline times were 439.0/393.1/399.5/427.6 ms, versus 160.9/69.8/117.0/102.4 ms afterwards. These are parsing measurements, not complete browser import times. The initial pre-change production API probe returned the supplied 88610685 advert in 2,218 ms fresh and 282 ms from a warm cache. Network conditions and cold starts vary; no instant first-fetch guarantee is possible.

QR assets are held in a workspace/origin-scoped, bounded in-memory cache for 60 seconds. The QR module and an already-existing viewing code preload in the background through a read-only verified-owner RPC, without creating a share. Opening an unexpired prepared QR uses the rendered asset immediately; first-ever sharing still requires the server to issue its code. Stop sharing invalidates cached and in-flight QR results. The live lookup's permissions and stable/read-only definition were inspected without executing a production share-creation test; the latter was rejected by automatic approval review. Isolated tests cover QR reuse, revocation races, workspace isolation and retry.

Post-deployment production verification: deployment dpl_34yXGVJkh41jZnoBBrHQrb9D1gKh was READY; both API functions were confirmed in fra1. The same public 88610685 listing returned HTTP 200 with fresh requests taking 1,713 ms immediately after deployment, then 1,279 ms and 496 ms on subsequent uncached refreshes. A successful-result cache hit took 240 ms. These are small-sample API timings measured from the Windows host, excluding browser image transfer/rendering; they are not a guarantee of total card display latency. All 65 automated tests, TypeScript checks and the production build passed. Initial application JavaScript is 95.55 KB gzip; the QR module remains a separate 10.14 KB gzip chunk. A read-only database inspection confirmed resell_existing_view_code is stable, security-definer, has no INSERT, requires a permanent account, denies anonymous execution and permits authenticated execution.

## Local Android performance release

On Windows with the installed Android/Java/Rust tools, run `npm run android:release:windows`. This builds optimized Rust and an R8-shrunk, non-debuggable arm64 release APK at `src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release.apk`. For local upgrades it uses the existing development certificate, preserving the app identity and data. Configure a protected release/upload key before store distribution. Keep device mirroring off during frame measurements; [docs/PERFORMANCE.md](docs/PERFORMANCE.md) records the workload and results.
