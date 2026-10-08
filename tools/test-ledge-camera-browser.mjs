import assert from 'node:assert/strict';
import fs from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.argv[2]||'http://127.0.0.1:5317/';const out=process.env.LEDGE_CAMERA_OUTPUT || '/private/tmp/ledge-camera-review';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});const reports=[],errors=[];
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'?playtest&level=crate-primer'+(lite?'&lite':''));
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(()=>{
   const g=window.__game,p=g.player;const step=p.step.bind(p);
   const probe={input:{},rows:[],mode:'idle',age:0};window.__ledgeReview=probe;
   p.step=(dt,input,l)=>{
    probe.age+=dt;const held=probe.input;const prev=probe.prev||{};
    const sample={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,spinHeld:false,spinPressed:false,
     grabHeld:false,grabPressed:false,grindHeld:false,grindPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,...held};
    if(!('jumpPressed'in held))sample.jumpPressed=sample.jumpHeld&&!prev.jumpHeld;
    if(!('jumpReleased'in held))sample.jumpReleased=!sample.jumpHeld&&!!prev.jumpHeld;
    if(!('spinPressed'in held))sample.spinPressed=sample.spinHeld&&!prev.spinHeld;
    step(dt,sample,l);probe.prev=sample;
    probe.rows.push({state:p.state,phase:p.ledgePhase,position:p.pos.toArray(),spin:p.spinning,grounded:p.grounded,v:p.vVel});
   };
   probe.place=(x,y,z=0)=>{p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(x,y,z)});probe.input={};probe.prev={};probe.rows=[];probe.age=0;};
  });
  await page.waitForTimeout(350);
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
  const ground=await page.evaluate(()=>{const g=window.__game;return{pos:g.player.pos.toArray(),eye:g.player.cam.position.toArray(),grounded:g.player.grounded};});assert.ok(ground.grounded);
  await page.screenshot({path:out+`/${lite?'lite':'full'}-camera.png`});
  // Actual key-gallery lip, with the source-owned reward crate still in place.
  await page.evaluate(()=>{const s=window.__ledgeReview,p=window.__game.player;s.place(65.47,6.8);p.state='air';p.vVel=-1;s.input={moveX:1};});
  await page.waitForFunction(()=>window.__game.player.state==='hang',null,{timeout:7000});
  await page.evaluate(()=>{window.__ledgeReview.input={spinHeld:true,moveX:1};});
  await page.waitForFunction(()=>window.__game.player.spinning,null,{timeout:7000});
  await page.screenshot({path:out+`/${lite?'lite':'full'}-ledge-spin.png`});
  await page.waitForFunction(()=>{const g=window.__game,p=g.player;return p.grounded&&p.pos.x>66&&p.pos.y>7.9;},null,{timeout:7000});
  await page.evaluate(()=>{window.__ledgeReview.input={};});
  const ledge=await page.evaluate(()=>{const g=window.__game,p=g.player;const c=g.getLevel().crates.find(c=>Math.abs(c.box.getCenter(p.pos.clone()).x-67)<.01);return{p:p.pos.toArray(),crateAlive:c?.alive,states:[...new Set(window.__ledgeReview.rows.map(r=>r.state))],spinFrames:window.__ledgeReview.rows.filter(r=>r.spin).length};});
  assert.equal(ledge.crateAlive,false,'real gallery crate still blocked the mantle');assert.ok(ledge.spinFrames>0);
  await page.screenshot({path:out+`/${lite?'lite':'full'}-gallery.png`});
  // Real jump on safe source ground: collect camera projection during flight.
  await page.evaluate(()=>{const s=window.__ledgeReview;s.place(-5,.03);s.input={jumpHeld:true};});
  await page.waitForTimeout(450);await page.evaluate(()=>{window.__ledgeReview.input={};});
  await page.waitForFunction(()=>window.__game.player.state==='air');
  await page.waitForTimeout(200);await page.screenshot({path:out+`/${lite?'lite':'full'}-jump.png`});
  const jump=await page.evaluate(()=>{const p=window.__game.player,c=p.cam;return{y:p.pos.y,eye:c.position.toArray(),feet:p.pos.clone().project(c).toArray(),head:p.pos.clone().add(p.pos.clone().set(0,2.8,0)).project(c).toArray()};});
  assert.ok(jump.feet[1]>-1&&jump.head[1]<1,'side jump left close camera');
  await page.waitForFunction(()=>window.__game.player.grounded);
  // Normal kill-plane fall followed by normal respawn.
  await page.evaluate(()=>{const s=window.__ledgeReview,p=window.__game.player;s.place(18,-2);p.state='air';p.vVel=-3;});
  await page.waitForFunction(()=>window.__ledgeReview.rows.some(r=>r.state==='dead'),null,{timeout:10000});
  await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.pos.x<0,null,{timeout:10000});
  // Checkpoint and finish use their real collision paths.
  await page.evaluate(()=>{const s=window.__ledgeReview;s.place(57.8,.62);s.input={moveX:1,spinHeld:true};});
  await page.waitForFunction(()=>window.__game.getLevel().checkpoints.some(c=>c.active),null,{timeout:5000});
  await page.evaluate(()=>{const s=window.__ledgeReview;s.place(153,1.22);s.input={moveX:1};});
  await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:5000});
  reports.push({lite,stamp,ground,ledge,jump,pitRespawn:true,checkpoint:true,finish:true});
  await page.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS',JSON.stringify(reports));
}finally{fs.writeFileSync(out+'/results.json',JSON.stringify({base,reports,errors},null,2));await browser.close();}
