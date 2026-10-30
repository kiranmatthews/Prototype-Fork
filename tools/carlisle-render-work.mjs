import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {installCarlisleRenderComparison} from './carlisle-render-comparison-scene.mjs';
assert.ok(process.argv.includes('--candidate'),'Experimental comparison only: see art/carlisle-shipyard/render-cost/README.md before applying the rejected candidate in an isolated checkout.');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484';
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point,CARLISLE_RELAY_STOPS:stops}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({channel:'chrome',headless:true}),report={method:'Isolated synchronous scene render plus gl.finish GPU fence, after compilation; all four combinations alternate in one process. These times are not gameplay FPS.',errors:[],views:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
  await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.setup=await page.evaluate(installCarlisleRenderComparison);
 for(const [id,index,center,offset]of [['arrival',0,point(25,2),[20,16,30]],['arrival-wide',0,point(80,8),[-75,95,105]],['beacon-apex',5,point(1170,42),[70,145,100]]]){
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},stops[index].p);await page.waitForFunction(()=>window.__game.player.grounded);
  const rows=await page.evaluate(({center,offset})=>{
   const g=window.__game,a=window.__renderComparison,c=g.camera.clone(),gl=g.renderer.getContext(),visible=g.player.group.visible,rows=[];
   c.position.set(...center.map((v,i)=>v+offset[i]));c.lookAt(...center);c.fov=52;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.player.group.visible=false;
   for(const entry of g.getLevel().carlisleShipyard.nets)entry.net.update(2);
   try{
    for(const state of ['prior','current','priorBatches','priorNets','priorNets','priorBatches','current','prior']){
     a.state(state);for(let i=0;i<5;i++){g.renderer.render(g.scene,c);gl.finish();}
     const times=[];for(let i=0;i<30;i++){const start=performance.now();g.renderer.render(g.scene,c);gl.finish();times.push(performance.now()-start);}
     times.sort((a,b)=>a-b);rows.push({state,samples:times.length,median:times[15],p95:times[28]});
    }
   }finally{a.state('current');g.player.group.visible=visible;}return rows;
  },{center,offset});report.views.push({id,rows});console.log(JSON.stringify({id,rows}));
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile('art/carlisle-shipyard/render-cost/render-work.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
