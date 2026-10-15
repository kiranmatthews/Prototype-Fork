import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5246').replace(/\/$/,'');
const out=process.env.COUNTRY_CLUB_OUTPUT||`${tmpdir()}/country-club-v2-browser`;await mkdir(out,{recursive:true});
const full=process.argv.includes('--full');
const fixture=await build({entryPoints:['src/levels/country-club.ts'],bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/club-smoke-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=country-club${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='country-club'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.keyboard.press('KeyM');await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.locator('.hud-levelplay[title="Country Club Circuit"]').click();await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.waitForTimeout(350);
 const spawn=await page.evaluate(()=>({id:window.__game.getCurrentLevel().id,grounded:window.__game.player.grounded,race:window.__game.getSkateRace()?.active??false}));
 assert.equal(spawn.id,'country-club');assert.equal(spawn.grounded,true);assert.equal(spawn.race,false);
 for(let i=0;i<5;i++){await page.keyboard.press('KeyL');await page.waitForTimeout(120);}
 assert.equal(await page.evaluate(()=>{const l=window.__game.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint);}),4);
 await page.keyboard.press('KeyM');
 await page.evaluate(async()=>{
  const m=window.clubSource=await import('/club-smoke-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let sample={},streak=0;
  const cp=m.COUNTRY_CLUB_CHECKPOINTS[4],sandTarget=m.countryClubPoint(cp+5,45);
  const r=window.clubReview={mode:'sand',frames:0,softFrames:0,softSpeeds:[],drySpeed:0,returnedToFairway:false,boundary:null};
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0;return{id:'Country Club ground validation',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&!!sample.jumpHeld,touched:false,value:i===0&&sample.jumpHeld?1:0}))};};
  const steer=q=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return{moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};};
  p.step=(dt,input,level)=>{
   r.frames++;sample={};
   if(r.mode==='sand')sample={...steer(sandTarget),jumpHeld:true};
   if(r.mode==='resume')sample={...steer(m.countryClubPoint(cp+16)),jumpHeld:true};
   if(r.mode==='return')sample={...steer(m.countryClubPoint(m.countryClubProgress(p.pos,cp)+12)),jumpHeld:true};
   if(r.mode==='boundaryCharge'){sample={jumpHeld:true};if(++r.boundary.charge>32)r.mode='boundaryFlight';}
   if(r.mode==='boundaryFlight')sample=steer([m.COUNTRY_CLUB_BOUNDS.maxX+30,0,0]);
   update();step(dt,input,level);
   if(r.mode==='sand'&&p.grounded&&p.groundHit?.groundSpeedLimit){r.softFrames++;streak++;if(streak>40)r.softSpeeds.push(p.speed);if(r.softFrames>=150)r.mode='return';}
   if(r.mode==='return'&&p.grounded&&!p.groundHit?.groundSpeedLimit&&p.speed>18){r.drySpeed=p.speed;r.returnedToFairway=true;r.mode='ready';}
   if(r.mode==='resume'&&p.grounded&&p.pos.distanceTo(l.checkpoints[4].spawnPos)>6){r.boundary.continued=true;r.mode='done';}
   if(r.boundary&&p.state==='dead'){r.boundary.dead=true;r.mode='waiting';}
   if(r.mode==='waiting'&&p.state==='ride'&&p.grounded){r.boundary.returned=true;r.boundary.livesAfter=p.lives;r.boundary.checkpoint=l.checkpoints.indexOf(l.activeCheckpoint);r.boundary.distance=p.pos.distanceTo(l.checkpoints[4].spawnPos);r.mode='done';}
  };
 });
 await page.waitForFunction(()=>window.clubReview.returnedToFairway,null,{timeout:60000});
 await page.screenshot({path:`${out}/sand-return-${full?'full':'lite'}.png`});
 const sand=await page.evaluate(()=>window.clubReview);assert.ok(sand.softFrames>=150);assert.ok(Math.max(...sand.softSpeeds)<=2.41);assert.ok(sand.drySpeed>18);
 // Focused failure probe begins at the far landscape edge. The separate
 // complete journey is input-only; this initial placement isolates respawn.
 await page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),m=window.clubSource,x=m.COUNTRY_CLUB_BOUNDS.maxX-1;
  p.pos.set(x,m.countryClubGroundHeight(x,0)+.1,0);l.playerPos.copy(p.pos);p.laneCursor.s=-1;p.settle(l,p.axisF.clone().set(1,0,0));
  window.clubReview.boundary={initialPlacement:'outer landscape edge',charge:0,dead:false,returned:false,livesBefore:p.lives};window.clubReview.mode='boundaryCharge';
 });
 await page.waitForFunction(()=>window.clubReview.boundary.returned,null,{timeout:30000});
 const recovery=await page.evaluate(()=>window.clubReview.boundary);
 assert.equal(recovery.checkpoint,4);assert.ok(recovery.distance<2);assert.equal(recovery.livesBefore-recovery.livesAfter,1);
 await page.waitForTimeout(800);await page.evaluate(()=>{window.clubReview.mode='resume';});
 await page.waitForFunction(()=>window.clubReview.boundary.continued,null,{timeout:12000});
 recovery.continued=true;
 await page.screenshot({path:`${out}/checkpoint-return-${full?'full':'lite'}.png`});
 const overview=await page.evaluate(()=>{
  const g=window.__game,m=window.clubSource,c=g.camera.clone(),mid=(m.COUNTRY_CLUB_BOUNDS.minZ+m.COUNTRY_CLUB_BOUNDS.maxZ)/2;
  c.position.set(1050,1800,mid+1200);c.lookAt(0,0,mid);c.fov=50;c.near=50;c.far=6000;c.updateProjectionMatrix();
  const r=g.renderer,fog=g.scene.fog,ratio=r.getPixelRatio(),w=r.domElement.width/ratio,h=r.domElement.height/ratio;
  g.scene.fog=null;r.setRenderTarget(null);r.setSize(1440,900,false);r.render(g.scene,c);
  const data=r.domElement.toDataURL('image/png');g.scene.fog=fog;r.setSize(w,h,false);return data.split(',')[1];
 });
 await writeFile(`${out}/overview.png`,Buffer.from(overview,'base64'));
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 const report={base,spawn,sand:{frames:sand.softFrames,maxSpeed:Math.max(...sand.softSpeeds),dryReturnSpeed:sand.drySpeed},recovery,stamp,errors};
 await writeFile(`${out}/smoke-${full?'full':'lite'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){console.log(JSON.stringify(await page.evaluate(()=>({review:window.clubReview,position:window.__game?.player.pos.toArray(),state:window.__game?.player.state,speed:window.__game?.player.speed,ground:window.__game?.player.groundHit?.name,limit:window.__game?.player.groundHit?.groundSpeedLimit,checkpoint:window.__game?.getLevel().checkpoints.indexOf(window.__game?.getLevel().activeCheckpoint)}))));await page.screenshot({path:`${out}/smoke-failure.png`});throw error;}finally{await browser.close();}
