# BONEMAN menu design

Modern mode's gameplay life readout is one Roo PNG line (`3 DEATHS`) centred
below the portrait/SPECIAL ring. It uses the shared menu action size and the
same 0.882 cap-height conversion as menu PNG lettering, in both direct DOM
and native pre-CRT rendering. Classic retains its large adjacent life count;
competition's avatar-only and Bonus visibility rules are unchanged.

Player-facing menus are game screens, composed for a TV frame. They must not behave like scrolling web pages.

- Divide the viewport into fixed regions. Keep the island/title area and control hints visible. Pause and Level Select fill the screen inside TV-safe margins.
- Fit lists in their assigned region. Paginate long content first; when scrolling is necessary, only the bounded content region scrolls. Never scroll the entire menu. Keep exit/confirm actions outside that region.
- Use the existing input prompt kit with the silver comic `Staging Secondary` treatment. Reflect the current controller family and real input bindings. Give controller selection a visible highlight without moving the hit target.
- Show ownership through objects: an empty recessed silhouette for missing collectibles, the actual rotating game model for earned collectibles. Use numerical counts and times where meaningful; do not substitute paragraphs explaining missing rewards.
- Level Select has an unboxed island heading and navigation pips, a real level preview above its list, rewards/records on the right, and unboxed controls below. Do not add a redundant “Level Select” heading.
- Touch Level Select uses 48px minimum rows in a bounded, swipeable list. In portrait the list spans both columns below the preview and rewards. The hidden controller footer yields its space to the list; island arrows and the safe-area close action retain separate 48px targets. Verify with `tools/test-level-select-mobile.mjs` in real touch contexts, including the pre-CRT scroll clip and actual entry/cancel actions.
- All game-owned artwork, prompts and collectible models belong beneath CRT. The semantic DOM retains accessibility and interaction. Bounded scroll clipping must match in the Canvas mirror.
- Check 16:9 at 1280×720 and 1920×1080, 4:3, and compact portrait/landscape. No controls or essential text may escape the screen. Respect reduced motion.

`src/game-menu-layout.css` owns the shared sizing policy; it is inserted after the legacy artwork styles. `src/menuPresentation.ts` reuses the game collectible factories and renderer. It does not create another WebGL context or load gameplay levels while browsing. Preview JPEGs in `public/level-previews` are captured from actual game geometry, except Treehouse Trail which uses its user-supplied concept artwork; the local authoring helper is `tools/capture-level-previews.ts`.

- Map Level Stats retains level selection and entry. Gameplay pause keeps the Level Select name and requires confirmation before abandoning the current run; cancel preserves it.
- Pause and Options use actions/options on the left and the overall collectibles sheet on the right. No progress bar or separate map Progress submenu.
- Submenu hints are Select and clickable Back only; never show Up/Down Choose. Touch has no menu hints and uses a corner close action instead. Back is never a menu-list row.
- Text appearance and shimmer are authoring controls in the M-dismissible Text Tuning panel, never gameplay options. Menu PNG text uses the HUD atlas painter at the render target's full resolution, including physical pixels on the direct path.
- Home, Island Map and gameplay Options share their audio, prompt-style and Trick Guide controls, plus the collectibles sheet. Home and map also allow changing play mode; active courses keep their existing rules. The four-page Trick Guide uses `src/skateTrickGuide.ts` in both Options and competition. Left/right pages, Select activates the visible arrows, and Back returns through the originating Options menu without resuming the run. Guide text and prompt artwork stay beneath CRT, with fixed header/footer and bounded page content.

- PNG menu focus uses the existing orange neutral image unchanged for its normal phase. White flashes and inactive desaturation are display-time CSS/Canvas colour filters. The reference default is one white frame followed by three orange frames at 30 fps (7.5 Hz, 25% white). Keep only lettering as the focus cue; no selection arrows, row highlights or outlines. Rate, white duration/brightness/desaturation, and inactive saturation/brightness sliders belong in M → Text Tuning. Reduced motion and a zero flash rate hold the normal PNG.

- New Game, Load Game and Save/Load use four fixed save bays in a 2×2 grid at every aspect ratio. Directional navigation follows the rows/columns, skips empty load slots, and keeps the selected slot when cancelling a confirmation. Save/Load's separate **Save Slot N** action writes the active game; selecting a stored bay loads through the existing confirmation. Each occupied bay shows its last finished level's existing preview JPEG, name, completion percentage and saved date. Empty bays have an empty preview frame. Images and text share the pre-CRT pass.
- Saves retain V1 compatibility and add optional `lastFinishedLevel`, recording normal finishes (including repeats), valid completed time trials (including non-record attempts), and final competition results. Browsing hubs and unfinished attempts do not change it. Pre-change saves use completed map progression as a stable fallback until their next finish records exact history; a new adventure previews Treehouse Trail. Preview changes follow the durable snapshot, so unsaved/failed writes do not alter the displayed save bay.


## Large menu scale and shared Jungle Cup treatment

The September 2026 scale pass uses [Kara Zisa's N. Sane Trilogy pause screens](https://karazisa.com/Crash-Bandicoot/Pause-Menu) and a [Crash 4 Game Progress pause screenshot](https://pbs.twimg.com/media/Emad7dMW4AA20Tl?format=jpg&name=4096x4096) as visual proportion references. N. Sane's short action list and Crash 4's full-screen action/progress split guide the hierarchy; the existing BONEMAN type and focus artwork remain the game's own style.

At 1280×720, the shared CSS scale is approximately 56 px for titles, 42 px for actions, 36 px for option controls, 29 px for section headings, 22 px for body copy and 19 px for captions. It scales with viewport height on TVs and viewport width in portrait, with a separate short-landscape scale. Increase available row space before reducing type. Long guides scroll only within the current page; headings, page controls and Back stay fixed.

`src/menuTheme.ts` owns the deep teal panel palette, brass edges and backdrop used by both Canvas painters. Its exported CSS variables keep native DOM fallback artwork in step with the pre-CRT pass. Unboxed Level Select, Progress and Trick Guide screens use an opaque dark backdrop. `src/game-menu-layout.css` owns the common type scale; `src/competition/menu.css` consumes it. Jungle Cup uses the same Roo headings, action lettering, orange/white PNG focus, secondary body text and input hints. Final standings place the podium alongside all six skaters on landscape screens. The competition guide returns through a footer Back action or a touch close button.

Home is intentionally exempt from the shared backdrop: show the authored vortex
without a dark-blue overlay or backdrop blur in either Canvas or DOM. Keep its
current type, layout and controls; replacement legibility artwork will be authored
separately. Other menu backdrops retain their current treatment.

Home actions form one vertical column at every aspect ratio, including short
touch landscape. Overflow stays inside the bounded action list. Home has no
Save Offline action or offline-save status copy. Update Game appears only when
an actual new release is available.

For local visual review, open `menu-review.html?playtest&level=codex-lab&lite`, then repeat without `lite`. The catalogue exposes 26 screens, including home/map Options, every confirmation, both result types, the competition introduction, guide, judges, standings, win and loss. Save previews and competition results are memory-only fixtures. The review entry is excluded from the production build. Audit layout checks viewport bounds, clipped controls, touch targets, page width, table cells and the full standings table. It does not replace visual inspection of text or actual gameplay navigation.

The Jungle Cup running clock uses the teal/blue Roo PNG atlas (`bonus` palette), through the shared DOM decorator and pre-CRT competition painter. Its live time remains semantic text; the run label keeps the existing secondary type.


Cup gameplay clocks sit at the upper left as compact, unboxed text: 28px time
on desktop and 24px on touch/narrow screens, with a smaller run label. Touch
placement clears the 48px Pause button and safe-area inset in both orientations.
The DOM and pre-CRT painter have no clock panel, border or rectangular shadow;
text shadows retain contrast. Final-combo and urgent states keep the same compact
footprint. `tools/test-competition-clock-mobile.mjs` reviews both Cups in phone
portrait/landscape, lite/full rendering and desktop, including actual Pause taps.

## Compact menus and presentation readiness

Touch sizing also applies when a connected keyboard/controller owns the prompt
family. All menu actions, island arrows, guide arrows and close actions retain
48px targets. Headers, corner close actions and final result/Cup actions stay
fixed; only assigned content regions scroll. Pause, Options and short-screen
Home actions use bounded lists, and keyboard/controller focus reveals its action
without scrolling the whole menu. Portrait Options stack labels and choices.
Compact guides use fixed table columns; Canvas text bounds include cell padding.
Recipe cells retain table layout and readable text, and mirrored prompt glyphs
and words follow the same bounded scroll clipping as the DOM.
Short Cup standings retain all six skaters in intrinsically sized content with
bounded scrolling when necessary. Save bays remain a 2×2 grid.

`src/roo-type/menuAssets.ts` requests both font faces and decoded PNG atlases before
menu ink is published. A missing shimmer image reuses the neutral PNG; a missing
neutral resolution tries the other shipped sizes, and reconnecting retries a
degraded atlas. The existing PNG geometry, painter and focus phases are retained.

Startup keeps the original title/loading vortex and input lock until the actual
title or direct-playtest frame is ready; do not add another spinner or loading
label. Transitions retain the animated vortex
through destination assets, texture uploads and shader/geometry warmup. A captured
loading frame covers final post/HUD requests and GPU completion, then fades into
the ready destination. Its fullscreen raster is released afterward. Shared
prompt/map/touch ink is suppressed during loading, including cached Canvas ink.

`tools/test-menus-responsive-browser.mjs` covers all 26 catalogue screens, all four
guide pages, real touch actions, bounded swipes/focus, PNG labels and table cells.
It supports `MENU_BROWSER=webkit`, `MENU_PROFILE=320x568,568x320,390x844`,
`MENU_TOUCH=false` and `MENU_CUP=waterpark-cup` for additional compact/Cup checks.
`tools/test-level-stats-touch.mjs` exercises actual map entry and course launch with
touch, keyboard and PlayStation prompts. `tools/test-menu-loading-browser.mjs`
delays fonts, assets, warmup and final preparation and checks retained loading
pixels, prompt suppression, startup readiness and failed shimmer images
in lite/full rendering. `tools/test-roo-atlas-readiness.mjs` covers decode,
alternate resolutions and reconnect recovery. `PLAYWRIGHT_MODULE` may point to a
local Playwright runtime; keep separate output directories for each engine.

Phone screenshots are stronger evidence than viewport-bounds assertions. Level
Select uses three direct grid children (bounded preview frame, rewards, list),
with an absolutely fitted image; never size a replaced preview image directly
against percentage grid tracks or flatten its parent with `display:contents`.
The Canvas preview uses the frame bounds, clips, and paints before rows.
`src/presentationCssViewport.ts` supplies the actual displayed canvas bounds to
menu, prompt, reward and Cup painters. iOS home-screen canvas height can exceed
`innerHeight`; stretching semantic menu coordinates to that height misaligns
visible labels and touch targets. Try Island 2, rotate the same open menu, swipe
to the last row and tap its visible lettering. Inspect settled previews and
actual pixels; synthetic taps on invisible DOM targets do not prove usability.

## Desktop/TV and hybrid touch layout

Level Select keeps its section-sized lettering in rows at least 44px / 6vh high.
The level list alone scrolls when an island has more entries than fit beneath the
preview. Controller/keyboard selection reveals the chosen row; mouse wheel and
click/double-click retain selection and confirmation behavior. The island pips
are centered beneath the heading. The general action font must not override the
level row font or squeeze rows to fit an entire island.

Landscape viewports at least 1000×600 use the TV action scale even with touch
hardware or controller prompts. Pause, Options, confirmations, save actions,
results and Cup actions retain that scale. Touch close actions remain fixed
48px squares, and safe areas and bounded swipe regions remain active. Compact
phone and portrait layouts keep their existing sizing and two-column save bays.

Pause includes **Show Debug Menus / Hide Debug Menus**. It shares the M shortcut's
persisted `solProtoDebugChrome` state, debug shortcut gating and modal-focus rules.
It keeps the run paused, updates the current action in place, and can be operated
with touch, mouse, keyboard or controller. M also updates its label while Pause
is open; dismissing a focused debug panel returns focus to the menu.

The catalogue audit checks PNG ink inside each hit target, as viewport bounds
alone cannot detect overlapping lettering. `MENU_TOUCH=true` allows large-touch
runs, and `MENU_PROMPTS=ps5` exercises hybrid touch/controller layouts.
`tools/test-menu-desktop-inputs.mjs` exercises actual browser D-pad/stick edges,
held Confirm, keyboard/mouse, the last scrollable level, confirmation cancellation,
2×2 save navigation and debug persistence in lite/full rendering.

## Painted stone and brass finish

The October 2026 pass uses five [ImageGen menu studies](../art/menu-polish/README.md)
to refine Pause and the four map submenus. Existing compositions and Roo PNG
lettering remain authoritative. The runtime adds painted midnight-blue panels,
small brass corner caps, cyan bevels, engraved dividers, recessed sockets and
soft reward wells. Pause uses the common title size. Level Stats keeps its
unboxed heading, preview/list and rewards/records split; Save / Load retains
its four fixed bays. Home keeps its authored vortex.

`menuTheme.ts` loads two shared WebP material assets through presentation
readiness. Its nine-slice panel painter keeps corner details square across
aspect ratios; the semantic DOM uses matching border images. Both pre-CRT
painters reuse the existing Canvas/WebGL resources. Failed artwork falls back
to the dark panel palette. Decorative rules and wells follow bounded clipping
and remain independent of focus. Actual earned collectible models and their
animation are unchanged. The PNG atlases, glyph measurements and focus profile
are also unchanged; reference-frame verification remains the font acceptance
check. See the study folder for the prompts, production captures and validation.
