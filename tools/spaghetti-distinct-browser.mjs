import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5248';
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-distinct-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const errors=[],reports=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const id of process.argv.includes('--platformer')?['spaghetti-rails-platforming']:['spaghetti-rails','spaghetti-rails-platforming']){
  await page.goto(base+'/?playtest&renderdiag&level='+id,{timeout:180000});
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  if(id==='spaghetti-rails'){await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');}
  const views=id==='spaghetti-rails'?[{name:'start-forks',p:[26,114,8]},{name:'over-under',p:[0,78,-520]},{name:'flyover',p:[0,-30,-2180]}]:[{name:'lantern-steps',p:[-9,110,-18]},{name:'cargo-choice',p:[2,108,-36]},{name:'counterweights',p:[-18,60,-400]},{name:'split-drop',p:[24,120,-470]},{name:'spine-stair',p:[18,48,-600]},{name:'spring-vault',p:[30,-32,-1330]}];
  for(const view of views){
   await page.evaluate(v=>{const g=window.__game,p=g.player,V=p.pos.constructor;p.respawn(g.getLevel(),true,false,{position:new V(v.p[0],v.p[1]+.08,v.p[2]),heading:new V(0,0,-1)});p.snapRenderInterpolation();},view);
   await page.waitForTimeout(700);await page.screenshot({path:out+'/'+id+'-'+view.name+'.png'});
   reports.push(await page.evaluate(v=>{const g=window.__game,p=g.player;return {...v,id:g.getCurrentLevel().id,p:p.pos.toArray(),grounded:p.grounded,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};},view));
  }
  // Inspection camera only; the playable camera remains the tested forward rig.
  await page.evaluate(id=>{const g=window.__game;g.openEditor();const e=g.editor;e.focusAnim=null;e.controls.target.set(0,id==='spaghetti-rails'?62:55,id==='spaghetti-rails'?-600:-470);g.camera.position.set(46,135,id==='spaghetti-rails'?-435:-350);e.controls.update();},id);
  await page.waitForTimeout(700);await page.screenshot({path:out+'/'+id+'-overview.png'});
  await writeFile(out+'/report.json',JSON.stringify({reports,errors},null,2));
  await page.locator('.ed-test').click();await page.waitForFunction(()=>!window.__game.editor.active);
 }
 await writeFile(out+'/report.json',JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
