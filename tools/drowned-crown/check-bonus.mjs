// The production browser receives ordinary device samples from the same pilot
// as the native puzzle test. Source metadata supplies names/targets, never live
// geometry or collectible state. --detour also proves the real parent return.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'vite';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const full=process.argv.includes('--4k'),detour=process.argv.includes('--detour');
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??join(tmpdir(),'drowned-bonus-browser');
const viewport=full?{width:3840,height:2160}:{width:1440,height:900};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let course;
try{course=(await server.ssrLoadModule('/src/levels/themed-bonuses.ts')).THEMED_BONUS_COURSES.find(c=>c.id==='bonus-drowned-crown');}
finally{await server.close();}
const bundled=await build({stdin:{contents:"export {runThemedBonusJourney} from './tools/themed-bonus-pilot.mjs'; export {pirateCatwalkJourney} from './tools/drowned-crown/catwalk-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'DrownedBonusPilots',write:false});
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={mode:full?'4k':'lite',detour,viewport,views:[],errors:[]};
const page=await browser.newPage({viewport,deviceScaleFactor:1});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('crash',()=>report.errors.push('Page crashed'));
await page.addInitScript(()=>{window.bonusContextLosses=0;document.addEventListener('webglcontextlost',()=>window.bonusContextLosses++,true);});
if(full)await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
try{
 const id=detour?'drowned-crown':'bonus-drowned-crown';
 await page.goto(`${base}?playtest&renderdiag&level=${id}${full?'':'&lite'}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
 await page.addScriptTag({content:bundled.outputFiles[0].text});
 await page.evaluate(async({course,detour})=>{
  const g=window.__game,p=g.player,parent=g.getLevel();g.campaign.startEphemeral();
  await Promise.all([parent.prepareJungleAssets(),parent.prepareSurfaceImages(),p.preparePresentationAssets()]);
  if(detour)p.respawn(parent,true,false,{position:p.pos.clone().set(1004,8.1,-124),heading:p.camDir.clone().set(0,0,-1)});
  else p.respawn(parent,true);
  const review=window.bonusReview={stage:'start',frame:0,done:false,failure:null,actions:[],evidence:[],trace:[],parentFrames:0,tuning:JSON.stringify(g.TUNING),captured:[],hold:null};
  window.bonusParent=parent;
  const state=()=>({position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,lives:p.lives,fruit:p.fruit,crates:p.cratesBroken,bonusCrates:p.bonusCrates,gem:p.gemEarned});
  const ctx={id:course.id,p,l:parent,course,source:course.data,report:review,trace:review.trace,get frame(){return review.frame;}};
  let phase=detour?'parent':'bonus',iterator,next,last={},advanced=false;
  const startBonus=level=>{
   phase='bonus';ctx.l=level;review.bonusId=g.getCurrentLevel().id;
   const actual=JSON.parse(JSON.stringify(level.builtFromData));
   actual.components=actual.components.filter(c=>c.t!=='clock');
   review.sourceMatches=JSON.stringify(actual)===JSON.stringify(course.data);
   iterator=DrownedBonusPilots.runThemedBonusJourney(ctx);next=iterator.next();review.hold='arrival';review.captured.push('arrival');
  };
  if(detour){iterator=DrownedBonusPilots.pirateCatwalkJourney({p,l:parent,side:-1,report:review});next=iterator.next();}
  else startBonus(parent);
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(detour&&level!==parent&&phase==='parent')startBonus(level);
   const playing=!review.done&&!(phase==='parent'&&review.parentEnd);
   const sample=playing&&!review.hold?next.value??{}:{};
   for(const key of ['moveX','moveY'])input[key]=sample[key]??0;
   const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
   input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[key]=sample[key]??false;input[key.replace('Held','Pressed')]=sample[key.replace('Held','Pressed')]??(input[key]&&!last[key]);}
   input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.jumpCancelled=false;input.restartPressed=false;
   last={...sample};advanced=playing&&!review.hold;step(dt,input,level);
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced)return;advanced=false;
   if(phase==='parent')review.parentFrames++;else review.frame++;
   if(phase==='bonus'&&review.frame%24===0)review.trace.push({...state(),frame:review.frame});
   try{
    next=iterator.next();
    if(next.done){
     if(phase==='parent'){review.parentEnd=state();review.parentResult=next.value;}
     else{review.done=true;review.end=state();review.result=next.value;review.tuningUnchanged=review.tuning===JSON.stringify(g.TUNING);}
    }else if(phase==='bonus'&&p.grounded){
     for(const [name,needle] of [['upper-gallery','return-gallery edge'],['fuse-refuge','visible refuge'],['bridge','cross actual materialized bridge']])
      if(review.stage.includes(needle)&&!review.captured.includes(name)){review.hold=name;review.captured.push(name);break;}
    }
   }catch(error){review.failure=String(error);review.done=true;}
  };
 },{course,detour});
 let last='';
 for(let i=0;i<900;i++){
  await page.waitForTimeout(500);
  const state=await page.evaluate(()=>({done:window.bonusReview.done,stage:window.bonusReview.stage,frame:window.bonusReview.frame,hold:window.bonusReview.hold,failure:window.bonusReview.failure}));
  if(state.stage!==last){last=state.stage;console.log(JSON.stringify(state));}
  assert.equal(state.failure,null);
  if(state.hold){
   // Ordinary neutral input settles the actual gameplay camera. No camera,
   // crate, position or physics state is changed to stage these screenshots.
   await page.waitForTimeout(1200);
   await page.screenshot({path:join(out,state.hold+'.png')});
   report.views.push(await page.evaluate(name=>({name,position:window.__game.player.pos.toArray(),grounded:window.__game.player.grounded,render:window.__game.getRenderFrameStats(),memory:{...window.__game.renderer.info.memory}}),state.hold));
   await page.evaluate(()=>{window.bonusReview.hold=null;});
  }
  if(state.done)break;
 }
 report.review=await page.evaluate(()=>window.bonusReview);delete report.review.tuning;
 assert.equal(report.review.done,true);assert.equal(report.review.failure,null);assert.equal(report.review.sourceMatches,true,'Production bonus differs from source');
 assert.equal(report.review.result.state,'finished');assert.equal(report.review.result.cratesBroken,9);assert.equal(report.review.result.totalCrates,9);assert.equal(report.review.result.deaths,0);assert.equal(report.review.tuningUnchanged,true);
 if(detour){
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay&&!window.__game.getWarpArrival()&&window.__game.player.grounded,null,{timeout:90000});
  report.returned=await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{sameParent:l===window.bonusParent,position:p.pos.toArray(),grounded:p.grounded,deaths:p.totalDeaths,lives:p.lives,fruit:p.fruit,crates:p.cratesBroken,bonusCrates:p.bonusCrates,gem:p.gemEarned,completed:l.bonusRoundCompleted,spawn:l.currentSpawn.toArray()};});
  assert.equal(report.review.bonusId,'bonus:drowned-crown');assert.equal(report.returned.sameParent,true);assert.equal(report.returned.completed,true);assert.equal(report.returned.bonusCrates,9);assert.equal(report.returned.gem,false);
  assert.equal(report.returned.crates,report.review.parentEnd.crates);assert.equal(report.returned.deaths,report.review.parentEnd.deaths);assert.ok(Math.hypot(report.returned.position[0]-936,report.returned.position[2]+223)<.5);
  assert.ok(Math.hypot(report.returned.spawn[0]-936,report.returned.spawn[2]+223)<.5);
  await page.screenshot({path:join(out,'parent-return.png')});
 }else assert.equal(report.review.end.gem,true);
 Object.assign(report,await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,loading:window.__game.getLoadingDiagnostics(),contextLosses:window.bonusContextLosses,resolution:JSON.parse(document.querySelector('#render-diagnostics').textContent)})));
 assert.equal(report.contextLosses,0);assert.deepEqual(report.loading.failed,[]);assert.deepEqual(report.loading.pending,[]);assert.deepEqual(report.errors,[]);
 if(full){assert.equal(report.resolution.settings.enabled,false);assert.deepEqual(report.resolution.drawingBuffer,viewport);assert.equal(report.resolution.presentation.inputWidth,viewport.width);assert.equal(report.resolution.presentation.inputHeight,viewport.height);}
 report.pass=true;console.log(JSON.stringify({pass:true,detour,mode:report.mode,frames:report.review.frame,parentFrames:report.review.parentFrames,boxes:report.review.result.cratesBroken,returned:report.returned,errors:report.errors}));
}catch(error){report.failure=String(error);report.diagnostic=await page.evaluate(()=>({review:window.bonusReview,level:window.__game?.getCurrentLevel()?.id,position:window.__game?.player.pos.toArray()})).catch(()=>null);throw error;}
finally{await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
