import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-fruit-collection';
await mkdir(out,{recursive:true});
const common=await readFile(new URL('../pirate-wreck-pilot.mjs',import.meta.url),'utf8');
const source=common.slice(0,common.indexOf(' yield* wait(30);'))+`
 yield* wait(30);check(p.grounded,'Spawn unsupported');
 yield* walk([-71.5,-6,193],'Collect along the first quay curve');
 yield* walk([-69.2,-6,181],'Collect along the second quay curve');
 yield* wait(120);
 return {state:p.state,deaths:p.totalDeaths,fruit:p.fruit,lives:p.lives,crates:p.cratesBroken,
  position:p.pos.toArray(),grounded:p.grounded,collected:l.pickups.flatMap((p,i)=>p.alive?[]:[i]),
  activeFlights:p.fruits.filter(f=>f.phase!=='off').map(f=>f.phase).sort()};
}`;
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],runs=[];
try{
 for(const mode of ['native','batched']){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(new URL('?playtest&lite&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets(),g.getLevel().prepareSurfaceImages()]);});
  await page.evaluate(({mode,source})=>{
   const g=window.__game,p=g.player,l=g.getLevel();
   if(!l.pickupVisualBatch)throw Error('Production batches missing');
   if(mode==='native'){l.pickupVisualBatch.dispose();l.pickupVisualBatch=null;}
   p.respawn(l,true,false,{position:p.pos.clone().set(-72,-5.88,205),heading:p.camDir.clone().set(0,0,-1)});
   const report=window.collectionReview={stage:'start',evidence:[],done:false,failure:null,frame:0};
   const journey=new Function(source.replace('export function* pirateJourney','return function* pirateJourney'))(),pilot=journey({p,l,report});
   let next=pilot.next(),last={},advanced=false;const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
   p.step=(dt,input,level)=>{if(report.done)return;const sample=next.value??{};
    for(const key of ['moveX','moveY'])input[key]=sample[key]??0;
    const length=Math.hypot(input.moveX,input.moveY);if(length>1){input.moveX/=length;input.moveY/=length;}
    input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
    for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[key]=sample[key]??false;input[key.replace('Held','Pressed')]=input[key]&&!last[key];}
    input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;last={...sample};step(dt,input,level);advanced=true;
   };
   p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
    try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;p.step=step;p.commitRenderStep=commit;}}
    catch(error){report.done=true;report.failure=String(error);}
   };
  },{mode,source});
  await page.waitForFunction(()=>window.collectionReview.done,null,{timeout:180000});
  const result=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),p=g.player,report=window.collectionReview;
   const before=l.pickupVisualBatch?.diagnostics??null;
   p.respawn(l,true,false);l.updateSceneryView(g.camera);
   return{...report,beforeRespawn:before,afterRespawn:l.pickupVisualBatch?.diagnostics??null,
    restoredPickups:l.pickups.every(p=>p.alive&&p.mesh.visible),glError:g.renderer.getContext().getError()};
  });
  assert.equal(result.failure,null);assert.ok(result.result.fruit>0);assert.ok(result.result.collected.length>0);assert.deepEqual(result.result.activeFlights,[]);
  assert.equal(result.result.deaths,0);assert.equal(result.restoredPickups,true);assert.equal(result.glError,0);
  if(mode==='batched')assert.equal(result.afterRespawn.visible,result.afterRespawn.capacity);
  runs.push({mode,...result});await context.close();
 }
 assert.equal(runs[0].frame,runs[1].frame);assert.deepEqual(runs[0].result,runs[1].result);assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({runs,exactNativeMatch:true,errors},null,2)+'\n');
 console.log(JSON.stringify({pass:true,frames:runs[1].frame,result:runs[1].result,afterRespawn:runs[1].afterRespawn,errors}));
}finally{await browser.close();}
