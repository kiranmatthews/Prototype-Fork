/** Fit Tripo's web-exported Smart Mesh without changing any mesh or skin data.
 * Only locomotion travel, oversized-foot clearance and clip timing are authored
 * here. Source GLB, all 16,132 triangles, UVs, weights and textures are retained. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const input = process.argv[2];
if (!input) throw new Error('Usage: node tools/tribal-guardian/prepare.mjs SOURCE.glb');
const raw = await readFile(input), jsonLength = raw.readUInt32LE(12);
const doc = JSON.parse(raw.subarray(20, 20 + jsonLength));
const binOffset = 28 + jsonLength;
let binary = Buffer.from(raw.subarray(binOffset, binOffset + raw.readUInt32LE(20 + jsonLength)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const gltf = await new GLTFLoader().register(() => ({ name: 'MeasureWithoutPixels', loadTexture: () => Promise.resolve(null) }))
  .parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), '');
const root = gltf.scene;
let mesh; root.traverse(node => { if (node.isSkinnedMesh) mesh = node; });
if (!mesh) throw new Error('Expected a weighted humanoid');
const triangles = doc.meshes.reduce((n,m) => n + m.primitives.reduce((n,p) => n + doc.accessors[p.indices].count / 3, 0), 0);
if (triangles > 30000) throw new Error(`Triangle budget exceeded: ${triangles}`);
const nodeByName = new Map(); root.traverse(node => nodeByName.set(node.name, node));
const hips = nodeByName.get('mixamorigHips');
const footRows = ['Left', 'Right'].map(side => {
  const upper = nodeByName.get(`mixamorig${side}UpLeg`), lower = nodeByName.get(`mixamorig${side}Leg`);
  const foot = nodeByName.get(`mixamorig${side}Foot`);
  const footBones = new Set(mesh.skeleton.bones.flatMap((bone,index) => bone.name.startsWith(`mixamorig${side}Foot`) || bone.name.startsWith(`mixamorig${side}Toe`) ? [index] : []));
  const joints=mesh.geometry.attributes.skinIndex, weights=mesh.geometry.attributes.skinWeight, vertices=[];
  for(let i=0;i<joints.count;i++){
    let w=0;for(let j=0;j<4;j++)if(footBones.has(joints.getComponent(i,j)))w+=weights.getComponent(i,j);
    if(w>.55)vertices.push(i);
  }
  if(vertices.length<50)throw new Error(`${side} foot has no usable skin region`);
  return {side,upper,lower,foot,vertices};
});
const point=new T.Vector3();
function footMin(row){let min=Infinity;for(const i of row.vertices)min=Math.min(min,mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).y);return min;}
function worldQ(node,q){return node.getWorldQuaternion(q);}
function rotateToward(node,from,to){
  const q=worldQ(node,new T.Quaternion()).premultiply(new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()));
  const parent=worldQ(node.parent,new T.Quaternion()).invert();node.quaternion.copy(parent.multiply(q));root.updateMatrixWorld(true);
}
/** Preserve the imported ankle orientation while solving hip/knee clearance. */
function liftFoot(row,amount){
  const h=row.upper.getWorldPosition(new T.Vector3()),k=row.lower.getWorldPosition(new T.Vector3()),a=row.foot.getWorldPosition(new T.Vector3());
  const ankleQ=worldQ(row.foot,new T.Quaternion()),target=a.clone().add(new T.Vector3(0,amount,0));
  const l1=h.distanceTo(k),l2=k.distanceTo(a),dir=target.clone().sub(h),d=Math.min(dir.length(),l1+l2-1e-6);dir.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const bend=k.clone().sub(h).addScaledVector(dir,-k.clone().sub(h).dot(dir));
  if(bend.lengthSq()<1e-8)bend.set(0,0,1);bend.normalize();
  const knee=h.clone().addScaledVector(dir,along).addScaledVector(bend,height);
  rotateToward(row.upper,k.clone().sub(h),knee.clone().sub(h));
  const currentK=row.lower.getWorldPosition(new T.Vector3()),currentA=row.foot.getWorldPosition(new T.Vector3());
  rotateToward(row.lower,currentA.sub(currentK),target.clone().sub(currentK));
  row.foot.quaternion.copy(worldQ(row.foot.parent,new T.Quaternion()).invert().multiply(ankleQ));root.updateMatrixWorld(true);
}
const rest = [...nodeByName.values()].map(node=>({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone()}));
const preservedMesh = JSON.stringify(doc.meshes), preservedSkins = JSON.stringify(doc.skins);
function accessor(values,type){
  const count=values.length/({SCALAR:1,VEC3:3,VEC4:4}[type]);
  binary=Buffer.concat([binary,Buffer.alloc((-binary.length%4+4)%4)]);
  const bytes=Buffer.from(new Float32Array(values).buffer),view=doc.bufferViews.length;
  doc.bufferViews.push({buffer:0,byteOffset:binary.length,byteLength:bytes.length});binary=Buffer.concat([binary,bytes]);
  const id=doc.accessors.length;doc.accessors.push({bufferView:view,componentType:5126,count,type,
    ...(type==='SCALAR'?{min:[Math.min(...values)],max:[Math.max(...values)]}:{})});return id;
}
const nodeIndex=new Map(doc.nodes.map((node,i)=>[T.PropertyBinding.sanitizeNodeName(node.name??''),i]));
const summary=[];doc.animations=[];
let sourceWalkSpeed=0;
for(const spec of [{name:'walk',start:0,duration:7/3},{name:'idle',start:0,duration:3},{name:'fall',start:.45,duration:2.1,speed:2.5}]){
  const source=gltf.animations.find(c=>c.name===spec.name);if(!source)throw new Error(`Missing ${spec.name}`);
  const tracks=source.tracks.map(track=>({track,node:nodeByName.get(T.PropertyBinding.parseTrackName(track.name).nodeName),
    property:T.PropertyBinding.parseTrackName(track.name).propertyName,sample:track.createInterpolant()}));
  const duration=spec.duration/(spec.speed??1),steps=Math.round(duration*60),times=[],samples=tracks.map(()=>[]);
  const positionTrack=tracks.find(t=>t.node===hips&&t.property==='position');
  const begin=Array.from(positionTrack.sample.evaluate(0)),end=Array.from(positionTrack.sample.evaluate(source.duration));
  if(spec.name==='walk')sourceWalkSpeed=Math.hypot(end[0]-begin[0],end[2]-begin[2])/source.duration;
  let minClearance=Infinity,maxCorrection=0;
  for(let frame=0;frame<=steps;frame++){
    const time=duration*frame/steps,sourceTime=spec.start+spec.duration*frame/steps;
    for(const r of rest){r.node.position.copy(r.p);r.node.quaternion.copy(r.q);r.node.scale.copy(r.s);}
    for(const t of tracks)t.node[t.property].fromArray(t.sample.evaluate(sourceTime));
    if(spec.name==='walk'){
      // Retain lateral weight shift and cyclic forward sway; remove linear travel only.
      hips.position.x-=(end[0]-begin[0])*frame/steps;hips.position.z-=(end[2]-begin[2])*frame/steps;
    }
    if(spec.name==='idle'&&time>2.65){
      const u=(time-2.65)/.35,w=u*u*(3-2*u);
      for(const t of tracks){const start=t.sample.evaluate(0),object=t.node[t.property];
        if(t.property==='quaternion')object.slerp(new T.Quaternion().fromArray(start),w);
        else object.lerp(new T.Vector3().fromArray(start),w);}
    }
    root.updateMatrixWorld(true);mesh.skeleton.update();
    if(spec.name==='fall'){
      // Oversized feet and the sideways shoulder each become the lowest point.
      // Fit that contact to the floor without a constant hovering offset.
      const lowest=new T.Box3().setFromObject(root,true).min.y;
      hips.position.y+=.003-lowest;root.updateMatrixWorld(true);mesh.skeleton.update();
    }
    if(spec.name!=='fall')for(const row of footRows){
      for(let iteration=0;iteration<2;iteration++){
        const lift=Math.max(0,.003-footMin(row));if(lift<1e-5)break;
        maxCorrection=Math.max(maxCorrection,lift);liftFoot(row,lift);mesh.skeleton.update();
      }
      minClearance=Math.min(minClearance,footMin(row));
    }
    times.push(time);
    tracks.forEach((t,i)=>samples[i].push(...t.node[t.property].toArray()));
  }
  const input=accessor(times,'SCALAR'),channels=[],samplers=[];
  tracks.forEach((t,i)=>{const output=accessor(samples[i],t.property==='quaternion'?'VEC4':'VEC3');
    channels.push({sampler:samplers.length,target:{node:nodeIndex.get(t.node.name),path:{position:'translation',quaternion:'rotation',scale:'scale'}[t.property]}});
    samplers.push({input,output,interpolation:'LINEAR'});});
  doc.animations.push({name:spec.name,samplers,channels});
  summary.push({name:spec.name,duration,samples:times.length,minimumFootClearance:minClearance===Infinity?null:minClearance,maxAnkleCorrection:maxCorrection});
}
const mapping={torso:'mixamorigSpine2',head:'mixamorigHead',motionRoot:'Armature'};
for(const side of ['Left','Right'])for(const [role,name] of [['frontUpper','Arm'],['frontLower','ForeArm'],['frontFoot','Hand'],['hindUpper','UpLeg'],['hindLower','Leg'],['hindFoot','Foot']])mapping[role+side]=`mixamorig${side}${name}`;
doc.nodes.find(n=>n.name==='Armature').extras={enemyRig:{mapping,walkClip:'walk',walkSpeed:sourceWalkSpeed,
  // Tripo's walk contains two complete strides. Intervals measured from ankle height/speed.
  walkContacts:{hindLeft:[[0,.105],[.37,.60],[.89,1]],hindRight:[[.14,.355],[.64,.855]]}}};
if(preservedMesh!==JSON.stringify(doc.meshes)||preservedSkins!==JSON.stringify(doc.skins))throw new Error('Mesh or skin changed');
doc.asset.extras={...(doc.asset.extras??{}),provenance:'generative-assist: Tripo web Smart Mesh P2.0; 15000 triangle target; 16132 exported triangles; humanoid Mixamo rig',sourceSha256:sha(raw)};
doc.buffers=[{byteLength:binary.length}];let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((-json.length%4+4)%4,32)]);binary=Buffer.concat([binary,Buffer.alloc((-binary.length%4+4)%4)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const output=Buffer.concat([header,json,binHeader,binary]);await mkdir('public/enemies',{recursive:true});await writeFile('public/enemies/tribal-guardian.glb',output);
const report={sourceSha256:sha(raw),outputSha256:sha(output),sourceBytes:raw.length,outputBytes:output.length,triangles,vertices:mesh.geometry.attributes.position.count,joints:mesh.skeleton.bones.length,sourceWalkSpeed,clips:summary,meshAndSkinUnchanged:true,mapping};
await writeFile('tools/tribal-guardian/preparation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
