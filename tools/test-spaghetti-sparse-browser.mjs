import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5248';
const full=process.argv.includes('--full'),out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-sparse-browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
const errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 for(const id of ['spaghetti-rails','spaghetti-rails-platforming']){
  await page.goto(base+'/?playtest&renderdiag&level='+id+(full?'':'&lite'),{timeout:180000});
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  if(full)await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(null));
  if(id==='spaghetti-rails'){await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running');}
  await page.waitForTimeout(700);await page.screenshot({path:out+'/'+id+'-spawn.png'});
  const cases=id==='spaghetti-rails'
   ?[{name:'front-ledge',p:[0,17,-36.5],vy:-12},{name:'under-platform',p:[0,15,-30],vy:-18},{name:'deep-wrap',p:[0,-23,-170],vy:-35},{name:'crossed-rails',p:[8,-5,-900],vy:-25}]
   :[{name:'front-ledge',p:[-18,32,-11],vy:-12},{name:'under-platform',p:[-18,29,-5],vy:-18},{name:'deep-wrap',p:[0,-47,-170],vy:-35},{name:'crossed-rails',p:[8,-30,-1200],vy:-25}];
  for(const test of cases){
   await page.evaluate(test=>{
    const g=window.__game,p=g.player,l=g.getLevel(),V=p.pos.constructor,ray=new l.poolRay.constructor();
    p.respawn(l,true,false,{position:new V(...test.p),heading:new V(0,0,-1)});p.state='air';p.grounded=false;p.vVel=test.vy;p.speed=0;p.snapRenderInterpolation();
    const samples=[],start=p.verticalLoopOffset,probe={samples,done:false};window.sparseProbe=probe;
    let first;
    requestAnimationFrame(function sample(t){
     first??=t;const b=p.cameraPoseBounds,c=g.camera;if(!b)return requestAnimationFrame(sample);
     const center=b.getCenter(new V()),screen=center.clone().project(c),corners=[];
     for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])corners.push(new V(x,y,z).project(c));
     const direction=c.position.clone().sub(center),distance=direction.length();ray.set(center,direction.normalize());ray.near=.15;ray.far=distance-.15;
     const hit=ray.intersectObjects(l.groundMeshes,false).find(h=>h.object.visible&&!h.object.userData.editorGhost);
     const forward=c.getWorldDirection(new V());
     samples.push({t:t-first,p:p.pos.toArray(),eye:c.position.toArray(),state:p.state,grounded:p.grounded,offset:p.verticalLoopOffset-start,screen:screen.toArray(),low:Math.min(...corners.map(p=>p.y)),high:Math.max(...corners.map(p=>p.y)),yaw:Math.atan2(forward.x,-forward.z),blocked:hit?{name:hit.object.name,point:hit.point.toArray(),distance:hit.distance}:null});
     probe.done=t-first>5500||t-first>1000&&samples.length>30&&(p.grounded||p.state==='grind');
     if(!probe.done)requestAnimationFrame(sample);
    });
   },test);
   await page.waitForFunction(()=>window.sparseProbe.done,null,{timeout:12000});
   const samples=await page.evaluate(()=>window.sparseProbe.samples);
   const live=samples.filter(s=>s.t>80&&s.state!=='dead'&&s.state!=='gameover');
   const bad=live.filter(s=>Math.abs(s.screen[0])>1||Math.abs(s.screen[1])>1||s.screen[2]>1||s.blocked);
   const result={id,full,name:test.name,frames:live.length,invisibleFrames:bad.length,worst:bad.slice(0,8),maxYaw:Math.max(...live.map(s=>Math.abs(s.yaw))),wrap:Math.max(...live.map(s=>s.offset)),samples};
   reports.push(result);await writeFile(out+'/report.json',JSON.stringify({errors,reports},null,2));
   await page.screenshot({path:out+'/'+id+'-'+test.name+'.png'});
   console.log(JSON.stringify({...result,samples:undefined}));
   assert.ok(live.length>15);assert.equal(bad.length,0,'The live rider stays onscreen and unobstructed throughout the fall');
   assert.ok(result.maxYaw<.001,'Crossing rails never hijacks the forward view');
   if(test.name==='deep-wrap')assert.equal(result.wrap,id==='spaghetti-rails'?48:96);
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
