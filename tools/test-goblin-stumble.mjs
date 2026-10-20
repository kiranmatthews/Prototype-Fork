import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const fixture=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const original=GLTFLoader.prototype.loadAsync,warn=console.warn;
console.warn=(...args)=>{if(!args.some(v=>v?.response?.status===404&&v.response.url===''))warn(...args);};
GLTFLoader.prototype.loadAsync=async function(url,...args){
 if(!String(url).endsWith('/nightworks-snot-goblin.glb'))return original.call(this,url,...args);
 const bytes=await readFile(new URL('../public/enemies/nightworks-snot-goblin.glb',import.meta.url));
 return new GLTFLoader().register(()=>({name:'GoblinGeometryWithoutPixels',loadTexture:()=>Promise.resolve(null)}))
  .parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}}),reports=[];
try{
 const {Level}=await server.ssrLoadModule('/src/level.ts');
 const {NIGHTWORKS_LEVEL}=await server.ssrLoadModule('/src/levels/nightworks.ts');
 const {NIGHTWORKS_AFTER_HOURS_LEVEL}=await server.ssrLoadModule('/src/levels/nightworks-after-hours.ts');
 for(const [id,data]of [['dark',NIGHTWORKS_LEVEL],['nightworks-after-hours',NIGHTWORKS_AFTER_HOURS_LEVEL]]){
  const l=new Level(new THREE.Scene(),{id,name:data.name,data});await Promise.all(l.enemies.map(e=>e.visual.ready));l.update(0);
  const history=new Map(),lengths=new Map(),states=new Set();
  const r={id,frames:2400,maxPlantDrift:0,maxPlantRotation:0,maxFootStep:0,maxBoneAngle:0,maxLegRatio:0,minSole:Infinity,maxCorrection:0,contacts:0,doublePlants:0,steps:0};
  const samples=l.enemies.map(e=>{
   let mesh;e.group.traverse(n=>{if(n.isSkinnedMesh)mesh=n;});
   const skin=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
   const ids=mesh.skeleton.bones.map((n,i)=>/Foot|Toe/.test(n.name)?i:-1).filter(i=>i>=0),vertices=[];
   for(let i=0;i<skin.count;i++){let w=0;for(let k=0;k<4;k++)if(ids.includes(skin.getComponent(i,k)))w+=weights.getComponent(i,k);if(w>.7)vertices.push(i);}
   return {e,mesh,vertices};
  });
  try{
   for(let frame=0;frame<r.frames;frame++){
    l.update(1/120);
    for(const {e,mesh,vertices}of samples){
     const d=e.group.userData.goblinStumble;states.add(e.state);r.maxCorrection=Math.max(r.maxCorrection,d.reachCorrection);r.steps=Math.max(r.steps,d.steps);
     assert.equal(e.visual.diagnostics.activeClip,'Authored unstable zombie stumble','ordinary human walk must not play');
     assert.deepEqual(e.group.scale.toArray(),[1,1,1]);
     if(d.leftContact&&d.rightContact)r.doublePlants++;
     for(const [side,contact]of [['Left',d.leftContact],['Right',d.rightContact]]){
      const foot=e.group.getObjectByName(side+'Foot'),upper=e.group.getObjectByName(side+'UpLeg'),lower=e.group.getObjectByName(side+'Leg');
      const p=foot.getWorldPosition(new THREE.Vector3()),q=foot.getWorldQuaternion(new THREE.Quaternion()),prior=history.get(foot);
      if(prior){r.maxFootStep=Math.max(r.maxFootStep,p.distanceTo(prior.p));
       if(contact&&prior.contact){r.contacts++;r.maxPlantDrift=Math.max(r.maxPlantDrift,p.distanceTo(prior.p));r.maxPlantRotation=Math.max(r.maxPlantRotation,q.angleTo(prior.q));}}
      history.set(foot,{p,q,contact});
      for(const [a,b]of [[upper,lower],[lower,foot]]){
       const length=a.getWorldPosition(new THREE.Vector3()).distanceTo(b.getWorldPosition(new THREE.Vector3()));
       if(!lengths.has(a))lengths.set(a,length);r.maxLegRatio=Math.max(r.maxLegRatio,length/lengths.get(a));
       const priorQ=history.get(a),nextQ=a.getWorldQuaternion(new THREE.Quaternion());if(priorQ&&nextQ.angleTo(priorQ)>r.maxBoneAngle){r.maxBoneAngle=nextQ.angleTo(priorQ);r.worstBone={frame,name:a.name,state:e.state,time:e.stateT};}history.set(a,nextQ);
      }
     }
     if(frame%16===0){mesh.skeleton.update();const v=new THREE.Vector3();for(const i of vertices){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);r.minSole=Math.min(r.minSole,v.y-e.baseY);}}
    }
   }
   console.log('MEASURED',JSON.stringify(r));
   assert.ok(r.contacts>1000,'a real planted phase exists');
   assert.ok(r.maxPlantDrift<.006,`world-space boot contact drifts ${r.maxPlantDrift}`);
   assert.ok(r.maxPlantRotation<.03,`planted boot rotates ${r.maxPlantRotation}`);
   assert.ok(r.maxLegRatio<1.2,`leg chain stretches ${r.maxLegRatio}`);
   assert.ok(r.minSole>-.045,`boot penetrates floor ${r.minSole}`);
   assert.ok(r.maxFootStep<.30,`foot teleports ${r.maxFootStep}`);
   assert.ok(r.maxBoneAngle<.65,`knee pose pops ${r.maxBoneAngle}`);
   assert.ok(states.has('shamble')&&states.has('windup')&&states.has('lurch')&&states.has('recover'));
   assert.ok(r.steps>8,'authored steps keep catching up to world motion');
   reports.push({...r,states:[...states]});console.log('PASS authored zombie motion',JSON.stringify(reports.at(-1)));
  }finally{l.dispose();}
 }
}finally{
 await writeFile('/private/tmp/goblin-stumble-kinematics.json',JSON.stringify(reports,null,2));
 await server.close();GLTFLoader.prototype.loadAsync=original;console.warn=warn;
}
