import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import { createServer } from 'vite';

const source = await readFile(new URL('./test-character-lab.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'fixture');
const fixture = new Function('THREE', `${declaration.getText(ast)}; return fixture;`)(THREE);
const server = await createServer({ appType:'custom', logLevel:'silent', server:{middlewareMode:true} });
try {
  const { resolveStretchableBone, STRETCHABLE_BONE_SCHEMA_VERSION } =
    await server.ssrLoadModule('/src/character/stretchableBone.ts');
  const { PlayerAnimationBridge } = await server.ssrLoadModule('/src/animation/bridge.ts');
  const keys = ['shaft','proximalKnob','distalKnob','proximalSocket','distalSocket'];
  const oracle = root => {
    const m = root.userData.stretchableBoneRuntime;
    const result = { root, metadata:m };
    // Required empty names are valid Three.js queries; optional empty names are absent.
    for (const key of keys) result[key] = (key === 'shaft' || key === 'proximalSocket' || key === 'distalSocket' || m[key+'Name'])
      ? root.getObjectByName(m[key+'Name']) ?? null : null;
    return result.shaft && result.proximalSocket && result.distalSocket ? result : null;
  };
  let seed = 2718, reads = 0, oldVisits = 0, newVisits = 0, comparisons = 0;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for (let tree = 0; tree < 80; tree++) {
    const root = new THREE.Group(), nodes = [root];
    for (let i = 0; i < 35; i++) {
      const node = new THREE.Group(); nodes[Math.floor(random()*nodes.length)].add(node); nodes.push(node);
    }
    nodes.forEach((node,i) => {
      let name = i === 0 ? '' : 'part-'+Math.floor(random()*9);
      Object.defineProperty(node,'name',{configurable:true,get(){reads++;return name;},set(value){name=value;}});
    });
    const metadata = {schemaVersion:STRETCHABLE_BONE_SCHEMA_VERSION,kind:'stretchable-cartoon-limb-bone',
      id:'test',surface:'procedural',baseLength:.4,stretchStart:0,stretchEnd:1,
      shaftName:'part-1',proximalKnobName:'part-2',distalKnobName:'part-3',
      proximalSocketName:'part-4',distalSocketName:'part-5'};
    root.userData.stretchableBoneRuntime = metadata;
    for (let edit = 0; edit < 10; edit++) {
      if (edit === 1) nodes.forEach(node => node.children.reverse());
      if (edit === 2) metadata.shaftName = metadata.distalKnobName = 'part-6';
      if (edit === 3) metadata.proximalKnobName = null;
      if (edit === 4) metadata.proximalSocketName = '';
      if (edit === 5) metadata.distalSocketName = 'missing';
      if (edit === 6) { metadata.distalSocketName = 'part-7'; nodes[1].removeFromParent(); }
      if (edit === 7) root.add(nodes[1]);
      if (edit === 8) { nodes[10].name = 'part-7'; root.add(nodes[10]); }
      if (edit === 9) { metadata.distalKnobName = ''; metadata.proximalKnobName = 'missing-optional'; }
      reads = 0; const expected = oracle(root); const before = reads;
      reads = 0; const actual = resolveStretchableBone(root); const after = reads;
      assert.ok(after <= before, 'combined lookup visited more nodes than separate name searches');
      assert.equal(actual === null, expected === null);
      if (expected) for (const key of ['root','metadata',...keys]) assert.equal(actual[key],expected[key],key);
      oldVisits += before; newVisits += after; comparisons++;
    }
    // Each public result owns its node references, even after a later query.
    metadata.shaftName = metadata.proximalSocketName = metadata.distalSocketName = '';
    const first = resolveStretchableBone(root); assert.ok(first);
    root.name = 'old-root'; const replacement = new THREE.Group(); root.add(replacement);
    assert.equal(resolveStretchableBone(root).shaft,replacement);
    assert.equal(first.shaft,root,'later resolution rewrote an existing result');
    metadata.schemaVersion = -1; assert.equal(resolveStretchableBone(root),null);
  }
  const scene = fixture(), bridge = new PlayerAnimationBridge(scene.root,scene.root);
  const lookup = bridge.deformationLookup, storage = [lookup.byId,lookup.byName,lookup.requested];
  let jointChecks = 0, lateTorso = null;
  for (let frame = 0; frame < 240; frame++) {
    bridge.prepareLegacyPose();
    const runtime = scene.root.userData.sculptRuntime;
    if (frame === 30) { scene.nodes.get('elbow-left').name = 'new-elbow'; runtime.joints.elbowLeft = 'new-elbow'; }
    if (frame === 60) {
      lateTorso = scene.nodes.get('meshy-torso-surface').clone();
      scene.root.add(lateTorso); scene.root.children.reverse();
    }
    if (frame === 90) lateTorso.removeFromParent();
    if (frame === 120) runtime.joints.temporary = 'missing';
    if (frame === 150) { runtime.joints.temporary = 'new-elbow'; delete runtime.joints.elbowLeft; }
    if (frame === 180) runtime.joints = {...runtime.joints,elbowLeft:'new-elbow'};
    if (frame === 210) scene.nodes.get('meshy-torso-surface').name = 'hidden-torso';
    const values = Object.fromEntries(runtime.deformations.map(p=>[p.controlId,1+.12*Math.sin(frame*.1)]));
    bridge.applyDeformations(values);
    assert.equal(bridge.deformationLookup,lookup);
    [lookup.byId,lookup.byName,lookup.requested].forEach((container,i)=>
      assert.equal(container,storage[i],'lookup containers were replaced'));
    for (const id of Object.keys(runtime.joints)) {
      assert.equal(lookup.byId.get(id),scene.root.getObjectByName(runtime.joints[id]),id); jointChecks++;
    }
    assert.equal(lookup.byName.get('meshy-torso-surface'),scene.root.getObjectByName('meshy-torso-surface'));
    if (frame >= 150 && frame < 180) assert.equal(lookup.byId.has('elbowLeft'),false,'removed metadata survived');
  }
  bridge.prepareLegacyPose();
  assert.equal(lookup.byId.size,0);assert.equal(lookup.byName.size,0);assert.equal(lookup.requested.size,0);
  console.log(JSON.stringify({passed:true,partComparisons:comparisons,separateNameVisits:oldVisits,
    combinedNameVisits:newVisits,jointChecks,liveEditFrames:240,newWarmLookupContainers:0,
    activeLookupReferencesCleared:true},null,2));
} finally { await server.close(); }
