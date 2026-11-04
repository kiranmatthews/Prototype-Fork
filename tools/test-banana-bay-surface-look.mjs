import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',
  cacheDir:'.local/surface-test-vite',server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const load=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=()=>new THREE.Texture();
let water;
const owners=[];
try {
  const {UnityOcean,UNITY_OCEAN_DEFAULTS}=await server.ssrLoadModule('/src/unityOcean.ts');
  const {createUnitySandMaterial}=await server.ssrLoadModule('/src/unitySandMaterial.ts');
  const {BAY_OCEAN_LOOK}=await server.ssrLoadModule('/src/levels/banana-bay-theme.ts');
  const {OceanTuningStore}=await server.ssrLoadModule('/src/oceanTuning.ts');
  const legacy=structuredClone(UNITY_OCEAN_DEFAULTS);
  water=new UnityOcean({seaLevel:0,shoreDirX:1,shoreDirZ:0,
    shore:[{x:0,z:2,sx:1,sz:0},{x:0,z:-2,sx:1,sz:0}],oceanWidth:4,
    shoreOverlap:0,lateralSegments:4,extendUnityTails:false,quality:'full'});
  const materials=[];
  for(const texKind of ['sand','sunny-sand']){
    const owner=createUnitySandMaterial({loadTexture:()=>new THREE.Texture()});owners.push(owner);
    const m=owner.material;m.userData.texKind=texKind;materials.push(m);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-2,1,-2,2,-1,-2,-2,1,2,2,-1,2],3));
  geometry.setIndex([0,2,1,1,2,3]);geometry.computeVertexNormals();
  const meshes=materials.map(m=>new THREE.Mesh(geometry,m));
  water.setShoreGeometry(meshes);
  const compiled=materials.map(m=>{
    const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,
      fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
    m.onBeforeCompile(shader,{});return shader;
  });
  assert.equal(compiled[0].uniforms.uSandWetRoughness.value,.24,'legacy coast retains its wet finish');
  assert.equal(compiled[1].uniforms.uSandWetRoughness.value,.92,'Banana Bay wet sand remains diffuse');
  assert.equal(compiled[0].fragmentShader,compiled[1].fragmentShader,'one shader program supports independent material uniforms');
  assert.equal(materials[0].customProgramCacheKey(),materials[1].customProgramCacheKey());
  assert.ok(compiled[1].fragmentShader.includes('diffuseColor.rgb*=mix'),'damp sand still darkens');
  assert.ok(compiled[1].fragmentShader.includes('uSandWetRoughness,sandWet'),'roughness uses the material uniform');
  assert.ok(materials.every(m=>m.roughness===1&&m.normalScale.x===.5),'the shared dry material is untouched');

  const positions=Array.from({length:40},(_,i)=>[i*.13-1.5,Math.sin(i)*1.6,i*.7]);
  const before=positions.map(([x,z,t])=>water.sampleWaterSurface(x,z,t));
  Object.assign(water.params,structuredClone(BAY_OCEAN_LOOK));
  assert.ok(Math.max(BAY_OCEAN_LOOK.specular.r,BAY_OCEAN_LOOK.specular.g,BAY_OCEAN_LOOK.specular.b)<=1,
    'lagoon highlight must not inherit the 14–25 HDR source values');
  assert.equal(water.params.reflectionStrength,.38,'retain authored reflections');
  assert.equal(water.params.causticsStrength,.4,'retain authored caustics');
  for(const quality of ['lite','full']){
    water.setQuality(quality);
    assert.deepEqual(positions.map(([x,z,t])=>water.sampleWaterSurface(x,z,t)),before,
      'surface appearance cannot change waves, shore displacement or swimming');
  }
  const store=new OceanTuningStore();store.apply(water,'level');
  store.setField('level',['specular','r'],.8);store.apply(water,'level');
  assert.equal(water.params.specular.r,.8,'editor adjustment remains available');
  store.reset('level');store.apply(water,'level');
  assert.deepEqual(water.params.specular,BAY_OCEAN_LOOK.specular,'reset restores the level baseline');
  assert.deepEqual(UNITY_OCEAN_DEFAULTS,legacy,'other ocean defaults remain byte-for-byte equivalent');
  geometry.dispose();
  console.log('PASS Banana Bay surfaces: matte damp sand, isolated legacy finish, bounded glint, retained reflections, 80 identical physical samples, editor reset.');
} finally {
  water?.dispose();owners.forEach(owner=>owner.dispose());
  THREE.TextureLoader.prototype.load=load;await server.close();
}
