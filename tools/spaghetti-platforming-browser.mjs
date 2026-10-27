import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/platforming-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:2560,height:1440},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5237/?playtest&level=spaghetti-rails-platforming',{timeout:30000});
 await page.waitForFunction(()=>!!window.__game,null,{timeout:25000});
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.gameFlow.requestGameplayFrame();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:30000}).catch(error=>console.log('Startup did not clear within the bounded check: '+error.message));
 const state=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {id:g.getCurrentLevel().id,race:!!g.getSkateRace()?.active,paths:l.railChoices?.paths.length,checkpoints:l.checkpoints.length,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],position:g.player.pos.toArray(),grounded:g.player.grounded,flow:g.gameFlow.blocksGameplay,text:document.body.innerText.slice(-2500)};});
 await page.screenshot({path:output+'/platforming-spawn.png'});await writeFile(output+'/report.json',JSON.stringify({state,errors},null,2));console.log(JSON.stringify({state,errors}));
 assert.equal(state.id,'spaghetti-rails-platforming');assert.equal(state.race,false);assert.equal(state.paths,18);assert.equal(state.checkpoints,41);assert.deepEqual(state.buffer,[2560,1440]);assert.equal(state.flow,false);assert.deepEqual(errors,[]);
}finally{await browser.close();}
