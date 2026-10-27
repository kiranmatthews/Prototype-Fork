import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5237';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/editor';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});
await page.addInitScript(()=>{const Native=WebSocket;window.WebSocket=new Proxy(Native,{construct(Target,args){
 if(args[1]==='vite-hmr')return Object.assign(new EventTarget(),{readyState:0,send(){},close(){}});
 return Reflect.construct(Target,args);
}});});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=spaghetti-rails&lite`,{timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const before=await page.evaluate(()=>{
  const g=window.__game;g.openEditor();const e=g.editor;
  if(!e.active)throw Error('Level editor did not open');
  const i=e.data.components.findIndex(c=>c.t==='rail'&&c.nm.includes('centre'));
  e.sel=[i];e.resizeIdx=i;e.selVtxs=new Set([3]);e.renderProps();e.onLevelRebuilt();e.focusOnItem(i);
  const c=e.data.components[i];
  window.spaghettiEditorReview={json:JSON.stringify(e.data),index:i,node:[...c.pts[3]],railPoints:JSON.stringify(e.getLevel().rails[1].points)};
  return {rails:e.data.components.filter(c=>c.t==='rail').length,checkpoints:e.data.components.filter(c=>c.t==='checkpoint').length,
   retries:e.getLevel().raceCheckpoints.length,node:c.pts[3],y:c.p[1]+c.pts[3][3],radius:c.pts[3][2],grinds:e.data.skateRace.grinds.length};
 });
 assert.equal(before.checkpoints,7);assert.equal(before.retries,7);assert.equal(before.rails,before.grinds*3);
 await page.getByRole('spinbutton',{name:'node 4 · y',exact:true}).fill(String(before.y+1.25));
 await page.getByRole('spinbutton',{name:'node 4 · y',exact:true}).press('Enter');
 await page.getByRole('spinbutton',{name:'node 4 · radius',exact:true}).fill('6');
 await page.getByRole('spinbutton',{name:'node 4 · radius',exact:true}).press('Enter');
 const changed=await page.evaluate(()=>{
  const e=window.__game.editor,s=window.spaghettiEditorReview,c=e.data.components[s.index];
  return {node:c.pts[3],previewChanged:JSON.stringify(e.getLevel().rails[1].points)!==s.railPoints,retries:e.getLevel().raceCheckpoints.length};
 });
 assert.ok(Math.abs(changed.node[3]-before.node[3]-1.25)<1e-9);assert.equal(changed.node[2],6);assert.equal(changed.previewChanged,true);assert.equal(changed.retries,7);
 await page.screenshot({path:output+'/editable-height-and-radius.png'});
 const restored=await page.evaluate(()=>{
  const e=window.__game.editor,s=window.spaghettiEditorReview;e.undo();e.undo();
  return {data:JSON.stringify(e.data)===s.json,geometry:JSON.stringify(e.getLevel().rails[1].points)===s.railPoints};
 });
 assert.deepEqual(restored,{data:true,geometry:true});
 await page.locator('.ed-test').click();await page.waitForFunction(()=>!window.__game.editor.active);
 const playable=await page.evaluate(()=>{const g=window.__game;return {id:g.getCurrentLevel().id,rails:g.getLevel().rails.length,retries:g.getLevel().raceCheckpoints.length,active:g.getSkateRace().active};});
 assert.equal(playable.active,true);assert.equal(playable.retries,7);assert.equal(playable.rails,before.rails);
 await page.screenshot({path:output+'/returned-to-play.png'});
 await writeFile(output+'/report.json',JSON.stringify({before,changed,restored,playable,errors},null,2));
 console.log(JSON.stringify({before,changed,restored,playable,errors}));assert.deepEqual(errors,[]);
}finally{await browser.close();}
