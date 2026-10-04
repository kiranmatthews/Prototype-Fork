# Character spin smear lab

Open `spin-lab.html`, or use **M → SPIN → Open smear lab** in the game.
The three previews show the current Character Lab design, the editable draft,
and the baked model used during spin. Drag to orbit, or select Front, Side or Top.

Radial smear, height twist, radial stretch, height, waist flare, distortion and
falloff deform the character's actual surfaces. **Blur copies** duplicates the
entire distorted model around the same vertical axis. **Blur angular spread**
sets their rotated trail, and **Blur trail opacity** controls the translucent,
fading overlap. Copies occupy and clip through the same 3D volume. The default
is seven copies across 180°. Setting copies to one leaves the distorted surface
alone. Trails merge by body part so increasing copy count does not multiply
draw calls.

**Bake updated model** freezes the result, including the current textures,
skinned hands, morphs and reflected surfaces, into a self-contained GLB. Draft
edits do not replace it until Bake is pressed. The stored bake updates open game
tabs, survives reloads on this device, and rotates as a fixed sculpture during
on-foot spin. It has no skeleton, vertex animation or whole-body scale pulse.
Grounded skateboard rings and airborne board-spin routing keep their existing
behavior.

**Reload character** reads the latest saved Character Lab proportions and head
style. **Download baked GLB** exports the model currently used by gameplay.
Ring tuning remains available from the lab's Ring tuning button. Reduced motion
starts with the spin preview paused.

Bakes use the fork-owned `solProtoSpinSmear.v1` IndexedDB store. Local-data reset
backs up and clears that binary; Undo restores it exactly. If storage is blocked,
the lab reports that the bake is limited to the current session and offers the
download. Before the first saved bake, gameplay generates the default smear and
overlapping copies from the current character. The retired Whirlwind Vixen model
and texture are no longer loaded or preloaded by the game or review pages.

Validation: `tools/test-spin-smear.mjs` covers static surface capture, mirrored
triangle winding, deterministic deformation, overlapping merged copies and
resource ownership. `tools/test-spin-effects-port.mjs` covers existing ring
settings and latched routes. `tools/test-bonus-spin-browser.mjs` checks real
baking, open-game replacement, static exported geometry/textures, persistence,
reset/undo, phone authoring, real lite/full spin inputs, bonus death/respawn and
seven home-menu layouts with a clean console.
