import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const fixture={v:1,name:'Level ledge policy',spawn:[0,.5,.4],killY:-30,components:[
 {t:'platform',p:[0,-.5,0],s:[60,1,60]},
 {t:'mesh',p:[0,0,0],vertices:[-5,2,0,5,2,0,5,2,-10,-5,2,-10],indices:[0,1,2,0,2,3],solid:true},
 {t:'wall',p:[0,0,-5],s:[10,2,10]},
 {t:'gate',p:[20,0,-20]},
]};
await withSkateRuntime(async({THREE,Level,Player,scene,server})=>{
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {SKYSTREAM_LEVEL}=await server.ssrLoadModule('/src/levels/skystream.ts');
 const {SKYSTREAM_BONUS_LEVEL}=await server.ssrLoadModule('/src/levels/skystream-bonus.ts');
 for(const data of [SKYSTREAM_LEVEL,SKYSTREAM_BONUS_LEVEL])assert.equal(normalizeCustomLevelData(data).ledgeGrabs,false);
 assert.equal(normalizeCustomLevelData({...fixture,ledgeGrabs:'false'}),null);
 const results=[];
 for(const policy of [undefined,true,false]){
  const data={...fixture,...(policy===undefined?{}:{ledgeGrabs:policy})},level=new Level(scene,{id:'ledge-policy',name:data.name,data});scene.updateMatrixWorld(true);
  const p=new Player(scene);p.rawInput=makeInput({moveY:1});
  try{
   assert.equal(level.ledgeGrabs,policy!==false);assert.equal(normalizeCustomLevelData(level.captureData()).ledgeGrabs,policy);
   for(const detector of ['wall','mesh']){
    const position=new THREE.Vector3(0,.5,.4),heading=new THREE.Vector3(0,0,-1);
    p.respawn(level,true,false,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(-1,0,0);
    p.state='air';p.grounded=false;p.vVel=-1;p.lastVelX=0;p.lastVelZ=-5;p.freeSkate=p.airFromSkate=false;
    const wall=level.walls.find(w=>Math.abs(w.max.y-2)<.001);
    const caught=detector==='wall'?p.tryLedgeGrab(wall,level):p.tryLedgeGrabMesh(level);
    assert.equal(caught,policy!==false,`${detector}: policy ${policy}`);assert.equal(p.state==='hang',policy!==false);
    results.push({policy:policy??'default',detector,caught,rails:level.surfaceEdgeRails.length});
   }
  }finally{p.group.removeFromParent();level.dispose();}
 }
 assert.ok(results.every(x=>x.rails===results[0].rails&&x.rails>0),'Ledge policy must not disable grinding boundaries');
 console.log('PASS both ledge detectors, default/explicit opt-in, opt-out, schema/roundtrip, Skystream main/bonus and unchanged grind edges',results);
},{levelEntry:{id:'ledge-policy-initial',name:fixture.name,data:fixture}});
