import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.argv[2]??'http://127.0.0.1:5277/';
const out=process.env.MAYFIELD_BONUS_OUTPUT??'/tmp/mayfield-bonus-review';await mkdir(out,{recursive:true});
const bundled=await build({stdin:{contents:`
import {runThemedBonusJourney} from './tools/themed-bonus-pilot.mjs';
import {runMayfieldBonusEntrance} from './tools/mayfield-bonus-entrance.mjs';
import {MAYFIELD_BONUS_COURSE,MAYFIELD_BONUS_SOURCE_TRIANGLES} from './src/levels/mayfield-bonus';
import {MAYFIELD_BONUS_ENTRY,MAYFIELD_CHECKPOINTS} from './src/levels/mayfield-mall';
window.mayfieldBonusFixture={entry:MAYFIELD_BONUS_ENTRY,checkpoint:MAYFIELD_CHECKPOINTS.findIndex(c=>c.name==='Crossrail arcade'),triangles:MAYFIELD_BONUS_SOURCE_TRIANGLES};
window.installMayfieldBonusPilot=(entrance=false)=>{
 const g=window.__game,p=g.player,l=g.getLevel();
 const report=window.mayfieldBonusJourney={frame:0,stage:'start',done:false,error:null,actions:[],evidence:[]};
 const ctx={p,l,source:MAYFIELD_BONUS_COURSE.data,course:MAYFIELD_BONUS_COURSE,entry:MAYFIELD_BONUS_ENTRY,id:'bonus-mayfield-mall',report,get frame(){return report.frame;}};
 report.sourceMatches=entrance||JSON.stringify(g.getCurrentLevel().data)===JSON.stringify(ctx.source);
 const pilot=(entrance?runMayfieldBonusEntrance:runThemedBonusJourney)(ctx);let next=pilot.next(),last={},advanced=false;
 const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
 p.step=(dt,input,level)=>{
  if(report.done)return step(dt,input,level);
  const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
  const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
  input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
  for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[held]=sample[held]??false;const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!last[held]);}
  input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
  last={...sample};step(dt,input,level);advanced=true;
 };
 p.commitRenderStep=(...args)=>{
  commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
  try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;}}
  catch(e){report.done=true;report.error=String(e);}
  if(report.done){p.step=step;p.commitRenderStep=commit;report.end={state:p.state,position:p.pos.toArray(),crates:p.cratesBroken,deaths:p.totalDeaths,fruit:p.fruit,lives:p.lives};}
 };
};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.setDefaultTimeout(180000);
const ready=id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id);
const snapshot=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{id:g.getCurrentLevel().id,name:g.getCurrentLevel().data.name,grounded:p.grounded,position:p.pos.toArray(),state:p.state,lives:p.lives,fruit:p.fruit,deaths:p.totalDeaths,bonusCrates:p.bonusCrates,completed:l.bonusRoundCompleted,sameParent:l===window.mayfieldBonusParent,platform:l.bonusPlatformDiagnostics,resolution:g.renderQualitySettings.regularResolution,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],stamp:document.querySelector('.hud-build')?.textContent};});
const report={base,errors};
async function awaitPilot(){await page.waitForFunction(()=>window.mayfieldBonusJourney.done);const r=await page.evaluate(()=>window.mayfieldBonusJourney);assert.equal(r.error,null);return r;}
async function leaveArrival(){
 await page.keyboard.down('ArrowLeft');await page.waitForTimeout(900);
 await page.keyboard.down('Space');await page.waitForTimeout(500);await page.keyboard.up('Space');
}
try{
 await page.goto(new URL('?playtest&level=bonus-mayfield-mall&lite',base).href);await ready('bonus-mayfield-mall');
 await page.waitForFunction(()=>window.__game.player.grounded);report.liteSpawn=await snapshot();
 assert.equal(report.liteSpawn.name,'Bonus: After Hours');await page.screenshot({path:out+'/bonus-lite.png'});
 await leaveArrival();await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:12000});await page.keyboard.up('ArrowLeft');
 await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride');report.liteRecovery=await snapshot();
 assert.ok(Math.abs(report.liteRecovery.position[0]+6)<.5);
 await page.goto(new URL('?playtest&level=mayfield-mall',base).href);await ready('mayfield-mall');
 await page.addScriptTag({content:bundled.outputFiles[0].text});
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);window.mayfieldBonusParent=g.getLevel();});
 if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
 const checkpoint=await page.evaluate(()=>window.mayfieldBonusFixture.checkpoint);
 for(let i=0;i<=checkpoint;i++){await page.keyboard.press('KeyL');await page.waitForFunction(i=>{const g=window.__game,l=g.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint)===i&&g.player.grounded;},i,{timeout:20000});}
 await page.keyboard.press('KeyM');await page.waitForTimeout(500);report.parent=await snapshot();
 assert.ok(report.parent.platform);await page.screenshot({path:out+'/arcade-entrance-native.png'});
 await page.evaluate(()=>window.installMayfieldBonusPilot(true));report.entrance=await awaitPilot();await ready('bonus:mayfield-mall');
 await leaveArrival();await page.waitForFunction(()=>window.__game.player.state==='dead'||window.__game.getCurrentLevel().id==='mayfield-mall',null,{timeout:12000});await page.keyboard.up('ArrowLeft');await ready('mayfield-mall');
 await page.waitForFunction(()=>window.__game.player.grounded);report.failedReturn=await snapshot();
 assert.ok(report.failedReturn.sameParent);assert.equal(report.failedReturn.completed,false);
 for(const key of ['fruit','lives','deaths'])assert.equal(report.failedReturn[key],report.entrance.end[key]);
 await page.evaluate(()=>window.installMayfieldBonusPilot(true));report.retryEntrance=await awaitPilot();await ready('bonus:mayfield-mall');
 await page.waitForFunction(()=>window.__game.player.grounded);report.bonus=await snapshot();
 assert.equal(report.bonus.name,'Bonus: After Hours');assert.equal(report.bonus.resolution,'max');assert.deepEqual(report.bonus.canvas,[1600,1000]);
 await page.screenshot({path:out+'/bonus-arrival-native.png'});
 await page.evaluate(()=>window.installMayfieldBonusPilot());
 const seen=new Set();
 for(let i=0;i<360;i++){
  await page.waitForTimeout(500);const s=await page.evaluate(()=>({stage:window.mayfieldBonusJourney.stage,done:window.mayfieldBonusJourney.done}));
  for(const [key,label]of [['high target','prize-counter'],['cross actual','service-bridge'],['rebound apex','last-tokens']])if(s.stage.includes(key)&&!seen.has(key)){seen.add(key);await page.screenshot({path:out+'/'+label+'-native.png'});console.log(s.stage);}
  if(s.done)break;
 }
 report.journey=await awaitPilot();assert.ok(report.journey.sourceMatches);assert.equal(report.journey.result.cratesBroken,8);assert.equal(report.journey.result.deaths,0);
 await ready('mayfield-mall');await page.waitForFunction(()=>window.__game.player.grounded);report.returned=await snapshot();
 assert.ok(report.returned.sameParent);assert.equal(report.returned.completed,true);assert.equal(report.returned.bonusCrates,8);assert.equal(report.returned.deaths,report.parent.deaths);
 assert.ok(report.returned.lives>=report.parent.lives+2);assert.ok(report.returned.fruit>report.parent.fruit);
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});
 await page.waitForTimeout(1000);report.normal=await snapshot();await page.screenshot({path:out+'/parent-return-normal.png'});
 assert.deepEqual(errors,[]);
 await writeFile(out+'/browser.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({parent:report.parent,failedReturn:report.failedReturn,returned:report.returned,journey:report.journey.result,errors}));
}catch(error){report.failure=String(error);report.current=await snapshot().catch(()=>null);report.pilot=await page.evaluate(()=>window.mayfieldBonusJourney).catch(()=>null);await writeFile(out+'/browser-failure.json',JSON.stringify(report,null,2));await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;}
finally{await browser.close();}
