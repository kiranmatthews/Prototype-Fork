import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))||'http://127.0.0.1:5298',lite=process.argv.includes('--lite'),out='/private/tmp/mall-recreation/measured';
const native=JSON.parse(await readFile(`${out}/source-boxes.json`,'utf8'));
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall-measured';export {Vector3} from 'three';export {mallSourceBoxFixtures,mallSourceBoxInput} from './tools/mall-source-box-fixtures.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[],fixtures=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-box-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall${lite?'&lite':''}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {source,Vector3,mallSourceBoxFixtures,mallSourceBoxInput}=await import('/mall-box-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  if(canonical(source.MALL_LEVEL)!==canonical(g.getCurrentLevel().data))throw Error('Stale source data');
  if(l.sourceProps.objects.length!==12)throw Error('Original boxes missing');
  const step=p.step.bind(p),update=g.input.update.bind(g.input);let active,f,sample={};
  window.startMallBoxes=i=>{
   f=mallSourceBoxFixtures[i];const q=source.mallPoint(...f.start);q[1]=source.mallSupport(q[0],q[2],q[1]+5)+.1;
   const heading=new Vector3(...f.heading);p.respawn(l,true,false,{position:new Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   active=window.mallBoxes={name:f.name,frames:0,bail:false,done:false,contacts:[],tuning:JSON.stringify(g.TUNING),trace:[]};
  };
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),v=n?.22+.78*Math.min(1,n):0;return{id:'Mall box controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*v,-y/n*v,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:i===0&&!!sample.jumpHeld,touched:i===0&&!!sample.jumpHeld,value:i===0&&sample.jumpHeld?1:0}))};};
  p.step=(dt,controls,level)=>{
   if(!active||active.done)return;
   const speed=p.speed;sample=mallSourceBoxInput(p,source,f);update();step(dt,controls,level);active.bail||=p.isBailing;
   active.trace.push([p.pos.x,p.pos.y,p.pos.z,p.speed,p.state]);
   for(const box of l.sourceProps.objects)if(box.hit&&!active.contacts.some(c=>c.id===box.data.id))active.contacts.push({id:box.data.id,frame:active.frames,speedBefore:speed,speedAfter:p.speed});
   active.frames++;
   if(active.frames>=f.frames){active.done=true;active.tuningUnchanged=active.tuning===JSON.stringify(g.TUNING);active.supported=p.grounded&&p.state==='ride';}
  };
 });
 for(let i=0;i<2;i++){
  await page.evaluate(i=>window.startMallBoxes(i),i);
  if(i===0){await page.waitForFunction(()=>window.mallBoxes.contacts.length||window.mallBoxes.done,null,{timeout:30000});await page.screenshot({path:`${out}/${lite?'lite':'full'}-box-contact.png`});}
  await page.waitForFunction(()=>window.mallBoxes.done,null,{timeout:30000});
  const r=await page.evaluate(()=>{const l=window.__game.getLevel(),r=window.mallBoxes;delete r.tuning;l.reset(false);r.softResetHidden=l.sourceProps.objects.filter(b=>b.hit).every(b=>b.hidden&&b.members.every(m=>!m.mesh.visible));l.reset(true);r.hardResetRestored=l.sourceProps.objects.every(b=>!b.hit&&b.members.every(m=>m.mesh.visible));return r;});
  fixtures.push(r);console.log(JSON.stringify({...r,trace:undefined}));
  assert.ok(!r.bail&&r.supported&&r.tuningUnchanged&&r.softResetHidden&&r.hardResetRestored);
  assert.deepEqual(r.contacts.map(({id,frame})=>({id,frame})),native.fixtures[i].contacts.map(({id,frame})=>({id,frame})));
  assert.deepEqual(r.trace,native.fixtures[i].trace);
 }
 if(!lite){
  await page.evaluate(()=>{const g=window.__game,b=g.getLevel().sourceProps.objects.find(b=>b.data.id===521),render=g.renderer.render.bind(g.renderer);g.renderer.render=(scene,camera)=>{if(scene===g.scene){camera.position.copy(b.origin);camera.position.y+=4;camera.position.z+=8;camera.lookAt(b.origin);}return render(scene,camera);};});
  await page.waitForTimeout(300);await page.screenshot({path:`${out}/full-box-stacks.png`});
 }
 const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 await writeFile(`${out}/source-boxes-browser-${lite?'lite':'full'}.json`,JSON.stringify({fixtures,stamp,lite,nativeExact:true,errors},null,2));
}finally{await browser.close();}
