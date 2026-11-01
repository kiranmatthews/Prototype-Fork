import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {airCargoPilot} from './carlisle-air-cargo-pilot.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483';
const modes=process.argv.includes('--lite')?[true]:process.argv.includes('--full')?[false]:[true,false];
const out=process.env.AIR_CARGO_OUT??'/private/tmp/carlisle-air-cargo-browser';await mkdir(out,{recursive:true});
const report={base,errors:[],runs:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const lite of modes){
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.addInitScript(()=>{navigator.getGamepads=()=>[];});
  console.log(`Loading ${lite?'lite':'full'} crate-chain review`);
  await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
  console.log('Page loaded',await page.title());
  try{await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});}
  catch(error){console.log('Startup state',await page.evaluate(()=>({game:!!window.__game,flow:window.__game?.gameFlow?.snapshot,body:document.body.innerText.slice(0,2500)})));await page.screenshot({path:out+'/startup.png'});throw error;}
  console.log('Game ready; loading presentation assets');
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  const source=await page.evaluate(async()=>{
   const g=window.__game,p=g.player,l=g.getLevel();g.campaign.startEphemeral();
   g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
   await Promise.all([l.prepareJungleAssets(),p.preparePresentationAssets()]);
   const q=window.__cargoReview={budget:0,tick:false,contacts:[]};
   const step=p.step.bind(p),update=l.update.bind(l),consume=g.input.consumeEdges.bind(g.input),snap=p.snapFeetToCrateLid.bind(p);
   g.input.consumeEdges=()=>{};
   p.step=(dt,input,level)=>{if(q.budget<=0)return;step(dt,input,level);consume();q.budget--;q.tick=true;};
   l.update=dt=>{if(q.tick){update(dt);q.tick=false;}};
   const crates=g.getCurrentLevel().data.components.filter(c=>c.t==='crate');
   p.snapFeetToCrateLid=c=>{q.contacts.push(crates[l.crates.indexOf(c)]?.nm);return snap(c);};
   q.reset=name=>{
    const c=g.getCurrentLevel().data.components.find(c=>c.nm===name&&(c.t==='trampoline'||c.t==='mover'));
    const m=c.t==='mover'?l.movers.find(m=>m.mesh.name===name):null;
    const at=m?m.mesh.position.clone().add(p.pos.clone().set(0,c.s[1]/2+.15,0)):p.pos.clone().set(c.p[0],c.p[1]+.15,c.p[2]);
    p.respawn(l,true,false,{position:at,heading:p.pos.clone().set(0,0,-1)});p.totalDeaths=0;p.freeSkate=false;p.speed=0;p.masks=0;
    q.contacts=[];p.commitRenderStep(l);p.collapseRenderInterpolation();
   };
   return g.getCurrentLevel().data.components.filter(c=>c.nm?.startsWith('Air cargo · ')).map(c=>({name:c.nm,p:c.p}));
  });
  console.log('Presentation ready; verifying source and keyboard chains');
  const expected=api.CARLISLE_TIDAL_RELAY_LEVEL.components.filter(c=>c.nm?.startsWith('Air cargo · '));
  assert.equal(source.length,expected.length);
  for(let i=0;i<source.length;i++){assert.equal(source[i].name,expected[i].nm);assert.ok(Math.hypot(...source[i].p.map((v,k)=>v-expected[i].p[k]))<1e-7,'stale crate placement');}
  const keys=new Set();
  const press=async input=>{
   const next=new Set();if(input.jumpHeld)next.add('Space');if(input.moveY)next.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.moveX)next.add(input.moveX>0?'ArrowRight':'ArrowLeft');
   for(const key of [...keys])if(!next.has(key)){await page.keyboard.up(key);keys.delete(key);}
   for(const key of next)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}
  };
  const observe=()=>page.evaluate(()=>{
   const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;
   return {at:p.pos.toArray(),forward:[f.x,0,f.z],side:[-f.z,0,f.x],spring:p.trampolineAir,vy:p.vVel,
    grounded:p.grounded,state:p.state,deaths:p.totalDeaths,bail:p.isBailing,broken:p.cratesBroken,contacts:[...window.__cargoReview.contacts]};
  });
  const advance=async count=>{
   await page.evaluate(n=>window.__cargoReview.budget=n,count);
   await page.waitForFunction(()=>window.__cargoReview.budget===0,null,{polling:10,timeout:60000});
   return observe();
  };
  const flights=[];
  const names=process.argv.includes('--views-only')?[]:lite?['Lift parcel cloud','Socket starboard gap']:['Beacon hanging steps','Storm crosswind row','Rigging port gap'];
  for(const encounter of api.CARLISLE_RELAY_AIR_CARGO.filter(e=>names.includes(e.name))){
   console.log(`Playing ${encounter.name}`);
   await press({});await page.evaluate(name=>window.__cargoReview.reset(name),encounter.jump);
   const jump=api.CARLISLE_RELAY_JUMPS.find(j=>j.name===encounter.jump),target=api.carlislePoint(...jump.to);
   const pilot=airCargoPilot(encounter,target,{sideDeadzone:.35});let current=await observe(),launched=false,landed=false,frames=0,shot=false;
   while(frames<950){
    const previous=current,wasLaunched=launched;await press(pilot(current));const count=launched?3:1;current=await advance(count);frames+=count;
    if(current.spring&&current.vy>15)launched=true;
    if(current.deaths||current.bail)break;
    if(wasLaunched&&(current.grounded||previous.vy<0&&current.vy>15)){landed=true;break;}
    if(!lite&&!shot&&current.contacts.some(n=>encounter.landings[1].names.includes(n))){
     shot=true;await page.screenshot({path:`${out}/${encounter.name.toLowerCase().replaceAll(' ','-')}-bounce-native.png`});
    }
   }
   await press({});const stomped=encounter.landings.map(l=>l.names.some(n=>current.contacts.includes(n)));
   const row={name:encounter.name,launched,landed,frames,stomped,distance:Math.hypot(...current.at.map((v,k)=>v-target[k])),end:current};
   flights.push(row);console.log(JSON.stringify({...row,end:undefined}));
   assert.ok(landed&&!current.deaths&&!current.bail&&row.distance<15,JSON.stringify(row));
   assert.ok(stomped.every(Boolean),'keyboard route missed a crate-to-crate landing');
  }
  if(!lite){
   const encounter=api.CARLISLE_RELAY_AIR_CARGO.find(e=>e.name==='Storm crosswind row');
   await page.evaluate(e=>{
    const g=window.__game,p=g.player,V=p.pos.constructor,center=new V(...e.landings[2].center);
    p.respawn(g.getLevel(),true,false,{position:new V(...e.landings[0].center)});p.pos.y+=8;p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=0;
    p.commitRenderStep(g.getLevel());p.collapseRenderInterpolation();p.group.visible=false;
    g.getLevel().playerPos.copy(p.pos);window.__cargoReview.tick=true;g.getLevel().update(0);
    const render=g.renderer.render.bind(g.renderer);
    g.renderer.render=(...args)=>{if(args[1]===g.camera){g.camera.position.copy(center).add(new V(21,12,19));g.camera.fov=48;g.camera.lookAt(center);g.camera.updateProjectionMatrix();}return render(...args);};
   },encounter);
   await page.waitForTimeout(150);await page.screenshot({path:out+'/storm-chain-native.png'});
   assert.deepEqual(await page.evaluate(()=>{const c=window.__game.renderer.domElement;return[c.width,c.height];}),[1920,1080]);
   await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
   await page.waitForTimeout(150);await page.screenshot({path:out+'/storm-chain-normal.png'});
  }
  report.runs.push({lite,stamp,flights});await page.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
 console.log(process.argv.includes('--views-only')?'PASS MAX/normal layout views; clean console.':'PASS real keyboard jump, full crate chains and exit landings; MAX/normal views; clean consoles.');
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
