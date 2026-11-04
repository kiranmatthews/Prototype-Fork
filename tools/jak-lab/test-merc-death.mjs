import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import ts from 'typescript';
import {Vector3} from 'three';
import * as THREE from 'three';

const nativeRequire=createRequire(import.meta.url),modules=new Map();
function load(name) {
  const filename=path.resolve('src/jak-lab',name+'.ts');
  if(modules.has(filename))return modules.get(filename).exports;
  const module={exports:{}};modules.set(filename,module);
  const js=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('require','module','exports',js)(id=>id==='three'?THREE:id.startsWith('./')?load(id.slice(2)):nativeRequire(id),module,module.exports);
  return module.exports;
}
const {deathVertexIndices,deathVertexSkip,ModelDeathPlayback}=load('modelDeath'),{ParticleMotion}=load('particleMotion');
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const catalogue=JSON.parse(readFileSync(option('--catalogue'),'utf8')),assets=option('--assets');
const profiles=catalogue.meshDeaths.profiles,definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
const fixture={sourceVertices:8,effects:[[{start:0,count:3,copies:[]},{start:3,count:2,copies:[0,2]}],
  [{start:5,count:3,copies:[5]}]]};
const profile={...profiles[0],vertexSkip:3,frames:3};
assert.deepEqual(deathVertexIndices(fixture,profile,0),[0,3,2,5,5]);
assert.deepEqual(deathVertexIndices(fixture,profile,2),[1,4,6]);
assert.deepEqual(deathVertexIndices(fixture,profile,3),[]);
assert.deepEqual(deathVertexIndices(fixture,profile,-1),[]);
assert.equal(deathVertexSkip({...profile,vertexSkip:80},true,7000),66);
assert.equal(deathVertexSkip({...profile,vertexSkip:80},true,7001),132);
assert.equal(deathVertexSkip({...profile,vertexSkip:80},false,9000),160);
assert.equal(deathVertexSkip({...profile,vertexSkip:80},false,9001),320);
assert.equal(deathVertexSkip({...profile,vertexSkip:1},true),1);

const number=(field,base)=>({field,op:'float',base});
const group={id:1,name:'death-test',source:{file:'test',line:1},items:[]};
{
  // Exercise the actual sampler/clock against independently skinned drawn
  // vertices, including a morph and a vertex absent from the triangle index.
  // The canvas stand-in supplies one white texel; no rendering is mocked here.
  const oldDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8Array([255,255,255,255])})})})};
  const root=new THREE.Group(),original=new THREE.Group(),alternative=new THREE.Group();
  root.position.set(130,4,-80);root.rotation.y=.5;root.add(original,alternative);
  original.position.x=-3;original.scale.setScalar(.3);
  const source=new THREE.Group(),derived=new THREE.Group();source.position.set(2,1,-4);original.add(source);alternative.add(derived);
  const data={version:1,meshNode:7,sourceVertices:4,crossCopies:1,positions:[0,0,0,1,0,0,0,2,0,0,0,3],
    joints:Array(16).fill(0),weights:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    morphPositions:[[0,.5,0,0,1,0,0,0,.5,.5,0,0]],effects:[[{start:0,count:4,copies:[1]}]]};
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(data.joints,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(data.weights,4));
  geometry.setIndex([0,1,2]);geometry.morphTargetsRelative=true;
  geometry.morphAttributes.position=[new THREE.Float32BufferAttribute(data.morphPositions[0],3)];
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();
  mesh.userData.jakSourceNode=7;mesh.add(bone);source.add(mesh);mesh.bind(new THREE.Skeleton([bone]));
  const testProfile={...profile,id:'fixture',frames:3,overlap:2,particle:41,vertexSkip:2};
  const fixtureCatalogue={meshDeaths:{profiles:[testProfile],texture:'white'},particles:[{id:41,source:group.source,
    fields:[number('a',80),number('timer',30)]}]};
  const texture=new THREE.Texture({width:1,height:1});
  const playback=new ModelDeathPlayback({model:'fixture/model'},data,fixtureCatalogue,source,derived,original,alternative,texture);
  const pose=time=>{bone.rotation.z=time*2;mesh.morphTargetInfluences[0]=.3+time;root.updateMatrixWorld(true);};
  playback.configure('fixture',2/60);playback.seek(1/60,pose);
  assert.equal(playback.launched,0);assert.equal(source.visible,true);assert.equal(playback.phase,'animation');
  playback.seek(2/60,pose);
  const indices=deathVertexIndices(data,testProfile,0);
  assert.equal(playback.launched,indices.length);
  for(let i=0;i<indices.length;i++) {
    const drawn=mesh.getVertexPosition(indices[i],new Vector3()).applyMatrix4(mesh.matrixWorld);
    original.worldToLocal(drawn).multiplyScalar(4096);
    assert.ok(playback.motion.particles[i].position.distanceTo(drawn)<1e-6,'emission follows the fully transformed and morphed mesh');
  }
  const first=playback.motion.particles[0];assert.equal(first.values.a,0);
  playback.update(1/60,pose);assert.equal(first.values.a,80);assert.equal(source.visible,true);
  playback.update(1/60,pose);assert.equal(source.visible,false);assert.equal(derived.visible,false);
  const snapshot=()=>JSON.stringify(playback.motion.particles.map(p=>({p:p.position.toArray(),v:p.values})));
  playback.seek(4/60,pose);const replay=snapshot();playback.seek(100,pose);
  assert.equal(playback.time,playback.duration);assert.equal(playback.phase,'finished');assert.equal(playback.motion.particles.length,0);
  playback.seek(4/60,pose);assert.equal(snapshot(),replay,'backwards scrub resets source pose, seed and particle state');
  playback.seek(0,pose);assert.equal(source.visible,true);assert.equal(playback.launched,0);
  playback.configure('');assert.equal(derived.visible,true);assert.equal(playback.motion.particles.length,0);assert.equal(playback.launched,0);
  playback.dispose();geometry.dispose();mesh.material.dispose();
  if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;
}
{
  const definition={id:1,source:group.source,fields:[number('num',-100),number('r',300),number('g',80),number('b',60),number('a',96),
    number('fade-r',2),number('fade-a',-1),number('x',5),number('vel-x',2),number('timer',30),number('rot-z',65537),
    number('rot-y',10),number('launchrot-y',16384),{field:'birth-func',op:'value',value:'birth-func-random-rot'},
    {field:'texture',op:'value',value:'wrong-texture'}]};
  const motion=new ParticleMotion(group,new Map([[1,definition]]),1);motion.host.particleColor.set(.5,2,.25);
  const particle=motion.emitDeath(1,new Vector3(10,20,30),'effects/falls-particle');
  assert.equal(motion.particles.length,1,'death launch ignores num');
  assert.deepEqual(particle.position.toArray(),[15,20,30]);
  assert.equal(particle.texture,'effects/falls-particle');assert.equal(particle.birth,'');
  assert.deepEqual([particle.values.r,particle.values.g,particle.values.b,particle.values['fade-r']],[127.5,160,15,1]);
  assert.equal(particle.values['rot-y'],0);assert.equal(particle.values['rot-z'],1);
  assert.equal(particle.blend,'additive');assert.equal(particle.controlled,false);assert.equal(particle.depthWrite,false);
  assert.equal(particle.values.a,0);assert.ok(particle.flags.has('ready-to-launch'));
  assert.equal(motion.emitDeath(1,new Vector3(),''),null);assert.equal(motion.dropped,1);
  motion.update(1/60);
  assert.equal(particle.values.a,91);assert.equal(particle.values.timer,25);
  assert.deepEqual(particle.position.toArray(),[25,20,30],'no ordinary cone rotation');
  assert.ok(!particle.flags.has('ready-to-launch'));
}

if(args.includes('--runtime-only')){console.log('PASS model-death skin/morph/world transforms, source trigger/overlap, bounded one-shot, deterministic scrub, off/reset, and dedicated launch fields');process.exit(0);}

let checkedModels=0,selectedVertices=0,totalCopies=0,totalUnused=0;
const replay=[];
for(const reference of catalogue.meshDeaths.models) {
  const data=JSON.parse(gunzipSync(readFileSync(path.join(assets,reference.path))));
  // Independent oracle flattens the native fragment stream, including repeated
  // cross-copy entries, before applying one residue class per source effect.
  const streams=data.effects.map(effect=>effect.flatMap(f=>[
    ...Array.from({length:f.count},(_,i)=>f.start+i),...f.copies]));
  assert.ok(streams.flat().every(index=>Number.isInteger(index)&&index>=0&&index<data.sourceVertices));
  for(const profile of profiles)for(let age=0;age<=profile.frames;age++) {
    const expected=age>=profile.frames?[]:streams.flatMap(stream=>{
      const result=[];for(let i=Math.trunc(profile.vertexSkip*age/(profile.frames+1));i<stream.length;i+=profile.vertexSkip)result.push(stream[i]);return result;
    });
    const actual=deathVertexIndices(data,profile,age);assert.deepEqual(actual,expected,`${reference.model} ${profile.id} ${age}`);
    selectedVertices+=actual.length;
  }
  totalCopies+=reference.crossCopies;totalUnused+=reference.unreferencedVertices;checkedModels++;
  if(!['beach/lurkerpuppy-lod0','jungle/junglesnake-lod0','sunken/generic-button-lod0'].includes(reference.model))continue;
  const event=reference.events[0],profile=profiles.find(p=>p.id===(event?.effect??'death-warp-out'));
  const motion=new ParticleMotion({...group,items:[{particle:profile.particle,flags:['start-dead']}]},definitions,12000,41);
  motion.host.particleColor.set(.4,.7,.6);
  let born=0,samples=0,peak=0;const stages=new Set();
  for(let frame=0;frame<360;frame++) {
    motion.update(1/60);
    for(const index of deathVertexIndices(data,profile,frame)) {
      const particle=motion.emitDeath(profile.particle,new Vector3().fromArray(data.positions,index*3).multiplyScalar(4096),catalogue.meshDeaths.texture);
      assert.ok(particle);assert.equal(particle.values.a,0);born++;
    }
    peak=Math.max(peak,motion.particles.length);
    for(const particle of motion.particles) {
      assert.ok([...particle.position.toArray(),...Object.values(particle.values)].every(Number.isFinite));
      assert.equal(particle.texture,catalogue.meshDeaths.texture);assert.equal(particle.blend,'additive');
      stages.add(particle.definitionId);samples++;
    }
  }
  assert.deepEqual([...stages].sort(),[41,42,43]);assert.equal(motion.particles.length,0);assert.equal(motion.dropped,0);
  replay.push({model:reference.model,born,peak,samples,stages:[...stages].sort()});
}
const result={checkedModels,selectedVertices,totalCopies,totalUnused,replay};
if(option('--output'))writeFileSync(option('--output'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
