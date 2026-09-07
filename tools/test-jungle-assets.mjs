import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('public/jungle-kit/manifest.json', root), 'utf8'));
let total = 0;
for (const entry of manifest) {
  const bytes = await readFile(new URL(`public/jungle-kit/${entry.name}.glb`, root));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const doc = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)).trimEnd());
  assert.equal(doc.materials.length, 1);
  assert.equal(doc.images.length, 1, 'one texture per mesh');
  assert.equal(doc.images[0].mimeType, 'image/jpeg');
  assert.equal(doc.extensionsRequired, undefined, 'no external decoder');
  let triangles = 0;
  for (const mesh of doc.meshes) for (const p of mesh.primitives) {
    triangles += doc.accessors[p.indices].count / 3;
    const a = doc.accessors[p.attributes.POSITION];
    assert.ok(a.count > 0 && a.min.every(Number.isFinite) && a.max.every(Number.isFinite));
  }
  assert.equal(triangles, entry.triangles);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  assert.ok(triangles <= (['broadleaf','palm','fern'].includes(entry.name) ? 2000 : 6600));
  total += bytes.length;
}
assert.equal(manifest.length, 9);
assert.ok(total < 4 * 1024 * 1024, 'whole model kit transfer budget');
const budget = JSON.parse(await readFile(new URL('tools/jungle-kit/tasks.json', root), 'utf8'));
assert.ok(budget.reservedCredits <= 650);

// Use the repository's existing small DOM shim, then serve the actual GLBs.
const harness = await readFile(new URL('tools/validate-editor-roundtrip.mjs', root), 'utf8');
const dom = harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\nfunction round('));
const nativeFetch = globalThis.fetch;
runInThisContext(dom + '\ninstallHeadlessDom();');
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1024, height: 1024, close() {} });
globalThis.ProgressEvent ??= class { constructor(type, data) { this.type = type; Object.assign(this, data); } };
globalThis.fetch = async input => {
  const url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('blob:')) return nativeFetch(input);
  const match = url.match(/\/jungle-kit\/([\w-]+\.glb)$/);
  return match ? new Response(await readFile(new URL(`public/jungle-kit/${match[1]}`, root))) : new Response('', { status: 404 });
};
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { JungleAssetKit, JUNGLE_ASSET_KINDS, jungleAssetMatrix } = await server.ssrLoadModule('/src/jungleAssets.ts');
  const kit = new JungleAssetKit(true, false);
  for (const kind of JUNGLE_ASSET_KINDS) {
    for (let i = 0; i < 6; i++) kit.add({ dkind: kind, p: [0, 0, -i * 10] });
  }
  kit.flush(); await kit.ready();
  assert.deepEqual(kit.errors, []);
  assert.equal(kit.diagnostics.ready, 54);
  assert.ok(kit.diagnostics.draws < 54, 'nearby placements are instanced');
  const mats = new Map(), geos = new Map();
  kit.root.traverse(o => {
    if (!o.isMesh) return;
    assert.ok(o.geometry.userData.shared && o.material.map.userData.shared);
    assert.ok(o.boundingSphere?.radius > 0 && o.geometry.boundingBox.min.y < 0);
    if (mats.has(o.userData.jungleAsset)) assert.equal(o.material, mats.get(o.userData.jungleAsset));
    mats.set(o.userData.jungleAsset, o.material);
    geos.set(o.userData.jungleAsset, o.geometry);
    if (o.userData.jungleAsset.startsWith('jungle')) assert.ok(o.customDepthMaterial, 'animated shadow geometry');
  });
  kit.update(1/60); const time = kit.time.value;
  kit.update(0); assert.equal(kit.time.value, time, 'paused wind');
  kit.update(1/60); assert.ok(kit.time.value > time);
  const m = jungleAssetMatrix({ dkind: 'templeplatform', p: [2, 3, 4], s: [8, 2, 10] });
  assert.deepEqual(new THREE.Vector3(0, 1, 0).applyMatrix4(m).toArray(), [2, 5, 4]);
  const pending = new JungleAssetKit(false, false);
  pending.add({ dkind: 'jungleleaf', p: [0, 0, 0] }); pending.dispose();
  await pending.ready(); assert.equal(pending.root.children.length, 0, 'no late attachment after disposal');

  const { Level, setEditorBuild } = await server.ssrLoadModule('/src/level.ts');
  const level = new Level(new THREE.Scene(), { id: 'jungle', name: 'Jungle Ruins' });
  await level.prepareJungleAssets();
  level.pickRoot.updateMatrixWorld(true);
  if (process.env.JUNGLE_PICK) {
    const from = new THREE.Vector3(-2.292, 2.774, -94.96), target = new THREE.Vector3(-1.4, -5, -110);
    const meshes=[];level.pickRoot.traverse(o=>{if(o.isMesh)meshes.push(o);});
    const hits = new THREE.Raycaster(from, target.sub(from).normalize()).intersectObjects(meshes, false).filter(h => {
      for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
      return true;
    });
    console.log(hits.slice(0,5).map(h=>({name:h.object.name,position:h.point.toArray(),material:h.object.material.name,asset:h.object.userData.jungleAsset})));
  }
  const capture = JSON.parse(JSON.stringify(level.captureData()));
  assert.equal(capture.jungleAtmosphere, true);
  assert.equal(capture.components.filter(c => c.t === 'gate').length, 1);
  assert.ok(capture.components.some(c => c.dkind === 'roofedtemple'));
  assert.ok(capture.components.some(c => c.dkind === 'hangingarch'));
  assert.ok(capture.components.some(c => c.dkind === 'thornroots' && c.solid));
  for (const old of ['fern','broadleaf','jungletree','palm','plants','tree','vines','log'])
    assert.equal(capture.components.filter(c => c.dkind === old).length, 0, `${old} was replaced`);
  const support = (value, point) => new THREE.Raycaster(new THREE.Vector3(point[0], point[1] + 1, point[2]), new THREE.Vector3(0,-1,0), 0, 3).intersectObjects(value.groundMeshes)[0]?.point.y;
  assert.ok(Math.abs(support(level, level.spawnPos.toArray()) - level.spawnPos.y) < 0.5, 'supported spawn');
  for (let i = 0; i < 5; i++) {
    const height = (i+1)*2.3, x = [-2.6,2.6,-2.6,2.6,0][i], z = -332-i*12;
    assert.ok(Math.abs(support(level, [x,height,z]) - height) < 0.001, 'temple tier collision');
  }
  const copy = new Level(new THREE.Scene(), { id: 'jungle-copy', name: 'Jungle copy', data: capture });
  assert.deepEqual(copy.captureData(), capture, 'new props survive editor capture/load');
  assert.equal(copy.pitBoxes.length, level.pitBoxes.length, 'thorn hazards are reconstructed once');
  setEditorBuild(true);
  const editable = new Level(new THREE.Scene(), {id:'jungle-editor',name:'Jungle editor',data:capture});
  await editable.prepareJungleAssets();
  let editorAssets = 0;
  editable.pickRoot.traverse(o => {
    if (o.isMesh && o.userData.jungleAsset) { editorAssets++; assert.ok(Number.isInteger(o.userData.editorIdx), 'async model remains pickable'); }
  });
  assert.ok(editorAssets > 100);
  editable.dispose(); setEditorBuild(false); copy.dispose(); level.dispose(); kit.dispose(); kit.dispose();
  console.log(`Validated 9 actual GLBs (${(total/1048576).toFixed(2)} MiB), texture/triangle budgets, instancing, wind and shadows, disposal, supported spawn, five temple tiers, hazards, and editor round trip/picking.`);
} finally { await server.close(); }
