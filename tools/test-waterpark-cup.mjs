import assert from 'node:assert/strict';
import {withWaterparkRuntime} from './waterpark-runner.mjs';
import {makeInput} from './jungle-cup-harness.mjs';

await withWaterparkRuntime(async r=>{
  const {server,THREE}=r;
  const {Level,parseCustomLevelJson,migrateCustomLevel,worldMapComponentPoints}=await server.ssrLoadModule('/src/level.ts');
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {WATERPARK_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/waterpark-cup.ts');
  const {WATERPARK_POOLS:oldPools}=await server.ssrLoadModule('/src/levels/waterpark-cup-route.ts');
  const {CAMPAIGN_LEVELS,CampaignStore,campaignLevelById,validateCampaignMapGraph}=await server.ssrLoadModule('/src/campaign.ts');
  const {competitionCourse}=await server.ssrLoadModule('/src/competition/courses.ts');
  const {JungleCupEvent,COMPETITION_TUNING}=await server.ssrLoadModule('/src/competition/event.ts');
  assert.deepEqual(validateCampaignMapGraph(),[]);
  assert.deepEqual(campaignLevelById('waterpark').mapPosition,[86,6,4]);
  assert.equal(CAMPAIGN_LEVELS[13].levelId,'waterpark');assert.equal(CAMPAIGN_LEVELS[14].levelId,'waterpark-cup');
  assert.equal(campaignLevelById('waterpark-cup').competition,true);
  assert.ok(parseCustomLevelJson(JSON.stringify(data)));
  assert.ok(data.components.some(c=>c.t==='vertramp'&&c.closed),'The recovered lazy-river circuit was lost');
  assert.ok(!data.components.some(c=>['clock','comboorb','crystal','bonusplatform'].includes(c.t)));
  assert.ok(!data.components.some(c=>/OLD RAPIDS.*flume|CYCLONE orange spiral|RIPTIDE.*funnel/i.test(c.nm??'')),'Scenery-only slides must stay removed');
  const old=worldMapComponentPoints().slice(0,14),map={v:1,name:'Old map',spawn:[0,1,0],killY:-30,components:[{t:'worldmap',p:[0,0,0],pts:old}]};
  assert.equal(migrateCustomLevel(structuredClone(map)).components.find(c=>c.t==='worldmap').pts.length,15);
  assert.equal(parseCustomLevelJson(JSON.stringify(map)).components.find(c=>c.t==='worldmap').pts.length,15,'Saved 14-node maps must pass import validation before migration');
  map.components[0].pts[13][0]+=4;assert.deepEqual(migrateCustomLevel(structuredClone(map)).components.find(c=>c.t==='worldmap').pts,old,'Custom map positions were overwritten');
  assert.deepEqual(parseCustomLevelJson(JSON.stringify(map)).components.find(c=>c.t==='worldmap').pts,old);
  const l=new Level(new THREE.Scene(),{id:'waterpark-cup',name:data.name,data}),p=new Player(l.scene);
  try{
    l.update(0);l.scene.updateMatrixWorld(true);p.enterLevel('waterpark-cup');p.competitionMode=true;p.respawn(l,true);
    assert.equal(l.halfpipes.length,7);assert.ok(l.rails.length>=20);assert.equal(l.skatepark,true);
    for(let i=0;i<7;i++){assert.equal(l.halfpipes[i].radius,oldPools[i].radius);assert.equal(l.halfpipes[i].yBottom,oldPools[i].p[1]);}
    assert.equal(l.crystalPickup,null);assert.equal(l.crates.length,0);assert.ok(l.warpPads.every(w=>!w.group.visible));
    for(let i=0;i<10;i++){p.step(1/60,makeInput(),l);l.update(1/60);p.commitRenderStep(l);}
    assert.ok(p.grounded&&Math.abs(p.pos.y-12)<.1,'Cup spawn is unsupported');
    // A real run on an original bridge rail earns live competition points.
    p.respawn(l,true,false,{position:new THREE.Vector3(30,12.1,-131),heading:new THREE.Vector3(0,0,1)});p.competitionMode=true;
    let grinded=false,scored=false;
    for(let i=0;i<180;i++){
      p.step(1/60,makeInput({moveY:1,moveX:p.state==='grind'?-Math.sign(p.balance)*.3:0,jumpHeld:true,grindHeld:true,grindPressed:i===0}),l);l.update(1/60);p.commitRenderStep(l);
      grinded ||= p.state==='grind';scored ||= p.points+p.comboPoints>0;assert.notEqual(p.state,'dead');
    }
    assert.ok(grinded&&scored,'Recovered bridge rails are not scoring rides');
    // Park speed limits must not erase the original loop launch motor.
    p.respawn(l,true,false,{position:new THREE.Vector3(138,.1,-14),heading:new THREE.Vector3(0,0,1)});
    p.axisF.set(0,0,1);p.axisL.set(1,0,0);
    const hints=[];p.onCourseHint=(...hint)=>hints.push(hint);let loopEntered=false;
    for(let i=0;i<900&&!p.loopStatus.completed;i++){
      p.step(1/60,makeInput({moveY:1,jumpHeld:true}),l);l.update(1/60);p.commitRenderStep(l);
      loopEntered ||= p.loopStatus.active;assert.ok(!p.isBailing&&p.state!=='dead');
    }
    assert.ok(loopEntered&&p.loopStatus.completed===1&&p.points+p.comboPoints>=1000,'The recovered loop must be a usable scoring ride');
    assert.deepEqual(hints,[],'An optional competition loop cannot announce a course exit');
  }finally{l.dispose();}
  const cup=new JungleCupEvent(()=>.5,()=>{},competitionCourse('waterpark-cup'));
  for(let heat=0;heat<3;heat++){
    assert.ok(cup.startRun());cup.stepPresentation(3);cup.stepRun(60,COMPETITION_TUNING.perfectRunTarget*2,false,true);
    cup.stepFinish(COMPETITION_TUNING.finishBeat,true,true);cup.stepPresentation(3);assert.ok(cup.showStandings());
  }
  assert.equal(cup.course.name,'Deadwater Cup');assert.equal(cup.phase,'final');assert.equal(cup.won,true);
  const save=new CampaignStore();save.startEphemeral();
  assert.equal(save.commitCompetitionWin('waterpark-cup'),true);assert.equal(save.commitCompetitionWin('waterpark-cup'),false);
  assert.equal(save.levelProgress('waterpark-cup').cup,true);assert.notEqual(save.levelProgress('jungle-cup').cup,true);
  assert.equal(save.commitCompetitionWin('jungle-cup'),true);assert.equal(save.totals().cups,2);
  console.log('PASS recovered layout, competition physics/scoring, three-run event, separate trophy, map placement and saved-map migration.');
});
