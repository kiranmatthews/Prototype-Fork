import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as skeleton from 'three/examples/jsm/utils/SkeletonUtils.js';
import ts from 'typescript';

const base=new URL('../../public/jak-lab/',import.meta.url);
const catalogue=JSON.parse(await readFile(new URL('catalogue.json',base),'utf8'));
catalogue.progressHud=JSON.parse(await readFile(new URL('progress-hud.json',base),'utf8'));
// The new study reuses the published pack. Verify its manifest, including every
// texture and the source icon, without rewriting or duplicating the catalogue.
for(const asset of catalogue.assets){
  const bytes=await readFile(new URL('assets/'+asset.path,base));
  assert.equal(bytes.length,asset.bytes,asset.path+' size');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.path+' hash');
}
const definition=catalogue.models.find(m=>m.name===catalogue.progressHud.model);
const bytes=gunzipSync(await readFile(new URL('assets/'+definition.path,base)));
const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength));
json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+jsonLength).toString('base64');
// Node has no image decoder. Only remove materials; source animation keys,
// skeleton, weights, geometry and transforms are unchanged.
json.materials=[{}];delete json.textures;delete json.images;
for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
globalThis.ProgressEvent??=class{constructor(type,init){this.type=type;Object.assign(this,init);}};
const asset=await new GLTFLoader().parseAsync(JSON.stringify(json),'');
asset.scene.traverse(node=>{const id=asset.parser.associations.get(node)?.nodes;if(id!==undefined)node.userData.jakSourceNode=id;});
const modules={'three':THREE,'three/examples/jsm/utils/SkeletonUtils.js':skeleton,'./models':{loadSourceModel:async()=>asset}};
for(const name of ['fuelCellHud','progressHudRig']){
  const source=await readFile(new URL(`../../src/jak-lab/${name}.ts`,import.meta.url),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};new Function('require','module','exports',js)(name=>{assert.ok(modules[name],name);return modules[name];},module,module.exports);
  modules['./'+name]=module.exports;
}
const clip=asset.animations.find(c=>c.name===catalogue.progressHud.clip);
assert.equal(clip.tracks.length,21);
const keys=clip.tracks[0].times;
for(const track of clip.tracks)assert.deepEqual(track.times,keys,'source authored keys share one frame clock');
const expected=skeleton.clone(asset.scene),expectedNodes=new Map();
expected.traverse(node=>{if(node.userData.jakSourceNode!==undefined)expectedNodes.set(node.userData.jakSourceNode,node);});
const bindings=clip.tracks.map(track=>THREE.PropertyBinding.create(expected,track.name));
const rig=await modules['./progressHudRig'].ProgressHudRig.load(catalogue);
let samples=0;
for(const seconds of [0,.137,.5,1.75,4.2])for(const icon of catalogue.progressHud.icons){
  const pose={index:icon.index,seconds,frame:icon.held?icon.frame:null,yaw:icon.yaw+seconds*555,
    scaleX:icon.scaleX,scaleY:icon.scaleY,z:icon.z};
  const joints=new Map();rig.sample(pose,joints);
  const frame=pose.frame===null?null:Math.floor(pose.frame);
  const time=frame===null?seconds%clip.duration:keys[frame]+(keys[frame+1]-keys[frame])*(pose.frame-frame);
  // Independent direct key interpolation: no AnimationMixer or production
  // frame-selection helper on the expected side. Fractional frames 2.5/15.5
  // exercise the cases which were left unverified in the old checkpoint.
  clip.tracks.forEach((track,index)=>{
    let a=0;while(a+1<keys.length&&keys[a+1]<=time)a++;
    const b=Math.min(a+1,keys.length-1),fraction=a===b?0:(time-keys[a])/(keys[b]-keys[a]);
    const width=track.getValueSize(),value=[];
    if(track.ValueTypeName==='quaternion'){
      new THREE.Quaternion().fromArray(track.values,a*width).slerp(new THREE.Quaternion().fromArray(track.values,b*width),fraction).toArray(value);
    }else for(let c=0;c<width;c++)value[c]=track.values[a*width+c]*(1-fraction)+track.values[b*width+c]*fraction;
    bindings[index].setValue(value,0);
  });
  expected.position.set(0,0,pose.z);expected.rotation.set(0,pose.yaw*Math.PI*2/65536,0);
  expected.scale.set(pose.scaleX*4096,pose.scaleY*4096,pose.scaleX*4096);expected.updateMatrixWorld(true);
  for(const id of [3,4,5,6,7,9]){
    const position=expectedNodes.get(id).getWorldPosition(new THREE.Vector3());
    for(const axis of ['x','y','z'])assert.ok(Math.abs(joints.get(id)[axis]-Math.fround(position[axis]))<.002,`icon ${icon.index}, time ${seconds}, joint ${id}/${axis}`);
  }
  samples++;
}
rig.dispose();
console.log(`PASS ${samples} real progress-rig poses: live loop, fractional held frames, independent clones and source joint transforms; ${catalogue.assets.length} packed asset hashes`);
