import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
  const {installSkyProjection}=await server.ssrLoadModule('/src/skyProjection.ts');
  const {installBananaBaySkySun}=await server.ssrLoadModule('/src/bananaBaySkySun.ts');
  const {SKYSTREAM_SUN}=await server.ssrLoadModule('/src/skystreamSun.ts');
  const material=new THREE.MeshBasicMaterial();
  const sky=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
  const projection=installSkyProjection(sky,{value:new THREE.Color('#aabbcc')},{value:1},{value:1},{value:0});
  const compile=()=>{
    const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};
    material.onBeforeCompile(shader,{});
    return shader;
  };
  const original=compile(),originalKey=material.customProgramCacheKey();
  const setEnabled=installBananaBaySkySun(material,new THREE.Vector3(.42,.52,-.74));
  const unchanged=()=>{
    const shader=compile();
    assert.equal(shader.vertexShader,original.vertexShader);
    assert.equal(shader.fragmentShader,original.fragmentShader);
    assert.deepEqual(Object.keys(shader.uniforms),Object.keys(original.uniforms));
    assert.equal(material.customProgramCacheKey(),originalKey);
    assert.equal(shader.uniforms.uCloudSun.value,SKYSTREAM_SUN,'Skystream retains its own immutable sun direction');
  };
  unchanged();
  for(let visit=0;visit<4;visit++){
    const version=material.version;setEnabled(true);
    const banana=compile();
    assert.equal(material.version,version+1,'entering Banana Bay selects its own program');
    assert.ok(banana.fragmentShader.includes('bananaSunBloom'));
    assert.ok(banana.uniforms.uBananaBaySun.value.distanceTo(new THREE.Vector3(.42,.52,-.74).normalize())<1e-12);
    assert.notEqual(material.customProgramCacheKey(),originalKey);
    assert.equal(banana.vertexShader,original.vertexShader,'sun must not change the sky projection or shoreline');
    setEnabled(true);assert.equal(material.version,version+1,'ordinary theme refreshes reuse the program');
    setEnabled(false);unchanged();
    projection.setCloudRoadSky(true);unchanged();
    projection.setCloudRoadSky(false);projection.setSeaLevel(-.36);unchanged();
    projection.setSeaLevel(null);unchanged();
  }
  material.dispose();sky.geometry.dispose();
  console.log('PASS: Banana Bay sun is isolated; original shader, uniforms, projection and cache key return exactly across repeated ocean/land/Skystream changes.');
} finally {await server.close();}
