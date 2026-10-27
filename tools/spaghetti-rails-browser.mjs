import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5237';
const output=process.env.SPAGHETTI_OUTPUT||'/private/tmp/spaghetti-rails-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:process.env.SPAGHETTI_FULL?{width:2560,height:1440}:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
// A long playtest keeps its loaded revision even while the next local draft
// is authored. Only Vite's development reload socket is suppressed.
await page.addInitScript(()=>{const Native=WebSocket;window.WebSocket=new Proxy(Native,{construct(Target,args){
 if(args[1]==='vite-hmr')return Object.assign(new EventTarget(),{readyState:0,send(){},close(){}});
 return Reflect.construct(Target,args);
}});});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=spaghetti-rails${process.env.SPAGHETTI_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(process.env.SPAGHETTI_MAX)await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.gameFlow.requestGameplayFrame();});
 await page.screenshot({path:output+'/grid.png'});
 if(process.argv.includes('--menu')){
  const layouts=[];
  for(const [width,height] of [[1280,720],[1920,1080],[1024,768],[390,844],[844,390],[320,568],[568,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(300);
   const layout=await page.evaluate(()=>{
    const root=document.querySelector('.race-interface'),content=root.querySelector('.comp-content'),clip=content.getBoundingClientRect();
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const controls=root.querySelector('[data-rail-controls]'),button=root.querySelector('[data-race-action="race"]');
    return {viewport:[innerWidth,innerHeight],title:root.querySelector('h1').textContent,controls:rect(controls),content:rect(content),button:rect(button),
     instructionText:controls.textContent,prompts:controls.querySelectorAll('.input-glyph').length,
     instructionsFit:controls.getBoundingClientRect().top>=clip.top-1&&controls.getBoundingClientRect().bottom<=clip.bottom+1,
     wholeMenuScroll:[root.scrollTop,root.scrollLeft],quality:window.__game.getRenderQualitySizes()};
   });
   layouts.push(layout);await page.screenshot({path:`${output}/menu-${width}x${height}.png`});
  }
  await writeFile(output+'/menu.json',JSON.stringify({layouts,errors},null,2));
  for(const l of layouts){assert.ok(l.instructionsFit,`Rail instructions fit ${l.viewport.join('x')}`);assert.deepEqual(l.wholeMenuScroll,[0,0]);assert.ok(l.button.y>=0&&l.button.bottom<=l.viewport[1]);}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:layouts.map(l=>l.viewport),errors}));
 }else if(process.argv.includes('--inspect')){
  await page.getByRole('button',{name:'RACE',exact:true}).click();
  await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
  await page.screenshot({path:output+'/spawn.png'});
  const state=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),r=g.getSkateRace();return {level:g.getCurrentLevel().id,rails:l.rails.length,line:r.course.length,spawn:g.player.pos.toArray(),quality:g.getRenderQualitySizes(),stamp:document.querySelector('.hud-build')?.textContent};});
  console.log(JSON.stringify({state,errors}));await writeFile(output+'/inspect.json',JSON.stringify({state,errors},null,2));
 }else{
  await page.getByRole('button',{name:'RACE',exact:true}).click();
  await page.evaluate(()=>{
   const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r),update=g.input.update.bind(g.input);let sample={};
   window.spaghettiReview={frames:0,grindFrames:0,rails:new Set(),started:performance.now(),tuning:JSON.stringify(g.TUNING)};
   g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld,6:!!sample.itemPressed,7:!!sample.transferHeld};return {id:'Spaghetti Rails input-only validation',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
   r.step=(dt,input)=>{sample=r.phase==='running'?r.drive(0):{};update();step(dt,input);const q=window.spaghettiReview;q.frames++;if(g.player.state==='grind'){q.grindFrames++;q.rails.add(g.getLevel().rails.indexOf(g.player.grindRail));}};
  });
  let shot=-1,done=false;
  for(let i=0;i<Number(process.env.SPAGHETTI_BROWSER_SECONDS??600);i++){
   await page.waitForTimeout(1000);
   const state=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {time:r.elapsed,phase:r.phase,length:r.course.length,frames:window.spaghettiReview.frames,riders:r.riders.map(a=>({id:a.id,s:a.progress,p:a.player.pos.toArray(),state:a.player.state,falls:a.falls,finish:a.finish}))};});
   if(i%15===0){console.log(JSON.stringify(state));await writeFile(output+'/latest.json',JSON.stringify(state,null,2));}
   const mark=Math.floor(state.riders[0].s/250);if(mark!==shot){shot=mark;await page.screenshot({path:`${output}/section-${mark}.png`});}
   if(state.riders.every(a=>a.finish!==null)){done=true;break;}
  }
  const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),q=window.spaghettiReview;return {frames:q.frames,grindFrames:q.grindFrames,rails:[...q.rails],wallSeconds:(performance.now()-q.started)/1000,tuningUnchanged:q.tuning===JSON.stringify(g.TUNING),hud:r.hud(),quality:g.getRenderQualitySizes(),riders:r.riders.map(a=>({id:a.id,finish:a.finish,falls:a.falls})),stamp:document.querySelector('.hud-build')?.textContent};});
  await page.screenshot({path:output+'/results.png'});await writeFile(output+'/report.json',JSON.stringify({done,report,errors},null,2));console.log(JSON.stringify({done,...report,hud:undefined,errors}));
  if(!process.argv.includes('--sample'))assert.ok(done);
  assert.ok(report.tuningUnchanged);assert.deepEqual(errors,[]);
 }
}finally{await browser.close();}
