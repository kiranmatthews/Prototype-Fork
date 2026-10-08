# Falling platforms and slippery surfaces

Use the ordinary component pipeline for every level, including source-authored
courses. `src/surfaceBehavior.ts` owns the defaults and the `icePlatform` and
`fallAwayPlatform` authoring helpers. `src/surfacePresentation.ts` owns the
shared ice material and falling-platform warning. Do not add per-level player
physics or separately animated decorations.

## Falling platforms

```ts
fallAwayPlatform([0, 2, -30], [4.2, .5, 7], { shake: 1.05 })
// Equivalent: { t: 'crumble', p: [0, 2, -30], s: [4.2, .5, 7],
//               shake: 1.05, speed: 30, tex: 'bridge-timber' }
```

`p` is the **top centre**; `s` is width, thickness, depth. `shake` is the warning
delay in seconds, default **0.85**. `speed` is downward acceleration, default
**30 m/s²**. Existing authored delays and accelerations remain authoritative.
The first supported foot contact starts the timer; staying on the platform
cannot restart it. The platform warns, drops, loses support when falling,
then disappears. Ordinary level/checkpoint respawn restores its exact position,
yaw, warning colour, and complete visual hierarchy.

The cracked bindings and timber dressing are children of the actual support.
Never place static boards over a falling collider. Use `bridge-timber` for the
shallow suspended timber kit, `coast-timber` for piers, or an existing authored
material for another setting. Wooden crumble pads also use the shared worn
timber kit. Side ropes are separate `rope` components with their own snap timer.

Make depth and warning delay agree: a player needs time to land, read the cue,
and launch. Sky Bridge uses 6–7 m decks, 0.95–1.1 second warnings, and 1.5–3 m
gaps. The two old instant-drop, 2 m targets are no longer the template.

## Slippery ground

```ts
icePlatform([0, 0, -27], [4.6, .8, 14])
// The helper accepts TOP centre, writes a centre-based platform, clips the
// corners, and supplies slip:true, iceGrip:.12, tex:'ice'.
```

`slip: true` enables the shared momentum model. It works on `platform`, `mesh`,
`ramp`, `terrain`, `vertramp`, `crumble`, and `mover`. `iceGrip` is the fraction
of normal traction, **0.02–1**, default **0.12**. Both axes of running momentum
survive release and counter-steering. Board steering, braking, drive, and
rollout use the same grip value. Existing explicit grip values, including
Blockworks' 0.08, are preserved. Dry ground retains its movement tuning.

Traction is explicit, independent of texture. Use `tex:'ice'` for polished,
frost-rimmed ice with fine fractures and cloudy inclusions. A slippery component
without an explicit texture also receives this appearance. A different authored
texture can retain another slippery material, such as The Descent's oil.
Painting ice alone does not enable slippery physics. The inspector exposes the
same slippery switch and optional custom grip on every supported ground type.

Give ice a real run-in, enough length to experience carry, and a dry recovery
landing. Sky Bridge's 14–16 m ice slabs replace its isolated 2 m blue planks.
Surface boundaries on slippery ground do not generate hidden grind rails.

## Validation and publication

Run `npm run check:surfaces`, `npm run check:levels`, and `npm run build`.
Use `node tools/sync-sky-bridge.mjs --write` after changing Sky Bridge; without
`--write` it checks the published pack against the source. The browser review
uses real gameplay input and separately tests collapse, checkpoint respawn,
sliding, and the full renderer. Source restoration upgrades only the exact
previously published Sky Bridge snapshot; modified local copies remain intact.
