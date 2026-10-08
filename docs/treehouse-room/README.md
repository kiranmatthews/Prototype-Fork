# Inside Your Room

Open `/?playtest&level=inside-your-room` (add `&lite` for a fast check), or choose **Inside Your Room** in the development MENU. This is a separate source-owned scene; the existing Treehouse Trail and Geometry Lab are preserved.

`src/levels/treehouse-room.ts` builds the explorable timber room with the existing mesh, wall, checkpoint, gate and camera components. It contains five windows, an enclosed pitched roof, a living tree, daybed, repair bench, rug, black CRT, console/controller, three wall decks, two complete boards, spare wheels/trucks, helmet, skate shoes, zines and tapes. The exit and checkpoint sit in the hall behind the opening view. Movement tuning is unchanged.

## Swap a poster

The artwork is **not baked into a room atlas**. Replace one of these files with a new WebP, retaining its filename, then reload:

- `public/treehouse-room/posters/coast.webp`
- `public/treehouse-room/posters/canopy.webp`
- `public/treehouse-room/posters/orbit.webp`

Portrait 2:3 artwork is the default. Every poster uses its complete 0–1 UV rectangle. `ROOM_POSTERS` in `src/levels/treehouse-room-art.ts` holds each wall slot's texture, position, width, height, yaw and tilt. Change the texture key there to change just that slot; two slots initially share the canopy print. Paper tape is separate geometry. Add another source-owned `ROOM_ART` entry to introduce a new image; the texture picker automatically includes it. Set width/height to the new image aspect to avoid stretching. The same print textures also decorate the spare skate decks.

In the editor, the `posters` group contains the individually named poster planes. The window mattes are in `windows`, furniture in `furniture`, and boards in `skate`. Source assets are copied into every production build and included in its offline manifest. A locally edited room can override source updates; use PROJECT → restore original before judging a new source revision.

Image replacement and source iteration do not consume browser level-pack storage. To save a complete geometry copy in the editor, use a project with room in its pack: the existing shared snapshot is already close to the engine's 16 MiB cap. The room's own editor JSON is approximately 2.1 MB, with approximately 40,000 indexed vertices; the browser test validates its roundtrip in an isolated empty editor project.

## Window depth

Each of the three windowed facades has three independent image planes, facing its openings:

| Layer | Distance beyond wall | Image |
| --- | ---: | --- |
| Near balcony balustrade | 1.8 m | `public/treehouse-room/mattes/balustrade.webp` |
| Middle jungle canopy | 9 m | `public/treehouse-room/mattes/jungle.webp` |
| Far shoreline and sky | 28 m | `public/treehouse-room/mattes/shore.webp` |

Near and middle images retain ImageGen's real alpha; alpha testing leaves the far layers visible through gaps. All three use unlit materials so the painted daylight survives the interior lighting. Physical spacing produces parallax as the room camera follows the player. These are scenery only; the window walls retain solid collision.

## Art direction and review

The built-in **image_gen** tool produced the room concept and nine runtime images: three poster prints, timber, bark, woven rug, shoreline, jungle canopy and balustrade. `concept.jpg` is the visual direction; `imagegen-prompts.json` records every prompt and final asset path. The runtime translates that direction into the existing stylized game renderer rather than using the concept as a flat background.

Run `tools/test-treehouse-room-browser.mjs` against dev, production preview or Pages. It uses native keyboard input and isolated saves to check decoded textures, alpha mattes, editor roundtrip, supported spawn, jumping, cabinet/window collision, the checkpoint, kill-plane respawn and the actual finish pad in lite and full rendering. `PLAYWRIGHT_MODULE` can identify a bundled installation; `ROOM_REVIEW_OUT` selects the evidence directory.
