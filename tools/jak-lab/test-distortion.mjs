import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import ts from 'typescript';

const load=async name=>{
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);
  return module.exports;
};
const {ParticleMotion}=await load('particleMotion');
const {DistortionBatch,ParticleRenderPass,distortionTopology,distortionSlices}=await load('distortion');
const numeric=(field,base)=>({field,op:'float',base});
const flags=(...value)=>({field:'flags',op:'value',value});
const definition=(id,fields)=>({id,source:{file:'distortion-fixture.gc',line:1},fields});
const group={id:1,name:'distortion-fixture',source:{file:'fixture.gc',line:1},items:[{particle:1,flags:['launch-asap']}]};
const aux=(count=1,slices=5)=>definition(1,[numeric('num',count),numeric('timer',15),numeric('rot-x',slices),
  numeric('r',8192),numeric('g',4096),numeric('b',6144),numeric('a',99),numeric('fade-a',-1),
  numeric('fade-b',-20),numeric('vel-y',2),flags('aux-list','bit2','bit3')]);
const run=(definitions)=>new ParticleMotion(group,new Map(definitions.map(d=>[d.id,d])));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

for(const [input,expected] of [[0,3],[2,3],[5,5],[12,11],[24,11]]) {
  const motion=run([aux(1,input)]);motion.update(1/60);
  const p=motion.particles[0];
  assert.equal(p.values['rot-x'],expected,'initial launch clamps the source flag');
  assert.equal(p.callback,'add-to-sprite-aux-list');assert.equal(p.flags.has('bit2'),false);
  assert.equal(p.values.a,0);assert.equal(p.values['fade-a'],0);
  assert.equal(motion.auxiliaryParticles[0],p,'auxiliary list retains the live sprite reference');
  close(p.position.y,10);close(motion.auxiliaryParticles[0].values.b,6044);
  motion.update(1/60);motion.update(1/60);
  assert.equal(motion.particles.length,1,'alpha-zero must not kill a distortion particle');
  motion.update(1/60);assert.equal(motion.particles.length,0);assert.equal(motion.auxiliaryParticles.length,0);
  assert.ok(!motion.issues.has('Sprite auxiliary geometry'));
}
{
  const motion=run([definition(1,[numeric('num',1),numeric('timer',100),numeric('next-time',10),numeric('next-launcher',2)]),
    definition(2,[numeric('rot-x',2),numeric('r',4096),numeric('g',2048),numeric('b',3072),flags('aux-list','bit2')])]);
  motion.update(1/60);motion.update(1/60);
  assert.equal(motion.particles[0].callback,'add-to-sprite-aux-list');
  assert.equal(motion.auxiliaryParticles.length,0,'relaunch changes the callback after this frame callback stage');
  motion.update(1/60);assert.equal(motion.auxiliaryParticles.length,1);
  assert.equal(motion.particles[0].values['rot-x'],2,'relaunch does not use the initial-launch clamp');
  const batch=new DistortionBatch({value:null});batch.write(motion.auxiliaryParticles);
  assert.equal(motion.particles[0].values['rot-x'],11,'invalid live flag uses the source draw fallback');
  batch.dispose();
}
{
  const motion=run([aux(300)]);motion.update(1/60);
  assert.equal(motion.particles.length,300,'auxiliary capacity does not kill simulation particles');
  assert.equal(motion.auxiliaryParticles.length,256);assert.equal(motion.auxiliaryDrops,44);
  assert.deepEqual(motion.auxiliaryParticles.map(p=>p.id),motion.particles.slice(0,256).map(p=>p.id));
  motion.reset();assert.equal(motion.auxiliaryDrops,0);assert.equal(motion.auxiliaryParticles.length,0);
}
{
  const mesh=distortionTopology(4);
  assert.equal(mesh.vertices.length,60);assert.equal(mesh.indices.length,54);
  const expected=[0,-1,0, 1,0,0, 0,-1,1, 1,0,1, 0,0,2];
  expected.forEach((v,i)=>close(mesh.vertices[i],v));
  assert.deepEqual([...mesh.indices.slice(0,18)],[0,1,2,2,1,3,2,3,4,4,3,5,4,5,6,6,5,7],
    'source strip continues across wedge boundaries, including its joining triangles');
  for(let slices=3;slices<=11;slices++) {
    const m=distortionTopology(slices);assert.equal(m.indices.length,(slices*5-2)*3);
    for(const index of m.indices)assert.ok(index<m.vertices.length/3);
    assert.ok([...m.vertices].every(Number.isFinite));
  }
  assert.equal(distortionSlices(2),11);assert.equal(distortionSlices(24),11);
  assert.throws(()=>distortionTopology(12));
}
{
  const motion=run([aux(1,4)]);motion.update(1/60);
  const batch=new DistortionBatch({value:null});batch.write(motion.auxiliaryParticles);
  assert.equal(batch.original.geometry,batch.gouraud.geometry,'both views share exact source topology and positions');
  assert.equal(batch.geometry.drawRange.count,54);assert.equal(batch.count,1);
  close(batch.geometry.getAttribute('centre').getY(0),10/4096);
  close(batch.geometry.getAttribute('radii').getX(0),2);close(batch.geometry.getAttribute('radii').getY(0),1);
  close(batch.geometry.getAttribute('radii').getZ(0),6044/4096);
  assert.ok(batch.gouraud.material.defines.GOURAUD_DISTORTION);
  assert.equal(batch.original.material.depthWrite,false);assert.equal(batch.gouraud.material.toneMapped,false);
  batch.write([]);assert.equal(batch.geometry.drawRange.count,0);batch.dispose();
}
{
  const pass=new ParticleRenderPass(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();
  scene.background=new THREE.Color('red');const background=scene.background,calls=[];
  let width=640,height=360,throwAt=-1;
  const renderer={autoClear:true,getDrawingBufferSize:out=>out.set(width,height),
    render(s,c){calls.push({kind:'render',mask:c.layers.mask,clear:this.autoClear,background:s.background});
      if(calls.length===throwAt)throw new Error('draw failed');},
    copyFramebufferToTexture(texture){calls.push({kind:'copy',texture});}};
  pass.render(renderer,scene,camera,true);
  assert.deepEqual(calls.map(c=>c.kind),['render','copy','render','render']);
  assert.deepEqual(calls.filter(c=>c.kind==='render').map(c=>[c.mask,c.clear]),[[1,true],[2,false],[4,false]]);
  assert.equal(calls[2].background,null);assert.equal(calls[3].background,null);
  assert.equal(scene.background,background);assert.equal(camera.layers.mask,1);assert.equal(renderer.autoClear,true);
  const first=pass.sceneTexture.value;assert.equal(first.minFilter,THREE.LinearFilter);assert.equal(first.colorSpace,THREE.NoColorSpace);
  width=1280;height=720;calls.length=0;pass.render(renderer,scene,camera,true);
  assert.notEqual(pass.sceneTexture.value,first);assert.equal(pass.sceneTexture.value.image.width,1280);
  calls.length=0;pass.render(renderer,scene,camera,false);
  assert.deepEqual(calls.map(c=>[c.kind,c.mask]),[['render',5]],'non-distortion frame needs one scene render');
  calls.length=0;throwAt=3;assert.throws(()=>pass.render(renderer,scene,camera,true),/draw failed/);
  assert.equal(scene.background,background);assert.equal(camera.layers.mask,1);assert.equal(renderer.autoClear,true);pass.dispose();
}
console.log('PASS auxiliary launch/relaunch flags, post-integration sprite references, alpha lifetime, source capacity, complete strip topology, matched variants and framebuffer/depth pass order');
