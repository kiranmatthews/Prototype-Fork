import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-maze-browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1600,height:1000},serviceWorkers:'block'});
const errors=[],views=[],flights=[],falls=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const full of process.argv.includes('--lite')?[false]:[false,true]){
  await page.goto('http://127.0.0.1:5248/?playtest&renderdiag&'+(full?'':'lite&')+'level=spaghetti-rails-platforming',{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='spaghetti-rails-platforming'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async full=>{const g=window.__game;await g.getLevel().prepareJungleAssets();if(full)g.renderQualitySettings.setRegularResolution(null);const m=await import('/src/levels/spaghetti-rails-platforming.ts');window.mazeRoute=m.SPAGHETTI_PLATFORMER_BOX_ROUTE;window.mazeLegs=m.SPAGHETTI_PLATFORMER_ROUTE_LEGS;},full);
  await page.waitForTimeout(600);await page.screenshot({path:out+'/'+(full?'full':'lite')+'-spawn.png'});
  const indices=await page.evaluate(()=>window.mazeRoute.flatMap((s,i)=>window.mazeLegs[i]?.kind==='spring'||window.mazeLegs[i]?.reverse||s.name.endsWith('/ step 4')?[i]:[]));
  for(const index of (process.argv.includes('--springs')?[]:indices)){
   await page.evaluate(index=>{const g=window.__game,p=g.player,V=p.pos.constructor,s=window.mazeRoute[index],leg=window.mazeLegs[index],q=leg.points[Math.min(3,leg.points.length-1)],h=new V(q[0]-s.p[0],0,q[2]-s.p[2]).normalize();p.respawn(g.getLevel(),true,false,{position:new V(s.p[0],s.p[1]+.08,s.p[2]),heading:h});p.snapRenderInterpolation();},index);
   await page.waitForTimeout(600);
   const view=await page.evaluate(index=>{const g=window.__game,s=window.mazeRoute[index],V=g.player.pos.constructor,b=g.player.cameraPoseBounds,center=b.getCenter(new V()),forward=g.camera.getWorldDirection(new V());return {index,name:s.name,p:g.player.pos.toArray(),grounded:g.player.grounded,hero:center.project(g.camera).toArray(),yaw:Math.atan2(forward.x,-forward.z),buffer:[g.renderer.domElement.width,g.renderer.domElement.height]};},index);
   views.push({full,...view});await writeFile(out+'/browser.json',JSON.stringify({views,flights,falls,errors},null,2));
   await page.screenshot({path:out+'/'+(full?'full':'lite')+'-'+index+'.png'});
   assert.ok(view.grounded,'Marked landing supports the live character');assert.ok(Math.abs(view.hero[0])<1&&Math.abs(view.hero[1])<1&&view.hero[2]<1,'Hero visible through authored turns');
   if(full)assert.deepEqual(view.buffer,[1600,1000]);
  }
  // Production input/physics/render loop: only device samples are supplied
  // after each initial fixture. No position correction or assisted landing.
  const springIndices=await page.evaluate(()=>window.mazeLegs.flatMap((e,i)=>e.kind==='spring'?[i]:[]));
  for(const index of springIndices){
   await page.evaluate(index=>{
    const g=window.__game,p=g.player,l=g.getLevel(),leg=window.mazeLegs[index],pad=g.getCurrentLevel().data.components.find(c=>c.nm===leg.spring),V=p.pos.constructor;
    p.respawn(l,true,false,{position:new V(pad.p[0],pad.p[1]+2,pad.p[2]),heading:new V(leg.to.p[0]-pad.p[0],0,leg.to.p[2]-pad.p[2]).normalize()});p.state='air';p.grounded=false;p.vVel=-2;p.speed=0;p.snapRenderInterpolation();
    const q=window.flightProbe={index,from:pad.p,to:leg.to.p,initialOffset:p.verticalLoopOffset,tuning:{walkSpeed:g.TUNING.walkSpeed,rise:g.TUNING.riseGravity,fall:g.TUNING.fallGravity},samples:[],done:false,launched:false,apex:false,age:0,weight:0,peak:pad.p[1]};
    const step=p.step;p.step=function(...args){if(q.pause)return;const result=step.apply(this,args);if(q.launched&&!q.apex&&!p.grounded&&p.vVel<=0){q.apex=true;q.pause=true;}return result;};
    const original=g.input.update;g.input.update=function(...args){original.apply(this,args);if(q.done)return;
     const d=new V(leg.to.p[0]-p.pos.x,0,leg.to.p[2]-p.pos.z),length=d.length(),f=p.trampolineAir?p.axisF:(l.laneDirAt(p.pos.x,p.pos.y,p.pos.z,{...p.laneCursor})??{x:0,z:-1});
     const pace=q.launched?Math.min(1,length/3):0;if(length)d.divideScalar(length);
     this.moveX=Math.round((d.x*-f.z+d.z*f.x)*pace*100)/100;this.moveY=Math.round((d.x*f.x+d.z*f.z)*pace*100)/100;this.jumpHeld=true;this.jumpPressed=!q.age;this.jumpReleased=false;this.spinHeld=true;this.spinPressed=q.age%24===0;this.grindHeld=false;this.grindPressed=false;q.age++;
    };
    requestAnimationFrame(function sample(){
     const b=p.cameraPoseBounds;if(p.vVel>30)q.launched=true;q.peak=Math.max(q.peak,p.pos.y);q.weight=Math.max(q.weight,g.getLaunchCameraDiagnostics().weight);
     if(b){const screen=b.getCenter(new V()).project(g.camera),forward=g.camera.getWorldDirection(new V());q.samples.push({p:p.pos.toArray(),screen:screen.toArray(),camera:g.getLaunchCameraDiagnostics(),vy:p.vVel,grounded:p.grounded,offset:p.verticalLoopOffset,yaw:Math.atan2(forward.x,-forward.z)});}
     if(q.launched&&p.grounded){q.done=true;q.end=p.pos.toArray();q.landed=Math.abs(p.pos.y-leg.to.p[1])<.2&&Math.abs(p.pos.x-leg.to.p[0])<leg.to.w/2&&Math.abs(p.pos.z-leg.to.p[2])<leg.to.d/2;g.input.update=original;p.step=step;return;}
     if(q.age>1200){q.done=true;g.input.update=original;p.step=step;return;}requestAnimationFrame(sample);
    });
   },index);
   await page.waitForFunction(()=>window.flightProbe.apex||window.flightProbe.done,null,{timeout:45000});
   const apex=await page.evaluate(()=>({paused:window.flightProbe.pause,grounded:window.__game.player.grounded}));
   assert.ok(apex.paused&&!apex.grounded,'Apex review freezes the live airborne pose before the screenshot');
   if(full||index===springIndices[0])await page.screenshot({path:out+'/'+(full?'full':'lite')+'-spring-'+index+'-apex.png'});
   await page.evaluate(()=>{window.flightProbe.pause=false;});
   await page.waitForFunction(()=>window.flightProbe.done,null,{timeout:45000});
   const flight=await page.evaluate(()=>window.flightProbe);flights.push({full,...flight});await writeFile(out+'/browser.json',JSON.stringify({views,flights,falls,errors},null,2));
   assert.ok(flight.samples.every(s=>s.offset===flight.initialOffset),'Intended spring transfer must not need a wrap');
   assert.ok(flight.landed,'Live spring reaches its existing receiver: '+index);assert.ok(flight.weight>.9,'Carlisle launch camera engages fully');
   assert.ok(flight.samples.slice(3).every(s=>Math.abs(s.screen[0])<1&&Math.abs(s.screen[1])<1&&s.screen[2]<1),'Spring camera keeps the rider in view');
  }
  for(const test of [{name:'under-platform',p:[-18,29,-5]},{name:'deep-wrap',p:[0,-47,-170]},{name:'backward-rail-fall',p:[-35,20,-240]}]){
   await page.evaluate(test=>{
    const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor,ray=new l.poolRay.constructor();
    p.respawn(l,true,false,{position:new V(...test.p),heading:new V(0,0,-1)});p.state='air';p.grounded=false;p.vVel=-35;p.speed=0;p.snapRenderInterpolation();
    const q=window.fallProbe={samples:[],done:false,offset:p.verticalLoopOffset};let first;
    requestAnimationFrame(function sample(t){first??=t;const b=p.cameraPoseBounds;if(!b)return requestAnimationFrame(sample);
     const center=b.getCenter(new V()),screen=center.clone().project(g.camera),direction=g.camera.position.clone().sub(center),distance=direction.length();ray.set(center,direction.normalize());ray.near=.15;ray.far=distance-.15;
     const hit=ray.intersectObjects(l.groundMeshes,false).find(h=>h.object.visible&&!h.object.userData.editorGhost);
     q.samples.push({t:t-first,screen:screen.toArray(),blocked:hit?.object.name??null,offset:p.verticalLoopOffset-q.offset,grounded:p.grounded});
     q.done=t-first>5500||t-first>1000&&q.samples.length>30&&p.grounded;if(!q.done)requestAnimationFrame(sample);
    });
   },test);
   await page.waitForFunction(()=>window.fallProbe.done,null,{timeout:15000});const fall=await page.evaluate(()=>window.fallProbe);falls.push({full,name:test.name,...fall});
   const live=fall.samples.filter(s=>s.t>100);assert.ok(live.every(s=>Math.abs(s.screen[0])<1&&Math.abs(s.screen[1])<1&&s.screen[2]<1&&!s.blocked),'Rider visible through maze falls');
   if(test.name==='deep-wrap')assert.equal(Math.max(...live.map(s=>s.offset)),96);
   await writeFile(out+'/browser.json',JSON.stringify({views,flights,falls,errors},null,2));
  }
 }
 await page.evaluate(()=>{const g=window.__game;g.player.respawn(g.getLevel(),true);g.renderQualitySettings.setRegularResolution(480);});await page.waitForTimeout(600);await page.screenshot({path:out+'/normal-presentation.png'});
 await writeFile(out+'/browser.json',JSON.stringify({views,flights,falls,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({views:views.length,flights:flights.map(({full,index,landed,peak,weight})=>({full,index,landed,peak,weight})),falls:falls.map(({full,name,samples})=>({full,name,frames:samples.length})),errors}));
}catch(error){const probe=await page.evaluate(()=>({flight:window.flightProbe,fall:window.fallProbe})).catch(()=>null);await writeFile(out+'/failure.json',JSON.stringify({message:error.message,probe,errors},null,2));throw error;}finally{await browser.close();}
