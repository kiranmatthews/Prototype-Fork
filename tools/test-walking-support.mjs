import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,Level,Player,CONST,server})=>{
 const {solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
 const scene=new THREE.Scene(),level=new Level(scene,{id:'walking-support',name:'Walking support',data:{v:1,name:'Walking support',spawn:[0,.02,0],killY:-30,components:[
  {t:'platform',p:[5,-.5,0],s:[30,1,20]},
  {t:'mesh',p:[0,0,0],vertices:[-2,1.8,.4,2,1.8,.4,2,2.6,-.4,-2,2.6,-.4],indices:[0,1,2,0,2,3],solid:false,scenerySolid:true,doubleSided:true,vert:false,nm:'Overhead sloped cord'},
  {t:'platform',p:[5,.1,0],s:[2,1,2],nm:'Reachable low step'},
  {t:'mesh',p:[0,0,0],vertices:[8,.5,1,12,.5,1,12,.5,-1,8,.5,-1],indices:[0,2,1,0,3,2],doubleSided:true,vert:false,nm:'Down-facing underside'},
  {t:'mesh',p:[0,0,0],vertices:[14,.4,1,16,.4,1,16,.4,-1,14,.4,-1],indices:[0,2,1,0,3,2],solid:false,scenerySolid:true,doubleSided:true,vert:false,nm:'Two-sided scenery roof'},
  {t:'gate',p:[5,0,-8]},
 ]}});
 const rider=new Player(scene);rider.rawInput=makeInput();
 const place=(x,board=false)=>{
  rider.respawn(level,true,false,{position:new THREE.Vector3(x,.02,0),heading:new THREE.Vector3(0,0,-1)});
  rider.pos.set(x,.02,0);rider.prevPos.copy(rider.pos);rider.state='ride';rider.grounded=true;rider.freeSkate=board;rider.skateMountT=-1;
 };
 place(0);assert.ok(Math.abs(rider.queryGround(level).y)<1e-6,'walking must choose the floor below an unreachable sloped cord');
 const crawl=makeInput({grabHeld:true});
 for(let i=0;i<30;i++){rider.step(CONST.fixedStep,crawl,level);level.update(CONST.fixedStep);crawl.consumeEdges();assert.ok(Math.abs(rider.pos.y)<.08,'crawling beneath the cord must not snap onto it');}
 assert.ok(rider.crawling&&rider.grounded&&!rider.isBailing);
 place(0);rider.grounded=false;
 rider.step(CONST.fixedStep,makeInput({grabHeld:true}),level);level.update(CONST.fixedStep);
 assert.ok(rider.pos.y<.1,'a walking support-recovery tick must not use the board wall-snap range');
 place(0);rider.pos.y=4;rider.prevPos.copy(rider.pos);
 for(let i=0;i<120;i++){rider.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);}
 assert.ok(rider.grounded&&Math.abs(rider.pos.y)<.05,'falling returns to native support instead of scenery');
 place(5);assert.ok(Math.abs(rider.queryGround(level).y-.6)<1e-6,'the existing low-step reach must remain available');
 place(10);assert.ok(Math.abs(rider.queryGround(level).y-.5)<1e-6,'restore original two-sided authored mesh support');
 place(15);rider.pos.y=.42;const roof=rider.queryGround(level);assert.ok(Math.abs(roof.y)<1e-6&&!roof.mesh.userData.worldSolidProxy,'scenery does not add another player floor');
 place(0,true);const board=rider.queryGround(level);assert.ok(Math.abs(board.y)<1e-6,'mounted riders use the original native support set');
 rider.state='air';rider.grounded=false;rider.freeSkate=false;assert.ok(Math.abs(rider.queryGround(level).y)<1e-6,'airborne landings use the original native support set');
 const contact=solidContact();
 assert.ok(level.worldSolids.cast(new THREE.Vector3(0,0,0),new THREE.Vector3(0,2,0),{low:.3,high:1.4,radius:.3,axis:new THREE.Vector3(0,1,0)},contact),'the overhead cord retains shared collision for debris');
 level.dispose();
});
console.log('PASS original native walking/crawling support, low steps, two-sided authored floors, board/air parity and retained debris geometry.');
