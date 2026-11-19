import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cargoFps, cargoTakes, sampleCargoTake, type CargoTake } from '../../src/character/cargoRiderPerformance';
import type { CargoRider } from '../../src/character/cargoRider';

export async function verifyTakes(skin: CargoRider, playerHead: THREE.Object3D) {
  const file = await new GLTFLoader().loadAsync(new URL('characters/cargo-rider/cargo-roo.glb', location.origin + import.meta.env.BASE_URL).href);
  const mixer = new THREE.AnimationMixer(file.scene);
  const source = new Map<string, THREE.SkinnedMesh>();
  file.scene.traverse(n => { if (n instanceof THREE.SkinnedMesh) source.set(n.name, n); });
  const bone = file.scene.getObjectByName('head')!;
  const base = bone.quaternion.clone();
  const baseWorld = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const standaloneTurn = new THREE.Quaternion(), runtimeTurn = new THREE.Quaternion();
  const relative = new THREE.Matrix4();
  const palette = skin.meshes[0].skeleton;
  const headPalette = palette.getBoneByName('head')!;
  if (file.animations.length !== Object.keys(cargoTakes).length) throw Error('Facial clip count');
  const expectations = new Map<string, number>();
  const result = [];
  for (const [id, take] of Object.entries(cargoTakes)) {
    const name = id as CargoTake;
    const clip = THREE.AnimationClip.findByName(file.animations, name);
    if (!clip || Math.abs(clip.duration - take.frames / cargoFps) > .00002) throw Error('Clip duration: ' + name);
    const clipAction = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    clipAction.clampWhenFinished = true;
    clipAction.reset().play();
    skin.playTake(name);
    const channelNames = new Set(Object.keys(take.tracks));
    for (const side of ['.L','.R']) if (channelNames.has('Blink' + side)) channelNames.add('LidArc' + side);
    const readers = skin.meshes.flatMap(mesh => {
      const imported = source.get(mesh.name)!;
      return Object.entries(mesh.morphTargetDictionary ?? {}).filter(([n]) => channelNames.has(n)).map(([n, i]) =>
        ({n, local: mesh.morphTargetInfluences!, i, imported: imported.morphTargetInfluences!, j: imported.morphTargetDictionary![n]}));
    });
    if (!readers.length) throw Error('Unbound take: ' + name);
    let maxError = 0, headDegrees = 0, peak = 0;
    for (let frame = 0; frame <= take.frames; frame++) {
      if (frame) skin.step(1 / cargoFps, 0, false);
      mixer.update(frame ? 1 / cargoFps : 0);
      expectations.clear();
      sampleCargoTake(name, frame, expectations);
      for (const side of ['.L','.R']) {
        const blink = expectations.get('Blink' + side);
        if (blink !== undefined) {
          expectations.set('LidArc' + side, 4 * blink * (1 - blink));
          const angle = expectations.get('LidAngle' + side);
          if (angle !== undefined) expectations.set('LidAngle' + side, angle * (1 - blink));
        }
      }
      for (const r of readers) {
        const want = expectations.get(r.n)!;
        maxError = Math.max(maxError, Math.abs(r.local[r.i] - want), Math.abs(r.imported[r.j] - want));
        peak = Math.max(peak, r.local[r.i]);
        if (maxError > .000025) throw Error([name, frame, r.n, want, r.local[r.i], r.imported[r.j]].join(' / '));
        if ((frame === 0 || frame === take.frames) && (want > 1e-6 || r.local[r.i] > 1e-6))
          throw Error('Failure to seal neutral endpoints: ' + name);
      }
      headDegrees = Math.max(headDegrees, THREE.MathUtils.radToDeg(base.angleTo(bone.quaternion)));
      if (take.head) {
        palette.update();
        relative.copy(playerHead.matrixWorld).invert().multiply(headPalette.matrixWorld);
        runtimeTurn.setFromRotationMatrix(relative).normalize();
        bone.getWorldQuaternion(standaloneTurn).multiply(baseWorld).normalize();
        if (runtimeTurn.angleTo(standaloneTurn) > .0004) throw Error('Game and GLB head rotation at frame ' + frame);
      }
    }
    if (name === 'kling1910' && (headDegrees < 12 || base.angleTo(bone.quaternion) > .001)) throw Error('Head attitude loop');
    if (peak < .14) throw Error('Static performance: ' + name);
    result.push({name, frames: take.frames + 1, bindings: readers.length, maxError, headDegrees});
    clipAction.stop();
  }
  skin.selectExpression('live');
  mixer.stopAllAction();
  mixer.uncacheRoot(file.scene);
  return result;
}
