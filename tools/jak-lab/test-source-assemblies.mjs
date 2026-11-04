import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {Quaternion,Vector3} from 'three';
import ts from 'typescript';

async function load(name) {
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);return module.exports;
}
const {ParticleMotion}=await load('particleMotion'),{SourceAssembly,sourceAssemblyDefinitions}=await load('sourceAssemblies');
const args=process.argv.slice(2),option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const number=(field,base)=>({field,base,op:'float'});
const fixture=id=>({id,source:{file:'fixture',line:1},fields:[number('num',1),number('timer',5),number('a',128),
  number('scale-x',4096),number('scale-y',5.6*4096),{field:'birth-func',op:'value',value:'birth-func-set-quat'}]});
const catalogue=option('--catalogue')?JSON.parse(await readFile(option('--catalogue'),'utf8')):null;
const definitions=new Map((catalogue?.particles??[fixture(2528),fixture(2473)]).map(p=>[p.id,p]));
const original=JSON.stringify([...definitions]);
const make=kind=>{
  const definition=sourceAssemblyDefinitions.find(d=>d.sourceAssembly===kind),assembly=new SourceAssembly(kind);
  const motion=new ParticleMotion(definition,definitions,12000,42,catalogue?.callbackPrograms);
  motion.sourceEmitter=m=>assembly.emit(m);return {motion,assembly};
};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-3,`${a} != ${b}`);
const vectorClose=(a,b)=>a.toArray().forEach((n,i)=>close(n,b.toArray()[i]));
{
  const motion=new ParticleMotion(sourceAssemblyDefinitions[0],new Map([[2528,fixture(2528)]]));
  motion.emitSource(2528,new Vector3(),true,undefined,{num:.5});assert.equal(motion.particles.length,0);
  motion.emitSource(2528,new Vector3(4096,0,0),false,undefined,{num:.5});assert.equal(motion.particles.length,1);
  assert.equal(motion.particles[0].position.x,4096,'fractional direct credit is shared across callers and systems');
}
{
  const {motion,assembly}=make('eco-beam');assembly.length=20;assembly.slope=30;assembly.heading=40;
  const hostQuat=motion.host.particleQuaternion.clone();motion.update(1/60);
  assert.equal(assembly.calls,3);assert.equal(motion.particles.length,3);
  const endpoint=new Vector3(10*Math.cos(Math.PI/6)*Math.cos(40*Math.PI/180),5,10*Math.cos(Math.PI/6)*Math.sin(40*Math.PI/180)).multiplyScalar(4096);
  for(const p of motion.particles) {
    assert.equal(p.is3d,true);assert.equal(p.controlled,false);close(p.values['scale-y'],81920);
    vectorClose(p.position,new Vector3());vectorClose(new Vector3(0,0,40960).applyQuaternion(p.orientation),endpoint);
    assert.equal(p.values.timer,0,'one-frame source planes are drawn before next-step retirement');
  }
  const normals=motion.particles.map(p=>new Vector3(0,1,0).applyQuaternion(p.orientation));
  close(normals[0].dot(normals[1]),.5);close(normals[1].dot(normals[2]),.5);close(normals[0].dot(normals[2]),-.5);
  assert.deepEqual(motion.host.particleQuaternion.toArray(),hostQuat.toArray(),'per-call quaternion must not leak into host defaults');
  motion.update(1/60);assert.equal(motion.particles.length,3,'planes are replaced, not accumulated');
  assembly.enabled=false;motion.update(1/60);assert.equal(motion.particles.length,0);
  assembly.enabled=true;motion.reset();motion.update(1/60);assert.equal(motion.particles.length,3);
  assert.throws(()=>motion.emitSource(2528,new Vector3(),true,undefined,{'scale-y':NaN}),/Unsupported/);
  assert.throws(()=>motion.emitSource(2528,new Vector3(),true,undefined,{'missing':1}),/Unsupported/);
}
{
  const {motion,assembly}=make('sage-cage');assembly.camera.set(0,0,12*4096);motion.update(1/60);
  assert.equal(assembly.calls,12);assert.ok(motion.particles.length>=12&&motion.particles.length<=24);
  const points=new Set(motion.particles.map(p=>p.position.toArray().map(n=>(n/4096).toFixed(2)).join(',')));
  assert.equal(points.size,12);assert.ok(points.has('3.60,5.07,-1.80'));assert.ok(points.has('0.00,5.07,-3.60'));
  for(const p of motion.particles) {
    const axis=new Vector3(0,0,1).applyQuaternion(p.orientation);close(axis.x,0);close(axis.y,-1);close(axis.z,0);
    close(p.position.y/4096-p.values['scale-y']/8192,2.27);close(p.position.y/4096+p.values['scale-y']/8192,7.87);
  }
  const before=motion.particles[0].orientation.clone();assembly.camera.set(12*4096,0,0);motion.update(1/60);
  close(Math.abs(before.dot(motion.particles[0].orientation)),Math.SQRT1_2);
  assembly.heading=90;motion.update(1/60);
  assert.ok(motion.particles.some(p=>Math.abs(p.position.x/4096+1.8)<.001&&Math.abs(p.position.z/4096+3.6)<.001));
}
const replay=(kind,hz)=>{
  const {motion,assembly}=make(kind);assembly.slope=35;assembly.heading=-70;
  for(let i=0;i<hz;i++)motion.update(1/hz);
  return {clock:motion.clock,dropped:motion.dropped,particles:motion.particles.map(p=>({id:p.id,values:p.values,position:p.position.toArray(),quaternion:p.orientation.toArray()}))};
};
const rows=[];
for(const kind of ['eco-beam','sage-cage']) {
  const baseline=replay(kind,60);assert.deepEqual(replay(kind,30),baseline);assert.deepEqual(replay(kind,120),baseline);
  assert.equal(baseline.dropped,0);assert.ok(baseline.particles.length>0);
  rows.push({kind,ticks:baseline.clock,particles:baseline.particles.length,dropped:baseline.dropped});
}
assert.equal(JSON.stringify([...definitions]),original,'source definitions must remain immutable');
if(option('--output'))await writeFile(option('--output'),JSON.stringify({status:'PASS',sourceCatalogue:!!catalogue,rows},null,2)+'\n');
console.log('PASS source beam geometry/rolls, cage coordinates/camera-facing bars, immediate per-call overrides, shared birth credit, source retirement/toggle/restart and 30/60/120 Hz parity');
