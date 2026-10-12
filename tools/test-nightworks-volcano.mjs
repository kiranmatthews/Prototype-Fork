import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withAfterHoursRuntime} from './nightworks-runner.mjs';

await withAfterHoursRuntime(async r=>{
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  const raw=r.source.createNightworksAfterHours(),dressed=r.source.NIGHTWORKS_AFTER_HOURS_LEVEL;
  assert.ok(normalizeCustomLevelData(dressed),'main art must survive editor validation');
  const physics=c=>Object.fromEntries(Object.entries(c).filter(([key])=>!['tex','color','emissive','invisible'].includes(key)));
  assert.deepEqual(dressed.components.slice(0,raw.components.length).map(physics),raw.components.map(physics),
    'all existing collider dimensions, component indices, timings, groups, camera volumes and rewards stay exact');
  assert.deepEqual(dressed.spawn,raw.spawn);assert.equal(dressed.killY,raw.killY);
  const art=dressed.components.slice(raw.components.length);
  assert.ok(art.every(c=>c.solid===false),'added scenery cannot create shortcuts or change collision');
  assert.equal(art.filter(c=>c.dkind==='nightvolcano').length,1);
  assert.ok(!dressed.components.some(c=>c.tex==='stone'),'generic brick surfaces are replaced');
  for(const c of dressed.components.filter(c=>c.tex==='nightworks-magma'))
    for(let i=1;i<c.vertices.length;i+=3)assert.ok(c.p[1]+c.vertices[i]<dressed.killY,'river remains below the original death plane');
  const base=new r.l.constructor(new r.THREE.Scene(),{id:'nightworks-after-hours',name:raw.name,data:raw});
  try{
    base.update(0);
    assert.equal(r.l.groundMeshes.length,base.groundMeshes.length,'art must add no ground contacts');
    for(let i=0;i<base.groundMeshes.length;i++){
      const a=r.l.groundMeshes[i],b=base.groundMeshes[i];
      assert.deepEqual(a.position.toArray(),b.position.toArray());
      assert.deepEqual(Array.from(a.geometry.attributes.position.array),Array.from(b.geometry.attributes.position.array));
    }
  }finally{base.dispose();}
  const camera=new r.THREE.PerspectiveCamera(),pad=r.l.phasePads[0];
  r.l.root.updateMatrixWorld(true);const worldBefore=pad.mesh.getWorldPosition(new r.THREE.Vector3());
  camera.position.set(1500,300,1500);r.l.updateSceneryView(camera);
  const wrapper=pad.mesh.parent;
  assert.equal(wrapper.name,'Quarry fog visibility');assert.equal(wrapper.visible,false);
  r.l.update(.1);const logicalVisible=pad.mesh.visible;
  camera.position.copy(pad.mesh.position);r.l.updateSceneryView(camera);r.l.root.updateMatrixWorld(true);
  assert.equal(wrapper.visible,true);assert.equal(pad.mesh.visible,logicalVisible,'culling cannot reveal an inactive phase pad');
  assert.deepEqual(pad.mesh.getWorldPosition(new r.THREE.Vector3()).toArray(),worldBefore.toArray(),'render wrappers cannot transform collision');
  camera.position.set(1500,300,1500);r.l.updateSceneryView(camera,undefined,true);
  assert.equal(wrapper.visible,true,'editor inspection restores distant geometry');
  const bonus=(await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts')).resolveBonusLevel('nightworks-after-hours');
  assert.ok(normalizeCustomLevelData(bonus),'bespoke bonus must survive editor validation');
  assert.equal(bonus.components.filter(c=>c.t==='gate').length,1);
  assert.equal(bonus.components.filter(c=>c.t==='crate').length,16);
  assert.equal(bonus.components.filter(c=>c.t==='mover').length,1);
  assert.equal(bonus.components.filter(c=>c.t==='phasepad').length,1);
  assert.ok(bonus.components.some(c=>c.dkind==='nightvolcano'));
  assert.ok(!bonus.components.some(c=>/^Room \d/.test(c.nm??'')),'the bonus cannot inherit a shared room recipe');
  const materials=[];r.l.root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.nightworksMagma)materials.push(m);});
  assert.ok(materials.length>0);
  const before=materials[0].userData.magmaClock.value;r.l.update(.05);
  assert.ok(materials[0].userData.magmaClock.value>before,'the native simulation advances the emission clock');
});

const bytes=await readFile(new URL('../public/nightworks-kit/volcano.glb',import.meta.url));
const model=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
assert.equal(model.materials.length,1,'one shared atlas draw');
assert.ok(model.textures[0].extensions.KHR_texture_basisu,'mipmapped GPU-compressed albedo');
assert.equal(model.images[model.textures[0].source].mimeType,'image/jpeg','portable fallback remains available');
assert.ok(bytes.length<3*1024*1024,'volcano download budget');
assert.ok(model.nodes.some(n=>n.name.endsWith('LOD0'))&&model.nodes.some(n=>n.name.endsWith('LOD1')));
console.log('PASS volcano: exact original ground/camera paths, non-colliding scenery, unique 16-crate bonus, native animation clock, compressed one-atlas asset.');
