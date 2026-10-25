import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const data=JSON.parse(await readFile(new URL('./fixtures/rooftop-run-turns-replay.json',import.meta.url),'utf8'));
const native=process.argv.includes('--native'),base=process.env.ROOFTOP_BASE||'http://127.0.0.1:5267';
const out=process.env.ROOFTOP_TURN_OUTPUT||'/private/tmp/rooftop-turn-replay/browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'/?playtest&level=rooftop-relay'+(native?'':'&lite'),{timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&!window.__game.getLoadingDiagnostics().phase,null,{timeout:180000});
 await page.evaluate(data=>{
  const g=window.__game,p=g.player,step=p.step.bind(p);g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  window.__wetReplayTrace=[];
  p.step=(dt,input,l)=>{step(dt,input,l);if(!g.replayer.active)return;
   const x=p.axisF.x*input.moveY+p.axisL.x*input.moveX,z=p.axisF.z*input.moveY+p.axisL.z*input.moveX,wanted=Math.atan2(x,z)-Math.PI;
   window.__wetReplayTrace.push({frame:g.replayer.frame-1,input:[input.moveX,input.moveY],position:p.pos.toArray(),velocity:p.walkVelocity.toArray(),yaw:p.visualYaw,
    facingError:Math.atan2(Math.sin(p.visualYaw-wanted),Math.cos(p.visualYaw-wanted)),opposed:p.walkVelocity.x*x+p.walkVelocity.z*z,
    turn:p.walkTurnaround,ramp:p.walkRamp,cadence:p.animationIntent.motion.normalizedSpeed,clip:g.characterAnimationRuntime.activeClipId,
    phase:g.characterAnimationRuntime.diagnostics.timelineTime,grounded:p.grounded,state:p.state,board:p.freeSkate,grip:p.groundHit?.iceGrip});};
  g.loadReplay(data);
 },data);
 for(const frame of [164,260,378,502]){
  await page.waitForFunction(f=>window.__game.replayer.frame>=f,frame,{timeout:90000});
  await page.screenshot({path:out+`/frame-${frame}.png`});
 }
 await page.waitForFunction(()=>!window.__game.replayer.active,null,{timeout:90000});
 const result=await page.evaluate(()=>({frames:window.__wetReplayTrace,stamp:document.querySelector('.hud-build')?.textContent,buffer:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]}));
 await writeFile(out+'/report.json',JSON.stringify({...result,errors},null,2)+'\n');
 assert.equal(result.frames.length,data.frames);assert.deepEqual(errors,[]);if(native)assert.deepEqual(result.buffer,[2560,1440]);
 if(process.env.ROOFTOP_TURN_RECORD_ONLY){console.log('RECORDED',result.frames.length,'frames');}
 else{
  let prior=0,neutral=0,count=0;
  for(let i=0;i<data.frames;i++){
   const x=data.mx[i];if(x===0){neutral++;continue;}
   if(prior&&x!==prior){
    const fourth=result.frames[i+3];assert.ok(Math.abs(fourth.facingError)<.001,`frame ${i}: facing late after ${neutral} neutral frames`);
    assert.ok(fourth.opposed<0&&fourth.grounded&&!fourth.board);assert.ok(result.frames.slice(i,i+35).every(f=>f.clip==='player.run'&&f.cadence>.5),'Recorded reversal lost the run cycle');count++;
   }
   prior=x;neutral=0;
  }
  console.log('PASS',native?'native':'lite',count,'recorded wet run turns; short releases, facing, momentum, cadence and console');
 }
}finally{await browser.close();}
