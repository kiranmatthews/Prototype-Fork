import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, player, level, step, CONST }) => {
  const { JUNGLE_CUP_LEVEL: data } = await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const { parseCustomLevelJson } = await server.ssrLoadModule('/src/level.ts');
  const { resolveLevelAtmosphere } = await server.ssrLoadModule('/src/levelAtmosphere.ts');
  const { SkateChaseCamera, SKATE_CAMERA } = await server.ssrLoadModule('/src/skateChaseCamera.ts');
  const atmosphere=resolveLevelAtmosphere(level);
  assert.equal(atmosphere.backdrop,'sky');
  assert.ok(atmosphere.drawDistance>370,'the painted sky dome is clipped by the far plane');
  const ray=new THREE.Raycaster();
  const ground=(x,z)=>{
    ray.set(new THREE.Vector3(x,30,z),new THREE.Vector3(0,-1,0));ray.far=40;
    return ray.intersectObjects(level.groundMeshes,false)[0];
  };
  const near=(x,z,y,label)=>assert.ok(Math.abs((ground(x,z)?.point.y??-100)-y)<.04,label);
  near(-27,-88.5,.9,'pocket divider');near(-27,-94.5,0,'north pocket floor');near(-27,-82.5,0,'south pocket floor');
  const bowlHeight=3.6*(1-Math.cos(65*Math.PI/180));
  const bowlDeckEdge=-27+5+.4+3.6*Math.sin(65*Math.PI/180)+1;
  near(bowlDeckEdge+1,-88.5,bowlHeight*.8,'outside bank middle');near(bowlDeckEdge+4,-88.5,bowlHeight*.2,'outside bank toe');
  near(-6,-16,1,'stair top');near(-6,-12,.25,'first stair');near(-6,-20,.5,'stair return bank');
  near(14,-15,0,'sun channel floor');near(-25,-62.5,0,'temple channel floor');
  near(0,-16,1.5/3.5,'stair side bank');near(14,-2,.5,'manual terrace');near(13,-40,1.4,'round hip');
  for(const [z,h] of [[-25,.7],[-47,1.15],[-68,.9]]){
    near(37,z,h,'roller crown');near(32,z,0,'roller side joins floor');near(42,z,0,'roller opposite side');
  }
  // Keep the perimeter circulation lane and spawn clear, with continuous
  // foundation under every new session and its approaches.
  for(const [x,z] of [[0,14],[-42,-88],[42,-88],[0,-113],[0,20]])near(x,z,0,'open connecting lane');
  for(let x=-44;x<=44;x+=2)for(let z=-114;z<=22;z+=2)
    assert.ok(ground(x,z)?.point.y>=-.001,`floor hole ${x}/${z}`);
  for(const c of data.components.filter(c=>c.t==='mesh')){
    const v=c.vertices,ix=c.indices;
    for(let i=0;i<ix.length;i+=3){
      const a=new THREE.Vector3().fromArray(v,ix[i]*3),b=new THREE.Vector3().fromArray(v,ix[i+1]*3),d=new THREE.Vector3().fromArray(v,ix[i+2]*3);
      assert.ok(b.sub(a).cross(d.sub(a)).lengthSq()>1e-12,`${c.nm}: degenerate face`);
    }
  }
  assert.ok(!data.components.some(c=>['crate','checkpoint','gate'].includes(c.t)||c.dkind==='junglecup'));
  const restored=parseCustomLevelJson(JSON.stringify(level.captureData()));assert.ok(restored);
  assert.equal(restored.components.find(c=>c.outerBank)?.outerBank,5,'bowl apron lost in editor round trip');
  for(const outerBank of [-1,41,'4'])assert.equal(parseCustomLevelJson(JSON.stringify({...data,components:[{t:'vertramp',p:[0,0,0],outerBank}]})),null);

  const place=(p,h,speed=15.3)=>{
    player.respawn(level,true,true,{position:new THREE.Vector3(...p),heading:new THREE.Vector3(...h).normalize()});
    assert.equal(player.vertLandGraceT,0,'a new run inherited rail immunity from the previous landing');
    player.axisF.set(...h).normalize();player.axisL.set(player.axisF.z,0,-player.axisF.x);player.speed=speed;player.freeSkate=true;
    player.groundHit=player.queryGround(level);assert.ok(player.groundHit);
    player.pos.y=player.groundHit.y;player.prevPos.copy(player.pos);player.rideNormal.copy(player.groundHit.normal);
  };
  const safe=label=>{
    assert.ok(player.pos.toArray().every(Number.isFinite),`${label}: nonfinite`);
    assert.ok(player.pos.y>=-.05,`${label}: floor penetration`);assert.equal(player.totalDeaths,0,`${label}: died`);
  };
  let airs=0;
  for(const [p,h] of [
    [[-27,.1,-94.5],[1,0,0]],[[-27,.1,-94.5],[-1,0,0]],
    [[-27,.1,-94.5],[0,0,-1]],[[-27,.1,-82.5],[0,0,1]],
  ]){
    place(p,h);let launch=null,landed=false,popped=false;
    for(let i=0;i<300;i++){
      const pop=!popped&&player.grounded&&player.rideNormal.y<.55;if(pop)popped=true;
      step(makeInput({jumpHeld:!popped,jumpPressed:i===0,jumpReleased:pop}));safe('pocket air');
      assert.equal(player.isBailing,false,'normal pocket air bailed');
      if(player.vertAir&&!launch){launch=player.pos.clone();assert.ok(launch.y>=1.3&&launch.y<2.2,'wrong pocket takeoff');}
      if(launch&&player.grounded){assert.ok(player.groundHit.vert);landed=true;airs++;break;}
    }
    assert.ok(landed,'pocket air did not return');
  }
  place([-10.8,.1,-94.5],[-1,0,0]);let entered=false,exited=false,largestStep=0;
  assert.equal(level.grindRails[6].coping,true,'pocket lip lost its coping identity');
  assert.equal(level.grindRails[3].coping,false,'street rail was made pass-through');
  for(let i=0;i<150;i++){
    const before=player.pos.clone();step(makeInput({jumpHeld:true,jumpPressed:i===0}));safe('outside bowl entry');
    largestStep=Math.max(largestStep,before.distanceTo(player.pos));
    assert.equal(player.isBailing,false,'outside bank entrance caused a bail');
    if(player.pos.x<-23&&player.grounded&&player.pos.y<.2)entered=true;
    if(entered&&player.pos.x<-42&&player.grounded){exited=true;break;}
  }
  assert.ok(entered&&exited,'outside bank cannot cross into and back out of the bowl');assert.ok(largestStep<.9,'bowl entry snapped through its back');
  place([5,.1,-43],[1,0,0]);let crown=0;
  for(let i=0;i<90;i++){step(makeInput({jumpHeld:true,jumpPressed:i===0}));safe('round hip');crown=Math.max(crown,player.pos.y);}
  assert.ok(crown>1,'round hip was not traversed');

  for(const [label,p,h,endZ] of [
    ['sun channel',[14,.1,-9],[0,0,-1],-32],
    ['temple channel',[-24,.1,-56.5],[0,0,-1],-68.5],
  ]){
    place(p,h);let finished=false;
    for(let i=0;i<180;i++){
      step(makeInput({jumpHeld:true,jumpPressed:i===0}));safe(label);
      assert.equal(player.isBailing,false,`${label}: its connection interrupted the ride`);
      if(player.pos.z<endZ){finished=true;break;}
    }
    assert.ok(finished,`${label}: failed to traverse the connection`);
  }
  place([37,.1,-16],[0,0,-1]);let rhythmAir=false,rhythmGrind=false;
  for(let i=0;i<240;i++){
    step(makeInput({jumpHeld:i<28,jumpPressed:i===0,jumpReleased:i===28,grindHeld:true,grindPressed:i===32}));
    safe('rhythm line');rhythmAir ||= player.state==='air';rhythmGrind ||= player.state==='grind';
    assert.equal(player.isBailing,false,'rhythm line interrupted the planned jump/grind sequence');
  }
  assert.ok(rhythmAir&&rhythmGrind,'rhythm line did not connect air and rail');

  // Real catches on the new bowl, sloped stair rail and curved street lines.
  // Follow their live tangents rather than assuming every new rail is straight.
  let catches=0;
  for(const rail of level.grindRails.slice(6))for(const dir of [-1,1]){
    const t=rail.totalLength*(dir>0?.2:.8),p=rail.pointAt(t).add(new THREE.Vector3(0,.3,0));
    const h=rail.tangentAt(t).multiplyScalar(dir).setY(0).normalize();
    place(p.toArray(),h.toArray(),12);player.pos.copy(p);player.prevPos.copy(p);
    player.state='air';player.grounded=false;player.vVel=0;player.airFromSkate=true;player.airGrav='board';player.balanceBoostT=10;
    step(makeInput({grindHeld:true,grindPressed:true}));
    assert.equal(player.state,'grind','new rail cannot be caught');assert.equal(player.grindRail,rail,'new rails steal each other\'s catches');
    const rig=new SkateChaseCamera(),camera=new THREE.PerspectiveCamera(SKATE_CAMERA.verticalFov,16/9,.1,400);
    for(let i=0;i<24;i++){
      step(makeInput({grindHeld:true}));safe('new grind');
      rig.update(camera,{position:player.pos,heading:player.skateCameraHeading,up:player.skateCameraUp,
        vertAir:player.vertAir,vertNormal:player.vertNormal,verticalSpeed:player.vVel,speed:player.cameraSkateSpeed,
        grounded:player.skateCameraSupported,bailing:player.skateCameraBailing},CONST.fixedStep,i===0,level.groundMeshes);
      camera.updateMatrixWorld(true);
      const torso=player.pos.clone().addScaledVector(player.skateCameraUp,1.5).project(camera);
      assert.ok(Math.abs(torso.x)<.95&&Math.abs(torso.y)<.95,'new grind lost follow camera');
      if(player.state!=='grind')break;
      assert.ok(player.skateCameraHeading.dot(rail.tangentAt(player.grindT).multiplyScalar(player.grindDir))>.999);
    }
    catches++;
  }
  // A flush bowl lip is traversable, but a freestanding street bar still
  // requires a jump or grind. This is a coping rule, not rail invulnerability.
  place([-20,.1,-6],[-1,0,0]);let streetTrip=false;
  for(let i=0;i<30;i++){
    step(makeInput({jumpHeld:true,jumpPressed:i===0}));
    if(player.isBailing){streetTrip=true;break;}
  }
  assert.ok(streetTrip,'a street bar lost its physical collision');

  console.log(`PASS varied Jungle Cup: clear sky/foundation/circulation, exact new surface heights and nondegenerate meshes, outside-bank round trip, ${airs} pocket airs, smooth outside entry (${largestStep.toFixed(3)}m max step), round hip and ${catches} new rail catches.`);
});
