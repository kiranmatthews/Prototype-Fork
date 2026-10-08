// Alternating real-browser comparisons. Preserve source/render settings and
// the authored loader dwell; measure level construction separately from it.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [before,after]=process.argv.slice(2);
if(!before||!after)throw Error('Usage: node tools/benchmark-level-loading.mjs <before-url> <after-url>');
const output=process.env.LOADING_OUTPUT||'/private/tmp/level-loading-paired';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[],errors=[];
try{
 for(let round=0;round<3;round++)for(const variant of round%2?['after','before']:['before','after']){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  await context.addInitScript(()=>{
   window.__loadingWork={active:false,work:{},phases:[],last:null};
   for(const key of ['createTexture','createBuffer','compileShader','linkProgram']){
    const proto=WebGL2RenderingContext.prototype,original=proto[key];
    proto[key]=function(...args){const a=window.__loadingWork,g=window.__game;if(a.active&&g){const phase=g.gameFlow.loadingPhase||'play',row=a.work[phase]??={};row[key]=(row[key]||0)+1;}return original.apply(this,args);};
   }
   const tick=()=>{const a=window.__loadingWork,g=window.__game;if(a.active&&g){const phase=g.gameFlow.loadingPhase;if(phase!==a.last){a.phases.push({phase,at:performance.now()});a.last=phase;}}requestAnimationFrame(tick);};requestAnimationFrame(tick);
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push({variant,round,message:String(error)}));
  page.on('console',message=>{if(message.type()==='error')errors.push({variant,round,message:message.text()});});
  await page.goto(new URL('?playtest&level=sky',variant==='before'?before:after).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  for(const id of ['treehouse-trail','dark','nightworks-after-hours']){
   const row=await page.evaluate(async id=>{
    const g=window.__game,a=window.__loadingWork;
    a.work={};a.phases=[];a.last=null;a.active=true;
    const start=performance.now();let buildMs=0;
    await g.gameFlow.transition(()=>{const build=performance.now();if(!g.switchLevel(id))throw Error(`Cannot load ${id}`);buildMs=performance.now()-build;g.gameFlow.hide();});
    const loadMs=performance.now()-start;
    const frames=[];let previous=0;
    for(let i=0;i<60;i++){const time=await new Promise(requestAnimationFrame);if(previous)frames.push(time-previous);previous=time;}
    a.active=false;const l=g.getLevel();
    return {id,buildMs,loadMs,frames,work:a.work,phases:a.phases.map(p=>({...p,at:p.at-start})),rocks:l.nightworksRocks?.diagnostics??null,memory:{...g.renderer.info.memory},assets:g.getLoadingDiagnostics(),position:g.player.pos.toArray(),grounded:g.player.grounded,contextLost:g.renderer.getContext().isContextLost()};
   },id);
   assert.equal(row.contextLost,false);assert.equal(row.grounded,true);assert.deepEqual(row.assets.failed,[]);
   rows.push({variant,round,...row});console.log(`${variant} ${round+1} ${id}: build ${Math.round(row.buildMs)} ms, load ${Math.round(row.loadMs)} ms`);
   await writeFile(`${output}/report.json`,JSON.stringify({before,after,rows,errors},null,2));
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${output}/report.json`,JSON.stringify({before,after,rows,errors},null,2));await browser.close();}
