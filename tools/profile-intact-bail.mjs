// Comparable CPU measurements of production Player.step. An optional saved
// source directory lets the same harness measure the pre-change working tree
// without checking out, stashing or overwriting the user's files.
// --complete-incident includes the finite rise after controls return;
// --real-hands uses the local artist-hand GLB and a warmed exact skin kernel.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import ts from 'typescript';
import * as THREE from 'three';
import { createServer } from 'vite';
import { makeInput } from './jungle-cup-harness.mjs';
const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const allCauses = ['balance', 'wall', 'trip', 'landing', 'pvp'];
const completeIncident = process.argv.includes('--complete-incident');
const realHands = process.argv.includes('--real-hands');
const skinUploadProfile = process.argv.includes('--skin-upload-profile');
const supportSkinProfile = process.argv.includes('--support-skin-profile');
const selectedCause = process.argv.find(a => a.startsWith('--case='))?.slice(7);
if (selectedCause && !allCauses.includes(selectedCause)) throw new Error(`Unknown bail case: ${selectedCause}`);
const countOption = (name, fallback) => {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  const value = arg ? Number(arg.slice(name.length + 3)) : fallback;
  if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error(`${name} must be an integer from 1 to 1000`);
  return value;
};
const warmups = countOption('warmups', 8), measured = countOption('incidents', 24);
const source = await readFile(new URL('./test-campaign-death-flow.mjs', import.meta.url), 'utf8');
const ast = ts.createSourceFile('fixture.mjs', source, ts.ScriptTarget.Latest, true);
const dom = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'installHeadlessDom');
new Function('noop', dom.getText(ast) + '; installHeadlessDom();')(() => {});
const replaced = new Set(['src/player.ts', 'src/bailRecovery.ts', 'src/characterAnimationRuntime.ts', 'src/animation/bridge.ts', 'src/animation/rigBinding.ts', 'src/animation/sampling.ts', 'src/character/bailMotion.ts', 'src/character/bailContactPose.ts', 'src/character/bailGroundContact.ts', 'src/character/bailImpactSpin.ts', 'src/character/bailRecoveryMotion.ts', 'src/character/bailRiseMotion.ts', 'src/character/interactionBounds.ts', 'src/character/proportionLayer.ts', 'src/character/wipeoutPolicy.ts', 'src/character/stretchableBone.ts']);
replaced.add('src/character/skinBoundsKernel.ts');
replaced.add('src/character/bailContactPose.ts');
replaced.add('src/character/compactSkinBounds.ts');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: snapshot ? [{ name: 'bail-source-snapshot', enforce: 'pre', async load(id) {
    const rel = path.relative(process.cwd(), id.split('?')[0]);
    if (replaced.has(rel)) {
      try { return await readFile(path.join(snapshot, rel), 'utf8'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  } }] : [],
});
const warn = console.warn, error = console.error, random = Math.random, nativeSort = Array.prototype.sort;
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
  const { skinBoundsKernelDiagnostics } = await server.ssrLoadModule('/src/character/skinBoundsKernel.ts');
  const scene = new THREE.Scene();
  level = new Level(scene, { id: 'bail-profile', name: 'Bail profile', data: { v: 1, name: 'Bail profile', spawn: [0, .05, 0], killY: -100,
    components: [{ t: 'platform', p: [0, -.5, 0], s: [200, 1, 200], edgeGrinding: false }, { t: 'gate', p: [70, 0, -70] }] } });
  const p = new Player(scene), input = makeInput({ inventoryHeld: true }); p.rawInput = input; p.respawn(level, true);
  let handTriangles = 0;
  if (realHands) {
    navigator.userAgent ??= 'Node bail profiler';
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const bytes = await readFile(new URL('../public/characters/three-finger-hand/three-finger-hand.glb', import.meta.url));
    const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
    const { createRiggedCartoonHandPairFromScene, attachAndSyncRiggedCartoonHandPair } = await server.ssrLoadModule('/src/character/riggedCartoonHand.ts');
    const { removeProceduralCartoonGloveSurface } = await server.ssrLoadModule('/src/character/cartoonGlove.ts');
    const pair = createRiggedCartoonHandPairFromScene(gltf.scene);
    attachAndSyncRiggedCartoonHandPair(pair, p.gloveLeft, p.gloveRight);
    p.riggedCartoonHands = pair; p.riggedCartoonHandState = 'ready';
    removeProceduralCartoonGloveSurface(p.gloveLeft); removeProceduralCartoonGloveSurface(p.gloveRight);
    p.rebuildCharacterRenderBatches(); p.syncCharacterAppearance(); handTriangles = pair.triangleCount;
    const { warmSkinBoundsKernel } = await server.ssrLoadModule('/src/character/skinBoundsKernel.ts');
    await warmSkinBoundsKernel();
  }
  runtime = createCharacterAnimationRuntime(p, createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const stats = values => { const sorted = [...values].sort((a, b) => a - b); return {
    samples: values.length, mean: values.reduce((a, b) => a + b, 0) / values.length,
    median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.floor(sorted.length * .95)] }; };
  let skinPreparation;
  if (process.argv.includes('--skin-preparation-profile')) {
    const { CharacterInteractionBounds } = await server.ssrLoadModule('/src/character/interactionBounds.ts');
    const meshes = []; p.bodyGroup.updateWorldMatrix(true, true);
    p.bodyGroup.traverse(mesh => { if (mesh.isSkinnedMesh && mesh.geometry.attributes.position.count >= 2048) meshes.push(mesh); });
    skinPreparation = [];
    for (const mesh of meshes) {
      const times = []; let retainedVertices = 0, retainedBytes = 0;
      for (let i = -5; i < 20; i++) {
        const bounds = new CharacterInteractionBounds(), start = performance.now();
        bounds.skinnedBounds(mesh); const ms = performance.now() - start;
        if (i >= 0) times.push(ms);
        const input = bounds.skinVertices.get(mesh);
        retainedVertices = input.positions.length / 3;
        retainedBytes = input.positions.byteLength + input.indices.byteLength + input.weights.byteLength +
          input.morphDeltas.reduce((n, a) => n + a.byteLength, 0);
      }
      skinPreparation.push({ name:mesh.name, sourceVertices:mesh.geometry.attributes.position.count,
        retainedVertices, retainedBytes, coldMeasurementMs:stats(times) });
    }
  }
  const results = [];
  const appearanceProfile = process.argv.includes('--appearance-profile');
  const boundsProfile = process.argv.includes('--bounds-profile');
  const jointLimitProfile = process.argv.includes('--joint-limit-profile');
  const rigProfile = process.argv.includes('--rig-profile');
  const recoveryProfile = process.argv.includes('--recovery-profile');
  const deformationProfile = process.argv.includes('--deformation-profile');
  const hierarchyProfile = process.argv.includes('--hierarchy-profile');
  const overlayProfile = process.argv.includes('--overlay-profile');
  const poseChecksums = process.argv.includes('--pose-checksum');
  const traceImpacts = process.argv.includes('--impact-trace');
  const keyOrderProfile = process.argv.includes('--key-order-profile');
  const poseNodes = [];
  p.bodyGroup.traverse(node => poseNodes.push(node));
  const boneWorlds = new Set(poseNodes.flatMap(node => node.isSkinnedMesh
    ? node.skeleton.bones.map(bone => bone.matrixWorld) : node.isBone ? [node.matrixWorld] : []));
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
  if (!process.argv.includes('--contact-only') && !skinPreparation)
  for (const cause of selectedCause ? [selectedCause] : allCauses) {
    const frames = [], incidents = [], triggers = [], durations = []; let fullScans = 0, count = false;
    const skinUploads = { calls:0, copiedBytes:0, geometryUploads:0, residentHits:0, residentResets:0, workspaceBytes:0, exactSkinVertices:0 };
    const phaseWork = Object.fromEntries(['bail','rise'].map(phase => [phase, { frames:[], fullSkinScans:0, bodyMatrixPasses:0, supportTimes:[], supportSamples:0, deformationPasses:0, deformationRequests:0 }]));
    let phase = 'bail';
    const recording = () => count && (completeIncident || p.isBailing);
    const originalSort = Array.prototype.sort;
    let keySorts = 0, sortedKeyReferences = 0;
    if (keyOrderProfile) Array.prototype.sort = function (...args) {
      if (recording() && this.length && typeof this[0]?.time === 'number' && typeof this[0]?.id === 'string') {
        keySorts++; sortedKeyReferences += this.length;
      }
      return originalSort.apply(this, args);
    };
    let bodyMatrixPasses = 0;
    const bodyMatrices = p.bodyGroup.updateMatrixWorld;
    if (hierarchyProfile) p.bodyGroup.updateMatrixWorld = function(force) {
      if (recording()) { bodyMatrixPasses++; phaseWork[phase].bodyMatrixPasses++; }
      return bodyMatrices.call(this, force);
    };
    const supportTimes = []; let supportSamples = 0;
    const recoveries = [], recoveryPrevious = new THREE.Quaternion(), recoveryCurrent = new THREE.Quaternion(); let activeRecovery = null;
    const beginRecovery = p.bailRecoveryMotion.begin.bind(p.bailRecoveryMotion);
    if (recoveryProfile) p.bailRecoveryMotion.begin = (orientation, spin, duration, momentum) => {
      beginRecovery(orientation, spin, duration, momentum);
      if (count) {
        const motion = p.bailRecoveryMotion;
        activeRecovery = { orientation:orientation.toArray(), spin:spin.toArray(), momentum:momentum?.toArray(), duration,
          axis:[motion.axisX ?? 1, 0, motion.axisZ ?? 0],
          pitch:motion.pitch, destination:motion.destination, travel:motion.destination-motion.pitch,
          frames:0, angularTravel:0, peakFrameTurn:0 };
        recoveries.push(activeRecovery);
      }
    };
    const appearanceTimes = []; let appearanceCalls = 0, nameSearches = 0, transformClones = 0;
    let rigSnapshots = 0, rigJointRecords = 0, rigRestTuples = 0;
    const bridge = p.playerAnimationBridge;
    const prepareLegacy = bridge.prepareLegacyPose.bind(bridge);
    const quaternionSet = THREE.Quaternion.prototype.set, quaternionCopy = THREE.Quaternion.prototype.copy;
    let inOverlayRestore = false, overlayRestores = 0, restoredQuaternionWrites = 0;
    if (overlayProfile) {
      bridge.prepareLegacyPose = () => {
        inOverlayRestore = recording();
        if (inOverlayRestore) overlayRestores++;
        try { return prepareLegacy(); } finally { inOverlayRestore = false; }
      };
      THREE.Quaternion.prototype.set = function (...args) {
        if (inOverlayRestore) restoredQuaternionWrites++;
        return quaternionSet.apply(this, args);
      };
      THREE.Quaternion.prototype.copy = function (...args) {
        if (inOverlayRestore) restoredQuaternionWrites++;
        return quaternionCopy.apply(this, args);
      };
    }
    const deform = bridge.applyDeformations.bind(bridge), deformationTimes = [];
    const seenStates = new WeakSet(), seenTransforms = new WeakSet(), seenMorphs = new WeakSet();
    let deformationCalls = 0, deformationRequests = 0, deformationRecords = 0, deformationTransforms = 0, deformationMorphs = 0;
    if (deformationProfile) bridge.applyDeformations = values => {
      const queued = bridge.deformationBatch === true;
      const start = performance.now(), result = deform(values), ms = performance.now() - start;
      const record = recording();
      if (record) {
        deformationRequests++; phaseWork[phase].deformationRequests++;
        if (!queued) { deformationCalls++; deformationTimes.push(ms); phaseWork[phase].deformationPasses++; }
      }
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
      if (recording()) {
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
      if (recording() && !mesh.isSkinnedMesh) {
        const after = p.interactionMeasure.cache.get(mesh); boundsCalls++;
        if (after !== before) boundsRecords++;
        if (after?.box !== before?.box) boundsBoxes++;
      }
      return result;
    };
    const poseHash = poseChecksums ? createHash('sha256') : null;
    const gameplayHash = poseChecksums ? createHash('sha256') : null;
    const impacts = [], kickContact = p.kickRagdollContact.bind(p);
    const strainKeys = traceImpacts ? Object.keys(p.bailMotion.deformations) : [];
    const queuedStrain = () => {
      const values = new Array(strainKeys.length).fill(0), start = p.bailMotion.angles.length;
      const waves = p.bailMotion.contactWaves, stride = start + values.length;
      for (let slot = 0; slot < waves.length; slot += stride)
        for (let i = 0; i < values.length; i++) values[i] += waves[slot + start + i];
      return values;
    };
    if (traceImpacts) p.kickRagdollContact = (normal, impulse, impact, incoming) => {
      const beforeSpin = p.ragdollWorldSpin(new THREE.Vector3()).toArray();
      const contact = p.sampleRagdollContact(normal).toArray();
      const orientation = p.ragQ.toArray(), joint = p.ragContactJoint;
      const travel = incoming?.toArray() ?? [p.axisF.x * p.speed, p.vVel, p.axisF.z * p.speed];
      const strainBefore = count ? queuedStrain() : null;
      kickContact(normal, impulse, impact, incoming);
      if (count) impacts.push({ beforeSpin, afterSpin:p.ragdollWorldSpin(new THREE.Vector3()).toArray(),
        normal:normal.toArray(), impulse:impulse.toArray(), impact, contact, orientation, joint, travel,
        strainImpulses:Object.fromEntries(queuedStrain().map((value, i) => [strainKeys[i], value - strainBefore[i]])),
        bounces:p.ragBounces, floorImpacts:p.ragImpacts });
    };
    const appearance = p.characterProportionLayer.apply.bind(p.characterProportionLayer);
    const lookup = p.bodyGroup.getObjectByName;
    const vectorClone = THREE.Vector3.prototype.clone, quaternionClone = THREE.Quaternion.prototype.clone;
    let inAppearance = false;
    if (appearanceProfile) {
      p.characterProportionLayer.apply = (...args) => {
        const start = performance.now(); inAppearance = recording();
        const result = appearance(...args);
        if (inAppearance) { appearanceTimes.push(performance.now() - start); appearanceCalls++; }
        inAppearance = false; return result;
      };
      p.bodyGroup.getObjectByName = function (...args) { if (inAppearance) nameSearches++; return lookup.apply(this, args); };
      THREE.Vector3.prototype.clone = function () { if (inAppearance) transformClones++; return vectorClone.call(this); };
      THREE.Quaternion.prototype.clone = function () { if (inAppearance) transformClones++; return quaternionClone.call(this); };
    }
    const support = p.interactionMeasure.sampledPlaneDistance.bind(p.interactionMeasure);
    const supportSkin = { queries:0, boneMatrixProducts:0, nativeVertexSkins:0 };
    let inSupport = false;
    const matrixMultiply = THREE.Matrix4.prototype.multiplyMatrices, skinTransform = THREE.SkinnedMesh.prototype.applyBoneTransform;
    if (supportSkinProfile) {
      THREE.Matrix4.prototype.multiplyMatrices = function(a,b) {
        if (inSupport && boneWorlds.has(a)) supportSkin.boneMatrixProducts++;
        return matrixMultiply.call(this,a,b);
      };
      THREE.SkinnedMesh.prototype.applyBoneTransform = function(i,v) {
        if (inSupport) supportSkin.nativeVertexSkins++;
        return skinTransform.call(this,i,v);
      };
    }
    if (process.argv.includes('--support-profile') || supportSkinProfile) p.interactionMeasure.sampledPlaneDistance = (...args) => {
      const start = performance.now(); inSupport = recording();
      let result;
      try { result = support(...args); } finally { inSupport = false; }
      if (recording()) {
        supportSkin.queries++;
        const ms = performance.now() - start, samples = p.interactionMeasure.supportSamples;
        supportTimes.push(ms); supportSamples += samples;
        phaseWork[phase].supportTimes.push(ms); phaseWork[phase].supportSamples += samples;
      }
      return result;
    };
    const native = p.interactionMeasure.skinnedBounds.bind(p.interactionMeasure);
    p.interactionMeasure.skinnedBounds = mesh => {
      if (recording()) { fullScans++; phaseWork[phase].fullSkinScans++; }
      const result = native(mesh);
      if (recording() && skinUploadProfile)
        skinUploads.exactSkinVertices += p.interactionMeasure.skinVertices.get(mesh)?.positions.length / 3 || 0;
      return result;
    };
    for (let trial = -warmups; trial < measured; trial++) {
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
      const skinBefore = skinUploadProfile && count ? skinBoundsKernelDiagnostics() : null;
      let total = 0, n = 0;
      for (; n < 300 && (p.isBailing || completeIncident && p.bailRiseAge >= 0); n++) {
        phase = p.isBailing ? 'bail' : 'rise';
        if (recoveryProfile) p.riderG.getWorldQuaternion(recoveryPrevious).normalize();
        const start = performance.now(); p.step(CONST.fixedStep, input, level); const ms = performance.now() - start;
        if (count) { frames.push(ms); phaseWork[phase].frames.push(ms); } total += ms;
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
      if (n === 300 && (p.isBailing || completeIncident && p.bailRiseAge >= 0)) throw new Error(`${cause}: incident never settled`);
      count = false;
      if (skinBefore) {
        const after = skinBoundsKernelDiagnostics();
        for (const key of ['calls','copiedBytes','geometryUploads','residentHits','residentResets']) {
          // Older snapshots upload all geometry on every successful call.
          const fallback = value => key === 'geometryUploads' ? value.calls : 0;
          skinUploads[key] += (after[key] ?? fallback(after)) - (skinBefore[key] ?? fallback(skinBefore));
        }
        skinUploads.workspaceBytes = Math.max(skinUploads.workspaceBytes, after.workspaceBytes);
      }
      if (trial >= 0) { incidents.push(total); durations.push(n / 60); }
    }
    p.interactionMeasure.skinnedBounds = native;
    Array.prototype.sort = originalSort;
    p.bodyGroup.updateMatrixWorld = bodyMatrices;
    p.interactionMeasure.sampledPlaneDistance = support;
    THREE.Matrix4.prototype.multiplyMatrices = matrixMultiply;
    THREE.SkinnedMesh.prototype.applyBoneTransform = skinTransform;
    p.interactionMeasure.localBounds = localBounds;
    p.bailMotion.apply = applyJoint;
    bridge.applyDeformations = deform;
    p.bailRecoveryMotion.begin = beginRecovery;
    bridge.prepareLegacyPose = prepareLegacy;
    THREE.Quaternion.prototype.set = quaternionSet;
    THREE.Quaternion.prototype.copy = quaternionCopy;
    if (rigProfile) delete bridge.rig;
    p.characterProportionLayer.apply = appearance; p.bodyGroup.getObjectByName = lookup;
    p.kickRagdollContact = kickContact;
    THREE.Vector3.prototype.clone = vectorClone; THREE.Quaternion.prototype.clone = quaternionClone;
    results.push({ cause, stepMs: stats(frames), incidentCpuMs: stats(incidents), triggerMs: stats(triggers), durationSeconds: stats(durations), fullSkinScans: fullScans,
      phases: completeIncident ? Object.fromEntries(Object.entries(phaseWork).map(([name, value]) => [name, {
        stepMs: value.frames.length ? stats(value.frames) : null, fullSkinScans:value.fullSkinScans,
        bodyMatrixPasses:hierarchyProfile ? value.bodyMatrixPasses : undefined,
        deformationPasses:deformationProfile ? value.deformationPasses : undefined,
        deformationRequests:deformationProfile ? value.deformationRequests : undefined,
        support: value.supportTimes.length ? { cpuMs:stats(value.supportTimes), samples:value.supportSamples } : undefined,
      }])) : undefined,
      support: supportTimes.length ? { cpuMs: stats(supportTimes), samples: supportSamples } : undefined,
      appearance: appearanceTimes.length ? { cpuMs: stats(appearanceTimes), calls: appearanceCalls, nameSearches, transformClones,
        retainedNameEntries:p.characterProportionLayer.namedNodes.size } : undefined,
      bounds: boundsProfile ? { calls:boundsCalls, newRecords:boundsRecords, newBoxes:boundsBoxes } : undefined,
      hierarchy: hierarchyProfile ? { bodyMatrixPasses } : undefined,
      overlay: overlayProfile ? { restores:overlayRestores, quaternionWrites:restoredQuaternionWrites,
        retainedRecords:bridge.overlayBaseline.length,
        retainedTransformObjects:bridge.overlayBaseline.reduce((n, record) => n +
          ['position','quaternion','scale'].filter(key => record[key]?.isVector3 || record[key]?.isQuaternion).length, 0) } : undefined,
      jointLimits: jointLimitProfile ? [...jointLimits.values()] : undefined,
      rig: rigProfile ? { snapshots:rigSnapshots, jointRecords:rigJointRecords, restTuples:rigRestTuples } : undefined,
      recoveries: recoveryProfile ? recoveries : undefined,
      deformations: deformationProfile ? { calls:deformationCalls, requests:deformationRequests, cpuMs:stats(deformationTimes),
        newRecords:deformationRecords, newTransformObjects:deformationTransforms, newMorphRecords:deformationMorphs } : undefined,
      keyOrdering: keyOrderProfile ? { sorts:keySorts, copiedKeyReferences:sortedKeyReferences } : undefined,
      skinUploads: skinUploadProfile ? skinUploads : undefined,
      supportSkin: supportSkinProfile ? supportSkin : undefined,
      poseChecksum: poseHash?.digest('hex'), gameplayChecksum:gameplayHash?.digest('hex'), impacts: traceImpacts ? impacts : undefined });
  }
  console.log(JSON.stringify({ source: snapshot ? 'initial working tree snapshot' : 'current working tree', warmupsPerCase: warmups, measuredIncidentsPerCase: measured,
    completeIncident, realHandTriangles:handTriangles, skinPreparation,
    scope: `Production fixed-step CPU in Node with animation runtime and ${realHands ? 'actual artist-hand meshes, warm exact skin kernel and other procedural fallback assets' : 'procedural fallback assets'}. ${completeIncident ? 'Includes the complete bail and finite post-control rise rebound' : 'Ends when bail control returns'}; excludes render/GPU/browser costs. Timings are descriptive, work counts are deterministic.`, contact, results }, null, 2));
} finally { Array.prototype.sort = nativeSort; Math.random = random; console.warn = warn; console.error = error; runtime?.dispose(); level?.dispose(); await server.close(); }
