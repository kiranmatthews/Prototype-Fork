import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,Level,Player})=>{
  const {milkBlob,MilkMaterial}=await server.ssrLoadModule('/src/milk.ts');
  const {addJungleDepthFade}=await server.ssrLoadModule('/src/jungleGround.ts');
  const shaderFor=material=>{
    const shader={vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{}};
    material.onBeforeCompile(shader,null);return shader;
  };
  const before=milkBlob().children[0].material,baseline=shaderFor(before);
  const jungle=new Level(new THREE.Scene(),{id:'jungle',name:'Jungle Ruins'});
  assert.equal(jungle.pickups[0].mesh.children[0].material,before,'shared material path changed');
  const testData=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8')).levels.find(l=>l.id==='test');
  const course=new Level(new THREE.Scene(),testData);
  const low=course.pickups.filter(p=>p.mesh.position.y<-10);
  assert.ok(low.length>20,'fixture no longer exercises the long descending course');
  const material=low[0].mesh.children[0].material;
  assert.equal(material,before);
  assert.equal(material.userData.jungleDepthFade,undefined,'Jungle contaminated shared milk');
  assert.deepEqual(shaderFor(material),baseline,'course transitions altered milk shading');
  const player=new Player(new THREE.Scene());
  player.spawnFruit(new THREE.Box3(new THREE.Vector3(-2,-26,-2000),new THREE.Vector3(-1,-25,-1999)),1);
  const drop=player.fruits.find(f=>f.phase!=='off').mesh.children[0].children[0];
  assert.equal(drop.material,before,'crate milk bypassed shared material policy');
  for(const m of [material,material.clone(),new MilkMaterial()]){
    addJungleDepthFade(m);
    const shader=shaderFor(m);
    assert.doesNotMatch(shader.fragmentShader,/vJungleDepthY/);
    assert.match(shader.fragmentShader,/vec3 outgoingLight = body/);
  }
  const scenery=new THREE.MeshBasicMaterial();addJungleDepthFade(scenery);
  assert.match(shaderFor(scenery).fragmentShader,/smoothstep\(-10.0, -4.2, vJungleDepthY\)/,'pit scenery lost its depth fade');
  jungle.dispose();course.dispose();scenery.dispose();
  assert.deepEqual(shaderFor(milkBlob().children[0].material),baseline,'unloading a level altered shared milk');
  console.log(`PASS Jungle → Test Course → unload: ${low.length} pickups below Y=-10, crate drops and material clones retain milk shading; pit scenery still fades.`);
});
