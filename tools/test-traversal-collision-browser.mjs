import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5345/';
const output=process.env.TRAVERSAL_COLLISION_OUTPUT||join(tmpdir(),'traversal-collision-browser');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],rows=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(new URL('?playtest&level=dark',base).href);
 const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});await ready();
 const fixture={v:1,name:'Spin bridge collision regression',spawn:[0,.12,0],killY:-8,components:[
  {t:'phasepad',p:[0,0,0],s:[4.2,.6,5.4],cycle:4.8,amp:.68,phase:0},
  {t:'spinbridge',p:[3,.06,0],s:[6,.34,1.6],yaw:180,cycle:.55},
  {t:'platform',p:[10,-.5,0],s:[14,1,5.4]},
  {t:'clock',p:[13,0,2.2]},{t:'gate',p:[16,0,0],yaw:90},
  {t:'zone',p:[3,0,0],s:[30,10,8],dir:'E'},
 ]};
 await page.evaluate(async data=>{const g=window.__game,id=g.saveUserLevel({id:'audit-spin-bridge',name:data.name,data});await g.gameFlow.transition(()=>{g.switchLevel(id);g.gameFlow.hide();});},fixture);await ready();
 // Let normal polling observe neutral controls after the menu release guard.
 await page.waitForTimeout(150);
 await page.keyboard.down('Space');await page.waitForTimeout(450);await page.keyboard.up('Space');
 await page.keyboard.down('ArrowRight');await page.keyboard.down('KeyF');
 await page.waitForFunction(()=>{const p=window.__game.player;return p.grounded&&p.pos.x>3.5||p.isBailing||p.state==='dead';},null,{timeout:10000});
 await page.keyboard.up('ArrowRight');await page.keyboard.up('KeyF');
 const row=await page.evaluate(()=>{const g=window.__game,p=g.player,b=g.getLevel().spinBridges[0];return {test:'native airborne spin through opening bridge',stamp:document.querySelector('.hud-build')?.textContent,position:p.pos.toArray(),state:p.state,bailing:p.isBailing,grounded:p.grounded,lives:p.lives,activated:b.activated,deployed:b.deployed,runMode:g.getLevel().runMode,impact:p.worldImpactDiagnostics};});
 rows.push(row);await page.screenshot({path:`${output}/bridge.png`});
 assert.match(row.stamp,/Codex\/sol fork/);assert.equal(row.activated,true);assert.equal(row.bailing,false);assert.equal(row.grounded,true);assert.ok(row.position[0]>3.5);assert.equal(row.lives,4);assert.equal(row.runMode,false);
 await page.waitForFunction(()=>window.__game.getLevel().spinBridges[0].deployed,null,{timeout:5000});
 row.settledAfter=await page.evaluate(()=>window.__game.getLevel().spinBridges[0].deployed);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({base,rows,errors},null,2));
}finally{await writeFile(`${output}/report.json`,JSON.stringify({base,rows,errors},null,2));await browser.close();}
