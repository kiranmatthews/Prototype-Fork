import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5248';
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-race-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const full of [false,true]){
  await page.goto(base+'/?playtest&renderdiag&'+(full?'':'lite&')+'level=spaghetti-rails',{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='spaghetti-rails'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async full=>{
   const g=window.__game,r=g.getSkateRace(),p=g.player;
   await g.getLevel().prepareJungleAssets();if(full)g.renderQualitySettings.setRegularResolution(null);
   const start=r.start.bind(r);r.start=mode=>start(mode,270327);
   const q=window.raceReview={command:0,activations:0,pickups:0,uses:0,specialPaints:0,balancePaints:0,balanceUses:0,firstFill:null,samples:[],tuning:JSON.stringify(g.TUNING),start:r.step.bind(r)};
   const surface=g.ui.gameHudSurface,paint=surface.paintSpecial.bind(surface);
   surface.paintSpecial=(...args)=>{const before=surface.primitiveCount;paint(...args);if(args[4].special?.value>0&&surface.primitiveCount>before)q.specialPaints++;};
   const boost=surface.paintBoost.bind(surface);
   surface.paintBoost=(...args)=>{const before=surface.primitiveCount;boost(...args);if(args[4].boost?.remaining>0&&surface.primitiveCount>before)q.balancePaints++;};
   r.step=(dt,input)=>{
    if(r.phase==='running'){
     input=r.drive(0);input.itemPressed=!!r.riders[0].item;
     if(p.specialReady&&p.state==='grind'&&!q.command){q.firstFill=r.elapsed;q.command=1;}
     if(q.command===1){Object.assign(input,{moveX:-1,moveY:0,grindHeld:false,grindPressed:false});q.command=2;}
     else if(q.command===2){Object.assign(input,{moveX:1,moveY:0,grindHeld:true,grindPressed:true});q.command=3;}
     const before=r.riders[0].item;q.start(dt,input);
     if(before&&!r.riders[0].item){q.uses++;if(before==='perfect-balance')q.balanceUses++;}
     if(!before&&r.riders[0].item)q.pickups++;
     q.activations=p.specialSequence;
     if(q.samples.length<1||r.elapsed-q.samples.at(-1).t>.5)q.samples.push({t:r.elapsed,meter:p.specialMeter,item:r.riders[0].item,state:p.state});
    }else q.start(dt,input);
   };
  },full);
  await page.getByRole('button',{name:'RACE',exact:true}).click();
  await page.waitForFunction(()=>window.raceReview.activations>0&&window.raceReview.balanceUses>0&&window.raceReview.balancePaints>0&&window.__game.player.balanceBoostT>1,null,{timeout:120000});
  await page.screenshot({path:out+'/'+(full?'full':'lite')+'-special.png'});
  const report=await page.evaluate(full=>{
   const g=window.__game,q=window.raceReview,l=g.getLevel(),s=document.querySelector('.hud-special'),row=document.querySelector('.hud-life-row');
   const housing=[];l.root.traverse(o=>{if(o.name==='Complete Carlisle net housing')housing.push(o.geometry.index?.count??o.geometry.attributes.position.count);});
   const speedText=document.querySelector('[data-race-speed]').textContent;
   return {full,firstFill:q.firstFill,activations:q.activations,pickups:q.pickups,uses:q.uses,specialPaints:q.specialPaints,meter:g.player.specialMeter,
    balancePaints:q.balancePaints,balanceUses:q.balanceUses,balanceSeconds:g.player.balanceBoostT,speedText,speedKmh:g.getSkateRace().hud().speedKmh,
    visible:row.classList.contains('hud-reveal-visible'),avatarOnly:row.classList.contains('hud-avatar-only'),aria:s.getAttribute('aria-valuenow'),
    springs:l.groundMeshes.filter(m=>m.userData.trampolineBounce).length,housingParts:housing.length,housingVertices:housing.reduce((a,b)=>a+b,0),
    art:l.spaghettiSprings.diagnostics,boxes:l.crates.filter(c=>c.mystery).length,tuningUnchanged:q.tuning===JSON.stringify(g.TUNING),
    buffer:[g.renderer.domElement.width,g.renderer.domElement.height],samples:q.samples};
  },full);reports.push(report);
  assert.ok(report.visible&&report.avatarOnly&&report.specialPaints>0&&report.meter>0&&Number(report.aria)>0,'Race Special is drawn in the composited HUD as well as the DOM');
  assert.ok(report.balancePaints>0&&report.balanceUses>0&&report.balanceSeconds>0,'Collected roulette item paints the live balance timer');
  assert.ok(Number(report.speedText)>0&&Math.abs(Number(report.speedText)-report.speedKmh)<2,'Shared speedometer reports real horizontal travel');
  assert.equal(report.springs,18);assert.equal(report.art.status,'ready');assert.ok(report.housingParts>=18);assert.ok(report.tuningUnchanged);
  if(full){
   assert.deepEqual(report.buffer,[1600,1000]);
   await page.evaluate(()=>{
    const g=window.__game,l=g.getLevel(),p=g.player,c=l.groundMeshes.find(m=>m.userData.trampolineBounce),V=p.pos.constructor;
    // Freeze simulation only for a reproducible model inspection; gameplay
    // and SPECIAL above ran through the live fixed-step movement controller.
    g.getSkateRace().step=()=>{};
    p.respawn(l,true,false,{position:new V(c.position.x,c.position.y+7,c.position.z+15),heading:new V(0,0,-1)});p.snapRenderInterpolation();
    p.group.visible=false;for(const r of g.getSkateRace().riders){r.shield=0;r.bubble.visible=false;r.marker.visible=false;}
   });
   await page.waitForTimeout(900);await page.screenshot({path:out+'/full-carlisle-spring.png'});
  }
  await writeFile(out+'/browser.json',JSON.stringify({reports,errors},null,2));
 }
 // A full-render platformer load also exercises disposal of all eighteen
 // race net instances before constructing the six platforming springs.
 await page.evaluate(async()=>{const g=window.__game;await g.gameFlow.transition(()=>{g.switchLevel('spaghetti-rails-platforming');g.gameFlow.hide();});await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
 const platformer=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {id:g.getCurrentLevel().id,art:l.spaghettiSprings.diagnostics,springs:l.groundMeshes.filter(m=>m.userData.trampolineBounce).length,loop:l.verticalLoop};});
 assert.equal(platformer.id,'spaghetti-rails-platforming');assert.equal(platformer.springs,6);assert.equal(platformer.art.status,'ready');assert.equal(platformer.loop.height,96);
 await page.screenshot({path:out+'/full-platformer.png'});
 await writeFile(out+'/browser.json',JSON.stringify({reports,platformer,errors},null,2));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({reports:reports.map(({samples,...r})=>r),errors}));
}catch(error){
 await page.screenshot({path:out+'/failure.png'}).catch(()=>{});
 const state=await page.evaluate(()=>{const g=window.__game,q=window.raceReview;return {review:q&&{...q,start:undefined},phase:g?.getSkateRace().phase,elapsed:g?.getSkateRace().elapsed,boost:g?.player.balanceBoostT,boostFrame:g?.ui.boostFrame,p:g?.player.pos.toArray()};}).catch(()=>null);
 await writeFile(out+'/failure.json',JSON.stringify({state,errors,error:String(error)},null,2));throw error;
}finally{await browser.close();}
