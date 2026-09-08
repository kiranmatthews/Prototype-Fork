import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async ({ THREE, server, level, player, step, Level }) => {
  const { parseCustomLevelJson, worldMapComponentPoints } = await server.ssrLoadModule('/src/level.ts');
  const ray = new THREE.Raycaster();
  const ground = (x,z) => { ray.set(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0));ray.far=100;return ray.intersectObjects(level.groundMeshes,false)[0]?.point.y; };
  const near = (a,b,label) => assert.ok(a!==undefined && Math.abs(a-b)<.06,`${label}: ${a} != ${b}`);
  near(ground(0,14),0,'supported spawn');
  near(ground(-14,-44),2.4,'funbox deck');
  near(ground(22,-68),.6,'manual island');
  near(ground(0,-91),1.8,'transfer island');
  for(let i=0;i<=16;i++) {
    near(ground(-14,-31-i*.5),2.4*i/16,'continuous funbox approach');
    near(ground(0,-76-i*.4375),1.8*i/16,'continuous transfer approach');
  }
  for(const [x,z] of [[28,-116.5-3.6*Math.SQRT1_2],[0,24.5+3.6*Math.SQRT1_2],[-45.5-3.6*Math.SQRT1_2,-42],[45.5+3.6*Math.SQRT1_2,-42]])
    near(ground(x,z),3.6*(1-Math.SQRT1_2),'perimeter transition');
  near(ground(0,31),4.4,'lip/deck height');
  const faceRay=new THREE.Raycaster(new THREE.Vector3(0,4.1,27),new THREE.Vector3(0,0,1),0,3);
  const lip=faceRay.intersectObjects(level.groundMeshes,false)[0];
  assert.ok(lip&&lip.face.normal.y===0,'missing the actual vertical top section');
  // Dense coverage of the accessible flat: no voids between composed pieces.
  for(let x=-42;x<=42;x+=3)for(let z=-112;z<=20;z+=3)
    assert.ok(ground(x,z)>=-.001,`unsupported park floor at ${x},${z}`);
  assert.equal(level.skatepark,true);
  assert.equal(level.checkpoints.length,0);
  assert.equal(level.crates.length,0);
  assert.ok(level.finishGlow.isEmpty());
  for(const key of ['bonusPlatformDiagnostics','crystalPickup','clockPickup','comboOrb'])assert.equal(level[key],null,key);
  const place = (x,y,z,heading=[0,0,-1]) => {
    player.respawn(level,true,true,{position:new THREE.Vector3(x,y,z),heading:new THREE.Vector3(...heading)});
    player.axisF.set(...heading);player.axisL.set(heading[2],0,-heading[0]);player.commitRenderStep(level);
  };
  place(0,.1,14);near(player.groundBelowY,0,'countdown ground anchor');
  let bails=0;player.onWipeout=()=>bails++;
  player.points=1234;player.lives=8;player.bail();player.die();assert.equal(bails,1,'ragdoll-to-death double counted');
  const neutral=makeInput();for(let i=0;i<180&&player.state==='dead';i++)step(neutral);
  assert.equal(player.state,'ride');assert.equal(player.points,1234);assert.equal(player.lives,8);
  player.comboPoints=120;player.comboMult=3;player.comboHasTrick=true;
  assert.equal(player.competitionComboActive,true,'landed link window must remain live at the buzzer');
  assert.equal(player.points,1234,'buzzer query forced a bank');
  player.grounded=false;player.state='air';
  assert.equal(player.competitionComboActive,true,'airborne combo must extend the run');
  assert.equal(player.points,1234,'unlanded combo was awarded early');
  // The safety shell reaches BELOW deck height, including a thrown rider.
  for(const y of [.1,6.1,16]){
    place(55,y,-42,[1,0,0]);player.speed=32;
    const forward=makeInput({moveY:1,jumpHeld:true,jumpPressed:true});
    for(let i=0;i<90;i++)step(forward);
    assert.ok(player.pos.x<57,'east containment leaked below/above deck');
    assert.ok(player.pos.y>=-.05,'containment contact fell through the foundation');
  }
  place(-22,.78,-6);player.state='air';player.grounded=false;player.speed=9;player.vVel=-1;
  const grind=makeInput({grindHeld:true,grindPressed:true});step(grind);
  assert.equal(player.state,'grind','flat-bar catch failed');
  for(let i=0;i<360;i++)step(grind);
  assert.ok(player.points>0,'real rail line never banked points');
  const data=level.captureData();
  assert.equal(data.skatepark,true);
  assert.ok(!data.components.some(c=>['gate','checkpoint','crate','clock','comboorb'].includes(c.t)||c.dkind==='junglecup'));
  const roundtrip=parseCustomLevelJson(JSON.stringify(data));assert.ok(roundtrip);
  assert.equal(roundtrip.components.find(c=>c.t==='vertramp').lipRise,.8);
  assert.equal(parseCustomLevelJson(JSON.stringify({...data,components:[{t:'vertramp',p:[0,0,0],lipRise:-1}]})),null);
  assert.ok(!roundtrip.components.some(c=>['gate','clock','comboorb'].includes(c.t)),'migration resurrected course furniture');
  const rebuilt=new Level(new THREE.Scene(),{id:'practice-park',name:data.name,data:roundtrip});
  assert.equal(rebuilt.skatepark,true);assert.ok(rebuilt.finishGlow.isEmpty());assert.equal(rebuilt.clockPickup,null);rebuilt.dispose();
  assert.equal(parseCustomLevelJson(JSON.stringify({...data,skatepark:'yes'})),null,'invalid profile accepted');
  const oldPoints=worldMapComponentPoints().slice(0,11);oldPoints[4][0]=-31;
  const legacy={v:1,name:'Old map',spawn:[0,1,0],killY:-20,hudMode:'hub',components:[{t:'worldmap',p:[0,0,0],pts:oldPoints}]};
  const migrated=parseCustomLevelJson(JSON.stringify(legacy));assert.ok(migrated);assert.equal(migrated.components[0].pts.length,12);
  assert.equal(migrated.components[0].pts[4][0],-47);assert.equal(migrated.components[0].pts[11][0],-31);
  console.log('PASS Jungle Cup runtime: continuous banks/floor/perimeter, supported spawn, containment at three heights, rail cash-in, competition death/buzzer accounting, and gate-free editor round trip.');
});
