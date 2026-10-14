import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5216').replace(/\/$/,'');
const entries=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/slipstream-before-merge.json.gz',import.meta.url))));
const stale=entries.find(e=>e.id==='slip');
stale.data.edgeGrindingRevision=1;stale.data.medalTimes={gold:160,silver:184,bronze:208};
stale.data.cameraAirLift=.42; // An edited snapshot must not become the campaign course.
const output=process.env.SLIPSTREAM_LOAD_OUTPUT||'/private/tmp/slipstream-load-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
await context.addInitScript(entries=>{localStorage.setItem('solProtoUserLevels',JSON.stringify(entries));localStorage.setItem('solProtoCloudPulled','1');},entries);
const page=await context.newPage(),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 for(const id of ['slip','slipstream-2','astra-chimeworks','slipstream-continuous']) {
  await page.goto(`${base}/?playtest&level=${id}${id==='slipstream-continuous'?'':'&lite'}`,{timeout:120000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='slipstream-continuous'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.waitForTimeout(400);
  const r=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),d=l.captureData();return {
   id:g.getCurrentLevel().id,spawn:l.spawnPos.toArray(),grounded:g.player.grounded,components:d.components.length,
   checkpoints:l.checkpoints.length,gate:d.components.filter(c=>c.t==='gate').map(c=>c.p),
   joins:d.components.filter(c=>['Reservoir causeway','Brass promenade'].includes(c.nm)).map(c=>c.nm),
   chimeKeys:d.components.filter(c=>c.nm?.startsWith('Xylophone / key')).length,
   bonus:l.bonusPlatformDiagnostics,bonusBoxes:l.bonusCrateTotal,allowsBonus:l.allowsBonus,boss:l.isBossLevel,
   crystal:!!l.crystalPickup,stamp:document.querySelector('.hud-build')?.textContent,
   stored:JSON.parse(localStorage.getItem('solProtoUserLevels')).find(e=>e.id==='slip')};});
  assert.equal(r.components,1214);assert.equal(r.checkpoints,15);assert.deepEqual(r.gate,[[12,17,-2570]]);
  assert.deepEqual(r.joins,['Reservoir causeway','Brass promenade']);assert.equal(r.chimeKeys,5);
  assert.ok(r.spawn[1]>276&&r.spawn[1]<278);assert.ok(r.grounded);assert.match(r.stamp,/Codex\/sol fork/);
  assert.equal(r.bonus,null);assert.equal(r.bonusBoxes,0);assert.equal(r.allowsBonus,false);assert.equal(r.boss,false);assert.equal(r.crystal,true);
  assert.deepEqual(r.stored,stale,'The saved first course must remain intact');
  reports.push({requested:id,...r,stored:{spawn:r.stored.data.spawn,components:r.stored.data.components.length}});
 }
 await page.screenshot({path:output+'/complete-course-start.png'});
 await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();for(const v of Object.values(g.campaign.active.levels))v.cleared=true;g.campaign.setMapFocus('slipstream');g.gameFlow.openLevelSelect();});
 const rows=await page.locator('[data-level-key]').evaluateAll(rows=>rows.map(r=>r.dataset.levelKey));
 assert.equal(rows.filter(r=>r==='slipstream').length,1);assert.ok(!rows.includes('slipstream-2'));
 await page.evaluate(()=>window.__game.gameFlow.changeLevelSelectIsland(1));
 const second=await page.locator('[data-level-key]').evaluateAll(rows=>rows.map(r=>r.dataset.levelKey));assert.ok(!second.includes('chimeworks'));
 assert.deepEqual(errors,[]);
 await writeFile(output+'/report.json',JSON.stringify({base,reports,rows,second,errors},null,2));
 console.log(JSON.stringify({base,reports,errors}));
}finally{await browser.close();}
