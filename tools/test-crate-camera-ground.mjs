import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import ts from 'typescript';
import * as THREE from 'three';
import {normalizeGameInput} from './blockworks-runner.mjs';

const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
runInThisContext('const noop=()=>{};'+fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'))+'\ninstallHeadlessDom();');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
let level;
try{
 const {Level,newLaneCursor}=await server.ssrLoadModule('/src/level.ts');
 const {Player}=await server.ssrLoadModule('/src/player.ts');
 const {TUNING,CONST}=await server.ssrLoadModule('/src/tuning.ts');
 const {cameraRigFraming,setCameraRigAim}=await server.ssrLoadModule('/src/cameraRig.ts');
 const {cameraViewAt,cameraViewDirection,CameraViewFraming}=await server.ssrLoadModule('/src/cameraViews.ts');
 const {CameraLookOffset}=await server.ssrLoadModule('/src/cameraLook.ts');
 const {speedSkateFovTarget,stepSpeedSkateFov}=await server.ssrLoadModule('/src/cameraSpeedEffect.ts');
 const m=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 level=new Level(new THREE.Scene(),{id:'crate-camera',name:m.CODEX_LAB_LEVEL.name,data:m.CODEX_LAB_LEVEL});
 // Fixture setup: present the real bridge after its normal puzzle activation.
 for(const key of level.crates.filter(c=>c.bang))level.triggerBang(key);
 level.root.updateMatrixWorld(true);
 const first=m.BLOCKWORKS_FOUNDRY.bridge[7],second=m.BLOCKWORKS_FOUNDRY.bridge[8];
 const p=new Player(level.scene);p.enterLevel('crate-camera');
 const firstPoint=m.routePoint(first.s,first.top+.02,first.u);
 p.respawn(level,true,false,{position:new THREE.Vector3(...firstPoint)});
 // A hard respawn resets keys; activate the fixture before starting any inputs.
 for(const key of level.crates.filter(c=>c.bang))level.triggerBang(key);
 const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
 const begin=main.indexOf('const cameraViewFraming = new CameraViewFraming();');
 const end=main.indexOf('\ncamera.position\n  .copy(player.renderPosition)',begin);
 assert.ok(begin>=0&&end>begin);
 const code=ts.transpileModule(main.slice(begin,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const makeRig=new Function('deps',`
 const {THREE,TUNING,cameraRigFraming,setCameraRigAim,cameraViewAt,cameraViewDirection,CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor,level,player,camera}=deps;
 const current={id:'codex-switchback'},worldMapController=null,oceanOverview=false,oceanReview=false,BOULDER_FOV=27,input={lookX:0,lookY:0};
 const cameraLook=new CameraLookOffset(),cameraLaneCursor=newLaneCursor(),camF=new THREE.Vector3(0,0,-1),camControlDir=new THREE.Vector3(0,0,-1),prevPlayerPos=new THREE.Vector3(),camTarget=new THREE.Vector3(),aimSmooth=new THREE.Vector3();
 let cameraRenderSnapVersion=-1,camAnchorY=player.renderPosition.y,camBack=0,sideF=0,boulderF=0,camSpeedFovBoost=0,cam2SpeedFovBoost=0,camRoll=0;
 ${code}
 return updateCamera;`);
 const camera=new THREE.PerspectiveCamera(TUNING.camFov,16/9,.1,500),oldCamera=camera.clone();
 const deps={THREE,TUNING,cameraRigFraming,setCameraRigAim,cameraViewAt,cameraViewDirection,CameraViewFraming,CameraLookOffset,speedSkateFovTarget,stepSpeedSkateFov,newLaneCursor,level};
 const oldView=new Proxy(p,{get:(target,key)=>key==='groundBelowY'?target.queryShadowGround(level,false):Reflect.get(target,key,target)});
 const update=makeRig({...deps,player:p,camera}),updateOld=makeRig({...deps,player:oldView,camera:oldCamera});
 let input={},frame=0;const samples=[];
 const extent=cam=>{
  p.group.updateMatrixWorld(true);cam.updateMatrixWorld(true);
  const projected=[],point=new THREE.Vector3();
  p.riderRef.traverseVisible(object=>{
   if(!object.isMesh||!object.geometry?.getAttribute('position'))return;
   const materials=Array.isArray(object.material)?object.material:[object.material];
   if(materials.every(material=>material.visible===false||material.opacity===0))return;
   const count=object.geometry.getAttribute('position').count;
   for(let i=0;i<count;i++){
    object.getVertexPosition(i,point);point.applyMatrix4(object.matrixWorld).project(cam);
    projected.push([point.x,point.y]);
   }
  });
  assert.ok(projected.length>100,'missing visible character geometry');
  return{top:Math.max(...projected.map(q=>q[1])),bottom:Math.min(...projected.map(q=>q[1])),horizontal:Math.max(...projected.map(q=>Math.abs(q[0]))),vertices:projected.length};
 };
 const tick=sample=>{
  input=normalizeGameInput(sample,input);p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);p.commitRenderStep(level);frame++;
  update(CONST.fixedStep);updateOld(CONST.fixedStep);
  samples.push({frame,state:p.state,grounded:p.grounded,y:p.pos.y,floor:p.groundBelowY,legacyFloor:p.queryShadowGround(level,false),eyeY:camera.position.y,oldEyeY:oldCamera.position.y,current:frame===60?extent(camera):null,old:frame===60?extent(oldCamera):null});
  assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state));
 };
 const steer=q=>{const x=q[0]-p.pos.x,z=q[2]-p.pos.z,n=Math.hypot(x,z);return n<.08?{}:{moveX:x/n,moveY:-z/n};};
 for(let i=0;i<60;i++)tick({});
 assert.ok(p.grounded);assert.ok(Math.abs(p.groundBelowY-first.top)<.03);
 const standing=samples[samples.length-1];
 const meshOnly=p.queryShadowGround(level,false);
 assert.equal(p.queryShadowGround(level),meshOnly,'default probe must retain mesh-only teeter semantics');
 const saved=level.crates.map(crate=>({crate,alive:crate.alive,pending:crate.pending,nitro:crate.nitro}));
 const restore=()=>{for(const row of saved){row.crate.alive=row.alive;row.crate.pending=row.pending;row.crate.nitro=row.nitro;}};
 for(const [flag,setting] of [['pending',true],['alive',false],['nitro',true]]){
  for(const row of saved)row.crate[flag]=setting;
  assert.equal(p.queryShadowGround(level,true),meshOnly,`${flag} crates became presentation support`);
  assert.equal(p.queryShadowGround(level),meshOnly,'presentation opt-in leaked into the physics probe');
  restore();
 }
 const overhead={...level.crates[0],alive:true,pending:false,nitro:false,
  box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(p.pos.x,p.pos.y+3,p.pos.z),new THREE.Vector3(.96,.96,.96))};
 level.crates.push(overhead);
 assert.equal(p.queryShadowGround(level,true),8.4,'overhead box displaced the standing support');
 level.crates.pop();
 const playerSource=await readFile(new URL('../src/player.ts',import.meta.url),'utf8');
 assert.match(playerSource,/const belowY = this\.queryShadowGround\(level, false\);/,'teeter no longer explicitly requests its original terrain-only probe');
 assert.equal((playerSource.match(/this\.shadowGroundY = this\.queryShadowGround\(level, true\);/g)??[]).length,2);

 // Move to the facing pier edges, then make an actual charged foot hop.
 const from=m.routePoint(first.s,first.top,first.u),to=m.routePoint(second.s,second.top,second.u),half=1.92-.55;
 const launch=[from[0]+Math.max(-half,Math.min(half,to[0]-from[0])),first.top,from[2]-half];
 const landing=[to[0]+Math.max(-half,Math.min(half,from[0]-to[0])),second.top,to[2]+half];
 for(let i=0;i<900&&Math.hypot(p.pos.x-launch[0],p.pos.z-launch[2])>.1;i++){const v=steer(launch);tick({moveX:(v.moveX??0)*.15,moveY:(v.moveY??0)*.15});}
 for(let i=0;i<30;i++)tick({});
 for(let i=0;i<26;i++)tick({jumpHeld:true});tick({jumpReleased:true});
 assert.equal(p.state,'air');
 let airFrames=0;for(let i=0;i<120&&!p.grounded;i++){tick(steer(landing));airFrames++;}
 assert.ok(p.grounded&&Math.abs(p.pos.y-second.top)<.08,'real pier hop failed');
 for(let i=0;i<60;i++)tick({});
 assert.ok(standing.current.top<1&&standing.current.bottom>-1&&standing.current.horizontal<1,
  'actual standing character vertices leave the viewport');
 assert.ok(standing.old.top>1,'fixture no longer reproduces the reported grounded head clipping');
 assert.ok(Math.abs((standing.eyeY-standing.oldEyeY)-3.43212638565933)<.01,'measured camera correction changed');
 assert.ok(Math.abs(p.groundBelowY-second.top)<.03,'hop landing lost the actual crate surface');
 console.log(JSON.stringify({standing,airFrames,landingFloor:p.groundBelowY,
  inactiveOverheadExcluded:true,teeterMeshOnlyPreserved:true},null,2));
 console.log('PASS actual crate lids frame the standing character; inactive/overhead guards and mesh-only teeter remain intact');
}finally{level?.dispose();await server.close();console.warn=warn;console.error=error;}
