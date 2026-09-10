# Level Select

Level Select is available in the in-game pause menu and alongside the Island Map utilities. On the map, pressing the PS4/PS5 Touchpad opens it directly; pressing it again or pressing Circle closes it. Other standard controllers can use View/Share, and keyboard players can use Tab. Existing Options/P pause and map utilities keep their bindings.

The left column lists the current island's campaign levels. A screenshot of the highlighted level sits above the list. The right column shows crystal, box gem, combo gem and time medal ownership as empty recessed sockets or the actual rotating game models, followed by the three best trial times. Jungle Cup displays its unique cup and competition format instead of ordinary collectibles/trials. Missing records are shown as missing, without inventing milk percentages or other unsaved statistics.

Up/down selects a playable level; left/right or the header arrows page sideways through unlocked islands. Each island remembers its last selected row while browsing. Locked levels remain visible and disabled; an island only joins the pager when one of its campaign hubs is unlocked. Selection opens on the current level or the map's selected hub. Browsing does not change campaign progress or map focus.

Cross/Enter or Play Level starts the selected level; mouse/touch can select a row to inspect its progress before pressing Play. Double-click also plays. Back returns to the pause menu when opened from gameplay, or resumes the map when opened there. The normal loading transition and release guard prevent held confirm from launching repeatedly or charging a jump in the destination. The host checks unlock eligibility again before switching, preserves earned inventory, discards an unfinished bonus purse in favor of its suspended parent inventory, and restores committed collectible ownership. Starting a level updates the remembered map hub so returning to the map selects the correct destination.

The semantic DOM controls and cached `GameFlowSurface` Canvas mirror share layout and selection state. The menu uses the same pre-CRT insertion point as other game menus; no duplicate DOM artwork remains above CRT when composited. Island changes use a short horizontal entrance, disabled under reduced motion. The header and prompt-kit/comic control hints are unboxed, with no redundant Level Select title. The full-screen composition uses fixed regions at TV and compact aspect ratios. The entire menu never scrolls. See `docs/MENU_DESIGN.md` for the shared policy.

## Focused verification

`npm run check:level-select` covers pause/map access, fresh-save locks, both island pages, remembered row selection, saved statistics, held confirm, PS4/PS5 Touchpad and View prompts, map-only input/release guards, and bonus inventory handoff. Existing prompt, debug-shortcut, GameFlow interaction and Canvas surface checks cover surrounding behavior. The full suite remains opt-in.

`/level-select-review.html?playtest&level=jungle` provides local-only slot-0 fixtures, a simulated standard PlayStation controller, held-confirm controls and compositor diagnostics. It never writes a real campaign save slot and is excluded from the production build.
