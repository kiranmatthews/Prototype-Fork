import assert from 'node:assert/strict';
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
    GRASS_ROLL_FRICTION_MULTIPLIER,
    skateGroundFrictionRate,
    surfaceKindFromGroundObject,
  } = await server.ssrLoadModule('/src/surfaceFriction.ts');

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
  assert.equal(surfaceKindFromGroundObject(sand, sand.name), 'sand');
  assert.equal(surfaceKindFromGroundObject(grass, grass.name), 'grass');
  assert.equal(surfaceKindFromGroundObject(jungle, jungle.name), 'grass');
  assert.equal(sand.name, 'platform', 'surface classification rewrote structural names');

  const values = {
    speed: 20,
    steep: false,
    steepFriction: 7,
    rollFriction: 3.5,
    windDrag: 0.0015,
  };
  const wind = values.windDrag * values.speed * values.speed;
  const sandRate = skateGroundFrictionRate({ ...values, surface: 'sand' });
  const genericRate = skateGroundFrictionRate({ ...values, surface: 'generic' });
  const grassRate = skateGroundFrictionRate({ ...values, surface: 'grass' });
  near(sandRate, values.rollFriction + wind);
  near(genericRate, sandRate, 1e-12);
  near(grassRate, values.rollFriction * GRASS_ROLL_FRICTION_MULTIPLIER + wind);
  assert.ok(grassRate < sandRate * 0.3,
    'grass retained the full sand/hard-surface rollout resistance');

  // The exception is deliberately flat-rollout-only. Slopes, wind, braking,
  // overspeed drag and pipe rules remain owned by their existing systems.
  near(
    skateGroundFrictionRate({ ...values, surface: 'grass', steep: true }),
    values.steepFriction,
  );
  near(
    skateGroundFrictionRate({ ...values, surface: 'sand', steep: true }),
    values.steepFriction,
  );

  console.log('PASS grass momentum carry, full sand rollout, and structural surface names');
} finally {
  await server.close();
}
