import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5263').replace(/\/$/,'');
const out=process.env.COUNTRY_CLUB_OUTPUT||'/private/tmp/country-club-release-smoke';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
 await page.goto(base+'/?playtest&level=country-club'+(process.argv.includes('--lite')?'&lite':''),{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const course=await page.evaluate(async()=>{
  const g=window.__game,l=g.getLevel(),d=g.getCurrentLevel().data;
  await Promise.all([l.prepareJungleAssets(),l.prepareSurfaceImages()]);
  return {stamp:document.querySelector('.hud-build')?.textContent,components:d.components.length,racers:d.skateRace?.racers,sky:d.sky,
   cupFlags:d.components.filter(c=>c.nm?.endsWith('/ numbered cup flag')).length,numbers:d.components.filter(c=>c.nm?.includes('visible cup number')).length,
   oak:d.components.filter(c=>c.dkind==='countryoak').length,boosts:d.components.filter(c=>c.t==='speedpad').length,assets:l.jungleAssetDiagnostics};
 });
 assert.match(course.stamp,/Codex\/sol fork/);assert.equal(course.cupFlags,18);assert.equal(course.numbers,18);assert.equal(course.racers,8);assert.equal(course.sky,'country-club');assert.ok(course.oak>50);assert.equal(course.boosts,23);
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:15000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r);r.step=(dt,input)=>{Object.assign(input,r.drive(0));step(dt,input);};});
 await page.waitForFunction(()=>window.__game.getSkateRace().riders[0].progress>400,null,{timeout:40000});
 const race=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {progress:r.riders[0].progress,speed:g.player.speed,falls:r.riders[0].falls,deaths:g.player.totalDeaths,count:r.count,phase:r.phase,loading:g.getLoadingDiagnostics()};});
 await page.screenshot({path:out+'/race.png'});assert.equal(race.count,8);assert.equal(race.deaths,0);assert.equal(race.falls,0);assert.deepEqual(race.loading.failed,[]);
 await page.evaluate(()=>window.__game.getSkateRace().start('time-trial'));
 const trial=await page.evaluate(()=>{const r=window.__game.getSkateRace();return{count:r.count,clock:r.level.clockPickup,otherRiders:r.riders.slice(1).some(a=>a.scene.visible)};});
 assert.equal(trial.count,1);assert.equal(trial.clock,null);assert.equal(trial.otherRiders,false);assert.deepEqual(errors,[]);
 const report={url:base,checkedAt:new Date().toISOString(),course,race,trial,errors};await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
