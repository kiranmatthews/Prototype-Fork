import assert from 'node:assert/strict';
import {withWaterparkRuntime} from './waterpark-runner.mjs';

await withWaterparkRuntime(async r=>{
  const {p,l,THREE}=r;
  const place=(position,heading=[0,0,-1])=>p.respawn(l,true,false,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading)});
  const terrain=l.groundMeshes.find(m=>m.userData.lethal);
  assert.ok(terrain,'The actual hillside must own its lethal contact');
  const {parseCustomLevelJson}=await r.server.ssrLoadModule('/src/level.ts');
  assert.ok(parseCustomLevelJson(JSON.stringify(l.captureData())),'Lethal surfaces and the giant vert must survive editor capture');
  for(const [x,z]of [[25,-630],[90,-930],[-65,140]]){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,300,z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(terrain,false)[0];assert.ok(hit);
    place([x,hit.point.y+3,z]);let dead=false;
    for(let i=0;i<180;i++){r.tick({});if(p.state==='dead'){dead=true;break;}}
    assert.ok(dead&&p.groundHit?.lethal,`Floor contact at ${x},${z} did not cause death`);
  }
  // The former missed-jump recovery court must now be a fall to the fatal ground.
  place([40,-93.9,-795]);let missedDeath=false;
  for(let i=0;i<300;i++){r.tick(r.directionInput([0,0,-1],.65));if(p.state==='dead'){missedDeath=true;break;}}
  assert.ok(missedDeath,'The final gap still has a safe floor below it');

  for(const heading of [[1,0,0],[-1,0,0],[0,0,-1]]){
    place([60,-164.9,-1038],heading);p.freeSkate=true;p.speed=30;
    for(let i=0;i<180;i++){
      r.tick({...r.directionInput(heading),jumpHeld:true});
      assert.ok(p.state!=='dead'&&p.pos.x>48&&p.pos.x<72&&p.pos.z>-1072,'Finish court allowed an accidental escape');
    }
  }
  place([0,12.1,-570]);let entered=false,fall=false,resolved=false,unmountedFrames=0;
  for(let i=0;i<1200;i++){
    r.tick({...(p.loopStatus.active?{moveY:1}:r.directionInput([0,0,-1])),jumpHeld:!entered});
    entered ||= p.loopStatus.active;
    if(p.loopFallPresentation){fall=true;unmountedFrames+=!p.freeSkate;assert.equal(p.loopStatus.completed,0);}
    if(fall&&(p.state==='dead'||p.grounded&&!p.isBailing)){resolved=true;break;}
  }
  assert.ok(entered&&fall&&resolved&&unmountedFrames>30,'Critical loop speed must produce a sustained unmounted fall and a real landing');
  console.log('PASS lethal floor, failed-gap death, enclosed finish and sustained loop-loss tumble.');
});
