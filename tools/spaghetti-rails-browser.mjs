import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const full=process.env.SPAGHETTI_FULL!=='0';
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5237';
const output=process.env.SPAGHETTI_OUTPUT||'/private/tmp/spaghetti-rails-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const context=await browser.newContext({viewport:full?{width:2560,height:1440}:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
// A long playtest keeps its loaded revision even while the next local draft
// is authored. Only Vite's development reload socket is suppressed.
await page.addInitScript(()=>{const Native=WebSocket;window.WebSocket=new Proxy(Native,{construct(Target,args){
 if(args[1]==='vite-hmr')return Object.assign(new EventTarget(),{readyState:0,send(){},close(){}});
 return Reflect.construct(Target,args);
}});});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=spaghetti-rails${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(full&&process.env.SPAGHETTI_MAX!=='0')await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.gameFlow.requestGameplayFrame();});
 if(full&&process.env.SPAGHETTI_MAX!=='0')await page.waitForFunction(()=>{const g=window.__game;return !g.renderQualitySettings.snapshot().enabled&&g.renderer.domElement.width===innerWidth&&g.renderer.domElement.height===innerHeight;});
 await page.screenshot({path:output+'/grid.png'});
 if(!process.argv.includes('--inspect')){
  const layouts=[];
  for(const [width,height] of [[1280,720],[1920,1080],[1024,768],[390,844],[844,390],[320,568],[568,320]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(300);
   const layout=await page.evaluate(()=>{
    const root=document.querySelector('.race-interface'),content=root.querySelector('.comp-content'),clip=content.getBoundingClientRect();
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const controls=root.querySelector('[data-rail-controls]'),button=root.querySelector('[data-race-action="race"]');
    return {viewport:[innerWidth,innerHeight],title:root.querySelector('h1').textContent,controls:rect(controls),content:rect(content),button:rect(button),
     instructionText:controls.textContent,prompts:controls.querySelectorAll('.input-glyph').length,
     instructionsFit:controls.getBoundingClientRect().top>=clip.top-1&&controls.getBoundingClientRect().bottom<=clip.bottom+1,
     wholeMenuScroll:[root.scrollTop,root.scrollLeft],buffer:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height],native:!window.__game.renderQualitySettings.snapshot().enabled};
   });
   layouts.push(layout);await page.screenshot({path:`${output}/menu-${width}x${height}.png`});
  }
  await writeFile(output+'/menu.json',JSON.stringify({layouts,errors},null,2));
  for(const l of layouts){assert.ok(l.instructionsFit,`Rail instructions fit ${l.viewport.join('x')}`);assert.deepEqual(l.wholeMenuScroll,[0,0]);assert.ok(l.button.y>=0&&l.button.bottom<=l.viewport[1]);if(full&&process.env.SPAGHETTI_MAX!=='0'){assert.ok(l.native);assert.deepEqual(l.buffer,l.viewport);}}
  assert.deepEqual(errors,[]);console.log(JSON.stringify({viewports:layouts.map(l=>l.viewport),errors}));
 }else{
  await page.getByRole('button',{name:'RACE',exact:true}).click();
  await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
  await page.screenshot({path:output+'/spawn.png'});
  const state=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),r=g.getSkateRace();return {level:g.getCurrentLevel().id,rails:l.rails.length,line:r.course.length,spawn:g.player.pos.toArray(),grounded:g.player.grounded,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],native:!g.renderQualitySettings.snapshot().enabled,stamp:document.querySelector('.hud-build')?.textContent};});
  console.log(JSON.stringify({state,errors}));await writeFile(output+'/inspect.json',JSON.stringify({state,errors},null,2));
  assert.equal(state.level,'spaghetti-rails');assert.equal(state.rails,48);assert.equal(state.grounded,true);assert.deepEqual(errors,[]);
 }
}finally{await browser.close();}
