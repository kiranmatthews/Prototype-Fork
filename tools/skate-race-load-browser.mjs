import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5229').replace(/\/$/,'');
const old=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/slipstream-before-merge.json.gz',import.meta.url))));
old.push(JSON.parse(gunzipSync(await readFile(new URL('./fixtures/slipstream-before-race.json.gz',import.meta.url)))));
for(const e of old){e.data.cameraAirLift=.47;e.data.edgeGrindingRevision=1;}
const output=process.env.RACE_LOAD_OUTPUT||'/private/tmp/skate-race-load-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
await context.addInitScript(old=>{localStorage.setItem('solProtoUserLevels',JSON.stringify(old));localStorage.setItem('solProtoCloudPulled','1');},old);
const page=await context.newPage(),errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const id of ['slip','slipstream-2','astra-chimeworks','slipstream-continuous']){
  await page.goto(`${base}/?lite&playtest&level=${id}`,{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),l=r.level,d=l.captureData();return {id:g.getCurrentLevel().id,phase:r.phase,riders:r.riders.length,spawn:d.spawn,checkpoints:l.checkpoints.length,bonus:l.allowsBonus,worldCrystal:l.crystalPickup,clock:l.clockPickup,
   length:r.course.length,ratio:r.course.length/d.skateRace.originalLength,sections:r.hud().sections,finishWidth:d.skateRace.finishWidth,
   stamp:document.querySelector('.hud-build')?.textContent,stored:JSON.parse(localStorage.getItem('solProtoUserLevels'))};});
  assert.equal(report.id,'slipstream-race');assert.equal(report.riders,8);assert.equal(report.checkpoints,0);assert.equal(report.bonus,false);assert.equal(report.worldCrystal,null);assert.equal(report.clock,null);
  assert.ok(Math.abs(report.ratio-1.33)<1e-9);assert.equal(report.finishWidth,44);assert.ok(report.spawn[1]>900);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(report.stored,old);
  reports.push({requested:id,...report,stored:undefined});console.log(JSON.stringify(reports.at(-1)));
 }
 await page.screenshot({path:output+'/loaded-race.png'});assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({base,reports,errors},null,2));
}finally{await browser.close();}
