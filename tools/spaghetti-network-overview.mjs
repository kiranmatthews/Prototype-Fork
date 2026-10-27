import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/network-overview';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:2560,height:1440},serviceWorkers:'block'});
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5237/?playtest&level=spaghetti-rails',{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.openEditor();});
 const views=[
  {name:'whole-island-course',target:[0,210,-1120],eye:[1900,1700,950]},
  {name:'first-chasm-eight-choices',target:[25,382,-120],eye:[410,630,250]},
  {name:'first-chasm-side',target:[25,382,-120],eye:[520,420,-60]},
  {name:'combo-threads-close',target:[5,390,-132],eye:[160,485,10]},
 ];
 const pictures=[];
 for(const view of views){
  await page.evaluate(view=>{const g=window.__game,e=g.editor;e.focusAnim=null;e.sel=[];e.camera.far=6000;e.camera.updateProjectionMatrix();e.camera.position.set(...view.eye);e.controls.target.set(...view.target);e.controls.update();g.gameFlow.requestGameplayFrame();},view);
  await page.waitForTimeout(300);
  const state=await page.evaluate(()=>{const g=window.__game;return {viewport:[innerWidth,innerHeight],buffer:[g.renderer.domElement.width,g.renderer.domElement.height],native:!g.renderQualitySettings.snapshot().enabled,rails:g.getLevel().rails.length,paths:g.getLevel().railChoices.paths.length};});
  await page.screenshot({path:`${output}/${view.name}.png`});pictures.push({...view,...state});
  assert.equal(state.native,true);assert.deepEqual(state.buffer,[2560,1440]);
 }
 await writeFile(output+'/report.json',JSON.stringify({scope:'Full-render native-resolution editor overview; not traversal evidence.',pictures,errors},null,2));
 console.log(JSON.stringify({pictures,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
