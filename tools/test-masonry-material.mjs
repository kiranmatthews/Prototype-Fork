import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
  const {addMasonryLook,isMasonryTexture}=await server.ssrLoadModule('/src/masonryMaterial.ts');
  const {Level,setEditorBuild,migrateCustomLevel}=await server.ssrLoadModule('/src/level.ts');
  const {SKY_BRIDGE_LEVEL}=await server.ssrLoadModule('/src/levels/sky-bridge.ts');
  for(const kind of ['coast-stone','stone']) {
    const material=new THREE.MeshPhongMaterial({map:new THREE.Texture()});
    let priorCalls=0;material.onBeforeCompile=shader=>{priorCalls++;shader.uniforms.existing={value:9};};
    material.customProgramCacheKey=()=> 'existing-look';
    addMasonryLook(material,kind);addMasonryLook(material,kind);
    const shader={...THREE.ShaderLib.phong,uniforms:{}};material.onBeforeCompile(shader);
    assert.equal(priorCalls,1,'installing twice nested the shader');assert.equal(shader.uniforms.existing.value,9);
    assert.match(material.customProgramCacheKey(),/^existing-look\|metric-masonry/);
    assert.equal(material.normalMap,null);assert.equal(material.bumpMap,null,'extra GPU texture allocated');
    assert.ok(shader.uniforms.masonryRelief.value>0&&shader.uniforms.masonryRelief.value<.04);
    assert.ok(shader.uniforms.masonryTileSize.value>1);
    // Three's clone copies userData, but not shader hooks. Reapplication must work.
    const copy=material.clone();addMasonryLook(copy,kind);
    const copiedShader={...THREE.ShaderLib.phong,uniforms:{}};copy.onBeforeCompile(copiedShader);
    assert.ok(copiedShader.uniforms.masonryRelief,'cloned metadata incorrectly skipped the effect');
    assert.equal(copy.map,material.map,'hook changed map ownership');
    copy.dispose();material.dispose();
  }
  for(const kind of ['treehouse-stone','coast-bedrock','wood','castle-stone',undefined])assert.equal(isMasonryTexture(kind),false);
  const components=[
    {t:'platform',p:[0,-.5,0],s:[6,1,4],tex:'coast-stone',color:'#a69b82'},
    {t:'wall',p:[8,1,0],s:[2,3,8],tex:'stone'},
    {t:'rock',p:[-8,0,0],s:[3,2,3],tex:'coast-stone'},
    {t:'ramp',p:[0,0,-9],len:5,w:5,rise:2,tex:'stone'},
    {t:'mesh',p:[12,1,0],s:[2,.7,3],yaw:30,tex:'coast-stone',nm:'custom masonry',emissive:'#010203',fog:false,opacity:.8,doubleSided:true,
      vertices:[-1,0,1,1,0,1,0,0,-1],indices:[0,1,2],uvs:[0,0,8,0,0,4]},
    {t:'mesh',p:[20,1,0],tex:'stone',solid:false,nm:'batched masonry',vertices:[-1,0,1,1,0,1,0,0,-1]},
    {t:'gate',p:[0,0,-20]},
  ];
  const data=migrateCustomLevel({v:1,name:'Masonry regression',spawn:[0,.1,0],killY:-30,components});
  for(const editing of [false,true]) {
    setEditorBuild(editing);
    const level=new Level(new THREE.Scene(),{id:'masonry-test',name:data.name,data:structuredClone(data)});
    try {
      assert.deepEqual(level.captureData(),data,'shading changed saved geometry/UVs');
      const meshes=[];level.root.traverse(o=>{if(o.isMesh)meshes.push(o);});
      const authored=meshes.find(m=>m.name==='custom masonry');assert.ok(authored);
      for(const mesh of level.groundMeshes.filter(m=>m!==undefined&&['coast-stone','stone'].includes(m.material.userData.texKind))) {
        assert.equal(mesh.material.type,'MeshPhongMaterial');assert.ok(mesh.material.userData.masonry,mesh.name);
        assert.equal(mesh.userData.slippy,undefined,'shading changed traction');
      }
      const m=authored.material;
      assert.equal(m.fog,false);assert.equal(m.opacity,.8);assert.equal(m.side,THREE.DoubleSide);assert.equal(m.emissive.getHexString(),'010203');
      assert.ok(meshes.filter(m=>[m.material].flat().some(material=>material.userData.masonry)).length>=6,'a material entry point missed the shared look');
      const textures=new Set(meshes.flatMap(m=>[m.material].flat().flatMap(material=>Object.values(material).filter(v=>v?.isTexture&&!v.userData.shared))));
      const counts=new Map([...textures].map(t=>[t,0]));for(const t of textures)t.addEventListener('dispose',()=>counts.set(t,counts.get(t)+1));
      level.dispose();assert.ok([...counts.values()].every(n=>n===1),'texture ownership changed');
    } catch(e){level.dispose();throw e;}
  }
  setEditorBuild(false);
  const sky=new Level(new THREE.Scene(),{id:'sky',name:'Sky Bridge',data:structuredClone(SKY_BRIDGE_LEVEL)});
  try {
    const masonry=sky.groundMeshes.filter(m=>m.material.userData.texKind==='coast-stone');
    assert.ok(masonry.length>=10);assert.ok(masonry.every(m=>m.material.userData.masonry));
    assert.deepEqual(sky.captureData(),migrateCustomLevel(JSON.parse(JSON.stringify(SKY_BRIDGE_LEVEL))));
  } finally {sky.dispose();}
  console.log('PASS masonry factories, editor/play copies, shader composition, cloned hooks, unchanged geometry/traction and texture ownership');
} finally {await server.close();}
