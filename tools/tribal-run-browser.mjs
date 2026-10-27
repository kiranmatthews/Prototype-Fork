import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRIBAL_URL||'http://127.0.0.1:5247';
const lite=!process.argv.includes('--full'),bonus=process.argv.includes('--bonus');
const id=bonus?'bonus-tribal-run':'tribal-run',out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/greybox/evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],failed=[],report={id,lite,errors,failed,scenes:[]};
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ABORTED'))failed.push({url:r.url(),error:r.failure()});});
try{
 await page.goto(`${base}/?playtest&level=${id}&frameprobe&renderdiag${lite?'&lite':''}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.getLevel().prepareJungleAssets();await g.player.preparePresentationAssets();});
 if(process.argv.includes('--native'))await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);});
 const scenes=await page.evaluate(async bonus=>{
  const g=window.__game,l=g.getLevel(),base=[{name:'spawn',p:l.spawnPos.toArray()},...l.checkpoints.map((c,i)=>({name:`checkpoint-${i+1}`,p:c.spawnPos.toArray()}))];
  if(bonus)return [...base,{name:'resonance-drum',p:[29.5,2.52,0]},{name:'reveal-gallery',p:[52,6.92,0]}];
  const m=await import('/src/levels/tribal-run.ts');
  return [...base,
   {name:'offbeat-crowns',p:m.tribalPoint(310.1,.12)},
   {name:'recovery-lane',p:m.tribalPoint(385,-4.38,10.2)},
   {name:'court-low-line',p:m.tribalPoint(932,.12,-11.8)},
   {name:'loom-underpass',p:m.tribalPoint(1210,.12,m.tribalBraid(1)(1210))},
   {name:'loom-flyover',p:m.tribalPoint(1210,m.tribalLoomHeight(1210)+.12,m.tribalBraid(-1)(1210))},
   {name:'echo-beaters',p:m.tribalPoint(1790,.12)},
  ];
 },bonus);
 for(const scene of process.argv.includes('--spawn-only')?scenes.slice(0,1):scenes){
  await page.evaluate(({p})=>{const g=window.__game,l=g.getLevel(),player=g.player;const dir=l.laneDirAt(...p)??{x:1,z:0};
   player.respawn(l,true,false,{position:player.pos.clone().set(...p),heading:player.pos.clone().set(dir.x,0,dir.z)});},scene);
  await page.waitForTimeout(900);
  const state=await page.evaluate(()=>{const g=window.__game,p=g.player;return{position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,
   camera:g.camera.position.toArray(),target:p.camTarget?.toArray(),stamp:document.querySelector('.hud-build')?.textContent,
   quality:g.renderQualitySettings.snapshot(),sizes:g.getRenderQualitySizes(),drawingBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],render:g.getRenderFrameStats(),assets:g.getLevel().jungleAssetDiagnostics};});
  await page.screenshot({path:`${out}/${id}-${lite?'lite':'full'}-${scene.name}.png`});
  report.scenes.push({...scene,...state});assert.ok(state.grounded,scene.name+' supported');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log(JSON.stringify({pass:true,id,lite,scenes:report.scenes.map(s=>({name:s.name,grounded:s.grounded,drawingBuffer:s.drawingBuffer})),errors,failed}));
}catch(error){report.error=error.message;await page.screenshot({path:`${out}/${id}-failure.png`}).catch(()=>{});console.log(JSON.stringify(report));throw error;}
finally{await writeFile(`${out}/${id}-${lite?'lite':'full'}-browser.json`,JSON.stringify(report,null,2));await browser.close();}
