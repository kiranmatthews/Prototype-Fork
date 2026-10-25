import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5349').replace(/\/$/,'');
const phase=process.env.POLISH_PHASE||'before',capture=process.env.POLISH_CAPTURE==='1';
const output=resolve(process.env.POLISH_OUTPUT||'docs/slipstream-polish'),ledgerPath=resolve('docs/slipstream-polish/screenshots.json');
const views=[['entrance',0],['enclosed-flume',260],['forest-bend',600],['ruined-reservoir',1580],['broken-platform-pools',2680],['falling-coils',3430],['coastal-finish',3980]];
await mkdir(output+'/'+phase,{recursive:true});
const ledger=JSON.parse(await readFile(ledgerPath,'utf8').catch(()=>'[]'));
const selected=views.filter(([name])=>!process.env.POLISH_VIEWS||process.env.POLISH_VIEWS.split(',').includes(name));
if(capture)assert.ok(ledger.length+selected.length<=15,'The brief allows at most 15 screenshots across all passes.');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block'});
const page=await context.newPage(),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race${process.env.POLISH_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');
 await page.evaluate(()=>{const r=window.__game.getSkateRace();window.polishStep=r.step.bind(r);r.step=()=>{};});
 for(const [name,s] of selected){
  await page.evaluate(s=>{
   const g=window.__game,r=g.getSkateRace(),p=g.player;
   r.reset('time-trial');r.phase='running';r.elapsed=50;g.ui.deathFade(0);g.scene.updateMatrixWorld(true);
   let at=null;for(let d=0;d<=12&&!at;d+=.5)at=r.course.support(r.level,s+d);if(!at)throw Error('No supported floor at '+s);
   p.resetRacePosition(r.level,at,r.course.tangent(s));r.riders[0].progress=s;r.level.playerPos.copy(p.pos);
   for(let i=0;i<35;i++){g.scene.updateMatrixWorld(true);window.polishStep(1/60,r.drive(0));p.commitRenderStep(r.level);r.commitRenderStep();}
  },s);
  await page.waitForTimeout(2200);
  const state=await page.evaluate(()=>{
   const g=window.__game,r=g.getSkateRace();
   return {position:g.player.pos.toArray(),camera:g.camera.position.toArray(),grounded:g.player.grounded,state:g.player.state,
    falls:r.riders[0].falls,render:g.getRenderFrameStats(),assets:r.level.jungleAssets?.diagnostics,stamp:document.querySelector('.hud-build')?.textContent};
  });
  reports.push({name,s,...state});
  if(capture){
   const path=`${output}/${phase}/${name}.png`;
   ledger.push({number:ledger.length+1,phase,name,s,path:path.slice(output.length+1),createdAt:new Date().toISOString()});
   await writeFile(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
   await page.screenshot({path});
  }
  console.log(JSON.stringify({name,s,position:state.position,grounded:state.grounded,render:state.render,assetErrors:state.assets?.errors}));
 }
 await writeFile(`${output}/${phase}/report.json`,JSON.stringify({base,lite:!!process.env.POLISH_LITE,screenshots:ledger.length,reports,errors},null,2)+'\n');
 assert.deepEqual(errors,[]);assert.ok(reports.every(r=>r.assets?.errors.length===0));
}finally{await browser.close();}
