import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { createServer } from 'vite';

const near = (actual, expected, message, tolerance = 1e-10) => {
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
    CAMERA_LOOK_LIMITS,
    CameraLookOffset,
    shapeLookStick,
  } = await server.ssrLoadModule('/src/cameraLook.ts');

  // The right stick uses a radial deadzone and radial saturation. In
  // particular, a square-cornered browser gamepad report must not make a
  // diagonal peek stronger than a cardinal one.
  assert.deepEqual(shapeLookStick(0, 0), { x: 0, y: 0 });
  assert.deepEqual(
    shapeLookStick(CAMERA_LOOK_LIMITS.deadzone, 0),
    { x: 0, y: 0 },
    'the deadzone boundary leaked look input',
  );
  const takeUp = shapeLookStick(CAMERA_LOOK_LIMITS.deadzone + 0.01, 0);
  assert.ok(takeUp.x > 0 && takeUp.x < 0.01,
    'right-stick take-up was not softly eased beyond the deadzone');
  near(shapeLookStick(1, 0).x, 1, 'full right stick lost full intent');
  near(shapeLookStick(-1, 0).x, -1, 'full left stick lost full intent');
  near(shapeLookStick(0, 1).y, 1, 'full up stick lost full intent');
  near(shapeLookStick(0, -1).y, -1, 'full down stick lost full intent');

  const diagonal = shapeLookStick(1, 1);
  near(Math.hypot(diagonal.x, diagonal.y), 1,
    'diagonal right-stick intent escaped radial saturation');
  near(diagonal.x, Math.SQRT1_2,
    'diagonal right-stick X was not direction-preserving');
  near(diagonal.y, Math.SQRT1_2,
    'diagonal right-stick Y was not direction-preserving');
  assert.deepEqual(shapeLookStick(Number.NaN, Number.POSITIVE_INFINITY), { x: 0, y: 0 });
  assert.deepEqual(shapeLookStick(0.1, 0, Number.NaN), { x: 0, y: 0 });

  // Neutral is an exact no-op: the established camera pose and authored aim
  // remain byte-for-byte untouched when nobody is peeking.
  const neutral = new CameraLookOffset();
  const neutralCamera = new THREE.PerspectiveCamera(49, 16 / 9, 0.1, 400);
  neutralCamera.position.set(1.25, 5.1, 3.8);
  const neutralAim = new THREE.Vector3(-0.3, 2.2, -4.4);
  neutralCamera.lookAt(neutralAim);
  const neutralPosition = neutralCamera.position.clone();
  const neutralQuaternion = neutralCamera.quaternion.clone();
  const neutralAimBefore = neutralAim.clone();
  assert.deepEqual(neutral.step(0, 0, 1 / 60), { yaw: 0, pitch: 0 });
  neutral.apply(neutralCamera, neutralAim);
  assert.ok(neutralCamera.position.equals(neutralPosition),
    'neutral look moved the authored camera position');
  assert.ok(neutralCamera.quaternion.equals(neutralQuaternion),
    'neutral look changed the authored camera orientation');
  assert.ok(neutralAim.equals(neutralAimBefore),
    'neutral look mutated the authored aim point');

  // Constant-target exponential easing is independent of render-frame
  // subdivision. It arrives gently, never overshoots, and respects the small
  // asymmetric vertical envelope.
  const once = new CameraLookOffset();
  const twice = new CameraLookOffset();
  once.step(1, 1, 1 / 30);
  twice.step(1, 1, 1 / 60);
  twice.step(1, 1, 1 / 60);
  near(once.yaw, twice.yaw, 'look yaw changed with frame subdivision');
  near(once.pitch, twice.pitch, 'look pitch changed with frame subdivision');
  assert.ok(once.yaw > 0 && once.yaw < CAMERA_LOOK_LIMITS.yaw * 0.2,
    'look yaw did not ease gently away from neutral');
  assert.ok(once.pitch > 0 && once.pitch < CAMERA_LOOK_LIMITS.pitchUp * 0.2,
    'look pitch did not ease gently away from neutral');

  const capped = new CameraLookOffset();
  capped.step(20, 20, 20);
  assert.ok(capped.yaw > 0 && capped.yaw <= CAMERA_LOOK_LIMITS.yaw,
    'right look exceeded its yaw cap');
  assert.ok(capped.pitch > 0 && capped.pitch <= CAMERA_LOOK_LIMITS.pitchUp,
    'up look exceeded its pitch cap');
  near(capped.yaw, CAMERA_LOOK_LIMITS.yaw,
    'full held look failed to approach the yaw cap', 1e-12);
  near(capped.pitch, CAMERA_LOOK_LIMITS.pitchUp,
    'full held look failed to approach the up cap', 1e-12);
  capped.reset();
  capped.step(-20, -20, 20);
  assert.ok(capped.yaw < 0 && capped.yaw >= -CAMERA_LOOK_LIMITS.yaw,
    'left look exceeded its yaw cap');
  assert.ok(capped.pitch < 0 && capped.pitch >= -CAMERA_LOOK_LIMITS.pitchDown,
    'down look exceeded its pitch cap');
  near(capped.pitch, -CAMERA_LOOK_LIMITS.pitchDown,
    'full held look failed to approach the down cap', 1e-12);

  // Releasing the stick recentres through the deliberately slower response,
  // rather than snapping or overshooting through neutral.
  const recenter = new CameraLookOffset();
  recenter.step(1, 1, 20);
  const heldYaw = recenter.yaw;
  const heldPitch = recenter.pitch;
  recenter.step(0, 0, 1 / 60);
  assert.ok(recenter.yaw > heldYaw * 0.9 && recenter.yaw < heldYaw,
    'yaw did not begin a slow monotonic recenter');
  assert.ok(recenter.pitch > heldPitch * 0.9 && recenter.pitch < heldPitch,
    'pitch did not begin a slow monotonic recenter');
  for (let i = 0; i < 60 * 7; i++) recenter.step(0, 0, 1 / 60);
  assert.equal(recenter.yaw, 0, 'released yaw never settled exactly at neutral');
  assert.equal(recenter.pitch, 0, 'released pitch never settled exactly at neutral');

  // Applying the offset rotates only the view. Positive intent means screen
  // right/up and neither the camera position nor supplied aim can be consumed.
  const applied = new CameraLookOffset();
  applied.step(1, 1, 20);
  const appliedCamera = new THREE.PerspectiveCamera(49, 16 / 9, 0.1, 400);
  appliedCamera.position.set(0, 0, 10);
  const appliedAim = new THREE.Vector3(0, 0, 0);
  appliedCamera.lookAt(appliedAim);
  const appliedPosition = appliedCamera.position.clone();
  const appliedAimBefore = appliedAim.clone();
  applied.apply(appliedCamera, appliedAim);
  const direction = new THREE.Vector3();
  appliedCamera.getWorldDirection(direction);
  assert.ok(direction.x > 0, 'positive look yaw did not peek screen-right');
  assert.ok(direction.y > 0, 'positive look pitch did not peek upward');
  assert.ok(appliedCamera.position.equals(appliedPosition),
    'camera look translated the camera');
  assert.ok(appliedAim.equals(appliedAimBefore),
    'camera look mutated the authored aim');

  const [inputSource, touchSource, mainSource, replaySource] = await Promise.all([
    readFile(new URL('../src/input.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/touch.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/replay.ts', import.meta.url), 'utf8'),
  ]);

  // Standard-mapping axes 2/3 are presentation axes only; left-stick
  // movement keeps its existing path and vertical browser axes are inverted.
  assert.match(inputSource,
    /shapeLookStick\(pad\.axes\[2\] \?\? 0, -\(pad\.axes\[3\] \?\? 0\)\)/,
    'Input is not reading the standard right-stick axes');
  assert.match(inputSource, /lookX = tc\.lookX;\s*lookY = tc\.lookY;/,
    'touch look does not merge through Input');
  assert.match(inputSource,
    /Math\.hypot\(pad\.axes\[2\] \?\? 0, pad\.axes\[3\] \?\? 0\) > 0\.35/,
    'P2 cannot claim a controller using the right stick');
  assert.match(inputSource,
    /armMenuReleaseGuard\(\): void \{[\s\S]*?this\.lookX = 0;[\s\S]*?this\.lookY = 0;/,
    'menu handoff can retain stale look intent');

  // Touch look owns only the unobstructed upper 38%; the higher-z-index
  // movement/face zones retain all existing gestures. Every release/loss and
  // modal/tool surface clears or excludes the look pointer.
  const lookSurface = touchSource.match(
    /\.tc-look \{\s*position: fixed; top: 0; left: 0; width: 100vw; height: 38%; z-index: (\d+);/,
  );
  const controlSurface = touchSource.match(
    /\.tc-zone \{\s*position: fixed; bottom: 0; z-index: (\d+);/,
  );
  assert.ok(lookSurface,
    'touch look is not confined to the upper 38% surface');
  assert.ok(controlSurface && Number(lookSurface[1]) < Number(controlSurface[1]),
    'touch look can intercept the established controls');
  assert.match(touchSource,
    /zone\.addEventListener\('pointerup', up\);\s*zone\.addEventListener\('pointercancel', up\);\s*zone\.addEventListener\('lostpointercapture', up\);/,
    'touch look does not clear on every pointer-release path');
  assert.match(touchSource,
    /window\.addEventListener\('blur', \(\) => this\.clearLook\(\)\)/,
    'touch look does not clear when the app backgrounds');
  for (const blockedClass of [
    'game-shell-modal',
    'ed-active',
    'tool-panel-open',
    'character-lab-open',
    'animation-studio-open',
    'side-panel-left-open',
    'side-panel-right-open',
  ]) {
    assert.match(touchSource, new RegExp(`body\\.${blockedClass.replaceAll('-', '\\-')} \\.tc-look`),
      `touch look is not hidden by ${blockedClass}`);
    assert.match(touchSource, new RegExp(`body\\.contains\\('${blockedClass}'\\)`),
      `touch look is not cleared by ${blockedClass}`);
  }

  // P1 publishes a canonical, un-peeked direction to the simulation. The
  // visual offset is applied afterward, while P2 owns a separate state and
  // still publishes its authored cam2F direction.
  const canonicalAt = mainSource.indexOf('camControlDir.subVectors(aimSmooth, camera.position)');
  const p1ApplyAt = mainSource.indexOf('cameraLook.apply(camera, aimSmooth)');
  assert.ok(canonicalAt >= 0 && p1ApplyAt > canonicalAt,
    'P1 does not capture its canonical direction before visual look');
  assert.match(mainSource,
    /const yaw = camYawOf\(camControlDir\);\s*player\.camDir\.set/,
    'P1 simulation controls do not consume the canonical direction');
  assert.doesNotMatch(mainSource, /camera\.getWorldDirection\(camAimTmp\)/,
    'P1 simulation controls still sample the visually peeked camera');
  assert.match(mainSource, /const cam2Look = new CameraLookOffset\(\)/,
    'P2 does not own an independent look state');
  assert.match(mainSource,
    /cam2Look\.step\(input2\.lookX, input2\.lookY, dt\);\s*cam2Look\.apply\(camera2, cam2Aim\);\s*p2\.camDir\.set\(cam2F\.x, 0, cam2F\.z\);/,
    'P2 look is not independently applied over its canonical control direction');

  // Peek input is presentation-only and must not expand replay v2 or become
  // simulation input. Existing takes therefore remain byte-compatible.
  assert.doesNotMatch(replaySource, /\blook[XY]\b/,
    'camera look leaked into deterministic replay input');

  console.log(
    'PASS gentle camera look deadzone, radial cap, easing/recenter, touch ownership, split independence, and replay isolation',
  );
} finally {
  await server.close();
}
