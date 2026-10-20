import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5228',output=process.env.WATERSLIDE_OUTPUT||'/private/tmp/waterslide-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race${process.env.WATERSLIDE_LITE?'&lite':''}`,{timeout:180000});await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='countdown');await page.screenshot({path:output+'/countdown.png'});
 const start=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {jumps:r.level.skateRace.jumps.length,mounted:r.riders.map(a=>a.player.boardRolling&&a.player.boardG.visible),transparent:getComputedStyle(document.querySelector('.race-interface')).backgroundImage==='none'};});
 assert.equal(start.jumps,18);assert.ok(start.mounted.every(Boolean));assert.equal(start.transparent,true);
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');await page.screenshot({path:output+'/go.png'});
 await page.evaluate(()=>{const r=window.__game.getSkateRace();window.stepWaterslideReview=r.step.bind(r);r.step=()=>{};r.elapsed=50;});
 for(const [name,s] of [['start',0],['ribbon',600],['pool',1100],['reservoir',1800],['broken-platforms',2680],['moving-platforms',2870],['steep-coils',3450],['finish',4050]]){
  await page.evaluate(s=>{const g=window.__game,r=g.getSkateRace(),p=g.player;r.reset('race');r.phase='running';r.elapsed=50;g.ui.deathFade(0);g.scene.updateMatrixWorld(true);let at=null;for(let offset=0;offset<=10&&!at;offset+=.5)at=r.course.support(r.level,s+offset);if(!at)throw Error('No supported review placement');p.resetRacePosition(r.level,at,r.course.tangent(s));p.speed=0;p.prepareStartPresentation(r.level,.1);r.riders[0].progress=s;r.riders[0].item='tidal-wave';r.level.playerPos.copy(p.pos);r.phase='running';for(let i=0;i<35;i++){g.scene.updateMatrixWorld(true);window.stepWaterslideReview(1/60,r.drive(0));p.commitRenderStep(r.level);r.commitRenderStep();}},s);
  await page.waitForTimeout(1500);console.log(JSON.stringify(await page.evaluate(name=>{const r=window.__game.getSkateRace();return {name,state:r.riders[0].player.state,falls:r.riders[0].falls,recovery:r.riders[0].recovery};},name)));await page.screenshot({path:`${output}/${name}.png`});
 }
 const stats=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,source:window.__game.getLevel().name,images:[...document.querySelectorAll('.race-interface img')].map(i=>({src:i.currentSrc,loaded:i.complete&&i.naturalWidth>0})),render:window.__game.getRenderFrameStats()}));
 await writeFile(output+'/report.json',JSON.stringify({start,stats,errors},null,2));assert.deepEqual(errors,[]);assert.ok(stats.images.every(i=>i.loaded));console.log(JSON.stringify({start,stats,errors}));
}finally{await browser.close();}
