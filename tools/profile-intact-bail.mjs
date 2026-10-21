// Comparable CPU measurements of production Player.step. An optional saved
// source directory lets the same harness measure the pre-change working tree
// without checking out, stashing or overwriting the user's files.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { createServer } from 'vite';
import { makeInput } from './jungle-cup-harness.mjs';
const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const source = await readFile(new URL('./test-campaign-death-flow.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true);
const dom = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'installHeadlessDom');
new Function('noop', dom.getText(ast) + '; installHeadlessDom();')(() => {});
const replaced = new Set(['src/player.ts', 'src/character/bailMotion.ts', 'src/character/bailGroundContact.ts', 'src/character/bailRecoveryMotion.ts', 'src/character/interactionBounds.ts', 'src/character/wipeoutPolicy.ts']);
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: snapshot ? [{ name: 'bail-source-snapshot', enforce: 'pre', async load(id) {
    const rel = path.relative(process.cwd(), id.split('?')[0]);
    if (replaced.has(rel)) {
      try { return await readFile(path.join(snapshot, rel), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } }] : [],
});
const warn = console.warn, error = console.error, random = Math.random;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
let level, runtime;
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene();
  level = new Level(scene, { id: 'bail-profile', name: 'Bail profile', data: { v: 1, name: 'Bail profile', spawn: [0, .05, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }] } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const stats = values => { const sorted = [...values].sort((a, b) => a - b); return {
    samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * .95)] }; };
  const results = [];
  let contact = null;
  if (process.argv.includes('--contact-only') && typeof p.kickRagdollContact === 'function') {
    p.invulnTimer = 0; p.beginPvpKnockdown(0, 1); p.syncVisual(input, 1 / 60); p.group.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 1, 0), impulse = new THREE.Vector3(0, 16, 3), samples = [];
    let supportCalls = 0, supportSamples = 0;
    const sample = p.interactionMeasure.sampledPlaneDistance.bind(p.interactionMeasure);
    p.interactionMeasure.sampledPlaneDistance = (...args) => {
      const result = sample(...args); supportCalls++; supportSamples += p.interactionMeasure.supportSamples; return result;
    };
    for (let i = -500; i < 3000; i++) {
      if (i === 0) supportCalls = supportSamples = 0;
      const start = performance.now(); p.kickRagdollContact(normal, impulse, 12);
      if (i >= 0) samples.push(performance.now() - start);
    }
    p.interactionMeasure.sampledPlaneDistance = sample;
    contact = { warmupContacts: 500, cpuMs: stats(samples), supportCalls, supportSamples,
      scope: 'Isolated production contact torque and secondary-motion impulse, warm posed rig; excludes locomotion/render.' };
  }
  if (!process.argv.includes('--contact-only'))
  for (const cause of ['balance', 'wall', 'trip', 'landing', 'pvp']) {
    const frames = [], incidents = [], triggers = [], durations = []; let fullScans = 0, count = false;
    const supportTimes = []; let supportSamples = 0;
    const support = p.interactionMeasure.sampledPlaneDistance.bind(p.interactionMeasure);
    if (process.argv.includes('--support-profile')) p.interactionMeasure.sampledPlaneDistance = (...args) => {
      const start = performance.now(), result = support(...args);
      if (count && p.isBailing) { supportTimes.push(performance.now() - start); supportSamples += p.interactionMeasure.supportSamples; }
      return result;
    };
    const native = p.interactionMeasure.skinnedBounds.bind(p.interactionMeasure);
    p.interactionMeasure.skinnedBounds = mesh => { if (count && p.isBailing) fullScans++; return native(mesh); };
    for (let trial = -8; trial < 24; trial++) {
      let seed = 0x48631 + trial;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      p.respawn(level, true, true); p.invulnTimer = 0; p.step(CONST.fixedStep, input, level);
      p.speed = cause === 'balance' ? 10 : 24; p.freeSkate = true;
      const t = performance.now();
      if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
      else {
        p.bail(false, p.speed, cause, 30);
        if (cause === 'wall' || cause === 'trip') {
          p.startRagdoll(cause === 'wall' ? 'back' : 'forward');
          p.vVel = cause === 'wall' ? 3.6 : 7; p.state = 'air'; p.grounded = false;
          p.airFromSkate = false; p.airMomentum = true;
        }
      }
      if (trial >= 0) triggers.push(performance.now() - t);
      count = trial >= 0;
      let total = 0, n = 0;
      for (; n < 300 && p.isBailing; n++) {
        const start = performance.now(); p.step(CONST.fixedStep, input, level); const ms = performance.now() - start;
        if (count) frames.push(ms); total += ms;
      }
      count = false;
      if (trial >= 0) { incidents.push(total); durations.push(n / 60); }
    }
    p.interactionMeasure.skinnedBounds = native;
    p.interactionMeasure.sampledPlaneDistance = support;
    results.push({ cause, stepMs: stats(frames), incidentCpuMs: stats(incidents), triggerMs: stats(triggers), durationSeconds: stats(durations), fullSkinScans: fullScans,
      support: supportTimes.length ? { cpuMs: stats(supportTimes), samples: supportSamples } : undefined });
  }
  console.log(JSON.stringify({ source: snapshot ? 'initial working tree snapshot' : 'current working tree', warmupsPerCase: 8, measuredIncidentsPerCase: 24,
    scope: 'Production fixed-step CPU in Node with the animation runtime and procedural fallback assets. Includes first active frame; excludes render/GPU/browser costs. Timings are descriptive, scan counts are deterministic.', contact, results }, null, 2));
} finally { Math.random = random; console.warn = warn; console.error = error; runtime?.dispose(); level?.dispose(); await server.close(); }
