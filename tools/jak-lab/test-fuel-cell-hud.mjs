import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import ts from 'typescript';

async function load(name) {
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',js)(createRequire(import.meta.url),module,module.exports);return module.exports;
}
const option=name=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:undefined;
const catalogue=JSON.parse(await readFile(option('--catalogue'),'utf8'));
const oracle=JSON.parse(await readFile(option('--oracle'),'utf8'));
const {ParticleMotion}=await load('particleMotion');
const {FuelCellHud,fuelCellJoints,projectHudSprite}=await load('fuelCellHud');
const library=catalogue.fuelCellHud,definitions=new Map(catalogue.particles.map(p=>[p.id,p]));
const make=()=>new ParticleMotion(catalogue.groups.find(g=>g.name===library.group),definitions,1000,1,catalogue.callbackPrograms);
assert.deepEqual(library.sources,oracle.sources,'source metadata and GOAL oracle must match');
let callbackSamples=0,frames=0,particleSamples=0;
const immutable=JSON.stringify(catalogue.particles);
for(const sample of oracle.samples) {
  const motion=make(),profile=library.profiles.find(p=>p.id===sample.format),joints=new Map();
  for(const index of [3,4,5,6,7,9]) {
    const v=sample.joints[index]??sample.joints[3];joints.set(index,new THREE.Vector3(v.x,v.y,v.z));
  }
  let scale;
  motion.host.fuelCell={joints,iconScale:profile.iconScale,centerScale:profile.centerScale,
    starburst3:profile.starburst3,starburst4:profile.starburst4,setIconScale:v=>{scale=v;}};
  motion.update(1/60);
  for(const particle of motion.particles) {
    const result=sample.results[particle.callback];if(!result)continue;
    if(particle.callback==='fuel-cell-hud-orbit-callback') {
      if(particle.values.userdata!==sample.joint)continue;
      assert.deepEqual(particle.position.toArray(),['x','y','z'].map(k=>result[0][k]));
    } else assert.deepEqual([particle.values['scale-x'],particle.values['scale-y']],[result[0].w,result[1].w]);
    callbackSamples++;
  }
  assert.equal(Math.fround(scale),sample.iconScale.x);
  assert.deepEqual([...motion.issues],['Screen-space host layout']);
}

// Load the real source skeleton/animation in Node. Only remove materials/images;
// every geometry accessor, skin, joint, transform and animation remains intact.
globalThis.ProgressEvent??=class ProgressEvent {constructor(type,init){this.type=type;Object.assign(this,init);}};
let bytes=await readFile(option('--model'));if(bytes[0]===31&&bytes[1]===139)bytes=gunzipSync(bytes);
const length=bytes.readUInt32LE(12);
const json=JSON.parse(bytes.subarray(20,20+length));
const binary=bytes.subarray(28+length);
json.buffers[0].uri='data:application/octet-stream;base64,'+binary.toString('base64');
json.materials=[{doubleSided:true}];delete json.textures;delete json.images;
for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
const root=asset.scene,nodes=new Map();
root.traverse(node=>{const index=asset.parser.associations.get(node)?.nodes;if(index!==undefined)nodes.set(index,node);});
assert.deepEqual([3,4,5,6,7,9].map(id=>nodes.get(id).name),['main','piece1','piece2','piece3','piece4','orbit2']);
const mixer=new THREE.AnimationMixer(root),clip=asset.animations.find(c=>c.name===library.clip);
assert.ok(clip);assert.equal(clip.tracks.length,21);mixer.clipAction(clip).play();
const motion=make();
const world=new THREE.Group();world.position.set(90,-45,78);world.scale.set(3,-2,7);world.add(root);
const hud=new FuelCellHud(motion,library,(pose,joints)=>{
  mixer.setTime(pose.seconds);root.position.set(pose.x,pose.y,pose.z);
  root.scale.setScalar(pose.scale*4096);root.rotation.y=pose.yaw*Math.PI*2/65536;
  fuelCellJoints(root,nodes,joints);
  world.updateMatrixWorld(true);
  for(const [id,position] of joints) {
    const expected=world.worldToLocal(nodes.get(id).getWorldPosition(new THREE.Vector3())).toArray().map(Math.fround);
    assert.deepEqual(position.toArray(),expected,'cspace must omit later gallery/screen projection');
  }
});
const persistent=new Map(),positions=[];
for(const format of ['4:3','16:9']) {
  hud.select(format);hud.hold=true;hud.restart();persistent.clear();
  for(let i=0;i<900;i++) {
    motion.update(1/60);frames++;
    if(i===8)assert.equal(hud.phase,'in','source arrival requires nine 15-pixel steps');
    assert.equal(hud.offset,Math.max(0,128-15*(i+1)));
    for(const p of motion.particles) {
      assert.ok([...p.position.toArray(),...Object.values(p.values)].every(Number.isFinite));
      const projected=projectHudSprite(p,hud.origin,hud.aspect);
      assert.ok([...projected.center.toArray(),...projected.size].every(Number.isFinite));
      if(p.callback.startsWith('fuel-cell-')) {
        if(!persistent.has(p.callback+':'+p.values.userdata))persistent.set(p.callback+':'+p.values.userdata,p.id);
        assert.equal(p.id,persistent.get(p.callback+':'+p.values.userdata),'permanent source layers must not be duplicated');
      }
      particleSamples++;
    }
    if(i<60)positions.push(hud.joints.get(9).toArray());
    assert.equal(motion.dropped,0);
  }
  assert.equal(persistent.size,8);
  assert.ok(motion.particles.length<50,'short-lived flares must retire under held emission');
  const release=motion.clock;hud.hold=false;
  for(let i=1;i<=120;i++) {motion.update(1/60);frames++;assert.equal(hud.phase,i===120?'leaving':'in');}
  assert.equal(motion.clock-release,600);
  for(let i=1;i<=26;i++) {motion.update(1/60);frames++;assert.equal(hud.offset,Math.min(128,5*i));}
  assert.equal(hud.phase,'hidden');assert.equal(motion.particles.length,0,'hidden host must kill every keyed particle');
  const yaw=hud.yaw;motion.update(1/60);assert.notEqual(hud.yaw,yaw,'source HUD updates while hidden');
  hud.show();motion.update(.25);assert.equal(hud.phase,'in');assert.ok(motion.particles.length>=8);
  hud.hide();for(let i=1;i<=13;i++){motion.update(1/60);assert.equal(hud.offset,Math.min(128,10*i));}
  assert.equal(motion.particles.length,0);
  hud.show();motion.update(.5);hud.hide(true);motion.update(1/60);assert.equal(motion.particles.length,0);
  const capture=()=>motion.particles.map(p=>({id:p.id,pos:p.position.toArray(),values:{...p.values}}));
  hud.hold=true;hud.restart();motion.update(.5);const first=capture();hud.restart();motion.update(.5);assert.deepEqual(capture(),first);
}
assert.ok(new Set(positions.map(p=>p.join(','))).size>100,'actual orbit joint animation must move');
assert.equal(JSON.stringify(catalogue.particles),immutable);
assert.ok(![...motion.issues].some(issue=>/callback|joint|host$/.test(issue)),[...motion.issues].join('\n'));
// Explicit screen projection vectors catch accidental /4096 world rendering,
// omitted GS half-height and incorrect depth ordering against the icon.
const sprite={position:new THREE.Vector3(60,120,61440),values:{'scale-x':120,'scale-y':240,'rot-z':16384,'rot-x':4}};
const projected=projectHudSprite(sprite,new THREE.Vector3(1.9,-81.9,2),4/3);
assert.equal(projected.center.x,2);assert.equal(projected.center.y,81+7/6);
assert.ok(projected.center.z>2048);assert.equal(projected.anchor,.5);
assert.equal(projected.rotation,Math.PI/2);assert.ok(Math.abs(projected.size[0]-1.00020004)<1e-7);
const report={status:'PASS',callbackSamples,frames,particleSamples,sourceJointSamples:positions.length,
  checks:['GOAL callback AST parity','actual exported idle and joint mapping','projection-independent cspace',
    'four-to-three and widescreen dimensions','finite permanent and transient layers','bounded held emission',
    'arrival and both source departure rates','exact two-second timeout','hidden cleanup and reactivation',
    'source animation while hidden','repeatable restart','screen placement and depth','immutable catalogue']};
if(option('--output'))await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
