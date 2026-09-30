import nodeAssert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5173';
const output=process.env.BLOCKWORKS_BROWSER_OUTPUT||'/private/tmp/blockworks-aqueduct-browser';
await mkdir(output,{recursive:true});
// Reuse the same adaptive assertions and control decisions as the Node pilot.
// Yield each requested input to the real application's fixed-step loop: loaded
// character poses can change high-crate contact timing, so blind input replay
// cannot safely substitute for observing the live rider's landings.
let pilot=await readFile(new URL('./test-blockworks-aqueduct.mjs',import.meta.url),'utf8');
pilot=pilot.slice(pilot.indexOf('/** Session'),pilot.lastIndexOf("if(process.argv[1]"))
 .replace('export function pumpAqueductRow','function* pumpAqueductRow')
 .replace('export async function runAqueduct','function* runAqueduct')
 .replace(/\btick\(/g,'yield* tick(').replace(/\buntil\(/g,'yield* until(')
 .replace(/f\.stepFor\(/g,'yield* f.stepFor(').replace(/f\.walkTo\(/g,'yield* f.walkTo(')
 .replace('sessions.push(pumpAqueductRow','sessions.push(yield* pumpAqueductRow')
 .replace(/finally\{await writeFile\([^\n]+\);\}/,'finally{}');
const full=process.argv.includes('--full');
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(new URL('?playtest&level=codex-lab'+(full?'':'&lite'),base).href);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.evaluate(async pilot=>{
  const g=window.__game,l=g.getLevel(),p=g.player,m=await import('/src/levels/codex-lab.ts');
  p.respawn(l,true,false,{position:p.pos.clone().set(...m.routePoint(746,.02))});
  const report=window.aqueductReview={frame:0,done:false,peak:0,failed:null,stage:'start',trace:[],actions:[],targets:[],framing:[],tuning:{...g.TUNING}};
  // Sample the actual rendered pose, including skinned and morphed vertices.
  // Rigid batch sources stay visible in the semantic rider hierarchy even
  // when their draw layers are replaced by a palette-driven render proxy.
  const vertex=p.pos.clone(),instance=g.camera.matrixWorld.clone(),world=g.camera.matrixWorld.clone();
  let lastFramingFrame=-10;
  const measureFraming=()=>{
    const rider=p.riderRef;if(!rider)return;
    rider.updateWorldMatrix(true,true);rider.updateMatrixWorld(true);
    let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity,vertices=0,behind=0;
    const visit=node=>{
      if(node!==rider&&!node.visible)return;
      if(node.isMesh&&!node.userData.characterRenderProxy){
        const materials=Array.isArray(node.material)?node.material:[node.material],positions=node.geometry.getAttribute('position');
        if(positions&&materials.some(material=>material.visible&&material.opacity>0)){
          if(node.isSkinnedMesh)node.skeleton.update();
          for(let item=0;item<(node.isInstancedMesh?node.count:1);item++){
            world.copy(node.matrixWorld);if(node.isInstancedMesh){node.getMatrixAt(item,instance);world.multiply(instance);}
            for(let i=0;i<positions.count;i++){
              node.getVertexPosition(i,vertex).applyMatrix4(world).project(g.camera);vertices++;
              minY=Math.min(minY,vertex.y);maxY=Math.max(maxY,vertex.y);minX=Math.min(minX,vertex.x);maxX=Math.max(maxX,vertex.x);
              if(vertex.z>1)behind++;
            }
          }
        }
      }
      for(const child of node.children)visit(child);
    };
    visit(rider);report.framing.push({frame:report.frame,y:p.pos.y,verticalSpeed:p.vVel,focus:20-p.pos.z<850?826:874,minY,maxY,minX,maxX,vertices,behind});
  };
  const render=g.renderer.render.bind(g.renderer);
  g.renderer.render=(scene,camera)=>{
    // Render updates the camera matrices first. Sampling afterwards avoids
    // comparing the current rider with the previous frame's view matrix.
    const result=render(scene,camera);
    if(scene===g.scene&&camera===g.camera&&p.pos.y>10&&report.frame-lastFramingFrame>=6&&!report.done){measureFraming();lastFramingFrame=report.frame;}
    return result;
  };
  const snapshot=()=>({frame:report.frame,position:p.pos.toArray(),heading:p.axisF.toArray(),speed:p.speed,verticalSpeed:p.vVel,
    state:p.state,grounded:p.grounded,bailing:p.isBailing,deaths:p.totalDeaths,rail:p.grindRail?l.rails.indexOf(p.grindRail):null,
    ground:p.groundHit?{name:p.groundHit.name,y:p.groundHit.y,normal:p.groundHit.normal.toArray()}:null,input:{...last}});
  const assert=(v,message)=>{if(!v)throw Error(message);};assert.ok=assert;assert.equal=(a,b,message)=>assert(a===b,`${message??'expected equality'} (${a} vs ${b})`);
  const alive=label=>assert(!p.isBailing&&!['dead','gameover'].includes(p.state),label+': '+JSON.stringify(snapshot()));
  let last={},context,pending;
  const fields=['moveX','moveY','jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed','transferHeld','transferPressed','restartPressed'];
  const normalize=sample=>{
    const out=Object.fromEntries(fields.map(k=>[k,k==='moveX'||k==='moveY'?0:false]));Object.assign(out,sample);
    const length=Math.hypot(out.moveX,out.moveY);if(length>1){out.moveX/=length;out.moveY/=length;}
    out.moveX=Math.round(out.moveX*100)/100;out.moveY=Math.round(out.moveY*100)/100;
    for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){const pressed=held.replace('Held','Pressed');if(!(pressed in sample))out[pressed]=!!out[held]&&!last[held];}
    if(!('jumpReleased' in sample))out.jumpReleased=!out.jumpHeld&&!!last.jumpHeld;
    return out;
  };
  const tick=function*(sample={}){yield sample;return snapshot();};
  const stepFor=function*(count,sample={}){for(let i=0;i<count;i++)yield* tick(typeof sample==='function'?sample(context,i):sample);return snapshot();};
  const until=function*(predicate,sample={},opts={}){
    const firstFrame=report.frame;report.stage=opts.label??report.stage;
    for(let i=0;i<(opts.maxFrames??1800)&&!predicate(context);i++){
      yield* tick(typeof sample==='function'?sample(context,i):sample);if(!opts.allowDeath)alive(opts.label);
    }
    assert(predicate(context),(opts.label??'until')+' timed out '+JSON.stringify(snapshot()));
    report.actions.push({name:opts.label,firstFrame,lastFrame:report.frame});return snapshot();
  };
  const point=value=>Array.isArray(value)?{x:value[0],y:value[1],z:value[2]}:value;
  const resolve=value=>point(typeof value==='function'?value(context):value);
  const distanceTo=target=>{const q=resolve(target);return Math.hypot(q.x-p.pos.x,q.z-p.pos.z);};
  const worldDirectionInput=(direction,pace=1)=>{
    const d=point(direction),length=Math.hypot(d.x,d.z);if(length<1e-8||pace===0)return{moveX:0,moveY:0};
    const f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},scale=1/(Math.hypot(f.x,f.z)||1),fx=f.x*scale,fz=f.z*scale;
    return{moveX:(d.x*-fz+d.z*fx)/length*pace,moveY:(d.x*fx+d.z*fz)/length*pace};
  };
  const steerToward=(target,opts={})=>{const q=resolve(target),dx=q.x-p.pos.x,dz=q.z-p.pos.z;return Math.hypot(dx,dz)<=(opts.tolerance??.08)?{moveX:0,moveY:0}:worldDirectionInput({x:dx,z:dz},opts.pace??1);};
  const walkTo=function*(target,opts={}){
    yield* until(()=>distanceTo(target)<(opts.tolerance??.1),()=>{
      assert(p.grounded,'walk lost support');return{...steerToward(target,{pace:opts.pace??.15,tolerance:opts.tolerance??.1}),...opts.buttons};
    },{maxFrames:opts.maxFrames??1800,label:opts.label});
    yield* stepFor(opts.settleFrames??30,opts.buttons??{});alive('walk settle');assert(p.grounded,'walk lost support while stopping');
    assert(distanceTo(target)<=(opts.arrivalTolerance??.18),'walk stopping momentum missed target');return snapshot();
  };
  context={p,l,sourceModule:m,source:m.CODEX_LAB_LEVEL,TUNING:g.TUNING,tick,until,stepFor,walkTo,worldDirectionInput,steerToward,distanceTo,snapshot,trace:report.trace,get frame(){return report.frame;}};
  const generator=new Function('assert','process',pilot+';return runAqueduct;')(assert,{env:{}})(context);
  pending=generator.next();
  const realStep=p.step.bind(p),realCommit=p.commitRenderStep.bind(p),realBail=p.bail.bind(p);
  let advanced=false;
  p.bail=(...args)=>{report.bail={frame:report.frame,args,before:snapshot(),stack:new Error().stack};return realBail(...args);};
  p.step=(dt,input,level)=>{if(report.done)return;try{last=normalize(pending.value??{});Object.assign(input,last);realStep(dt,input,level);advanced=true;}catch(e){report.failed={message:String(e),snapshot:snapshot()};report.done=true;}};
  p.commitRenderStep=(...args)=>{
    realCommit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.peak=Math.max(report.peak,p.pos.y);report.trace.push(snapshot());
    try{pending=generator.next();if(pending.done){report.done=true;report.evidence=pending.value;report.end=snapshot();report.targets=m.BLOCKWORKS_VERT_AQUEDUCT.targets.map(t=>({name:t.name,alive:l.crates.find(c=>Math.hypot(c.mesh.position.x-t.p[0],c.mesh.position.z-t.p[2])<.001)?.alive}));}}
    catch(e){report.done=true;report.failed={message:String(e),snapshot:snapshot()};}
  };
 },pilot);
 const captured=new Set();
 for(let i=0;i<600;i++){
  await page.waitForTimeout(250);const r=await page.evaluate(()=>({done:window.aqueductReview.done,frame:window.aqueductReview.frame,y:window.__game.player.pos.y,verticalSpeed:window.__game.player.vVel,focus:20-window.__game.player.pos.z<850?826:874,peak:window.aqueductReview.peak,stage:window.aqueductReview.stage}));
  if(!captured.has(r.focus)&&r.y>14&&Math.abs(r.verticalSpeed)<6){await page.screenshot({path:`${output}/high-air-${r.focus}-${full?'full':'lite'}.png`});captured.add(r.focus);}
  if(i%80===0)console.log(JSON.stringify(r));if(r.done)break;
 }
 const report=await page.evaluate(()=>window.aqueductReview);
 await writeFile(`${output}/aqueduct-adaptive-${full?'full':'lite'}.json`,JSON.stringify({...report,errors},null,2));
 await page.screenshot({path:`${output}/aqueduct-exit-adaptive-${full?'full':'lite'}.png`});
 console.log(JSON.stringify({frame:report.frame,done:report.done,peak:report.peak,failed:report.failed,evidence:report.evidence,bail:report.bail,targets:report.targets,errors}));
 nodeAssert.equal(report.done,true,'live aqueduct pilot timed out');
 nodeAssert.equal(report.failed,null,'live aqueduct assertions failed');
 nodeAssert.equal(report.evidence?.receiver,true,'live rider did not transfer between the relocated rails');
 nodeAssert.ok(report.framing.length>20,'high airs need actual rendered-rider framing samples');
 for(const focus of [826,874]){
  const row=report.framing.filter(sample=>sample.focus===focus&&sample.y>14);
  const apex=row.filter(sample=>Math.abs(sample.verticalSpeed)<6);
  nodeAssert.ok(row.length>5,`missing high-air framing at row ${focus}`);
  nodeAssert.ok(row.every(sample=>sample.vertices>100&&sample.behind===0),`invalid rendered-rider samples at row ${focus}`);
  // The local camera setting must reveal the complete rider and target at
  // the reward apex; retain descent samples in the report so ordinary camera
  // easing near touchdown is visible without widening its global behavior.
  nodeAssert.ok(apex.length>=3,`missing reward-apex framing at row ${focus}`);
  nodeAssert.ok(apex.every(sample=>sample.minY>=-1.04&&sample.maxY<=1.04),
    `rider cropped vertically at row ${focus} apex: ${JSON.stringify(apex.filter(sample=>sample.minY< -1.04||sample.maxY>1.04))}`);
  nodeAssert.ok(captured.has(focus),`missing apex screenshot at row ${focus}`);
  console.log(JSON.stringify({focus,framingSamples:row.length,apexSamples:apex.length,
    apexMinY:Math.min(...apex.map(sample=>sample.minY)),apexMaxY:Math.max(...apex.map(sample=>sample.maxY)),
    highAirMinY:Math.min(...row.map(sample=>sample.minY)),highAirMaxY:Math.max(...row.map(sample=>sample.maxY))}));
 }
 nodeAssert.deepEqual(errors,[],'browser errors during live aqueduct validation');
}finally{await browser.close();}
