import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5348').replace(/\/$/,'');
const output=process.env.RACE_TRIAL_OUTPUT||'/private/tmp/slipstream-time-crates-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
try{
 for(const lite of [true,false]){
  const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const mode=lite?'lite':'full';
  try{
   await page.goto(`${base}/?playtest&level=slipstream-race${lite?'&lite':''}`,{timeout:180000});
   await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
   await page.evaluate(()=>{window.trialOriginalMaps=window.__game.getLevel().crates.map(c=>c.mesh.material.map);});
   await page.getByRole('button',{name:'TIME TRIAL',exact:true}).click();
   await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
   const initial=await page.evaluate(()=>{
    const g=window.__game,r=g.getSkateRace(),p=g.player,boxes=r.level.crates.filter(c=>c.timeSecs),box=boxes[0];
    window.trialTarget=box;window.trialProbe={frozenFrames:0,clockLeaks:[],initialTuning:JSON.stringify(g.TUNING)};
    const step=r.step.bind(r);r.step=(dt,input)=>{const frozen=p.ttFreeze,before=p.ttTime,live=r.mode==='time-trial'&&r.phase==='running';step(dt,input);if(live&&frozen>=dt){window.trialProbe.frozenFrames++;if(Math.abs(p.ttTime-before)>1e-8)window.trialProbe.clockLeaks.push({before,after:p.ttTime,frozen,dt});}};
    const at=r.course.project(box.mesh.position).s,heading=r.course.tangent(at),point=box.mesh.position.clone().addScaledVector(heading,-1.25);
    const support=r.course.supportAt(r.level,point,point.clone(),8,20);if(!support)throw Error('No supported time-crate approach');
    window.trialApproach={support:support.clone(),heading:heading.clone()};p.resetRacePosition(r.level,support,heading);p.speed=0;r.riders[0].progress=r.riders[0].anchorProgress=at-1.25;r.riders[0].anchor.copy(support);
    document.activeElement?.blur();
    return {timeCrates:boxes.length,printedSeconds:box.timeSecs,itemBoxes:r.level.crates.filter(c=>c.mystery).length,count:r.count,position:box.mesh.position.toArray()};
   });
   assert.ok(initial.timeCrates>0);assert.equal(initial.count,1);
   await page.waitForTimeout(400);await page.screenshot({path:`${output}/${mode}-numbered-crate.png`});
   // A screenshot can take long enough for an idle board to roll downhill.
   // Restore the supported approach immediately before the real attack input.
   await page.evaluate(()=>{const g=window.__game,a=window.trialApproach;g.player.resetRacePosition(g.getLevel(),a.support,a.heading);g.player.speed=0;});
   await page.keyboard.press('KeyF');
   await page.waitForFunction(()=>!window.trialTarget.alive,null,{timeout:10000});
   await page.waitForFunction(()=>document.querySelector('[data-race-status]')?.textContent.includes('FROZEN'));
   const frozen=await page.evaluate(()=>({clock:window.__game.player.ttTime,freeze:window.__game.player.ttFreeze,status:document.querySelector('[data-race-status]').textContent}));
   assert.ok(frozen.freeze>0&&frozen.freeze<=initial.printedSeconds);
   await page.screenshot({path:`${output}/${mode}-frozen.png`});
   await page.waitForFunction(()=>window.trialProbe.frozenFrames>=30);
   assert.equal(await page.evaluate(()=>document.querySelector('[data-race-go]').hidden),true,'start cue must expire even while the scored clock is frozen');
   await page.waitForFunction(()=>window.__game.player.ttFreeze===0);
   await page.waitForFunction(before=>window.__game.player.ttTime>before+.1,frozen.clock);
   assert.deepEqual(await page.evaluate(()=>window.trialProbe.clockLeaks),[]);
   const layouts=[];
   if(!lite)for(const [width,height]of [[1920,1080],[1024,768],[390,844],[844,390]]){
    await page.setViewportSize({width,height});
    // Presentation fixture: bank another untouched box for each aspect ratio.
    await page.evaluate(()=>{const r=window.__game.getSkateRace();r.level.breakCrate(r.level.crates.find(c=>c.timeSecs&&c.alive));});
    await page.waitForFunction(()=>document.querySelector('[data-race-status]')?.textContent.includes('FROZEN'));
    const layout=await page.evaluate(()=>[...document.querySelectorAll('[data-race-rank],[data-race-clock],[data-race-boxes],[data-race-status]')].map(e=>{const b=e.getBoundingClientRect();return {text:e.textContent,x:b.x,y:b.y,width:b.width,height:b.height,inside:b.x>=0&&b.y>=0&&b.right<=innerWidth&&b.bottom<=innerHeight};}));
    assert.ok(layout.every(v=>v.inside),JSON.stringify({width,height,layout}));layouts.push({width,height,layout});
    await page.screenshot({path:`${output}/${mode}-${width}x${height}.png`});
   }
   await page.setViewportSize({width:1280,height:720});
   await page.waitForFunction(()=>window.__game.player.ttFreeze===0);
   await page.evaluate(()=>{
    const g=window.__game,r=g.getSkateRace(),p=g.player,s=r.course.length-3,point=r.course.sample(s);point.y+=.06;
    p.resetRacePosition(r.level,point,r.course.tangent(s));p.speed=32;r.riders[0].progress=s;r.riders[0].anchor.copy(point);r.riders[0].anchorProgress=s;
   });
   await page.keyboard.down('KeyW');
   await page.waitForFunction(()=>window.__game.getSkateRace().phase==='finished',null,{timeout:10000});await page.keyboard.up('KeyW');
   const result=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {time:r.riders[0].finish,elapsed:r.elapsed,hud:r.hud().elapsed,medal:r.hud().medal,saved:g.campaign.levelProgress('slipstream-race').bestTime,freeze:g.player.ttFreeze,frozenFrames:window.trialProbe.frozenFrames,clockLeaks:window.trialProbe.clockLeaks,tuningUnchanged:JSON.stringify(g.TUNING)===window.trialProbe.initialTuning,stamp:document.querySelector('.hud-build')?.textContent};});
   assert.ok(result.elapsed-result.time>=initial.printedSeconds-1e-8);assert.equal(result.time,result.saved);assert.equal(result.time,result.hud);assert.equal(result.freeze,0);assert.ok(result.tuningUnchanged);assert.deepEqual(result.clockLeaks,[]);
   await page.screenshot({path:`${output}/${mode}-results.png`});
   await page.getByRole('button',{name:'RACE AGAIN',exact:true}).click();
   await page.waitForFunction(()=>window.__game.getSkateRace().phase==='countdown');
   const restored=await page.evaluate(()=>{const r=window.__game.getSkateRace();return {count:r.count,mode:r.mode,timeCrates:r.level.crates.filter(c=>c.timeSecs).length,faces:r.level.crates.every((c,i)=>c.mesh.material.map===window.trialOriginalMaps[i])};});
   assert.equal(restored.count,8);assert.equal(restored.mode,'race');assert.equal(restored.timeCrates,0);assert.ok(restored.faces);
   assert.deepEqual(errors,[]);reports.push({mode,initial,frozen,layouts,result,restored,errors});
   await writeFile(`${output}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify({mode,initial,result,restored,errors}));
  }catch(error){await page.screenshot({path:`${output}/${mode}-failure.png`});await writeFile(`${output}/${mode}-failure.json`,JSON.stringify({error:String(error),errors,state:await page.evaluate(()=>{const g=window.__game,r=g?.getSkateRace();return r?{phase:r.phase,p:g.player.pos.toArray(),state:g.player.state,tt:g.player.ttTime,freeze:g.player.ttFreeze,alive:window.trialTarget?.alive,probe:window.trialProbe}:null;}).catch(()=>null)},null,2));throw error;}
  finally{await context.close();}
 }
}finally{await browser.close();}
