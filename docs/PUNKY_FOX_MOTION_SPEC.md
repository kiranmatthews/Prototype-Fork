# Punky Fox motion specification

This document translates public Crash Bandicoot 4 and Tony Hawk's Pro Skater
3 + 4 presentation evidence into an original, simulation-driven animation
brief for this prototype. It is not a request to copy proprietary clips,
curves, skeletons, or game assets.

## Primary evidence

| Source | Time | Motion evidence used |
| --- | ---: | --- |
| [Toys for Bob: The Art and Animation of Crash Bandicoot 4](https://www.youtube.com/watch?v=FwjW10ADGnE) | 09:53 | “Jackass meets Looney Tunes” tone: physical consequence plus readable cartoon staging. |
| Same GDC/Toys for Bob talk | 13:13–13:49 | Rigs designed for Tex-Avery-like deformation, extreme movement, and simulated motion blur. |
| Same GDC/Toys for Bob talk | 15:00–15:30 | Precise execution; jump, spin, slide, and slam must feel immediately satisfying. |
| [Official Crash 4 Coco gameplay](https://www.youtube.com/watch?v=WCJZwqQ6Nls) | 15.1–17.0 | Run cycle about 0.75–0.80 s, fast input transitions, ponytail/ear follow-through. |
| [Official THPS 3 + 4 reveal trailer](https://www.youtube.com/watch?v=D-PedsiljOc) | 00:00–00:02.6 | Push beat into pop, compact apex, square landing. |
| Same reveal trailer | 00:05.4–00:06.9 | Sustained low charge/cruise posture. |
| Same reveal trailer | 00:14.8–00:16.4 | Inverted grab: compact legs, contacting hand, free-arm silhouette. |
| Same reveal trailer | 00:20.5–00:22.4 | Grind loop: stable pelvis, flexed knees, arms carrying balance. |
| Same reveal trailer | 00:26.2–00:30.5 | Vert expansion, compact spin, reopen/spot, then rail balance. |
| [Official THPS 3 + 4 launch trailer](https://www.youtube.com/watch?v=_wZXzuCNSBw) | 00:33.7–00:35.9 | Crouch, pop, rail lock, balance, exit ollie. |
| Same launch trailer | 00:43.8–00:44.7 | Deep moving charge stance. |
| Same launch trailer | 00:46.5–00:49.7 | Wallride board alignment, world-readable torso/head, air exit. |
| Same launch trailer | 01:14.1–01:16.3 | Long rail balance into compact exit and landing. |

Additional Crash evidence:

- [Official narrated gameplay trailer](https://www.youtube.com/watch?v=kUqpCChW39U):
  run/jump/spin changes at 00:06.5–00:12, dense traversal at
  00:32.5–00:39.5, and a rail posture at 00:40–00:44.
- [Official demo trailer](https://www.youtube.com/watch?v=dNWs5R6_r-g):
  elongated chase silhouettes at 00:02.5–00:05 and landing punctuation at
  00:23.2–00:24.8.
- [Official Crash highlight](https://www.youtube.com/watch?v=ucq3hrDy8IU):
  fall/flatten/recovery at 00:00–00:05.5 and tumble overlap at
  00:18.2–00:20.5.
- [Activision hands-on](https://blog.activision.com/crash-bandicoot/2020-07/Crash-Bandicoot-4-Hands-On)
  and [PlayStation hands-on](https://blog.playstation.com/2020/08/14/exploring-the-familiar-yet-evolved-platforming-of-crash-bandicoot-4-its-about-time/)
  confirm the core movement vocabulary, air correction, precision landing,
  idle acting, fur motion, and cartoon failure reactions.

Trailer timings are presentation observations, not extracted proprietary clip
lengths. Editorial cuts and slow motion make relative pose order more useful
than absolute duration.

## Motion ownership

Physics owns player position, velocity, surface contact, facing, board
alignment, rail progress, wallride plane, spin angle, and success/failure. The
animation system explains those facts; it never delays or overrides them.

Priority, highest first:

1. death/bail;
2. hang/rope;
3. grind, under-rail, lip, and wallride;
4. air base plus flip/grab/live spin;
5. manual/nose-manual;
6. skate cruise, push, charge, and foot locomotion;
7. additive ears, ponytails, tail, loose-trouser response, head aim, and
   impact reaction.

Any higher state can interrupt a lower state within two 60 Hz simulation
frames. There is no root motion in a shipped clip.

## Embedded clip library

| Clip | Intended role | Duration policy | Runtime treatment |
| --- | --- | --- | --- |
| `idle` | breathing/personality base | loop | Long enough to read; procedural head/ear micro-reaction may sit above it. |
| `walk` | low-speed on-foot locomotion | loop | Speed-scaled and phased from authoritative travel. |
| `run` | Crash-like on-foot locomotion | loop, about 0.77 s | Matches the observed 0.75–0.80 s cadence without copying curves. |
| `jump` | squash/stretch airborne body base | one-shot | Time follows actual airtime; gameplay owns launch and landing. |
| `spin` | shoulder/arm follow-through | one-shot | Gameplay yaw and smear stay live/procedural. |
| `slide` | low silhouette | held/cropped one-shot | Simulation owns slide distance and collision. |
| `crawl` | crawl base | loop | Speed-scaled; route/collision remains authoritative. |
| `fall` | prolonged airborne/failure base | loop | Direction and velocity come from the simulation. |
| `bail` | tumble/recovery source | one-shot | Seeded by failure direction; board detaches procedurally. |
| `death` | terminal failure gag | one-shot | Allows a longer readable hold than an interactive move. |

All clips are sampled at 30 Hz and interpolated by Three.js. The controller is
frame-rate independent at 30, 60, and 120 Hz.

## Crash-style interactive motion

- Input anticipation is effectively zero. Jump, spin, slide, and slam begin on
  the input frame; pose readability is produced during the move, not by making
  the player wait.
- A fast run uses a 0.75–0.80 s body loop (2.5–2.7 footfalls/s). Speed changes
  phase/time-scale the loop without changing physics velocity.
- Launch uses a fast leg extension and arm throw. The rising body expands,
  compacts near the apex, and reopens before contact.
- Spin uses authoritative yaw plus an original shoulder/head counter-twist and
  the existing procedural smear. The baked clip supplies follow-through only.
- Landings distinguish clean, heavy, sketchy, and bail outcomes. The clean
  response compresses for 0.08–0.12 s and recovers over 0.18–0.28 s; heavy
  landings deepen the squat, while sketchy landings retain the existing
  balance shimmy.
- Longer anticipation and held poses are reserved for idles, landing
  punctuation, and death/failure gags where they cannot make controls feel
  slow.
- Ear, ponytail, and tail response trails root acceleration and angular
  velocity. Secondary motion never leads the body or hides the face.

### 60 Hz targets

| State | Target |
| --- | --- |
| Idle base | 120–180 frame breathing loop; root travel stays within 1–2% of height. Fidgets begin after 6–9 s, repeat every 8–14 s, and abort within two frames. |
| Run start | Physics accelerates immediately; visual lean reaches its full 8–15° over 6–10 frames. |
| Run stop/turn | Two-to-four-frame torso dip, 6–10 frame recovery, then 3–6 frames of ear/hair overshoot. |
| Jump takeoff | One-to-two-frame 6–10% squash followed by 2–4 frames of 4–8% stretch; root impulse is still frame zero. |
| Double jump | New impulse in zero-to-one frame, 3–6 frame reversal/burst silhouette, no copied wind-up. |
| Soft landing | Contact matches collision within one frame; 2–3 frame compression, 6–10 frame cancelable recovery. |
| Hard landing | 12–18% compression, 4–6 frame impact hold, 10–18 frame recovery with later accessory settling. |
| Spin | Radial smear readable by frame 3–4; active 18–28 frames; exit 4–7 frames. |
| Slide | Hip drop in 2–4 frames, 25–40° torso line, exit/cancel over 4–8 frames. |
| Hang/rope catch | Immediate latch; 3–5 frame shoulder stretch; 8–12 frame settle; 0.8–1.2 s leg pendulum. |
| Hit | Reaction begins in 0–1 frame, reaches recoil extreme by frame 3–5, settles over 12–20 frames. |
| Death gag | 45–120 frames with one original impossible transformation and a readable 6–12 frame hold. |

Original personality fidgets should come from this character's costume rather
than another character's signature routine: check the watch, tighten a
drawcord, scuff a sneaker, adjust the bracelet, inspect a cargo zip, or shake
out a ponytail.

## THPS-style board motion

| State | Original timing/pose requirement |
| --- | --- |
| Push | 0.45–0.55 s one-shot. Rear foot leaves around 10%, contacts near 25%, drives through 50%, recovers by 85%, and replants at 100%. Mirror for switch stance. |
| Cruise | 0.9–1.3 s subtle loop. Knees 15–25° flexed, hips over deck centre, head down-course, restrained arms. Carve/terrain lean is additive. |
| Charge | Enter over 0.14–0.18 s, then deepen over the existing 0.4 s charge. Hips drop about 12–18% of body height; knees flex 30–50°; arms sweep back. Release begins within one or two frames. |
| Ollie | Normalize to actual airtime: 0–10% pop; 10–25% rise/level; 25–65% compact trick window; 65–85% reopen; final 15% square board and feet. |
| Grab | Enter/exit over 0.12–0.15 s. The selected hand must reach its deck socket; the free arm opens the silhouette. Release completes before touchdown. |
| Spin | Board/root yaw follows the live simulation. Shoulder/head lead is only 50–80 ms; the head spots and the feet square in the final 10–15%. |
| Grind | Preserve the 0.12 s rail snap. Pelvis moves least, torso moderately, arms most. Balance continuously drives asymmetric shoulders/arms and smaller board roll. Style changes blend over 0.10–0.16 s. |
| Manual | Board pitches about 12–18°. Hips shift 10–18% of deck length over the active truck, support knee flexes, opposite leg lengthens, torso counter-pitches, and arms trail balance by 40–80 ms. |
| Vert | Compress in the final 0.10–0.15 s before the lip, expand on launch, compact through trick/apex, then reopen and align to the returning transition. Head spots first. |
| Wallride | Enter in about 0.12 s. Board remains wall-aligned; knees tuck; contact-side arm is lower/forward; outside arm high/back; head remains near world-up. Wallie exit extends away over 0.08–0.12 s. |
| Revert | Visible board/pelvis pivot over 0.24–0.30 s; never an instantaneous whole-character yaw snap. |
| Bail | Choose cause-specific forward, backward, side-rail, or off-axis failure. Board detaches after 0.06–0.12 s while momentum remains continuous. |

## Secondary-motion envelope

The runtime springs cap ponytail roots at 0.30 rad, ponytail tips at 0.42 rad,
and ears at 0.13 rad. A separate deformation test deliberately exceeds these
values; the shipped envelope stays below the range where the stylized ear and
hair surfaces begin to fold. Teleports, respawns, and model swaps clear spring
velocity history.

## Acceptance tests

- Soles stay visually planted on the deck through cruise, charge, ollie,
  manual, and every grind style.
- Regular and switch stance produce mirrored mechanics without negative bone
  scale.
- The grab hand reaches the intended board side and releases before landing.
- Grind/manual balance motion points in the same direction as the HUD needle.
- Manual weight visibly moves over the active truck rather than pitching the
  whole character as one rigid object.
- Clean, heavy, sketchy, and bail outcomes read distinctly from front, 40°,
  90°, and gameplay camera views.
- Wallride wheels face the wall while the torso/head remain readable.
- Vert ascent, lip crossing, and drop-in do not visibly snap surface alignment.
- Hair, ears, tail, hands, knees, elbows, and trousers show no UV-seam tear,
  implosion, or body penetration at the shipped motion limits.
- State transitions and secondary springs remain stable at 30/60/120 fps.
- No reference-game asset, motion curve, animation file, or skeleton is present
  in the repository.
