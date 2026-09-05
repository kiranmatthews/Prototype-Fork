import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';

const near = (a, b, why, tolerance = 1e-9) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${why}: ${a} != ${b}`);
const server = await createServer({
  appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
});

try {
  const { cameraRigFraming, setCameraRigAim, legacyCameraRigTuning, migrateLegacySavedCameraRig } =
    await server.ssrLoadModule('/src/cameraRig.ts');
  const { TUNING, TUNING_VERSION } = await server.ssrLoadModule('/src/tuning.ts');
  const { Replayer } = await server.ssrLoadModule('/src/replay.ts');
  assert.equal(TUNING_VERSION, 18);
  const saved = { ...TUNING };
  const camera = new THREE.PerspectiveCamera(49, 16 / 9, 0.1, 400);
  const aim = new THREE.Vector3();
  const forward = new THREE.Vector3(0.6, 0, -0.8);
  const dir = new THREE.Vector3();
  const shot = (tuning, profile) => {
    const framing = cameraRigFraming(tuning, ...profile);
    camera.position.set(-forward.x * framing.distance, framing.height, -forward.z * framing.distance);
    setCameraRigAim(aim, camera.position, forward, framing.pitch);
    camera.lookAt(aim);
    return { ...framing, position: camera.position.clone(), quaternion: camera.quaternion.clone() };
  };

  // Exercise all authored modes, including a transition. Each control changes
  // exactly its own degree of freedom, with the lane already turned in XZ.
  for (const profile of [[], [1], [0, 1], [0, 0, 1], [0.3, 0.4, 0.2], [0, 0, 0, true]]) {
    const base = shot(saved, profile);
    const raised = shot({ ...saved, camHeight: saved.camHeight + 2 }, profile);
    near(raised.position.y - base.position.y, 2, 'height is not a pure vertical move');
    near(raised.position.x, base.position.x, 'height changed X');
    near(raised.position.z, base.position.z, 'height changed Z');
    near(raised.quaternion.angleTo(base.quaternion), 0, 'height changed orientation', 1e-7);
    const farther = shot({ ...saved, camDist: saved.camDist + 3 }, profile);
    near(farther.position.y, base.position.y, 'distance changed height');
    near(farther.position.distanceTo(base.position), 3, 'distance is not a 3m translation');
    near(farther.quaternion.angleTo(base.quaternion), 0, 'distance changed orientation', 1e-7);
    const tilted = shot({ ...saved, camPitch: saved.camPitch + 10 }, profile);
    near(tilted.position.distanceTo(base.position), 0, 'tilt moved camera');
    near(THREE.MathUtils.radToDeg(tilted.quaternion.angleTo(base.quaternion)), 10, 'tilt is not degrees');
  }

  // A moving/damped eye must not tilt toward an independently lagging target.
  // Include negative distance, horizon, upward tilt, and near-vertical limits.
  for (const pitch of [-85, 0, 25.35, 85]) {
    for (let frame = 0; frame <= 60; frame++) {
      camera.position.set(-2 + frame * 0.2, 0.5 + frame * 0.15, 24 - frame * 0.4);
      setCameraRigAim(aim, camera.position, forward, pitch);
      camera.lookAt(aim);
      camera.getWorldDirection(dir);
      near(THREE.MathUtils.radToDeg(-Math.asin(dir.y)), pitch, 'translation changed effective pitch');
      near(Math.atan2(dir.x, dir.z), Math.atan2(forward.x, forward.z), 'translation changed yaw');
    }
  }

  const legacy = { camDist: 3.8, camHeight: 5.1, camTilt: 3.3, camOffset: -1.25 };
  near(legacyCameraRigTuning(legacy).camDist, 5.05, 'legacy offset was not folded into distance');
  near(legacyCameraRigTuning(legacy).camPitch, saved.camPitch, 'default shot changed', 0.005);
  assert.equal(migrateLegacySavedCameraRig(legacy, legacy), null, 'untouched save masked new defaults');
  assert.equal(migrateLegacySavedCameraRig(saved, saved), null, 'modern save was migrated twice');
  assert.equal(legacyCameraRigTuning({ camTilt: NaN }), null);
  for (const patch of [{ camHeight: 7 }, { camDist: 9 }, { camOffset: 2 }, { camTilt: 8 }]) {
    const old = { ...legacy, ...patch };
    const migrated = migrateLegacySavedCameraRig(old, legacy);
    assert.ok(migrated, 'deliberate old camera edit was lost');
    const eye = new THREE.Vector3(0, old.camHeight, old.camDist - old.camOffset);
    const oldAim = new THREE.Vector3(0, old.camTilt, -old.camOffset);
    const oldDir = oldAim.sub(eye).normalize();
    setCameraRigAim(aim, eye, { x: 0, z: -1 }, migrated.camPitch);
    near(aim.sub(eye).normalize().distanceTo(oldDir), 0, 'saved shot orientation changed');
    near(migrated.camDist, eye.z, 'saved eye position changed');
  }

  // Complete pre-v18 replays and their live tuning edits must be translated
  // together; old camHeight/camDist changes intentionally changed their pitch.
  const replay = new Replayer();
  const file = {
    v: 2, level: 'test', date: '', tuning: legacy,
    tuningChanges: [[0, 'camHeight', 7], [1, 'camDist', 8], [1, 'camOffset', 2], [2, 'camTilt', 4]],
    mx: [0, 0, 0], my: [0, 0, 0], b: [0, 0, 0], frames: 3, truncated: false,
  };
  const input = {};
  replay.begin(file);
  near(TUNING.camDist, 5.05, 'old replay initial distance');
  const currentLegacy = { ...legacy };
  for (let frame = 0; frame < 3; frame++) {
    assert.equal(replay.feed(input), true);
    for (const [f, key, value] of file.tuningChanges) if (f === frame) currentLegacy[key] = value;
    const expected = legacyCameraRigTuning(currentLegacy);
    near(TUNING.camDist, expected.camDist, 'old replay distance edit');
    near(TUNING.camPitch, expected.camPitch, 'old replay pitch edit');
    assert.equal('camTilt' in TUNING, false);
    assert.equal('camOffset' in TUNING, false);
  }
  assert.equal(replay.feed(input), false);
  assert.deepEqual(TUNING, saved, 'replay end did not restore live tuning');
  replay.begin({ ...file, tuning: saved, tuningChanges: [[0, 'camHeight', 8], [1, 'camDist', 12]] });
  replay.feed(input); replay.feed(input);
  near(TUNING.camPitch, saved.camPitch, 'modern replay recoupled height/distance to pitch');
  replay.end();
  assert.deepEqual(TUNING, saved);
  console.log('PASS independent camera controls, moving-eye pitch stability, saved-shot migration and replay compatibility');
} finally {
  await server.close();
}
