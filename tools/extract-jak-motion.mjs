// Export skeleton samples only from a user-supplied OpenGOAL GLB. Output stays
// outside the repository; no source mesh, texture or extracted keys ship.
import fs from 'node:fs';
import * as THREE from 'three';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node tools/extract-jak-motion.mjs source.glb /local-study/motion.json');
const bytes = fs.readFileSync(input), jsonLength = bytes.readUInt32LE(12);
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const bin = bytes.subarray(28 + jsonLength);
const widths = {SCALAR:1,VEC3:3,VEC4:4,MAT4:16};
const accessor = index => {
  const a = doc.accessors[index], view = doc.bufferViews[a.bufferView], width = widths[a.type];
  if (a.componentType !== 5126) throw new Error('Expected float animation accessor');
  const result = new Float32Array(a.count * width);
  for (let i=0;i<a.count;i++) for(let k=0;k<width;k++)
    result[i*width+k]=bin.readFloatLE((view.byteOffset??0)+(a.byteOffset??0)+i*(view.byteStride??width*4)+k*4);
  return result;
};
const nodes=doc.nodes.map(n=>{
  const o=new THREE.Object3D();o.name=n.name;
  if(n.matrix)new THREE.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);
  else {if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);}
  return o;
});
doc.nodes.forEach((n,i)=>n.children?.forEach(child=>nodes[i].add(nodes[child])));
const scene=new THREE.Group();nodes.filter(n=>!n.parent).forEach(n=>scene.add(n));scene.updateMatrixWorld(true);
const names=['main','upper_body','chest','neckA','neckB','hips','Larm','Lforarm','sk_lhand','Rarm','Rforarm','sk_rhand','Lthigh','Lknee','Lankle','Lball','Rthigh','Rknee','Rankle','Rball'];
const round = values => values.map(v=>+v.toFixed(7));
const pose=()=>Object.fromEntries(names.map(name=>{
  const n=scene.getObjectByName(name);if(!n)throw new Error(`Missing joint ${name}`);
  return [name,{p:round(n.getWorldPosition(new THREE.Vector3()).toArray()),q:round(n.getWorldQuaternion(new THREE.Quaternion()).toArray())}];
}));
const bind=pose(), rest=nodes.map(n=>({p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));
const selected=['jump','jump-forward','jump-loop','jump-land','jump-short-land','run','walk','run-squash','run-squash-weak','run-to-stance','run-to-stance-loop','stance-loop','turn-around',
  'falling-to-edge-grab','edge-grab-swing-left','edge-grab-swing-right','edge-grab-stance0','edge-grab-stance1','edge-grab-to-jump','edge-grab-off',
  'wheel-flip','wheel-flip-land','duck-roll','duck-roll-end','duck-high-jump'];
const clips={};
for(const anim of doc.animations.filter(a=>selected.some(name=>a.name===`eichar-${name}`))) {
  nodes.forEach((n,i)=>{n.position.copy(rest[i].p);n.quaternion.copy(rest[i].q);n.scale.copy(rest[i].s);});
  let duration=0;
  const channels=anim.channels.map(c=>{
    const s=anim.samplers[c.sampler], times=accessor(s.input), values=accessor(s.output);
    duration=Math.max(duration,times.at(-1));
    const width=c.target.path==='rotation'?4:3;
    const interpolant=c.target.path==='rotation'?new THREE.QuaternionLinearInterpolant(times,values,width):new THREE.LinearInterpolant(times,values,width);
    return {node:nodes[c.target.node],path:c.target.path,interpolant};
  });
  const samples=[];const frames=Math.round(duration*60);
  for(let frame=0;frame<=frames;frame++) {
    const time=Math.min(duration,frame/60);
    for(const c of channels)c.node[c.path==='translation'?'position':c.path==='rotation'?'quaternion':'scale'].fromArray(c.interpolant.evaluate(time));
    scene.updateMatrixWorld(true);samples.push(pose());
  }
  clips[anim.name.replace('eichar-','')]={duration,frames,samples};
}
fs.writeFileSync(output,JSON.stringify({version:1,fps:60,source:'OpenGOAL Jak 1 supplied USA disc; eichar-lod0',bind,clips}));
console.log(Object.fromEntries(Object.entries(clips).map(([k,c])=>[k,{frames:c.frames,duration:c.duration}])));
