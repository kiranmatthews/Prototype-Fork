import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5229').replace(/\/$/,'');
const out=process.env.RACE_FALL_OUTPUT||'/private/tmp/skate-race-fall-browser';await mkdir(out,{recursive:true});
const take=JSON.parse(await readFile(new URL('./fixtures/slipstream-fall-replay.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race${process.env.RACE_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(take=>{
  const g=window.__game,p=g.player;g.input.pollGamepad=()=>null;g.loadReplay(take);
  const review=window.fallReview={lastSupport:0,death:null,returned:null,lives:p.lives},step=p.step.bind(p),death=p.onDeath,respawn=p.onRespawn;
  p.step=(...args)=>{const result=step(...args);if(g.replayer.active&&p.grounded)review.lastSupport=g.replayer.frame;return result;};
  p.onDeath=()=>{death();if(!review.death)review.death={frame:g.replayer.frame,offFrame:review.lastSupport,y:p.pos.y,boxes:g.getSkateRace().riders[0].boxes.size};};
  p.onRespawn=()=>{respawn();if(review.death&&!review.returned){review.returned={frame:g.replayer.frame,y:p.pos.y,grounded:p.grounded,boxes:g.getSkateRace().riders[0].boxes.size};g.replayer.end();g.ui.setReplayBadge(false);}};
 },take);
 await page.waitForFunction(()=>window.fallReview?.returned,null,{timeout:150000});
 await page.waitForTimeout(1000);
 const report=await page.evaluate(()=>{const g=window.__game,p=g.player;return {...window.fallReview,stamp:document.querySelector('.hud-build')?.textContent,livesAfter:p.lives,deaths:p.totalDeaths,phase:g.getSkateRace().phase,fade:Number(getComputedStyle(document.querySelector('.hud-fade')).opacity),state:p.state,position:p.pos.toArray()};});
 await page.screenshot({path:out+'/returned.png'});await writeFile(out+'/report.json',JSON.stringify({base,report,errors},null,2));console.log(JSON.stringify({report,errors}));
 assert.ok(report.death.y>600&&report.returned.y>800&&report.returned.grounded);
 assert.ok((report.returned.frame-report.death.offFrame)/60<5);assert.ok(report.returned.boxes>=report.death.boxes);
 assert.equal(report.livesAfter,report.lives);assert.equal(report.deaths,0);assert.equal(report.phase,'running');assert.ok(report.fade<.01);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
}finally{await browser.close();}
