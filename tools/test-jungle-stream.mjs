import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';

const fixture=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false}});
const water={t:'mesh',p:[35,-14.27,-234],vertices:[-27,0,6,27,0,6,-27,0,-6,27,0,-6],
  indices:[0,1,2,1,3,2],solid:false,tex:'solid',materialStyle:'jungle-stream',opacity:.48,color:'#8cb9a9'};
const stones=[
  {t:'decor',dkind:'trialsv2riverstonea',p:[34.6,-14.68,-230.2],s:[6.2,1,3.8]},
  {t:'decor',dkind:'trialsv2riverstoneb',p:[35.7,-14.62,-234.1],s:[6,1,4.1]},
  {t:'decor',dkind:'trialsv2riverstonec',p:[34.8,-14.7,-238.1],s:[6.5,1,4]},
];
try{
  const {createJungleStreamMaterial,jungleStreamContacts}=await server.ssrLoadModule('/src/jungleStream.ts');
  const {createStandingWaterMaterial,isStandingWater}=await server.ssrLoadModule('/src/standingWater.ts');
  const {TREEHOUSE_SOFT_SHADOW_CHUNK,addTreehouseTrialsMaterialLook}=await server.ssrLoadModule('/src/treehouseTrialsPresentation.ts');
  const {Level,normalizeCustomLevelData,parseCustomLevelJson,migrateCustomLevel}=await server.ssrLoadModule('/src/level.ts');
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(water.vertices,3));geo.setIndex(water.indices);geo.computeVertexNormals();
  const originalPositions=Array.from(geo.attributes.position.array),originalIndices=Array.from(geo.index.array);
  const contacts=jungleStreamContacts(water,geo,[...stones,
    {t:'decor',dkind:'trialsv2riverstonea',p:[200,-14.68,-234],s:[6,1,4]},
    {t:'decor',dkind:'trialsv2riverstoneb',p:[35,-20,-234],s:[6,1,4]},
    {t:'decor',dkind:'trialsv2riverstonec',p:[35,-14.68,-234],s:[6,1,4],invisible:true},
  ]);
  assert.equal(contacts.length,3,'only visible stones contacting this water footprint generate rings');
  assert.deepEqual(contacts[0].toArray(),[35.7,-234.1,3,2.05]);
  assert.ok(contacts.flatMap(c=>c.toArray()).every(Number.isFinite));
  assert.equal(jungleStreamContacts(water,geo,[...stones,...stones,...stones]).length,6,'contact uniforms remain bounded');
  const clock={value:2},material=createJungleStreamMaterial(clock,water,geo,stones);
  assert.equal(material.opacity,.48);assert.equal(material.depthWrite,false);assert.equal(material.forceSinglePass,true);
  assert.equal(material.map,null,'no texture/render-target allocation is required');
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader,{});
  assert.equal(shader.uniforms.uJungleStreamTime,clock);assert.equal(shader.uniforms.uJungleStreamStoneCount.value,3);
  assert.equal(shader.uniforms.uJungleStreamStones.value.length,6);
  assert.equal(shader.uniforms.uJungleStreamReflectionReady.value,0,'standalone callers retain a neutral reflection until a source is provided');
  assert.match(shader.fragmentShader,/texture2DLodEXT\(uJungleStreamReflection,streamEnvUv,2.0\)/);
  assert.match(shader.fragmentShader,/mix\(0.42,1.56,streamGrazing\)/,'alpha grows with the viewing angle');
  assert.ok(shader.fragmentShader.includes('streamFoam'));assert.ok(shader.fragmentShader.includes('streamDepth'));
  assert.equal(shader.vertexShader.includes('transformed.y +='),false,'ripples cannot displace or alter exact source vertices');
  assert.deepEqual(Array.from(geo.attributes.position.array),originalPositions);assert.deepEqual(Array.from(geo.index.array),originalIndices);
  let loaded,releases=0;
  const reflectionPromise=new Promise(resolve=>loaded=resolve),reflectionSource={acquire:()=>({promise:reflectionPromise,release:()=>releases++})};
  const reflective=createJungleStreamMaterial(clock,water,geo,stones,reflectionSource),reflectiveShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  reflective.onBeforeCompile(reflectiveShader,{});const key=reflective.customProgramCacheKey(),materialVersion=reflective.version,probe=new THREE.Texture(),probeGeo=new THREE.PlaneGeometry();
  assert.equal(reflectiveShader.uniforms.uJungleStreamReflectionReady.value,0);loaded({map:probe,geometry:probeGeo});await reflectionPromise;await Promise.resolve();
  assert.equal(reflectiveShader.uniforms.uJungleStreamReflectionReady.value,1);assert.equal(reflectiveShader.uniforms.uJungleStreamReflection.value,probe);
  assert.equal(reflective.customProgramCacheKey(),key,'reflection readiness never changes the compiled material program');
  assert.equal(reflective.version,materialVersion,'loaded reflection must not invalidate the material program');
  reflective.dispose();reflective.dispose();assert.equal(releases,1);assert.equal(reflectiveShader.uniforms.uJungleStreamReflectionReady.value,0);
  let resolveLate,lateReleases=0;const latePromise=new Promise(resolve=>resolveLate=resolve);
  const cancelled=createJungleStreamMaterial(clock,water,geo,stones,{acquire:()=>({promise:latePromise,release:()=>lateReleases++})});
  const cancelledShader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};cancelled.onBeforeCompile(cancelledShader,{});
  cancelled.dispose();resolveLate({map:probe,geometry:probeGeo});await latePromise;await Promise.resolve();assert.equal(lateReleases,1);assert.equal(cancelledShader.uniforms.uJungleStreamReflectionReady.value,0,'a late load cannot resurrect a disposed material');
  probe.dispose();probeGeo.dispose();
  const data={v:1,name:'Clear stream sentinel',spawn:[0,1,0],killY:-30,components:[water,{t:'gate',p:[0,0,-2]}]};
  assert.ok(normalizeCustomLevelData(data));assert.deepEqual(parseCustomLevelJson(JSON.stringify(data)),normalizeCustomLevelData(data));
  assert.equal(migrateCustomLevel(structuredClone(data)).components[0].materialStyle,'jungle-stream','legacy water migration cannot erase the new style');
  assert.equal(normalizeCustomLevelData({...data,components:[{...water,solid:true}]}),null,'stream surfaces remain explicitly visual');
  assert.equal(normalizeCustomLevelData({...data,components:[{...water,tex:'stone'}]}),null,'unsupported stream texture combinations are rejected');
  const level=new Level(new THREE.Scene(),{id:'clear-stream-sentinel',name:data.name,data});
  try{
    const mesh=level.pickRoot.children.find(o=>o.isMesh&&o.userData.editorIdx===0);
    assert.ok(mesh.material.userData.jungleStream);assert.equal(level.groundMeshes.includes(mesh),false);
    assert.equal(mesh.userData.castShadow,false,'transparent stream must not cast a solid shadow onto its visible bed');
    assert.equal(mesh.userData.receiveShadow,true,'stream receives the forest canopy shadow');
    assert.equal(mesh.geometry.attributes.position.count,4);assert.equal(mesh.geometry.index.count,6,'stream keeps its authored topology');
    assert.equal(level.captureData().components[0].materialStyle,'jungle-stream');
    const compiled={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};
    mesh.material.onBeforeCompile(compiled,{});const before=compiled.uniforms.uJungleStreamTime.value;level.update(1/60);
    assert.ok(compiled.uniforms.uJungleStreamTime.value>before,'the existing level water clock animates the stream');
  }finally{level.dispose();}
  const visualData={...data,jungleAtmosphere:true,jungleStyle:'painterly',components:[
    {t:'mesh',p:[0,0,0],vertices:[0,0,0,4,0,0,0,0,-4],solid:false,tex:'solid',colors:[1,1,1,1,1,1,1,1,1]},
    {t:'gate',p:[0,0,-2]}]};
  const visualLevel=new Level(new THREE.Scene(),{id:'painterly-visual-sentinel',name:visualData.name,data:visualData});
  try{
    const mesh=visualLevel.pickRoot.children.find(o=>o.isMesh&&o.userData.editorIdx===0);
    const compiled={uniforms:{},vertexShader:THREE.ShaderLib.lambert.vertexShader,fragmentShader:THREE.ShaderLib.lambert.fragmentShader};mesh.material.onBeforeCompile(compiled,{});
    assert.match(compiled.fragmentShader,/treehouseShadowRadius/,'non-colliding authored scenery must receive the same scoped soft-shadow material');
  }finally{visualLevel.dispose();}
  const still=createStandingWaterMaterial(clock,'#476c63',undefined,geo);assert.equal(still.userData.jungleStream,undefined);assert.equal(still.transparent,false);
  assert.equal(isStandingWater(water),false,'old standing-water behavior remains a distinct factory');
  const start=TREEHOUSE_SOFT_SHADOW_CHUNK.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  const end=TREEHOUSE_SOFT_SHADOW_CHUNK.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )',start);
  assert.equal((TREEHOUSE_SOFT_SHADOW_CHUNK.slice(start,end).match(/texture2DCompare/g)||[]).length,12);
  assert.match(TREEHOUSE_SOFT_SHADOW_CHUNK.slice(start,end),/shadowRadius/);
  const native=THREE.ShaderChunk.shadowmap_pars_fragment,nativeStart=native.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )'),nativeEnd=native.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )',nativeStart);
  assert.equal(TREEHOUSE_SOFT_SHADOW_CHUNK.slice(0,start),native.slice(0,nativeStart));
  assert.equal(TREEHOUSE_SOFT_SHADOW_CHUNK.slice(end),native.slice(nativeEnd),'native PCF, VSM and point shadow branches are unchanged');
  const opted=new THREE.MeshStandardMaterial();opted.userData.junglePainterly=true;addTreehouseTrialsMaterialLook(opted);
  const scoped={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};opted.onBeforeCompile(scoped,{});
  assert.match(scoped.fragmentShader,/treehouseShadowRadius/);
  still.dispose();material.dispose();opted.dispose();geo.dispose();
  console.log('PASS clear stream contacts/shore alpha/shared clock, exact topology/collision, portable editor style and scoped twelve-tap soft shadows.');
}finally{await server.close();}
