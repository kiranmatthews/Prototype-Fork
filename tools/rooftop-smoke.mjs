import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5261').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'/private/tmp/rooftop-city-smoke';await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:['src/levels/codex-lab.ts'],bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/rooftop-smoke-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=rooftop-relay&lite`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.keyboard.press('KeyM');await page.getByRole('button',{name:'MENU',exact:true}).click();await page.locator('.hud-levelplay[title="Rooftop Relay"]').click();await page.getByRole('button',{name:'MENU',exact:true}).click();
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:60000});
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
 await page.waitForFunction(()=>window.__game.gameFlow.developerChromeVisible);
 const count=await page.evaluate(()=>window.__game.getLevel().checkpoints.length);assert.equal(count,await page.evaluate(async()=>{const m=await import('/rooftop-smoke-fixture.js');return m.ROOFTOP_CHECKPOINTS.length;}));
 for(let i=0;i<count;i++){await page.keyboard.press('KeyL');await page.waitForFunction(i=>{const g=window.__game,l=g.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint)===i&&g.player.grounded;},i,{timeout:10000});}
 await page.keyboard.press('KeyK');await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return g.player.pos.distanceTo(l.checkpoints[l.checkpoints.length-2].spawnPos)<1;}));
 await page.keyboard.press('KeyL');await page.waitForTimeout(150);await page.keyboard.press('KeyM');
 await page.evaluate(async()=>{
  const m=await import('/rooftop-smoke-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),spec=m.ROOFTOP_CHECKPOINTS.at(-1),roof=m.ROOFTOP_ROOFS[spec.index],cp=l.activeCheckpoint;
  const yaw=m.rooftopYaw(spec.s)*Math.PI/180,right=[Math.cos(yaw),0,-Math.sin(yaw)],target=m.rooftopWorld(spec.s,roof.top,roof.width/2-2);
  const report=window.rooftopSmoke={phase:'approach',frames:0,phaseFrames:0,dead:false,returned:false,continued:false,livesBefore:p.lives,checkpoint:l.checkpoints.indexOf(cp),checkpointsChecked:l.checkpoints.length,stamp:document.querySelector('.hud-build')?.textContent,sourceMatches:JSON.stringify(m.ROOFTOP_RELAY_LEVEL)===JSON.stringify(g.getCurrentLevel().data)};
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let sample={};
  const steer=(x,z,pace=1)=>{const dx=x-p.pos.x,dz=z-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return{moveX:(dx*-f.z+dz*f.x)/n*pace,moveY:(dx*f.x+dz*f.z)/n*pace};};
  const phase=name=>{report.phase=name;report.phaseFrames=0;};
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0;return{id:'Rooftop city recovery controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&!!sample.jumpHeld,touched:false,value:i===0&&sample.jumpHeld?1:0}))};};
  p.step=(dt,input,level)=>{
   if(report.continued)return;report.frames++;report.phaseFrames++;sample={};
   if(report.phase==='approach'){sample=steer(target[0],target[2],.65);if(Math.hypot(p.pos.x-target[0],p.pos.z-target[2])<.5)phase('settle');}
   if(report.phase==='settle'&&report.phaseFrames>35)phase('charge');
   if(report.phase==='charge'){sample={jumpHeld:true};if(report.phaseFrames>25){phase('fall');sample=steer(p.pos.x+right[0]*30,p.pos.z+right[2]*30);}}
   if(report.phase==='fall')sample=steer(p.pos.x+right[0]*30,p.pos.z+right[2]*30);
   if(report.phase==='continue'){const q=m.rooftopPoint(spec.s+12);sample=steer(q[0],q[2],.7);}
   update();step(dt,input,level);report.position=p.pos.toArray();report.state=p.state;
   if(p.state==='dead'&&!report.dead){report.dead=true;report.deathFrame=report.frames;phase('wait');}
   if(report.dead&&!report.returned&&p.state==='ride'&&p.grounded){report.returned=true;report.returnFrame=report.frames;report.livesAfter=p.lives;report.returnDistance=p.pos.distanceTo(cp.spawnPos);report.activeCheckpoint=l.checkpoints.indexOf(l.activeCheckpoint);phase('continue');}
   if(report.returned&&p.pos.distanceTo(cp.spawnPos)>5){report.continued=true;phase('done');}
  };
 });
 await page.waitForFunction(()=>window.rooftopSmoke.continued,null,{timeout:120000});
 const report=await page.evaluate(()=>window.rooftopSmoke);await page.screenshot({path:`${out}/checkpoint-return.png`});await writeFile(`${out}/smoke.json`,JSON.stringify({base,report,errors},null,2));console.log(JSON.stringify({base,report,errors},null,2));
 assert.equal(report.dead,true);assert.equal(report.returned,true);assert.equal(report.continued,true);assert.equal(report.livesBefore-report.livesAfter,1);assert.equal(report.activeCheckpoint,count-1);assert.ok(report.returnDistance<1);assert.equal(report.sourceMatches,true);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
}finally{await browser.close();}
