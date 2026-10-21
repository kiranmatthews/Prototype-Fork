import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

// A whole bind-pose hull misses blended cloth that becomes the lowest surface
// when the pelvis and thighs fold in different directions. Exercise the actual
// garment skin, independent of the handful of naturally sampled bail poses.
await withSkateRuntime(async ({ THREE, server, player:p }) => {
  const { CharacterInteractionBounds } = await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const mesh = p.meshyShorts.mesh, measure = new CharacterInteractionBounds();
  const normal = new THREE.Vector3(0, 1, 0), origin = new THREE.Vector3(), box = new THREE.Box3();
  let maximumError = 0, maximumSamples = 0, minimumError = Infinity;
  for (let pose = 0; pose < 240; pose++) {
    p.legL.rotation.set(.8 + Math.sin(pose * .31) * 1.4, Math.sin(pose * .43) * .5, Math.cos(pose * .71) * .7);
    p.legR.rotation.set(.8 + Math.cos(pose * .37) * 1.4, Math.cos(pose * .19) * .5, -Math.sin(pose * .67) * .7);
    p.bodyGroup.rotation.set(pose * .29, pose * .17, pose * .43);
    p.meshyShorts.setLegStretch(.8 + .3 * Math.sin(pose * .3), .8 + .3 * Math.cos(pose * .27));
    p.group.updateMatrixWorld(true); measure.measure(p.riderG, box, true, true);
    const sparse = measure.sampledPlaneDistance(mesh, normal, origin);
    maximumSamples = Math.max(maximumSamples, measure.supportSamples);
    const exact = measure.minimumPlaneDistance(mesh, normal, origin);
    const error = sparse - exact;
    maximumError = Math.max(maximumError, error); minimumError = Math.min(minimumError, error);
    assert.ok(error >= -1e-9 && error <= .037, `pose ${pose}: cloth support missed the surface by ${error}m`);
  }
  assert.ok(maximumSamples < mesh.geometry.attributes.position.count / 4, 'cloth support became a full skin scan');
  const result = { passed:true, poses:240, maximumError, minimumError, maximumSamples, vertices:mesh.geometry.attributes.position.count };
  const report = process.argv.find(a => a.startsWith('--report='))?.slice(9);
  if (report) await writeFile(report, JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
});
