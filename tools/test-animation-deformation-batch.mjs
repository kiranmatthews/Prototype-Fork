import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import { createServer } from 'vite';

const source = await readFile(new URL('./test-character-lab.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'fixture');
const fixture = new Function('THREE', declaration.getText(ast) + ';return fixture;')(THREE);
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { PlayerAnimationBridge } = await server.ssrLoadModule('/src/animation/bridge.ts');
  const batched = fixture(), eager = fixture();
  const bridge = new PlayerAnimationBridge(batched.root, batched.root), reference = new PlayerAnimationBridge(eager.root, eager.root);
  const snapshot = root => {
    const values = []; root.traverse(n => values.push([n.name, ...n.position.toArray(), ...n.quaternion.toArray(),
      ...n.scale.toArray(), ...(n.morphTargetInfluences ?? [])])); return values;
  };
  let actualPasses = 0, referencePasses = 0, comparisons = 0;
  for (const [target, count] of [[bridge, () => actualPasses++], [reference, () => referencePasses++]]) {
    const apply = target.applyDeformations.bind(target);
    target.applyDeformations = values => { if (!target.deformationBatch) count(); return apply(values); };
  }
  const compare = label => { assert.deepEqual(snapshot(batched.root), snapshot(eager.root), label); comparisons++; };
  for (let frame = 0; frame < 240; frame++) {
    bridge.prepareLegacyPose(); reference.prepareLegacyPose();
    for (const scene of [batched, eager]) {
      const runtime = scene.root.userData.sculptRuntime, torso = scene.nodes.get('meshy-torso-surface');
      scene.nodes.get('spine').position.y = .12 + .02 * Math.sin(frame * .13);
      torso.scale.set(.6, .615, .7); torso.morphTargetInfluences[0] = .1 * Math.sin(frame * .1);
      // Metadata and geometry remain live; batching must not add a cross-frame
      // cache of policies, joint names, hierarchy or morph layouts.
      if (frame === 30) { scene.nodes.get('elbow-left').name = 'renamed-elbow'; runtime.joints.elbowLeft = 'renamed-elbow'; }
      if (frame === 60) { runtime.deformations[2].lengthAxis = [.2, -1, .05]; runtime.deformations[2].volume = 'none'; }
      if (frame === 90) torso.morphTargetInfluences = [.12];
      if (frame === 120) torso.morphTargetInfluences = [.1, -.2, .3];
      if (frame === 150) scene.rider.add(scene.nodes.get('elbow-left'));
      if (frame === 180) scene.nodes.get('shoulder-left').add(scene.nodes.get('elbow-left'));
      if (frame === 210) { scene.savedPolicies = runtime.deformations; runtime.deformations = []; }
      if (frame === 220) runtime.deformations = scene.savedPolicies;
    }
    const policies = batched.root.userData.sculptRuntime.deformations;
    const authored = Object.fromEntries(policies.map((p, i) => [p.controlId, 1 + .15 * Math.sin(frame * .2 + i)]));
    if (policies.length) {
      if (frame % 19 === 0) authored[policies[0].controlId] = NaN;
      else if (frame % 23 === 0) authored[policies[0].controlId] = 4;
      else if (frame % 29 === 0) authored[policies[0].controlId] = 0;
    }
    const factors = { 'deform.torso.length': .9, 'deform.arm.upper.left.length': 1.12 };
    bridge.beginDeformationBatch();
    for (const [scene, target] of [[batched, bridge], [eager, reference]]) {
      target.applyDeformations(authored);
      scene.nodes.get('spine').rotation.x = Math.sin(frame * .13) * .2;
      target.modulateDeformations(factors);
      scene.nodes.get('upper-arm-left').rotation.z = Math.cos(frame * .11) * .3;
      if (frame % 11 === 0) target.applyDeformations({ 'deform.torso.length': 1.07 });
      target.modulateDeformations({ 'deform.torso.length': 1.08, 'deform.arm.lower.left.length': .93 });
    }
    bridge.finishDeformationBatch(); compare(`composed frame ${frame}`);
    assert.equal(bridge.deformationBatch, false); assert.equal(bridge.deformationPending, false);
    const passes = actualPasses; bridge.finishDeformationBatch(); assert.equal(actualPasses, passes, 'finishing twice reapplied strain');
  }
  assert.equal(actualPasses, 240, 'batch did not reduce adjacent layers to one surface pass');
  assert.equal(referencePasses, 742, 'eager oracle did not exercise all layers');
  bridge.prepareLegacyPose(); reference.prepareLegacyPose(); compare('restored after all layers');
  assert.equal(bridge.deformationStates.length, 0);
  assert.equal(bridge.visualDeformations.size + bridge.endpointDeformations.size, 0);

  const clean = fixture(), interrupted = new PlayerAnimationBridge(clean.root, clean.root);
  const neutral = snapshot(clean.root);
  interrupted.beginDeformationBatch(); interrupted.finishDeformationBatch();
  assert.deepEqual(snapshot(clean.root), neutral, 'empty batch changed the pose');
  const values = { 'deform.torso.length': .84 };
  interrupted.beginDeformationBatch(); interrupted.applyDeformations(values); values['deform.torso.length'] = 4;
  assert.equal(interrupted.deformationValue('deform.torso.length'), .84, 'batch retained a mutable caller record');
  interrupted.enterPreview(); interrupted.finishDeformationBatch();
  assert.deepEqual(snapshot(clean.root), neutral, 'preview applied a queued gameplay deformation');
  interrupted.exitPreview();
  interrupted.setOverlay(({ applyDeformations }) => { applyDeformations({ 'deform.torso.length': 1.2 }); throw new Error('overlay failed'); });
  interrupted.beginDeformationBatch(); assert.throws(() => interrupted.applyOverlay(1 / 60), /overlay failed/);
  interrupted.finishDeformationBatch(); assert.deepEqual(snapshot(clean.root), neutral, 'failed overlay leaked queued strain');
  interrupted.setOverlay(null);
  interrupted.beginDeformationBatch(); interrupted.applyDeformations({ 'deform.torso.length': .8 }); interrupted.prepareLegacyPose();
  interrupted.finishDeformationBatch(); assert.deepEqual(snapshot(clean.root), neutral, 'unfinished batch leaked into the next frame');
  interrupted.applyDeformations({ 'deform.torso.length': .9 });
  assert.notDeepEqual(snapshot(clean.root), neutral, 'ordinary public deformation stopped being immediate');
  interrupted.prepareLegacyPose(); assert.deepEqual(snapshot(clean.root), neutral);
  // Permission to defer is not permission to change ordinary overlay API
  // semantics. A callback that reads its endpoints still sees its write now.
  interrupted.setOverlay(({ applyDeformations }) => {
    applyDeformations({ 'deform.torso.length': .9 });
    assert.notDeepEqual(snapshot(clean.root), neutral, 'ordinary overlay write was deferred');
  });
  interrupted.applyOverlay(1 / 60, true); interrupted.finishDeformationBatch(); interrupted.prepareLegacyPose();
  let permitDeferral = false;
  interrupted.setOverlay(({ applyDeformations }) => {
    applyDeformations({ 'deform.torso.length': .9 }, true);
    if (permitDeferral) assert.deepEqual(snapshot(clean.root), neutral, 'opted-in final write was applied early');
    else assert.notDeepEqual(snapshot(clean.root), neutral, 'overlay deferred outside a supported pose batch');
  });
  interrupted.applyOverlay(1 / 60); interrupted.prepareLegacyPose();
  permitDeferral = true;
  interrupted.applyOverlay(1 / 60, true); interrupted.beginDeformationBatch(); interrupted.finishDeformationBatch();
  assert.notDeepEqual(snapshot(clean.root), neutral, 'opted-in layer was lost');
  interrupted.prepareLegacyPose(); assert.deepEqual(snapshot(clean.root), neutral);
  console.log(JSON.stringify({ passed: true, frames: 240, comparisons, actualPasses, referencePasses,
    liveMetadata: true, interruptedBatchesCleared: true, publicWritesImmediate: true }, null, 2));
} finally { await server.close(); }
