# Unity backport gameplay primitives

These components are authored through the same `CustomComponent` data used by
the in-browser level editor. They can be placed from **ADD → HAZARDS & THINGS**;
wood paths can also be drawn with the pen tool.

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
  "plankPalette": "placeholder-board",
  "polePalette": "placeholder-pole",
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
for every plank, support post, crossbeam, handrail post, longitudinal ledger,
side brace, midheight cross brace and top-rail segment. Placeholder boards and
seven-sided poles are currently instanced from those envelopes. `plankPalette`
and `polePalette` are stable palette identifiers stored on the batches; a
future weighted textured-mesh palette can fit its own pivots, axes and bounds
into the same envelopes without changing path topology, collision or level
data.

The light scaffold uses 4.5 m nominal bays. Each bent has two posts, an
under-deck crossbeam with 0.48 m overhang and two 1.05 m handrail posts. Each
bay has left/right ledgers, alternating side braces and two genuinely
three-dimensional cross braces between its 30% and 70% post heights. Top rails
are visually segmented no farther than 1.15 m apart; separate dense polylines
remain grindable on both sides. The continuous 1 m balustrade collision is
generated independently at 0.7 m spacing, so presentation poles never become
collision authority.

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

All three share the light scaffold's 0.115 m post, 0.09 m crossbeam,
0.072 m ledger and 0.055 m brace radii. Layout noise, tonal buckets and future
weighted variant choices use the source deterministic unsigned hashes.

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
