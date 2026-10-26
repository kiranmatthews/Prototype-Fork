# Supplied rally sponsor artwork

These eight PNGs were supplied by the user for stadium boards and golf-cart stickers. They are retained unchanged here as authoring sources; their artwork rights remain with their respective owners. Only the combined WebP atlas is shipped in the game.

Run `node tools/build-rally-sponsors.mjs` with Playwright available (`PLAYWRIGHT_MODULE` can point to its installed directory). This rebuilds `public/rally/sponsors-v3.webp`, `src/rallySponsors.ts` and `tools/rally-sponsors/atlas.json`. Run `node tools/sync-coconut-cart-rally.mjs` after changing the sponsor count to refresh the published board UVs.

The atlas preserves transparency. Its original row packing remains unchanged; both stadium artwork and kart decals crop to each logo and use its source aspect ratio. Stadium boards use large wide ads over weathered dark metal, with smaller tilted stickers layered over their edges. Negative U coordinates select the procedural metal within the same material. All eight designs share one texture. The Coconut Cart Rally title is the main stadium design; the seven sponsor designs also decorate the carts. Only the title design repeats on adjacent billboards. The hashes in `atlas.json` identify the original source files.

Sources, in atlas order: Pisupo Pete’s Corned Beef, Crusty Creme Skateboards, Trashed, milk bottle, Uga Beach, Fleshy Fred’s, BONES and Coconut Cart Rally.
