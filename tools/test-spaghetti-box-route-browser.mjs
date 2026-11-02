import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-box-route-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const errors=[],views=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const full of [false,true]){
  await page.goto('http://127.0.0.1:5248/?playtest&renderdiag&'+(full?'':'lite&')+'level=spaghetti-rails-platforming',{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='spaghetti-rails-platforming'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async full=>{const g=window.__game;await g.getLevel().prepareJungleAssets();if(full)g.renderQualitySettings.setRegularResolution(null);window.boxRoute=(await import('/src/levels/spaghetti-rails-platforming.ts')).SPAGHETTI_PLATFORMER_BOX_ROUTE;},full);
  await page.waitForTimeout(600);await page.screenshot({path:out+'/'+(full?'full':'lite')+'-spawn.png'});
  const count=await page.evaluate(()=>window.boxRoute.length);
  const indices=full?(process.argv.includes('--quick')?[0,5,20,42,76,111,count-2]:Array.from({length:count-1},(_,i)=>i)):[0,5];
  for(const index of indices){
   await page.evaluate(index=>{const g=window.__game,p=g.player,V=p.pos.constructor,s=window.boxRoute[index],dx=window.boxRoute[index+1].p[0]-s.p[0],side=Math.sign(dx)*Math.min(4,Math.abs(dx)/2);p.respawn(g.getLevel(),true,false,{position:new V(s.p[0]+side,s.p[1]+.08,s.p[2]-s.d/2+1.6),heading:new V(0,0,-1)});p.snapRenderInterpolation();},index);
   await page.waitForTimeout(600);
   const view=await page.evaluate(index=>{const g=window.__game,s=window.boxRoute[index],next=window.boxRoute[index+1],V=g.player.pos.constructor;return {index,name:s.name,p:g.player.pos.toArray(),grounded:g.player.grounded,nextScreen:new V(next.p[0],next.p[1]+1.4,next.p[2]).project(g.camera).toArray(),buffer:[g.renderer.domElement.width,g.renderer.domElement.height]};},index);
   views.push({full,...view});await writeFile(out+'/browser.json',JSON.stringify({views,errors},null,2));
   if(!full||[0,5,20,42,76,111].includes(index))await page.screenshot({path:out+'/'+(full?'full':'lite')+'-'+index+'.png'});
   assert.ok(view.grounded,'Marked landing supports the live character');assert.ok(Math.abs(view.nextScreen[0])<1&&Math.abs(view.nextScreen[1])<1&&view.nextScreen[2]<1,'Next box destination remains in the ordinary forward camera');
   if(full)assert.deepEqual(view.buffer,[1600,1000]);
  }
 }
 await writeFile(out+'/browser.json',JSON.stringify({views,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({views,errors}));
}finally{await browser.close();}
