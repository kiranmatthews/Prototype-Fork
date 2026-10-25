# Crumblewake Cave

Source: `src/levels/cave-collapse.ts`, exposed by `src/levels/codex-lab.ts` and registered as `cave-collapse`. Haunted Hassle already occupies the historical lab entry, so this brief has its own menu entry without replacing that published course.

The entry runs right across a cave shelf. At the open skylight, spin the checkpoint, then run down toward the camera. Three broken causeways lead to the daylight terrace and finish gate. The camera's input heading remains stable across the clearing; the presentation cannot reverse a held direction. Movement tuning is unchanged.

## Collapse authoring

`CustomLevelData.caveCollapse` contains a polyline, seed, interior width/height, section spacing, advance speed, trigger distance, head start and warning time. Distances are metres along the polyline. The native level importer validates the profile and preserves it through capture/export/import.

Each sampled cross-section contains nine seeded rock blocks. Two instanced batches render the arch/fragments and bounded dust. No dynamic rigid bodies, per-impact mesh allocation, external generated assets or growing debris list are required.

The progression is waiting → warning → chasing → escaped. Entering the start of the tunnel from its supported clearing gives a 1.8-second warning. A monotonic fracture front travels down the path. Bounded catch-up makes a fast runner's collapse remain visible, while its positive minimum speed means stopping or retreating is eventually fatal. It never teleports or rewinds.

Each section gets its own warning clock. Individual blocks shake, stagger their release from a seeded delay, fall under an analytic gravity curve and move inward. Their rotation and finite rebound settle into permanent rubble. Swept fragment bounds provide lethal crush contact, including while jumping, grinding or hanging. There is no invisible moving kill plane. The same rocks supply the intact ceiling, the falling mass and the rubble.

Reaching the mouth stops new fractures and lets existing ones settle. Death, restart, checkpoint warps and level disposal restore or release all owned state. Checkpoint retries retain the same seed and a fair head start. The editor's ordinary ground and wall primitives retain collision and default grindable edges.

## Checks

- `npm run check:cave-collapse`: state/lifecycle tests plus a production-player input-only course run, collision catch, checkpoint retry and pit recovery.
- `npm run check:levels` and `npm run build`: normal repository validation and production packaging.
- Real Chrome lite/full gameplay: debug-menu selection, actual keyboard movement, route, camera composition, falling fragments and console errors.

The shared toolkit cannot express a directed, independently fractured tunnel with existing contact-triggered `crumble` floor pads. Runtime changes therefore add one optional level-owned controller and the fatal-contact hook; the floor, obstacles, camera volumes, checkpoint and gate remain ordinary level data.
