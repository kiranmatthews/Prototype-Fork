import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5277';
const out=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-seams';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=warehouse-reference${process.argv.includes('--full')?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='warehouse-reference'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const g=window.__game,THREE=await import('/node_modules/three/build/three.module.js');
  const source=await import('/src/levels/codex-lab.ts');g.player.step=()=>{};
  const camera=new THREE.PerspectiveCamera(55,1440/1000,.08,500),render=g.renderer.render.bind(g.renderer);
  g.renderer.render=(s,c)=>render(s,c===g.camera?camera:c);
  window.warehouseSurfaceView=({eye,target})=>{camera.position.fromArray(source.warehousePoint(...eye));camera.lookAt(...source.warehousePoint(...target));camera.updateMatrixWorld();};
 });
 const views=[
  {name:'halfpipe-end',eye:[388,165,2.6],target:[388,225,1.4]},
  {name:'halfpipe-end-oblique',eye:[302,180,3.2],target:[348,215,1.9]},
  {name:'loading-bay-side',eye:[275,185,1.8],target:[232,151,1.2]},
  {name:'roll-in-sides',eye:[279,224,2.6],target:[213,201,3.0]},
  {name:'kicker-sides',eye:[451,111,1.9],target:[452,68,.7]},
  {name:'taxi-side',eye:[522,250,1.3],target:[520,281,.6]},
  {name:'near-channel-end',eye:[287,293,2.5],target:[268,311,1.0]},
  {name:'rear-transition-end',eye:[430,340,2.3],target:[448,364,1.4]},
 ];
 for(const view of views){await page.evaluate(view=>window.warehouseSurfaceView(view),view);await page.waitForTimeout(350);await page.screenshot({path:`${out}/${view.name}.png`});}
 await writeFile(`${out}/surface-browser.json`,JSON.stringify({views,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({views:views.length,errors}));
}catch(e){await writeFile(`${out}/failure.json`,JSON.stringify({error:String(e),errors,url:page.url(),body:await page.locator('body').innerText().catch(()=>''),game:await page.evaluate(()=>({ready:!!window.__game,level:window.__game?.getCurrentLevel()?.id,blocked:window.__game?.gameFlow.blocksGameplay})).catch(()=>null)},null,2));await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}finally{await browser.close();}
