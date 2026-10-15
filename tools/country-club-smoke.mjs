import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5244').replace(/\/$/,'');
const out=process.env.COUNTRY_CLUB_OUTPUT||`${tmpdir()}/country-club-browser`;await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
  await page.goto(`${base}/?playtest&level=country-club&lite`,{timeout:120000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='country-club'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.keyboard.press('KeyM');
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.locator('.hud-levelplay[title="Country Club Circuit"]').click();
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.waitForTimeout(500);
  const spawn=await page.evaluate(()=>({id:window.__game.getCurrentLevel().id,grounded:window.__game.player.grounded,position:window.__game.player.pos.toArray(),race:window.__game.getSkateRace()?.active??false}));
  assert.equal(spawn.id,'country-club');assert.equal(spawn.grounded,true);assert.equal(spawn.race,false);
  for(let i=0;i<5;i++){await page.keyboard.press('KeyL');await page.waitForTimeout(150);}
  const cp=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {index:l.checkpoints.indexOf(l.activeCheckpoint),position:g.player.pos.toArray()};});
  assert.equal(cp.index,4);
  await page.evaluate(()=>{
    const g=window.__game,p=g.player,l=g.getLevel(),step=p.step.bind(p),update=g.input.update.bind(g.input);
    const target=p.pos.clone();target.x-=p.axisF.z*40;target.z+=p.axisF.x*40;
    let sample={moveX:0,moveY:0,jumpHeld:false};
    window.clubRecovery={dead:false,returned:false,frames:0,livesBefore:p.lives};
    g.input.pollGamepad=()=>{const n=Math.hypot(sample.moveX,sample.moveY),a=n?.22+.78*Math.min(1,n):0;return {id:'Recovery validation',index:0,connected:true,mapping:'standard',axes:n?[sample.moveX/n*a,-sample.moveY/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&sample.jumpHeld,touched:false,value:i===0&&sample.jumpHeld?1:0}))};};
    p.step=(dt,input,level)=>{
      const r=window.clubRecovery;r.frames++;
      if(p.totalDeaths||p.state==='dead'){r.dead=true;sample={moveX:0,moveY:0,jumpHeld:false};}
      else {const dx=target.x-p.pos.x,dz=target.z-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;sample={moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n,jumpHeld:true};}
      update();step(dt,input,level);
      if(r.dead&&p.state==='ride'&&p.grounded){r.returned=true;r.position=p.pos.toArray();r.checkpoint=l.checkpoints.indexOf(l.activeCheckpoint);r.distance=p.pos.distanceTo(l.checkpoints[4].spawnPos);r.livesAfter=p.lives;}
    };
  });
  await page.waitForFunction(()=>window.clubRecovery.returned,null,{timeout:30000});
  const recovery=await page.evaluate(()=>window.clubRecovery);
  await page.screenshot({path:`${out}/recovery.png`});
  assert.equal(recovery.checkpoint,4);assert.ok(recovery.distance<2);assert.equal(recovery.livesBefore-recovery.livesAfter,1);
  // A temporary survey camera is only used for this stored layout image.
  const overview=await page.evaluate(()=>{
    const g=window.__game,c=g.camera.clone();c.position.set(245,310,275);c.lookAt(5,3,-48);c.fov=43;c.far=2000;c.updateProjectionMatrix();
    const fog=g.scene.fog,r=g.renderer,ratio=r.getPixelRatio(),w=r.domElement.width/ratio,h=r.domElement.height/ratio;
    g.scene.fog=null;r.setRenderTarget(null);r.setSize(1440,900,false);r.render(g.scene,c);
    const data=r.domElement.toDataURL('image/png');g.scene.fog=fog;r.setSize(w,h,false);return data.split(',')[1];
  });
  await writeFile(`${out}/overview.png`,Buffer.from(overview,'base64'));
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
  const report={base,spawn,checkpoint:cp,recovery,stamp,errors};await writeFile(`${out}/smoke.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
