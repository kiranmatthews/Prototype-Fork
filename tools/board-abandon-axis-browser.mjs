import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);let modulePath;
try{modulePath=require.resolve('playwright');}catch{modulePath=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(modulePath).href);
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',lite=process.argv.includes('--lite'),mode=lite?'lite':'full',out='docs/carlisle-relay/abandon-axis';
const fixture={id:'abandon-axis-browser',name:'Abandon axis keyboard review',data:{v:1,name:'Abandon axis keyboard review',spawn:[0,.05,0],killY:-200,
 components:[{t:'platform',p:[0,-.5,0],s:[500,1,500]},{t:'gate',p:[0,0,-200]}]}};
await mkdir(out,{recursive:true});const report={mode,base,errors:[],cases:[]};
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async fixture=>{const g=window.__game;g.campaign.startEphemeral();g.saveUserLevel(fixture);g.switchLevel(fixture.id);await g.getLevel().prepareJungleAssets();if(!g.lite){g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);}
  const p=g.player,step=p.step;window.abandonSamples=[];
  // Read each native fixed step without replacing its input or physics.
  p.step=function(...args){step.apply(this,args);if(this.emergencyEjectLandingPending&&window.abandonSamples.length<30){const v=this.axisF.clone().multiplyScalar(this.speed);window.abandonSamples.push({at:this.pos.toArray(),velocity:v.toArray(),raw:[this.rawInput.moveX,this.rawInput.moveY],vy:this.vVel,state:this.state,board:this.freeSkate,type:this.lastJumpType});}};
 },fixture);
 for(const [name,key,expected] of [['neutral',null,[0,0]],['forward','ArrowUp',[0,1]],['reverse','ArrowDown',[0,-1]],['left','ArrowLeft',[-1,0]],['right','ArrowRight',[1,0]]]){
  for(const k of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'])await page.keyboard.up(k);
  await page.evaluate(()=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(0,6,0),heading:p.pos.clone().set(0,0,-1)});
   p.state='air';p.grounded=false;p.groundHit=null;p.speed=24;p.vVel=0;p.freeSkate=true;p.airFromSkate=true;p.airGrav='board';p.boardOllieAir=true;p.airMomentum=true;window.abandonSamples=[];
  });
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.emergencyEjectCharging);await page.waitForTimeout(120);
  if(key)await page.keyboard.down(key);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.abandonSamples.length>=30,null,{timeout:15000});
  if(key)await page.keyboard.up(key);
  const points=await page.evaluate(()=>window.abandonSamples),first=points[0],last=points.at(-1),maxSide=Math.max(...points.map(p=>Math.abs(p.at[0])));
  assert.ok(points.every(p=>p.state==='air'&&!p.board&&p.type==='Emergency Eject'));assert.deepEqual(first.raw,expected);
  if(['neutral','forward','reverse'].includes(name))assert.ok(maxSide<1e-7,`${name} invented ${maxSide}m of side travel`);
  if(name==='reverse'){assert.ok(points[11].velocity[2]<0,'back arrow discarded forward carry immediately');assert.ok(last.velocity[2]>1,'back arrow did not reverse on the same line');}
  if(name==='neutral'||name==='forward')assert.ok(Math.abs(last.velocity[2]+24)<1e-7);
  if(name==='left'||name==='right')assert.ok(Math.abs(last.at[0])>5&&Math.abs(Math.hypot(...last.velocity)-24)<1e-7);
  report.cases.push({name,key,maxSide,points});
  if(name==='reverse'||name==='forward')await page.screenshot({path:`${out}/${mode}-${name}.png`});
 }
 const left=report.cases.find(c=>c.name==='left').points,right=report.cases.find(c=>c.name==='right').points;
 for(let i=0;i<30;i++)assert.ok(Math.abs(left[i].at[0]+right[i].at[0])<1e-7,'keyboard turns do not mirror');
 report.source=await page.evaluate(()=>({build:document.querySelector('.hud-build')?.textContent,canvas:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]}));
 if(!lite)assert.deepEqual(report.source.canvas,[1440,900]);
 assert.deepEqual(report.errors,[]);console.log('PASS',JSON.stringify({mode,cases:report.cases.map(c=>({name:c.name,maxSide:c.maxSide})),source:report.source,errors:report.errors}));
}catch(e){report.failure=e.message;throw e;}
finally{for(const k of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'])await page.keyboard.up(k).catch(()=>{});await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
