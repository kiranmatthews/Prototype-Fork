import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/race-speedometer';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
const errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const id of ['slipstream-race','coconut-cart-rally']){
  await page.goto('http://127.0.0.1:5248/?playtest&lite&level='+id,{timeout:180000});
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  await page.evaluate(()=>{
   const r=window.__game.getSkateRace(),step=r.step.bind(r);r.step=(dt,input)=>step(dt,r.phase==='running'?r.drive(0):input);r.start('race',270327);
  });
  await page.waitForFunction(()=>window.__game.getSkateRace().elapsed>3&&Number(document.querySelector('[data-race-speed]')?.textContent)>5,null,{timeout:90000});
  const report=await page.evaluate(()=>{
   const r=window.__game.getSkateRace(),h=r.hud(),el=document.querySelector('[data-race-speedometer]');
   return {id:window.__game.getCurrentLevel().id,vehicle:h.vehicle??'skateboard',text:el.textContent,speed:Number(el.querySelector('strong').textContent),native:h.speedKmh,
    horizontal:Math.hypot(r.riders[0].velocity.x,r.riders[0].velocity.z)*3.6};
  });
  assert.ok(report.text.includes('KM/H')&&Math.abs(report.speed-report.native)<3);assert.ok(Math.abs(report.native-report.horizontal)<.001);
  reports.push(report);await page.screenshot({path:out+'/'+id+'.png'});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/speedometer.json',JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors}));
}finally{await browser.close();}
