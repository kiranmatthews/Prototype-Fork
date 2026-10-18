# Modular golf cart

Open `golf-cart-lab.html` for the garage and five-cart playground. The Labs directory links to it. Country Club runs ten autonomous carts at twice the normal linear size, including their wheels, seated drivers and collision footprints. They pursue all eight racers, catch up on straights, sweep across their lines and hop the water carries. Spinning knocks carts away; hard rider contacts use the shared race knockdown, shield and recovery rules. The garage remains the five-cart playground.

## Look and assets

The revised Crash 4-inspired direction uses smooth rounded accessory shapes and an expressive captain head. The chassis, nose, bumpers and seats remain procedural and recognisably boxy, as requested, retaining their damage groups. The built-in imagegen tool produced [the revised concept](concept-crash4-v2.webp) with [this exact prompt](concept-crash4-v2-prompt.txt); isolated component references and prompts live in `tools/golf-cart/references/`.

Meshy generated the wheel, bowed canopy, fabric bag and captain head. Their actual surfaces are fitted to the existing sockets, given smooth welded normals and baked into shared buffers in `sculpted-data.ts`. Texture atlases are 256×256 (128×128 for the canopy), embedded synchronously with no external model/texture requests. Roof and bag materials retain independent palette controls. The bag's neutral paint and fixed details share the same source atlas. Driver motion still uses the existing independently deforming segments and planted hands/feet.

The ledger in `tools/golf-cart/meshy-tasks.json` records **75 credits**: 60 for the four installed components, plus 15 for a completed body study retained only as reference after the user's direction changed. No further Meshy jobs are needed. Source task IDs, GLB hashes, fitted bounds and triangle counts are in `meshy-provenance.json`. Original GLBs and full-resolution PNG references remain local; compact WebP reference copies are versioned.

`public/golf-cart/` contains an empty modular cart, a complete cart with driver, and the separate captain, groundskeeper and robot drivers. All are GLB, in metres, facing -Z with Y up. The driver origin is the seated hip. Attach a replacement at `DriverSocket`, whose cart-local position is `[-0.33, 1.035, 0.32]`. The supplied drivers use named rigid segments; they are not humanoid skinned rigs or baked animation clips. Runtime articulation lives in `driver.ts`.

The empty cart is about 579 KB, the cart with captain about 810 KB. `manifest.json` records byte counts and hashes. Run `node tools/golf-cart/export.mjs` with `@napi-rs/canvas` available, or set `GOLF_CART_CANVAS_MODULE` to that package entry point, to reproduce textured exports. This canvas dependency is authoring-only. `bake_meshy.py` runs in Blender against the locally retained raw GLBs to reproduce the fitted runtime buffers. The garage's Save GLB button exports the currently selected cart, colours, driver and visible modules. Save colours downloads its JSON recipe.

## Reuse

```ts
const kit = new GolfCartKit();
const drivers = new GolfDriverKit();
const cart = kit.create(CART_PALETTES[0]);
cart.setPalette({paint: '#f15c50', seat: '#ffd793'});
cart.setDriver(drivers.create('groundskeeper'));
cart.setModule('roof', false);
scene.add(cart.root);
```

`GolfCartFleet` owns a kit, five independent material palettes, driver resources, instanced visual parts, and one physics world. Use it when placing several carts. Shared chassis, panels and all twenty wheels are drawn through 20 instanced batches; driver segments add 35 draws. The default five-cart fleet totals **39,732 triangles and 55 draw calls before shadow passes**. The captain cart is 8,086 triangles. Rendering metrics in the garage also include course scenery and visible effects.

The model's named modules are nose, front bumper, rear bumper, roof, cargo, wheels and driver socket. `setDriver()` detaches and returns the old driver; its caller owns disposal. Per-cart disposal never disposes shared kit geometry. Dispose all instances before their kit. The fleet handles that lifetime automatically. Driver torso compression and rebound use the shared editable character elasticity profiles; arms solve to the steering grips, and legs stay planted.

## Driving and damage

- W/S or arrows: throttle, brake, reverse. A/D: steer. Space: handbrake drift. Shift: spring hop. R: repair/reset. Tab: switch cart. Touch controls include a Hop button.
- Watch all five enables all AI controllers. Crash test produces an actual frontal impact. Roll test supplies a hard side impulse to the normal solver.
- 120 Hz fixed simulation, bounded catch-up, rounded two-circle chassis contacts, angular collision impulses, terrain support, suspended body lean, visible wheel steering/spin, bounded impact chips and local panel damage.
- Bump crests preserve upward speed and exaggerate launch. Hops clear roughly 1.2 m from rest and more at speed. Hard landings rebound; normal hops do not wear out the cart.
- Rollover requires a hard sideways impact or a fast, badly banked landing. It never occurs randomly during ordinary grounded cornering. The whole cart, wheels and driver rotate. A grounded support envelope keeps the canopy out of the floor; a delayed spring returns an overturned cart upright within five seconds.
- Damage crumples the nose, sags the bumpers, twists the canopy and loosens cargo. Severe damage reduces engine speed moderately. Leaving safe terrain returns the cart to its authored spawn while preserving damage.

This is an arcade vehicle solver with planar chassis contacts, vertical flight and a controlled rollover degree of freedom. It does not simulate detached rigid bodies or arbitrary convex vehicle/environment meshes. Course obstacle proxies and ground sampling are supplied by the host. Existing player movement tuning is untouched.

## Validation

Run `npm run check:golf-cart` and `npm run build`; run `npm run check:levels` when changing level data. No full suite is required. `validation.json` records:

- exact trajectory agreement at 30, 60 and 144 render Hz;
- braking, reverse, barrel impact, two-cart collision and initially overlapping carts;
- spring hop height, ramp launch, harmless landing, rare side-impact roll and finite recovery;
- no random roll during ordinary fast cornering;
- five garage AI carts driving for a simulated minute; ten oversized Country Club carts joining the passing race, sustained pursuit over kilometres, bounded water-crossing recovery, and larger physical bumper contacts;
- independent body/roof/bag recolouring, driver swaps, component visibility, shared geometry/textures, finite unit normals, complete UVs, triangle budget and idempotent resource disposal.

Browser review covers the real garage, five-cart watch mode, colour/driver/canopy swaps, collision damage, rollover recovery, GLB download, and the production Country Club integration. Screenshots and release details accompany the iteration log.

## Country Club pursuit

The course fleet uses the existing geometry in 20 shared batches: **79,168 triangles, 90 draws before shadows**, with ten carts and three rotating driver styles. Scale, tyre probes, chassis contacts, wheel spin and rollover support agree at 2×. The Meshy accessories are embedded locally; no model or texture requests are needed.

`pursuit.ts` steers against the actual shared racing line. Two carts favour the human; the others engage nearby racers, with staggered preferences. They accelerate to catch the pack, brake for curvature, sweep their lanes gradually and line up before water jumps. Their own engine profile can reach the race's boosted speeds; player tuning is unchanged. Course carts stay planted over small road crests, while deliberate hops and impact rolls remain physical.

Traffic waits during countdown, resets damage/positions on race and trial restarts, and ignores finished riders. Hits respect shields, stars, existing knockdown grace and a 2.8-second cart contact cooldown. Jump approaches and landings allow light bumps without starting another knockdown. Spins damage and shove the carts away. Off-course carts recover to their last supported local anchor.

Reproduce the complete eight-rider test with `RACE_CARTS=1 RACE_ALL_FINISH=1 RACE_FRAMES=24000 node tools/test-country-club-race.mjs`. `tools/golf-cart/course-contact.mjs` checks real rival contacts, shield absorption, spin retaliation, roof clearance, countdown and solo restart. `RACE_CARTS=1 node tools/country-club-race-browser.mjs <local-url>` validates the full-render game loop. Set `PLAYWRIGHT_MODULE` when using the bundled browser runtime. Compact results are in `country-club-pursuit.json`; screenshots stay local under the temporary network policy.

## Local preview

The combined Country Club preview is `http://127.0.0.1:5263/?playtest&level=country-club`; its garage is `http://127.0.0.1:5263/golf-cart-lab.html`. All changes remain local under the temporary slow-network policy. Source Meshy art commit: `09f89518`; ten-cart pursuit commit: `c2292052`.
