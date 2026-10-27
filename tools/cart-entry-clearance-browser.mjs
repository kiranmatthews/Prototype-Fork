import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5498',out=process.env.CART_ENTRY_OUTPUT??'/private/tmp/cart-entry-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_ENTRY_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 const initial=await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),c=r.carts,w=c.fleet.physics,l=g.getLevel(),rock=l.builtFromData.components.find(x=>x.nm==='Rally Meshy rock 1');
  const p=g.player.pos.clone().fromArray(rock.p),s=r.course.project(p).s,f=r.course.tangent(s);f.y=0;f.normalize();const n=p.clone().set(-f.z,0,f.x);
  for(const rider of r.riders)if(![0,5].includes(rider.id))rider.finish=1;
  for(let i=0;i<w.carts.length;i++)if(![5,8,9].includes(i))c.locked[i]=60;
  for(const [index,along,across]of [[5,0,17.4],[8,0,9.8],[9,22,15.4]]){
   const pos=p.clone().addScaledVector(f,along).addScaledVector(n,across);Object.assign(w.spawns[index],{x:pos.x,z:pos.z,yaw:Math.atan2(-f.x,-f.z)});w.reset(index);c.homes[index]={...w.spawns[index]};
  }
  c.sync();r.riders[5].progress=r.course.project(r.riders[5].player.pos).s;c.wreck(5);window.entryStart=r.elapsed;
  g.renderQualitySettings.setRegularResolution(null);
  const render=g.renderer.render.bind(g.renderer),eye=p.clone().addScaledVector(n,27).addScaledVector(f,-24);eye.y+=10;const target=p.clone().addScaledVector(n,9);target.y+=2;
  g.renderer.render=(scene,camera)=>{if(scene===g.scene){camera.position.copy(eye);camera.lookAt(target);camera.updateMatrixWorld();c.updateView(camera);}return render(scene,camera);};
  const door=c.exitPoint(8,-1);door.y+=.8;
  return {doorBlocked:l.walls.some(w=>w.containsPoint(door)),selected:c.nearest(5,350),position:r.riders[5].player.pos.toArray()};
 });
 assert.equal(initial.doorBlocked,true);assert.equal(initial.selected,9);
 await page.waitForTimeout(2200);await page.screenshot({path:out+'/running-to-spare-native.png'});
 await page.waitForFunction(()=>{const c=window.__game.getSkateRace().carts;return c.cartForRacer[5]===9&&!c.isAnimating(5);},null,{timeout:30000});
 const result=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace(),c=r.carts;return {stamp:document.querySelector('.hud-build')?.textContent,seconds:r.elapsed-window.entryStart,cart:c.cartForRacer[5],falls:r.riders[5].falls,driver:c.driverForCart[9],gl:g.renderer.getContext().getError()};});
 assert.equal(result.cart,9);assert.equal(result.driver,5);assert.equal(result.falls,0);assert.equal(result.gl,0);assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/back-in-race-native.png'});
 await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));await page.waitForTimeout(120);await page.screenshot({path:out+'/back-in-race-normal.png'});
 await writeFile(out+'/report.json',JSON.stringify({passed:true,initial,result,errors},null,2));console.log(JSON.stringify({passed:true,initial,result,errors}));
}finally{await browser.close();}
