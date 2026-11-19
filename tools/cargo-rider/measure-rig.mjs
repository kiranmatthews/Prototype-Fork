import { writeFile } from 'node:fs/promises';
import { withSkateRuntime } from '../jungle-cup-harness.mjs';

// Reproduce the calibration stance from the production skeleton and its shipped proportions.
await withSkateRuntime(async ({ THREE, Player }) => {
  const rider = new Player(new THREE.Scene());
  rider.characterProportionLayer.clear();
  const root = rider.bodyGroup.getObjectByName('procedural-rider');
  for (const [side, sign] of [['left', 1], ['right', -1]]) {
    root.getObjectByName(`shoulder-${side}`).rotation.z += sign * THREE.MathUtils.degToRad(10);
    root.getObjectByName(`hip-${side}`).rotation.z += sign * THREE.MathUtils.degToRad(9);
    root.getObjectByName(`ankle-${side}`).rotation.z -= sign * THREE.MathUtils.degToRad(9);
  }
  rider.syncCharacterAppearance();
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const rig = rider.bodyGroup.userData.sculptRuntime;
  const names = new Set([...Object.values(rig.joints), 'head-presentation', 'hand-rest-orientation-left', 'hand-rest-orientation-right', ...Object.values(rig.sockets)]);
  const records = {};
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (!node) continue;
    let parent = node.parent;
    while (parent && !names.has(parent.name)) parent = parent.parent;
    records[name] = { parent: parent?.name ?? null, matrix: inverse.clone().multiply(node.matrixWorld).toArray().map(v => +v.toFixed(9)) };
  }
  await writeFile(new URL('./calibration.json', import.meta.url), JSON.stringify(records, null, 1) + '\n');
});
