import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'));
const base=process.argv[2]??'http://127.0.0.1:5187/';
const out=process.env.SKYSTREAM_BONUS_OUTPUT??'/private/tmp/skystream-bonus-review';await mkdir(out,{recursive:true});
const bundled=await build({stdin:{contents:`
import {runSkystreamBonus} from './tools/skystream-bonus-pilot.mjs';
import {SKYSTREAM_BONUS_LEVEL,SKYSTREAM_BONUS_ISLANDS} from './src/levels/skystream-bonus';
window.installCloudBonusPilot=()=>{
 const g=window.__game,p=g.player,l=g.getLevel();
 const report=window.cloudBonusJourney={frame:0,stage:'start',done:false,error:null,actions:[],evidence:[]};
 const ctx={p,l,source:SKYSTREAM_BONUS_LEVEL,islands:SKYSTREAM_BONUS_ISLANDS,report,get frame(){return report.frame;}};
 const pilot=runSkystreamBonus(ctx);let next=pilot.next(),last={},advanced=false;
 const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
 p.step=(dt,input,level)=>{
  if(report.done)return step(dt,input,level);
  const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
  const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
  input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
  for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
   input[held]=sample[held]??false;const pressed=held.replace('Held','Pressed');input[pressed]=sample[pressed]??(input[held]&&!last[held]);
  }
  input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
  last={...sample};step(dt,input,level);advanced=true;
 };
 p.commitRenderStep=(...args)=>{
  commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
  try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;}}
  catch(e){report.done=true;report.error=String(e);}
  if(report.done){p.step=step;p.commitRenderStep=commit;report.end={state:p.state,position:p.pos.toArray(),crates:p.cratesBroken,deaths:p.totalDeaths};}
 };
};`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.setDefaultTimeout(180000);
const ready=id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id);
const snapshot=()=>page.evaluate(()=>{
 const g=window.__game,p=g.player,l=g.getLevel(),clouds=[];
 l.root.traverse(o=>{if(o.userData.cloudPlatformVisual)clouds.push(o);});
 return {id:g.getCurrentLevel().id,name:l.name,sourceName:l.captureData().name,grounded:p.grounded,position:p.pos.toArray(),state:p.state,
  lives:p.lives,fruit:p.fruit,deaths:p.totalDeaths,bonusCrates:p.bonusCrates,completed:l.bonusRoundCompleted,
  sameParent:l===window.cloudBonusParent,sky:l.skyPreset,clouds:clouds.length,
  contacts:l.groundMeshes.filter(o=>o.userData.cloudRoad).length,ropeSwings:l.ropeSwings.length,ropes:l.ropes.length,
  resolution:g.renderQualitySettings.regularResolution,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],
  stamp:document.querySelector('.hud-build')?.textContent,memory:g.renderer.info.memory,render:g.getRenderFrameStats()};
});
const report={base,errors};
try{
 // First check normal gravity and standalone recovery with the lite renderer.
 await page.goto(new URL('?playtest&level=bonus-skystream&lite',base).href);await ready('bonus-skystream');
 await page.waitForFunction(()=>window.__game.player.grounded);report.liteSpawn=await snapshot();
 assert.equal(report.liteSpawn.contacts,6);assert.equal(report.liteSpawn.clouds,12);
 await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:12000});
 await page.keyboard.up('ArrowLeft');
 await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride');
 report.liteRecovery=await snapshot();assert.ok(Math.abs(report.liteRecovery.position[0]+12)<.5);
 // Then exercise the real parent detour, including failure and rewards return.
 await page.goto(new URL('?playtest&level=skystream',base).href);await ready('skystream');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);window.cloudBonusParent=g.getLevel();});
 report.parent=await snapshot();assert.equal(report.parent.ropeSwings,0);assert.equal(report.parent.ropes,0);
 await page.evaluate(()=>window.__game.enterBonusRound());await ready('bonus:skystream');
 await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(()=>window.__game.player.state==='dead'||window.__game.getCurrentLevel().id==='skystream',null,{timeout:12000});
 await page.keyboard.up('ArrowLeft');await ready('skystream');
 report.failedReturn=await snapshot();assert.ok(report.failedReturn.sameParent);assert.equal(report.failedReturn.completed,false);
 for(const key of ['fruit','lives','deaths'])assert.equal(report.failedReturn[key],report.parent[key]);
 await page.evaluate(()=>window.__game.enterBonusRound());await ready('bonus:skystream');
 await page.waitForFunction(()=>window.__game.player.grounded);report.bonus=await snapshot();
 assert.equal(report.bonus.sourceName,'Bonus: Cumulus Cache');assert.equal(report.bonus.sky,'clouds');
 await page.screenshot({path:out+'/session-arrival-native.png'});
 await page.addScriptTag({content:bundled.outputFiles[0].text});await page.evaluate(()=>window.installCloudBonusPilot());
 let lastStage='',shot=false;
 for(let i=0;i<420;i++){
  await page.waitForTimeout(500);
  const state=await page.evaluate(()=>({frame:window.cloudBonusJourney.frame,stage:window.cloudBonusJourney.stage,done:window.cloudBonusJourney.done}));
  if(state.stage!==lastStage&&state.stage.startsWith('Cloud gap')){lastStage=state.stage;console.log(JSON.stringify(state));}
  if(!shot&&state.stage==='Cloud gap 3'){shot=true;await page.screenshot({path:out+'/session-jump-native.png'});}
  if(state.done)break;
 }
 report.journey=await page.evaluate(()=>window.cloudBonusJourney);assert.equal(report.journey.error,null);assert.ok(report.journey.done);
 assert.equal(report.journey.result.cratesBroken,18);assert.equal(report.journey.result.deaths,0);
 await ready('skystream');report.returned=await snapshot();assert.ok(report.returned.sameParent);assert.equal(report.returned.completed,true);
 assert.equal(report.returned.bonusCrates,18);assert.equal(report.returned.deaths,report.parent.deaths);
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});
 await page.waitForTimeout(1000);report.normal=await snapshot();await page.screenshot({path:out+'/parent-return-normal.png'});
 assert.deepEqual(errors,[]);
 await writeFile(out+'/browser-session.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({parent:report.parent,failedReturn:report.failedReturn,bonus:report.bonus,returned:report.returned,journey:report.journey.result,errors}));
}finally{await browser.close();}
