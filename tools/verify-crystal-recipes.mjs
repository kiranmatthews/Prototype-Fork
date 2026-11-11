// Plays the crystal-challenge recipes from docs/THPS_DESIGN_BIBLE.md (Part XIV) with the real Player
// and real inputs, and reports whether the intended route collects the crystal and whether the
// shortcuts it is meant to rule out fail. Each recipe is a small throwaway level (one crystal per
// level); nothing in the game's levels or tuning is changed, except that the grind balance drift is
// switched off for the rail recipes (the balance needle is a separate skill; see bible XI.5).
//
//   node tools/verify-crystal-recipes.mjs [out.json]
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const out = process.argv[2];
const DEG = Math.PI / 180;
const r2 = v => (Number.isFinite(v) ? +v.toFixed(2) : null);
const floor = (z0, z1, x = 0, w = 12, top = 0) => ({ t: 'platform', p: [x, top - 0.5, (z0 + z1) / 2], s: [w, 1, Math.abs(z0 - z1)] });

// ---------------------------------------------------------------------------------------------
// Recipes. Coordinates are metres; travel is toward -Z unless a recipe says otherwise. `crystal`
// is the authored crystal. `runs` lists the intended route and the shortcuts that must fail.
// ---------------------------------------------------------------------------------------------
const RECIPES = [
  {
    id: 'C1', name: 'Pumped vert ceiling: crystal above a halfpipe coping',
    note: 'Halfpipe coping 3.6 m; crystal 7.4 m above the +X coping, 1 m inside it. Needs a pumped session: coasting at the 23 m/s maximum peaks 4.5 m above the coping.',
    data: () => ({ spawn: [0, 0.2, -40], cameraRig: { camDist: 11.5, camHeight: 7.3, camPitch: 18, camFov: 66 }, components: [
      floor(20, -140, 0, 40),
      { t: 'vertramp', p: [0, 0, -60], len: 40, w: 2, rise: 3.6, vkind: 'half', arc: 90, arcSteps: 24 },
      { t: 'crystal', p: [4.6, 11.0, -60] },
      { t: 'gate', p: [0, 0, -120] },
    ] }),
    runs: [
      { label: 'pump from 9 m/s (intended)', expect: true, drive: ctx => ctx.pipe({ speed: 9, pump: true, swings: 10 }) },
      { label: 'coast at 23 m/s', expect: false, drive: ctx => ctx.pipe({ speed: 23, pump: false, swings: 3 }) },
      { label: 'one pumped air from 12 m/s', expect: false, drive: ctx => ctx.pipe({ speed: 12, pump: true, swings: 1 }) },
    ],
  },
  {
    id: 'C2', name: 'Drop-in kicker over a pit: crystal on the far half of a full-speed arc',
    note: 'Start deck 3 m up (the tease vantage), drop ramp, speed pad (18 m/s), 1.2 × 4 m kicker, 14 m pit, landing deck. Crystal 12 m past the lip, p.y 4.0.',
    data: () => ({ spawn: [0, 3.2, 8], components: [
      { t: 'platform', p: [0, 1.5, 6], s: [8, 3, 8] },
      { t: 'ramp', p: [0, 0, -2], len: 8, rise: 3, w: 8, yaw: 180 },
      floor(-6, -34, 0, 8),
      { t: 'speedpad', p: [0, 0.05, -14], s: [4, 0.1, 3], speed: 18 },
      { t: 'ramp', p: [0, 0, -32], len: 4, rise: 1.2, w: 4 },
      floor(-48, -100, 0, 8),
      { t: 'crystal', p: [0, 4.0, -46] },
      { t: 'gate', p: [0, 0, -95] },
    ] }),
    runs: [
      { label: 'drop in, speed pad, ollie at the lip (intended)', expect: true, drive: ctx => ctx.kicker({ start: [0, 3.2, 8], speed: 4, lipZ: -34 }) },
      { label: 'skip the pad: 12 m/s at the kicker', expect: false, drive: ctx => ctx.kicker({ start: [2.6, 0.05, -24], speed: 12, lipZ: -34, heading: [0, -1] }) },
      { label: 'roll off the kicker without an ollie', expect: false, drive: ctx => ctx.kicker({ start: [0, 3.2, 8], speed: 4, lipZ: -34, ollie: false }) },
    ],
  },
  {
    id: 'C3', name: 'Rail-end pop: charged grind exit over a drop',
    note: 'A 14 m rail 1 m up runs 7 m past the deck edge over a 13 m pit. Crystal 4.5 m past the rail end at 4.45 m (3.3 m above the rail top): a full grind exit reaches it, a tap exit lands safely short of it.',
    data: () => ({ spawn: [0, 0.2, 5], components: [
      floor(10, -40, 0, 10),
      { t: 'rail', p: [0, 1.0, -40], len: 14, yaw: 0 },
      floor(-53, -100, 0, 10),
      { t: 'crystal', p: [0, 4.45, -51.5] },
      { t: 'gate', p: [0, 0, -95] },
    ] }),
    runs: [
      { label: 'grind at 12 m/s, full exit at the rail end (intended)', expect: true, drive: ctx => ctx.railEnd({ speed: 12, holdFrames: 24 }) },
      { label: 'grind at 12 m/s, tap exit at the rail end', expect: false, drive: ctx => ctx.railEnd({ speed: 12, holdFrames: 0 }) },
      { label: 'full ollie from the deck edge, no grind', expect: false, drive: ctx => ctx.flatOllie({ start: [3, 0.05, -20], speed: 12, takeoffZ: -39.5 }) },
    ],
    noDrift: true,
  },
  {
    id: 'C4', name: 'Slipstream across a chasm',
    note: 'perfectGrindBoost level. A 24 m rail 1 m up ends at the deck edge; 22 m chasm. Ride it end to end and ollie off: 48 m/s, apex 2.4 m. Crystal 13 m past the end at p.y 3.4.',
    data: () => ({ spawn: [0, 0.2, 5], perfectGrindBoost: true, components: [
      floor(10, -34, 0, 10),
      { t: 'rail', p: [0, 1.0, -22], len: 24, yaw: 0 },
      floor(-56, -110, 0, 10),
      { t: 'crystal', p: [0, 3.4, -47] },
      { t: 'gate', p: [0, 0, -105] },
    ] }),
    runs: [
      { label: 'whole rail, ollie off the end (intended)', expect: true, drive: ctx => ctx.slip({ speed: 12, joinZ: -10.05, ollie: true }) },
      { label: 'whole rail, roll off the end', expect: false, drive: ctx => ctx.slip({ speed: 12, joinZ: -10.05, ollie: false }) },
      { label: 'join halfway (no boost), ollie off the end', expect: false, drive: ctx => ctx.slip({ speed: 12, joinZ: -22, ollie: true }) },
    ],
    noDrift: true,
  },
  {
    id: 'C5', name: 'Kicker, wallride, pumped wallie',
    note: 'Speed pad 18 m/s, 1.8 × 4 m kicker yawed 35° at a straight wall that runs along Z, 3.6 m beside the kicker. Wallride (caught ≈ 4.3 m up), pump the wallie 0.75 s. Crystal in the wallie lane: 1.4 m off the face, ≈ 19 m downstream of the catch, 12.5 m up.',
    data: () => ({ spawn: [0, 0.2, 20], components: [
      floor(30, -120, 0, 60),
      { t: 'speedpad', p: [-6.9, 0.05, -10.2], s: [3, 0.1, 3], speed: 18, yaw: -35 }, // on the kicker line, 12 m before it
      { t: 'ramp', p: [WK.x, 0, WK.z], len: 4, rise: 1.8, w: 4, yaw: -35 },
      { t: 'wall', p: [WALL.faceX + 0.5, 0, WALL.z], s: [WALL.len, WALL.h, 1], yaw: 90 },
      { t: 'crystal', p: C5_CRYSTAL },
      { t: 'gate', p: [8, 0, -115] },
    ] }),
    runs: [
      { label: 'pad, kicker, wallride, 0.75 s pump (intended)', expect: true, drive: ctx => ctx.wall({ pump: 0.75 }) },
      { label: 'pad, kicker, wallride, tap wallie', expect: false, drive: ctx => ctx.wall({ pump: 0 }) },
      { label: 'pad, kicker, no wallride (Grind not held)', expect: false, drive: ctx => ctx.wall({ pump: 0.75, grind: false }) },
    ],
  },
  {
    id: 'C6', name: 'High wire: crystal on a wire strung between roofs',
    note: 'Roof A (top 5 m) and roof B (top 5 m) 30 m apart across a plaza; a wire 6 m up joins them. The crystal sits on the wire 60% of the way across (collected while grinding). From the plaza it is out of reach; from roof A a charged ollie with Grind held catches the wire.',
    data: () => ({ spawn: [0, 5.2, -5], components: [
      floor(10, -90, 0, 30),
      { t: 'platform', p: [0, 2.5, -10], s: [10, 5, 20] },
      { t: 'rail', p: [0, 6.0, -35], len: 30, yaw: 0 },
      { t: 'platform', p: [0, 2.5, -60], s: [10, 5, 20] },
      { t: 'crystal', p: [0, 6.6, -38] },
      { t: 'gate', p: [0, 5, -66] },
    ] }),
    runs: [
      { label: 'from roof A: charged ollie, catch the wire, grind across (intended)', expect: true, drive: ctx => ctx.wire({ start: [0, 5.05, -8], speed: 12, takeoffZ: -16 }) },
      { label: 'from the plaza under the crystal: charged ollie', expect: false, drive: ctx => ctx.flatOllie({ start: [0, 0.05, -24], speed: 12, takeoffZ: -36 }) },
    ],
    noDrift: true,
  },
  {
    id: 'C7', name: 'Roof drop: crystal hanging past the highest roof edge',
    note: 'A roof 8 m up; the crystal floats 7 m past its edge at roof height (p.y 8.0). A charged ollie off the edge carries the rider through it; rolling off drops under it; nothing on the street reaches it.',
    data: () => ({ spawn: [0, 8.2, -3], components: [
      floor(10, -100, 0, 30),
      { t: 'platform', p: [0, 4, -15], s: [10, 8, 30] },
      { t: 'crystal', p: [0, 8.0, -37] },
      { t: 'gate', p: [0, 0, -90] },
    ] }),
    runs: [
      { label: 'charged ollie off the roof edge at 12 m/s (intended)', expect: true, drive: ctx => ctx.flatOllie({ start: [0, 8.05, -12], speed: 12, takeoffZ: -29.8 }) },
      { label: 'roll off the roof edge at 12 m/s', expect: false, drive: ctx => ctx.rollOff({ start: [0, 8.05, -12], speed: 12 }) },
      { label: 'from the street under the crystal: charged ollie', expect: false, drive: ctx => ctx.flatOllie({ start: [0, 0.05, -46], speed: 12, takeoffZ: -38, heading: [0, 1] }) },
    ],
  },
];
// C5 geometry (shared with its driver)
const WDIR = [Math.sin(35 * DEG), -Math.cos(35 * DEG)];
const WK = { x: 0, z: -20 };
const WALL = { faceX: 3.6, z: -45, len: 50, h: 24 };
const C5_CRYSTAL = [WALL.faceX - 1.4, 12.5, -44];

// ---------------------------------------------------------------------------------------------
const results = [];
await withSkateRuntime(async ({ THREE, scene, Level, player: p, CONST, TUNING }) => {
  TUNING.balanceNoise = 0;
  const stockDrift = TUNING.balanceDrift;
  for (const recipe of RECIPES) {
    for (const run of recipe.runs) {
      const data = { v: 1, name: recipe.name, killY: -15, ...recipe.data() };
      const level = new Level(scene, { id: `__recipe_${recipe.id}`, name: recipe.name, data });
      scene.updateMatrixWorld(true);
      TUNING.balanceDrift = recipe.noDrift ? 0 : stockDrift;
      const step = input => { p.step(CONST.fixedStep, input, level); level.update(CONST.fixedStep); input.consumeEdges(); };
      p.respawn(level, true, true);
      for (let i = 0; i < 5; i++) step(makeInput());
      const crystal = level.crystalPickup;
      let maxY = -Infinity, collectedAt = null, died = false;
      const track = () => {
        maxY = Math.max(maxY, p.pos.y);
        if (p.state === 'dead') died = true;
        if (p.hasCrystal && !collectedAt) collectedAt = { x: r2(p.pos.x), y: r2(p.pos.y), z: r2(p.pos.z), state: p.state };
      };
      const traceThis = process.env.RECIPE_TRACE === `${recipe.id}:${recipe.runs.indexOf(run)}`;
      let frame = 0;
      const tick = input => {
        step(input); track(); frame++;
        if (traceThis && frame % 3 === 0) console.log(`  f${frame} ${p.state}${p.grounded ? ' g' : ''} pos(${p.pos.x.toFixed(2)},${p.pos.y.toFixed(2)},${p.pos.z.toFixed(2)}) v${p.speed.toFixed(1)} vy${p.vVel.toFixed(1)} jH${input.jumpHeld ? 1 : 0}${input.jumpReleased ? 'R' : ''}`);
      };
      const place = (pos, heading, { speed = 0, air = false } = {}) => {
        const fwd = new THREE.Vector3(heading[0], 0, heading[1]).normalize();
        p.respawn(level, true, true, { position: new THREE.Vector3(...pos), heading: fwd });
        p.pos.set(...pos); p.prevPos.copy(p.pos);
        p.axisF.copy(fwd); p.axisL.set(fwd.z, 0, -fwd.x);
        p.freeSkate = true; p.airFromSkate = air; p.state = air ? 'air' : 'ride'; p.grounded = !air; p.speed = speed; p.vVel = 0;
        p.hasCrystal = false;
      };
      const ctx = {
        // Halfpipe swings from the pipe floor, heading +X; pump = hold Jump on the way up, release at the coping.
        pipe: ({ speed, pump, swings }) => {
          const hp = level.halfpipes[0];
          place([hp.cross, 0.05, -60], [1, 0], { speed });
          let held = false, airs = 0, inAir = false;
          for (let i = 0; i < swings * 420 && airs < swings && p.state !== 'dead' && !p.hasCrystal; i++) {
            const onWall = p.grounded && Math.abs(hp.crossCoord(p.pos.x, p.pos.z) - hp.cross) > hp.flatHalf + 0.05;
            let input = makeInput();
            if (pump) {
              const rising = onWall && p.pos.y > p.prevPos.y + 1e-4;
              if (rising && !held && p.pos.y < hp.lipY - 0.6) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
              else if (held && (p.pos.y >= hp.lipY - 0.12 || !p.grounded)) { input = makeInput({ jumpReleased: true }); held = false; }
              else if (held) input = makeInput({ jumpHeld: true });
            }
            tick(input);
            if (!p.grounded && p.pos.y > hp.lipY - 0.05) inAir = true;
            if (inAir && p.grounded) { airs++; inAir = false; held = false; }
          }
          return { airs };
        },
        // Roll toward a kicker whose lip is at lipZ (travel -Z); charge 0.4 s, release at the lip.
        kicker: ({ start, speed, lipZ, ollie = true, heading = [0, -1] }) => {
          place(start, heading, { speed });
          let held = false, phase = 'approach';
          for (let i = 0; i < 900 && p.state !== 'dead' && !(phase === 'air' && p.grounded); i++) {
            let input = makeInput();
            if (ollie && phase === 'approach') {
              const toLip = p.pos.z - lipZ;
              if (!held && toLip <= Math.max(0.5, Math.abs(p.speed) * 0.4)) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
              else if (held && toLip <= 0.15) { input = makeInput({ jumpReleased: true }); held = false; }
              else if (held) input = makeInput({ jumpHeld: true });
            }
            tick(input);
            if (phase === 'approach' && !p.grounded && p.pos.z < lipZ + 0.6) phase = 'air';
          }
          return { speedAtEnd: r2(Math.abs(p.speed)) };
        },
        flatOllie: ({ start, speed, takeoffZ, heading = [0, -1] }) => {
          place(start, heading, { speed });
          let held = false, phase = 'approach';
          for (let i = 0; i < 600 && p.state !== 'dead'; i++) {
            let input = makeInput();
            if (phase === 'approach') {
              const left = (p.pos.z - takeoffZ) * -Math.sign(heading[1] || -1);
              if (!held && left <= Math.abs(p.speed) * 0.4) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
              else if (held && left <= 0.1) { input = makeInput({ jumpReleased: true }); held = false; phase = 'air'; }
              else if (held) input = makeInput({ jumpHeld: true });
            }
            tick(input);
            if (phase === 'air' && p.grounded) break;
          }
          return {};
        },
        rollOff: ({ start, speed, heading = [0, -1] }) => {
          place(start, heading, { speed });
          let left = false;
          for (let i = 0; i < 600 && p.state !== 'dead'; i++) { tick(makeInput()); if (!p.grounded) left = true; if (left && p.grounded) break; }
          return {};
        },
        // Charged ollie toward a wire, Grind held once airborne; ride the wire to its far end.
        wire: ({ start, speed, takeoffZ }) => {
          place(start, [0, -1], { speed });
          let held = false, phase = 'approach', grinded = false;
          for (let i = 0; i < 900 && p.state !== 'dead'; i++) {
            let input = makeInput({ grindHeld: phase !== 'approach' && p.state !== 'ride' });
            if (phase === 'approach') {
              const left = p.pos.z - takeoffZ;
              if (!held && left <= Math.abs(p.speed) * 0.4) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
              else if (held && left <= 0.1) { input = makeInput({ jumpReleased: true }); held = false; phase = 'air'; }
              else if (held) input = makeInput({ jumpHeld: true });
            } else if (phase === 'air' && !grinded && !p.grounded) input = makeInput({ grindHeld: true, grindPressed: i % 2 === 0 });
            tick(input);
            if (p.state === 'grind') grinded = true;
            if (phase === 'air' && p.grounded && i > 5) break;
          }
          return { grinded };
        },
        // Join the rail near its start, grind to the end, exit with a tap or a charged ollie.
        railEnd: ({ speed, holdFrames }) => {
          const rail = level.rails[0];
          const a = rail.points.reduce((m, q) => (q.z > m.z ? q : m)), b = rail.points.reduce((m, q) => (q.z < m.z ? q : m));
          place([a.x, a.y + CONST.railRideHeight + 0.05, a.z - 0.3], [0, -1], { speed, air: true });
          tick(makeInput({ grindHeld: true, grindPressed: true }));
          let jumped = false, left = false, hold = 0;
          for (let i = 0; i < 900 && p.state !== 'dead'; i++) {
            let input = makeInput({ grindHeld: !jumped });
            if (!jumped && p.state === 'grind' && p.pos.z <= b.z + Math.max(0.8, Math.abs(p.speed) * (holdFrames + 6) / 60)) {
              input = makeInput({ jumpPressed: true, jumpHeld: true }); jumped = true; hold = holdFrames;
            } else if (jumped && hold > 0) { input = makeInput({ jumpHeld: true }); hold--; }
            else if (jumped && !left) { input = makeInput({ jumpReleased: true }); left = true; }
            tick(input);
            if (left && p.grounded) break;
          }
          return { exited: left };
        },
        // Ride the slipstream rail from joinZ (travel -Z) and leave its end by ollie or roll-off.
        slip: ({ speed, joinZ, ollie }) => {
          const rail = level.rails[0];
          const near = rail.closest(new THREE.Vector3(0, 1, joinZ)).point;
          const b = rail.points.reduce((m, q) => (q.z < m.z ? q : m));
          place([near.x, near.y + CONST.railRideHeight + 0.05, near.z], [0, -1], { speed, air: true });
          tick(makeInput({ grindHeld: true, grindPressed: true }));
          let jumped = false, left = false, exitSpeed = null;
          for (let i = 0; i < 900 && p.state !== 'dead'; i++) {
            let input = makeInput({ grindHeld: !left });
            if (ollie && !jumped && p.state === 'grind' && p.pos.z < b.z + 1.0) { input = makeInput({ jumpPressed: true, jumpHeld: true }); jumped = true; }
            else if (ollie && jumped && !left) input = makeInput({ jumpReleased: true });
            tick(input);
            if (!left && p.state !== 'grind' && p.pos.z < b.z + 1.5) { left = true; exitSpeed = r2(Math.abs(p.speed)); }
            if (left && p.grounded) break;
          }
          return { exitSpeed };
        },
        // Speed pad → kicker aimed 35° at the wall → wallride (Grind held once airborne) → wallie.
        wall: ({ pump, grind = true }) => {
          const lip = { x: WK.x + WDIR[0] * 2, z: WK.z + WDIR[1] * 2 };
          place([WK.x - WDIR[0] * 20, 0.05, WK.z - WDIR[1] * 20], WDIR, { speed: 8 });
          let phase = 'approach', held = false, onWallT = 0, pumpT = 0, entry = null, release = null;
          for (let i = 0; i < 1500 && p.state !== 'dead'; i++) {
            let input = makeInput({ grindHeld: grind && phase !== 'approach' && !p.grounded });
            if (phase === 'approach') {
              const left = (lip.x - p.pos.x) * WDIR[0] + (lip.z - p.pos.z) * WDIR[1];
              if (!held && left <= Math.max(0.5, Math.abs(p.speed) * 0.4)) { input = makeInput({ jumpPressed: true, jumpHeld: true }); held = true; }
              else if (held && left <= 0.15) { input = makeInput({ jumpReleased: true }); held = false; phase = 'air'; }
              else if (held) input = makeInput({ jumpHeld: true });
            } else if (phase === 'wall') {
              if (pumpT === 0) { input = makeInput({ grindHeld: true, jumpPressed: true, jumpHeld: true }); pumpT = CONST.fixedStep; }
              else if (pumpT < pump - 1e-9) { input = makeInput({ grindHeld: true, jumpHeld: true }); pumpT += CONST.fixedStep; }
              else { input = makeInput({ jumpReleased: true }); release = { y: r2(p.pos.y), z: r2(p.pos.z) }; phase = 'after'; }
            }
            tick(input);
            if (phase === 'air' && p.wallriding) { phase = 'wall'; entry = { y: r2(p.pos.y), z: r2(p.pos.z), speed: r2(p.speed) }; }
            if (phase === 'wall') onWallT += CONST.fixedStep;
            if ((phase === 'after' || phase === 'air') && p.grounded) break;
            if (phase === 'wall' && !p.wallriding) phase = 'after';
          }
          return { entry, release };
        },
      };
      const info = run.drive(ctx) ?? {};
      const collected = !!p.hasCrystal;
      results.push({ recipe: recipe.id, name: recipe.name, run: run.label, expectCollect: run.expect, collected, pass: collected === run.expect,
        collectedAt, maxY: r2(maxY), died, crystal: crystal ? [r2(crystal.box.min.x + 1), r2(crystal.box.min.y + 0.4), r2(crystal.box.min.z + 1)] : null, ...info });
      level.dispose();
    }
  }
  TUNING.balanceDrift = stockDrift;
}, { levelEntry: { id: '__recipe_boot', name: 'boot', data: { v: 1, name: 'boot', spawn: [0, 0.2, 0], killY: -20, components: [floor(10, -10), { t: 'gate', p: [0, 0, -8] }] } } });

let failures = 0;
for (const r of results) {
  if (!r.pass) failures++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.recipe} ${r.run}: collected=${r.collected} (expected ${r.expectCollect}) maxY=${r.maxY}${r.collectedAt ? ` at ${JSON.stringify(r.collectedAt)}` : ''}${r.died ? ' died' : ''} ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => ['entry', 'release', 'exitSpeed', 'exited', 'airs', 'speedAtEnd'].includes(k))))}`);
}
if (out) await writeFile(out, JSON.stringify({ recipes: RECIPES.map(r => ({ id: r.id, name: r.name, note: r.note, data: r.data() })), results }, null, 2) + '\n');
console.log(failures ? `${failures} run(s) did not behave as the recipe expects` : 'all recipe runs behave as expected');
process.exitCode = failures ? 1 : 0;
