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
    carveGripAtSpeed,
    legacyCarveGripEndpoints,
    legacyCarveGripAtSpeed,
    liveCarveGripAtSpeed,
    migrateLegacySavedCarveGrip,
  } = await server.ssrLoadModule('/src/carveGrip.ts');
  const { TUNING, TUNING_RANGES, TUNING_SECTIONS, TUNING_VERSION } =
    await server.ssrLoadModule('/src/tuning.ts');
  const { Replayer, isReplayFile } = await server.ssrLoadModule('/src/replay.ts');

  assert.equal(TUNING_VERSION, 16);
  assert.equal('carveGrip' in TUNING, false);
  assert.equal('carveGripRatio' in TUNING, false);
  assert.deepEqual(TUNING_RANGES.carveGripLow, { min: 0, max: 1440, step: 0.0625 });
  assert.deepEqual(TUNING_RANGES.carveGripHigh, { min: 0, max: 1440, step: 0.0625 });
  const skating = TUNING_SECTIONS.find((section) => section.title === 'SKATING');
  assert.ok(skating?.keys.includes('carveGripLow'));
  assert.ok(skating?.keys.includes('carveGripHigh'));
  assert.equal(skating?.keys.includes('carveGripRatio'), false);

  near(carveGripAtSpeed(0, 23, 1440, 0), 1440,
    'zero speed did not receive the low endpoint');
  near(carveGripAtSpeed(11.5, 23, 1440, 0), 720,
    'mid-speed grip was not a direct linear blend');
  near(carveGripAtSpeed(23, 23, 1440, 0), 0,
    'max speed did not receive the high endpoint');
  near(carveGripAtSpeed(48, 23, 1440, 0), 0,
    'overspeed did not hold the damped high endpoint');
  near(carveGripAtSpeed(-11.5, 23, 1440, 0), 720,
    'reverse speed did not use absolute velocity');
  near(carveGripAtSpeed(0, 23, 0, 900), 0,
    'low-below-high endpoint order was not supported');
  near(carveGripAtSpeed(23, 23, 0, 900), 900,
    'rising endpoint curve did not reach high grip');
  near(carveGripAtSpeed(0, 0, 700, 5), 700,
    'zero-width band changed its stationary endpoint');
  near(carveGripAtSpeed(1, 0, 700, 5), 5,
    'zero-width band did not step to its moving endpoint');

  const legacyDefaults = legacyCarveGripEndpoints(135, 0.05, 12, 23);
  near(legacyDefaults.low, 128.25, 'legacy low endpoint migration changed');
  near(legacyDefaults.high, 141.1875, 'legacy high endpoint migration changed');
  for (const speed of [0, 9, 12, 23]) {
    const oldRate = 135 * Math.min(
      2,
      Math.max(0.5, 1 + (speed / 12 - 1) * 0.05),
    );
    near(
      carveGripAtSpeed(speed, 23, legacyDefaults.low, legacyDefaults.high),
      oldRate,
      `mapped default changed the old curve at speed ${speed}`,
    );
  }

  const oldDefaults = {
    carveGrip: 135,
    carveGripRatio: 0.05,
    cruiseSpeed: 12,
    maxSpeed: 23,
  };
  assert.equal(migrateLegacySavedCarveGrip(
    { ...oldDefaults }, oldDefaults, 12, 23,
  ), null, 'untouched legacy save overrode the new build defaults');
  const savedMigration = migrateLegacySavedCarveGrip(
    { carveGrip: 600, carveGripRatio: -0.5 },
    oldDefaults,
    10,
    30,
  );
  assert.ok(savedMigration);
  near(savedMigration.low, 900, 'deliberate legacy low grip was not migrated');
  near(savedMigration.high, 300, 'deliberate legacy high grip was not migrated');
  const maxOnlyMigration = migrateLegacySavedCarveGrip(
    { ...oldDefaults, maxSpeed: 30 },
    oldDefaults,
    12,
    30,
  );
  assert.ok(maxOnlyMigration);
  near(maxOnlyMigration.low, 128.25,
    'max-only old save changed its low endpoint');
  near(maxOnlyMigration.high, 145.125,
    'max-only old save did not preserve its high endpoint');
  const cruiseOnlyMigration = migrateLegacySavedCarveGrip(
    { ...oldDefaults, cruiseSpeed: 6 },
    oldDefaults,
    6,
    23,
  );
  assert.ok(cruiseOnlyMigration);
  near(cruiseOnlyMigration.low, 128.25,
    'cruise-only old save changed its low endpoint');
  near(cruiseOnlyMigration.high, 154.125,
    'cruise-only old save did not preserve its high endpoint');
  assert.equal(migrateLegacySavedCarveGrip(
    { carveGripLow: 800, carveGripHigh: 3, ...oldDefaults },
    oldDefaults,
    12,
    23,
  ), null, 'direct endpoint save was replaced by legacy migration');

  const original = { ...TUNING };
  const oldReplayTuning = { ...original, carveGrip: 135, carveGripRatio: 0.05 };
  delete oldReplayTuning.carveGripLow;
  delete oldReplayTuning.carveGripHigh;
  const replay = {
    v: 2,
    level: 'flats',
    date: '2026-09-02T00:00:00.000Z',
    tuning: oldReplayTuning,
    tuningChanges: [
      [0, 'carveGripRatio', 1],
      [0, 'maxSpeed', 30],
    ],
    mx: [0],
    my: [0],
    b: [0],
    frames: 1,
    truncated: false,
  };
  assert.equal(isReplayFile(replay), true);
  const replayer = new Replayer();
  replayer.begin(replay);
  near(TUNING.carveGripLow, legacyDefaults.low,
    'legacy replay did not derive its initial low endpoint');
  near(TUNING.carveGripHigh, legacyDefaults.high,
    'legacy replay did not derive its initial high endpoint');
  near(liveCarveGripAtSpeed(48, 23, TUNING.carveGripLow, TUNING.carveGripHigh),
    legacyCarveGripAtSpeed(48, 135, 0.05, 12),
    'legacy replay lost its overspeed ratio curve');
  assert.equal(Object.hasOwn(TUNING, 'carveGrip'), false,
    'legacy replay resurrected the retired base key');
  assert.equal(replayer.feed({
    moveX: 0,
    moveY: 0,
    jumpHeld: false,
    jumpPressed: false,
    jumpReleased: false,
    grindHeld: false,
    grindPressed: false,
    spinHeld: false,
    spinPressed: false,
    grabHeld: false,
    grabPressed: false,
    restartPressed: false,
    transferHeld: false,
    transferPressed: false,
  }), true);
  near(TUNING.carveGripLow, 67.5,
    'legacy replay ratio change did not refresh low grip');
  near(TUNING.carveGripHigh, 270,
    'legacy replay max-speed change did not refresh high grip');
  replayer.end();
  near(TUNING.carveGripLow, original.carveGripLow,
    'replay end did not restore low grip');
  near(TUNING.carveGripHigh, original.carveGripHigh,
    'replay end did not restore high grip');
  near(TUNING.maxSpeed, original.maxSpeed,
    'replay end did not restore max speed');
  near(liveCarveGripAtSpeed(48, 23, 128.25, 141.1875), 141.1875,
    'replay end did not restore direct overspeed saturation');

  const playerSource = await readFile(new URL('../src/player.ts', import.meta.url), 'utf8');
  assert.match(playerSource,
    /liveCarveGripAtSpeed\(\s*this\.speed,\s*TUNING\.maxSpeed,\s*TUNING\.carveGripLow,\s*TUNING\.carveGripHigh/s,
  'live skate steering is not wired to both direct grip endpoints');
  assert.doesNotMatch(playerSource, /TUNING\.carveGripRatio/,
    'live skate steering still reads the retired ratio');

  console.log('PASS independent low/high carve grip, saved-tuning migration, and legacy replay compatibility');
} finally {
  await server.close();
}
