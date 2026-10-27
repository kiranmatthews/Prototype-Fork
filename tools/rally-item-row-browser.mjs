import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5498',out=process.env.RALLY_ITEM_ROW_OUTPUT??'/private/tmp/rally-item-row-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 // Let the UI's queued start input be consumed before replacing it with a solo fixture.
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{const r=window.__game.getSkateRace();r.canStartTimeTrial=()=>true;r.start('time-trial',42);});
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 assert.equal(await page.evaluate(()=>window.__game.getSkateRace().count),1);
 await page.waitForFunction(()=>window.__game.getSkateRace().elapsed>1.5,null,{timeout:5000});
 const row=await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts,w=c.fleet.physics,l=g.getLevel();
  const boxes=l.crates.filter(b=>b.mystery).slice(16,20),points=boxes.map(b=>b.mesh.position.clone()),center=points.reduce((sum,p)=>sum.add(p),g.player.pos.clone().set(0,0,0)).multiplyScalar(.25);
  const at=r.course.project(center).s,forward=r.course.sample(at+8).sub(r.course.sample(at-8)).setY(0).normalize();
  const across=points[3].clone().sub(points[0]).setY(0),dot=Math.abs(across.clone().normalize().dot(forward));
  const start=center.clone().addScaledVector(forward,-18),yaw=Math.atan2(-forward.x,-forward.z);
  Object.assign(w.spawns[0],{x:start.x,z:start.z,yaw});w.reset(0);c.sync();c.present(1);r.riders[0].progress=r.course.project(g.player.pos).s;
  r.step=()=>{};g.renderQualitySettings.setRegularResolution(null);
  const render=g.renderer.render.bind(g.renderer),eye=center.clone().addScaledVector(forward,-28);eye.y+=10;
  g.renderer.render=(scene,camera)=>{if(scene===g.scene&&camera===g.camera){camera.position.copy(eye);camera.lookAt(center);camera.updateMatrixWorld();c.updateView(camera);}return render(scene,camera);};
  return {points:points.map(p=>p.toArray()),center:center.toArray(),span:across.length(),acrossErrorDegrees:Math.asin(dot)*180/Math.PI,items:l.crates.filter(b=>b.mystery).length};
 });
 assert.equal(row.items,28);assert.ok(Math.abs(row.center[2]+1350)<.001);assert.ok(row.acrossErrorDegrees<10);assert.ok(Math.abs(row.span-18)<.001);
 await page.waitForTimeout(1800);await page.screenshot({path:out+'/across-track-native.png'});
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(150);await page.screenshot({path:out+'/across-track-normal.png'});
 const state=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,gl:window.__game.renderer.getContext().getError()}));
 assert.equal(state.gl,0);assert.deepEqual(errors,[]);assert.match(state.stamp,/Codex\/sol fork/);
 await writeFile(out+'/report.json',JSON.stringify({passed:true,full:!!process.env.CART_FULL,row,...state,errors},null,2)+'\n');console.log('PASS row crosses the real approach',JSON.stringify(row));
}catch(e){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
