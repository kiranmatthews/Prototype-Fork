import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const bytes=await readFile(new URL('../public/enemies/turtle.glb',import.meta.url));
const original=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=function(){return new GLTFLoader()
 .register(()=>({name:'TurtleGeometryWithoutPixels',loadTexture:()=>Promise.resolve(null)}))
 .parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false}}),visuals=[];
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} / ${b}`);
try{
 const {createEnemyVisual}=await server.ssrLoadModule('/src/enemies/runtime.ts');
 const a=createEnemyVisual('turtle'),b=createEnemyVisual('turtle');visuals.push(a,b);
 await Promise.all(visuals.map(v=>v.ready));
 for(const v of visuals)assert.equal(v.diagnostics.status,'ready',JSON.stringify(v.diagnostics));
 const paint=v=>{let u;v.group.traverse(o=>{for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])
   if(m.userData.turtleDefeatedEyes)u=m.userData.turtleDefeatedEyes;});return u;};
 assert.ok(paint(a)&&paint(b));assert.notEqual(paint(a),paint(b));near(paint(a).value,0,'living face');
 let vertices=0,triangles=0,eyes=0;
 a.group.traverse(o=>{if(!o.isMesh)return;vertices+=o.geometry.getAttribute('position').count;triangles+=o.geometry.index.count/3;
  const eye=o.geometry.getAttribute('turtleEye');if(eye)for(let i=0;i<eye.count;i++)eyes+=eye.getZ(i);});
 assert.equal(eyes,453,'paint must target only the two original eye islands');
 const frame={state:'shell',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:false,flung:false};
 for(let i=0;i<=90;i++){
  a.update(1/240,{...frame,stateTime:i/240,time:i/240});
  const bounds=new THREE.Box3().setFromObject(a.group,true);
  assert.ok(bounds.min.y>=-.04,`flip penetrates floor at ${i}: ${bounds.min.y}`);
 }
 near(paint(a).value,1,'defeated X eyes');near(paint(b).value,0,'other living turtle unaffected');
 const torso=a.group.getObjectByName('torso'),head=a.group.getObjectByName('head');
 const scales=[],heights=[],floor=[],headAngles=[];
 for(let i=0;i<=240;i++){
  a.update(1/240,{...frame,stateTime:1+i/240,time:1+i/240,shellBounceTime:i/240});
  const box=new THREE.Box3().setFromObject(a.group,true);
  scales.push(torso.scale.y);heights.push(box.max.y);floor.push(box.min.y);headAngles.push(head.rotation.x);

  assert.deepEqual(a.group.scale.toArray(),[1,1,1]);assert.deepEqual(a.body.scale.toArray(),[1,1,1]);
 }
 assert.ok(Math.min(...floor)>=-.045,'bounce must keep the shell above the floor');
 assert.ok(Math.min(...scales)<.72&&Math.max(...scales)>1.15,'clear squash and overshoot');
 assert.ok(Math.max(...headAngles)-Math.min(...headAngles)>.45,'head recoil follows bounce');
 const settled=[];a.group.traverse(o=>settled.push(o.matrix.toArray()));
 a.update(1,{...frame,stateTime:3,time:3,shellBounceTime:2});
 const later=[];a.group.traverse(o=>later.push(o.matrix.toArray()));assert.deepEqual(later,settled,'finite settle');
 near(a.body.rotation.z,Math.PI,'settled inversion');
 a.update(1/60,{...frame,state:'shell-flung',stateTime:3,flung:true});near(paint(a).value,1,'X eyes retained in flight');
 a.reset();near(paint(a).value,0,'reset restores original eyes');
 a.update(1/60,{...frame,state:'patrol',stateTime:0,alive:true});near(a.body.rotation.z,0,'reset restores living pose');
 let after=0;a.group.traverse(o=>{if(o.isMesh)after+=o.geometry.index.count/3});assert.equal(after,triangles);
 console.log(JSON.stringify({vertices,triangles,eyeVertices:eyes,squash:[Math.min(...scales),Math.max(...scales)],floor:[Math.min(...floor),Math.max(...floor)],height:[Math.min(...heights),Math.max(...heights)],headRange:[Math.min(...headAngles),Math.max(...headAngles)]}));
 console.log('PASS turtle art: original eye surfaces, per-instance live/dead face, full-detail mesh, flip clearance, strong segment squash/rebound, planted shell, finite settle, fling and reset.');
}finally{for(const v of visuals)v.dispose();GLTFLoader.prototype.loadAsync=original;await server.close();}
