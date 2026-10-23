import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  const {ROLLING_BONES_LEVEL:main}=await r.server.ssrLoadModule('/src/levels/ripcord-river.ts');
  const {RUMBLEWATER_RUN_LEVEL:original}=await r.server.ssrLoadModule('/src/levels/rumblewater-run.ts');
  const copy=normalizeCustomLevelData(r.l.captureData());
  assert.ok(copy,'sculpted moving solids survive capture/export/import');
  assert.deepEqual(copy.components,JSON.parse(JSON.stringify(r.source.components)));
  for(const c of r.source.components.filter(c=>['mover','crumble'].includes(c.t))){
    assert.ok(c.vertices.length>200,'dynamic surface has a sculpted body');
    const native=(c.t==='mover'?r.l.movers:r.l.crumbles).find(x=>x.mesh.name===c.nm);
    assert.ok(native);assert.notEqual(native.mesh.geometry.type,'BoxGeometry');
    assert.ok(native.mesh.geometry.userData.grindIndices.length>0,'actual moving rim keeps edge grinding');
    if(c.t==='crumble')assert.ok(native.mesh.children.some(x=>x.name==='Fall-away split and warning bindings'));
    for(const change of [{indices:[0,1,999999]},{vertices:[0,0,Infinity]},{uvs:[0,0]}])
      assert.equal(normalizeCustomLevelData({...r.source,components:[{...c,...change}]}),null,'dynamic mesh input retains geometry validation');
  }
  assert.equal(r.source.components.filter(c=>c.t==='platform').length,0,'no rectangular static slabs');
  assert.equal(r.source.atmosphere.backdrop,'fog','old sky dome is hidden');
  const layers=r.source.components.filter(c=>['moonbonesky','moonboneclouds','moonboneridge'].includes(c.dkind));
  assert.equal(layers.length,3);assert.equal(new Set(layers.map(c=>c.p[2])).size,3);
  for(const c of layers)assert.ok(Math.abs(c.s[0]/c.s[1]-1.5)<1e-6,'matte keeps its source image ratio');
  assert.ok(r.l.jungleStreamReflections,'pool owns the painted backdrop reflection');
  assert.equal(r.l.jungleStreamSkyReflection,null,'hidden sky dome cannot leak into the pool');

  const files={moonboneskull:'moonbone-skull',moonboneribarch:'moonbone-rib-arch',moonbonecrypt:'moonbone-crypt'};
  let placements=0;
  for(const [kind,file]of Object.entries(files)){
    const bytes=await readFile(new URL('../public/moonbone-vault/'+file+'.glb',import.meta.url));
    const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    const a=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION],dims=a.max.map((v,i)=>v-a.min[i]);
    for(const c of [...r.source.components,...main.components].filter(c=>c.dkind===kind)){
      const scale=c.s.map((v,i)=>v/dims[i]);
      assert.ok(Math.max(...scale)/Math.min(...scale)<1.00001,kind+' must have uniform native scale');
      assert.equal(c.solid,false);assert.equal(c.scenerySolid,false);placements++;
    }
  }
  const gameplay=d=>d.components.filter(c=>c.t!=='decor'&&c.t!=='torch' || c.scenerySolid===true);
  assert.deepEqual(gameplay(main),gameplay(original),'main traversal, solids, camera, collectibles and hazards preserved');
  assert.deepEqual(main.boulderChase,original.boulderChase);
  assert.equal(main.components.filter(c=>c.nm?.startsWith('Moonbone landmark ')).filter(c=>files[c.dkind]).length,11);
  assert.ok(normalizeCustomLevelData(main),'main level stays editable within scenery budgets');
  console.log(JSON.stringify({pass:true,proportionalPlacements:placements,parallaxLayers:3,movingSolids:5,mainLandmarks:11}));
},{modulePath:'/src/levels/rolling-bones-bonus.ts',levelId:'bonus-rolling-bones',source:m=>m.ROLLING_BONES_BONUS_LEVEL});
