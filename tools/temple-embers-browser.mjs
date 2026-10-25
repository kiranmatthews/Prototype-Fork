import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {hydrateTempleRoute} from './temple-night-browser-space.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5361/';
const output=process.env.TEMPLE_BROWSER_OUTPUT||'/private/tmp/temple-embers-review';
const selectedStations=process.argv.find(a=>a.startsWith('--stations='))?.slice(11).split(',').map(Number);
const descriptor=JSON.parse(await readFile(process.env.TEMPLE_ROUTE||'/private/tmp/temple-embers-before/route.json','utf8'));
const route=hydrateTempleRoute(descriptor);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL(`?playtest&level=jungle-terraces${process.argv.includes('--lite')?'&lite':''}`,base).href);
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='jungle-terraces'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game,l=g.getLevel();await l.prepareJungleAssets();await g.player.preparePresentationAssets();await Promise.all(l.enemies.map(e=>e.visual.ready));});
 for(const s of selectedStations??[-12,22,50,182,241,310,508,592,650,810,865,1050,1294,1352]){
  const f=route.frameAt(s),q=route.toWorld(s,descriptor.frames[Math.round((s+20)*4)].y+.12,1.25);
  await page.evaluate(({q,f})=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(...q),heading:p.pos.clone().set(f.fx,0,f.fz)});},{q,f});
  await page.waitForTimeout(850);
  const state=await page.evaluate(()=>{const g=window.__game,p=g.player;return{position:p.pos.toArray(),state:p.state,grounded:p.grounded,level:g.getCurrentLevel().name,stamp:document.querySelector('.hud-build')?.textContent};});
  await page.screenshot({path:`${output}/station-${s}.png`});report.push({s,...state});console.log(JSON.stringify(report.at(-1)));
 }
 await writeFile(`${output}/review.json`,JSON.stringify({report,errors},null,2));
 assert.deepEqual(errors,[]);assert.ok(report.every(r=>r.grounded&&r.state==='ride'));assert.match(report[0].stamp,/Codex\/sol fork/);
}catch(error){
 const page=browser.contexts()[0]?.pages()[0];
 if(page){await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});console.log(await page.evaluate(()=>({text:document.body.innerText.slice(-4000),game:!!window.__game,loading:window.__game?.getLoadingDiagnostics(),current:window.__game?.getCurrentLevel()?.id})).catch(()=>null));}
 await writeFile(`${output}/errors.json`,JSON.stringify({error:String(error),errors},null,2));throw error;
}finally{await browser.close();}
