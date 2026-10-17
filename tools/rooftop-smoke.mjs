import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:58003').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'/private/tmp/rooftop-production';await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:['src/levels/codex-lab.ts'],bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/rooftop-smoke-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=rooftop-relay&lite`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.keyboard.press('KeyM');await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.locator('.hud-levelplay[title="Rooftop Relay"]').click();await page.getByRole('button',{name:'MENU',exact:true}).click();await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:60000});
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
 await page.waitForFunction(()=>window.__game.gameFlow.developerChromeVisible);
 assert.equal(await page.evaluate(()=>window.__game.player.grounded),true);
 for(let i=0;i<4;i++){await page.keyboard.press('KeyL');await page.waitForFunction(i=>{const l=window.__game.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint)===i;},i,{timeout:10000});}
 await page.keyboard.press('KeyK');await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>{const g=window.__game;return g.player.pos.distanceTo(g.getLevel().checkpoints[2].spawnPos)<1;}));
 await page.keyboard.press('KeyL');await page.waitForTimeout(100);await page.keyboard.press('KeyM');
 await page.evaluate(async()=>{
  const m=await import('/rooftop-smoke-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),roof=m.ROOFTOP_ROOFS[11],cp=l.activeCheckpoint;
  const r=window.rooftopSmoke={phase:'approach',frames:0,phaseFrames:0,dead:false,returned:false,continued:false,livesBefore:p.lives,checkpoint:l.checkpoints.indexOf(cp),stamp:document.querySelector('.hud-build')?.textContent};
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let sample={};
  const steer=(x,z,pace=1)=>{const dx=x-p.pos.x,dz=z-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return{moveX:(dx*-f.z+dz*f.x)/n*pace,moveY:(dx*f.x+dz*f.z)/n*pace};};
  const phase=name=>{r.phase=name;r.phaseFrames=0;};
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0;return{id:'Rooftop recovery controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&!!sample.jumpHeld,touched:false,value:i===0&&sample.jumpHeld?1:0}))};};
  p.step=(dt,input,level)=>{
   r.frames++;r.phaseFrames++;sample={};
   if(r.phase==='approach'){sample=steer(roof.x+roof.width/2-2,cp.spawnPos.z,.7);if(Math.hypot(p.pos.x-(roof.x+roof.width/2-2),p.pos.z-cp.spawnPos.z)<.6)phase('settle');}
   if(r.phase==='settle'&&r.phaseFrames>35)phase('charge');
   if(r.phase==='charge'){sample={jumpHeld:true};if(r.phaseFrames>25){phase('fall');sample=steer(roof.x+40,p.pos.z);}}
   if(r.phase==='fall')sample=steer(roof.x+40,p.pos.z);
   if(r.phase==='resume')sample=steer(cp.spawnPos.x,cp.spawnPos.z-8);
   update();step(dt,input,level);
   if(p.state==='dead'&&!r.dead){r.dead=true;r.deathFrame=r.frames;phase('wait');}
   if(r.dead&&!r.returned&&p.grounded&&p.state==='ride'&&!p.isBailing){r.returned=true;r.returnFrame=r.frames;r.livesAfter=p.lives;r.returnDistance=p.pos.distanceTo(cp.spawnPos);r.activeCheckpoint=l.checkpoints.indexOf(l.activeCheckpoint);phase('resume');}
   if(r.phase==='resume'&&p.pos.distanceTo(cp.spawnPos)>5){r.continued=true;phase('done');}
   r.position=p.pos.toArray();r.state=p.state;
  };
 });
 await page.waitForFunction(()=>window.rooftopSmoke?.continued,null,{timeout:90000});
 await page.screenshot({path:`${out}/smoke-checkpoint-return.png`});
 const report=await page.evaluate(()=>window.rooftopSmoke);
 assert.equal(report.dead,true);assert.equal(report.returned,true);assert.equal(report.livesBefore-report.livesAfter,1);assert.equal(report.activeCheckpoint,3);assert.ok(report.returnDistance<1);assert.deepEqual(errors,[]);assert.match(report.stamp,/Codex\/sol fork/);
 await writeFile(`${out}/smoke.json`,JSON.stringify({base,report,errors},null,2));console.log(JSON.stringify({base,report,errors},null,2));
}finally{await browser.close();}
