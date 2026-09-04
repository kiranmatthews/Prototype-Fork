import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const near = (actual, expected, message, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, got ${actual}`,
  );
};

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const {
    cameraSkateSpeed,
    speedSkateFovTarget,
    stepSpeedSkateFov,
  } = await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
  const { TUNING, TUNING_RANGES, TUNING_SECTIONS, TUNING_VERSION } =
    await server.ssrLoadModule('/src/tuning.ts');

  const state = (patch = {}) => ({
    state: 'ride',
    speed: 30,
    grindSpeed: 0,
    boardRolling: false,
    airFromSkate: false,
    wallriding: false,
    bailing: false,
    ...patch,
  });
  near(cameraSkateSpeed(state()), 0,
    'fast on-foot movement widened the skate lens');
  near(cameraSkateSpeed(state({ boardRolling: true })), 30,
    'grounded skating lost camera speed');
  near(cameraSkateSpeed(state({
    state: 'air',
    speed: -21,
    airFromSkate: true,
  })), 21, 'board air lost absolute camera speed');
  near(cameraSkateSpeed(state({
    state: 'grind',
    speed: 3,
    grindSpeed: 48,
  })), 48, 'grind camera did not use rail velocity');
  near(cameraSkateSpeed(state({
    state: 'air',
    speed: 17,
    wallriding: true,
  })), 17, 'wallride lost camera speed');
  for (const blocked of [
    { state: 'rope', boardRolling: true },
    { state: 'hang', boardRolling: true },
    { state: 'dead', boardRolling: true },
    { state: 'gameover', boardRolling: true },
    { boardRolling: true, bailing: true },
  ]) near(cameraSkateSpeed(state(blocked)), 0,
    `${blocked.state ?? 'bail'} retained the skate lens`);

  near(speedSkateFovTarget(30, false, 12, 23, 6), 0,
    'non-skating speed produced FOV boost');
  near(speedSkateFovTarget(9, true, 12, 23, 6), 0,
    'sub-cruise skating produced FOV boost');
  near(speedSkateFovTarget(12, true, 12, 23, 6), 0,
    'cruise speed did not remain at authored FOV');
  near(speedSkateFovTarget(17.5, true, 12, 23, 6), 3,
    'mid-speed smoothstep did not reach half boost');
  near(speedSkateFovTarget(23, true, 12, 23, 6), 6,
    'max speed did not reach full FOV boost');
  near(speedSkateFovTarget(48, true, 12, 23, 6), 6,
    'overspeed did not hold full FOV boost');
  near(speedSkateFovTarget(-23, true, 12, 23, 6), 6,
    'reverse skating did not use absolute speed');
  near(speedSkateFovTarget(12, true, 12, 10, 6), 0,
    'collapsed speed band boosted at its boundary');
  near(speedSkateFovTarget(12.01, true, 12, 10, 6), 6,
    'collapsed speed band did not step above its boundary');

  near(stepSpeedSkateFov(0, 6, 1 / 60, true), 6,
    'render snap did not settle the lens immediately');
  const once = stepSpeedSkateFov(0, 6, 1 / 30);
  const twice = stepSpeedSkateFov(
    stepSpeedSkateFov(0, 6, 1 / 60),
    6,
    1 / 60,
  );
  near(once, twice, 'FOV attack changed with frame subdivision');
  const attackDelta = stepSpeedSkateFov(0, 6, 0.1);
  const releaseDelta = 6 - stepSpeedSkateFov(6, 0, 0.1);
  assert.ok(attackDelta > releaseDelta,
    'FOV release was not gentler than its attack');

  assert.equal(TUNING_VERSION, 17);
  assert.equal(TUNING.camSpeedFovBoost, 6);
  assert.deepEqual(TUNING_RANGES.camSpeedFovBoost, {
    min: 0,
    max: 25,
    step: 0.5,
  });
  assert.ok(TUNING_SECTIONS.find((section) => section.title === 'CAMERA')
    ?.keys.includes('camSpeedFovBoost'));

  const playerSource = await readFile(new URL('../src/player.ts', import.meta.url), 'utf8');
  const mainSource = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');
  assert.match(playerSource, /get cameraSkateSpeed\(\): number/,
    'Player does not expose deterministic board-owned camera speed');
  assert.match(mainSource, /const cameraSkateSpeed = player\.cameraSkateSpeed/,
    'P1 camera is not wired to board-owned speed');
  assert.match(mainSource, /const p2SkateSpeed = p2\.cameraSkateSpeed/,
    'P2 camera is not wired to its own speed');
  assert.doesNotMatch(mainSource, /camera2\.fov = camera\.fov/,
    'P2 still inherits P1 speed FOV');
  assert.match(mainSource,
    /authoredFov \+ camSpeedFovBoost,\s*BOULDER_FOV,\s*boulderF/s,
  'speed FOV is not composed below the authored boulder shot');
  assert.match(mainSource, /camSpeedFovBoost = 0;\s*cam2SpeedFovBoost = 0;/,
    'fixed review cameras do not clear the speed lens');
  assert.match(mainSource, /frameStats\.cameraSpeedFovBoost = camSpeedFovBoost/,
    'live frame diagnostics omit the speed lens');

  console.log('PASS board-owned high-speed camera FOV curve, easing, split independence, and UI schema');
} finally {
  await server.close();
}
