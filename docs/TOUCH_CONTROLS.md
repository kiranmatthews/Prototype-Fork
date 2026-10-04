# Touch controls

The production overlay keeps the authored digital eight-way movement, face
button mapping and gentle camera peek. It adds visible L2 Inventory and R2
Transfer controls; intentional vertical flicks in empty right-hand space remain
available. Face buttons include their action names, with semantic button labels
and pressed states. Keyboard/assistive clicks provide a short action pulse.

## Input contract

Each finger owns its starting control until lift or cancellation. Window
capture-phase routing handles both moves and releases, including capture failure,
a thumb crossing another zone and a descendant stopping propagation. Movement
has radial and angular hysteresis; button slides require an eight-pixel advantage
before switching, retain the last button across gaps, and cannot turn into a
shoulder gesture after acquiring a face button.

Presses have distinct sequence owners, independent of reusable browser pointer
IDs. Cancelling one contact cannot erase a completed tap or another owner's
pending press. A Jump tap queues both press and release, including down/up
between render frames. Merged input does not release a still-held keyboard or
controller Jump. R2 taps queue their press even after the finger has lifted.
Fresh contacts recover stale ownership of their reused ID independently, and
mouse/pen hover with no depressed buttons clears a missed lift.
Cancelling the final Jump contact emits an abort, rather than a lift. The
simulation clears only its queued charge/tap/launch intent, retaining movement
and velocity. Aborts survive menu, visibility and graphics-recovery edge drains
until a fixed step consumes them. Other held or queued keyboard/controller Jump
intent and independent completed touch taps remain valid. Replay bit 12 records
the abort; all previous bit positions and legacy playback remain unchanged.
Direct trigger holds remain held until release; an Inventory tap and legacy
swipes retain the existing 450 ms pulse window. A pulse waits for its first
input poll before starting that window, so a long frame cannot lose it unread.

Native contacts are associated only by a unique matching start position, never
by assuming Touch identifiers equal Pointer IDs. Native partial lifts/cancels
can therefore recover missing pointer releases independently. Ambiguous contacts
use the authoritative zero-contact fallback.

Blur, page hide/show, hidden visibility, actual viewport changes, rotation,
map/modal/loading/editor/tool changes and graphics loss/restoration clear held
and pending intent. Hidden side panels clear only the affected controls. Repeated
identical resize notifications retain valid holds. Stale moves cannot revive
released ownership, and long intentional movement/grind/trigger holds have no
timeout. Pause uses ordinary release-to-click activation and clears gameplay
intent before opening the menu.

## Presentation and browser gestures

Both thumb groups fit side by side at 320 px width. Buttons and directional
lobes retain at least 48 px targets, with additional clearance inside safe-area
edges and above the home indicator. Pressed states change ink immediately and
keep exactly the same target bounds. Dark plates, pale edges/lettering and warm
active ink remain visible over bright and dark scenes. The D-pad contact marker
shows steering displacement, and camera dragging shows an anchored contact cue.
Bonus reward rows clear the shoulder controls, and the portrait heading sits
below Pause.

The native DOM and Canvas mirror below CRT use the same geometry and ink.
Controls use no backdrop blur or perpetual animation. Pointer moves reuse cached
control rectangles instead of reading layout. Idle Canvas ink reuses its texture;
contact movement, highlights, labels and viewport changes invalidate the cache.

Game surfaces use `touch-action: none`, suppress selection, callouts, context
menus and tap highlights, and cancel game-surface gesture/double-click events.
The page's existing overscroll and viewport policy remains in place. Bounded menu
lists and editor fields retain their normal interactions.

These are protections within the browser's control. They cannot certify that an
operating system will never take an edge gesture or system interruption. Physical
Safari/Chrome checks remain required for OS-owned gestures, app switching and
notification overlays. See the [Pointer Events touch-action and lifecycle
contract](https://www.w3.org/TR/pointerevents3/).

## Verification

`node tools/test-touch-release.mjs` executes production TouchControls and Input.
It covers capture/native fallback, completed and cancelled taps, ID reuse, shared
button ownership, all eight sectors and hysteresis, 4,000 moves with zero layout
reads, long holds, pulses across frame stalls, lifecycle/mode/graphics recovery,
and keyboard/controller/menu-guard edge merging. It runs in the Pages workflow
alongside the responsive layout regression.

`tools/test-touch-controls-browser.mjs` exercises the actual game in real touch
contexts. Chrome checks three actual contacts, individual lifts, cross-zone
movement with capture failure, quick edges, flicks, pinch/selection/scroll
suppression, Pause/resume, Inventory and rotation. Profiles cover 320×568,
568×320, 390×844, 844×390, 768×1024 and 1024×768; full rendering covers both
390 px phone orientations. Full-render idle runs reused the control texture for
34 and 27 rendered frames with zero additional uploads and no console errors.
`TOUCH_RENDER=lite|full`, `TOUCH_PROFILE=390x844,844x390`, `TOUCH_OUTPUT` and
`PLAYWRIGHT_MODULE` can narrow or relocate a run.

`tools/test-touch-native-browser.mjs` uses the local-only
`touch-controls-review.html` harness and the actual Input/controls without a
WebGL startup dependency. It checks WebKit and Chrome native layouts, real touch
taps, edge consumption, three independently routed browser pointer contacts,
gesture/context suppression, modal/blur cleanup and rotation, including touch
taps through the production compositor's transparent semantic layer. Injected contacts
and lifecycle events are explicitly different evidence from physical OS input.
Use `TOUCH_BROWSER=webkit` to select Safari's engine. The harness is excluded from
production entry points and stores no game data.

An earlier WebKit complete-game attempt lost its graphics context during startup.
Rechecking the current published release passes full-render 390×844 gameplay,
input, Pause/resume, rotation and Bonus layout with no console errors and zero
additional control texture uploads across six rendered frames. This establishes
desktop WebKit coverage; full-render 844×390 landscape also passes. Physical
iOS/Android OS behavior remains unverified.

`tools/test-touch-jump-cancellation-browser.mjs` uses the real Input/Player to
compare ordinary lifts with cancellation, blur, rotation and pause/resume in
Chrome and WebKit. Before the fix, cancellation and blur launched the same
approximately 2.4 m jump as an intentional lift. Interrupted charges now stay
grounded; ordinary lifts still jump. `tools/test-jump-cancellation-replay.mjs`
covers faithful abort recording/playback, legacy release bits and unknown-bit
rejection and runs in the Pages workflow. The isolated production build,
texture-cache/mobile layout and keyboard/controller/skate checks are separate
gates; the full suite remains opt-in.

The historical locomotion replay fixture fails its recovery assertion on the
unchanged release as well. Comparing every simulated frame of both legacy takes
before/after this fix produces identical movement and physical trajectory
hashes; its existing fixture expectations were retained.
