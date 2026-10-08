import assert from 'node:assert/strict';
import fs from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5317/',out=process.env.GHOST_CART_OUTPUT||'/private/tmp/ghost-cart-browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[],errors=[];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'?playtest&level=ghost-train'+(lite?'&lite':''));await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{await window.__game.getLevel().prepareGhostTrainAssets();await window.__game.player.preparePresentationAssets();});
  await page.evaluate(()=>{
   const g=window.__game,p=g.player,native=p.step.bind(p),s={rows:[],sample:{},mode:'idle',ticks:0,previous:{}};window.__cartReview=s;
   p.step=(dt,input,l)=>{
    const sample={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,grindHeld:false,grindPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,...s.sample};
    sample.jumpPressed=sample.jumpHeld&&!s.previous.jumpHeld;sample.jumpReleased=!sample.jumpHeld&&!!s.previous.jumpHeld;sample.spinPressed=sample.spinHeld&&!s.previous.spinHeld;
    native(dt,sample,l);s.previous=sample;s.ticks++;
    if(s.car!==undefined){const m=l.movers[s.car];s.rows.push({state:p.state,phase:p.ledgePhase,k:p.ledgeClimbK,spin:p.spinning,pos:p.pos.toArray(),local:p.pos.clone().sub(m.mesh.position).toArray(),mover:p.ledgeMoverId,ground:p.groundHit?.moverId,grounded:p.grounded});}
    if(p.state==='hang'&&p.ledgePhase==='grip'&&s.mode==='approach'){s.sample={};s.mode='gripped';}
   };
   s.place=(axis,sign,index)=>{
    p.respawn(g.getLevel(),true);const l=g.getLevel(),m=l.movers[index];s.car=index;
    const d=m.mesh.userData.ghostCartSize,height=axis==='x'?1.45:sign>0?1.35:.9;
    const edge=axis==='x'?d[0]*.43+.08:d[2]*.42+.085;
    const position=m.mesh.position.clone();position.y+=d[1]/2+height-1.1;position[axis]+=sign*(edge+.49);
    p.respawn(l,false,false,{position});p.state='air';p.grounded=false;p.vVel=-1;
    s.floor=m.mesh.position.y+d[1]/2;s.lip=s.floor+height;s.mode='approach';s.rows=[];s.previous={};s.ticks=0;
    const cf=p.courseInputDirection(l)||p.camDir,wx=axis==='x'?-sign:0,wz=axis==='z'?-sign:0;
    s.sample={moveX:wx*-cf.z+wz*cf.x,moveY:wx*cf.x+wz*cf.z};
   };
  });
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  for(const [axis,sign,index] of [['z',1,1],['x',1,1],['x',-1,1],['z',-1,1]]){
   await page.evaluate(([axis,sign,index])=>window.__cartReview.place(axis,sign,index),[axis,sign,index]);
   await page.waitForFunction(()=>window.__cartReview.mode==='gripped',null,{timeout:10000});
   await page.waitForTimeout(300);
   if(axis==='x'&&sign===1)await page.screenshot({path:`${out}/${lite?'lite':'full'}-grip.png`});
   const before=await page.evaluate(()=>{const s=window.__cartReview,p=window.__game.player;return{pos:p.pos.toArray(),lip:p.ledgeLip,landing:p.ledgeLanding.toArray(),mover:p.ledgeMoverId,rows:s.rows.slice(-8)};});
   assert.equal(before.mover,index);assert.ok(before.lip>before.landing[1]+.8);
   await page.evaluate(()=>{const s=window.__cartReview;s.sample={jumpHeld:true,spinHeld:true};s.mode='climbing';});
   await page.waitForFunction(()=>window.__game.player.state==='hang'&&window.__game.player.ledgePhase==='climb',null,{timeout:10000});
   if(axis==='x'&&sign===1){await page.waitForTimeout(160);await page.screenshot({path:`${out}/${lite?'lite':'full'}-vault.png`});}
   await page.waitForFunction(()=>{const p=window.__game.player,s=window.__cartReview;return p.state==='ride'&&p.grounded&&p.groundHit?.moverId===s.car;},null,{timeout:10000});
   await page.evaluate(()=>{window.__cartReview.sample={};});
   await page.waitForTimeout(300);
   const landing=await page.evaluate(()=>{const s=window.__cartReview,p=window.__game.player;return{state:p.state,grounded:p.grounded,y:p.pos.y,floor:s.floor,mover:p.groundHit?.moverId,spins:s.rows.filter(r=>r.spin).length,climbFrames:s.rows.filter(r=>r.state==='hang'&&r.phase==='climb').length,climb:s.rows.filter(r=>r.phase==='climb').slice(0,35),local:p.pos.clone().sub(window.__game.getLevel().movers[s.car].mesh.position).toArray()};});
   assert.ok(landing.grounded&&landing.state==='ride');assert.equal(landing.mover,index);assert.ok(Math.abs(landing.y-landing.floor)<.05);assert.ok(landing.spins>0&&landing.climbFrames>10);
   if(axis==='x'&&sign===1)await page.screenshot({path:`${out}/${lite?'lite':'full'}-inside.png`});
   reports.push({lite,axis,sign,index,stamp,before,landing});
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS',reports.map(r=>({lite:r.lite,axis:r.axis,sign:r.sign,landing:r.landing.y,spins:r.landing.spins}))); 
}finally{fs.writeFileSync(out+'/results.json',JSON.stringify({base,reports,errors},null,2));await browser.close();}
