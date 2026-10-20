import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:6265/';
const out=process.env.SECRET_REVIEW_DIR||'/private/tmp/secret-course-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),checks=[],errors=[];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:2,fixed60:true})));
  const suffix=lite?'&lite':'',mode=lite?'lite':'full';
  const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.goto(base+'?playtest&level=warproom'+suffix);await ready();
  const roster=await page.evaluate(()=>({removed:window.__game.findLevel('descent')===null,gates:window.__game.findLevel('jungle-gate-run').name}));
  assert.deepEqual(roster,{removed:true,gates:'The Ancient Gates'});
  for(const [key,id,name] of [['secret-1','sky','Sky Bridge'],['secret-2','jungle-terraces','Temple of Embers'],['secret-3','jungle-gate-run','The Ancient Gates']]){
   await page.goto(base+'?playtest&level=warproom'+suffix);await ready();
   await page.getByRole('button',{name:/LEVEL STATS/}).click();
   await page.getByRole('button',{name:'Previous island',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.game-panel-title')?.textContent==='SECRET ISLAND');
   const rows=await page.locator('.game-level-row').allTextContents();
   assert.equal(rows.length,8);for(const text of ['SKY BRIDGE','TEMPLE OF EMBERS','THE ANCIENT GATES'])assert.ok(rows.some(row=>row.includes(text)));
   const card=page.locator(`[data-level-key="${key}"]`);
   await card.click();
   assert.doesNotMatch(await page.locator('.game-level-detail').textContent(),/COMING SOON/);
   if(!lite&&key==='secret-1')await page.screenshot({path:out+'/secret-level-stats.png'});
   await card.dblclick();await ready();
   await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,id,{timeout:60000});
   const state=await page.evaluate(()=>{const g=window.__game;return{id:g.getCurrentLevel().id,name:g.getCurrentLevel().name,deaths:g.player.totalDeaths,grounded:g.player.grounded,failed:g.getLoadingDiagnostics().failed,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],fixed:g.renderQualitySettings.enabled};});
   assert.equal(state.id,id);assert.equal(state.deaths,0);assert.equal(state.grounded,true);assert.deepEqual(state.failed,[]);assert.deepEqual(state.canvas,lite?[1920,1080]:[3840,2160]);assert.equal(state.fixed,false);
   if(!lite)await page.screenshot({path:`${out}/${key}-course.png`});
   checks.push({mode,key,...state});console.log(JSON.stringify(checks.at(-1)));
  }
  await page.goto(base+'?playtest&level=warehouse'+suffix);await ready();
  await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:60000});
  const sample=()=>page.evaluate(()=>{const g=window.__game,p=g.player;return{type:p.lastJumpType,board:p.boardRolling,mounted:p.freeSkate,ejected:p.emergencyEjectLandingPending,velocity:p.vVel,double:p.doubleJumpAir,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};});
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');
  await page.waitForFunction(()=>window.__game.player.boardRolling,null,{timeout:10000});await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.boardOllieAir,null,{timeout:10000});
  const first=await sample();assert.equal(first.board,true);
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.emergencyEjectCharging);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.emergencyEjectLandingPending,null,{timeout:10000});
  const second=await sample();assert.equal(second.board,false);assert.equal(second.mounted,false);assert.equal(second.type,'Emergency Eject');
  await page.keyboard.up('ArrowUp');await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.rawInput.jumpHeld);await page.keyboard.up('Space');
  await page.waitForFunction(()=>!window.__game.player.rawInput.jumpHeld);
  const third=await sample();assert.equal(third.board,false);assert.equal(third.double,false);assert.ok(third.velocity<second.velocity,'extra press added another airborne jump');
  if(!lite)await page.screenshot({path:out+'/second-jump-abandon.png'});
  checks.push({mode,jump:{first,second,third}});console.log('PASS '+mode+' native ollie → second-release abandon → no extra jump');
  await page.goto(base+'?playtest&level=warproom&lockedProgression'+suffix);await ready();await page.getByRole('button',{name:/LEVEL STATS/}).click();
  await page.locator('.game-level-row').first().waitFor();
  assert.deepEqual(await page.locator('.game-level-row').evaluateAll(rows=>rows.map(r=>r.dataset.levelKey)),['treehouse-trail']);
  assert.doesNotMatch(await page.locator('.game-shell-panel').textContent(),/SKY BRIDGE|TEMPLE OF EMBERS|ANCIENT GATES|SECRET ISLAND/);
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS both render modes, all three secret course menu launches, restored skating jumps, deleted catalogue entry and hidden locked names.');
}finally{await writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
