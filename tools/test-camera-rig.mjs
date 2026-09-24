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
  assert.ok(TUNING_VERSION >= 18);
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

  // Authored compositions share the heading volume's feather and leave the
  // underlying live camera intact, including its independent pitch and lens.
  const { CameraViewFraming, cameraViewAt, cameraViewDirection } = await server.ssrLoadModule('/src/cameraViews.ts');
  const view={p:[0,0,0],s:[40,60,30],yaw:0,feather:10,
    cameraPosition:[0,9,39],cameraTarget:[0,6,-7],cameraFov:43};
  const layer=new CameraViewFraming();
  const baseline=shot(saved,[]),baseFov=camera.fov;
  near(cameraViewAt([view],0,0,0).weight,1,'interior shot did not fully settle');
  near(cameraViewAt([view],15,0,0).weight,.5,'shot feather disagrees with its boundary');
  assert.equal(cameraViewAt([view],20,0,0),null,'shot leaks outside its bounds');
  const fixedHeading=cameraViewDirection([view],0,0,0,{x:1,z:0});near(fixedHeading.x,0,"fixed heading X");near(fixedHeading.z,-1,"fixed heading Z");
  const expected=new THREE.PerspectiveCamera();expected.position.fromArray(view.cameraPosition);expected.lookAt(...view.cameraTarget);
  layer.apply(camera,cameraViewAt([view],0,0,0));
  near(camera.position.distanceTo(expected.position),0,'fixed view eye');
  near(camera.quaternion.angleTo(expected.quaternion),0,'fixed view target',1e-7);
  near(camera.fov,43,'fixed view lens');
  layer.restore(camera);
  near(camera.position.distanceTo(baseline.position),0,'shot polluted follow position');
  near(camera.quaternion.angleTo(baseline.quaternion),0,'shot polluted follow orientation',1e-7);
  near(camera.fov,baseFov,'shot polluted follow lens');
  for(let frame=0;frame<60;frame++){
    camera.position.x=frame*.1;
    const normal=camera.position.clone();
    layer.apply(camera,cameraViewAt([view],15,0,0));
    near(camera.position.distanceTo(normal.clone().lerp(expected.position,.5)),0,'partial shot accumulated feedback');
    near(camera.fov,(baseFov+43)/2,'partial lens accumulated feedback');
    layer.restore(camera);
    near(camera.position.distanceTo(normal),0,'moving follow position was not restored');
  }
  layer.apply(camera,null);near(camera.fov,baseFov,'exiting a volume kept its lens');
  const headingOnly={...view};delete headingOnly.cameraPosition;delete headingOnly.cameraTarget;delete headingOnly.cameraFov;
  const beforeLegacy=camera.position.clone();layer.apply(camera,cameraViewAt([headingOnly],0,0,0));
  near(camera.position.distanceTo(beforeLegacy),0,'legacy heading-only view changed framing');

  // A narrow app panel must still show both ends of an authored wide shot.
  const wideShot={...view,cameraPosition:[-1,8.5,36],cameraTarget:[-1,5.5,-5],cameraFov:46,cameraAspect:16/9};
  const projected=[];
  for(const aspect of [16/9,4/3,1,390/844]){
    const panelCamera=new THREE.PerspectiveCamera(49,aspect,.1,400),panelLayer=new CameraViewFraming();
    panelLayer.apply(panelCamera,{view:wideShot,weight:1});panelCamera.updateMatrixWorld(true);
    const edges=[new THREE.Vector3(-24,8,-5),new THREE.Vector3(21,4,0)].map(p=>p.project(panelCamera).x);
    assert.ok(edges.every(x=>Math.abs(x)<.95),'narrow panel cropped a landmark');
    projected.push(edges);
  }
  for(const edges of projected.slice(1))for(let i=0;i<2;i++)near(edges[i],projected[0][i],'horizontal shot composition changed');

  // The opening remains wide until movement, then dollies in without a yaw
  // or pitch change and tracks a descending player. Backtracking stays close.
  const tracking={...wideShot,cameraFollowDistance:14.5,cameraIntroDistance:4};
  const follower=new CameraViewFraming(),subject=new THREE.Vector3(-17,8.4,0);
  const heading=new THREE.Vector3().fromArray(tracking.cameraTarget).sub(new THREE.Vector3().fromArray(tracking.cameraPosition)).normalize();
  follower.apply(camera,{view:tracking,weight:1},subject,true);
  near(camera.position.distanceTo(new THREE.Vector3(...tracking.cameraPosition)),0,'opening pose changed before movement');
  follower.restore(camera);
  for(let i=1;i<=80;i++){
    subject.set(-17+i*.1,8.4-i*.07,i*.04);
    follower.apply(camera,{view:tracking,weight:1},subject);
    near(camera.getWorldDirection(dir).distanceTo(heading),0,'dolly rotated the authored view',1e-7);
    if(i>=40)near(camera.position.distanceTo(subject.clone().add(new THREE.Vector3(0,1.3,0))),14.5,'close camera lost player');
    follower.restore(camera);
  }
  follower.apply(camera,null,subject);
  subject.set(-17,8.4,0);
  follower.apply(camera,{view:tracking,weight:1},subject);
  near(camera.position.distanceTo(subject.clone().add(new THREE.Vector3(0,1.3,0))),14.5,'return to balcony zoomed out');
  follower.restore(camera);
  follower.apply(camera,{view:tracking,weight:1},subject,true);
  near(camera.position.distanceTo(new THREE.Vector3(...tracking.cameraPosition)),0,'restart did not restore establishing shot');
  follower.restore(camera);

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
  console.log('PASS independent camera controls, moving-eye pitch stability, authored view blending, saved-shot migration and replay compatibility');
} finally {
  await server.close();
}
