import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const full=process.argv.includes('--4k'),only=process.argv.find(a=>a.startsWith('--side='))?.slice(7);
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??join(tmpdir(),'drowned-catwalk-browser');
const viewport=full?{width:3840,height:2160}:{width:1440,height:900};
const source=(await readFile(new URL('./catwalk-pilot.mjs',import.meta.url),'utf8')).replace('export function* pirateCatwalkJourney','return function* pirateCatwalkJourney');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={mode:full?'4k':'lite',viewport,cases:[]};
try{
 for(const side of [-1,1].filter(side=>!only||only===(side<0?'port':'starboard'))){
  const name=side<0?'port':'starboard',errors=[],page=await browser.newPage({viewport,deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('crash',()=>errors.push('Page crashed'));
  await page.addInitScript(()=>{window.contextLosses=0;document.addEventListener('webglcontextlost',()=>window.contextLosses++,true);});
  if(full)await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
  try{
   await page.goto(`${base}?playtest&renderdiag&level=drowned-crown${full?'':'&lite'}`,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
   await page.evaluate(async({source,side})=>{
    const pilot=new Function(source)(),g=window.__game,p=g.player,l=g.getLevel();
    g.campaign.startEphemeral();await Promise.all([l.prepareJungleAssets(),l.prepareSurfaceImages(),p.preparePresentationAssets()]);
    // One initial placement. All route motion thereafter is ordinary input;
    // only the game's own bonus departure/return may change the scenic set.
    p.respawn(l,true,false,{position:p.pos.clone().set(1004,8.1,-124),heading:p.camDir.clone().set(0,0,-1)});
    const report=window.catwalkReview={side,stage:'approach',evidence:[],frame:0,done:false,failure:null,largestStep:0,bonusFailures:0,bonusFrames:0,bonusVisited:null,stamp:document.querySelector('.hud-build')?.textContent,tuning:JSON.stringify(g.TUNING)};
    window.catwalkParent=l;
    let iterator,next,last={},advanced=false;
    window.continueCatwalk=afterBonus=>{iterator=pilot({p,l,side,report,afterBonus});next=iterator.next();report.done=false;};
    window.continueCatwalk(false);
    const step=p.step.bind(p),commit=p.commitRenderStep.bind(p),origin=p.pos.clone(),bonusDeath=p.onBonusDeath;
    p.onBonusDeath=(...args)=>{report.bonusFailures++;return bonusDeath.apply(p,args);};
    p.step=(dt,input,level)=>{
     const parent=level===l;
     // Deliberately hop past the arrival edge; ordinary walking correctly
     // stops at its ledge guard.
     const sample=parent?(report.done?{}:next.value??{}):{moveX:-1};
     if(!parent){
      report.bonusVisited=g.getCurrentLevel().id;report.bonusFrames++;
      if(p.pos.x<-9&&p.grounded&&report.failureJumpStarted===undefined)report.failureJumpStarted=report.bonusFrames;
      if(report.failureJumpStarted!==undefined){const n=report.bonusFrames-report.failureJumpStarted;sample.jumpHeld=n<26;sample.jumpReleased=n===26;}
     }
     for(const key of ['moveX','moveY'])input[key]=sample[key]??0;
     const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
     input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
     for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[key]=sample[key]??false;input[key.replace('Held','Pressed')]=input[key]&&!last[key];}
     input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
     last={...sample};origin.copy(p.pos);advanced=parent&&!report.done;step(dt,input,level);
    };
    p.commitRenderStep=(...args)=>{
     commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.largestStep=Math.max(report.largestStep,p.pos.distanceTo(origin));
     try{next=iterator.next();if(next.done){report.done=true;report.result=next.value;report.parentState={cratesBroken:p.cratesBroken,deaths:p.totalDeaths};report.tuningUnchanged=report.tuning===JSON.stringify(g.TUNING);}}
     catch(error){report.failure=String(error);report.done=true;}
    };
   },{source,side});
   const waitPhase=async phase=>{
    let last='';
    for(let i=0;i<600;i++){
     await page.waitForTimeout(500);
     const state=await page.evaluate(()=>({done:window.catwalkReview.done,stage:window.catwalkReview.stage,frame:window.catwalkReview.frame,failure:window.catwalkReview.failure}));
     if(state.stage!==last){last=state.stage;console.log(JSON.stringify({name,phase,...state}));}
     assert.equal(state.failure,null);
     if(state.done)return;
    }
    throw Error(name+' '+phase+' timed out');
   };
   await waitPhase('entry');
   if(side<0){
    const parent=await page.evaluate(()=>window.catwalkReview.parentState);
    await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='bonus:drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:60000});
    if(full)await page.screenshot({path:join(out,'port-bonus.png')});
    await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:90000});
    const returned=await page.evaluate(()=>{const g=window.__game;return{sameParent:g.getLevel()===window.catwalkParent,position:g.player.pos.toArray(),deaths:g.player.totalDeaths,cratesBroken:g.player.cratesBroken,bonusFailures:window.catwalkReview.bonusFailures,bonusVisited:window.catwalkReview.bonusVisited};});
    assert.equal(returned.sameParent,true);assert.equal(returned.deaths,parent.deaths);assert.equal(returned.cratesBroken,parent.cratesBroken);assert.equal(returned.bonusFailures,1);assert.equal(returned.bonusVisited,'bonus:drowned-crown');
    assert.ok(Math.hypot(returned.position[0]-936,returned.position[2]+223)<.5);
    await page.evaluate(returned=>{window.catwalkReview.bonusReturn=returned;window.continueCatwalk(true);},returned);
    await waitPhase('return');
   }
   const row=await page.evaluate(()=>({review:window.catwalkReview,loading:window.__game.getLoadingDiagnostics(),contextLosses:window.contextLosses,resolution:JSON.parse(document.querySelector('#render-diagnostics').textContent)}));
   delete row.review.tuning;row.name=name;row.errors=errors;report.cases.push(row);
   assert.equal(row.review.result.phase,'complete');assert.equal(row.review.result.deaths,0);assert.equal(row.review.tuningUnchanged,true);assert.ok(row.review.largestStep<2.2);
   assert.equal(row.contextLosses,0);assert.deepEqual(row.loading.failed,[]);assert.deepEqual(row.loading.pending,[]);assert.deepEqual(errors,[]);
   if(full){assert.equal(row.resolution.settings.enabled,false);assert.deepEqual(row.resolution.drawingBuffer,viewport);}
   await page.screenshot({path:join(out,name+'-return.png')});
   console.log(JSON.stringify({name,pass:true,frames:row.review.frame,bonusFailures:row.review.bonusFailures,crystal:row.review.result.crystal,errors}));
  }catch(error){report.failure=String(error);report.failedCase=name;report.diagnostic=await page.evaluate(()=>({review:window.catwalkReview,level:window.__game?.getCurrentLevel()?.id,position:window.__game?.player.pos.toArray(),state:window.__game?.player.state})).catch(()=>null);throw error;}
  finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await page.close();}
 }
}finally{await browser.close();}
