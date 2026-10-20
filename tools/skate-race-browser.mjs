import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5228';
const output=process.env.RACE_SMOKE_OUTPUT||'/private/tmp/skate-race-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race${process.argv.includes('--full')?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForTimeout(1200);
 await page.screenshot({path:output+'/grid.png'});
 const grid=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {phase:r.phase,level:g.getCurrentLevel().id,actors:r.riders.length,goal:r.level.finishBox.min.toArray(),state:r.hud(),stamp:document.querySelector('.hud-build')?.textContent};});
 assert.equal(grid.level,'slipstream-race');assert.equal(grid.actors,8);assert.equal(grid.phase,'grid');
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForTimeout(3000);await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');
 await page.screenshot({path:output+'/running.png'});
 const running=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {time:r.elapsed,phase:r.phase,actors:r.riders.map(v=>({id:v.id,s:v.progress,p:v.player.pos.toArray(),deaths:v.player.totalDeaths})),hud:r.hud()};});
 assert.ok(running.actors.some(a=>a.id>0&&a.s>1));
 for(const [w,h] of [[1024,768],[390,844],[844,390]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(()=>window.__game.getSkateRace().reset());await page.waitForTimeout(200);await page.screenshot({path:`${output}/grid-${w}x${h}.png`});
 }
 await writeFile(output+'/report.json',JSON.stringify({grid,running,errors},null,2));console.log(JSON.stringify({grid:{...grid,state:undefined},running:{...running,hud:undefined},errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
