import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import { createServer } from 'vite';

// Reuse the full semantic rig/morph fixture without running its unrelated UI
// source checks. A freshly allocated layer is the independent reuse oracle.
const fixtureSource = await readFile(new URL('./test-character-lab.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', fixtureSource, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'fixture');
const fixture = new Function('THREE', `${declaration.getText(ast)}; return fixture;`)(THREE);
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
try {
  const { CharacterProportionLayer } = await server.ssrLoadModule('/src/character/proportionLayer.ts');
  const { DEFAULT_CHARACTER_PROPORTIONS } = await server.ssrLoadModule('/src/character/settings.ts');
  const cached = fixture(), fresh = fixture();
  const layer = new CharacterProportionLayer(cached.root);
  let reference = new CharacterProportionLayer(fresh.root);
  const snapshot = root => {
    const values = [];
    root.traverse(node => values.push([node.name, ...node.position.toArray(), ...node.quaternion.toArray(),
      ...node.scale.toArray(), ...(node.morphTargetInfluences ?? [])]));
    return values;
  };
  const edits = [];
  for (let frame = 0; frame < 180; frame++) {
    layer.clear(); reference.clear(); reference = new CharacterProportionLayer(fresh.root);
    for (const scene of [cached, fresh]) {
      // New authored motion must become the next baseline, including morphs.
      scene.nodes.get('head').rotation.set(Math.sin(frame * .17), .3, -.15);
      scene.nodes.get('shoulder-left').rotation.z = Math.cos(frame * .13);
      scene.nodes.get('knee-right').position.y = -.28 * (1 + .2 * Math.sin(frame * .2));
      scene.nodes.get('meshy-torso-surface').morphTargetInfluences[0] = .2 * Math.sin(frame);
      const runtime = scene.root.userData.sculptRuntime;
      if (frame === 20) {
        const old = scene.nodes.get('head-presentation'); old.name = 'retired-head-mount';
        const replacement = new THREE.Group(); replacement.name = 'head-presentation';
        old.parent.add(replacement); replacement.add(...old.children); old.removeFromParent();
        scene.nodes.set('head-presentation', replacement);
      }
      if (frame === 40) {
        scene.nodes.get('elbow-left').name = 'renamed-elbow'; runtime.joints.elbowLeft = 'renamed-elbow';
        runtime.deformations[2].lengthAxis = [.2, -1, .1];
      }
      if (frame === 60) {
        // A late-loaded artist mark takes over from the two fallback bars.
        const mark = new THREE.Group(); mark.name = 'artist-hand-dorsal-x-left';
        scene.nodes.get('hand-rest-orientation-left').add(mark); scene.nodes.set('mark', mark);
      }
      if (frame === 80) scene.nodes.get('mark').removeFromParent();
      if (frame === 100) {
        // Reordering duplicate names must retain first-depth-first semantics.
        const duplicate = new THREE.Group(); duplicate.name = 'head-presentation';
        duplicate.position.set(.2, .3, -.1);
        scene.nodes.get('head').add(duplicate);
        scene.nodes.get('head').children.reverse(); scene.nodes.set('duplicate', duplicate);
      }
      if (frame === 120) scene.nodes.get('duplicate').removeFromParent();
      if (frame === 140) {
        const surface = scene.nodes.get('meshy-torso-surface');
        surface.morphTargetInfluences = [.1, -.1, .25];
      }
      if (frame === 160) scene.nodes.get('hand-rest-orientation-left').visible = false;
    }
    if (frame > 0 && frame % 20 === 0) edits.push(frame);
    const value = { ...DEFAULT_CHARACTER_PROPORTIONS,
      torsoLength: 1 + .2 * Math.sin(frame * .2), upperArmLength: .8 + frame % 9 * .04,
      thighLength: .9 + frame % 7 * .03, shoulderWidth: 1.15, headSize: 1.2,
      wristRestPitch: frame % 50, gloveXAcross: .02 };
    const options = { crawlPalmWeight: frame % 3 === 0 ? .7 : 0, upperArmRestAngleWeight: .4 };
    layer.apply(value, options); reference.apply(value, options);
    assert.deepEqual(snapshot(cached.root), snapshot(fresh.root), `cached presentation changed at frame ${frame}`);
    // Name lookup oracle uses the actual Three.js search, not our index.
    for (const name of ['head-presentation', 'renamed-elbow', 'artist-hand-dorsal-x-left', 'missing'])
      assert.equal(layer.namedNodes.get(name), cached.root.getObjectByName(name), `stale lookup: ${name}`);
    assert.ok(snapshot(cached.root).every(row => row.slice(1).every(Number.isFinite)));
  }
  layer.clear(); reference.clear();
  assert.deepEqual(snapshot(cached.root), snapshot(fresh.root), 'clear did not restore authored transforms');

  // Warm bails reuse their records rather than allocating six transform
  // objects for every owned node on every tick. Count actual constructors'
  // clone paths, not timing thresholds that depend on the machine's load.
  const vectorClone = THREE.Vector3.prototype.clone, quaternionClone = THREE.Quaternion.prototype.clone;
  const lookup = cached.root.getObjectByName;
  let transformClones = 0, nameSearches = 0;
  THREE.Vector3.prototype.clone = function () { transformClones++; return vectorClone.call(this); };
  THREE.Quaternion.prototype.clone = function () { transformClones++; return quaternionClone.call(this); };
  cached.root.getObjectByName = function (...args) { nameSearches++; return lookup.apply(this, args); };
  try {
    for (let frame = 0; frame < 240; frame++) layer.apply(DEFAULT_CHARACTER_PROPORTIONS);
    assert.equal(transformClones, 0, 'warm appearance pass allocated new transform records');
    assert.equal(nameSearches, 0, 'warm appearance pass repeated whole-rig name searches');
  } finally {
    THREE.Vector3.prototype.clone = vectorClone; THREE.Quaternion.prototype.clone = quaternionClone;
    cached.root.getObjectByName = lookup; layer.clear();
  }
  const result = { passed: true, authoredFrames: 180, hierarchyEditsAtFrames: edits, warmFrames: 240,
    transformClones, nameSearches, restoredExactly: true };
  const output = process.argv.find(a => a.startsWith('--output='))?.slice(9);
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await server.close(); }
