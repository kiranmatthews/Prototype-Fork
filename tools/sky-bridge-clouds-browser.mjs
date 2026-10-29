import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5188/',lite=process.argv.includes('--lite'),smoke=process.argv.includes('--smoke');
const out=process.env.SKY_CLOUD_OUTPUT||'/private/tmp/sky-bridge-cloud-browser';await mkdir(out,{recursive:true});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
let source;
try{const m=await server.ssrLoadModule('/src/levels/sky-bridge.ts');source={SKY_BRIDGE_LEVEL:{components:m.SKY_BRIDGE_LEVEL.components.filter(c=>c.t==='platform'||c.t==='crumble')},SKY_BRIDGE_GRIND_CROSSINGS:m.SKY_BRIDGE_GRIND_CROSSINGS,SKY_BRIDGE_SKATE_GAPS:m.SKY_BRIDGE_SKATE_GAPS};}finally{await server.close();}
const pilot=(await readFile(new URL('./sky-bridge-pilot.mjs',import.meta.url),'utf8')).replace(/^export /gm,'');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[],report={base,lite,smoke};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
const snap=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel(),data=l.captureData();return {level:g.getCurrentLevel().id,stamp:document.querySelector('.hud-build')?.textContent,position:g.player.pos.toArray(),grounded:g.player.grounded,cloudPass:g.cloudPathPass.diagnostics,cloudContacts:l.groundMeshes.filter(m=>m.userData.cloudRoad).length,gate:data.components.find(c=>c.t==='gate')?.p,checkpoints:l.checkpoints.length,resolution:g.renderQualitySettings.regularResolution,canvas:[g.renderer.domElement.width,g.renderer.domElement.height]};});
const place=z=>page.evaluate(z=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(0,.12,z),heading:p.pos.clone().set(0,0,-1)});},z);
try{
 await page.goto(`${base}?playtest&level=sky${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});await ready('sky');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});await page.waitForTimeout(800);
 report.spawn=await snap();assert.equal(report.spawn.grounded,true);assert.match(report.spawn.stamp,/Codex\/sol fork/);
 assert.equal(report.spawn.cloudContacts,2);assert.equal(report.spawn.cloudPass.clouds,12);assert.equal(report.spawn.cloudPass.height,360);assert.equal(report.spawn.gate[2],-483);assert.equal(report.spawn.checkpoints,7);
 if(!lite)assert.deepEqual(report.spawn.canvas,[1600,1000]);
 await page.screenshot({path:out+'/spawn-native.png'});
 if(smoke){await place(-150);await page.waitForTimeout(500);await page.screenshot({path:out+'/cloud-step-native.png'});await place(-236);}
 await page.addScriptTag({content:`(()=>{${pilot}\nconst source=${JSON.stringify(source)},g=window.__game,p=g.player,l=g.getLevel(),pilot=createSkyBridgePilot(source),step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
 const review=window.__skyCloudReview={frame:0,finished:false,failed:null,evidence:pilot.evidence};
 p.step=(dt,input,level)=>{if(review.finished||review.failed)return step(dt,input,level);const request=pilot.sample(p,level),previous=p.rawInput;
  const sample={...input,moveX:request.moveX??0,moveY:request.moveY??0,restartPressed:false};
  const length=Math.max(1,Math.hypot(sample.moveX,sample.moveY));sample.moveX=Math.round(sample.moveX/length*100)/100;sample.moveY=Math.round(sample.moveY/length*100)/100;
  for(const held of ['jumpHeld','spinHeld','grindHeld','grabHeld','transferHeld']){sample[held]=request[held]??false;sample[held.replace('Held','Pressed')]=sample[held]&&!previous[held];}sample.jumpReleased=!sample.jumpHeld&&previous.jumpHeld;step(dt,sample,level);};
 p.commitRenderStep=(...args)=>{commit(...args);if(review.finished||review.failed)return;review.frame++;pilot.observe(p,l);review.finished=p.state==='finished';
  if(p.isBailing||p.totalDeaths||['dead','gameover'].includes(p.state))review.failed='Failed at '+JSON.stringify(p.pos.toArray());};})();`});
 const shots=new Set();let state;
 for(let i=0;i<1400;i++){
  await page.waitForTimeout(150);state=await page.evaluate(()=>({review:window.__skyCloudReview,position:window.__game.player.pos.toArray(),state:window.__game.player.state}));
  const z=state.position[2];
  const rail=state.state==='grind'?source.SKY_BRIDGE_GRIND_CROSSINGS.findIndex(c=>z<c.near-8&&z>c.far+2):-1;
  const gap=state.state==='air'?source.SKY_BRIDGE_SKATE_GAPS.findIndex(g=>z<g.takeoff-1&&z>g.landing):-1;
  const key=rail>=0?['windline-grind','cloudbell-grind'][rail]:gap>=0?['cloudbreak-jump','last-flight'][gap]:null;
  if(key&&!shots.has(key)){shots.add(key);await page.screenshot({path:`${out}/${key}-native.png`});}
  if(state.review.finished||state.review.failed)break;
 }
 report.route=state;assert.equal(state.review.failed,null);assert.equal(state.review.finished,true);assert.ok(state.review.evidence.grindFrames.every(n=>n>60));assert.equal(state.review.evidence.gaps.length,2);
 assert.equal(state.review.evidence.checkpoints.length,smoke?4:7);
 if(!smoke){assert.equal(state.review.evidence.ice.length,3);assert.equal(state.review.evidence.falling.length,7);}
 await writeFile(out+'/route.json',JSON.stringify(report,null,2));console.log('PASS course traversal');
 // Native and selected-resolution views of the same clouds; all non-cloud
 // geometry continues through the game's normal full-resolution pipeline.
 // Fresh navigation also dismisses the finish/results presentation and removes
 // the input pilot before independent visual fixtures.
 await page.goto(`${base}?playtest&level=sky${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});await ready('sky');await place(-309);
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(500);
 report.normal=await snap();assert.equal(report.normal.cloudPass.height,360);await page.screenshot({path:out+'/receiver-normal.png'});
 if(!lite)assert.deepEqual(report.normal.canvas,[1152,720]);
 await page.evaluate(()=>window.__game.enterBonusRound());await ready('bonus:sky');await page.waitForTimeout(800);
 report.bonus=await snap();assert.equal(report.bonus.cloudContacts,2);assert.equal(report.bonus.cloudPass.clouds,6);assert.equal(report.bonus.cloudPass.height,360);
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(25,.12,0),heading:p.pos.clone().set(1,0,0)});});await page.waitForTimeout(650);
 await page.screenshot({path:out+'/bonus-clouds-native.png'});report.bonusNative=await snap();assert.equal(report.bonusNative.cloudPass.height,360);
 report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify(report));
}finally{await browser.close();}
