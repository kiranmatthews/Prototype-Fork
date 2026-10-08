import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {assertAfterHoursMountedEvidence} from './test-nightworks-challenge-structure.mjs';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(value=>/^http/.test(value))||'http://127.0.0.1:5228';
const full=process.argv.includes('--full'),mode=full?'full':'lite';
const output=process.env.NIGHTWORKS_REVIEW_OUTPUT||'/private/tmp/nightworks-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],captures=[];
page.on('pageerror',error=>errors.push({type:'pageerror',message:error.message}));
page.on('console',message=>{if(message.type()==='error')errors.push({type:'console',message:message.text()});});
try {
 await page.goto(`${base}/?playtest&level=nightworks-after-hours${full?'':'&lite'}`);
 // Install the controller while the ordinary startup loader owns gameplay,
 // so the run begins at the first simulation tick rather than after imports.
 await page.waitForFunction(()=>window.__game,null,{timeout:90000});
 await page.evaluate(async()=>{
  const g=window.__game;
  await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets()]);
 });
 await page.screenshot({path:`${output}/entrance-${mode}.png`});
 await page.evaluate(async()=>{
  const g=window.__game,p=g.player,l=g.getLevel();
  const authored=await import('/src/levels/nightworks-after-hours.ts');
  const {vertRampSpine}=await import('/src/level.ts'),{CONST}=await import('/src/tuning.ts');
  const {createAfterHoursPilot}=await import('/tools/nightworks-pilot.mjs');
  const components=authored.NIGHTWORKS_AFTER_HOURS_LEVEL.components;
  const source={...authored,AFTER_HOURS_CUTBACK_PATH:vertRampSpine(components.find(c=>c.nm==='Four quarry cutbacks')).map(point=>[point.x,point.y,point.z])};
  const pilot=createAfterHoursPilot(source,{tuning:g.TUNING,fixedStep:CONST.fixedStep});
  if(g.frameStats.totalFixedSteps!==0||l.time!==0)throw Error('Install the pilot before the first gameplay tick');
  // The sole placement starts the complete journey. Native movement, level
  // updates, camera, animation and rendering remain in the normal game loop.
  p.respawn(l,true);
  const held=['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'];
  const inputFields=['moveX','moveY',...held,'jumpPressed','jumpReleased','jumpCancelled','grindPressed','spinPressed','grabPressed','transferPressed','restartPressed'];
  let last={},pending=null,previous=null;
  const seen=new Set();
  const report=window.afterHoursReview={frame:0,done:false,failed:null,evidence:pilot.evidence,end:null,trace:[],actions:[],pendingActions:[],
   currentChapter:source.AFTER_HOURS_STAGES[0].id,tuning:JSON.stringify(g.TUNING),initialWorldTime:l.time,
   stages:source.AFTER_HOURS_STAGES,components};
  const componentOf=object=>{for(let node=object;node;node=node.parent)if(Number.isInteger(node.userData?.editorIdx))return node.userData.editorIdx;return null;};
  const snap=input=>({frame:report.frame,worldTime:l.time,chapter:pending?.chapter??report.currentChapter,input,
   position:p.pos.toArray(),heading:p.axisF.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,verticalSpeed:p.vVel,
   boardRolling:p.boardRolling,bailing:p.isBailing,deaths:p.totalDeaths,
   impact:p.isBailing?p.worldImpactDiagnostics:null,
   supportComponent:p.grounded?componentOf(p.groundHit?.mesh):null,
   railComponent:p.state==='grind'?componentOf(p.grindRail?.object):null,
   cameraPosition:g.camera.position.toArray(),cameraDirection:p.camDir.toArray()});
  const action=(name,row)=>{
   if(seen.has(name))return;seen.add(name);
   const item={name,frame:row.frame,chapter:row.chapter,state:row.state,position:[...row.position],supportComponent:row.supportComponent,railComponent:row.railComponent};
   report.actions.push(item);report.pendingActions.push(item);
  };
  const recordActions=row=>{
   const ground=components[row.supportComponent],rail=components[row.railComponent];
   const before=components[previous?.supportComponent],beforeRail=components[previous?.railComponent];
   if(row.input.jumpReleased&&row.state==='air'){
    if(row.chapter==='freight')action(`freight-aim-${report.actions.filter(a=>a.name.startsWith('freight-aim')).length+1}`,row);
    if(row.chapter==='rail-ferry'&&beforeRail?.t==='rail')action('counterweight-handoff',row);
    if(row.chapter==='crown')action(`crown-launch-${report.actions.filter(a=>a.name.startsWith('crown-launch')).length+1}`,row);
    if(row.chapter==='last-shift'&&beforeRail?.grp===8)action('final-ridge-exit',row);
   }
   if(ground?.t==='mover'&&ground.grp===2)action(`moving-catch-${row.supportComponent}`,row);
   if(ground?.t==='vertramp'&&ground.grp===3){
    if(p.axisF.x>.5)action('cutback-east-carve',row);
    if(p.axisF.x<-.5)action('cutback-return-carve',row);
   }
   if(ground?.t==='phasepad'&&ground.grp===4)action(`phase-catch-${ground.p[2]}`,row);
   if(rail?.grp===5)action(`counterweight-ridge-${row.railComponent}`,row);
   if(ground?.grp===6&&ground.t==='ramp'){
    for(const stack of components.filter(c=>c.grp===6&&c.nm==='Workbay quarry obstruction'))
     if(Math.abs(p.pos.z-stack.p[2])<stack.s[2]/2&&Math.abs(p.pos.x-stack.p[0])>stack.s[0]/2)action(`workbay-opening-${stack.p[2]}`,row);
   }
   if(ground?.t==='phasepad'&&ground.grp===8)action('final-phase-catch',row);
   if(rail?.grp===8)action('final-moving-ridge-catch',row);
   if(row.state==='finished')action('finish-gate',row);
  };
  const realStep=p.step.bind(p),realCommit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return;
   try {
    const sample=pilot.sample(p,l),next={moveX:0,moveY:0,jumpCancelled:false,restartPressed:false};
    for(const key of held)next[key]=false;Object.assign(next,sample);
    const length=Math.hypot(next.moveX,next.moveY);if(length>1){next.moveX/=length;next.moveY/=length;}
    next.moveX=Math.round(next.moveX*100)/100;next.moveY=Math.round(next.moveY*100)/100;
    for(const key of held){next[key]=!!next[key];const pressed=key.replace('Held','Pressed');if(!(pressed in sample))next[pressed]=next[key]&&!last[key];}
    if(!('jumpReleased' in sample))next.jumpReleased=!next.jumpHeld&&!!last.jumpHeld;
    Object.assign(input,next);last={...next};
    pending={input:Object.fromEntries(inputFields.map(key=>[key,input[key]])),chapter:source.AFTER_HOURS_STAGES[pilot.stage].id};
    realStep(dt,input,level);
   }catch(error){report.failed={reason:'native step exception',message:error.message};report.done=true;throw error;}
  };
  p.commitRenderStep=(...args)=>{
   realCommit(...args);if(!pending||report.done)return;
   report.frame++;const row=snap(pending.input);report.trace.push(row);recordActions(row);
   pilot.observe(p,l);report.end=row;report.currentChapter=source.AFTER_HOURS_STAGES[pilot.stage].id;
   previous=row;pending=null;
   if(pilot.evidence.footFrames>0&&p.state!=='finished'){report.failed={reason:'dismount after push-off',...row};report.done=true;}
   if(p.isBailing||['dead','gameover'].includes(p.state)){report.failed={reason:'bail or death',...row};report.done=true;}
   if(p.state==='finished'){report.done=true;report.finalTuning=JSON.stringify(g.TUNING);}
   if(report.frame>=18000){report.failed={reason:'fixed-step budget exhausted',...row};report.done=true;}
  };
 });
 const deadline=Date.now()+15*60_000;let complete=false,lastChapter=null;
 while(Date.now()<deadline){
  await page.waitForTimeout(150);
  const progress=await page.evaluate(()=>({done:window.afterHoursReview.done,frame:window.afterHoursReview.frame,chapter:window.afterHoursReview.currentChapter,actions:window.afterHoursReview.pendingActions.splice(0)}));
  if(progress.chapter!==lastChapter){console.log(`${mode}: ${progress.chapter} at fixed tick ${progress.frame}`);lastChapter=progress.chapter;}
  for(const action of progress.actions){
   const path=`${output}/${action.name}-${mode}.png`;
   const capturedAt=await page.evaluate(()=>({frame:window.afterHoursReview.frame,position:window.__game.player.pos.toArray(),state:window.__game.player.state,cameraPosition:window.__game.camera.position.toArray()}));
   await page.screenshot({path});captures.push({...action,capturedAt,path});
  }
  if(progress.done){complete=true;break;}
 }
 const report=await page.evaluate(async()=>{
  const l=window.__game.getLevel();await l.prepareJungleAssets();return {review:window.afterHoursReview,stamp:document.querySelector('.hud-build')?.textContent,
   assets:{rocks:l.nightworksRocks?.diagnostics,scenery:l.jungleAssetDiagnostics,enemies:l.enemies.map(e=>({kind:e.kind,...e.visual.diagnostics}))}};
 });
 await page.screenshot({path:`${output}/finish-${mode}.png`});
 await writeFile(`${output}/route-${mode}.json`,JSON.stringify({...report,errors,captures},null,2));
 assert.ok(complete,`browser wall-clock limit: ${JSON.stringify(report.review.end)}`);
 assert.equal(report.review.failed,null,JSON.stringify({failed:report.review.failed,chapters:report.review.evidence.chapters}));
 assert.equal(report.review.end.state,'finished');assert.equal(report.review.evidence.finished,true);
 assertAfterHoursMountedEvidence({trace:report.review.trace,chapters:report.review.evidence.chapters},report.review.stages,report.review.components);
 assert.equal(report.review.evidence.footFrames,0);assert.equal(report.review.tuning,report.review.finalTuning);
 assert.ok(report.review.evidence.checkpoints.length>0,'the full run banks an authored checkpoint');
 assert.ok(report.assets.rocks.models>0);assert.equal(report.assets.rocks.ready,report.assets.rocks.models);assert.deepEqual(report.assets.rocks.errors,[]);
 if(report.assets.scenery){assert.deepEqual(report.assets.scenery.errors,[]);assert.equal(report.assets.scenery.pendingCells,0);}
 assert.equal(report.assets.enemies.length,report.review.components.filter(c=>c.t==='enemy').length);
 assert.ok(report.assets.enemies.every(e=>e.status==='ready'&&e.appearance==='nightworks'));
 assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 console.log(`PASS native ${mode} browser: eight chapters, actual required challenge contacts, ${report.review.frame} fixed ticks, continuously mounted; ${report.assets.rocks.ready} rock assets and ${report.assets.enemies.length} goblins ready, clean console.`);
 // Original Nightworks still uses the same prepared enemy asset family.
 await page.goto(`${base}/?playtest&level=dark${full?'':'&lite'}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 const original=await page.evaluate(async()=>{const l=window.__game.getLevel();await l.prepareJungleAssets();const {NIGHTWORKS_LEVEL}=await import('/src/levels/nightworks.ts');return {expectedEnemies:NIGHTWORKS_LEVEL.components.filter(c=>c.t==='enemy').length,rocks:l.nightworksRocks?.diagnostics,scenery:l.jungleAssetDiagnostics,enemies:l.enemies.map(e=>({kind:e.kind,...e.visual.diagnostics}))};});
 await page.screenshot({path:`${output}/original-${mode}.png`});
 await writeFile(`${output}/original-${mode}.json`,JSON.stringify({assets:original,errors},null,2));
 assert.equal(original.enemies.length,original.expectedEnemies);assert.ok(original.enemies.every(e=>e.status==='ready'&&e.appearance==='nightworks'));
 assert.equal(original.rocks.ready,original.rocks.models);assert.deepEqual(original.rocks.errors,[]);assert.deepEqual(errors,[]);
 if(original.scenery){assert.deepEqual(original.scenery.errors,[]);assert.equal(original.scenery.pendingCells,0);}
 console.log(`PASS original Nightworks ${mode}: ${original.rocks.ready} rock assets and ${original.expectedEnemies} themed goblins ready, clean console.`);
} finally {await browser.close();}
