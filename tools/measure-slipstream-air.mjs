import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';
import { makeInput } from './jungle-cup-harness.mjs';

// Authoring measurement only: real campaign Player, unchanged tuning, and
// ordinary direction/charge/release inputs on flat / downhill kicker fixtures.
// This intentionally does not mutate player velocity or claim course coverage.
const pack = JSON.parse(await readFile(new URL('../public/levels.json', import.meta.url), 'utf8'));
const original = pack.levels.find(entry => entry.id === 'slip').data;
const nodes = original.components.filter(c => c.t === 'camnode' && !c.cameraView).map(c => c.p);
const arc = dimensions => nodes.slice(1).reduce((sum, p, i) => sum + Math.hypot(...dimensions.map(k => p[k] - nodes[i][k])), 0);
const tail = nodes.at(-1), beforeTail = nodes.at(-2), gate = original.components.find(c => c.t === 'gate').p;
const tailRemainder = Math.hypot(...tail.map((v, i) => v - beforeTail[i])) * (tail[2] - gate[2]) / (tail[2] - beforeTail[2]);
const startRemainder = Math.hypot(...nodes[1].map((v, i) => v - nodes[0][i])) * (nodes[0][2] - original.spawn[2]) / (nodes[0][2] - nodes[1][2]);
console.log(JSON.stringify({ originalFullLane3D: arc([0, 1, 2]), originalFullLaneXZ: arc([0, 2]),
  originalSpawnToGate3D: arc([0, 1, 2]) - startRemainder - tailRemainder }, null, 2));

const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
const dom = fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nconst held'));
new Function('noop', dom + '\ninstallHeadlessDom();')(() => {});
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const warn = console.warn, error = console.error;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
try {
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const results = [];
  for (const downhill of [false, true]) for (const rise of [0, 3, 5, 7]) for (const release of [true, false]) {
    const runwayY = downhill ? 30 : 0;
    const components = [
      { t: 'platform', p: [0, runwayY - .5, 140], s: [16, 1, 120], edgeGrinding: false },
      downhill ? { t: 'ramp', p: [0, 0, 40], len: 80, rise: 30, w: 16, yaw: 180, edgeGrinding: false } :
        { t: 'platform', p: [0, -.5, 40], s: [16, 1, 80], edgeGrinding: false },
      rise ? { t: 'ramp', p: [0, 0, -9], len: 18, rise, w: 16, edgeGrinding: false } :
        { t: 'platform', p: [0, -.5, -9], s: [16, 1, 18], edgeGrinding: false },
      { t: 'platform', p: [0, -35, -250], s: [30, 1, 30], edgeGrinding: false },
      { t: 'gate', p: [0, -34.5, -250] },
    ];
    const source = { v: 1, name: 'Slipstream air ruler', spawn: [0, runwayY + .02, 180], killY: -50, components };
    const l = new Level(new THREE.Scene(), { id: 'slipstream-air-ruler', name: source.name, data: source });
    l.setRunModesEnabled(false); l.root.updateMatrixWorld(true);
    const p = new Player(l.scene); p.enterLevel('slipstream-air-ruler'); p.respawn(l, true);
    let released = false, firstAir, previous, sameHeight, lowHeight, peak = -Infinity;
    try {
      for (let frame = 0; frame < 1600; frame++) {
        const trigger = release && !released && p.grounded && p.pos.z < -17;
        const input = makeInput({ moveY: 1, jumpHeld: !released && !trigger,
          jumpPressed: frame === 0, jumpReleased: trigger });
        if (trigger) released = true;
        p.step(CONST.fixedStep, input, l); l.update(CONST.fixedStep);
        if (!p.grounded && p.pos.z < -16 && !firstAir) {
          firstAir = { frame, position: p.pos.toArray(), speed: p.speed, up: p.vVel, floatAir: p.floatAir };
        }
        if (firstAir) {
          peak = Math.max(peak, p.pos.y);
          const atHeight = (height, prev) => {
            const fraction = (prev[1] - height) / (prev[1] - p.pos.y);
            return -18 - (prev[2] + (p.pos.z - prev[2]) * fraction);
          };
          if (previous && p.vVel < 0) {
            if (sameHeight === undefined && previous[1] >= rise && p.pos.y < rise) sameHeight = atHeight(rise, previous);
            if (lowHeight === undefined && previous[1] >= rise - 4 && p.pos.y < rise - 4) lowHeight = atHeight(rise - 4, previous);
          }
          if (lowHeight !== undefined) break;
        }
        if (['dead', 'gameover'].includes(p.state)) break;
        previous = p.pos.toArray();
      }
      results.push({ downhill, rise, release, firstAir, peak, sameHeightGap: sameHeight, fourMetreLowerGap: lowHeight });
    } finally { p.group.removeFromParent(); l.dispose(); }
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await server.close(); console.warn = warn; console.error = error;
}
