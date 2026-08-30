import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const {
    PROCEDURAL_SHIN_LENGTH: lower,
    PROCEDURAL_THIGH_LENGTH: upper,
    solveSagittalLeg,
    solveSagittalLegTarget,
  } = await server.ssrLoadModule('/src/legRig.ts');

  const near = (actual, expected, tolerance = 1e-7) =>
    assert.ok(
      Math.abs(actual - expected) <= tolerance,
      `${actual} is not within ${tolerance} of ${expected}`,
    );

  for (const flex of [0, 0.45, 0.8, 1.4, 2.2]) {
    const pose = solveSagittalLeg(flex);
    near(pose.forwardReach, 0);
    near(pose.hipPitch + pose.kneeFlex + pose.anklePitch, 0);
    assert.ok(Number.isFinite(pose.verticalReach));
    assert.ok(pose.kneeFlex >= 0 && pose.kneeFlex < Math.PI);
  }

  // Representative legacy intents: the fixed-length solve must hit the same
  // virtual ankle target that nonuniform Y scaling used to create.
  for (const [hip, knee, scale] of [
    [-0.35, 0.7, 0.78],
    [-0.5, 1.05, 0.68],
    [-1.2, 2.2, 0.55],
    [-0.9, 1.4, 0.55],
    [0.2, 0.6, 1],
  ]) {
    const lowerPitch = hip + knee;
    const down =
      scale *
      (upper * Math.cos(hip) + lower * Math.cos(lowerPitch));
    const forward =
      -upper * Math.sin(hip) - lower * Math.sin(lowerPitch);
    const pose = solveSagittalLegTarget(down, forward);
    near(pose.verticalReach, down);
    near(pose.forwardReach, forward);
    near(pose.hipPitch + pose.kneeFlex + pose.anklePitch, 0);
  }

  const left = solveSagittalLegTarget(0.34, 0.08);
  const right = solveSagittalLegTarget(0.34, -0.08);
  near(left.kneeFlex, right.kneeFlex);
  near(left.verticalReach, right.verticalReach);
  near(left.forwardReach, -right.forwardReach);

  for (const [down, forward] of [[0, 0], [9, 0], [-9, 3]]) {
    const pose = solveSagittalLegTarget(down, forward);
    for (const value of Object.values(pose)) assert.ok(Number.isFinite(value));
  }

  console.log('PASS procedural fixed-length leg solver');
} finally {
  await server.close();
}
