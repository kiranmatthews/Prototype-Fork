import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as THREE from 'three';
import {createServer} from 'vite';

// Execute both production base rigs, retaining their actual closure state
// while the destination and the player's render-snap version change.
const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('main.ts',main,ts.ScriptTarget.Latest,true);
const functionText=name=>{
 const node=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
 assert.ok(node,`missing ${name}`);return node.getText(ast);
};
const declarations=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>
 d.name.getText(ast).startsWith('cam2')||
 (n.getStart(ast)>=main.indexOf('const camTarget =')&&n.end<=main.indexOf('const cameraViewFraming ='))));
const levelSource=await readFile(new URL('../src/level.ts',import.meta.url),'utf8');
const levelAst=ts.createSourceFile('level.ts',levelSource,ts.ScriptTarget.Latest,true);
const cursor=levelAst.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='newLaneCursor');
assert.ok(cursor);
const code=ts.transpileModule([
 cursor.getText(levelAst).replace(/^export /,''),...declarations.map(n=>n.getText(ast)),
 functionText('updateBaseCamera'),functionText('updateBaseCamera2'),
 '({step:updateBaseCamera,step2:updateBaseCamera2})',
].join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
 const dependencies={THREE};
 for(const module of ['tuning','cameraRig','cameraLook','cameraSpeedEffect','skateChaseCamera','skateParkTuning','cameraHeroFraming','launchCamera'])
  Object.assign(dependencies,await server.ssrLoadModule(`/src/${module}.ts`));
 const makeRig=(yaw=0)=>{
  const rider=()=>({renderPosition:new THREE.Vector3(4,2,-6),renderSnapVersion:1,
   cameraSkateSpeed:0,skateCameraHeading:new THREE.Vector3(0,0,-1),skateCameraUp:new THREE.Vector3(0,1,0),
   vertAir:false,vertNormal:new THREE.Vector3(1,0,0),vVel:0,grounded:true,
   skateCameraSupported:true,skateCameraBailing:false,speed:0,groundBelowY:2,
   waterDeathSurface:null,swimming:false,waterJumping:false,state:'ride',alignPose:0,
   loopPresentationFrame:null,launchCameraPresentation:null,balanceMeter:null,camDir:new THREE.Vector3()});
  const context={...dependencies,
   launchCamera:new dependencies.LaunchCamera(),launchCamera2:new dependencies.LaunchCamera(),
   cameraFallHold:new dependencies.CameraFallHold(),cameraFallHold2:new dependencies.CameraFallHold(),
   TUNING:{...dependencies.TUNING,chaseCam:0},
   camera:new THREE.PerspectiveCamera(49,16/9,.1,400),camera2:new THREE.PerspectiveCamera(49,16/9,.1,400),
   player:rider(),p2:rider(),input:{lookX:0,lookY:0},input2:{lookX:0,lookY:0},
   current:{id:'camera-switch-fixture'},worldMapController:null,oceanOverview:false,oceanReview:false,BOULDER_FOV:27,
   loopCameraFraming:{active:false},cameraHeroFraming:new dependencies.CameraHeroFraming(),
   level:{skatepark:false,boulder:null,groundMeshes:[],zoneAt:()=>null,
    cameraDirAt:()=>({x:Math.sin(yaw),z:-Math.cos(yaw)})},
  };
  return Object.assign(context,runInNewContext(code,context));
 };
 const equalShot=(actual,expected,label)=>{
  assert.ok(actual.up.distanceTo(new THREE.Vector3(0,1,0))<1e-10,`${label}: retained banked up vector`);
  assert.ok(actual.quaternion.angleTo(expected.quaternion)<1e-7,`${label}: destination orientation differs from fresh load`);
  assert.ok(actual.position.distanceTo(expected.position)<1e-9,`${label}: destination position differs from fresh load`);
  assert.equal(actual.fov,expected.fov,`${label}: destination lens differs from fresh load`);
 };
 let switches=0;
 for(const yaw of [0,.7,-Math.PI/2,Math.PI])for(const bank of [-1.1,.9])for(const dt of [0,1/60,1/30]){
  const rig=makeRig(yaw),fresh=makeRig(yaw);
  rig.level.skatepark=true;
  rig.player.skateCameraUp.set(Math.sin(bank),Math.cos(bank),0);
  rig.step(1/60);
  assert.ok(Math.abs(rig.camera.up.x)>.5,'fixture did not establish a real banked skate shot');
  // P2 may also receive a surface-relative presentation before its base rig.
  rig.camera2.copy(rig.camera);
  rig.level.skatepark=false;
  rig.player.skateCameraUp.set(0,1,0);
  rig.player.renderSnapVersion++;rig.p2.renderSnapVersion++;
  rig.step(dt);rig.step2(dt);fresh.step(dt);fresh.step2(dt);
  equalShot(rig.camera,fresh.camera,'P1 switch');equalShot(rig.camera2,fresh.camera2,'P2 switch');
  assert.ok(rig.p2.camDir.distanceTo(fresh.p2.camDir)<1e-10,'switch rotated P2 controls');
  for(let i=0;i<10;i++){rig.step(1/60);rig.step2(1/60);}
  equalShot(rig.camera,fresh.camera,'P1 settled');equalShot(rig.camera2,fresh.camera2,'P2 settled');
  switches++;
 }
 // Disabling global chase mode can return to the course without a teleport.
 const toggle=makeRig(),upright=makeRig();
 toggle.TUNING.chaseCam=1;toggle.player.skateCameraUp.set(.8,.6,0);toggle.step(1/60);
 toggle.TUNING.chaseCam=0;toggle.step(0);upright.step(0);
 assert.ok(toggle.camera.quaternion.angleTo(upright.camera.quaternion)<1e-7,'chase toggle retained the bank');
 const grind=makeRig();grind.step(1/60);
 const neutral=grind.camera.quaternion.clone();
 grind.player.balanceMeter={mode:'grind',bal:.8};
 for(let i=0;i<60;i++)grind.step(1/60);
 const lean=grind.camera.quaternion.angleTo(neutral);
 assert.ok(lean>.05,'fixture never leaned during the grind');
 grind.player.balanceMeter=null;grind.step(1/60);
 const easing=grind.camera.quaternion.angleTo(neutral);
 assert.ok(easing>0&&easing<lean,'ordinary grind exit must still ease upright');
 grind.player.renderSnapVersion++;grind.step(0);
 assert.ok(grind.camera.quaternion.angleTo(neutral)<1e-7,'respawn retained the previous grind lean');
 console.log(`PASS ${switches} bank-to-course transitions for both cameras, first-frame/settled framing, chase toggle and grind reset/easing`);
}finally{await server.close();}
