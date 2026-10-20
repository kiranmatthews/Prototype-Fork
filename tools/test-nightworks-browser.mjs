import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(v=>/^http/.test(v))||'http://127.0.0.1:5217';
const full=process.argv.includes('--full'),output=process.env.NIGHTWORKS_REVIEW_OUTPUT||'/private/tmp/nightworks-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.goto(`${base}/?playtest&level=nightworks-after-hours${full?'':'&lite'}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.player.preparePresentationAssets()]);});
 await page.screenshot({path:`${output}/entrance-${full?'full':'lite'}.png`});
 await page.evaluate(async()=>{
  const g=window.__game,p=g.player,l=g.getLevel(),source=await import('/src/levels/nightworks-after-hours.ts');
  const {createAfterHoursPilot}=await import('/tools/nightworks-pilot.mjs'),pilot=createAfterHoursPilot(source);
  p.respawn(l,true);let last={},advanced=false;
  const report=window.afterHoursReview={frame:0,done:false,failed:null,evidence:null,end:null,tuning:JSON.stringify(g.TUNING),mounted:true};
  const snap=()=>({position:p.pos.toArray(),speed:p.speed,state:p.state,mounted:p.boardRolling,bailing:p.isBailing,deaths:p.totalDeaths});
  const realStep=p.step.bind(p),realCommit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return;
   const sample=pilot.sample(p,l),keys=['moveX','moveY','jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld'];
   const next=Object.fromEntries(keys.map(k=>[k,k.startsWith('move')?0:false]));Object.assign(next,sample);
   const n=Math.hypot(next.moveX,next.moveY);if(n>1){next.moveX/=n;next.moveY/=n;}
   next.moveX=Math.round(next.moveX*100)/100;next.moveY=Math.round(next.moveY*100)/100;
   for(const held of keys.filter(k=>k.endsWith('Held')))next[held.replace('Held','Pressed')]=!!next[held]&&!last[held];
   next.jumpReleased=!next.jumpHeld&&!!last.jumpHeld;
   Object.assign(input,next);last=next;realStep(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{
   realCommit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;pilot.observe(p,l);report.end=snap();
   if(p.isBailing||['dead','gameover'].includes(p.state)){report.failed=snap();report.done=true;}
   if(p.state==='finished'){report.done=true;report.evidence=pilot.evidence;report.finalTuning=JSON.stringify(g.TUNING);}
   if(report.frame>7500){report.failed=snap();report.done=true;}
  };
 });
 const shots=new Set();
 for(let i=0;i<300;i++){
  await page.waitForTimeout(250);
  const r=await page.evaluate(()=>({done:window.afterHoursReview.done,z:window.__game.player.pos.z,y:window.__game.player.pos.y}));
  const shot=r.z<-550?'last-gap':r.z<-476?'summit-climb':r.z<-438?'quarry-session':r.z<-368?'moon-bridge':r.z<-210?'serpent-carve':r.z<-111?'freight-gap':null;
  if(shot&&!shots.has(shot)){await page.screenshot({path:`${output}/${shot}-${full?'full':'lite'}.png`});shots.add(shot);}
  if(r.done)break;
 }
 const report=await page.evaluate(()=>({review:window.afterHoursReview,stamp:document.querySelector('.hud-build')?.textContent,
  enemies:window.__game.getLevel().enemies.map(e=>({kind:e.kind,visual:e.visual.diagnostics}))}));
 await page.screenshot({path:`${output}/finish-${full?'full':'lite'}.png`});
 await writeFile(`${output}/route-${full?'full':'lite'}.json`,JSON.stringify({...report,errors},null,2));
 assert.equal(report.review.failed,null,JSON.stringify(report.review));assert.equal(report.review.done,true);
 assert.equal(report.review.end.state,'finished');assert.equal(report.review.evidence.gaps.length,3);assert.equal(report.review.evidence.footFrames,0);
 assert.deepEqual(report.review.evidence.checkpoints,[0,1,2]);assert.equal(report.review.tuning,report.review.finalTuning);
 assert.ok(report.enemies.every(e=>e.visual.status==='ready'&&e.visual.appearance==='nightworks'));
 assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 console.log(`PASS live ${full?'full':'lite'} browser: continuously mounted route, 3 gaps/checkpoints, Meshy goblins, clean console.`);
 // Original Nightworks loads the same goblin asset on its existing islands.
 await page.goto(`${base}/?playtest&level=dark${full?'':'&lite'}`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 const original=await page.evaluate(async()=>{const l=window.__game.getLevel();await l.prepareJungleAssets();return l.enemies.map(e=>({kind:e.kind,...e.visual.diagnostics}));});
 await page.screenshot({path:`${output}/original-${full?'full':'lite'}.png`});
 assert.equal(original.length,8);assert.ok(original.every(e=>e.status==='ready'&&e.appearance==='nightworks'));
 assert.deepEqual(errors,[]);console.log('PASS original Nightworks: eight themed goblins load with a clean console.');
} finally {await browser.close();}
