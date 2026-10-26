# TNT and Nitro race items

TNT and Nitro now appear in the shared item deck at every position in The Slipstream, Country Club and Coconut Cart Rally. The item button drops them behind the racer. TNT burns its existing three-second fuse; Nitro arms after a short drop delay and explodes on contact. Blasts chain nearby traps, stun skaters and damage karts. Shields, stars, jumping over Nitro, shell interception and the horn retain their counterplay. The authored explosive GLBs, burning fuse, pulse, audio and puff effects are reused without reducing their geometry. Inventory pictures are baked from those same assets.

Authored TNT/Nitro on a race course becomes visible ammo that fills the item slot and respawns. A full slot leaves the pickup for another racer. Ammo does not count toward the box gem. Solo trials retain the existing boost-only item rule. Ordinary campaign TNT/Nitro and checkpoints are unchanged.

All race levels suppress checkpoints, including saved/editor copies. The six stadium checkpoint components and their old collection logic are removed; dynamic supported-position recovery and finish gates remain. The published editor snapshot is synced.

Validation: focused real-runtime tests cover both vehicles, pickups, full slots, respawn, all-position odds, TNT timing, Nitro contact and airborne evasion, shields, chain reactions, shell interception, horn clearing, restart cleanup, solo trials and campaign isolation. Shared item/counterplay/time-trial/effect checks, pickup support, both skate finish flows, source sync and the full level checks pass. The entire eight-kart race finishes with zero falls; the solo run has zero falls and rolls. Chrome lite checks pass on all three races; native 1600×900 and normal 720p full-render reviews check loaded authored geometry, icons, the real item button and damage with no browser/WebGL errors. Production build and release size pass: 998,850,439 / 1,000,000,000 bytes.

Reproduce with the local Vite server and the bundled Node runtime:

```sh
node tools/test-race-explosives.mjs
node tools/test-skate-race-items.mjs
node tools/test-skate-race-counterplay.mjs
node tools/race-explosives-browser.mjs
RACE_FULL=1 node tools/race-explosives-browser.mjs
node tools/bake-race-explosives.mjs
```

Set `PLAYWRIGHT_MODULE` to the installed Playwright package when it is outside normal Node module resolution. `RACE_LEVELS` selects comma-separated level IDs; `RACE_OUTPUT` selects the review output folder. Browser fixtures place racers to make exact item contacts repeatable; the full kart route separately uses the real input pilot.
