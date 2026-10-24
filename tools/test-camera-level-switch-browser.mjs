import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5419/';
const output=process.env.CAMERA_SWITCH_OUTPUT||'/private/tmp/debug-camera-switch';
const modes=(process.env.CAMERA_SWITCH_MODES||'lite,full').split(',');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={runs:[],errors:[]};
try {
 for(const mode of modes){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('solProtoDebugChrome','visible'));
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push({mode,error:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({mode,error:m.text()});});
  const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const read=()=>page.evaluate(()=>{
   const g=window.__game,c=g.camera,p=g.player;
   return {id:g.getCurrentLevel().id,position:c.position.toArray(),quaternion:c.quaternion.toArray(),
    up:c.up.toArray(),direction:c.getWorldDirection(p.pos.clone()).toArray(),fov:c.fov,
    player:p.pos.toArray(),grounded:p.grounded,snap:p.renderSnapVersion};
  });
  const choose=async id=>{
   const name=await page.evaluate(id=>window.__game.findLevel(id)?.name,id);
   assert.ok(name,`unknown menu level ${id}`);
   const menu=page.locator('[data-debug-tab="menu"]');
   if(await menu.getAttribute('aria-expanded')!=='true')await menu.click();
   await page.getByTitle(name,{exact:true}).filter({hasText:name}).click();
   await page.waitForFunction(id=>window.__game.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
   await page.waitForTimeout(1000);
   if(await menu.getAttribute('aria-expanded')==='true')await menu.click();
  };
  const upright=shot=>{
   assert.deepEqual(shot.up,[0,1,0],`${mode}/${shot.id} inherited the previous surface-up vector`);
   const [x,y,z,w]=shot.quaternion;
   const rightY=2*(x*y+z*w);
   assert.ok(Math.abs(rightY)<1e-5,`${mode}/${shot.id} retained a rolled horizon: ${rightY}`);
  };
  await page.goto(base+'?playtest&level=sky'+(mode==='lite'?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
  await ready();await page.waitForFunction(()=>window.__game.player.grounded);await page.waitForTimeout(1000);
  const fresh=await read();upright(fresh);
  // A real, supported skate bank supplies the outgoing camera orientation.
  // This fixture is stored only in this disposable browser context.
  await page.evaluate(()=>{
   const g=window.__game;
   g.saveUserLevel({id:'camera-bank-fixture',name:'Camera bank fixture',data:{v:1,name:'Camera bank fixture',skatepark:true,
    spawn:[0,15.1,0],killY:-50,components:[
     {t:'ramp',p:[0,0,0],rise:30,len:20,w:100,yaw:90,tex:'solid'},
     {t:'gate',p:[0,15,-35]},
    ]}});
   g.ui.refreshLevels();
  });
  await choose('camera-bank-fixture');
  const bank=await read();assert.ok(Math.abs(bank.up[0])>.5,'fixture did not bank the actual gameplay camera');
  const run={mode,fresh,bank,switches:[]};report.runs.push(run);
  const route=mode==='lite'?['sky','jungle','bonus-rolling-bones','rolling-bones','warproom','sky']:
   ['sky','jungle','bonus-rolling-bones','rolling-bones','bonus-rolling-bones'];
  for(const id of route){
   await choose(id);const shot=await read();upright(shot);
   if(id==='sky'){
    const dot=shot.quaternion.reduce((sum,value,i)=>sum+value*fresh.quaternion[i],0);
    assert.ok(2*Math.acos(Math.min(1,Math.abs(dot)))<.01,'debug destination differs from the fresh spawn camera');
    assert.equal(shot.fov,fresh.fov);assert.equal(shot.grounded,true);
   }
   run.switches.push(shot);
   if(id==='jungle'||id==='bonus-rolling-bones')await page.screenshot({path:`${output}/${mode}-${id}.png`});
   console.log(`PASS ${mode}: debug menu → ${id}, upright horizon`);
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[],'browser console');
}finally{await writeFile(`${output}/browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
