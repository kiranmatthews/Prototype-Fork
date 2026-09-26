import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { createServer } from 'vite';

// This test loads the real public GLBs and their real skeletons/keyframes. The
// only headless shim is image decoding: encoded image headers/bytes are checked
// below, while a dimensions-only ImageBitmap stands in for the GPU upload.
// Texture appearance and complete movement quality still require browser QA.
const root = new URL('../', import.meta.url);
const roster = ['grunt', 'spiker', 'turtle', 'charger', 'hopper', 'floater', 'sentry', 'spinner'];
const custom = ['hopper', 'floater', 'sentry', 'spinner'];
const args = new Set(process.argv.slice(2));
assert.ok([...args].every(arg => arg === '--custom-only'), 'Only --custom-only is supported');
const kinds = args.has('--custom-only') ? custom : roster;
const quadrupeds = new Set(['grunt', 'spiker', 'turtle', 'charger']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const epsilon = 2e-4;
const legs = ['frontLeft', 'frontRight', 'hindLeft', 'hindRight'];
const legRoles = leg => {
  const prefix = leg.startsWith('front') ? 'front' : 'hind';
  const side = leg.endsWith('Left') ? 'Left' : 'Right';
  return ['Upper', 'Lower', 'Foot'].map(segment => `${prefix}${segment}${side}`);
};
const legNodes = legs.flatMap(legRoles);
const required = {
  grunt: ['torso', 'head', ...legNodes], spiker: ['torso', 'head', ...legNodes],
  turtle: ['torso', 'head', ...legNodes], charger: ['torso', 'head', ...legNodes],
  hopper: ['torso', 'head', ...legNodes], floater: ['torso', 'head', 'rotor'],
  sentry: ['torso', 'head', 'base', 'barrel', 'charge'],
  spinner: ['torso', 'base', 'rotor', 'blade0', 'blade1', 'blade2', 'blade3'],
};
// The level's unchanged combat boxes. Grounded models may extend down to the
// support plane even where a combat box starts slightly above it (sentry).
const boxes = {
  grunt: [1.3, 1.1, .55], spiker: [1.3, 1.1, .55], turtle: [1.3, .9, .42],
  charger: [1.45, 1.1, .55], hopper: [1.3, 1.1, .55], floater: [1.3, 1.1, .05],
  sentry: [1.05, 1.15, .6], spinner: [2.1, 1.1, .55],
};

function parseGlb(bytes, label) {
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${label}: GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${label}: GLB version`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${label}: truncated GLB`);
  let doc, bin;
  for (let offset = 12; offset < bytes.length;) {
    const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.ok(offset + 8 + size <= bytes.length, `${label}: chunk overflows GLB`);
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 0x4e4f534a) doc = JSON.parse(data.toString('utf8').trimEnd());
    if (type === 0x004e4942) bin = data;
    offset += 8 + size;
  }
  assert.ok(doc && bin, `${label}: missing JSON/BIN chunk`);
  assert.equal(doc.buffers.length, 1, `${label}: one embedded buffer`);
  assert.equal(doc.buffers[0].uri, undefined, `${label}: external buffer is not publishable`);
  for (const view of doc.bufferViews) {
    assert.equal(view.buffer, 0, `${label}: unexpected buffer reference`);
    assert.ok((view.byteOffset ?? 0) + view.byteLength <= bin.length, `${label}: bufferView out of range`);
  }
  return { doc, bin };
}

function imageSize(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', 'PNG lacks IHDR');
    assert.ok(bytes.subarray(-12).includes(Buffer.from('IEND')), 'PNG is truncated');
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), mime: 'image/png' };
  }
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Expected PNG or JPEG texture');
  assert.equal(bytes.readUInt16BE(bytes.length - 2), 0xffd9, 'JPEG is truncated');
  for (let at = 2; at + 8 < bytes.length;) {
    if (bytes[at] !== 0xff) { at++; continue; }
    while (bytes[at] === 0xff) at++;
    const marker = bytes[at++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const length = bytes.readUInt16BE(at);
    assert.ok(length >= 2 && at + length <= bytes.length, 'JPEG marker overflows texture');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker))
      return { width: bytes.readUInt16BE(at + 5), height: bytes.readUInt16BE(at + 3), mime: 'image/jpeg' };
    at += length;
  }
  throw new Error('JPEG lacks dimensions');
}

function metadata(scene) {
  let result = {};
  scene.traverse(node => {
    const value = node.userData.enemyRig;
    if (value) result = { ...result, ...value, mapping: { ...result.mapping, ...value.mapping } };
  });
  return result;
}
function resolve(scene, mapping, role) {
  const binding = mapping?.[role];
  assert.ok(binding, `${role}: missing explicit semantic mapping`);
  const value = typeof binding === 'string' ? binding : binding.name;
  const names = typeof value === 'string' ? [value] : value;
  assert.ok(Array.isArray(names) && names.length, `${role}: invalid node binding`);
  const node = names.map(name => scene.getObjectByName(name)).find(Boolean);
  assert.ok(node, `${role}: mapped node missing (${names.join(', ')})`);
  return node;
}
function actualVertices(scene, inspectVertex) {
  const points = [];
  scene.updateMatrixWorld(true);
  scene.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update(); });
  scene.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible) return;
    const count = mesh.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
      const point = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      assert.ok(point.toArray().every(Number.isFinite), `${mesh.name}: nonfinite deformed vertex ${i}`);
      inspectVertex?.(point, mesh, i);
      points.push(point);
    }
  });
  assert.ok(points.length > 100, 'Asset must contain its actual detailed surface');
  return points;
}
const radius = points => Math.max(...points.map(point => Math.hypot(point.x, point.z)));
const stableTransforms = scene => {
  scene.updateMatrixWorld(true);
  scene.traverse(node => assert.ok(node.matrixWorld.elements.every(Number.isFinite), `${node.name}: nonfinite world transform`));
};
const descendants = node => { const result = new Set(); node.traverse(child => result.add(child)); return result; };
const meshMaterials = node => {
  const result = new Set();
  node.traverse(child => { if (child.isMesh) for (const material of Array.isArray(child.material) ? child.material : [child.material]) result.add(material); });
  return result;
};

const ledger = JSON.parse(await readFile(new URL('tools/enemies/tasks.json', root), 'utf8'));
const bytesByKind = new Map(), reports = [];
const nativeFetch = globalThis.fetch;
globalThis.self = globalThis;
globalThis.ProgressEvent ??= class { constructor(type, data) { this.type = type; Object.assign(this, data); } };
globalThis.createImageBitmap = async blob => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const { width, height } = imageSize(bytes);
  return { width, height, close() {} };
};
globalThis.fetch = async input => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('blob:')) return nativeFetch(input);
  const path = new URL(url, 'http://enemy-assets.invalid').pathname;
  const match = path.match(/^\/enemies\/([a-z]+)\.glb$/);
  assert.ok(match && bytesByKind.has(match[1]), `Unexpected asset fetch: ${path}`);
  const bytes = bytesByKind.get(match[1]);
  return new Response(bytes, { headers: { 'Content-Type': 'model/gltf-binary', 'Content-Length': String(bytes.length) } });
};

async function provenance(kind, gltf, bytes) {
  const spec = JSON.parse(await readFile(new URL(`tools/enemies/rigs/${kind}.json`, root), 'utf8'));
  const job = ledger.tasks[kind];
  assert.equal(job?.state, 'SUCCEEDED', `${kind}: generation did not succeed`);
  assert.equal(spec.providerTaskId, job.id, `${kind}: provider task provenance mismatch`);
  assert.match(spec.sourceSha256, hashPattern, `${kind}: reviewed source hash missing`);
  assert.equal(spec.outputSha256, sha(bytes), `${kind}: packed output differs from preparation record`);
  const sourceHash = quadrupeds.has(kind) ? spec.generatedSourceSha256 : spec.sourceSha256;
  assert.ok(job.downloads.some(download => download.sha256 === sourceHash), `${kind}: source not linked to downloaded Meshy model`);
  const reference = await readFile(new URL(job.reference, root));
  assert.equal(sha(reference), job.referenceSha256, `${kind}: ImageGen reference changed after submission`);
  if (quadrupeds.has(kind)) {
    if (spec.walkSourceSha256) {
      assert.equal(spec.sourceSha256, sourceHash, `${kind}: retargeted custom skin must preserve generated surface provenance`);
      const motion = metadata(gltf.scene).motionProvenance;
      assert.match(spec.walkSourceSha256, hashPattern, `${kind}: missing Meshy motion hash`);
      assert.equal(motion?.sourceFbxSha256, spec.walkSourceSha256, `${kind}: retargeted walk source differs from provenance`);
      const sources = JSON.parse(await readFile(new URL('tools/enemies/motion-sources.json', root), 'utf8')).sources;
      const archive = sources.find(source => source.provider === 'Meshy' && source.files.some(file =>
        /Animation_Walking.*\.fbx$/i.test(file.name) && file.sha256 === spec.walkSourceSha256));
      assert.ok(archive && hashPattern.test(archive.archiveSha256), `${kind}: walk not linked to an actual recorded Meshy walking export`);
    } else {
      assert.equal(metadata(gltf.scene).sourceSha256, spec.sourceSha256, `${kind}: packed walk source differs from provenance`);
    }
  } else {
    assert.deepEqual(metadata(gltf.scene).mapping, spec.enemyRig.mapping, `${kind}: baked semantic rig differs from reviewed spec`);
  }
  // Fresh checkouts can validate the committed generation ledger. Authoring
  // workstations additionally compare it with the actual downloaded surface.
  try {
    const raw = await readFile(new URL(`.img2threejs/enemies/${kind}.glb`, root));
    assert.equal(sha(raw), sourceHash, `${kind}: local source differs from reviewed generation`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return spec;
}

const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const visuals = [];
try {
  const { createEnemyVisual } = await server.ssrLoadModule('/src/enemies/runtime.ts');
  for (const kind of kinds) {
    const path = new URL(`public/enemies/${kind}.glb`, root);
    let bytes;
    try { bytes = await readFile(path); }
    catch (error) { throw new Error(`${kind}: required shipped GLB missing at ${fileURLToPath(path)}`, { cause: error }); }
    assert.ok(bytes.length < 2 * 1024 * 1024, `${kind}: exceeds 2 MiB transfer budget`);
    bytesByKind.set(kind, bytes);
    const { doc, bin } = parseGlb(bytes, kind);
    assert.ok(doc.images?.length, `${kind}: generated albedo missing`);
    let texels = 0;
    for (const image of doc.images) {
      assert.ok(image.bufferView !== undefined && !image.uri, `${kind}: texture must be embedded`);
      const view = doc.bufferViews[image.bufferView];
      const encoded = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
      const size = imageSize(encoded);
      assert.equal(image.mimeType, size.mime, `${kind}: incorrect texture MIME type`);
      assert.ok(size.width > 1 && size.height > 1 && size.width <= 1024 && size.height <= 1024,
        `${kind}: texture dimensions outside 2..1024 budget`);
      texels += size.width * size.height;
    }
    assert.ok(texels <= 4 * 1024 * 1024, `${kind}: total texture texel budget exceeded`);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const spec = await provenance(kind, gltf, bytes);
    const rig = metadata(gltf.scene), mapped = {};
    for (const role of required[kind]) mapped[role] = resolve(gltf.scene, rig.mapping, role);
    let triangles = 0, skins = 0, restError = 0;
    const materialTextures = new Set();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      const geometry = mesh.geometry, position = geometry.attributes.position;
      triangles += (geometry.index?.count ?? position.count) / 3;
      for (const attribute of ['position', 'normal', 'uv']) {
        const value = geometry.attributes[attribute];
        assert.ok(value && Array.from(value.array).every(Number.isFinite), `${kind}: invalid ${attribute}`);
      }
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material.map) materialTextures.add(material.map);
      }
      if (!mesh.isSkinnedMesh) return;
      skins++;
      mesh.skeleton.update();
      const weights = geometry.attributes.skinWeight, joints = geometry.attributes.skinIndex;
      assert.ok(weights && joints && weights.count === position.count && joints.count === position.count, `${kind}: incomplete skin attributes`);
      assert.equal(mesh.skeleton.bones.length, mesh.skeleton.boneInverses.length);
      for (const matrix of mesh.skeleton.boneInverses)
        assert.ok(matrix.elements.every(Number.isFinite) && Math.abs(matrix.determinant()) > 1e-12, `${kind}: invalid inverse bind matrix`);
      for (let i = 0; i < position.count; i++) {
        let sum = 0;
        for (let c = 0; c < 4; c++) {
          const weight = weights.getComponent(i, c), joint = joints.getComponent(i, c);
          assert.ok(Number.isFinite(weight) && weight >= 0 && weight <= 1 + 1e-6, `${kind}: invalid weight at vertex ${i}`);
          assert.ok(Number.isInteger(joint) && joint >= 0 && joint < mesh.skeleton.bones.length, `${kind}: invalid joint at vertex ${i}`);
          sum += weight;
        }
        assert.ok(Math.abs(sum - 1) < .002, `${kind}: unnormalized/unweighted vertex ${i} (${sum})`);
        const raw = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
        const bound = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
        restError = Math.max(restError, raw.distanceTo(bound));
      }
    });
    assert.ok(triangles > 1000 && triangles < 13000, `${kind}: ${triangles} triangles outside detailed-enemy budget`);
    assert.ok(materialTextures.size, `${kind}: no loaded albedo material`);
    assert.ok(restError < 5e-4, `${kind}: inverse binds deform rest geometry (${restError}m)`);
    if (quadrupeds.has(kind) || kind === 'hopper') assert.ok(skins > 0, `${kind}: required actual skin missing`);
    if (quadrupeds.has(kind) || kind === 'hopper') for (const leg of legs) {
      const [upper, lower, foot] = legRoles(leg).map(role => mapped[role]);
      const chain = descendants(upper);
      assert.ok(upper.isBone && lower.isBone && foot.isBone && chain.has(lower) && descendants(lower).has(foot),
        `${kind}: ${leg} is not an articulated upper/lower/foot chain`);
      let weightedVertices = 0;
      gltf.scene.traverse(mesh => {
        if (!mesh.isSkinnedMesh) return;
        const weights = mesh.geometry.attributes.skinWeight, indices = mesh.geometry.attributes.skinIndex;
        for (let i = 0; i < weights.count; i++) {
          let influence = 0;
          for (let c = 0; c < 4; c++) if (chain.has(mesh.skeleton.bones[indices.getComponent(i, c)])) influence += weights.getComponent(i, c);
          if (influence > .1) weightedVertices++;
        }
      });
      assert.ok(weightedVertices >= 12, `${kind}: ${leg} joints do not deform a meaningful part of the model`);
    }
    if (!quadrupeds.has(kind) && kind !== 'hopper') {
      for (const role of required[kind].filter(role => role !== 'torso'))
        assert.ok(meshMaterials(mapped[role]).size, `${kind}: ${role} is an empty animation handle`);
    }
    if (kind === 'sentry') {
      const lens = meshMaterials(mapped.charge), other = new Set();
      const lensNodes = descendants(mapped.charge);
      gltf.scene.traverse(node => {
        if (node.isMesh && !lensNodes.has(node)) for (const material of Array.isArray(node.material) ? node.material : [node.material]) other.add(material);
      });
      assert.ok([...lens].every(material => !other.has(material)), 'sentry: charge lens shares a material with its housing');
      assert.ok(!descendants(mapped.head).has(mapped.base), 'sentry: stationary base inherits head articulation');
    }
    const restRecords = [];
    const rest = actualVertices(gltf.scene, (point, mesh, index) => restRecords.push({ point, mesh, index }));
    const box = new THREE.Box3().setFromPoints(rest);
    const [width, height, centerY] = boxes[kind];
    const lowY = kind === 'floater' ? centerY - height / 2 : Math.min(0, centerY - height / 2);
    const exceptions = (spec.boundsExceptions ?? []).map(exception => {
      assert.ok(kind === 'charger' && exception.role === 'tail' && exception.axis === 'z' &&
        exception.negative > 0 && exception.negative <= .25 && exception.positive === 0 && exception.reason,
      `${kind}: unsupported combat-envelope exception`);
      return { ...exception, nodes: descendants(resolve(gltf.scene, rig.mapping, exception.role)) };
    });
    for (const axis of ['x', 'z']) {
      for (const { point, mesh, index } of restRecords) {
        if (point[axis] >= -width / 2 - epsilon && point[axis] <= width / 2 + epsilon) continue;
        const allowed = exceptions.some(exception => {
          if (exception.axis !== axis || point[axis] < -width / 2 - exception.negative - epsilon ||
              point[axis] > width / 2 + exception.positive + epsilon || !mesh.isSkinnedMesh) return false;
          const weights = mesh.geometry.attributes.skinWeight, joints = mesh.geometry.attributes.skinIndex;
          let influence = 0;
          for (let c = 0; c < 4; c++) if (exception.nodes.has(mesh.skeleton.bones[joints.getComponent(index, c)]))
            influence += weights.getComponent(index, c);
          return influence >= .9;
        });
        assert.ok(allowed, `${kind}: solid rest vertex exceeds combat ${axis} (${point[axis]}); only a documented tail may overhang`);
      }
    }
    assert.ok(box.min.y >= lowY - epsilon && box.max.y <= centerY + height / 2 + epsilon,
      `${kind}: rest Y outside combat/support envelope (${box.min.y}..${box.max.y})`);
    if (kind !== 'floater') assert.ok(Math.abs(box.min.y) < epsilon, `${kind}: feet/base not on Y=0`);
    else {
      assert.ok(Math.abs((box.min.y + box.max.y) / 2 - spec.centerY) < epsilon, 'floater: incorrect authored presentation origin');
      assert.ok(box.min.y + .35 >= 0, `floater: swoop root at .35m clips ground by ${-(box.min.y + .35)}m`);
    }

    const visual = createEnemyVisual(kind, { url: `http://enemy-assets.invalid/enemies/${kind}.glb` });
    visuals.push(visual); await visual.ready;
    assert.equal(visual.diagnostics.status, 'ready', `${kind}: real runtime asset load failed: ${visual.diagnostics.error ?? ''}`);
    const frame = { state: 'patrol', stateTime: 0, time: 0, speed: 0,
      verticalVelocity: 0, grounded: true, alive: true, flung: false };
    let motion = 0;
    if (quadrupeds.has(kind)) {
      assert.ok(rig.walkClip && Number.isFinite(rig.walkSpeed) && rig.walkSpeed > 0, `${kind}: missing walk metadata`);
      const clip = gltf.animations.find(candidate => candidate.name === rig.walkClip);
      assert.ok(clip && clip.duration > .1 && clip.tracks.length > 4, `${kind}: actual Meshy walk missing`);
      const animated = new Set();
      for (const track of clip.tracks) {
        assert.ok(Array.from(track.times).every(Number.isFinite) && Array.from(track.values).every(Number.isFinite), `${kind}: walk has nonfinite keyframes`);
        for (let i = 1; i < track.times.length; i++) assert.ok(track.times[i] > track.times[i - 1], `${kind}: walk key times are not strictly ordered`);
        const stride = track.getValueSize();
        const changing = Array.from(track.values).some((value, i) => Math.abs(value - track.values[i % stride]) > 1e-4);
        if (changing) animated.add(THREE.PropertyBinding.parseTrackName(track.name).nodeName);
      }
      for (const leg of legs) {
        const branch = descendants(mapped[legRoles(leg)[0]]);
        assert.ok([...branch].some(node => animated.has(node.name)), `${kind}: source walk has no changing keys for ${leg}`);
      }
      const baseline = actualVertices(visual.group);
      const center = points => points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
      const restCenter = center(baseline);
      for (let sample = 0; sample < 24; sample++) {
        const dt = clip.duration / 24;
        visual.update(dt, { ...frame, speed: rig.walkSpeed, stateTime: (sample + 1) * dt, time: (sample + 1) * dt });
        assert.equal(visual.diagnostics.activeClip, rig.walkClip, `${kind}: runtime walk not playing`);
        const moved = actualVertices(visual.group);
        assert.equal(moved.length, baseline.length);
        const movingCenter = center(moved);
        assert.ok(Math.hypot(movingCenter.x - restCenter.x, movingCenter.z - restCenter.z) < .4,
          `${kind}: source walk carries the surface away from the gameplay root`);
        for (let i = 0; i < moved.length; i++) motion = Math.max(motion, moved[i].distanceTo(baseline[i]));
        assert.deepEqual(visual.group.position.toArray(), [0, 0, 0], `${kind}: clip moved gameplay root`);
        assert.deepEqual(visual.group.scale.toArray(), [1, 1, 1], `${kind}: clip scaled gameplay root`);
      }
      assert.ok(motion > .01, `${kind}: loaded walk does not deform its actual surface`);
    }
    if (kind === 'spinner') {
      for (const [state, limit] of [['out', 2.1], ['in', .8]]) {
        visual.reset();
        let swept = 0;
        for (let sample = 0; sample < 64; sample++) {
          const speed = state === 'out' ? 9 : 1.5;
          const dt = Math.PI * 2 / (speed * 64);
          visual.update(dt, { ...frame, state, stateTime: 1 + sample * dt, time: sample * dt });
          swept = Math.max(swept, radius(actualVertices(visual.group)));
        }
        assert.ok(swept <= limit + epsilon, `spinner: ${state} swept radius ${swept} exceeds ${limit}`);
      }
    }
    stableTransforms(visual.group);
    reports.push(`${kind}: ${Math.round(bytes.length / 1024)}KiB, ${triangles} triangles, ${skins} skins${motion ? `, ${motion.toFixed(3)}m walk deformation` : ''}`);
    visual.dispose();
  }
  console.log(`PASS actual enemy assets (${kinds.length}/${roster.length}${args.has('--custom-only') ? '; custom-only development subset' : ''}):\n${reports.join('\n')}`);
  console.log('Validated real GLB loading, semantic rig bindings, normalized skin weights/rest pose, combat fit, source provenance, texture/transfer budgets and applicable full walk/spinner sweeps.');
} finally {
  for (const visual of visuals) visual.dispose();
  globalThis.fetch = nativeFetch;
  await server.close();
}
