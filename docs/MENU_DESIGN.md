# BONEMAN menu design

Player-facing menus are game screens, composed for a TV frame. They must not behave like scrolling web pages.

- Divide the viewport into fixed regions. Keep the island/title area and control hints visible. Pause and Level Select fill the screen inside TV-safe margins.
- Fit lists in their assigned region. Paginate long content first; when scrolling is necessary, only the bounded content region scrolls. Never scroll the entire menu. Keep exit/confirm actions outside that region.
- Use the existing input prompt kit with the silver comic `Staging Secondary` treatment. Reflect the current controller family and real input bindings. Give controller selection a visible highlight without moving the hit target.
- Show ownership through objects: an empty recessed silhouette for missing collectibles, the actual rotating game model for earned collectibles. Use numerical counts and times where meaningful; do not substitute paragraphs explaining missing rewards.
- Level Select has an unboxed island heading and navigation pips, a real level preview above its list, rewards/records on the right, and unboxed controls below. Do not add a redundant “Level Select” heading.
- All game-owned artwork, prompts and collectible models belong beneath CRT. The semantic DOM retains accessibility and interaction. Bounded scroll clipping must match in the Canvas mirror.
- Check 16:9 at 1280×720 and 1920×1080, 4:3, and compact portrait/landscape. No controls or essential text may escape the screen. Respect reduced motion.

`src/game-menu-layout.css` owns the shared sizing policy; it is inserted after the legacy artwork styles. `src/menuPresentation.ts` reuses the game collectible factories and renderer. It does not create another WebGL context or load gameplay levels while browsing. Preview JPEGs in `public/level-previews` are captured from actual game geometry; the local authoring helper is `tools/capture-level-previews.ts`.

- Map Level Stats retains level selection and entry. Gameplay pause keeps the Level Select name and requires confirmation before abandoning the current run; cancel preserves it.
- Pause and Options use actions/options on the left and the overall collectibles sheet on the right. No progress bar or separate map Progress submenu.
- Submenu hints are Select and clickable Back only; never show Up/Down Choose. Touch has no menu hints and uses a corner close action instead. Back is never a menu-list row.
- Text appearance and shimmer are authoring controls in the M-dismissible Text Tuning panel, never gameplay options. Menu PNG text uses the HUD atlas painter at the render target's full resolution, including physical pixels on the direct path.
