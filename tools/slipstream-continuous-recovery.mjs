import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5193').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto(base+'/?playtest&level=slip&lite',{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='slip'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),checkpoint=l.checkpoints[7];
  // Stage one encounter at the existing pre-flight checkpoint. Only ordinary
  // input moves the player or banks recovery after this initial placement.
  const cp=[11.31442824943651,83.28622222222222,-1622];
  p.respawn(l,true,false,{position:p.pos.clone().fromArray(cp).add(p.pos.clone().set(0,.15,4))});
  const r=window.recoveryReview={frame:0,phase:'bank',done:false,deaths:[],bank:null};
  const V=p.pos.constructor,target=new V();let sample={},count=0,advanced=false;
  const update=g.input.update.bind(g.input),step=p.step.bind(p),commit=p.commitRenderStep.bind(p),death=p.onDeath;
  const direction=()=>{const cursor={s:p.laneCursor.s};l.laneDirAt(p.pos.x,p.pos.y,p.pos.z,cursor);l.cameraLanePointAhead(cursor,5,target);const dx=target.x-p.pos.x,dz=target.z-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return {moveX:(dx*-f.z+dz*f.x)/n*.55,moveY:(dx*f.x+dz*f.z)/n*.55};};
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),raw=n?.22+.78*Math.min(1,n):0;const h={0:sample.jumpHeld,2:sample.spinHeld};return {id:'Recovery input',index:0,connected:true,mapping:'standard',axes:n?[x/n*raw,-y/n*raw,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!h[i],value:h[i]?1:0}))};};
  p.onDeath=function(...args){r.deaths.push({p:p.pos.toArray(),pit:l.pitBoxes.findIndex(b=>b.intersectsBox(p.playerBox)),checkpoint:l.currentSpawn.toArray()});r.phase='recover';return death.apply(this,args);};
  p.step=(dt,input,level)=>{
   if(r.done)return;
   sample={};
   if(r.phase==='bank'){sample={...direction(),spinHeld:r.frame%30<12};if(checkpoint.active){r.bank=l.currentSpawn.toArray();r.phase='approach';}}
   else if(r.phase==='approach'){sample=direction();if(p.pos.z<=-1687.5&&p.grounded){r.phase='charge';count=0;sample={jumpHeld:true};}}
   else if(r.phase==='charge'){sample={jumpHeld:true};if(++count>=27){r.phase='slow flight';r.takeoff={p:p.pos.toArray(),speed:p.speed};sample=direction();}}
   else if(r.phase==='slow flight')sample=direction();
   update();step(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||r.done)return;advanced=false;r.frame++;r.p=p.pos.toArray();r.state=p.state;
   if(r.deaths.length&&p.grounded&&p.groundHit&&!p.isBailing&&!['dead','gameover'].includes(p.state)&&p.pos.distanceTo(l.currentSpawn)<1){r.done=true;r.recovered={p:p.pos.toArray(),ground:!!p.groundHit,checkpoint:l.currentSpawn.toArray()};}
   if(r.frame>8000){r.done=true;r.error='Timed out';}
  };
 });
 await page.waitForFunction(()=>window.recoveryReview.done,null,{timeout:180000});
 const report=await page.evaluate(()=>window.recoveryReview);await mkdir('/private/tmp/slipstream-continuous-browser',{recursive:true});
 await page.screenshot({path:'/private/tmp/slipstream-continuous-browser/recovered.png'});
 await writeFile('/private/tmp/slipstream-continuous-browser/recovery.json',JSON.stringify({base,report,errors},null,2));
 console.log(JSON.stringify({report,errors}));assert.ok(report.bank);assert.equal(report.deaths.length,1);assert.ok(report.deaths[0].pit>=0);assert.ok(report.recovered?.ground);assert.deepEqual(errors,[]);
}finally{await browser.close();}
