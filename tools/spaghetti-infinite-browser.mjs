import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-infinite-browser';
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5248';
const full=process.argv.includes('--full');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.log('CONSOLE ERROR',m.text());}});
try{
 for(const id of ['spaghetti-rails','spaghetti-rails-platforming']){
  await page.goto(base+'/?playtest&renderdiag&level='+id+(full?'':'&lite'),{timeout:180000});
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  if(full)await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  if(id==='spaghetti-rails'){await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');}
  await page.waitForTimeout(800);
  const spawn=await page.evaluate(()=>{const g=window.__game;return {position:g.player.pos.toArray(),grounded:g.player.grounded,loop:g.getLevel().verticalLoop,view:g.getLevel().verticalLoopDiagnostics,render:g.renderer.info.render,stamp:document.querySelector('.hud-build')?.textContent};});
  await page.screenshot({path:out+'/'+id+'-spawn.png'});
  assert.ok(spawn.loop&&spawn.grounded);assert.match(spawn.stamp,/Codex\/sol fork/);
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.keyboard.down('KeyE');
  await page.waitForTimeout(6000);
  await page.keyboard.up('KeyE');await page.keyboard.up('Space');await page.keyboard.up('ArrowUp');
  await page.screenshot({path:out+'/'+id+'-travel.png'});
  const travel=await page.evaluate(()=>{const g=window.__game;return {position:g.player.pos.toArray(),state:g.player.state,deaths:g.player.totalDeaths,render:g.renderer.info.render,loop:g.getLevel().verticalLoopDiagnostics,performance:JSON.parse(document.querySelector('#render-diagnostics').textContent).frameTiming};});
  // A documented initial placement isolates the seam; the live game clock,
  // camera, collision and render interpolation then run normally.
  await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.set(0,-110,-65);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-20;p.speed=0;p.snapRenderInterpolation();window.wrapStart=p.verticalLoopOffset;window.wrapSamples=[];
   requestAnimationFrame(function sample(t){window.wrapSamples.push({t,y:p.renderPosition.y,cameraY:g.camera.position.y,offset:p.verticalLoopOffset});if(!(p.verticalLoopOffset>window.wrapStart&&p.grounded))requestAnimationFrame(sample);});
  });
  await page.waitForFunction(()=>window.__game.player.verticalLoopOffset>window.wrapStart,null,{timeout:5000});
  await page.screenshot({path:out+'/'+id+'-seam.png'});
  await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:20000});
  const wrap=await page.evaluate(()=>{const g=window.__game,p=g.player,s=window.wrapSamples,i=s.findIndex((v,i)=>i>0&&v.offset!==s[i-1].offset),before=s[i-1],after=s[i];return {offset:p.verticalLoopOffset-window.wrapStart,pos:p.pos.toArray(),camera:g.camera.position.toArray(),state:p.state,deaths:p.totalDeaths,ground:p.groundHit?.name,seam:before&&after?{milliseconds:after.t-before.t,cameraStep:after.cameraY-before.cameraY-(after.offset-before.offset),riderStep:after.y-before.y-(after.offset-before.offset)}:null};});
  assert.equal(wrap.offset,288);assert.equal(wrap.deaths,travel.deaths);
  assert.ok(wrap.seam&&Math.abs(wrap.seam.cameraStep)<10&&Math.abs(wrap.seam.riderStep)<10,'Camera and rendered rider remain continuous through the coordinate rebase');
  await page.screenshot({path:out+'/'+id+'-catch.png'});
  await writeFile(out+'/'+id+'.json',JSON.stringify({full,spawn,travel,wrap,errors},null,2));
  if(full&&id==='spaghetti-rails-platforming'){
   // Inspect the exact rendered mesh looking along both vertical directions.
   // This one-frame view only changes a cloned camera, never gameplay state.
   for(const direction of [-1,1]){
    const png=await page.evaluate(direction=>{const g=window.__game,c=g.camera.clone();c.position.set(0,105,-224);c.up.set(0,0,-1);c.lookAt(0,105+direction*100,-224);c.updateMatrixWorld();g.getLevel().updateSceneryView(c);g.renderer.setRenderTarget(null);g.renderer.clear();g.renderer.render(g.scene,c);return g.renderer.domElement.toDataURL('image/png').split(',')[1];},direction);
    await writeFile(out+'/vertical-'+(direction>0?'up':'down')+'.png',Buffer.from(png,'base64'));
   }
  }
  console.log(JSON.stringify({id,full,spawn,travel,wrap,errors}));
 }
 assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:out+'/failure.png'});console.log(JSON.stringify({errors}));throw e;}finally{await browser.close();}
