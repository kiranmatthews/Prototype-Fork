import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import ts from 'typescript';
const motionCode=ts.transpileModule(await readFile(new URL('../src/kiteTow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {KITE_TOW}=await import('data:text/javascript;base64,'+Buffer.from(motionCode).toString('base64'));
const require=createRequire(import.meta.url);let module;
try{module=require.resolve('playwright');}catch{module=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(module).href);
const base=process.env.BEACH_BASE??'http://127.0.0.1:5288',out=process.env.BEACH_OUTPUT??'docs/beach-street/wind-finish';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const report={started:new Date().toISOString(),base,errors:[],failed:[],cases:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.failed.push({url:r.url(),status:r.status()});});
try{
 await page.goto(`${base}/?playtest&level=coastal-street-run`,{waitUntil:'domcontentloaded',timeout:150000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='coastal-street-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:150000});
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);g.player.respawn(g.getLevel(),true);});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:150000});
 // Deliberately hold both extreme gusts/steering poses while waiting at the
 // start. This is a render stress fixture, not a claim of input-only traversal.
 for(const [width,height] of [[1600,1000],[815,850],[480,900],[900,480]]){
  await page.setViewportSize({width,height});
  await page.waitForFunction(({width,height})=>{const c=window.__game.renderer.domElement;return c.width===width&&c.height===height;},{width,height});
  for(const wind of [-1,1])for(const steer of [-1,1]){
   await page.evaluate(({wind,steer,speed,drift})=>{const p=window.__game.player;p.kiteMotion.wind=p.kiteMotion.windTarget=wind;p.kiteMotion.windTime=100;p.kiteMotion.lateral=steer*speed+wind*drift;},{wind,steer,speed:KITE_TOW.steeringSpeed,drift:KITE_TOW.windDrift});
   await page.waitForTimeout(180);
   const sample=await page.evaluate(()=>{
    const g=window.__game,p=g.player,s=p.kiteVisual.sail,v=p.pos.clone();
    const bounds={minX:1,maxX:-1,minY:1,maxY:-1};
    // Project the complete mesh. A world-aligned box invents high empty
    // corners around the rolled foil, which are not visible canopy pixels.
    s.traverse(o=>{const a=o.geometry?.getAttribute('position');if(!a)return;
     for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(g.camera);
      bounds.minX=Math.min(bounds.minX,v.x);bounds.maxX=Math.max(bounds.maxX,v.x);bounds.minY=Math.min(bounds.minY,v.y);bounds.maxY=Math.max(bounds.maxY,v.y);}
    });
    return {bounds,aspect:g.camera.aspect,setback:-s.position.z,gripErrors:p.kiteVisual.gripErrors,stamp:document.querySelector('.hud-build')?.textContent};
   });
   report.cases.push({width,height,wind,steer,...sample});
   const b=sample.bounds;
   assert.ok(b.minX>=-1&&b.maxX<=1&&b.minY>=-1&&b.maxY<=1,JSON.stringify(report.cases.at(-1)));
   assert.ok(Math.max(...sample.gripErrors)<.08);
  }
  await page.screenshot({path:`${out}/framing-${width}x${height}.png`});
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;await page.screenshot({path:`${out}/framing-failure.png`}).catch(()=>{});throw e;}
finally{report.finished=new Date().toISOString();await writeFile(`${out}/browser-framing.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,cases:report.cases.length,error:report.error,errors:report.errors}));}
