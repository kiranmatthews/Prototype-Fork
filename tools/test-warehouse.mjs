// Real player inputs verify the greybox's authored challenge distances.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p,CONST,TUNING})=>{
  level.dispose();
  const {WAREHOUSE_PARK_LEVEL:data,WAREHOUSE_TOKEN_ROUTES:routes}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
  const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(structuredClone(data)), 'warehouse must survive strict import validation');
  const park=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
  p.competitionMode=false;p.endlessDeaths=true;p.onCourseHint=(...a)=>console.log('HINT',...a);
  assert.equal(park.skateCollectathon.tokens.length,5);
  assert.equal(park.captureData().skateCollectathon,true);
  const report={routes:[],transitions:[],goals:{}};
  for(const [index,r] of routes.entries()){
    p.respawn(park,true,true,{position:new THREE.Vector3(...r.start),heading:new THREE.Vector3(...r.heading)});
    p.axisF.fromArray(r.heading);p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=0;p.freeSkate=true;
    const samples=[];let released=false,grindFrames=0,landed=false;
    for(let i=0;i<420;i++){
      let pop=false;
      const q=p.pos;
      if(!released){
        pop=index===0?q.z<-98:index===1?q.z<-59:index===2?false:index===3?q.z<-40.8:q.z>-26.5;
        if(pop)released=true;
      }
      const input=makeInput({moveY:1,jumpHeld:!released,jumpReleased:pop,grindHeld:index===2&&p.pos.x>3});
      p.step(CONST.fixedStep,input,park);park.update(CONST.fixedStep);input.consumeEdges();
      if(p.state==='grind')grindFrames++;
      if(park.skateCollectathon.tokens[index].collected&&p.grounded)landed=true;
      if(i%15===0||pop)samples.push({i,pos:p.pos.toArray().map(n=>+n.toFixed(2)),speed:+p.speed.toFixed(2),state:p.state,ground:p.grounded,bail:p.isBailing,pop});
      if(park.skateCollectathon.tokens[index].collected&&i>330)break;
      if(p.state==='dead'||p.isBailing)break;
    }
    const outcome={route:r.name,collected:park.skateCollectathon.tokens[index].collected,landed,grindFrames,samples};
    report.routes.push(outcome);
    assert.ok(outcome.collected&&landed&&!p.isBailing&&p.state!=='dead',JSON.stringify(outcome));
    if(index===2)assert.ok(grindFrames>15,'beam must link a real grind');
    console.log(`PASS ${r.name}: pickup, landing and return (${grindFrames} grind frames)`);
  }
  const tick=(input)=>{p.step(CONST.fixedStep,input,park);park.update(CONST.fixedStep);input.consumeEdges();};
  // Link the beam grind into an ollie/flip and bank it on the recovery deck.
  p.respawn(park,true,true,{position:new THREE.Vector3(-25,3.75,-94),heading:new THREE.Vector3(1,0,0)});
  p.axisF.set(1,0,0);p.axisL.set(0,0,-1);p.speed=0;p.freeSkate=true;
  let comboPop=false,comboLanded=false,maxMult=0,comboGrind=0;
  for(let frame=0;frame<420;frame++){
    const pop=!comboPop&&p.state==='grind'&&p.pos.x>8;
    if(pop)comboPop=true;
    tick(makeInput({moveY:1,jumpHeld:!comboPop,jumpReleased:pop,spinPressed:pop,spinHeld:pop,
      grindHeld:!comboPop&&p.pos.x>3}));
    maxMult=Math.max(maxMult,p.comboMult);if(p.state==='grind')comboGrind++;
    if(comboPop&&p.grounded){comboLanded=true;break;}
    if(p.isBailing||p.state==='dead')break;
  }
  for(let frame=0;frame<90;frame++)tick(makeInput({grabHeld:true}));
  report.combo={maxMult,comboGrind,comboLanded,points:p.points,position:p.pos.toArray(),bail:p.isBailing};
  console.log('COMBO',JSON.stringify(report.combo));
  assert.ok(comboLanded&&maxMult>=2&&p.points>0&&!p.isBailing,'beam must support a real grind-to-flip combo and banked landing');
  for(const [index,pos,heading] of [[0,[8,.1,-110],[-1,0,0]],[1,[37,.1,-103],[0,0,1]],
    [3,[-35,.1,-84],[0,0,1]],[4,[0,.1,6],[0,0,-1]]]){
    p.respawn(park,true,true,{position:new THREE.Vector3(...pos),heading:new THREE.Vector3(...heading)});
    p.axisF.fromArray(heading);p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=0;p.freeSkate=true;
    for(let i=0;i<360&&!p.isBailing&&p.state!=='dead';i++)tick(makeInput({moveY:1,jumpHeld:true}));
    assert.equal(park.skateCollectathon.tokens[index].collected,false,'return must not bypass the challenge with an uphill roll');
  }
  for(const [name,pos,heading] of [
    ['south',[-20,.1,0],[0,0,1]],['north',[12,.1,-108],[0,0,-1]],
    ['west',[-28,.1,-88],[-1,0,0]],['east',[28,.1,-108],[1,0,0]],
    ['northwest',[-35,.1,-110],[-1,0,-1]],['southeast',[35,.1,2],[1,0,1]],
  ]){
    p.respawn(park,true,true,{position:new THREE.Vector3(...pos),heading:new THREE.Vector3(...heading)});
    p.axisF.fromArray(heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=18;p.freeSkate=true;
    let air=false,land=false,maxY=0;
    for(let i=0;i<500;i++){
      tick(makeInput({jumpHeld:true}));maxY=Math.max(maxY,p.pos.y);air||=p.vertAir;
      assert.ok(!p.isBailing&&p.state!=='dead',`${name}: transition must not bail`);
      assert.ok(p.pos.toArray().every(Number.isFinite));
      if(air&&p.grounded){land=true;break;}
    }
    assert.ok(air&&land,`${name}: no clean air-to-transition return`);
    report.transitions.push({name,air,land,maxY});
  }
  park.reset(true);assert.equal(park.skateCollectathon.collected,0);
  const underside=park.skateCollectathon.tokens[0].box.clone();underside.min.y=1.7;underside.max.y=4.7;
  assert.equal(park.skateCollectathon.collect(underside).length,0,'cannot collect through the dock underside');
  const token=park.skateCollectathon.tokens[0];park.skateCollectathon.collect(token.box);
  park.reset(false);assert.equal(park.skateCollectathon.collected,1,'soft death retains tokens');
  park.reset(true);assert.equal(park.skateCollectathon.collected,0,'restart clears tokens');
  const placeExit=()=>{p.respawn(park,false,true,{position:new THREE.Vector3(16,1,0),heading:new THREE.Vector3(0,0,-1)});p.speed=0;p.freeSkate=true;};
  placeExit();for(let i=0;i<60;i++)tick(makeInput());
  assert.notEqual(p.state,'finished','exit is locked before all five');
  for(const t of park.skateCollectathon.tokens)park.skateCollectathon.collect(t.box);
  placeExit();for(let i=0;i<60&&p.state!=='finished';i++)tick(makeInput());
  assert.equal(p.state,'finished','exit opens after all five');
  report.goals={softReset:true,hardReset:true,exitLocked:true,exitUnlocked:true};
  if(process.env.WAREHOUSE_REPORT)await writeFile(process.env.WAREHOUSE_REPORT,JSON.stringify(report,null,2));
  console.log('PASS six perimeter airs, strict editor round-trip, goal persistence and gated finish');
  park.dispose();
});
