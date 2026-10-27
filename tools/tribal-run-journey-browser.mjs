// A continuous playthrough in Chrome's normal game loop. The shared pilot only
// supplies device samples; it cannot move the player or edit physics state.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TRIBAL_URL||'http://127.0.0.1:5247/';
const detour=process.argv.includes('--detour'),bonus=process.argv.includes('--bonus')||detour,lite=process.argv.includes('--lite'),upper=process.argv.includes('--upper');
const variants=process.argv.includes('--variants'),selected=process.env.TRIBAL_CASE;
const phase=process.env.TRIBAL_PHASE||'all';
const id=bonus&&!detour?'bonus-tribal-run':'tribal-run',out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/greybox/evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[],failed=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ABORTED'))failed.push({url:r.url(),error:r.failure()});});
const name=`${id}-${lite?'lite':'full'}${upper?'-upper':''}${phase!=='all'?'-'+phase:''}${detour?'-bonus-detour':''}${variants?'-variants'+(selected?'-'+selected:''):''}-journey`;
let row;
try{
 await page.goto(new URL(`?playtest&level=${id}&frameprobe&renderdiag${lite?'&lite':''}`,base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
 if(process.argv.includes('--native'))await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
 if(detour){
  await page.evaluate(async()=>{
   const g=window.__game,p=g.player,l=g.getLevel(),m=await import('/src/levels/tribal-run.ts');
   const point=m.tribalPoint(983,.12,7.5),dir=m.tribalTangent(983);
   p.respawn(l,true,false,{position:p.pos.clone().set(...point),heading:p.pos.clone().set(...dir)});
   window.tribalParent={level:l,entrySetup:{station:983,point,scope:'initial approach placement; entry itself uses keyboard jump'},before:p.captureRunState()};
  });
  await page.waitForTimeout(500);await page.keyboard.down('Space');await page.waitForTimeout(550);await page.keyboard.up('Space');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>{
   const g=window.__game,d=g.getLevel().bonusPlatformDiagnostics;
   return g.getCurrentLevel().id==='bonus:tribal-run'||!!d&&Math.hypot(g.player.pos.x-d.x,g.player.pos.z-d.z)<.7;
  },null,{timeout:5000});
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='bonus:tribal-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  console.log(JSON.stringify({event:'entered Resonance Vault through the authored jump platform'}));
 }
 await page.evaluate(async({bonus,upper,id,detour,variants,selected,phase})=>{
  const g=window.__game,p=g.player,l=g.getLevel();
  const m=await import(bonus?'/src/levels/tribal-run-bonus.ts':'/src/levels/tribal-run.ts');
  const pilot=await import(variants?'/tools/tribal-run-variants-pilot.mjs':bonus?'/tools/tribal-run-bonus-pilot.mjs':'/tools/tribal-run-pilot.mjs');
  if(!detour)p.respawn(l,true);
  const station={basins:515,loom:902,stair:1405,finale:1650}[phase];
  if(!bonus&&station!==undefined){
   const point=m.tribalPoint(station,(phase==='finale'?-1:0)+.12),heading=m.tribalTangent(station);
   p.respawn(l,true,false,{position:p.pos.clone().set(...point),heading:p.pos.clone().set(...heading)});
  }
  const source=bonus?m.TRIBAL_RUN_BONUS_LEVEL:m.TRIBAL_RUN_LEVEL;
  const sourceSha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(source))))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const report=window.tribalJourney={id,phase,initialStation:station,sourceSha256,stage:'spawn',frame:0,done:false,failed:null,actions:[],evidence:[],trace:[],tuning:JSON.stringify(g.TUNING),raf:[]};
  const r={p,l,sourceModule:m,source,report,get frame(){return report.frame;}};
  const generator=variants?pilot.runTribalVariants(r,{selected}):bonus?pilot.runTribalBonus(r):pilot.runTribalJourney(r,{upper,phase});
  let next=generator.next(),last={},advanced=false;
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  const snapshot=()=>({frame:report.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,bailing:p.isBailing,deaths:p.totalDeaths,lives:p.lives,
   speed:p.speed,verticalSpeed:p.vVel,crates:p.cratesBroken,crystal:p.hasCrystal,gem:p.gemEarned,camera:g.camera.position.toArray(),progress:m.tribalProgress?.(p.pos)});
  p.step=(dt,input,level)=>{
   if(report.done)return step(dt,input,level);
   const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
   const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
   input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
    input[held]=sample[held]??false;const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!last[held]);
   }
   input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.jumpCancelled=false;input.restartPressed=false;
   last={...sample};step(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   if(report.frame%6===0)report.trace.push(snapshot());
   try{next=generator.next();if(next.done){report.done=true;report.result=next.value;report.end=snapshot();report.finalTuning=JSON.stringify(g.TUNING);}}
   catch(error){report.done=true;report.failed=String(error);report.end=snapshot();}
  };
  let previous=0;const frame=time=>{if(report.done)return;if(previous)report.raf.push(time-previous);previous=time;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 },{bonus,upper,id,detour,variants,selected,phase});
 const started=Date.now();let status,lastStage='';const captured=new Set();
 const views=new Set(['skate to 173','walk to 310.3','skate to 673','walk to 914.3','skate to 1159','skate to 1242','skate to 1405','walk to 1421.3','skate to 2048','hop to 2074.1',
  'first listening takeoff','steer the drum bounce onto the echo gallery','cross the breakaway gallery lip','echo stepping-stone takeoff']);
 do{
  await page.waitForTimeout(1000);
  status=await page.evaluate(()=>({done:window.tribalJourney.done,stage:window.tribalJourney.stage,frame:window.tribalJourney.frame}));
  if(status.stage!==lastStage){console.log(JSON.stringify(status));lastStage=status.stage;}
  if(views.has(status.stage)&&!captured.has(status.stage)){
   captured.add(status.stage);await page.screenshot({path:`${out}/${name}-${status.stage.replaceAll(' ','-')}.png`});
  }
 }while(!status.done&&Date.now()-started<900000);
 row=await page.evaluate(()=>({journey:window.tribalJourney,stamp:document.querySelector('.hud-build')?.textContent,
  quality:window.__game.renderQualitySettings.snapshot(),sizes:window.__game.getRenderQualitySizes(),drawingBuffer:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height],render:window.__game.getRenderFrameStats(),
  contextLost:window.__game.renderer.getContext().isContextLost()}));
 row.errors=errors;row.failedRequests=failed;
 assert.equal(row.journey.done,true);assert.equal(row.journey.failed,null);
 if(variants)assert.ok(row.journey.result.scenarios.every(s=>s.pass));
 else{
  assert.equal(row.journey.end.state,bonus||['all','finale'].includes(phase)?'finished':'ride');assert.equal(row.journey.end.deaths,0);
  assert.ok(row.journey.trace.every(f=>!f.bailing&&!['dead','gameover'].includes(f.state)),'the continuous browser trace contains a failure');
  if(bonus){assert.equal(row.journey.result.cratesBroken,20);assert.equal(row.journey.end.gem,!detour);}
  else if(['all','finale'].includes(phase))assert.equal(row.journey.end.crystal,true);
 }
 assert.equal(row.journey.finalTuning,row.journey.tuning);assert.equal(row.contextLost,false);assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 if(detour){
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='tribal-run'&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
  await page.waitForTimeout(600);
  row.detour=await page.evaluate(()=>{
   const g=window.__game,p=g.player,l=g.getLevel(),parent=window.tribalParent;
   return{entrySetup:parent.entrySetup,sameParent:l===parent.level,before:parent.before,after:p.captureRunState(),position:p.pos.toArray(),
    expectedReturn:l.bonusReturnPoint().toArray(),bonusCompleted:l.bonusRoundCompleted,state:p.state,grounded:p.grounded};
  });
  assert.equal(row.detour.sameParent,true);assert.equal(row.detour.bonusCompleted,true);assert.equal(row.detour.after.bonusCrates,20);
  assert.equal(row.detour.after.cratesBroken,row.detour.before.cratesBroken);assert.equal(row.detour.state,'ride');
  assert.ok(Math.hypot(...row.detour.position.map((v,i)=>v-row.detour.expectedReturn[i]))<.3,'bonus returns onto the authored court landing');
 }
 console.log(JSON.stringify({pass:true,result:row.journey.result,frame:row.journey.frame,stamp:row.stamp}));
}catch(error){console.error(error);if(row)row.error=error.message;else row={error:error.message,errors,failedRequests:failed};throw error;}
finally{
 await page.screenshot({path:`${out}/${name}.png`}).catch(()=>{});
 await writeFile(`${out}/${name}.json`,JSON.stringify(row,null,2));await browser.close();
}
