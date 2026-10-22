// Comparable CPU measurements of production Player.step. An optional saved
// source directory lets the same harness measure the pre-change working tree
// without checking out, stashing or overwriting the user's files.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { createServer } from 'vite';
import { makeInput } from './jungle-cup-harness.mjs';
const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const source = await readFile(new URL('./test-campaign-death-flow.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true);
const dom = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'installHeadlessDom');
new Function('noop', dom.getText(ast) + '; installHeadlessDom();')(() => {});
const replaced = new Set(['src/player.ts', 'src/animation/bridge.ts', 'src/character/bailMotion.ts', 'src/character/bailGroundContact.ts', 'src/character/bailImpactSpin.ts', 'src/character/bailRecoveryMotion.ts', 'src/character/interactionBounds.ts', 'src/character/proportionLayer.ts', 'src/character/wipeoutPolicy.ts']);
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: snapshot ? [{ name: 'bail-source-snapshot', enforce: 'pre', async load(id) {
    const rel = path.relative(process.cwd(), id.split('?')[0]);
    if (replaced.has(rel)) {
      try { return await readFile(path.join(snapshot, rel), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } }] : [],
});
const warn = console.warn, error = console.error, random = Math.random;
console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
let level, runtime;
try {
  const { Player } = await server.ssrLoadModule('/src/player.ts');
  const { Level } = await server.ssrLoadModule('/src/level.ts');
  const { CONST } = await server.ssrLoadModule('/src/tuning.ts');
  const { RigBinding } = await server.ssrLoadModule('/src/animation/rigBinding.ts');
  const { createPlayerStarterAnimationSuite } = await server.ssrLoadModule('/src/animation/playerCatalog.ts');
  const { createCharacterAnimationRuntime } = await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const scene = new THREE.Scene();
  level = new Level(scene, { id: 'bail-profile', name: 'Bail profile', data: { v: 1, name: 'Bail profile', spawn: [0, .05, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }] } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const stats = values => { const sorted = [...values].sort((a, b) => a - b); return {
    samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * .95)] }; };
  const results = [];
  const appearanceProfile = process.argv.includes('--appearance-profile');
  const boundsProfile = process.argv.includes('--bounds-profile');
  const jointLimitProfile = process.argv.includes('--joint-limit-profile');
  const rigProfile = process.argv.includes('--rig-profile');
  const recoveryProfile = process.argv.includes('--recovery-profile');
  const deformationProfile = process.argv.includes('--deformation-profile');
  const hierarchyProfile = process.argv.includes('--hierarchy-profile');
  const poseChecksums = process.argv.includes('--pose-checksum');
  const traceImpacts = process.argv.includes('--impact-trace');
  const poseNodes = [];
  p.bodyGroup.traverse(node => poseNodes.push(node));
  const poseValues = new Float64Array(poseNodes.reduce((n, node) => n + 10 + (node.morphTargetInfluences?.length ?? 0), 0));
  let contact = null;
  if (process.argv.includes('--contact-only') && typeof p.kickRagdollContact === 'function') {
    p.invulnTimer = 0; p.beginPvpKnockdown(0, 1); p.syncVisual(input, 1 / 60); p.group.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 1, 0), impulse = new THREE.Vector3(0, 16, 3), samples = [];
    let supportCalls = 0, supportSamples = 0;
    const sample = p.interactionMeasure.sampledPlaneDistance.bind(p.interactionMeasure);
    p.interactionMeasure.sampledPlaneDistance = (...args) => {
      const result = sample(...args); supportCalls++; supportSamples += p.interactionMeasure.supportSamples; return result;
    };
    for (let i = -500; i < 3000; i++) {
      if (i === 0) supportCalls = supportSamples = 0;
      const start = performance.now(); p.kickRagdollContact(normal, impulse, 12);
      if (i >= 0) samples.push(performance.now() - start);
    }
    p.interactionMeasure.sampledPlaneDistance = sample;
    contact = { warmupContacts: 500, cpuMs: stats(samples), supportCalls, supportSamples,
      scope: 'Isolated production contact torque and secondary-motion impulse, warm posed rig; excludes locomotion/render.' };
  }
  if (!process.argv.includes('--contact-only'))
  for (const cause of ['balance', 'wall', 'trip', 'landing', 'pvp']) {
    const frames = [], incidents = [], triggers = [], durations = []; let fullScans = 0, count = false;
    let bodyMatrixPasses = 0;
    const bodyMatrices = p.bodyGroup.updateMatrixWorld;
    if (hierarchyProfile) p.bodyGroup.updateMatrixWorld = function(force) {
      if (count && p.isBailing) bodyMatrixPasses++;
      return bodyMatrices.call(this, force);
    };
    const supportTimes = []; let supportSamples = 0;
    const recoveries = [], recoveryPrevious = new THREE.Quaternion(), recoveryCurrent = new THREE.Quaternion(); let activeRecovery = null;
    const beginRecovery = p.bailRecoveryMotion.begin.bind(p.bailRecoveryMotion);
    if (recoveryProfile) p.bailRecoveryMotion.begin = (orientation, spin, duration) => {
      beginRecovery(orientation, spin, duration);
      if (count) {
        const motion = p.bailRecoveryMotion;
        activeRecovery = { orientation:orientation.toArray(), spin:spin.toArray(), duration,
          pitch:motion.pitch, destination:motion.destination, travel:motion.destination-motion.pitch,
          frames:0, angularTravel:0, peakFrameTurn:0 };
        recoveries.push(activeRecovery);
      }
    };
    const appearanceTimes = []; let appearanceCalls = 0, nameSearches = 0, transformClones = 0;
    let rigSnapshots = 0, rigJointRecords = 0, rigRestTuples = 0;
    const bridge = p.playerAnimationBridge;
    const deform = bridge.applyDeformations.bind(bridge), deformationTimes = [];
    const seenStates = new WeakSet(), seenTransforms = new WeakSet(), seenMorphs = new WeakSet();
    let deformationCalls = 0, deformationRecords = 0, deformationTransforms = 0, deformationMorphs = 0;
    if (deformationProfile) bridge.applyDeformations = values => {
      const start = performance.now(), result = deform(values), ms = performance.now() - start;
      const record = count && p.isBailing;
      if (record) { deformationCalls++; deformationTimes.push(ms); }
      for (const state of bridge.deformationStates) {
        if (!seenStates.has(state)) { if (record) deformationRecords++; seenStates.add(state); }
        for (const value of [state.basePosition,state.baseScale,state.deformedPosition,state.deformedScale])
          if (!seenTransforms.has(value)) { if (record) deformationTransforms++; seenTransforms.add(value); }
        for (let i = 0; i < (state.morphCount ?? state.morphs.length); i++) {
          const morph = state.morphs[i];
          if (!seenMorphs.has(morph)) { if (record) deformationMorphs++; seenMorphs.add(morph); }
        }
      }
      return result;
    };
    const resolveRig = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(bridge), 'rig').get;
    if (rigProfile) Object.defineProperty(bridge, 'rig', { configurable:true, get() {
      const rig = resolveRig.call(this);
      if (count && p.isBailing) {
        rigSnapshots++; rigJointRecords += rig.joints.length; rigRestTuples += rig.joints.length * 3;
      }
      return rig;
    } });
    const jointLimits = new Map(), applyJoint = p.bailMotion.apply.bind(p.bailMotion);
    if (jointLimitProfile) p.bailMotion.apply = (joint, node, weight) => {
      const angle = node?.rotation.x, intended = angle + p.bailMotion.angles[joint * 3] * weight;
      applyJoint(joint, node, weight);
      if (count && node && [3, 6, 9, 12].includes(joint) && weight > .05) {
        let stats = jointLimits.get(joint);
        if (!stats) jointLimits.set(joint, stats = { joint, samples:0, clamped:0, maxHiddenAngle:0,
          run:0, longestRun:0, atStop:0, stopRun:0, longestStopRun:0 });
        stats.samples++; const hidden = Math.abs(intended - node.rotation.x);
        if (hidden > 1e-8) { stats.clamped++; stats.run++; stats.longestRun = Math.max(stats.longestRun, stats.run); }
        else stats.run = 0;
        stats.maxHiddenAngle = Math.max(stats.maxHiddenAngle, hidden);
        const elbow = joint === 3 || joint === 6, x = node.rotation.x;
        if (Math.abs(x - (elbow ? -2.35 : .03)) < 1e-8 || Math.abs(x - (elbow ? -.05 : 2.45)) < 1e-8) {
          stats.atStop++; stats.stopRun++; stats.longestStopRun = Math.max(stats.longestStopRun, stats.stopRun);
        } else stats.stopRun = 0;
      }
    };
    let boundsCalls = 0, boundsRecords = 0, boundsBoxes = 0;
    const localBounds = p.interactionMeasure.localBounds.bind(p.interactionMeasure);
    if (boundsProfile) p.interactionMeasure.localBounds = mesh => {
      const before = p.interactionMeasure.cache.get(mesh), result = localBounds(mesh);
      if (count && p.isBailing && !mesh.isSkinnedMesh) {
        const after = p.interactionMeasure.cache.get(mesh); boundsCalls++;
        if (after !== before) boundsRecords++;
        if (after?.box !== before?.box) boundsBoxes++;
      }
      return result;
    };
    const poseHash = poseChecksums ? createHash('sha256') : null;
    const gameplayHash = poseChecksums ? createHash('sha256') : null;
    const impacts = [], kickContact = p.kickRagdollContact.bind(p);
    if (traceImpacts) p.kickRagdollContact = (normal, impulse, impact, incoming) => {
      const beforeSpin = p.ragdollWorldSpin(new THREE.Vector3()).toArray();
      const contact = p.sampleRagdollContact(normal).toArray();
      const orientation = p.ragQ.toArray(), joint = p.ragContactJoint;
      const travel = incoming?.toArray() ?? [p.axisF.x * p.speed, p.vVel, p.axisF.z * p.speed];
      kickContact(normal, impulse, impact, incoming);
      if (count) impacts.push({ beforeSpin, afterSpin:p.ragdollWorldSpin(new THREE.Vector3()).toArray(),
        normal:normal.toArray(), impulse:impulse.toArray(), impact, contact, orientation, joint, travel,
        bounces:p.ragBounces, floorImpacts:p.ragImpacts });
    };
    const appearance = p.characterProportionLayer.apply.bind(p.characterProportionLayer);
    const lookup = p.bodyGroup.getObjectByName;
    const vectorClone = THREE.Vector3.prototype.clone, quaternionClone = THREE.Quaternion.prototype.clone;
    let inAppearance = false;
    if (appearanceProfile) {
      p.characterProportionLayer.apply = (...args) => {
        const start = performance.now(); inAppearance = count && p.isBailing;
        const result = appearance(...args);
        if (inAppearance) { appearanceTimes.push(performance.now() - start); appearanceCalls++; }
        inAppearance = false; return result;
      };
      p.bodyGroup.getObjectByName = function (...args) { if (inAppearance) nameSearches++; return lookup.apply(this, args); };
      THREE.Vector3.prototype.clone = function () { if (inAppearance) transformClones++; return vectorClone.call(this); };
      THREE.Quaternion.prototype.clone = function () { if (inAppearance) transformClones++; return quaternionClone.call(this); };
    }
    const support = p.interactionMeasure.sampledPlaneDistance.bind(p.interactionMeasure);
    if (process.argv.includes('--support-profile')) p.interactionMeasure.sampledPlaneDistance = (...args) => {
      const start = performance.now(), result = support(...args);
      if (count && p.isBailing) { supportTimes.push(performance.now() - start); supportSamples += p.interactionMeasure.supportSamples; }
      return result;
    };
    const native = p.interactionMeasure.skinnedBounds.bind(p.interactionMeasure);
    p.interactionMeasure.skinnedBounds = mesh => { if (count && p.isBailing) fullScans++; return native(mesh); };
    for (let trial = -8; trial < 24; trial++) {
      let seed = 0x48631 + trial;
      Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      p.respawn(level, true, true); p.invulnTimer = 0; p.step(CONST.fixedStep, input, level);
      for (const stats of jointLimits.values()) stats.run = stats.stopRun = 0;
      p.speed = cause === 'balance' ? 10 : 24; p.freeSkate = true;
      const t = performance.now();
      if (cause === 'pvp') p.beginPvpKnockdown(5, 1);
      else {
        p.bail(false, p.speed, cause, 30);
        if (cause === 'wall' || cause === 'trip') {
          p.startRagdoll(cause === 'wall' ? 'back' : 'forward');
          p.vVel = cause === 'wall' ? 3.6 : 7; p.state = 'air'; p.grounded = false;
          p.airFromSkate = false; p.airMomentum = true;
        }
      }
      if (trial >= 0) triggers.push(performance.now() - t);
      count = trial >= 0;
      activeRecovery = null;
      let total = 0, n = 0;
      for (; n < 300 && p.isBailing; n++) {
        if (recoveryProfile) p.riderG.getWorldQuaternion(recoveryPrevious).normalize();
        const start = performance.now(); p.step(CONST.fixedStep, input, level); const ms = performance.now() - start;
        if (count) frames.push(ms); total += ms;
        if (recoveryProfile && activeRecovery && p.bailRecoverT >= 0) {
          p.riderG.getWorldQuaternion(recoveryCurrent).normalize();
          const turn = recoveryPrevious.angleTo(recoveryCurrent);
          activeRecovery.frames++; activeRecovery.angularTravel += turn;
          activeRecovery.peakFrameTurn = Math.max(activeRecovery.peakFrameTurn, turn);
        }
        if (count && poseHash) {
          let i = 0;
          for (const node of poseNodes) {
            node.position.toArray(poseValues, i); i += 3; node.quaternion.toArray(poseValues, i); i += 4;
            node.scale.toArray(poseValues, i); i += 3;
            for (const value of node.morphTargetInfluences ?? []) poseValues[i++] = value;
          }
          poseHash.update(new Uint8Array(poseValues.buffer));
          const gameplay = JSON.stringify([p.pos.toArray(), p.speed, p.vVel, p.state, p.grounded, p.isBailing,
            p.ragdollImpactCount, p.ragdollWallImpactCount, p.bailRecoverT]);
          poseHash.update(gameplay); gameplayHash.update(gameplay);
        }
      }
      count = false;
      if (trial >= 0) { incidents.push(total); durations.push(n / 60); }
    }
    p.interactionMeasure.skinnedBounds = native;
    p.bodyGroup.updateMatrixWorld = bodyMatrices;
    p.interactionMeasure.sampledPlaneDistance = support;
    p.interactionMeasure.localBounds = localBounds;
    p.bailMotion.apply = applyJoint;
    bridge.applyDeformations = deform;
    p.bailRecoveryMotion.begin = beginRecovery;
    if (rigProfile) delete bridge.rig;
    p.characterProportionLayer.apply = appearance; p.bodyGroup.getObjectByName = lookup;
    p.kickRagdollContact = kickContact;
    THREE.Vector3.prototype.clone = vectorClone; THREE.Quaternion.prototype.clone = quaternionClone;
    results.push({ cause, stepMs: stats(frames), incidentCpuMs: stats(incidents), triggerMs: stats(triggers), durationSeconds: stats(durations), fullSkinScans: fullScans,
      support: supportTimes.length ? { cpuMs: stats(supportTimes), samples: supportSamples } : undefined,
      appearance: appearanceTimes.length ? { cpuMs: stats(appearanceTimes), calls: appearanceCalls, nameSearches, transformClones } : undefined,
      bounds: boundsProfile ? { calls:boundsCalls, newRecords:boundsRecords, newBoxes:boundsBoxes } : undefined,
      hierarchy: hierarchyProfile ? { bodyMatrixPasses } : undefined,
      jointLimits: jointLimitProfile ? [...jointLimits.values()] : undefined,
      rig: rigProfile ? { snapshots:rigSnapshots, jointRecords:rigJointRecords, restTuples:rigRestTuples } : undefined,
      recoveries: recoveryProfile ? recoveries : undefined,
      deformations: deformationProfile ? { calls:deformationCalls, cpuMs:stats(deformationTimes),
        newRecords:deformationRecords, newTransformObjects:deformationTransforms, newMorphRecords:deformationMorphs } : undefined,
      poseChecksum: poseHash?.digest('hex'), gameplayChecksum:gameplayHash?.digest('hex'), impacts: traceImpacts ? impacts : undefined });
  }
  console.log(JSON.stringify({ source: snapshot ? 'initial working tree snapshot' : 'current working tree', warmupsPerCase: 8, measuredIncidentsPerCase: 24,
    scope: 'Production fixed-step CPU in Node with the animation runtime and procedural fallback assets. Includes first active frame; excludes render/GPU/browser costs. Timings are descriptive, scan counts are deterministic.', contact, results }, null, 2));
} finally { Math.random = random; console.warn = warn; console.error = error; runtime?.dispose(); level?.dispose(); await server.close(); }
