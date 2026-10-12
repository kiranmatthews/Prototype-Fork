import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(v=>/^http/.test(v))||'http://127.0.0.1:5287/';
const output=process.env.NIGHTWORKS_REVIEW_OUTPUT||'/private/tmp/nightworks-zombie-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],rows=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},recordVideo:{dir:output,size:{width:1440,height:900}}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const load=async(id,lite=true)=>{
  await page.goto(new URL(`?playtest&level=${id}${lite?'&lite':''}`,base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);});
  if(id.startsWith('bonus-'))await page.waitForFunction(()=>window.__game.player.grounded&&Math.abs(window.__game.player.pos.y)<.25,null,{timeout:15000});
 };
 await load('dark');
 await page.evaluate(()=>{
  const g=window.__game,e=g.getLevel().enemies[0];g.player.step=()=>{};
  g.player.pos.copy(e.group.position).add({x:-4,y:0,z:2});g.player.prevPos.copy(g.player.pos);
  const render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene,camera)=>{
   if(camera===g.camera){const angle=(window.__goblinView??.7)+e.group.rotation.y;camera.position.copy(e.group.position).add({x:Math.sin(angle)*10,y:4.5,z:Math.cos(angle)*10});camera.lookAt(e.group.position.clone().add({x:0,y:2,z:0}));}
   return render(scene,camera);
  };
 });
 for(const [view,angle] of [['front',0],['quarter',.7],['side',Math.PI/2]]){
  await page.evaluate(angle=>{window.__goblinView=angle;},angle);
  await page.waitForFunction(()=>window.__game.getLevel().enemies[0].state==='shamble');
  await page.waitForTimeout(200);await page.screenshot({path:`${output}/goblin-${view}-shamble.png`});
  await page.waitForFunction(()=>window.__game.getLevel().enemies[0].state==='lurch',null,{timeout:16000});
  await page.screenshot({path:`${output}/goblin-${view}-lurch.png`});
 }
 await page.waitForFunction(()=>window.__game.getLevel().enemies[0].state==='shamble');
 const state=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),e=l.enemies[0];
  const before=e.group.position.toArray();l.playerPos.copy(e.group.position).add({x:-3,y:0,z:0});
  const killed=l.killEnemy(e,e.group.position.clone().set(42,10,0),{});
  return {killed,alive:e.alive,state:e.state,before,size:e.group.getObjectByName(`Enemy_${e.kind}_Artwork`).scale.x};
 });
 assert.equal(state.killed,false);assert.equal(state.alive,true);assert.equal(state.state,'stagger');assert.equal(state.size,4);
 await page.waitForTimeout(220);await page.screenshot({path:`${output}/goblin-stagger.png`});
 await page.waitForTimeout(1300);
 rows.push(await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),e=l.enemies[0];return {phase:'combat',aliveBeforeSecond:e.alive,killed:l.killEnemy(e,undefined,{}),goblin:e.group.userData.goblin};}));
 assert.equal(rows.at(-1).killed,true);
 await load('dark');
 await page.waitForFunction(()=>window.__game.player.grounded);
 const recovery=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,cp=l.checkpoints[0];
  p.lives=8;l.activateCheckpoint(cp,p.cratesBroken,p.fruit,p.masks,p.points);
  const deaths=p.totalDeaths;p.pos.set(200,l.killY-2,0);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-8;
  return {deaths,spawn:cp.spawnPos.toArray()};
 });
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:5000});
 await page.waitForFunction(()=>{const p=window.__game.player;return p.grounded&&p.state==='ride';},null,{timeout:20000});
 const reset=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {distance:g.player.pos.distanceTo(l.activeCheckpoint.spawnPos),hp:l.enemies.map(e=>e.group.userData.goblin.hp)};});
 assert.ok(reset.distance<.3);assert.ok(reset.hp.every(hp=>hp===2));rows.push({phase:'checkpoint-pit-reset',spawn:recovery.spawn,observedDeath:true,...reset});
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,f=l.gateSpec;
  p.pos.set(f.x,f.y+.1,f.z);p.prevPos.copy(p.pos);p.state='ride';p.grounded=false;p.vVel=0;p.settle(l);
 });
 await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:10000});
 rows.push({phase:'summit-gate',finished:true});
 for(const id of ['bonus-nightworks','bonus-nightworks-after-hours']){
  await load(id);await page.waitForTimeout(1200);
  rows.push(await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {phase:'bonus',name:l.name,stamp:document.querySelector('.hud-build')?.textContent,glError:g.renderer.getContext().getError(),ground:l.groundMeshes.length,crates:l.crates.length};}));
  await page.screenshot({path:`${output}/${id}-arrival-lite.png`});
  await page.evaluate(()=>{const g=window.__game;g.player.step=()=>{};const render=g.renderer.render.bind(g.renderer);
   g.renderer.render=(scene,camera)=>{if(camera===g.camera&&window.__quarryShot){const {x,d}=window.__quarryShot;camera.position.set(x,8.2,d);camera.lookAt(x,4.5,0);}return render(scene,camera);};
  });
  for(const x of [8,35,65]){
   await page.evaluate(x=>{window.__quarryShot={x,d:30};const p=window.__game.player;p.pos.set(x,.05,0);p.prevPos.copy(p.pos);},x);
   await page.waitForTimeout(250);await page.screenshot({path:`${output}/${id}-wide-${x}.png`});
  }
 }
 await load('bonus-nightworks',false);await page.waitForTimeout(1600);
 await page.screenshot({path:`${output}/bonus-nightworks-full.png`});
 const full=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,glError:window.__game.renderer.getContext().getError()}));
 assert.match(full.stamp,/Codex\/sol fork/);assert.equal(full.glError,0);rows.push({phase:'full',...full});
 assert.deepEqual(errors,[]);
 console.log('PASS Nightworks goblin size/two hits, both quarry bonuses at close/wide cameras, full render, clean console.');
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,rows,errors},null,2));await browser.close();}
