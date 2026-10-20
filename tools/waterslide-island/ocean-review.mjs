import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5348').replace(/\/$/,'');
const output=process.env.OCEAN_REVIEW_OUTPUT||'/private/tmp/slipstream-ocean-review';await mkdir(output,{recursive:true});
const profiles=[
 {name:'previous-beach',params:{deep:{r:.015,g:.42,b:.56,a:1},shallow:{r:.07,g:.82,b:.75,a:.7},peak:{r:.542453,g:.850634,b:1,a:.47},normalStrength:1.35,reflectionStrength:.38,reflectionFresnel:17.8,reflectionDistortion:1.42}},
 {name:'lagoon',params:{deep:{r:.018,g:.28,b:.34,a:1},shallow:{r:.08,g:.62,b:.55,a:.7},peak:{r:.28,g:.58,b:.55,a:.13},normalStrength:1.05,reflectionStrength:.32,reflectionFresnel:8,reflectionDistortion:.6}},
 {name:'deep-lagoon',params:{deep:{r:.018,g:.20,b:.28,a:1},shallow:{r:.06,g:.48,b:.44,a:.7},peak:{r:.25,g:.52,b:.52,a:.1},normalStrength:1.05,reflectionStrength:.32,reflectionFresnel:8,reflectionDistortion:.6}},
];
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'}),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'TIME TRIAL',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
 const initial=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();window.islandStep=r.step.bind(r);r.step=()=>{};window.originalOcean=structuredClone(r.level.water.params);return {params:window.originalOcean,look:r.level.builtFromData.ocean.look,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.equal(initial.look,'waterpark-island','production level selects its island ocean look');
 for(const [key,value]of Object.entries(profiles.find(p=>p.name==='lagoon').params))assert.deepEqual(initial.params[key],value,'production ocean retains authored '+key);
 for(const [name,s] of [['open-coil',3430],['coastal-reveal',3750],['finish',4050]]){
  await page.evaluate(s=>{const g=window.__game,r=g.getSkateRace(),p=g.player;r.reset('time-trial');r.phase='running';r.elapsed=50;g.ui.deathFade(0);g.scene.updateMatrixWorld(true);let at=null;for(let d=0;d<=12&&!at;d+=.5)at=r.course.support(r.level,s+d);if(!at)throw Error('No supported floor at '+s);p.resetRacePosition(r.level,at,r.course.tangent(s));r.riders[0].progress=s;r.level.playerPos.copy(p.pos);for(let i=0;i<35;i++){g.scene.updateMatrixWorld(true);window.islandStep(1/60,r.drive(0));p.commitRenderStep(r.level);r.commitRenderStep();}},s);
  for(const profile of profiles){
   await page.evaluate(params=>{const w=window.__game.getSkateRace().level.water;Object.assign(w.params,structuredClone(window.originalOcean),params);w.debug.freeze=true;w.time=30;w.markWavesDirty();},profile.params);
   await page.waitForTimeout(1500);await page.screenshot({path:`${output}/${name}-${profile.name}.png`});
   reports.push(await page.evaluate(({name,profile})=>{const g=window.__game,w=g.getSkateRace().level.water;return {name,profile,params:structuredClone(w.params),position:g.player.pos.toArray(),camera:g.camera.position.toArray(),render:g.getRenderFrameStats(),assets:g.getSkateRace().level.jungleAssets.diagnostics};},{name,profile:profile.name}));
  }
 }
 await writeFile(output+'/report.json',JSON.stringify({base,initial,profiles,reports,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({profiles:profiles.map(p=>p.name),views:reports.length,errors}));
}finally{await browser.close();}
