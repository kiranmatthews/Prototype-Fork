import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5237';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/opening-camera/browser';
const native=process.env.SPAGHETTI_MAX!=='0';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:2560,height:1440},serviceWorkers:'block'});
const errors=[],runs=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.addInitScript(()=>{const Native=WebSocket;window.WebSocket=new Proxy(Native,{construct(Target,args){
 if(args[1]==='vite-hmr')return Object.assign(new EventTarget(),{readyState:0,send(){},close(){}});
 return Reflect.construct(Target,args);
}});});
try{
 for(const mode of ['forward','choose-left']){
  await page.goto(`${base}/?playtest&level=spaghetti-rails`,{timeout:120000});
  await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(({mode,native})=>{
   const g=window.__game,r=g.getSkateRace(),p=g.player,l=g.getLevel(),held=new Set(),update=g.input.update.bind(g.input);
   if(native)g.renderQualitySettings.setRegularResolution(null);g.gameFlow.requestGameplayFrame();
   const path=l.railChoices.paths.find(path=>path.section===0&&path.choice===2),rail=path.rails[0].rail;
   const q=window.openingCamera={trace:[],done:false,nextInput:0,tuning:JSON.stringify(g.TUNING),expectedRail:rail.object.userData.sourceName};
   const event=(code,down)=>document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));
   q.stop=()=>{q.done=true;for(const code of held)event(code,false);held.clear();};
   // Actual keyboard events at 20 Hz; no rival driver, device snapshots,
   // placement, speed changes, balance injection or camera manipulation.
   g.input.update=()=>{
    const now=performance.now();
    if(!q.done&&now>=q.nextInput){
     q.nextInput=now+50;const keys=[];
     if(r.phase==='running'){
      keys.push('KeyW','Space');
      if(mode==='choose-left'){
       if(p.state==='grind'){
        keys.shift();keys.push('KeyE');
        const correction=p.balance+p.balanceVel*.20;
        if(correction>.035)keys.push('KeyA');else if(correction<-.035)keys.push('KeyD');
       }else if(p.grounded){
        const aim=rail.pointAt(Math.min(26,rail.closest(p.pos).t+8)),basis=p.raceInputBasis(l),dx=aim.x-p.pos.x,dz=aim.z-p.pos.z;
        const angle=Math.atan2(dx*-basis.z+dz*basis.x,dx*basis.x+dz*basis.z);
        if(angle>Math.PI/8)keys.push('KeyD');else if(angle< -Math.PI/8)keys.push('KeyA');
        if(rail.closestDistance(p.pos)<5)keys.push('KeyE');
       }else keys.push('KeyE');
      }
     }
     const desired=new Set(keys);
     for(const code of held)if(!desired.has(code)){event(code,false);held.delete(code);}
     for(const code of desired)if(!held.has(code)){event(code,true);held.add(code);}
    }
    update();
   };
   function sample(){
    if(r.phase==='running'){
     const forward=p.pos.clone().set(0,0,-1).applyQuaternion(g.camera.quaternion),input=p.raceInputBasis(l);
     q.trace.push({time:r.elapsed,p:p.pos.toArray(),state:p.state,grounded:p.grounded,rail:p.grindRail?.object.userData.sourceName??null,t:p.grindT,
      input:[input.x,input.z],camera:[forward.x,forward.z],falls:r.riders[0].falls});
     if((mode==='forward'?p.pos.z<26:p.state==='grind'&&p.grindRail===rail&&p.grindT>110)||r.elapsed>25||r.riders[0].falls){q.stop();return;}
    }
    requestAnimationFrame(sample);
   }requestAnimationFrame(sample);
  },{mode,native});
  await page.getByRole('button',{name:'RACE',exact:true}).click();
  await page.waitForFunction(()=>window.openingCamera.done,null,{timeout:90000});
  await page.screenshot({path:`${output}/${mode}-${native?'native':'normal'}.png`});
  const result=await page.evaluate(()=>{const g=window.__game,q=window.openingCamera;return {trace:q.trace,expectedRail:q.expectedRail,tuningUnchanged:q.tuning===JSON.stringify(g.TUNING),
   viewport:[innerWidth,innerHeight],buffer:[g.renderer.domElement.width,g.renderer.domElement.height],pixelRatio:Math.min(devicePixelRatio||1,2),quality:g.renderQualitySettings.snapshot()};});
  const angle=(a,b)=>Math.atan2(a[0]*b[1]-a[1]*b[0],a[0]*b[0]+a[1]*b[1])*180/Math.PI;
  const trace=result.trace,first=trace[0],last=trace.at(-1);
  result.maxCameraFromStart=Math.max(...trace.map(v=>Math.abs(angle(first.camera,v.camera))));
  result.maxInputStep=Math.max(...trace.slice(1).map((v,i)=>Math.abs(angle(trace[i].input,v.input))));
  runs.push({mode,...result});
  await writeFile(output+'/report.json',JSON.stringify({scope:`Opening deck and one selected rail through real KeyboardEvents; full render at ${native?'MAX/native':'normal 720p'} resolution.`,runs,errors},null,2));
  assert.equal(result.quality.enabled,!native);assert.deepEqual(result.buffer,native?result.viewport.map(v=>Math.floor(v*result.pixelRatio)):[1280,720]);
  assert.equal(result.tuningUnchanged,true);assert.equal(last.falls,0);assert.deepEqual(errors,[]);
  if(mode==='forward'){
   assert.ok(last.p[2]<26,'Forward input traverses the starting deck');
   assert.ok(result.maxCameraFromStart<.1&&result.maxInputStep<.1,'No unchosen branch may turn the opening view or controls');
   assert.ok(Math.abs(last.p[0]-first.p[0])<1.5,'Forward remains forward across the deck, allowing normal rival contact');
  }else{
   assert.equal(last.rail,result.expectedRail);assert.ok(last.t>110,'The chosen rail remains playable through its first bends');
   assert.ok(result.maxCameraFromStart>10,'The camera resumes turning with the selected curving rail');
  }
  console.log(JSON.stringify({mode,seconds:last.time,maxCameraFromStart:result.maxCameraFromStart,maxInputStep:result.maxInputStep,last,errors}));
 }
}finally{await browser.close();}
