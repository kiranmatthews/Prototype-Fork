import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]??'http://127.0.0.1:5497',out=process.env.CART_BAIL_OUTPUT??'/private/tmp/cart-bail-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1600,height:900},serviceWorkers:'block',recordVideo:{dir:out,size:{width:1600,height:900}}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally${process.env.CART_FULL?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();
 await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r),render=g.renderer.render.bind(g.renderer);
  window.bailReview={angle:0,frames:[],images:{},done:false,native:true,focus:g.player.pos.clone(),startCart:null,fire:false};
  r.step=(dt,input)=>{
   const q=window.bailReview;if(q.paused)return;step(dt,input);const a=r.carts.interactions.find(a=>a.id===0&&a.bail);
   if(a){const b=a.bail,sole=g.player.animationRig.jointsById.get('ankleRight').node.getObjectByName('socket-foot-right');q.frames.push({soleContact:b.grounded&&b.progress>=.65&&b.progress<=.71?{exists:!!sole,error:sole?.getWorldPosition(g.player.pos.clone()).distanceTo(a.actor.bailFoot),height:sole?.getWorldPosition(g.player.pos.clone()).y-b.position.y}:null,age:b.age,phase:b.phase,phaseAge:b.phaseAge,progress:b.progress,position:b.position.toArray(),velocity:b.velocity.toArray(),cart:[r.carts.fleet.physics.carts[a.cart].x,r.carts.fleet.physics.carts[a.cart].z],root:a.actor.root.position.toArray(),scale:g.player.vehicleVisualRoot.getWorldScale(g.player.pos.clone()).toArray(),clip:{...a.actor.locomotion},feet:['Left','Right'].map(side=>g.player.animationRig.jointsById.get('ankle'+side).node.getWorldPosition(g.player.pos.clone()).toArray())});}
   else if(q.frames.length)q.done=true;
   const b=a?.bail;const marker=b?(b.phase==='flight'?(b.age>=.12&&b.age<.20?'leap':b.age>=.28?'descent':null):b.progress<.31?'impact':b.progress<.62?'bounce':b.progress>=.74?'settle':null):q.done?'running':null;if(q.captureAt&&marker===q.captureAt)q.paused=true;
  };
  g.renderer.render=(scene,camera)=>{
   const q=window.bailReview;
   if(scene===g.scene&&camera===g.camera){const angle=q.angle*Math.PI/180+(q.faceYaw??0);q.focus.copy(g.player.pos);
    camera.position.set(q.focus.x+Math.sin(angle)*9,q.focus.y+3.5,q.focus.z+Math.cos(angle)*9);camera.fov=52;camera.lookAt(q.focus.x,q.focus.y+.7,q.focus.z-1);camera.updateProjectionMatrix();
   }
   const result=render(scene,camera);
   return result;
  };
  window.startBailReview=(angle,native=true,air=false)=>{
   r.canStartTimeTrial=()=>true;r.start('time-trial',0);r.phase='running';r.elapsed=4;g.renderQualitySettings.setRegularResolution(native?null:720);
   const c=r.carts,w=c.fleet.physics,f=r.course.tangent(245).setY(0).normalize(),p=r.course.sample(245);
   Object.assign(w.spawns[0],{x:p.x,z:p.z,yaw:Math.atan2(-f.x,-f.z)});w.reset(0);const v=w.carts[0];v.vx=f.x*28;v.vz=f.z*28;v.speed=28;if(air){v.y+=4;v.grounded=false;v.vy=2;}
   c.sync();c.present(1);r.riders[0].progress=r.course.project(g.player.pos).s;
   const q=window.bailReview;Object.assign(q,{angle,native,frames:[],images:{},done:false,paused:false,captureAt:null,focus:g.player.pos.clone().addScaledVector(f,3),startCart:[v.x,v.z],faceYaw:Math.atan2(f.x,f.z)});
  };
 });
 const reports=[];
 for(const [angle,native,air]of [[0,true,false],[40,true,false],[90,true,false],[40,false,false],[40,true,true]]){
  await page.evaluate(([angle,native,air])=>window.startBailReview(angle,native,air),[angle,native,air]);
  await page.keyboard.down('KeyE');await page.waitForTimeout(80);await page.keyboard.up('KeyE');
  await page.waitForFunction(()=>window.bailReview.done,null,{timeout:10000});await page.waitForTimeout(200);
  const q=await page.evaluate(()=>{const q=window.bailReview,g=window.__game,r=g.getSkateRace();return {...q,bodyParent:g.player.vehicleVisualRoot.parent.name,grounded:g.player.grounded,cart:r.carts.cartForRacer[0],gl:g.renderer.getContext().getError(),stamp:document.querySelector('.hud-build')?.textContent};});
  const soles=q.frames.map(f=>f.soleContact).filter(Boolean);assert.ok(soles.length>0);assert.ok(soles.every(s=>s.exists&&s.error<.12),'The loaded racer plants its actual sole');
  assert.equal(q.cart,-1);assert.equal(q.grounded,true);assert.ok(q.frames.some(f=>f.phase==='roll'));assert.ok(q.frames.some(f=>f.progress>.9));assert.ok(q.frames.some(f=>f.clip.clipId==='player.roll-land'));assert.equal(q.gl,0);assert.ok(q.frames.every(f=>Math.abs(f.root[1]-f.position[1])<3),'Loaded model support stays beside the physical racer');assert.ok(q.frames.every(f=>f.scale.every(v=>Number.isFinite(v)&&v>0)));
  const prefix=`${angle}-${native?'native':'normal'}${air?'-air':''}`;
  delete q.images;reports.push({angle,native,air,...q});console.log(JSON.stringify({angle,native,air,frames:q.frames.length,duration:q.frames.at(-1).age}));
  // A second pass pauses only for inspection stills; the first pass above records the complete uninterrupted motion.
  await page.evaluate(([angle,native,air])=>{window.startBailReview(angle,native,air);window.bailReview.captureAt='leap';},[angle,native,air]);await page.keyboard.down('KeyE');await page.waitForTimeout(80);await page.keyboard.up('KeyE');
  for(const name of ['leap','descent','impact','bounce','settle','running']){
   await page.evaluate(name=>{const q=window.bailReview;q.captureAt=name;q.paused=false;},name);
   await page.waitForFunction(()=>window.bailReview.paused,null,{timeout:10000});await page.screenshot({path:`${out}/${prefix}-${name}.png`});
  }

 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({passed:true,reports,errors},null,2));
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});console.log(errors,await page.evaluate(()=>({review:window.bailReview,race:window.__game?.getSkateRace()?.phase,blocked:window.__game?.gameFlow.blocksGameplay,input:window.__game?.input.grindPressed,cart:window.__game?.getSkateRace()?.carts?.cartForRacer[0]})));throw error;}finally{await context.close();await browser.close();}
