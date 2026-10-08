import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import('/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const data=JSON.parse(await readFile(new URL('fixtures/custard-solid-wall-replay.json',import.meta.url),'utf8'));
const base=process.argv.find(v=>/^https?:/.test(v))??'http://127.0.0.1:5260';
const prefix=process.argv.includes('--legacy-prefix')?6300:0;
const out=process.env.SOLID_REPLAY_OUTPUT??'/private/tmp/solid-wall-browser-before';await mkdir(out,{recursive:true});
const report={base,errors:[],frames:[],snapshots:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{Object.defineProperty(navigator,'getGamepads',{value:()=>[]});});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base+'/?playtest&level=custard-creek',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
 await page.evaluate(({data,prefix})=>{
  const g=window.__game,p=g.player,step=p.step;window.__solidReplayTrace=[];
  p.step=function(...args){if(g.getLevel().worldSolids)g.getLevel().worldSolids.enabled=g.replayer.frame>=prefix;const result=step.apply(this,args);if(g.replayer.active){const f=g.replayer.frame;if(f%6===0||f>5000)window.__solidReplayTrace.push({f,p:p.pos.toArray(),state:p.state,bailing:p.isBailing,ground:p.groundHit?.name,speed:p.speed,vy:p.vVel,grounded:p.grounded,axis:p.axisF.toArray(),impact:p.worldImpactDiagnostics});}return result;};
  window.__restoreSolidReplay=()=>{p.step=step;};g.loadReplay(data);if(g.getLevel().worldSolids)g.getLevel().worldSolids.enabled=prefix===0;
 },{data,prefix});
 await page.waitForFunction(()=>window.__game.replayer.active);
 for(const frame of [6290,6330,6347,6350,6360,6370,6400,6450,6660]){
  await page.waitForFunction(frame=>window.__game.replayer.frame>=frame||!window.__game.replayer.active,frame);
  report.snapshots.push(await page.evaluate(()=>{const g=window.__game,p=g.player;return{frame:g.replayer.frame,p:p.pos.toArray(),state:p.state,bailing:p.isBailing,ground:p.groundHit?.name,speed:p.speed,vy:p.vVel,impact:p.worldImpactDiagnostics,body:{height:p.characterProportionDiagnostics.hitboxHeight,renderBounds:[p.characterBounds.min.toArray(),p.characterBounds.max.toArray()],scale:p.bodyGroup.scale.toArray()}};}));
  await page.screenshot({path:out+`/frame-${frame}.png`});
 }
 await page.waitForFunction(()=>!window.__game.replayer.active);
 report.frames=await page.evaluate(()=>{window.__restoreSolidReplay();return window.__solidReplayTrace;});
 console.log(JSON.stringify({snapshots:report.snapshots,errors:report.errors}));assert.deepEqual(report.errors,[]);
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
