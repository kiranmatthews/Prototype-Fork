import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const HELD = ['jumpHeld', 'grindHeld', 'spinHeld', 'grabHeld', 'transferHeld'];
const EDGES = ['jumpPressed', 'jumpReleased', 'grindPressed', 'spinPressed', 'grabPressed', 'transferPressed', 'restartPressed'];
const INPUT_FIELDS = ['moveX', 'moveY', ...HELD, ...EDGES];

/** A complete device sample, with Input.poll's axis clamp and replay precision.
 * Edges follow held-button changes unless the caller specifies them explicitly.
 * Samples are not patches: omitting a held button releases it. */
export function normalizeGameInput(sample = {}, previous = {}) {
  const input = makeInput(sample);
  if (!Number.isFinite(input.moveX) || !Number.isFinite(input.moveY))
    throw new TypeError('Movement input must be finite');
  const length = Math.hypot(input.moveX, input.moveY);
  if (length > 1) { input.moveX /= length; input.moveY /= length; }
  input.moveX = Math.round(input.moveX * 100) / 100;
  input.moveY = Math.round(input.moveY * 100) / 100;
  for (const held of HELD) {
    input[held] = !!input[held];
    const pressed = held.replace('Held', 'Pressed');
    if (!(pressed in sample)) input[pressed] = input[held] && !previous[held];
  }
  if (!('jumpReleased' in sample)) input.jumpReleased = !input.jumpHeld && !!previous.jumpHeld;
  return input;
}

const point = value => {
  if (Array.isArray(value)) return { x: value[0], y: value[1], z: value[2] };
  if (value && Number.isFinite(value.x) && Number.isFinite(value.z)) return value;
  throw new TypeError('A world target must be [x,y,z] or an object with x/y/z');
};
const inputCopy = input => Object.fromEntries(INPUT_FIELDS.map(key => [key, input[key]]));

/** Full source-owned Level and production Player, with input-only pilots.
 *
 * The sole optional placement is `options.start` before the run begins. No
 * helper changes position, velocity, state, tuning, crate state or checkpoints.
 * `trace` retains every requested and normalized input plus its resulting pose.
 * Completing a pilot is evidence to inspect; callers own gameplay assertions.
 *
 * Example:
 *   await withBlockworksRuntime(async ({ sourceModule, skateAlong, p, trace }) => {
 *     await skateAlong(sourceModule.routePoint, {
 *       to: 200, progress: () => 20 - p.pos.z,
 *     });
 *     // Assert support, speed, clearance and steering from the recorded trace.
 *   });
 */
export async function withBlockworksRuntime(run, options = {}) {
  const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
  const dom = fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nconst held'));
  new Function('noop', dom + '\ninstallHeadlessDom();')(() => {});
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  const warn = console.warn, error = console.error;
  console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
  console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
  let l;
  try {
    const { Level } = await server.ssrLoadModule('/src/level.ts');
    const { Player } = await server.ssrLoadModule('/src/player.ts');
    const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
    const sourceModule = await server.ssrLoadModule('/src/levels/codex-lab.ts');
    const source = sourceModule.CODEX_LAB_LEVEL;
    if (!source?.components) throw new Error('CODEX_LAB_LEVEL is not available');
    const scene = new THREE.Scene();
    const id = options.levelId ?? 'codex-lab';
    l = new Level(scene, { id, name: source.name, data: source });
    l.update(0); scene.updateMatrixWorld(true);
    const p = new Player(scene);
    p.enterLevel(id);
    if (options.endlessDeaths !== undefined) p.endlessDeaths = !!options.endlessDeaths;
    p.rawInput = makeInput();
    const start = options.start && point(options.start);
    const heading = options.heading && point(options.heading);
    p.respawn(l, true, false, start ? {
      position: new THREE.Vector3(start.x, start.y, start.z),
      ...(heading ? { heading: new THREE.Vector3(heading.x, heading.y ?? 0, heading.z) } : {}),
    } : undefined);

    const dt = CONST.fixedStep, trace = [], actions = [];
    const maxFrames = options.maxFrames ?? 108_000;
    let frame = 0, lastInput = makeInput(), context;
    const snapshot = () => ({
      frame, time: frame * dt, position: p.pos.toArray(),
      heading: p.axisF.toArray(), state: p.state, grounded: p.grounded,
      speed: p.speed, verticalSpeed: p.vVel, bailing: p.isBailing,
      deaths: p.totalDeaths, mover: p.groundHit?.moverId ?? null,
      ground: p.groundHit ? { name: p.groundHit.name, y: p.groundHit.y, normal: p.groundHit.normal.toArray(),
        slippy: p.groundHit.slippy === true, iceGrip: p.groundHit.iceGrip ?? null } : null,
      rail: p.grindRail ? l.rails.indexOf(p.grindRail) : null,
      railDistance: p.grindRail ? p.grindT : null, balance: p.balance,
      input: inputCopy(lastInput),
    });
    const tick = (sample = {}) => {
      if (frame >= maxFrames) throw new Error(`Runner frame budget exhausted: ${JSON.stringify(snapshot())}`);
      const input = normalizeGameInput(sample, lastInput);
      const consumed = inputCopy(input);
      p.step(dt, input, l);
      l.update(dt);
      p.flushLevelCrateRewards(l);
      p.commitRenderStep(l);
      frame++;
      lastInput = { ...consumed };
      const result = snapshot();
      trace.push({ ...result, requested: Object.fromEntries(INPUT_FIELDS.filter(key => key in sample).map(key => [key, sample[key]])) });
      options.onTick?.(result, context);
      input.consumeEdges();
      return result;
    };
    const sampleAt = (sample, index) => typeof sample === 'function' ? sample(context, index) : sample;
    const assertAlive = label => {
      if (p.isBailing || ['dead', 'gameover'].includes(p.state))
        throw new Error(`${label}: ${JSON.stringify(snapshot())}`);
    };
    const action = (name, body) => {
      const begin = frame;
      try { return body(); }
      finally { actions.push({ name, firstFrame: begin, lastFrame: frame, seconds: (frame - begin) * dt }); }
    };
    const stepFor = (count, sample = {}) => {
      for (let i = 0; i < count; i++) tick(sampleAt(sample, i));
      return snapshot();
    };
    const until = (predicate, sample = {}, opts = {}) => action(opts.label ?? 'until', () => {
      const limit = opts.maxFrames ?? 1800;
      for (let i = 0; i < limit && !predicate(context); i++) {
        tick(sampleAt(sample, i));
        if (!opts.allowDeath) assertAlive(opts.label ?? 'until');
      }
      if (!predicate(context)) throw new Error(`${opts.label ?? 'until'} timed out: ${JSON.stringify(snapshot())}`);
      return snapshot();
    });
    const controlFrame = () => {
      if (options.controlFrame) return options.controlFrame(context);
      if (l.cameraViews.length || TUNING.chaseCam > .5)
        throw new Error('World pilots need an explicit controlFrame for camera-view/chase levels');
      return l.laneDirAt(p.pos.x, p.pos.y, p.pos.z) ?? { x: 0, z: -1 };
    };
    const worldDirectionInput = (direction, pace = 1) => {
      const d = point(direction), length = Math.hypot(d.x, d.z);
      if (length < 1e-8 || pace === 0) return { moveX: 0, moveY: 0 };
      const f = controlFrame(), scale = 1 / (Math.hypot(f.x, f.z) || 1);
      const fx = f.x * scale, fz = f.z * scale;
      return {
        moveX: (d.x * -fz + d.z * fx) / length * pace,
        moveY: (d.x * fx + d.z * fz) / length * pace,
      };
    };
    const resolveTarget = target => point(typeof target === 'function' ? target(context) : target);
    const distanceTo = target => {
      const q = resolveTarget(target);
      return Math.hypot(q.x - p.pos.x, q.z - p.pos.z);
    };
    const steerToward = (target, opts = {}) => {
      const q = resolveTarget(target), dx = q.x - p.pos.x, dz = q.z - p.pos.z;
      if (Math.hypot(dx, dz) <= (opts.tolerance ?? .08)) return { moveX: 0, moveY: 0 };
      return worldDirectionInput({ x: dx, z: dz }, opts.pace ?? 1);
    };
    const walkTo = (target, opts = {}) => action(opts.label ?? 'walk', () => {
      until(() => distanceTo(target) < (opts.tolerance ?? .1), () => {
        if (opts.requireGrounded !== false && !p.grounded)
          throw new Error(`Walk lost support: ${JSON.stringify(snapshot())}`);
        return { ...steerToward(target, { pace: opts.pace ?? .15, tolerance: opts.tolerance ?? .1 }), ...opts.buttons };
      }, { maxFrames: opts.maxFrames ?? 1800, label: opts.label ?? 'walk' });
      if (opts.requireGrounded !== false && !p.grounded)
        throw new Error(`Walk reached its target without support: ${JSON.stringify(snapshot())}`);
      stepFor(opts.settleFrames ?? 30, opts.buttons ?? {});
      assertAlive('walk settle');
      if (opts.requireGrounded !== false && !p.grounded)
        throw new Error(`Walk lost support while stopping: ${JSON.stringify(snapshot())}`);
      if (distanceTo(target) > (opts.arrivalTolerance ?? .18))
        throw new Error(`Walk stopping momentum missed target: ${JSON.stringify(snapshot())}`);
      return snapshot();
    });
    const skateTo = (target, opts = {}) => until(
      () => distanceTo(target) <= (opts.tolerance ?? 2),
      () => ({ ...steerToward(target, opts), jumpHeld: opts.charge !== false, ...opts.buttons }),
      { maxFrames: opts.maxFrames ?? 3600, label: opts.label ?? 'skate to target' },
    );
    const skateAlong = (routePoint, opts) => {
      if (typeof opts?.progress !== 'function' || !Number.isFinite(opts.to))
        throw new TypeError('skateAlong requires progress(context) and a finite to value');
      return until(() => opts.progress(context) >= opts.to, () => {
        const s = Math.min(opts.to, Math.max(opts.from ?? 0, opts.progress(context)) + (opts.lookAhead ?? 10));
        return { ...steerToward(routePoint(s), opts), jumpHeld: opts.charge !== false, ...opts.buttons };
      }, { maxFrames: opts.maxFrames ?? 18_000, label: opts.label ?? 'follow source route' });
    };
    const charge = (count = 26, sample = {}) => stepFor(count, (ctx, i) => ({ ...sampleAt(sample, i), jumpHeld: true }));
    const releaseJump = (sample = {}) => tick({ ...sample, jumpHeld: false, jumpReleased: true });
    const jumpTo = (target, opts = {}) => action(opts.label ?? 'jump', () => {
      charge(opts.chargeFrames ?? 26, opts.chargeInput ?? {});
      releaseJump(opts.releaseInput ?? {});
      if (p.state !== 'air') throw new Error(`Jump release failed: ${JSON.stringify(snapshot())}`);
      until(() => p.grounded || (opts.allowGrind && p.state === 'grind'),
        () => ({ ...steerToward(target, opts), ...opts.airButtons }),
        { maxFrames: opts.maxAirFrames ?? 180, label: opts.label ?? 'jump landing' });
      if (distanceTo(target) > (opts.arrivalTolerance ?? 1.4))
        throw new Error(`Jump missed intended target: ${JSON.stringify(snapshot())}`);
      if (opts.heightTolerance !== undefined && Math.abs(p.pos.y-resolveTarget(target).y)>opts.heightTolerance)
        throw new Error(`Jump landed at the wrong height: ${JSON.stringify(snapshot())}`);
      return snapshot();
    });
    const grindUntil = (predicate, opts = {}) => until(predicate, (ctx, i) => {
      const approach = opts.approachInput ? sampleAt(opts.approachInput, i) : { moveY: 1 };
      const correction = THREE.MathUtils.clamp(-p.balance * 5 - p.balanceVel * .7, -1, 1);
      return { ...approach, ...(p.state === 'grind' && opts.balance !== false ? { moveX: correction } : {}),
        grindHeld: true, ...sampleAt(opts.buttons ?? {}, i) };
    }, { maxFrames: opts.maxFrames ?? 3600, label: opts.label ?? 'grind' });

    context = {
      THREE, server, Level, Player, CONST, TUNING, scene, source, sourceModule,
      p, l, player: p, level: l, dt, trace, actions,
      snapshot, tick, stepFor, until, worldDirectionInput, steerToward, distanceTo,
      walkTo, skateTo, skateAlong, charge, releaseJump, jumpTo, grindUntil,
      get frame() { return frame; },
      get lastInput() { return inputCopy(lastInput); },
    };
    return await run(context);
  } finally {
    l?.dispose();
    await server.close();
    console.warn = warn; console.error = error;
  }
}
