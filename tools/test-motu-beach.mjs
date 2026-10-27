import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,level,player,step,Level})=>{
  const {JUNGLE_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  const {motuCrowdLayout}=await server.ssrLoadModule('/src/motuBeachPresentation.ts');
  const {MOTU_STANDS,motuStandPoint}=await server.ssrLoadModule('/src/levels/motu-beach-art.ts');
  if(!parseCustomLevelJson(JSON.stringify(data))){
    const base={v:1,name:'Probe',spawn:[0,1,0],killY:-18,skatepark:true,components:[]};
    console.log('Invalid components',data.components.filter(c=>!parseCustomLevelJson(JSON.stringify({...base,components:[c]}))).map(c=>c.nm));
    console.log('Invalid metadata',Object.keys(data).filter(k=>!['components'].includes(k)&&!parseCustomLevelJson(JSON.stringify({...base,[k]:data[k]}))));
  }
  assert.ok(parseCustomLevelJson(JSON.stringify(data)),'source level passes the editor contract');
  assert.equal(data.skatepark,true);assert.equal(data.name,'Motu Beach Invitational');
  assert.ok(data.components[0].s[0]*data.components[0].s[2]>2*120*172,'at least twice the original apron area');
  assert.equal(data.components.filter(c=>c.t==='gate'||c.t==='checkpoint').length,0,'timed competition retains its event finish/recovery');
  assert.equal(data.components.filter(c=>c.t==='vertramp'&&c.arcSteps===40).length,4);
  assert.ok(!data.components.some(c=>c.edgeGrinding===false),'ordinary exposed boundaries remain grindable');
  assert.equal(level.motuBeachDiagnostics.spectators,1351);
  assert.equal(level.motuBeachDiagnostics.geometryLod,false);
  const marquee=level.root.getObjectByName('Motu / graphic sign / welcome');
  assert.ok(marquee?.isMesh&&marquee.material.map?.isCanvasTexture,'the venue title survives source mesh batching');
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const ground=(x,z)=>{ray.set(new THREE.Vector3(x,40,z),down);ray.far=65;return ray.intersectObjects(level.groundMeshes,false)[0];};
  let supported=0;
  for(let x=-66;x<=66;x+=3)for(let z=-161;z<=41;z+=3){
    const hit=ground(x,z);assert.ok(hit&&hit.point.y>=-.001,`unsupported park floor ${x}/${z}`);supported++;
  }
  for(const [x,z,y,label]of [[0,14,0,'spawn'],[-14,-44,2.4,'original funbox'],[43,-125,0,'halfpipe bed'],[-42,-134,0,'kidney bowl bed'],[32,24,2.1,'volcano'],[-22,29,1.1,'street deck'],[0,51,4.4,'perimeter deck']]){
    assert.ok(Math.abs(ground(x,z).point.y-y)<.04,label);
  }
  // Every animated person and seat is physically rooted on its matching tread.
  let crowdRoots=0;
  const standMeshes=level.root.children.filter(o=>o.name.startsWith('Motu / grandstand ')&&o.isMesh);
  for(const [i,section] of motuCrowdLayout().entries())for(const seat of section.seats){
    const p=new THREE.Vector3(...seat.position);ray.set(p.clone().addScaledVector(down,-.02),down);ray.far=.04;
    const hits=ray.intersectObjects(standMeshes,false);
    assert.ok(hits.some(h=>Math.abs(h.point.y-p.y)<.001),`unsupported crowd root ${i}/${crowdRoots}`);crowdRoots++;
    const stand=MOTU_STANDS[i],toward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0),seat.yaw);
    const front=new THREE.Vector3(...motuStandPoint(stand,0,0,-20)).sub(new THREE.Vector3(...stand.p));
    assert.ok(toward.dot(front)>0,'spectators face the park');
  }
  const place=(p,h,speed=19)=>{
    player.respawn(level,true,true,{position:new THREE.Vector3(...p),heading:new THREE.Vector3(...h).normalize()});
    player.axisF.set(...h).normalize();player.axisL.set(player.axisF.z,0,-player.axisF.x);player.freeSkate=true;player.speed=speed;
    const hit=player.queryGround(level);if(hit){player.groundHit=hit;player.pos.y=hit.y;player.prevPos.copy(player.pos);player.rideNormal.copy(hit.normal);}
  };
  const rides=[];
  for(const [name,p,h,frames,pop]of [
    ['halfpipe east',[43,.1,-125],[1,0,0],450,true],['halfpipe west',[43,.1,-125],[-1,0,0],450,true],
    ['kidney east',[-42,.1,-134],[1,0,0],450,true],['kidney west',[-42,.1,-134],[-1,0,0],450,true],
    ['volcano',[20,.1,24],[1,0,0],120,false],['street roll-in',[-22,.1,10],[0,0,1],150,false],
    ['perimeter south',[0,.1,31],[0,0,1],450,true],['perimeter east',[57,.1,-16],[1,0,0],450,true],
  ]){
    place(p,h);const deaths=player.totalDeaths;let air=false,land=false,maxY=0,released=false,bails=0,maxStep=0;
    for(let f=0;f<frames;f++){
      const before=player.pos.clone(),release=pop&&!released&&player.grounded&&player.rideNormal.y<.42;
      if(release)released=true;
      step(makeInput({jumpHeld:!released,jumpPressed:f===0,jumpReleased:release}));
      assert.ok(player.pos.toArray().every(Number.isFinite),`${name}: nonfinite`);
      maxY=Math.max(maxY,player.pos.y);maxStep=Math.max(maxStep,player.pos.distanceTo(before));
      if(player.vertAir||player.state==='air')air=true;
      if(player.isBailing)bails++;
      if(air&&player.grounded){land=true;if(pop)break;}
      assert.ok(player.pos.y>-.1,`${name}: floor penetration`);
    }
    assert.equal(player.totalDeaths,deaths,`${name}: death`);assert.equal(bails,0,`${name}: ordinary traversal bailed`);
    assert.ok(maxStep<1.2,`${name}: discontinuity ${maxStep}`);
    if(pop)assert.ok(air&&land,`${name}: transition failed to return`);
    if(name==='volcano')assert.ok(maxY>2,'volcano was traversed');
    if(name==='street roll-in')assert.ok(maxY>1,'street terrace was traversed');
    rides.push({name,air,land,maxY,maxStep,bails});
  }
  // Real explicit rail capture in both new sessions, plus unchanged flat bar.
  let catches=0;
  for(const name of ['Motu / south terrace hubba','Motu / long beach flat bar','South flat bar']){
    const c=data.components.find(c=>c.nm===name),x=c.p[0],z=c.p[2];
    place([x,c.p[1]+.2,z],[0,0,-1],10);player.pos.set(x,c.p[1]+.18,z);player.prevPos.copy(player.pos);player.grounded=false;player.state='air';player.vVel=-1;
    step(makeInput({grindHeld:true,grindPressed:true}));assert.equal(player.state,'grind',`${name}: grind catch`);catches++;
  }
  for(const y of [.1,6.1,16]){
    place([79,y,-46],[1,0,0],32);player.pos.y=y;player.prevPos.copy(player.pos);
    for(let f=0;f<100;f++)step(makeInput({moveY:1,jumpHeld:true,jumpPressed:f===0}));
    assert.ok(player.pos.x<82,'east safety shell leaked');
  }
  // Competition recovery preserves lives/score and returns to supported spawn.
  player.points=1234;player.lives=8;player.pos.y=-30;player.die();
  for(let f=0;f<300&&player.state==='dead';f++)step(makeInput());
  assert.equal(player.points,1234);assert.equal(player.lives,8);assert.equal(player.freeSkate,true);
  assert.ok(player.queryGround(level),'recovery has support');
  const captured=level.captureData(),restored=parseCustomLevelJson(JSON.stringify(captured));assert.ok(restored);
  assert.equal(restored.ocean.look,'sunny-beach');assert.equal(restored.components.length,data.components.length);
  const rebuilt=new Level(new THREE.Scene(),{id:'motu-roundtrip',name:data.name,data:restored});
  assert.equal(rebuilt.motuBeachDiagnostics.spectators,crowdRoots);rebuilt.dispose();
  const report={passed:true,supported,crowdRoots,catches,rides,roundtrip:true,competitionRecovery:true};
  await writeFile(process.env.MOTU_REPORT??'/private/tmp/motu-beach-native.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
});
