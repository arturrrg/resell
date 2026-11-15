# Navigation and control audit — 14 November 2026

## Resell 1.6.27 — photo-free templates and direct creation

Type checks, 171 automated tests and optimized web/Android release builds passed.
The connected Android 12 phone received 1.6.26 for system-bar and Sales checks,
then the final 1.6.27 update with the direct editor handoff and menu-origin fix.
Android status/navigation bars now expose the same #0b0b0d surface as the app,
without Material background tint or contrast scrims. Confirmed visually on phone.
Sales is an ordinary heading inside its own scroll pane; it scrolls away rather
than floating over the profit cards. Browser geometry moved from top 0 to -258
after scrolling; verified the same behaviour on the phone.

Templates omit photos in creation, reuse, storage and upload serialization.
Schema 3 atomically strips photos from legacy templates and marks them dirty for
sync; original offer photos and cloud revisions remain intact. Legacy cloud
template photos are not downloaded and are removed by the next confirmed sync.
Regression tests cover creation, duplication/reuse, writes, cloud acceptance and
the schema upgrade. Template cards now create an independent photo-free offer;
their menu contains Edit, Duplicate and Delete. Header Add measures 44 x 44 px.

Inventory and empty Offers use the same CreateOfferButton component. Inventory
passes a pre-created draft in the navigation commit; the editor adopts it before
paint. A 393 x 852 fixture recorded 32 mutation/frame samples after the tap with
zero samples showing Offers without its editor. No intermediate list flash.

Template menus explicitly record whether they opened from the library, editor
or Offers list. Outside dismissal from the editor leaves zero open dialogs and
retains the editor. Cancelling its duplicate dialog does the same. Returning from
the editor still opens Templates; dismissing a library menu restores the library.
Both origins were exercised in the browser. Nothing was published on 999.md.

Evidence: .native-tools/resell-1626-inventory.png and
.native-tools/resell-1627-template-library-web.png.
Final phone startup evidence: .native-tools/resell-1627-final.png. Installed
versionName 1.6.27 / versionCode 1006027. APK SHA-256:
2C7E64A7D0F8E89A58C742DDFAB253D7EA9B6B5EBED296AC4F1D314B44E10DCF.
Production https://resell-workspace.vercel.app/ returned HTTP 200 after deployment.

## Resell 1.6.25 — popup navigation and template interface

Verified on the same connected Android 12 / WebView 156 phone and isolated
393 × 852 browser fixture on 14 November 2026. Type checks and 169 automated
tests passed; the additional Back test covers duplicate platform signals without
delaying the first navigation action.

The popup failure was reproduced: a native cancel event could be non-cancellable,
close the HTML dialog, and leave React's Account state open. Event logs showed
cancelable=false, followed by close while the Account trigger remained expanded.
This matches the HTML CloseWatcher rules:
https://html.spec.whatwg.org/multipage/interaction.html#close-watcher-infrastructure .
Account and Marketplace now use one native modal with separate content panes.
Cancel events use the same Back stack, do not bubble through portal parents, and
non-cancellable closes reconcile a still-mounted route without replaying its
entry animation. Actual dismissals unmount normally. Eight rapid browser
Marketplace/Back cycles ended with exactly one open Account dialog; a subsequent
Back dismissed Account. Repeated phone system-Back cycles also retained Account.
Inside padding clicks no longer count as backdrop clicks; actual backdrop clicks
still dismiss the popup.

The switch uses an absolute thumb instead of inheriting centered flex-button
alignment. At 393 px, its checked thumb had 3 px right inset and its unchecked
thumb 3 px left inset; the touch target remains 44 × 44 px. Verified on the phone.

Offers menus contain only Sold, Save as template and Delete. Template naming has
a visible heading and left-aligned 16 px input; the library uses cover thumbnails,
explicit Use controls and a header Add button. Its explanatory subtitle is removed.
Editing a template and returning through either the header arrow or system Back
reopens Templates after the local save, instead of exposing the Offers page.
Both routes were exercised in the browser and system Back on the real phone.
The empty Inventory message is centered in the usable region between the bars.

Phone evidence: .native-tools/resell-1625-switch.png,
.native-tools/resell-1625-template-name.png,
.native-tools/resell-1625-template-library.png,
.native-tools/resell-1625-actions.png,
.native-tools/resell-1625-centered-empty.png.

Final 1.6.25 Android release installed successfully. APK SHA-256:
88D03D434740F69FFD50693969A7A49252B3A227D45DA2EEE8BB731201BFF60B.
The temporary template created for the phone test was removed through its
confirmation dialog; both original offer drafts remained intact. No 999.md
advert was published. Final website deployment returned HTTP 200 at
https://resell-workspace.vercel.app/.

## Resell 1.6.24 — monitored offers, templates and verified identities

Verified on 14 November 2026 on the connected Xiaomi M2003J15SC (Android 12), an
optimized ARM64 release, and an isolated 393 × 852 browser fixture on Windows.
Node.js was 26.7.0; the phone used Android System WebView 156.0.8078.47.
The phone mirror remained open for UI observation. These gesture checks establish
correct behavior; they are not a claim of a measured 120 FPS or zero dropped frames.

- Installed version: 1.6.24 / 1006024; installed APK pulled back and SHA-256
  compared with the release: 917ddad49bdb368cffa20b9a81b7ec766fbef54e636b91fb90e11bf802a711e6.
  Release size: 11,866,794 bytes. Existing credentials, original ten-photo test
  draft and prior sale history remained in place.
- TypeScript checks passed; 168 JavaScript tests passed; three Rust origin,
  creator-routing and verified-publication receipt tests passed. The optimized
  production web and R8 Android release builds completed.
- Main JavaScript: 117.16 kB gzip; lazy Offers feature: 15.99 kB gzip. Supabase and
  media integrations load as separate chunks; this is not a total cold-start
  network-size measurement.
- A saved Gmail connection completed official Simpals sign-in automatically.
  Resell read the authenticated cabinet username, saved it in the encrypted
  account record and returned to the app. The profile action changed to Refresh
  profile, proving that the identity survived the return/reload. Its public
  avatar is the all-zero default, correctly represented by initials.
- Account and Marketplace sheets both measured 369 CSS px at a 393 px viewport,
  with one open modal. Metadata requests run off the Android UI thread; avatars
  load independently and are bounded/cached.
- On the real phone, a short draft swipe returned to rest; full right swipe
  opened the centered Sold/profit dialog; full left swipe opened the custom
  deletion confirmation, which was cancelled. A temporary 500 MDL sale appeared
  in Sales and Undo restored the original offer and prior total. The corrected
  menu responded to a fresh tap immediately after a swipe. The profit dialog
  moved above the soft keyboard with its Save action fully visible.
- A ten-photo template was saved and reused as an independent offer on the phone.
  Details and photo ordering remained intact. Twelve rapid Next taps ended on
  image 03 with counter 3/10. Generated verification copies/templates were removed;
  the original draft was retained. No marketplace Publish action was performed.
- In an isolated mocked-return fixture, a valid publication receipt automatically
  created the monitored Inventory card with 1/10 photos and no profit/status/delete
  controls. Actual publication is intentionally not used as a test prerequisite.
- Live public-feed smoke: the saved account returned HTTP 200 with zero active
  adverts. A public shop returned count 468, a 50-advert page and HTTP 200 for its
  first image; the native-origin CORS header was correct. Feed requests have a
  fixed destination, timeout, streamed byte cap, throttling, bounded caching and
  duplicate-ID filtering. Changing/incomplete page sets never establish absence.
- In-process draft saves publish the committed changed record to UI subscribers,
  avoiding two full photo-database reads per edit. Unchanged photo references
  remain stable; obsolete generated object URLs are revoked. Swipe frames use a
  cached threshold and compositor transforms rather than repeated width reads.

Evidence: .native-tools/resell-1623-email-verified.png,
.native-tools/resell-1623-template-reuse.png,
.native-tools/resell-1624-draft-menu.png,
.native-tools/resell-1624-profit-keyboard.png,
.native-tools/resell-1624-account.png.

## Resell 1.6.22 — consistent symbols, profile identity and lighter account transitions

Sales metric separators now use straight one-pixel pseudo-elements instead of
borders on rounded metric cells. In the 393 px fixture every cell had radius=0
and border-right=0; the two separators measured exactly 1 px. All four navigation
symbols use the same SVG shape coordinates in outline and filled states. Offers
keeps its square/pencil silhouette, Sales uses matching hollow/filled bars, and
Account uses a circular person profile symbol. The one-pixel selected-icon
translation is removed.
The Account sync caption was removed; existing error reporting remains.

Marketplace display names use the complete text before @, preserving plus tags,
Unicode and the untouched full credential in the edit field/native vault. Queue
and removal labels use that display nickname too. Native account metadata is
preloaded, coalesced and cached per workspace for 30 seconds, with explicit
refresh after save/removal and immediate cached selection updates. The cache
keeps at most 16 workspace summaries and strips every field except the known
public summary fields; no password enters the frontend cache.

The previous native status command performed Android Keystore/decryption and
preferences reads directly in the command dispatch path. Status work now runs
on a dedicated worker and returns its public summary on the UI thread. Account
is suspended while Marketplace accounts is open, retaining its React state but
closing its native dialog/backdrop. The isolated transition showed exactly one
open dialog and a closed Account dialog, instead of two stacked visible modal
layers. Returning restores Account. Profile pictures load independently without
blocking the popup or changing reserved avatar dimensions.

A read-only public GetAccountByLogin query and the observed 999 image format are
used for custom avatars. Only saved non-email public handles are looked up;
an email prefix is not assumed to identify a public profile. Responses must
match the requested handle; image filenames are limited to the observed 32-hex
or UUID formats on the fixed Simpals image host. The API uses no login cookies,
passwords or arbitrary proxy URL. Network workers are capped at two, redirects
are rejected, response bodies are limited to 32 KB and request/read timeouts
apply. Native/client avatar caches are bounded to 128 entries, with 15-minute
custom-photo and one-minute default/failure lifetimes. Image failure keeps
initials. A matching explicitly saved public handle can also supply the main
Account photo; unrelated marketplace identities never replace it.

Live public profile checks returned HTTP 200: the connected public handle had
the default all-zero avatar, and the existing listing seller's custom avatar
returned an image/jpeg with HTTP 200. That custom photo rendered in the isolated
fixture; the phone's current connected profiles retain initials. Custom-photo
display on this phone requires a linked profile with an actual custom image.
Email-only connections retain initials until their public handle is known.

159 tests, TypeScript, the production web build and optimized Android release
build pass. Icon-pair DOM checks confirmed identical geometry in all four pairs.
The optional marketplace chunk is 4.31 KB gzip; Android's core JS is 112.02 KB
gzip. The final installed 1.6.22 (1006022) APK is 11,823,699 bytes, SHA-256
8aaa6576f588f90e7805f071f81d2dc1151a6ddaa8386c2a66cc51debfae3107;
the pulled installed APK matched. Inventory, sign-in and both linked accounts
were retained. On the phone the email connection displayed its full local-part
nickname, Marketplace accounts showed without the Account dialog underneath,
and Android Back restored Account and then Inventory. Functional phone checks use the connected Xiaomi M2003J15SC,
Android 12 and its desktop mirror; no zero-missed-frame claim is made.
Production deployment is READY (dpl_DqxbNRcEQUA3hg6T4HJc44poYhfw) at
https://resell-workspace.vercel.app . No advert was prepared or published.


## Resell 1.6.21 — Account settings, retained Sales page and Android Back

Account remains a popup, with a profile header, quiet sync state and grouped
workspace settings. The marketplace row reserves its lazy-loading height to
avoid changing the panel's layout while its module arrives. Sales is now the
third retained workspace instead of a modal. Native swipe snapping, direct tab
taps, the bottom selection timeline and Inventory's header timeline all use
three pages. Offers and Sales headings ride the physical native scroll track.
Sales keeps the existing touch/keyboard profit chart and private sales data.

Selecting a saved marketplace account updates just the selected profile state
and commits the preference without setting the whole sheet busy or fetching the
list again. A failed commit rolls back the selection. In the isolated fixture,
selecting another account left Add account enabled with zero disabled/class/style
attribute mutations on that button. Each row now has Edit and Remove controls;
Edit no longer includes removal, and the brand's extra link icon is gone. A
fixture-only deletion removed the intended second account after confirmation.
No real saved account was removed. At 320 × 640 both account rows fit without
horizontal overflow; the brand had no extra icons.

The Android plugin installs a lifecycle-owned Back callback for the current
WebView. Exact local app origins dispatch a single cancelable Back event; remote
999.md/Simpals pages keep normal browser-history Back. At the app root an
unhandled Back backgrounds the activity instead of destroying its state. The
frontend registers handlers only while their surface is open: modals, account
editing, filter menus, photo viewers, expanded video, draft editor, auth subviews
and workspace history. No polling, frame callbacks or large DOM scans are added
for Back handling. Account editing/custom picker subviews have explicit priority
over their containing popup. Native keyboard handling remains with Android.

156 automated JavaScript tests and TypeScript pass. The optimized Android ARM64
build (Rust release + R8) and production web build pass. Android bundled core JS:
112.19 KB gzip; marketplace module 3.15 KB gzip; offer studio 16.83 KB gzip. In the
393 px isolated fixture, the pager measured 1179 px (three pages), Sales showed
no open dialog, and three Inventory → Offers → Sales → Inventory cycles retained
the sampled image node/source with a load count of one. Functional checks are
not a claim of zero missed frames or a measured frame-rate benchmark.

The installed release is 1.6.21 (1006021), 11,769,235 bytes, SHA-256
3a680008769d5ba304b5d578b00a853487979130f420d9135550719421d736c3.
USB installation succeeded and the pulled installed APK matched that hash. The
phone retained its existing inventory, ten-photo draft, sign-in and both saved
marketplace accounts. Actual Android Back returned Edit account → Accounts →
Account → Inventory and dismissed a filter dropdown before the filter panel.
It also closed the photo viewer, returned the saved draft editor to Offers and
returned the full Sales page to its previous Offers tab. The mirror was left
open on Sales for owner review.
Production deployment is READY at https://resell-workspace.vercel.app
(deployment URL resell-inventory-4kufy87xm-arturrrgs-projects.vercel.app).
Nothing was published on 999.md.


## Resell 1.6.20 — shared swipe container and sequential preparation

The Offers toolbar is a retained absolute child of the native horizontal pager,
positioned over its second page. It no longer has a separate scroll-timeline
animation that can be restarted by editor state. Inventory and draft content
remain retained. The account manager has moved from Offers/Review into Account;
its own 3.01 KB gzip lazy chunk includes its styles so it works before opening
Offers. The compact arrow / 999.md / Close header remains.

In the isolated 393 × 852 browser fixture the pager measured 393 px wide and
786 px scroll width (exactly two pages). After opening and closing a draft, the
same toolbar node remained, animation-name was none, and at scrollLeft=157 its
x=258 matched 22+393-157 exactly. On the connected Xiaomi M2003J15SC / Android 12,
the installed release opened Details, Photos and Review of the existing ten-photo draft, returned to Offers,
and completed Offers → Inventory → Offers swipes with the header restored in
its original position. These are functional checks, not a zero-missed-frame or
120 Hz benchmark.

Preparation now persists a local, owner-scoped queue before leaving the app.
Users choose one or more saved accounts; only one browser session is prepared
at a time. Resell never presses Publish. The injected observer listens to the
user's trusted Publish action and reads only the creator's UpsertAd / PublishAd
GraphQL responses. It accepts AD_STATE_PUBLIC or AD_STATE_PRE_MODERATION with a
matching title and advert ID, then returns a job-bound receipt to native Resell.
The native receipt is bound to the owner, draft, account and random request ID.
Draft, payment-required, rejected/error or unknown results do not advance.
Moderation is labelled separately from publication. A cancelled or interrupted
return pauses for review; retry keeps earlier confirmed results. A changed draft
also pauses before the next account. This is a foreground sequence, not an OS
background publishing service.

The isolated UI completed first account → automatic second account (10 photos
on each), cancelled the second, resumed only the second and retained both final
receipts (2/2). Unit tests cover missing intent, payment/draft states, rejection,
GraphQL errors, expired intent, unrelated IDs/titles, stale/wrong-owner receipts,
moderation and duplicate returns. The actual public creator bundles supplied
the mutation/state contracts. No actual Publish was pressed, so end-to-end
success detection after a real publication still needs the owner's first manual
publication; it is not claimed verified by these fixtures.

153 JavaScript tests and 3 native Rust tests pass. TypeScript, production web and
optimized Android ARM64/R8 builds pass. Core JS: 111.36 KB gzip on web (111.40 KB in the Android configuration); lazy offer chunk:
16.80 KB gzip. APK: 11,767,315 bytes, version 1.6.20 (1006020), SHA-256
b8649e7eee571fbdeb4f6beeb3be4922094feaa204662b7ac791900df446abd4.
USB installation succeeded and the pulled installed APK matched that hash.
The existing sign-in, inventory, draft photos and saved marketplace account
survived. Production deployment is READY at https://resell-workspace.vercel.app
(deployment dpl_GFKUvDrQDz9trbq7rCD2VJTaLRjn). No advert was published or prepared
on the real marketplace during this release's checks.


## Resell 1.6.19 — compact account header

The marketplace close control no longer reserves a separate heading row.
Add/Edit account uses an icon-only Back button on the left of the 999.md mark,
with Close on the right. The lower Back to accounts text button is removed.
Back still clears unsaved password input and returns to the saved-account list.
At 393 × 852, all three controls share centerY=403.5625 and height=42 px; at
320 × 640 they remain aligned without overlap or horizontal overflow. The Back
action returned to both existing fixture accounts. TypeScript and optimized
Android/web builds pass; the previous 147 business-logic tests are unchanged.
Core JavaScript is 111.23 KB gzip; the lazy offer chunk is 16.95 KB gzip.

The Android release is 1.6.19 (1006019), 11,753,587 bytes, SHA-256
6258559a12ed2f33a253b89c531117a9a40424f4fa252291040857e9b361d359.
Physical installation of this header-only update is pending. Nothing was
prepared or published on 999.md.

## Resell 1.6.18 — retained card paint, persistent Offers header and accounts

Mobile Inventory keeps the cards near its vertical viewport painted even when
the entire workspace scrolls horizontally offscreen. A pane-rooted observer uses
vertical bounds, independent of horizontal intersection. The selected cards use
content-visibility:visible and retain an image compositor surface; distant cards
keep content-visibility:auto and the existing incremental mounting. The observer
enables only in the mobile workspace and reconnects on breakpoint changes.

The Offers toolbar now remains mounted in its external portal during draft
editing. It is hidden and inert rather than removed, preserving the same
scroll-linked animation/layer on Back. Editor body classes update before paint.
Five editor open/back cycles retained toolbar identity 1 at x=22/y=18; repeated
post-editor 60%/40% pan positions remained x=179/x=258, y=18. Twelve Inventory↔Offers
round trips retained the same image node/source and one load. A follow-up mobile
check with 100 fixture records retained paint for only two of 18 mounted cards.

The repeated small marketplace heading is removed. Android supports up to twenty
saved logins per Resell owner, with add/edit/select/remove controls, confirmation
before removal, and explicit account choice before preparation when several are
saved. Passwords never return through status or enter cloud sync/exports. The
legacy encrypted login migrates atomically into a versioned AES-GCM account
collection backed by Android Keystore; original data remains until the new
encrypted record commits. The existing Android backup exclusions still apply.
Preparation captures an explicit account ID and expected login. The one-job
guard now runs before changing the browser sign-in context. Switching accounts
uses the existing cookie reset/sign-in flow; sessions are serialized, not parallel.

In the isolated browser fixture, selection/add/removal/empty password editing
worked. Required account choice passed account "second" with all ten photographs
to the disabled preparation stub; no marketplace request was made. All 147 tests,
TypeScript, optimized Android and production web builds pass. Core JavaScript is
111.23 KB gzip and the lazy offer chunk is 16.94 KB gzip. Production deployment
is ready at https://resell-workspace.vercel.app.

The Android APK is 1.6.18 (1006018), 11,753,459 bytes, SHA-256
80de0409ee3b057f8f360888722e5cb56dcbd8c8bc82c67a8a8c79a6dcfa86a2.
Installed through Chrome and verified the pulled installed APK exactly matches
the release hash. Opening the native account manager successfully migrated the
existing saved login and showed it selected, without re-entering its password.
Navigation regressions have browser coverage; further physical checks continue
with 1.6.19. No offers were prepared or published on 999.md. Parallel sessions,
batch publishing and reliable background publication are not implemented.

## Resell 1.6.17 — rapid photo controls and immediate editor tabs

Arrow presses previously changed Gallery state on every click, rerendered its
media and restarted a native smooth scroll. The finger path instead used native
movement and committed gallery state after settling. Arrows now use one bounded,
retargetable animation with a 160 ms target duration from the latest press.
Presses accumulate direction without queuing animations; positions wrap through
the existing identical loop pages. Only the counter changes during movement;
Gallery state commits once at the end. Finger swipes keep their native path and
interrupt pending arrow motion. The animation uses a cached width, and cancels
on deactivation, resize and unmount. Reduced motion jumps immediately.

Details/Photos/Review controls now jump instantly; finger swipes still use the
retained native page track and scroll-linked selection pill. Inactive galleries
are positioned on their real selected photo before a panel becomes partially
visible. This removes the initial last-photo clone exposed by swiping into Review
before its active flag changed at the section midpoint.

All 145 tests and TypeScript pass. At 393 × 852, twelve Next taps 32 ms apart
landed on 3/10, fifteen Previous taps landed on 6/10, and an immediate direction
reversal landed on 1/10. Each burst made zero native smooth-scroll requests,
retained all image nodes, and changed only two media attributes at final commit.
Last visible movement finished roughly 167–173 ms after the last tap in these
browser checks. Twelve real popup button activations advanced from 6/10 to 8/10
with all image nodes retained. Instant editor taps reported section positions
0, 1 and 2 immediately. At a held section offset of 1.4, Photos was still active
while the partially visible Review gallery was already positioned at 1/10;
it stayed on 1/10 after Review activated at 1.6. These are functional/browser
timing checks, not a physical-device frame-rate benchmark.

Optimized Android and production web builds pass; core JavaScript is 110.98 KB
gzip. The website is deployed at https://resell-workspace.vercel.app.
The 11,688,851-byte Android release is 1.6.17 (1006017), SHA-256
4d1df33190f4ebb6c551d04e8509d1b7b8d349a3afaa618a9eee0fe33e582f8f.
USB installation was rejected by Android. The same release was then installed
through Chrome as resell.apk after the user handled the download warning.
Android reports 1.6.17 (1006017); the pulled installed APK exactly matches the
release hash. Xiaomi's completed security scan reports no risks.
Physical functional checks on the Xiaomi M2003J15SC counted twelve rapid Next
presses from 1/13 to 13/13, three more across the loop to 3/13, and two Previous
presses back to 1/13. Inventory retained its photo position across Offers visits.
Rapid Details/Photos/Review taps selected the requested section; a Photos→Review
finger swipe opened on 1/10 with all ten draft photos intact. The original draft
fields were preserved. These checks used mirroring, which was closed afterward;
they are not a physical frame-rate benchmark.
No adverts were prepared or published on 999.md.

## Resell 1.6.16 — fixed Offers header layer

The mobile Offers toolbar now renders into a retained portal outside the
horizontal workspace pager, at the same root level as Inventory's fixed bar.
Previously it remained inside the scrolling Offers page while also receiving
the workspace scroll-timeline transform. The header now has one movement source,
with no independent transition, and its transform layer is prepared in advance.
Desktop keeps the toolbar inline; editor navigation is unchanged. The overlay
host follows the active page's inert/accessibility state.

At 393 × 852, six repeated forward/reverse checks at scrollLeft 236 and 157 px
returned identical Offers positions each time: x=179 and 258 px respectively,
y=18 px in both cases. At the Offers endpoint the bar was x=22, y=18, width=349;
its action hit test and sign-in sheet worked. At 1440 × 900, exactly one toolbar
remained inline. All 141 tests, TypeScript, the web production build and optimized
Android release build pass. Core JavaScript is 110.47 KB gzip.

The website at https://resell-workspace.vercel.app is deployed. The Android APK is
1.6.16 (1006016), SHA-256
9fd82396f0895189d58fde38d671452a0cab09f8cbd415de5ad337dc3511a33f.
Installed over USB on 14 November 2026 using an in-place update. Android reports
1.6.16 (1006016), and the pulled installed APK exactly matches the release hash.
The application was not opened during installation. Physical swipe verification
of this version remains pending; browser position checks are not a frame-rate benchmark.
No adverts were prepared or published on 999.md.

## Resell 1.6.15 — retained editor pages and complete device filters

Details, Photos and Review now use a three-page native horizontal scroll/snap
track with separate retained vertical scrollers. A shared CSS scroll timeline
moves the segmented selection pill continuously with the pages. React changes
the selected section only at a visible-page boundary; there is no idle/snap-end
timer. Rapid tab requests interrupt earlier movement, and tapping the current
section can finish a partial pan. Dedicated gallery swipes and held photo ordering
retain their own controls. The main bottom navigation still switches instantly
on taps. Keyboard tabs support Arrow keys/Home/End; reduced-motion requests jump.

Filters now cover brand, model, storage, RAM, OS, device type, color, condition,
health and capacity ranges, location, seller type/name, currency, media, sale status,
asking-price and private-profit ranges. Other saved specifications become filters
automatically. Choices reuse creation presets plus actual inventory values; long
menus are searchable and model choices follow the selected brand. The solid panel
keeps its heading/footer fixed while fields scroll; independent dropdown portals
remain above it and dismiss if their anchor scrolls out of view. Active filters
only outline the trigger. Sold history explicitly includes archived sales while
the default Inventory keeps its existing five-second archive behavior.

The weak field index reads existing Romanian/Russian characteristics and respects
corrections, including an emptied value. Latin accents normalize without merging
Russian й with и. GB/ГБ, color and seller/type aliases match consistently. Battery
percentages never become mAh capacity; ambiguous capacity ranges remain unknown.
Filter catalogs are computed only when the panel is opened. No database schema or
remote data migration is required.

All 141 tests and TypeScript pass. Browser checks at 393 × 852 verified held editor
offsets 236/393 and 629/393 with matching pill translations 53.04 and 141.37 px.
Eighteen rapid tab presses retained all ten photo images (first image identity 2,
one load). Details scrollTop=852 survived tab switches while window.scrollY=0.
Review opened on 1/10. RAM filtering returned the correct even-numbered fixture
records, RAM plus incompatible refresh rate returned no matches, model search
worked, exact health ranges worked, profit filtering selected the expected record,
and Sold history showed all four archived fixture sales. At 320 × 640, fields had
no horizontal overflow and Done stayed visible; dropdown hit testing and desktop
1440 × 900 layout passed. TypeScript, all 141 tests, the production web build and
the optimized Android release build pass. The initial web JavaScript is 110.41 KB
gzip; offer creation remains a separate 16.45 KB gzip chunk.

Installed 1.6.15 (1006015) on the Xiaomi M2003J15SC, Android 12, with WebView
156.0.8078.47. The installed APK exactly matches the 11,688,287-byte release
snapshot (SHA-256 72b99336278b8a76323462d72364ecd6afe4c75ea9e71bedc69f34b3abd5d486).
Physical functional checks covered forward/reverse section swipes, rapid header
tab requests, all ten retained photos and Review opening at 1/10. The expanded
filter panel remained solid, its RAM dropdown overlaid adjacent fields correctly,
and Done stayed fixed while fields scrolled. Existing draft values and inventory
filters were left unchanged. These mirrored checks are functional verification,
not a frame-rate benchmark; mirroring was closed afterward.

The production website at https://resell-workspace.vercel.app serves this version.
Nothing was prepared or published on 999.md during these checks.

## Resell 1.6.14 — opaque filters and independent dropdown overlays

Reproduced the reported defect at 393 × 852: the panel used rgba(34,34,37,.96),
allowing underlying card details to show through, and the mobile options rule
used position:relative, expanding grid rows rather than overlaying the controls.
The panel and menus now have solid backgrounds. Both render through body portals,
outside the animated toolbar's stacking/positioning context. Dropdowns use fixed
positions above the panel; the grid does not change size when a menu opens.

Placement uses the measured trigger and visual viewport, opens upward when needed,
clamps horizontal edges and bounds long-list scrolling. Menus reposition on parent
scroll/resize without per-move React work elsewhere. Outside-click handling includes
the separate menu portal. Selecting another field dismisses the old menu. Keyboard
opening focuses the panel or selected option; Escape closes a menu before its panel.
Pointer-only closure preserves the touch focus behavior from 1.6.12.

All 131 tests and TypeScript pass. Browser checks covered 393 × 852, 320 × 568 and
1440 × 900: solid rgb(34,34,37) panel, independent fixed dropdown, no horizontal
overflow, correct selection without dismissing the panel, and elementFromPoint
confirmed the dropdown above overlapping controls. On the short viewport the
180 px Sort menu opened upward at y=152..332. Escape/Enter/Tab and selecting a
price input were verified. The optimized arm64 APK is 11,683,075 bytes. The web
deployment is READY and serves index-BTyJbuwj.js (106.05 KB gzip). Installed
1.6.14/code 1006014 has no DEBUGGABLE flag and its pulled APK hash matches the
release artifact. On the phone the panel was fully opaque; Brand options covered
neighboring fields without moving them, selecting the existing All brands value
closed only the menu, and the full Sort list remained visible beyond the panel's
bottom edge. Filters closed cleanly without changing the inventory. Mirroring was
then closed. These were functional UI checks, not a frame-rate benchmark; nothing
was opened or published on 999.md.

## Resell 1.6.13 — long draft gestures, instant tab taps and taller bar

Short draft swipes now always animate back to zero offset. The persistent reveal
state and its hidden action buttons have been removed; icons are visual gesture
feedback only. Long gestures retain Edit to the right and Delete confirmation to
the left. The long-press menu remains the accessible alternative for actions.

Programmatic workspace navigation now jumps directly to the destination before
paint. Native finger pans still use the horizontal pager and scroll-linked bars;
the emitted-page guard prevents a finger pan from being restarted by navigation.
The bottom bar retains its width and has 52 px destinations, 22 px icons and 9 px
labels. At 393 × 852 its bounds are 332 × 64 px (previous height 55 px); at 320 px
width it is 264 × 64 px with no horizontal document overflow.

All 128 tests and TypeScript pass. Browser checks verified short left swipe
returns to an identity transform without an action/dialog remaining, a long left
swipe opens custom confirmation, and tab taps immediately set scrollLeft to 393
or zero. Tapping the already-selected tab at a held 40%/60% position also jumps
directly to its endpoint. The optimized release APK is 11,682,459 bytes; installed
1.6.13/code 1006013 has no DEBUGGABLE flag and its pulled hash matches the artifact.
On the phone, short left and right draft swipes returned to rest and tab tapping
changed workspaces with the taller bar visible. All three saved drafts remained.
The website is READY and serves index-DYlFCx8t.js (105.04 KB gzip). Mirroring was
closed after functional checks. No real user draft was deleted or 999.md advert
published; this was not a frame-rate benchmark.

## Resell 1.6.12 — draft deletion and touch intent

Right-to-left draft swipes now reveal a compact red Delete action. A full swipe
opens the existing custom confirmation, as does tapping the revealed action.
Left-to-right Edit and Preview in the long-press menu remain available.

The prior workspace pan suppression covered mouse drags only, while other swipe
guards were scoped to their original component. A compatibility click could
therefore reach a newly positioned control after navigation. A passive document
pointer tracker now distinguishes pans from taps, including native pointercancel
during scrolling, and blocks only that gesture's follow-up mousedown/click.
A fresh pointerdown resets the guard immediately; keyboard/assistive activation
is exempt. No per-move React updates or blocking touchmove listener was added.
The root input-mode attribute changes only when the input mode actually changes.

Mouse hover rules (31) are restricted to hover-capable fine pointers. Dragged
buttons lose stale focus, touch modal closure does not explicitly refocus the old
trigger, and keyboard focus restoration/visible indicators are retained. Text
inputs and selectable descriptions retain their normal editing/selection behavior.

All 128 tests and TypeScript pass. Browser regression verified short swipe reveal,
fresh Delete tap, confirmation cancellation, full swipe confirmation, deletion of
the isolated fixture only, and right swipe Edit without unexpected input focus.
A fresh Photos tap worked immediately; Tab then focused Review with :focus-visible
and keyboard mode active. Ten photo tiles remained mounted. The optimized arm64
release build passes and is 11,682,403 bytes. The website deployment is READY and
serves index-AqJtKog0.js (105.06 KB gzip). Installed 1.6.12/code 1006012 has no
DEBUGGABLE flag; its pulled APK hash matches the release artifact. On the phone,
a left swipe revealed the red Delete action without opening the editor. A fresh
tap opened custom confirmation; Keep draft returned to the list with both saved
drafts intact and no stale focus outline. This is functional gesture verification,
not an unmirrored frame-rate benchmark. No real user draft has been deleted as
part of testing; nothing was opened or published on 999.md.

## Resell 1.6.11 — bars move with the workspace swipe

The owner changed the requested behavior from stationary toolbars to sliding
with the pages. The mobile pager now exposes a named horizontal CSS scroll
timeline. The outgoing Inventory controls translate by minus the pager offset;
the incoming Offers bar translates by viewport width minus that offset. The
bottom selection advances by the same fractional progress between its two tabs.
The browser drives transform animations from scrolling, without per-frame React
updates or JavaScript style writes. The scroll-state logic from 1.6.10 still
updates labels/accessibility when the dominant page changes. Browsers without
scroll-timeline/timeline-scope support retain the stationary-bar fallback.
This follows the platform's documented
[scroll timeline and shared-scope mechanism](https://developer.chrome.com/docs/css-ui/scroll-driven-animations).
The connected Android phone uses WebView 156.0.8078.47.

Browser checks at 393 × 852: at offset 157 px the Inventory controls translated
−157 px, Offers translated +236 px, and the 80 px selection translated 31.9593 px
(157/393 of its travel). At offset 236 px Offers translated +157 px and selection
48.0407 px. At 393 px, Offers aligned at zero translation and selection at 80 px.
Both bars remain visible during partial swipes in either direction; state changes
do not hide the outgoing bar halfway through. TypeScript and production builds
pass. The optimized arm64 APK is 11,681,715 bytes. The web deployment is READY at
the existing Resell address and serves index-P33fJiDB.js (104.32 KB gzip).
Installed version 1.6.11/code 1006011 was verified with no DEBUGGABLE package flag;
the pulled installed APK matches the release artifact hash. Brief mirrored
physical checks covered Inventory→Offers and Offers→Inventory: both bars aligned
with the destination and the Inventory photograph remained displayed on return.
Mirroring was closed afterward. The precise partial-swipe displacement checks
above were browser tests, not a phone frame-rate benchmark; no claim of zero
missed frames is made. No 999.md form was opened or published during these checks.

## Resell 1.6.10 — navigation follows the visible workspace

The owner found that 1.6.9 moved the content smoothly but left both toolbars on
the previous workspace for 1–2 seconds. The pager only published a destination
after scrollend/48 ms idle AND a position within one CSS pixel of the endpoint.
Visible content could therefore arrive before navigation received any update.
That completion gate and timer have been removed. The passive scroll listener
publishes a page change when the destination becomes the dominant visible page
(half the viewport), once per crossing. The same state drives the top controls,
bottom selection, filled icons, and accessibility state. Native touch movement
is unchanged. Navigation-originated state updates do not restart the scroll.

Button-driven smooth scrolling is tracked separately, so intermediate positions
cannot undo a tab-button selection. A new gesture can interrupt that request.
Regression cases cover fractional positions, reversals before either endpoint,
repeated events, invalid widths, button navigation and interrupted animation.
All 125 tests and TypeScript pass.

Browser regression at 393 × 852: with snapping deliberately disabled in the local
test fixture, held positions of 236/393 px and 157/393 px immediately selected
Offers and Inventory respectively. Ten complete forward/reverse test cycles
updated both bars without reaching an endpoint. Inventory image DOM identity
remained 1 and its load count remained 1. The optimized Android release build
passes and is 11,681,843 bytes. The web production build is deployed to the
existing Resell address and serves index-D35y7mfJ.js (104.33 KB gzip). Physical
release verification pending.

## Resell 1.6.9 — stationary controls and touch-path correction

Inventory and Offers now use stationary viewport toolbars on mobile. There are
no scroll-driven toolbar translations or opacity updates. Inventory uses one
retained input: Search and Paste a link replace its mode immediately, without
changing the field's position or animating its width. Offers has no draft-search
field. The workspace snap fallback commits after 48 ms of inactivity instead of
100 ms; native scrollend can commit sooner.

The previous workspace-level non-passive touchmove listener could place the
whole scrolling surface on the main-thread input path, even when its handler
returned without taking a gesture. It has been removed from the main surface.
The remaining header/editor tab gestures use passive pointer listeners and
declared pan-y behavior. The workspace pager keeps native touch scrolling and
retains both workspaces and loaded images.

Browser checks: one command input retains the same 204 × 36 px bounds when
swapped at 393 × 852. Both mobile toolbars remain at x=22/y=18, 349 × 44 px.
At 320 px the Offers toolbar is 276 px wide; neither 320 px nor 1440 px layouts
have horizontal document overflow. The editor remains full viewport and Review
opens at 1/10. All 123 tests and TypeScript pass. The optimized arm64 release
build succeeds; its initial JavaScript is 104.30 KB gzip (Offers chunk 16.03 KB).
The 1.6.9 APK is 11,681,495 bytes. Installed version 1.6.9/code 1006009 has no
DEBUGGABLE package flag; its pulled APK hash matches the release artifact.
Brief mirrored functional checks on the Xiaomi verified both workspace swipe
directions, no Offers search field, and immediate in-place command swapping.
The existing Inventory photo remained displayed on returning from Offers.
Mirroring was then closed and its laptop and phone processes checked absent
before resetting the frame counters. The owner reported smoother content with
delayed navigation status; an exact full-workload completion was not confirmed.
A diagnostic capture contained 240 frames, 102 missed deadlines (42.50%), median
25 ms and p95 53 ms. This small, unconfirmed workload is not a completed repeat
benchmark and does not establish an overall performance improvement.
The website deployment is READY at https://resell-workspace.vercel.app and serves
the expected index-1Zw-QP57.js production bundle (104.25 KB gzip).

The 1.6.8 diagnostic sample below did not establish an improvement: the owner
reported a lagging toolbar rather than confirming the exact repeated workload.
That feedback led to the stationary-toolbar and input-path changes above.

## Resell 1.6.8 — native workspace pager and unmirrored release test

The former workspace gesture waited for touchend, hid one large subtree, showed
another, and restored window.scrollY on the following animation frame. It had no
finger-following page movement. The replacement uses a two-page native horizontal
scroll/snap track, with independent vertical scroll containers. Both workspaces
are pre-mounted on phones. React commits a selected destination only after the
track settles. Ordinary touch movement is handled by the browser compositor;
progress styling was initially scoped to the small toolbar rather than inherited
by every inventory node (removed entirely in 1.6.9). Dedicated gallery/draft/reorder
gestures retain ownership.

Offers now uses the same compact toolbar dimensions as Inventory: both measured
349 × 44 px at x=22/y=18 in a 393 × 852 preview. At 320 px width the top toolbar
measured 276 px with no horizontal document overflow. Desktop keeps its normal
single visible workspace. The phone Inventory scroller retained scrollTop=852
across workspace changes while window.scrollY remained zero. Loaded photo IDs
and single load-event counts were unchanged. Filters remained inside the phone
viewport (x=14..379, y=82), and the editor remained 393 × 852 with Review at 1/10.

Release build: npm run android:release:windows. Rust reports release [optimized];
Gradle builds arm64Release with R8/resource shrinking and debuggable=false. The
APK is 11,681,263 bytes and verifies its APK Signature Scheme v2 signature. It is
signed with the existing local development certificate only to update the
installed app without erasing its local data or credentials. It is an optimized
local performance release, not a Play Store signing setup. See official
[Tauri signing](https://v2.tauri.app/distribute/sign/android/) guidance for store
signing. Reflection-based Tauri plugin entry points have explicit keep rules.
The native importer still embeds the configured HTTPS Resell endpoint.

No-mirroring protocol: the scrcpy window was closed, no scrcpy process remained
on the laptop, and no scrcpy server appeared in the phone process list. The owner
performed 10 Inventory/Offers round trips (20 swipes over text/empty space), then
5 Inventory down/up scroll cycles. Android gfxinfo/framestats were read over USB,
without injected UI actions or mirroring during the manual workload. The baseline
counter was reset just before closing the mirror; subsequent manual testing was
unmirrored. This is an owner-operated workload, not a laboratory Macrobenchmark.
Official [Android diagnostics](https://developer.android.com/tools/dumpsys)
describe these counters. ViewRoot timing is not a direct WebView FPS measure.

| Sample | Build | Frames | Missed deadlines | Median | p95 |
| --- | --- | ---: | ---: | ---: | ---: |
| Before, manual unmirrored | 1.6.7 debug | 3,108 | 504 (16.22%) | 15 ms | 46 ms |
| Diagnostic, unmirrored; workload counts unconfirmed | 1.6.8 optimized release | 1,920 | 577 (30.05%) | 15 ms | 42 ms |

Changing both the build mode and workspace implementation means this comparison
can measure the combined result, not attribute a gain to either change alone.
The installed release was verified as version 1.6.8 / code 1006008. Its APK
SHA-256 matches the tested release artifact exactly, and installed package flags
do not include DEBUGGABLE. The existing inventory appeared after launch.
Mirroring was used briefly only for browser installation, then closed; no scrcpy
process remained before resetting the release frame counters. The owner then
reported toolbar movement lag. The diagnostic sample has a higher missed-frame
percentage and a lower p95 than the baseline; it does not justify claiming
uniformly smoother performance.
All 123 automated tests and TypeScript pass. The release APK has been built and
verified. No 999.md preparation or publishing is part of this test.

## Resell 1.6.7 — preview initialization, chart tracking and rendering work

Review galleries now receive explicit active visibility. Their layout effect
positions the real selected slide before paint when the tab becomes visible,
rather than exposing a leading loop clone at width zero and scrolling through it.
First-open Review was checked as photo 1/10 in the browser and on Android 1.6.5.
After manually selecting photo 10, rapid Photos/Details/Review switches retained
10/10 without an automatic return to 1. This preserves intentional selection.
The separate Preview popup also waits for nonzero track width and actual photos
before marking its track initialized. A changed photo count starts directly on
the real selected slide. The asynchronous popup fixture was checked at slot 1
and counter 1/10 immediately after opening.

Profit tracking is isolated in a memoized chart. Pointer movement schedules one
small animation-frame update of the SVG guide, dot and nearest-date/amount text;
it no longer rerenders the sales dashboard, its ledger, or chart paths on every
pixel of movement. Pointer capture and touch-action:none keep a held finger on
the chart instead of scrolling its sheet. Keyboard arrows/Home/End also inspect
the series. The owner confirmed on the connected phone that the guide follows
smoothly and the date/amount update. Browser checks matched 11 Nov to the seeded
350 MDL sale and verified continuous cursor geometry and boundary clamping.

Root and nested scroll surfaces disable overscroll chaining/effects in CSS. The
Android activity template additionally uses View.OVER_SCROLL_NEVER, reproduced
in the built main activity. Top/bottom boundary pulls on 1.6.5 left the content
in its expected position. iPhone overscroll behavior has not been device-tested.

Rendering reductions: removed whole-page opacity fades for retained workspace
and editor pages; the floating-header observer ignores image/counter/readout
mutations and only writes a changed state. On phones, sheets and controls use
solid surfaces/dimming instead of backdrop filtering, and enlarged photos avoid
an additional blurred copy behind the original. Desktop blur remains available.

Measured browser check: Windows Ryzen 5 7430U, local Vite development preview,
393 × 852 viewport, 500 seeded inventory records plus four sales and one pipeline
fixture. Four Inventory/Offers round trips and twelve editor-tab clicks each
recorded zero main-thread long tasks (>50 ms); observed Event Timing maximum was
56 ms during the tab sample; the later chart/keyboard sample reached 88 ms.
The inventory initially mounted 18 cards. This is a small local sample,
not an INP percentile, production latency result or universal zero-lag guarantee.

The first Android 1.6.5 debug trace while USB mirroring and mixed acceptance
checks were running recorded 206 frames, 118 deadline misses (57.28%), p50 34 ms,
p95 101 ms. That result does not satisfy a no-jank target. It prompted the 1.6.6
mobile no-blur pass; no causal speedup is claimed from that change without a
controlled comparison. A subsequent mixed 1.6.6 sample recorded 97 frames,
54 misses (55.67%), p50 32 ms and p95 150 ms. Different sample counts/workloads
mean these are not a controlled before/after comparison, and neither result
achieves a no-jank target. Mirroring, the debug build, input injection and device
conditions affect these Android ViewRoot statistics; they are not web FPS.

All 122 automated tests and TypeScript pass. Production main JavaScript is
103.14 KB gzip; Offers 16.15 KB and separately loaded Supabase 59.58 KB. Web and
Android ARM64 builds succeed, and the current production deployment is READY.
The installed 1.6.6 APK matched the release SHA-256. Inventory, Offers, editor
Details/Photos/Review, Sales and Account opened correctly; the first Review photo
stayed at 1/10. The installed 1.6.7 APK matched its release SHA-256 (versionCode 1006007).
Both the swipe-opened Preview popup and editor Review opened on photo 1/10
without a deliberate scroll. Screenshots are recorded as
.native-tools/resell-167-popup-first-photo.png and resell-167-review-first-photo.png.
No 999.md form preparation or publishing was performed.

## Resell 1.6.4 — compact actions and live counters

Draft action strips settle at 64 px and resist long drags, remaining below 76 px
of exposure even for a full-width gesture. The full-swipe threshold follows the
finger's actual distance rather than expanding the card. Short and full gestures
retain their reveal/open behavior. The compact geometry has a regression test.

Gallery counters now read the native scroll position on the scroll event and
change only when the nearest visible page changes. This updates the small counter
without a React gallery render, image replacement or waiting for scrollend. Source
selection and image preparation still settle after a gesture. Card and enlarged
viewer counters both matched photo 2/10 in the isolated preview.

Tab gestures now include buttons, text fields, editor headers, footers and inactive
photo-grid tiles. Nested editor scopes own their gestures, suppressing stray click
activation after a tab swipe. Native photo/video gestures, draft action swipes,
range sliders and an actively held photo reorder retain ownership. Vertical
scrolling cancels the tab gesture; ordinary taps retain their normal behavior.

The toolbar now says Paste a link and uses transparent field/filter backgrounds
against its shared floating surface. The centered bottom bar is wider. At the
393 × 852 isolated preview it measured 322 px, with a 334 px top toolbar. No
horizontal overflow occurred at 320 × 740. The measurements include this
Windows browser's reserved scrollbar width.

All 119 tests, TypeScript, production web and Android ARM64 builds pass. Main
JavaScript is 102.27 KB gzip, Offers 16.13 KB, separately loaded Supabase 59.58 KB.
The production deployment is READY. Physical 1.6.4 acceptance was completed on
the connected Xiaomi/Android 12; the installed APK matched the release SHA-256.
Fast repeated photo swipes advanced the visible image and counter to 8/13, and
workspace switching retained that photo. Swiping from the Search toolbar button
opened Offers; swiping from the drafts search field returned to Inventory. In
the editor, swiping over the title field opened Photos, over a photo-grid button
opened Review, and over header section buttons returned to Photos. No unintended
button activation occurred. Both compact draft actions revealed and opened their
correct destinations. All ten grid photos remained present and ordered.
Screenshots: .native-tools/resell-164-navigation.png, resell-164-compact-draft.png
and resell-164-compact-preview.png. No marketplace preparation or publishing
was performed. These observations do not measure physical frame timing or FPS.

## Resell 1.6.3 — draft gestures and narrower navigation

Drafts now follow horizontal finger movement using a transform updated once per
animation frame. Right reveals Edit; left reveals Preview. A short swipe leaves
the action available to tap; a longer swipe opens it directly. Vertical scrolling,
the existing hold menu, keyboard actions and reduced-motion preferences remain.
Workspace tab gestures exclude these cards so they cannot intercept a draft swipe.
The short left reveal and actual ten-photo Preview were verified on the connected
Xiaomi running Android 12. A full right swipe opened Edit in 1.6.2.

At 393 × 852, the top toolbar measures 326 px wide with 32 px fields; the bottom
bar measures 274 px. Both are centered, with no horizontal document overflow.
In the isolated browser, switching Inventory → Offers → Inventory preserved
slide 2/10, the same photo element and its single load event. Right-swipe Edit,
left-swipe Preview and the original hold menu all worked.

Physical rapid-swiping in 1.6.1 exposed a stale counter despite moving photographs.
The correction uses the actual fractional track width rather than rounded
clientWidth, and retains an idle-scroll fallback because some Android WebViews
expose scrollend without reliably delivering it after interrupted gestures.
There are no React updates during the finger drag. The correction is built as
1.6.2; the installed APK matched its release SHA-256. Rapid swipes in both
directions moved photographs and updated the counter. Last-to-first looping
worked, and Inventory → Offers → Inventory retained photo 2/13 without a blank
or position reset. Details/Photos/Review switched under rapid taps, and a heading
swipe switched Photos to Review. The ten-photo grid retained its loaded tiles.

The first thumbnail decode on this phone left five tiles broken temporarily,
although opening the original image worked and those tiles eventually loaded.
Version 1.6.3 uses the original after a one-second thumbnail timeout or thumbnail
load failure, retaining it instead of switching again after a late decode. This
additional fallback was verified on the physical phone in 1.6.3 (versionCode
1006003), with the installed APK matching the release SHA-256. All ten numbered
photos displayed, including previously broken tiles 6–10. Rapid Details/Review/
Photos switching retained the loaded photographs without broken tiles. Short
right/left swipes revealed Edit/Preview, both revealed buttons opened their
correct destination, and full swipes opened those destinations directly. Repeated
opens and closes remained responsive. The draft contents were not edited or
deleted, and neither Prepare on 999.md nor Publish was pressed. Screenshots are
recorded in .native-tools/resell-163-all-ten-photos.png, resell-163-edit-swipe.png
and resell-163-preview-swipe.png.

All 118 tests and TypeScript pass. Production web build succeeds: main JavaScript
101.86 KB gzip, separately loaded Offers 16.09 KB and Supabase 59.58 KB. The ARM64
Android build succeeds. The production deployment is READY at the existing
Resell alias. No 999.md advert was published. No physical FPS claim is made.

## Continuous carousel and retained pages — follow-up

The follow-up replaces the three recycled swipe pages with a stable native
scroll track and edge clones. Ordinary swipes no longer reset the track or
replace photo nodes. Native scroll snapping follows touch input; one-photo
snap stops prevent a fast flick from running across several photos at once.
Small previews are requested only from the recognized 999.md image CDN path,
with full-resolution images layered above them as they become ready. Unknown
URLs and local photographs are never rewritten. An uncached network image can
still take time to arrive; this is not an instant-download guarantee.

Inventory and Offers now stay mounted between workspace changes. In an isolated
browser check, returning to Inventory preserved slide 4/10, the same image
element identity, and its single load event. Details, Photos and Review also
stay mounted; all ten photo-grid image identities and load counts remained
unchanged after switching away and back. Grid thumbnails are generated at
340 pixels wide with cached, limited decode work. Full-size review photographs
fill their card. Touch swipes switch editor sections and Inventory/Offers while
excluding form fields, photo galleries and drag/reorder controls.

At a 393 × 852 preview size, the top toolbar measures 46 px and the bottom bar
55 px. The Paste icon's horizontal position is now 84 px in both command modes;
the logo has a fixed grid slot, eliminating the measured intrinsic-width shift.
Specifications replaces Characteristics. A two-row footer keeps source and
action icons separate from the profit/status row on narrow screens.

Sales & profit now includes 30-day, 90-day and all-time filters, recorded profit,
sold counts, known-profit averages, a separate expected-profit pipeline, a
lightweight interactive SVG series and a sale ledger. Missing profit is excluded
from averages; zero profit remains a recorded amount. A single monthly point is
rendered as a point rather than an invented triangular trend.

The automatic retry audit found that a recent successful check could suppress
an already-due failed-attempt retry. Due failures now bypass the normal 15-minute
success interval. Transient failures back off from 1 to 5 minutes; marketplace
restrictions retain 5–60-minute cooldowns and removed adverts retain one hour.
Refresh work yields while editing offers or swiping media. Failure messages and
times survive subsequent successful refreshes, and upstream HTTP refusals now
include their status code. The currently inspected Redmi card no longer showed
a failure icon. Its earlier error had already been cleared by the old code;
the relevant historical server logs were unavailable, so its exact old cause
cannot be reconstructed from the available evidence.

The follow-up has 115 passing automated tests, including ten-photo thumbnail
reuse/fallback, swipe geometry, profit periods, explicit HTTP refusal codes,
retained failure history and retry-deadline precedence. TypeScript and Android
ARM64 builds pass. See the verification notes below for the earlier baseline;
they are historical, not the implementation of the current gallery track.
The current production main JavaScript is 101.81 KB gzip, with Offers at 14.91 KB
and the separately loaded Supabase client at 59.58 KB.

Real-phone follow-up: the first installed follow-up APK was verified by SHA-256.
Rapid native swipes exposed excessive multi-page momentum; that observation led
to the one-photo snap correction. Inventory-to-Offers swiping and editor
Details-to-Photos-to-Review swiping worked on the phone. The ten-photo grid and
full-cover Review layout were also observed there. The final corrected APK was
built and downloaded, but Android Play Protect blocked installation pending the
owner's review. Its hash does not yet match the installed APK, so the final
correction's physical-phone swipe verification remains pending; no completed
frame-rate or final-device acceptance claim is made. The website is deployed at
the existing production alias with the final fixes.

## Earlier frame-scheduler baseline (superseded)

The earlier implementation committed photo navigation on the next scheduled frame (16 ms scheduling
window), without waiting for network/decode or for a previous 180 ms transition.
Input in the same window is coalesced to its final destination. Superseded image
preparation is cancelled; late downloads cannot change the selected photo.
Native scrolling continues to follow the finger, with looping adjacent pages.
Network speed still determines when an uncached photograph becomes available.

Inventory search indexes original descriptions and characteristics once per
immutable record, releases old records through a weak cache, and rebuilds the
index for a refreshed/corrected record. Search input updates before deferred
filtering. Unrelated renders reuse the filtered list and the sales summary.
Only the first 18 matching cards mount initially. More mount in batches of 18
near the bottom; search and sorting always operate on the entire inventory.
Galleries share a single near-viewport observer and no longer register a window
resize listener per card. Existing per-card memoization, stable photo references,
bounded media caching and limited video warmup remain in use.

The mobile tab bar has four destinations, outline/solid icon pairs and a single
selection surface animated with a transform. Share is inside Account. Toolbar
width transitions last 280 ms; a solid translucent surface fades in only when
cards reach the sticky header. This avoids a continuously blurred toolbar on
lower-end devices. Reduced-motion preferences disable these transitions.
Touch highlights and pointer focus use neutral styling; keyboard focus remains
visible. Telegram's official [Android redesign announcement](https://telegram.org/blog/crafting-android-design-and-more)
was consulted for its one-tap navigation and efficiency principles; Resell's
controls and icons are implemented locally.

## Recorded checks

Environment: Windows laptop, AMD Ryzen 5 7430U, Node 26.7.0; phone-size browser
previews at 320 × 740 and 393 × 852, desktop at 1440 × 900. Local UI fixtures
use a separate origin, synthetic photographs and cloud sync disabled. They never
write to the production inventory.

`npx tsx tests/control-benchmark.mts`, 200 runs per size, 4,590-character original
descriptions, four alternating search queries:

| Records | Previous search median / p95 | Indexed search median / p95 |
| --- | --- | --- |
| 100 | 1.115 / 1.480 ms | 0.056 / 0.071 ms |
| 500 | 5.651 / 6.208 ms | 0.273 / 0.412 ms |

These numbers measure CPU search work, not whole-screen rendering or network
latency. The 500-record browser fixture initially mounted 18 cards and correctly
found record 499 through search. Individual rapid gallery moves updated the
counter immediately in both card and enlarged viewer. The filter panel began at
82 px under a 79 px toolbar bottom at 393 px width. Horizontal document overflow
was absent at the tested phone widths. The toolbar surface was transparent at
the top and visible after scrolling over the cards.

Final web build: main JavaScript 99.24 KB gzip; separately loaded Supabase client
59.58 KB, Offers 14.53 KB, Vimeo helper 8.18 KB. These are separate chunks, not a
claim that total authenticated startup downloads are only 99 KB. The complete
107-test suite, TypeScript check and production build pass. Android ARM64 APK
build succeeds. The scheduler tests cover rapid input, interrupted transitions,
slow and failed loads, cancellation, looping, independent galleries and native
swipe interruption. Search tests cover refreshed text and characteristics.

The final Android APK was installed on the connected Xiaomi M2003J15SC,
Android 12, and verified against the built APK by SHA-256. The existing account
session and inventory remained available. Three rapid next-photo taps advanced
the real 999.md gallery from 1/13 to 4/13. The four-tab bar, outline/solid icons,
Account sheet with Share inside it, and expanding Search field were checked
on the phone. The production alias serves the verified updated asset bundle.

Physical frame rate, sustained 120 Hz behavior, real-photo CLS under a slow
network, and iPhone behavior have not been measured by this audit. This update
does not change marketplace preparation or click Publish.
