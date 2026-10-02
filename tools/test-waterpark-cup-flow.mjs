import assert from 'node:assert/strict';
import {withWaterparkRuntime} from './waterpark-runner.mjs';
import {makeInput} from './jungle-cup-harness.mjs';

await withWaterparkRuntime(async r=>{
 const {server,THREE}=r,{Level,parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts'),{Player}=await server.ssrLoadModule('/src/player.ts');
 const {WATERPARK_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/waterpark-cup.ts');
 const {WATERPARK_CUP_LINKS:links}=await server.ssrLoadModule('/src/levels/waterpark-cup-links.ts');
 const {JungleCupEvent}=await server.ssrLoadModule('/src/competition/event.ts');
 const l=new Level(new THREE.Scene(),{id:'waterpark-cup',name:data.name,data}),p=new Player(l.scene),event=new JungleCupEvent();
 const tick=input=>{p.step(1/60,makeInput(input),l);l.update(1/60);p.commitRenderStep(l);};
 const place=(position,heading=[0,0,-1])=>{p.respawn(l,true,false,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading)});p.axisF.set(...heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);};
 try{
  l.update(0);l.scene.updateMatrixWorld(true);p.enterLevel('waterpark-cup');p.competitionMode=true;
  assert.ok(parseCustomLevelJson(JSON.stringify(l.captureData())));
  assert.ok(l.hasOutOfBoundsSurfaces);
  assert.ok(!data.components.some(c=>/Wavebreaker exit kicker|Coaster crest exit kicker|Wavebreaker launch rollers/.test(c.nm??'')));
  event.startRun();event.stepPresentation(3);p.onWipeout=()=>event.bail();
  let returns=0;p.onCourseHint=title=>{if(title==='OUT OF BOUNDS')returns++;};
  // A fresh missed drop returns safely, without banked score, life or judge loss.
  for(const [x,z]of [[160,-90],[-65,-110],[40,70]]){
    place([x,-2,z]);p.points=4567;p.comboPoints=800;p.comboMult=3;p.comboHasTrick=true;p.comboTimer=2;
    p.runTime=19;const before=returns,bails=event.bails;
    for(let i=0;i<180&&returns===before;i++)tick({});
    assert.equal(returns,before+1);assert.equal(p.points,4567);assert.equal(p.comboPoints,0);assert.equal(p.comboMult,0);
    assert.equal(p.totalDeaths,0);assert.equal(p.lives,4);assert.equal(event.bails,bails);assert.ok(p.runTime>=19);
    assert.ok(p.pos.distanceTo(l.spawnPos)<.3&&p.grounded&&!p.isBailing);
  }
  // A later fall returns to recent supported ground, not all the way to spawn.
  place([130,18.05,-145],[1,0,0]);for(let i=0;i<70;i++)tick({});
  const near=p.pos.clone();p.pos.set(166,-2,-110);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-4;
  const before=returns;for(let i=0;i<180&&returns===before;i++)tick({});
  assert.equal(returns,before+1);assert.ok(p.pos.distanceTo(near)<.5);
  const result=[],failures=[];
  // Every new connection is a real, two-way charged skating line. A sampled
  // centreline is only the steering target; contact and momentum remain live.
  for(const link of links)for(const reversed of [false,true]){
    const curve=new THREE.CatmullRomCurve3(link.points.map(v=>new THREE.Vector3(...v)),false,'centripetal');
    const path=curve.getSpacedPoints(Math.ceil(curve.getLength()/1.5));if(reversed)path.reverse();
    const past=path.at(-1).clone().add(path.at(-1).clone().sub(path.at(-2)).setY(0).normalize().multiplyScalar(4));path.push(past);
    const heading=path[1].clone().sub(path[0]).setY(0).normalize();place(path[0].clone().add(new THREE.Vector3(0,.05,0)).toArray(),heading.toArray());
    let index=0,done=false,lowest=Infinity,maxHeightError=0;
    const startReturns=returns;
    for(let frame=0;frame<2400;frame++){
      let nearest=index,best=Infinity;
      for(let i=index;i<Math.min(path.length,index+12);i++){const d=Math.hypot(p.pos.x-path[i].x,p.pos.z-path[i].z);if(d<best){best=d;nearest=i;}}
      index=nearest;const target=path[Math.min(path.length-1,index+3)],delta=target.clone().sub(p.pos);
      const error=Math.atan2(Math.sin(Math.atan2(delta.x,delta.z)-Math.atan2(p.axisF.x,p.axisF.z)),Math.cos(Math.atan2(delta.x,delta.z)-Math.atan2(p.axisF.x,p.axisF.z)));
      tick({moveY:1,moveX:Math.max(-1,Math.min(1,-error*2.5)),jumpHeld:true});lowest=Math.min(lowest,p.pos.y);
      const expectedY=THREE.MathUtils.clamp(path[index].y,Math.min(...link.points.map(p=>p[1])),Math.max(...link.points.map(p=>p[1])));maxHeightError=Math.max(maxHeightError,Math.abs(p.pos.y-expectedY));
      if(p.isBailing||p.state==='dead'||returns!==startReturns){failures.push({name:link.name,reversed,position:p.pos.toArray(),ground:p.groundHit?.name,state:p.state,bail:p.isBailing});break;}
      if(index>=path.length-4&&Math.hypot(p.pos.x-path.at(-1).x,p.pos.z-path.at(-1).z)<3){done=true;break;}
    }
    if(!done&&!failures.some(f=>f.name===link.name&&f.reversed===reversed))failures.push({name:link.name,reversed,position:p.pos.toArray(),speed:p.speed});
    if(maxHeightError>1.2)failures.push({name:link.name,reversed,maxHeightError});
    result.push({name:link.name,reversed,lowest,maxHeightError});
  }
  console.log(JSON.stringify(result));assert.deepEqual(failures,[]);console.log('PASS sand resets preserve banked points/lives/judge marks, break combos, restore recent safe ground; all Cup links skate both ways.');
 }finally{l.dispose();}
});
