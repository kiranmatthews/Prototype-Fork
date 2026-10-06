// CPU work profile for the same Player entry points used by gameplay. Timings
// are descriptive; bounded query counts in test-death-performance are the gate.
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, CONST }) => {
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene();
  const level = new Level(scene, { id: 'death-profile', name: 'Death profile', data: {
    v: 1, name: 'Death profile', spawn: [0, .1, 0], killY: -60,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [100, 1, 100] }, { t: 'gate', p: [0, 0, -40] }],
  }});
  const p = new Player(scene), input = makeInput({ inventoryHeld: true });
  p.rawInput = input; p.respawn(level, true);
  const runtime = createCharacterAnimationRuntime(p,
    createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const metrics = {};
  function wrap(owner, key) {
    const native = owner[key].bind(owner);
    owner[key] = (...args) => {
      const start = performance.now();
      try { return native(...args); } finally {
        const m = metrics[key] ??= { calls: 0, ms: 0 }; m.calls++; m.ms += performance.now() - start;
      }
    };
  }
  for (const key of ['stepDeathFall', 'seatDeathOnGround', 'refreshCharacterBounds', 'queryGround']) wrap(p, key);
  for (const key of ['minimumPlaneDistance', 'sampledPlaneDistance', 'measure']) wrap(p.interactionMeasure, key);
  const stats = values => {
    const sorted = [...values].sort((a, b) => a - b);
    return { samples: sorted.length, averageMs: values.reduce((a, b) => a + b, 0) / Math.max(1, values.length),
      medianMs: sorted[Math.floor(sorted.length * .5)] ?? 0,
      p95Ms: sorted[Math.floor(sorted.length * .95)] ?? 0, maxMs: sorted.at(-1) ?? 0 };
  };
  const results = [];
  const nativeRandom = Math.random;
  try {
    // Warm the shared runtime before timing. Launch/capture costs remain in
    // trigger and the first active frame, rather than being hidden by warmup.
    for (let i = 0; i < 60; i++) p.step(CONST.fixedStep, input, level);
    for (const mode of ['idle', 'balance', 'pvp', 'wall', 'trip', 'death', 'blast', 'crush']) {
      const phases = {}, samples = [], activeSamples = [], triggers = [];
      let peakParts = 0, maxProbes = 0;
      for (const key of Object.keys(metrics)) delete metrics[key];
      for (let repetition = 0; repetition < 3; repetition++) {
        let randomSeed = 0x6439ace + repetition;
        Math.random = () => ((randomSeed = (Math.imul(randomSeed, 1664525) + 1013904223) >>> 0) / 0x100000000);
        p.respawn(level, true, true); p.grounded = true; p.speed = 0; p.vVel = 0;
        p.step(CONST.fixedStep, input, level); p.onDeath = () => {};
        const start = performance.now();
        if (mode === 'death' || mode === 'blast' || mode === 'crush') {
          p.die(mode === 'death' ? 'contact' : mode, new THREE.Vector3(-1, .4, 0)); p.respawnTimer = 20;
        } else if (mode === 'pvp') p.beginPvpKnockdown(5, 1);
        else if (mode !== 'idle') {
          p.freeSkate = true; p.speed = mode === 'balance' ? 10 : 24;
          p.bail(false, p.speed, mode); p.startRagdoll(mode === 'wall' ? 'back' : mode === 'trip' ? 'forward' : 'air');
        }
        triggers.push(performance.now() - start);
        for (let i = 0; i < 180; i++) {
          const t = performance.now(); p.step(CONST.fixedStep, input, level);
          const ms = performance.now() - t, d = p.breakApartDiagnostics;
          const phase = d?.active ? d.phase : p.state === 'dead' ? p.deathPresentationDiagnostics.mode : p.isBailing ? 'intact-bail' : 'upright';
          (phases[phase] ??= []).push(ms); samples.push(ms);
          if (p.isBailing || p.state === 'dead' || d?.active) activeSamples.push(ms);
          peakParts = Math.max(peakParts, d?.active ? d.parts : 0); maxProbes = Math.max(maxProbes, d?.probesThisStep ?? 0);
        }
      }
      results.push({ mode, repetitions: 3, trigger: stats(triggers), ...stats(samples), active: stats(activeSamples), peakParts, maxProbes, phases: Object.fromEntries(
        Object.entries(phases).map(([phase, values]) => [phase, stats(values)])), metrics: structuredClone(metrics) });
    }
    console.log(JSON.stringify({ note: 'Three seeded repetitions per case; SSR CPU timings. Compare on the same machine. No GPU/browser costs included.', results }, null, 2));
  } finally { Math.random = nativeRandom; runtime.dispose(); level.dispose(); }
});
