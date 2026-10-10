import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5317').replace(/\/$/,'');
const output=process.env.VERT_REVIEW_OUTPUT||join(tmpdir(),'deadwater-apron-review');
const recording=JSON.parse(await readFile(new URL('./fixtures/deadwater-apron-replay.json',import.meta.url),'utf8'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.addInitScript(()=>{navigator.getGamepads=()=>[]});
const errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
async function advance(frames,stop) {
 await page.evaluate(q=>Object.assign(window.__apronReview,q),{frames,stop});
 await page.waitForFunction(()=>window.__apronReview.frames===0,null,{timeout:15000});
 return page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{pos:p.pos.toArray(),grounded:p.grounded,pipe:l.halfpipes.indexOf(p.groundHit?.halfpipe),hang:l.halfpipes.indexOf(p.hangPipe),vert:p.vertAir,bail:p.isBailing,speed:p.speed,contacts:window.__apronReview.contacts}});
}
try {
 for(const lite of [true,false]) {
  await page.goto(`${base}/?playtest&level=waterpark-cup${lite?'&lite':''}`,{timeout:120000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  const spawn=await page.evaluate(()=>({supported:window.__game.player.queryGround(window.__game.getLevel())!==null}));
  assert.equal(spawn.supported,true);
  await page.evaluate(recording=>{
   const g=window.__game,p=g.player;
   window.__apronReview={step:p.step.bind(p),feed:g.replayer.feed.bind(g.replayer),consume:g.input.consumeEdges.bind(g.input),frames:0,stop:'',contacts:0};
   const native=p.wallSmack.bind(p);p.wallSmack=(...a)=>{window.__apronReview.contacts++;return native(...a)};
   p.step=()=>{};g.replayer.feed=()=>true;g.loadReplay(recording);g.competitionAction('retry');
  },recording);
  await page.waitForFunction(()=>window.__game.getCompetition()?.phase==='running',null,{timeout:30000});
  const recorded=await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel(),q=window.__apronReview;
   // Explicit reconstruction of the last menu retry in this older take.
   g.replayer.frame=3496;let bail=false;
   while(g.replayer.frame<=4201){q.feed(g.input,p.camDir);q.step(1/60,g.input,l);l.update(1/60);p.flushLevelCrateRewards(l);p.commitRenderStep(l);q.consume();bail ||= p.isBailing;}
   return{pos:p.pos.toArray(),vert:p.vertAir,hang:l.halfpipes.indexOf(p.hangPipe),bail,contacts:q.contacts};
  });
  assert.equal(recorded.bail,false);assert.equal(recorded.contacts,0);assert.equal(recorded.vert,true);assert.equal(recorded.hang,4);
  await page.screenshot({path:join(output,`replay-${lite?'lite':'full'}.png`)});
  await page.evaluate(()=>{
   const g=window.__game,p=g.player,q=window.__apronReview;g.replayer.end();g.replayer.feed=q.feed;g.input.consumeEdges=()=>{};
   p.step=(dt,input,level)=>{if(q.frames<=0)return;q.step(dt,input,level);q.consume();q.frames--;
    if(q.stop==='steep'&&p.grounded&&p.rideNormal.y<.16||q.stop==='launch'&&p.vertAir||q.stop==='landing'&&p.grounded)q.frames=0;};
   g.getCompetition().remaining=600;
  });
  const flights=[];
  for(const z of [-158.25,-164,-167.5])for(const release of [false,true]) {
   await page.keyboard.up('Space');
   await page.evaluate(z=>{
    const g=window.__game,p=g.player,l=g.getLevel(),hp=l.halfpipes[4],q=window.__apronReview;
    const position=hp.worldPos(-(hp.flatHalf+hp.radius*Math.PI/3),z,p.pos.clone()),heading=p.axisF.clone().set(-1,0,0);
    p.respawn(l,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);p.axisF.copy(heading);p.axisL.set(0,0,1);p.speed=23;p.freeSkate=true;
    p.groundHit=p.queryGround(l);p.rideNormal.copy(p.groundHit.normal);q.contacts=0;g.input.update();q.consume();
   },z);
   await page.keyboard.down('Space');
   if(release){await advance(90,'steep');await page.keyboard.up('Space')}
   const launch=await advance(90,'launch');assert.equal(launch.vert,true);assert.equal(launch.hang,4);assert.equal(launch.bail,false);assert.equal(launch.contacts,0);
   if(z===-158.25&&!release)await page.screenshot({path:join(output,`lip-${lite?'lite':'full'}.png`)});
   const landing=await advance(180,'landing');assert.equal(landing.grounded,true);assert.equal(landing.pipe,4,JSON.stringify({z,release,landing}));assert.equal(landing.bail,false);assert.equal(landing.contacts,0);assert.ok(landing.speed>8);
   flights.push({z,release,launch,landing});
  }
  await page.keyboard.up('Space');
  // Native out-of-bounds recovery remains usable after testing the affected pool.
  await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.set(185,-5,-160);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-3;});
  const recovery=await advance(30,'landing');assert.equal(recovery.grounded,true);assert.ok(recovery.pos[1]>-6);
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  results.push({lite,stamp,spawn,recorded,flights,recovery});
 }
 assert.deepEqual(errors,[]);console.log('PASS replay lip approach, 12 native keyboard airs/drop-ins, supported spawn and out-of-bounds recovery; lite/full rendering and clean consoles.');
}finally{await writeFile(join(output,'review.json'),JSON.stringify({base,results,errors},null,2));await browser.close()}
