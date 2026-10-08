// Real game, clean save, authored settings. Load/CPU timings include instrumentation.
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5340/';
const mode=process.env.AUDIT_MODE||'lite';
const output=process.env.AUDIT_OUTPUT||`/private/tmp/level-performance-${mode}`;
const ids=process.env.AUDIT_LEVELS?.split(',');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={base,mode,started:new Date().toISOString(),rows:[],errors:[],warnings:[]};
const save=()=>writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
try {
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 let current='startup';
 page.on('pageerror',e=>report.errors.push({level:current,message:String(e)}));
 page.on('console',m=>{if(m.type()==='error')report.errors.push({level:current,message:m.text()});if(m.type()==='warning')report.warnings.push({level:current,message:m.text()});});
 await page.goto(new URL(`?${mode==='lite'?'lite&':''}playtest&level=sky`,base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.catalog=await page.evaluate(()=>window.__game.levelList().map(e=>({id:e.id,name:e.name})));
 report.environment=await page.evaluate(()=>{const g=window.__game,gl=g.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {agent:navigator.userAgent,gpu:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null,quality:g.renderQualitySettings.snapshot(),crt:g.crtGuestSettings.value,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight]};});
 await page.evaluate(()=>{
  const g=window.__game,a=window.__levelAudit={phase:null,stats:{},long:[],phases:[],lastPhase:null};
  a.waitFrames=count=>new Promise(resolve=>{const step=()=>--count<=0?resolve():requestAnimationFrame(step);requestAnimationFrame(step);});
  a.wrap=(object,key,label=key)=>{const original=object?.[key];if(typeof original!=='function')return;object[key]=function(...args){if(!a.phase)return original.apply(this,args);const start=performance.now();try{return original.apply(this,args);}finally{const s=a.stats[label]??={ms:0,calls:0,maxMs:0};const ms=performance.now()-start;s.ms+=ms;s.calls++;s.maxMs=Math.max(s.maxMs,ms);}};};
  for(const key of ['step','applyRenderInterpolation','syncVisual','refreshCharacterBounds'])a.wrap(g.player,key,`player.${key}`);
  for(const key of ['update','updateSceneryView','buildEntry','buildCustom','installGroundAcceleration','buildSystemicSurfaceEdgeRails','rebuildCrateRails','reconcileCrateColumnGrounds','dispose'])a.wrap(Object.getPrototypeOf(g.getLevel()),key,`level.${key}`);
  a.wrap(g.renderer,'render','renderer.render');a.wrap(g.renderer.shadowMap,'render','renderer.shadows');a.wrap(g.ui,'setHUD','ui.setHUD');
  new PerformanceObserver(list=>{if(a.phase)for(const entry of list.getEntries())a.long.push({start:entry.startTime,ms:entry.duration});}).observe({entryTypes:['longtask']});
  const phase=()=>{const p=g.gameFlow.loadingPhase;if(p!==a.lastPhase){if(a.phase)a.phases.push({phase:p,at:performance.now()});a.lastPhase=p;}requestAnimationFrame(phase);};requestAnimationFrame(phase);
  a.summary=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,median:sorted[Math.floor(sorted.length*.5)]??null,p95:sorted[Math.floor(sorted.length*.95)]??null,max:sorted.at(-1)??null};};
 });
 for(const entry of report.catalog.filter(e=>!ids||ids.includes(e.id))){
  current=entry.id;
  const row={...entry};const errorAt=report.errors.length;
  try {
   row.load=await page.evaluate(async id=>{
    const g=window.__game,a=window.__levelAudit;a.stats={};a.long=[];a.phases=[];a.phase='load';const started=performance.now();let buildMs;
    await g.gameFlow.transition(()=>{const start=performance.now();if(!g.switchLevel(id))throw Error(`Failed load ${id}`);buildMs=performance.now()-start;g.gameFlow.hide();});
    a.phase=null;return {elapsedMs:performance.now()-started,buildMs,stats:a.stats,longTasks:a.long,phases:a.phases.map(p=>({...p,at:p.at-started})),assets:g.getLoadingDiagnostics()};
   },entry.id);
   row.spawn=await page.evaluate(async()=>{
    const g=window.__game,a=window.__levelAudit,l=g.getLevel();await a.waitFrames(30);
    const p=g.player;return {id:g.getCurrentLevel().id,position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,killY:l.killY,checkpointCount:l.checkpoints.length,groundMeshes:l.groundMeshes.length,walls:l.walls.length,rails:l.rails.length,crates:l.crates.length,hasGate:!!l.finishGlow,bonus:l.hudMode==='bonus',boss:!!l.boss,competition:!!g.getCompetition(),hub:l.hudMode==='hub',groundAcceleration:l.groundAccelerationStats};
   });
   row.play=await page.evaluate(async()=>{
    const g=window.__game,a=window.__levelAudit;a.stats={};a.long=[];a.phase='play';let last=0,frame=-1;const intervals=[],presented=[],draws=[];
    for(let i=0;i<90;i++){const time=await new Promise(requestAnimationFrame);if(last)intervals.push(time-last);if(frame!==g.frameStats.frame){if(last)presented.push(time-last);draws.push(g.getRenderFrameStats().calls);frame=g.frameStats.frame;}last=time;}
    a.phase=null;return {raf:a.summary(intervals),draws:a.summary(draws),stats:a.stats,longTasks:a.long,frame:g.frameStats,memory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,contextLost:g.renderer.getContext().isContextLost()};
   });
   if(mode==='full')await page.screenshot({path:`${output}/${entry.id}.png`});
   if(row.spawn.competition){
    await page.evaluate(()=>window.__game.competitionAction('start'));
    await page.waitForFunction(()=>window.__game.getCompetition()?.phase==='running',null,{timeout:15000});
   }
   if(!row.spawn.hub){
    const before=await page.evaluate(()=>window.__game.player.pos.toArray());
    const key=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),z=l.zoneAt(g.player.pos.x,g.player.pos.z);return l.hudMode==='bonus'||z?.dir==='E'?'ArrowRight':z?.dir==='W'?'ArrowLeft':'ArrowUp';});
    await page.keyboard.down(key);await page.waitForTimeout(300);await page.keyboard.up(key);
    row.movement=await page.evaluate(before=>{const p=window.__game.player;return {distance:Math.hypot(...p.pos.toArray().map((v,i)=>v-before[i])),position:p.pos.toArray(),state:p.state,grounded:p.grounded};},before);
    row.movement.key=key;
    assert.ok(row.movement.distance>.1,`${entry.id}: native directional input did not move the player`);
   }
   row.checkpoints=[];
   for(let i=0;i<row.spawn.checkpointCount;i++){
    row.checkpoints.push(await page.evaluate(async()=>{const g=window.__game,a=window.__levelAudit;const warped=g.player.warpCheckpoint(g.getLevel(),1);await a.waitFrames(25);return {warped,position:g.player.pos.toArray(),grounded:g.player.grounded,state:g.player.state,deaths:g.player.totalDeaths};}));
   }
   row.errors=report.errors.slice(errorAt);
   assert.equal(row.spawn.id,entry.id);assert.equal(row.play.contextLost,false);
   assert.ok(row.spawn.grounded||row.spawn.competition||row.spawn.hub,`${entry.id}: unsupported spawn`);
   assert.ok(row.checkpoints.every(cp=>cp.warped&&cp.grounded),`${entry.id}: unsupported checkpoint`);
   assert.deepEqual(row.load.assets.failed,[]);assert.deepEqual(row.errors,[]);
   console.log(`${report.rows.length+1}/${report.catalog.length} ${mode} ${entry.id}: load ${Math.round(row.load.elapsedMs)} ms (build ${Math.round(row.load.buildMs)}), frame p95 ${row.play.raf.p95?.toFixed(1)}, ${row.checkpoints.length} checkpoints, ${row.errors.length} errors`);
  } catch(error){row.failure=String(error);console.log(`FAILED ${entry.id}: ${error}`);}
  report.rows.push(row);await save();
 }
 report.completed=new Date().toISOString();await save();
 assert.ok(report.rows.every(row=>!row.failure),'See per-level failures in report.json');assert.deepEqual(report.errors,[]);
}finally{await save();await browser.close();}
