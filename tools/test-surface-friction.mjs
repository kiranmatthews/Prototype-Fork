import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const near = (actual, expected, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );
};

try {
  const {
    NON_BEACH_ROLL_FRICTION_MULTIPLIER,
    skateGroundFrictionRate,
    setLegacyVisualSurfaceFrictionReplay,
    surfaceKindFromGroundObject,
  } = await server.ssrLoadModule('/src/surfaceFriction.ts');
  const { Recorder, Replayer, isReplayFile } = await server.ssrLoadModule('/src/replay.ts');

  const paintedPlatform = (kind) => {
    const material = new THREE.MeshBasicMaterial();
    material.userData.texKind = kind;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.name = 'platform';
    return mesh;
  };
  const sand = paintedPlatform('sand');
  const grass = paintedPlatform('grass');
  const jungle = paintedPlatform('jungle');
  const stone = paintedPlatform('stone');
  assert.equal(surfaceKindFromGroundObject(sand, sand.name), 'sand');
  assert.equal(surfaceKindFromGroundObject(grass, grass.name), 'grass');
  assert.equal(surfaceKindFromGroundObject(jungle, jungle.name), 'grass');
  assert.equal(surfaceKindFromGroundObject(stone, stone.name), 'stone');
  assert.equal(sand.name, 'platform', 'surface classification rewrote structural names');

  const values = {
    speed: 20,
    steep: false,
    steepFriction: 7,
    rollFriction: 3.5,
    windDrag: 0.0015,
  };
  const wind = values.windDrag * values.speed * values.speed;
  const ordinaryRate = skateGroundFrictionRate({
    ...values,
    surface: 'stone',
    beachSand: false,
  });
  const beachSandRate = skateGroundFrictionRate({
    ...values,
    surface: 'sand',
    beachSand: true,
  });
  near(
    ordinaryRate,
    values.rollFriction * NON_BEACH_ROLL_FRICTION_MULTIPLIER + wind,
  );
  near(beachSandRate, values.rollFriction + wind);
  assert.ok(ordinaryRate < beachSandRate * 0.3,
    'ordinary ground retained the full Beach-sand rolling resistance');

  // Texture categories remain useful for dust, but cannot opt into movement
  // drag. Test Course sand, Jungle grass, stone and asphalt all feed the same
  // ordinary-ground physics unless a Beach builder adds the explicit tag.
  for (const visualObject of [sand, grass, jungle, stone, paintedPlatform('asphalt')]) {
    assert.notEqual(surfaceKindFromGroundObject(visualObject, visualObject.name), undefined);
    near(
      skateGroundFrictionRate({
        ...values,
        surface: surfaceKindFromGroundObject(visualObject, visualObject.name),
        beachSand: visualObject.userData.beachSandFriction === true,
      }),
      ordinaryRate,
      1e-12,
    );
  }

  // The exception is deliberately flat-rollout-only. Slopes, wind, braking,
  // overspeed drag and pipe rules remain owned by their existing systems.
  near(
    skateGroundFrictionRate({
      ...values,
      surface: 'stone',
      beachSand: false,
      steep: true,
    }),
    values.steepFriction,
  );
  near(
    skateGroundFrictionRate({
      ...values,
      surface: 'sand',
      beachSand: true,
      steep: true,
    }),
    values.steepFriction,
  );

  setLegacyVisualSurfaceFrictionReplay(true);
  near(
    skateGroundFrictionRate({
      ...values,
      surface: 'stone',
      beachSand: false,
    }),
    values.rollFriction + wind,
    1e-12,
  );
  near(
    skateGroundFrictionRate({
      ...values,
      surface: 'grass',
      beachSand: false,
    }),
    ordinaryRate,
    1e-12,
  );
  setLegacyVisualSurfaceFrictionReplay(false);

  const recorder = new Recorder();
  recorder.start('test');
  const modernReplay = recorder.export();
  assert.equal(modernReplay.surfaceFrictionPolicy, 1,
    'new replay did not stamp the explicit Beach-sand policy');
  assert.equal(isReplayFile(modernReplay), true);
  assert.equal(isReplayFile({ ...modernReplay, surfaceFrictionPolicy: 2 }), false);

  const legacyReplay = { ...modernReplay };
  delete legacyReplay.surfaceFrictionPolicy;
  const replayer = new Replayer();
  replayer.begin(legacyReplay);
  near(
    skateGroundFrictionRate({
      ...values,
      surface: 'stone',
      beachSand: false,
    }),
    values.rollFriction + wind,
    1e-12,
  );
  replayer.end();
  near(
    skateGroundFrictionRate({
      ...values,
      surface: 'stone',
      beachSand: false,
    }),
    ordinaryRate,
    1e-12,
  );

  const [beachfrontSource, levelSource] = await Promise.all([
    readFile(new URL('../src/beachfront.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/level.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(beachfrontSource, /sand\.userData\.beachSandFriction = true/,
    'Beachside Run sand did not opt into full surface drag');
  assert.match(levelSource,
    /sand\.name = "Showcase1ContinuousSandSeabed";[\s\S]{0,240}sand\.userData\.beachSandFriction = true/,
    'The Descent beach sand did not opt into full surface drag');
  assert.match(levelSource,
    /if \(c\.shoreProfile\) \{[\s\S]{0,320}c\.tex === "sand"[\s\S]{0,80}beachSandFriction = true/,
    'Island Hopper shore-profile sand did not opt into full surface drag');

  console.log('PASS material-independent rollout, explicit Beach-sand drag, and structural surface names');
} finally {
  await server.close();
}
