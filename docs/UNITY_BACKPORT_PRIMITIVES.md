# Unity backport gameplay primitives

These components are authored through the same `CustomComponent` data used by
the in-browser level editor. They can be placed from **ADD → HAZARDS & THINGS**;
wood paths can also be drawn with the pen tool.

## Systemic grindable edges

Ordinary solid surface boundaries are grind candidates by default, matching
Unity commits `7592cc7` and `12493a2`. Boxes expose all four transformed top
edges. Mesh surfaces weld coincident split vertices to 0.1 mm, retain
sufficiently horizontal triangles, and expose only their outer topological
boundaries. These generated paths are grind-catch geometry only: the original
surface remains the sole collision body, so an edge never becomes a duplicate
physical bar.

Smooth mesh-boundary segments join into continuous grind paths, retaining all
boundary vertices. Triangle tessellation must not make a curved platform end
the grind at each small segment. Sharp corners and ambiguous junctions still
split paths. Slippery traction and ice materials do not disable grind edges;
the ice authoring helper preserves an explicit `edgeGrinding` choice.

Set `"edgeGrinding": false` on a platform, ramp, wall, terrain, rock, metal
block, or other eligible static surface to opt out. The editor exposes the same
setting as **grindable edges**. Explicit rails, coping, crate-top runs and
boardwalk handrails are independent and remain available when surface edges
are disabled. Moving decks, fallaway pads, phase pads, deployed spin bridges,
switch-created decks and boardwalks now retain the same default. Their derived
paths follow their real transforms and become unavailable whenever the floor
is unavailable. Grinding a fallaway pad starts its ordinary warning/drop clock.
True vert transitions keep their own coping policy. Continuous shore/seabed
shelves, scenery, hidden containment and deliberately buried support remain
explicit exceptions.

Level-building helpers for ordinary platforms, roads and ramps must retain
the default. Reserve opt-outs for individual authored exceptions, such as
Blockworks' lethal ground underlay, hidden side colliders and deliberately
rail-free vert vault. Switch-built surfaces are grindable after activation.

Sculpted `mesh` decks can identify their real cap with `grindTopTriangles`, a
bounded count of leading triangles. The generator uses that cap's union and
retains its height samples; decorative lower strata do not become grind lines.
This metadata survives acceleration, capture and editor reconstruction.
Nightworks' fitted rocks use their existing baked flat cap directly.

See `EDGE_GRINDING_AUDIT.md` for the cross-course audit and retained exceptions.

## Trampoline pad

```json
{
  "t": "trampoline",
  "p": [0, 0.45, -20],
  "s": [5, 0.45, 5],
  "speed": 16,
  "amp": 1.25
}
```

`p` is the top centre. Landing launches at `speed`; holding Jump on the impact
tick multiplies the launch by `amp`.

## Speed pad

```json
{
  "t": "speedpad",
  "p": [0, 0.3, -40],
  "s": [4, 0.3, 5],
  "speed": 48,
  "cycle": 3.9
}
```

A grounded board entering the pad is raised to at least `speed` and receives a
temporary over-speed hold for `cycle` seconds. Remaining on one pad does not
retrigger it every tick.

## Trick gate

```json
{
  "t": "trickgate",
  "p": [0, 3, -70],
  "s": [12, 8, 0.6],
  "yaw": 0,
  "radius": 2.2,
  "trick": "kick"
}
```

The valid trick keys and board-air inputs are:

- `kick`: Kickflip — neutral + Square / F
- `heel`: Heelflip — left only + Square / F
- `shove`: Pop Shove-It — right only + Square / F
- `imposs`: Impossible — forward + Square / F
- `varial`: Varial Flip — back + Square / F

Forward/back takes priority over sideways input, so release the vertical axis
before asking for Heelflip or Pop Shove-It.

Starting the required deck trick during the current board air opens the gate
when crossed. The membrane displays the requirement and a rejected crossing
repeats it on the HUD. A closed crossing rebounds/wipes out; an opened gate
remains open until the level resets.

## Trick rail

```json
{
  "t": "trickrail",
  "p": [0, 1, -95],
  "len": 18,
  "yaw": 0,
  "trick": "heel"
}
```

It accepts the same straight or multi-node path fields as `rail`. The rail is a
translucent ghost until its trick has been started in the active combo, then it
becomes visible and grindable. Banking, bailing, dying, or resetting closes it.

## Return portal

```json
{
  "t": "returnportal",
  "p": [0, 0, -130],
  "s": [3, 4, 1.2],
  "to": [12, 0.1, -20],
  "exitYaw": 90,
  "airOnly": true
}
```

The entrance is a swept trigger volume. `to` is the destination feet point and
`exitYaw` establishes the outgoing heading. `airOnly` is useful for recovery
portals beneath a jump or bonus route.

## Procedural wood and bamboo path

```json
{
  "t": "woodpath",
  "p": [0, 0, 0],
  "w": 6,
  "curve": "spline",
  "pts": [
    [0, 0, 0, 0, 0],
    [2, -12, 0, 1, 3],
    [-1, -24, 0, 2.5, -3],
    [0, -36, 0, 3, 0]
  ],
  "widths": [6, 6.5, 5.5, 6],
  "structureStyle": "light",
  "plankPalette": "rustic-planks",
  "polePalette": "rustic-timber-rope",
  "spacing": 0.55,
  "baySpacing": 4.5,
  "scaffold": true,
  "supports": true,
  "rails": true,
  "supportDepth": 3,
  "terrainSupports": true
}
```

Nodes are `[dx, dz, reserved, dy, bankDegrees]` relative to `p`.
`widths` follows the node list. One closed swept mesh is the gameplay surface,
but it is collision-only: the fitted plank pieces own all visible deck pixels.
This avoids both wheel-catching collision seams and coplanar deck/plank shimmer.

`structureStyle` selects the measured construction profile. `light` is the
Unity light-boardwalk default; `island` and `beach` retain each source level's
deck and plank dimensions. The shared layout kernel emits semantic envelopes
for every plank and every member under and beside it (support post, crossbeam,
stringer, ledger, girt, brace, knee brace, footing, lashing, handrail post and
top-rail segment). Three original Meshy planks, three weathered timbers (a
hewn beam, a round log and a squared timber with a split in it) and three
twisted/braided rope lengths are fitted into those envelopes. Weighted
selection uses the authored path seed; boards can turn end-for-end and the
light scaffold's beams rotate about their length. Timber owns the structure and
the handrail posts; rope owns the top rails; a lashing is a small coil of rope
built in code (184 triangles, in the kit's own rope colour), not a tenth Meshy
member. All nine meshes share a local 1024px clay-painted atlas, with sampled
vertex paint available while it loads. Instances are grouped by model and 24 m
path section for frustum culling. `plankPalette` and `polePalette` keep their stable identifiers;
the legacy `placeholder-board`/`placeholder-pole` IDs automatically resolve to
`rustic-planks`/`rustic-timber-rope`, including previously saved editor levels.
The mesh swap changes neither path topology nor collision.

`tools/boardwalk/meshy_jobs.py` uses the repository's official Meshy CLI adapter;
prompts, reviewed references, task IDs and source hashes live beside it. The
three rejected text silhouettes are recorded and excluded from the shipped
kit. `bake_kit.py` applies provider node transforms, fits principal axes and
packs paint into `public/boardwalk/rustic-atlas.webp` plus the native geometry
in `src/boardwalkMeshes.generated.ts`. Authoring GLBs, signed URLs and
credentials remain outside the published assets. `boardwalk-review.html`
shows every variant and the assembled curved scaffold; the focused check is
`node tools/test-wood-path-meshes.mjs`.

### What stands under the deck

Bents stand every 4.5 m (`baySpacing`). What is drawn at each, and between
them, is the **carpentry** (`WOOD_PATH_CARPENTRY` in `src/woodPathKit.ts`):
stout, a little crooked, lashed with rope, and built so that nothing hangs in
the air.

- **The load path.** Planks lie on *stringers*: timbers along the path, one
  under each edge and one in the middle of any deck wider than 3 m between its
  posts (two beyond 7.5 m), lapped side by side over each bent, and laid in two
  or three lengths where a bay humps or turns, each splice bound with rope so
  that a stringer still runs from cap to cap. Stringers lie on the *cap beam*
  of each bent, a log across the path that runs out past the deck on both
  sides. The cap lies on two *posts*. A post stands on a *sleeper* (a short
  log along the path, a third of it in the ground) where the support probe
  found ground, and is a driven *pile* where it fell back to `supportBaseY` or
  `supportDepth`: give a path over water or a pit a base at the water, so its
  piles stand in it.
- **Which timber.** With the rustic palette's three timbers, posts and
  sleepers are always round logs (a lashing sits snug on a log), caps mostly
  logs, stringers mostly squared timbers, and braces, girts and ledgers
  whatever the palette's weights give. A squared timber is set on edge, a few
  degrees out, never at a random twist. A palette of another size is used as
  it is given.
- **Proportions.** A post is 0.17 m in radius plus 12 mm for each metre of deck
  width (0.23 m under a 5 m deck, between 0.19 and 0.28); the cap is 0.88 of
  that, braces and girts 0.55, knee braces 0.58, stringers a half (0.1 m at
  least). A post over 5 m is two logs, over 9.5 m three, over 14 m four,
  butted at a joint and thicker toward the foot.
- **Bracing depends on height.** Under 1.2 m: two stubs and a cap. Up to about
  1.9 m: knee braces, from each post up to its cap and along to the stringer
  each way. Taller: the posts are divided into panels about 3 m high (growing
  to 4.2 m on a very tall trestle; one panel height for the whole path, so
  joints sit level from bent to bent). Across the bent the top panel is
  crossed, one pole on each face of the posts, and each panel under it has one
  pole, leaning the other way each time, over a *girt*. A bent too wide to
  cross (a panel under 0.4 of its width) gets a chevron up to the middle of
  the cap or girt. Along the path every panel has one pole a side, leaning the
  same way on both sides and the other way in the next bay, over a *ledger*.
- **Headroom.** Where the probe found ground, the lowest 2.3 m carry posts
  only, so the way under a boardwalk stays open: a 3.5 m boardwalk on ground
  has knee braces under its deck and nothing lower. Piles are braced down to
  0.4 m above their feet.
- **Joints.** Every joint a pole makes with a post is lashed, and so is the
  head of every post, every splice of a stringer inside a bay and the rail to
  every handrail post. Handrail posts go down past the deck to the end of
  their cap. Every member runs on 0.14 to 0.34 m past its joints and has its
  own small error of thickness, length and line, taken from the path's seed:
  the same path is always built the same way.

None of this is collision. What a body meets is unchanged: the deck, and a
plumb column of the profile's 0.115 m post radius under each end of every
bent, exactly where the light scaffold's posts stood. The validator charges
a path 96 members for each bay and once more for its first bent (it was 32 a
bay): a bent holds at most 47 and a bay at most 38.

`structure: "unity"` on a kit profile keeps the source's light scaffold: two
0.115 m posts and a 0.09 m crossbeam with 0.48 m overhang per bent, left/right
ledgers, alternating side braces and two three-dimensional cross braces
between the 30% and 70% post heights in each bay. Carlisle's timber piers are
still built that way.

Each bent also has two 1.05 m handrail posts. Top rails are visually segmented
no farther than 1.15 m apart; separate dense polylines remain grindable on
both sides. The continuous 1 m balustrade collision is generated independently
at 0.7 m spacing, so presentation poles never become collision authority.

Enable `terrainSupports` to ask the level for ground below the source-authored
probe origin. `supportBaseY` supplies an absolute fallback foot height when a
probe misses; otherwise `supportDepth` supplies a relative fallback. Keeping
the probe, fallback and semantic member layout separate lets an island embed
full-height poles through its shallow sand shelf while another path can stop
posts on terrain. The editor exposes per-node position, height, bank, and
width, plus add/remove, reverse, Straight, Ramp, and Serpentine presets.

The exact source profiles are:

| Value | Light default | Island Hopper | Beachside Run |
| --- | ---: | ---: | ---: |
| Deck thickness | 0.32 | 0.42 | 0.24 |
| Path sample spacing | 0.45 | 0.35 | 0.35 |
| Plank pitch | 0.55 | 0.68 | 0.72 |
| Plank gap | 0.045 | 0.038 | 0.038 |
| Plank thickness | 0.16 | 0.135 | 0.14 |
| Side overhang, per side | 0.16 | 0.10 | 0.09 |
| Maximum yaw jitter | 1.15° | 1.65° | 2.2° |
| Scale jitter | 0.035 | 0.055 | 0.06 |
| Vertical jitter | 0.012 | 0.014 | 0.014 |

All three share the source's 0.115 m post (the solid column), 0.09 m
crossbeam, 0.072 m ledger and 0.055 m brace radii, which size the light
scaffold and the handrail's rope. Layout noise, tonal buckets and weighted
variant choices use the source deterministic unsigned hashes.

Beachside applies that profile once per complete sequence: seven continuous
sixteen-knot paths replace the old 28 independently restarted fragments. This
keeps plank pitch, bents, braces, balustrade collision and both grind rails
continuous across all 21 former holes. Its terrain-support probes explicitly
ignore other wood-path decks, so overlapping authoring can never collapse a
later scaffold onto an earlier one.

## Grindosaurus

```json
{
  "t": "grindosaurus",
  "p": [0, 0, -160],
  "range": 4,
  "speed": 1.5,
  "coverage": 0.65,
  "yaw": 0
}
```

Its body is fatal, while its moving spine is a grind rail. An upright top-side
grind is the only safe contact. Riding at least the configured fraction and
leaving through a rail endpoint defeats it; jumping off early or hanging below
the spine leaves it live.

## Angry Ball

```json
{
  "t": "angryball",
  "p": [0, 0, -190],
  "w": 3,
  "rise": 4.6,
  "radius": 0.8,
  "range": 12,
  "speed": 7,
  "yaw": 0
}
```

The ball wakes inside `range` and chases the player at constant arc speed over
an analytic flat-plus-quarter-pipe cross-section. Pair it with a matching
`vertramp` halfpipe for visible/playable walls. Spin reach, slide, Uber, an
ordinary stomp, or a downward Slam stomp defeats it; ordinary touch is harmful.
An ordinary stomp bounces and re-arms the double jump.

Drawn `vertramp` spines already provide connected oriented pipe sections, so no
second winding-pipe component is needed.
