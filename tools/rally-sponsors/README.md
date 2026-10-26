# Supplied rally sponsor artwork

These seven PNGs were supplied by the user for stadium boards and golf-cart stickers. They are retained unchanged here as authoring sources; their artwork rights remain with their respective owners. Only the combined WebP atlas is shipped in the game.

Run `node tools/build-rally-sponsors.mjs` with Playwright available (`PLAYWRIGHT_MODULE` can point to its installed directory). This rebuilds `public/rally/sponsors-v2.webp`, `src/rallySponsors.ts` and `tools/rally-sponsors/atlas.json`. Run `node tools/sync-coconut-cart-rally.mjs` after changing the sponsor count to refresh the published board UVs.

The atlas preserves transparency and source proportions. Stadium rows compensate for the existing 20 m by 4.45 m board shape; cart decals crop to each logo and use its original aspect ratio. All seven sponsors share one texture on boards and carts. The hashes in `atlas.json` identify the original source files.

Sources, in atlas order: Pisupo Pete’s Corned Beef, Crusty Creme Skateboards, Trashed, milk bottle, Uga Beach, Fleshy Fred’s and BONES.
