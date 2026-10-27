import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5237';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/keyboard';
const settings={items:process.env.SPAGHETTI_ITEMS==='1',trial:process.env.SPAGHETTI_TRIAL==='1',cues:process.env.SPAGHETTI_CUES==='1',
 choice:Number(process.env.SPAGHETTI_CHOICE??1),lane:Number(process.env.SPAGHETTI_LANE??0),defend:process.env.SPAGHETTI_DEFEND==='1',route:process.env.SPAGHETTI_ROUTE??'fixed',camera:process.env.SPAGHETTI_CAMERA==='1',
 seed:process.env.SPAGHETTI_SEED?Number(process.env.SPAGHETTI_SEED):null};
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:process.env.SPAGHETTI_FULL?{width:2560,height:1440}:{width:1440,height:900},serviceWorkers:'block'});
await page.addInitScript(()=>{const Native=WebSocket;window.WebSocket=new Proxy(Native,{construct(Target,args){
 if(args[1]==='vite-hmr')return Object.assign(new EventTarget(),{readyState:0,send(){},close(){}});
 return Reflect.construct(Target,args);
}});});
const errors=[],trace=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=spaghetti-rails${process.env.SPAGHETTI_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(process.env.SPAGHETTI_MAX)await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.gameFlow.requestGameplayFrame();});
 const presentation=await page.evaluate(()=>{const g=window.__game;return {settings:g.renderQualitySettings.snapshot(),viewport:[innerWidth,innerHeight],
  drawingBuffer:[g.renderer.domElement.width,g.renderer.domElement.height],devicePixelRatio:Math.min(devicePixelRatio||1,2)};});
 if(process.env.SPAGHETTI_FULL&&process.env.SPAGHETTI_MAX){
  assert.equal(presentation.settings.enabled,false,'MAX uses the native rendering path');
  assert.deepEqual(presentation.drawingBuffer,presentation.viewport.map(v=>Math.floor(v*presentation.devicePixelRatio)),'Verify the actual canvas buffer, not the cached fixed-preset dimensions');
 }
 if(settings.trial)await page.evaluate(()=>{const g=window.__game;g.campaign.startEphemeral();g.campaign.commitRaceResult('spaghetti-rails',{won:true,boxGem:false});g.gameFlow.requestGameplayFrame();});
 // This pilot reads geometry and balance but never calls the rival driver,
 // injects a device snapshot, changes tuning, or moves a player directly.
 await page.evaluate(settings=>{
  const g=window.__game,nativeUpdate=g.input.update.bind(g.input),held=new Set();
  const update=()=>{nativeUpdate();if(settings.seed!==null&&(g.input.raceStartPressed||g.input.raceTrialStartPressed))g.input.raceSeed=settings.seed;};
  const q=window.spaghettiKeyboard={cursor:{s:0},tuning:JSON.stringify(g.TUNING),rails:new Set(),jumps:[],lastRail:null,releasedAt:-Infinity,lastFall:0,rejoining:false,nextControl:0,stopped:false,itemPresses:0,lastItem:-Infinity,spinPresses:0,lastSpin:-Infinity,cues:[],lastCue:-1,camera:[],lastCamera:-Infinity,loomShot:-1};
  q.transfers=g.getCurrentLevel().data.skateRace.jumps.map((jump,index)=>{
   const start=g.player.pos.clone().fromArray(jump.takeoff),end=g.player.pos.clone().fromArray(jump.landing),rail=g.getLevel().rails.find(r=>r.object.userData.sourceName&&r.closestDistance(start)<.15);
   return rail?{index,rail,t:rail.closest(start).t,start,end}:null;
  }).filter(Boolean);q.transferred=new Set();
  const event=(code,down)=>document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));
  q.stop=()=>{q.stopped=true;for(const code of held)event(code,false);held.clear();};
  // Sample at a human-scale 20 Hz in the browser. Cross-process logging and
  // screenshots must not accidentally hold a key for seconds under load.
  g.input.update=()=>{
   const r=g.getSkateRace(),p=g.player,l=g.getLevel(),a=r.riders[0],keys=[];
   const railIndex=l.rails.indexOf(p.grindRail),now=performance.now();
   if(q.stopped||now<q.nextControl){update();return;}q.nextControl=now+50;
   if(a.falls!==q.lastFall){q.lastFall=a.falls;q.lastRail=null;q.releasedAt=-Infinity;q.rejoining=true;}
   if(q.rejoining&&p.state==='grind'&&railIndex>=0)q.rejoining=false;
   const network=l.railChoices,stage=network.paths.find(path=>a.progress<path.end)?.section??5;
   const choice=settings.route==='combo'?2:settings.route==='mixed'?[0,2,1,2,0,1][stage]:settings.choice;
   let path=network.guide(p.pos,q.cursor,choice,p.state==='grind'?p.grindRail:null,p.state==='grind'?p.grindT:undefined);
   // On a huge island, keep the intended mouth in sight even after leaving
   // the junction centre. A digital pilot should not chase whichever lane
   // briefly projects nearest while crossing the planning deck.
   if(p.grounded){
    const outgoing=network.paths.find(candidate=>candidate.choice===choice&&Math.abs(candidate.course.knots[0][1]-p.pos.y)<2&&Math.hypot(candidate.course.knots[0][0]-p.pos.x,candidate.course.knots[0][2]-p.pos.z)<105);
    if(outgoing)path=outgoing;
   }
   const transfer=settings.route==='combo'?q.transfers.find(j=>j.rail===p.grindRail&&!q.transferred.has(j.index)&&j.t-p.grindT> -5):null;
   const span=path?.rails.findIndex(span=>span.rail===p.grindRail)??-1,gap=p.state==='grind'&&span>=0&&span<path.rails.length-1;
   if(r.phase==='running'&&a.finish===null&&!a.recovery&&p.state!=='dead'&&!p.skateCameraBailing){
    keys.push('KeyW');
    if(p.state==='grind'){
     keys.pop(); // rail travel is automatic; use the full digital balance axis
     q.rails.add(railIndex);
     const remaining=p.grindRail.totalLength-p.grindT;
     if(q.lastRail!==railIndex){q.lastRail=railIndex;q.releasedAt=-Infinity;}
     if(transfer&&transfer.t-p.grindT<2.5){
      const tangent=p.grindRail.tangentAt(p.grindT),dx=transfer.end.x-transfer.start.x,dz=transfer.end.z-transfer.start.z;
      const side=Math.sign(dx*-tangent.z+dz*tangent.x);keys.push(side>0?'KeyD':'KeyA');
      if(transfer.t-p.grindT>.25)keys.push('Space','KeyE');
      else {q.releasedAt=now;q.transferred.add(transfer.index);q.jumps.push({time:r.elapsed,rail:railIndex,transfer:transfer.index,remaining:transfer.t-p.grindT,speed:p.grindVel});}
     }else if(gap&&remaining<=4.5){
      if(!Number.isFinite(q.releasedAt)){q.releasedAt=now;q.jumps.push({time:r.elapsed,rail:railIndex,remaining,speed:p.grindVel});}
      keys.push('KeyW');
     }else{
      keys.push('Space','KeyE');
      const correction=p.balance+p.balanceVel*.20;
      if(correction>.035)keys.push('KeyA');else if(correction<-.035)keys.push('KeyD');
     }
    }else if(!p.grounded){
     if(now-q.releasedAt>80)keys.push('KeyE');
    }else{
     keys.push('Space');
     const mouth=path?.rails[0],aim=mouth?mouth.rail.pointAt(Math.min(26,mouth.rail.closest(p.pos).t+8)):network.ahead(q.cursor,15);
     if(mouth&&mouth.rail.closestDistance(p.pos)<5)keys.push('KeyE');
     const basis=p.raceInputBasis(l),dx=aim.x-p.pos.x,dz=aim.z-p.pos.z;
     const angle=Math.atan2(dx*-basis.z+dz*basis.x,dx*basis.x+dz*basis.z);
     // Maintain forward charge while lining up. A pure lateral key cannot
     // restart a stopped course-relative board; aim farther along the mouth
     // when the rider has already passed its first supported metres.
     if(angle>Math.PI/8)keys.push('KeyD');else if(angle< -Math.PI/8)keys.push('KeyA');
    }
    const threat=a.threats[0],neighbour=r.riders.slice(1,r.count).some(other=>other.finish===null&&other.player.pos.distanceTo(p.pos)<2.65);
    const defensive=a.item==='shield'||a.item==='horn',useDefense=!!threat&&threat.seconds<(a.item==='horn'?.65:1.25);
    if(settings.items&&a.item&&r.elapsed-q.lastItem>1&&(!defensive||useDefense)){
     keys.push('KeyI');q.itemPresses++;q.lastItem=r.elapsed;
     if(r.rank(0)===1&&['green-shell','water-bomb','boomerang'].includes(a.item)&&p.state==='grind')keys.push('KeyS');
    }
    // Keep a last-moment attack from queuing a deck flip across the catch.
    const nearTakeoff=gap&&p.grindRail.totalLength-p.grindT<12;
    if(settings.defend&&!q.rejoining&&p.state!=='air'&&!nearTakeoff&&(neighbour||threat&&threat.item!=='shock-shell'&&threat.seconds<.3)&&r.elapsed-q.lastSpin>1.3){keys.push('KeyF');q.spinPresses++;q.lastSpin=r.elapsed;}
    if(settings.cues&&gap){
     const remaining=p.grindRail.totalLength-p.grindT;
     if(remaining>=22&&remaining<27&&!q.cues.some(c=>c.rail===railIndex)){
      const target=p.grindRail.pointAt(p.grindRail.totalLength-4),groups=new Map();
      for(const c of g.getCurrentLevel().data.components.filter(c=>c.nm?.includes('/ takeoff chevron'))){const id=Number(c.nm.match(/Jump (\d+)/)[1]),list=groups.get(id)??[];list.push(c);groups.set(id,list);}
      const [id,markers]=[...groups].sort((a,b)=>{const d=([,list])=>Math.hypot(list.reduce((n,c)=>n+c.p[0],0)/list.length-target.x,list.reduce((n,c)=>n+c.p[2],0)/list.length-target.z);return d(a)-d(b);})[0];
      const projected=markers.map(c=>{const at=p.pos.clone().set(c.p[0],c.p[1]+1.5,c.p[2]).project(g.camera);return {x:at.x,y:at.y,z:at.z,visible:Math.abs(at.x)<.95&&Math.abs(at.y)<.95&&at.z>-1&&at.z<1};});
      q.cues.push({index:id-1,rail:railIndex,time:r.elapsed,metresBefore:remaining-4,projected});q.lastCue=id-1;
     }
    }
    if(settings.camera&&r.elapsed-q.lastCamera>.5){
     const feet=p.pos.clone().project(g.camera),head=p.pos.clone().add({x:0,y:1.6,z:0}).project(g.camera);
     q.camera.push({time:r.elapsed,progress:a.progress,rail:railIndex,feet:feet.toArray(),head:head.toArray(),visible:[feet,head].every(v=>Math.abs(v.x)<.95&&Math.abs(v.y)<.95&&v.z>-1&&v.z<1)});q.lastCamera=r.elapsed;
     if(railIndex>=0)q.loomShot=Math.floor(a.progress/150);
    }
   }
   q.state={time:r.elapsed,phase:r.phase,s:a.progress,position:p.pos.toArray(),state:p.state,rail:railIndex,balance:p.balance,
    speed:p.state==='grind'?p.grindVel:p.speed,falls:a.falls,finish:a.finish,rank:r.rank(0),transfers:q.transferred.size,path:path?.index,lastCue:q.lastCue,loomShot:q.loomShot,keys};
   const desired=new Set(keys);
   for(const code of held)if(!desired.has(code)){event(code,false);held.delete(code);}
   for(const code of desired)if(!held.has(code)){event(code,true);held.add(code);}
   update();
  };
 },settings);
 await page.getByRole('button',{name:settings.trial?'TIME TRIAL':'RACE',exact:true}).click();
 const start=Date.now();let nextLog=0,nextShot=0,lastCue=-1,lastLoom=-1,finish=null,stoppedSince=null;
 while(Date.now()-start<Number(process.env.SPAGHETTI_BROWSER_SECONDS??360)*1000){
  const state=await page.evaluate(()=>window.spaghettiKeyboard.state);
  if(!state){await page.waitForTimeout(100);continue;}
  if(state.time>=nextLog){trace.push(state);nextLog=state.time+1;await writeFile(output+'/latest.json',JSON.stringify(state,null,2));if(trace.length%15===1)console.log(JSON.stringify(state));}
  if(state.s>=nextShot){await page.screenshot({path:`${output}/section-${Math.floor(state.s/500)}.png`});nextShot=state.s+1400;}
  if(settings.cues&&state.lastCue!==lastCue&&state.lastCue>=0){lastCue=state.lastCue;await page.screenshot({path:`${output}/cue-${lastCue+1}.png`});}
  if(settings.camera&&state.loomShot!==lastLoom&&state.loomShot>=0){lastLoom=state.loomShot;await page.screenshot({path:`${output}/loom-${lastLoom}.png`});}
  if(state.finish!==null){finish=state.finish;break;}
  if(state.falls>4)break; // preserve the useful failure instead of repeating it
  if(state.phase==='running'&&Math.abs(state.speed)<.1){stoppedSince??=Date.now();if(Date.now()-stoppedSince>8000)break;}else stoppedSince=null;
  await page.waitForTimeout(250);
 }
 await page.evaluate(()=>window.spaghettiKeyboard.stop());
 const result=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),q=window.spaghettiKeyboard;return {seed:r.runSeed,mode:r.mode,rank:r.rank(0),rails:[...q.rails],jumps:q.jumps,cues:q.cues,itemPresses:q.itemPresses,spinPresses:q.spinPresses,camera:q.camera,
  tuningUnchanged:q.tuning===JSON.stringify(g.TUNING),riders:r.riders.slice(0,r.count).map(a=>({id:a.id,s:a.progress,finish:a.finish,falls:a.falls})),hud:r.hud(),campaign:g.campaign.levelProgress('spaghetti-rails'),quality:g.getRenderQualitySizes()};});
 await page.screenshot({path:output+'/result.png'});
 await writeFile(output+'/report.json',JSON.stringify({at:new Date().toISOString(),settings,presentation,finish,wallSeconds:(Date.now()-start)/1000,result,errors,trace},null,2));
 console.log(JSON.stringify({finish,rails:result.rails.length,jumps:result.jumps.length,riders:result.riders,errors}));
 assert.ok(result.tuningUnchanged);assert.deepEqual(errors,[]);
 assert.ok(finish!==null,'Independent keyboard pilot must reach the finish');
 if(settings.route==='combo')assert.equal(result.jumps.filter(j=>j.transfer!==undefined).length,12,'All twelve deliberate combo windows are used through real keyboard events');
 if(settings.cues){assert.equal(result.cues.length,new Set(result.jumps.map(j=>j.rail)).size);assert.ok(result.cues.every(c=>c.projected.length===2&&c.projected.every(p=>p.visible)),'Both takeoff cues are in the camera frame at least eighteen metres before each jump');}
 if(settings.camera)assert.ok(result.camera.every(c=>c.visible),'The live follow camera keeps the rider in frame through the complete course');
 if(process.env.SPAGHETTI_REQUIRE_WIN){
  assert.equal(result.rank,1,'A real keyboard/item run can win the race');
  assert.equal(result.campaign.raceWon,true);assert.equal(result.campaign.boxGem,true);
  await page.getByRole('button',{name:'TIME TRIAL',exact:true}).waitFor({state:'visible'});
 }
}finally{await browser.close();}
