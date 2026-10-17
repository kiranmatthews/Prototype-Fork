import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

// Exercise the shipping skin and bind matrices, omitting only texture decode.
const load=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=async function(url){
  const bytes=await readFile(url);
  return new GLTFLoader().register(()=>({name:'FrogHopGeometryAudit',loadTexture:()=>Promise.resolve(null)}))
    .parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false}});
let frog;
try {
  const {createEnemyVisual}=await server.ssrLoadModule('/src/enemies/runtime.ts');
  frog=createEnemyVisual('hopper',{url:fileURLToPath(new URL('../public/enemies/hopper.glb',import.meta.url))});
  await frog.ready;assert.equal(frog.diagnostics.status,'ready',frog.diagnostics.error);
  const root=frog.group,point=new THREE.Vector3(),inverse=new THREE.Matrix4();
  root.position.set(4,2,-3);root.rotation.y=.7;
  const frame={state:'crouch',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false};
  const surface=()=>{
    root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();const vertices=[];
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;if(mesh.isSkinnedMesh)mesh.skeleton.update();
      for(let i=0;i<mesh.geometry.attributes.position.count;i++){
        mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        assert.ok(point.toArray().every(Number.isFinite));vertices.push(point.clone());
      }
    });
    assert.ok(vertices.length>500);return vertices;
  };
  const delta=(a,b)=>Math.max(...a.map((p,i)=>p.distanceTo(b[i])));
  const pose=(state,t,dt=1/240)=>{
    const leap=state==='leap';
    frog.update(dt,{...frame,state,stateTime:t,grounded:!leap,speed:leap?3.4:0,verticalVelocity:leap?8.6-24*t:0});
    assert.deepEqual(root.position.toArray(),[4,2,-3]);assert.equal(root.rotation.y,.7);
    assert.deepEqual(root.scale.toArray(),[1,1,1]);return surface();
  };
  frog.reset();const rest=pose('idle',0,0);
  const soles=['frontFootLeft','frontFootRight','hindFootLeft','hindFootRight'].map(name=>{
    const node=root.getObjectByName(name);return {node,matrix:node.matrixWorld.clone()};
  });
  let previous=pose('crouch',0),maxStep=0,lowest=Infinity;
  for(const [state,duration]of [['crouch',.45],['leap',.7],['crouch',.45]]){
    for(let i=0;i<=Math.round(duration*240);i++){
      const t=i/240,current=pose(state,t);
      maxStep=Math.max(maxStep,delta(previous,current));previous=current;
      // Interpolate the unchanged 60 Hz semi-implicit ballistic trajectory.
      const height=state==='leap'?Math.max(0,8.6*t-12*t*t-12*t/60):0;
      lowest=Math.min(lowest,...current.map(p=>p.y+height));
      if(state==='crouch')for(const {node,matrix}of soles){
        assert.ok(node.matrixWorld.elements.every((v,i)=>Math.abs(v-matrix.elements[i])<1e-6),'planted sole slid or tipped');
      }
    }
  }
  assert.ok(maxStep<.08,`skin snapped between 240 Hz samples: ${maxStep} m`);
  assert.ok(lowest>=-.002,`visible frog crossed the floor: ${lowest} m`);

  // A state change at zero elapsed time must not discard planted corrections
  // or abruptly turn on compressed limb lengths beneath the loaded torso.
  frog.reset();const loaded=pose('crouch',.45),released=pose('leap',0,0);
  assert.ok(delta(loaded,released)<1e-6,'takeoff popped out of the supported crouch');
  const takeoff=pose('leap',.085,.085),apex=pose('leap',.32,.235);
  const height=vertices=>Math.max(...vertices.map(p=>p.y))-Math.min(...vertices.map(p=>p.y));
  assert.ok(height(loaded)<height(rest)-.25,'crouch does not visibly load the body');
  assert.ok(height(takeoff)>height(apex)+.4,`kick/tuck heights: ${height(takeoff)}, ${height(apex)}`);
  pose('leap',.70);const touch=pose('crouch',0,0);
  const compressed=pose('crouch',.05,.05),rebound=pose('crouch',.12,.07);
  assert.ok(height(compressed)<height(touch)-.15,'landing does not absorb impact');
  assert.ok(height(rebound)>height(touch)+.04,'landing lacks a visible rebound');
  assert.ok(delta(pose('crouch',.22),rest)<1e-6,'landing did not settle before the next load');
  const hold=pose('crouch',.45);for(let i=0;i<10;i++)pose('crouch',.45,0);
  assert.ok(delta(hold,surface())<1e-6,'repeated zero-time samples accumulated deformation');
  frog.reset();assert.ok(delta(pose('idle',0,0),rest)<1e-6,'reset retained hop deformation');
  // The real FSM still reports horizontal travel on the touchdown tick. It
  // must not invoke the fallback walk or change the frog's planted contacts,
  // breathing or glance for just that frame. Include an active idle glance.
  for(const time of [0,3.1])for(const gaitPhase of [0,.75]){
    const landing={...frame,time,gaitPhase};
    frog.reset();frog.update(0,landing);const standing=surface();
    frog.reset();frog.update(0,{...landing,speed:3.4});const carried=surface();
    assert.ok(delta(standing,carried)<1e-6,'touchdown travel triggered a one-frame walking pose');
    assert.ok(Math.min(...carried.map(p=>p.y))>=-.002,'touchdown drove a foot below the floor');
  }
  console.log('PASS actual frog skin: planted soles, continuous takeoff, kick/tuck silhouettes, landing rebound/settle, floor clearance, root ownership and repeat/reset stability.');
  console.log(JSON.stringify({maxStepMetres:maxStep,lowestMetres:lowest,heights:{rest:height(rest),load:height(loaded),kick:height(takeoff),tuck:height(apex)}},null,2));
}finally{frog?.dispose();GLTFLoader.prototype.loadAsync=load;await server.close();}
