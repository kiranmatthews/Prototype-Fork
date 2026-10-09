import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>/^http/.test(a))||'http://127.0.0.1:5178/';
const full=process.argv.includes('--full'),capture=process.argv.includes('--capture');
const output=process.env.PIRATE_BROWSER_OUTPUT||join(tmpdir(),'pirate-browser');await mkdir(output,{recursive:true});
const pilotSource=(await readFile(new URL('./pirate-wreck-pilot.mjs',import.meta.url),'utf8')).replace('export function* pirateJourney','return function* pirateJourney');
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}?playtest&level=drowned-crown${full?'':'&lite'}`);
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown',null,{timeout:90000});
 if(capture){
  await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  const pictures=await page.evaluate(async()=>{
   const THREE=await import('/node_modules/three/build/three.module.js'),g=window.__game;
   g.gameFlow.showPause({levelName:g.getLevel().name,inWarpRoom:false});
   const result=[];
   for(const [name,eye,look] of [
    ['ship',[-63,28,-75],[0,12,-175]],['cabin',[30,25,-74],[0,14,-113]],['hold',[4,2,-175],[2,0,-206]],['treasure',[32,20,-275],[32,12,-312]]]){
    const camera=new THREE.PerspectiveCamera(58,16/9,.1,700);camera.position.set(...eye);camera.lookAt(...look);camera.updateMatrixWorld(true);
    const target=new THREE.WebGLRenderTarget(1280,720);target.texture.colorSpace=THREE.SRGBColorSpace;
    const prev=g.renderer.getRenderTarget(),bytes=new Uint8Array(1280*720*4),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);g.renderer.readRenderTargetPixels(target,0,0,1280,720,bytes);g.renderer.setRenderTarget(prev);target.dispose();
    const ctx=canvas.getContext('2d'),img=ctx.createImageData(1280,720);for(let y=0;y<720;y++)img.data.set(bytes.subarray((719-y)*1280*4,(720-y)*1280*4),y*1280*4);ctx.putImageData(img,0,0);
    result.push({name,data:canvas.toDataURL('image/png').split(',')[1]});
   }return result;
  });
  for(const p of pictures)await writeFile(`${output}/${p.name}.png`,Buffer.from(p.data,'base64'));
  console.log(JSON.stringify({captured:pictures.map(p=>p.name),errors}));assert.deepEqual(errors,[]);
 } else {
 await page.evaluate(async source=>{
  const pirateJourney=new Function(source)(),g=window.__game,p=g.player,l=g.getLevel();
  if(g.frameStats.totalFixedSteps!==0||l.time!==0)throw Error('Install the pilot before the first simulation tick');
  const report=window.pirateReview={stage:'spawn',evidence:[],done:false,failure:null,frame:0,largestStep:0,tuning:JSON.stringify(g.TUNING),stamp:document.querySelector('.hud-build')?.textContent};
  const pilot=pirateJourney({p,l,report});let next=pilot.next(),last={},advanced=false;
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p),stepOrigin=p.pos.clone();
  p.step=(dt,input,level)=>{
   if(report.done)return;
   const sample=next.value??{};
   for(const key of ['moveX','moveY'])input[key]=sample[key]??0;
   const length=Math.hypot(input.moveX,input.moveY);if(length>1){input.moveX/=length;input.moveY/=length;}
   input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[key]=sample[key]??false;input[key.replace('Held','Pressed')]=input[key]&&!last[key];}
   input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
   last={...sample};stepOrigin.copy(p.pos);step(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;report.largestStep=Math.max(report.largestStep,p.pos.distanceTo(stepOrigin));
   try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;}}
   catch(error){report.done=true;report.failure=String(error);report.position=p.pos.toArray();}
  };
 },pilotSource);
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.screenshot({path:`${output}/spawn-${full?'full':'lite'}.png`});
 const captured=new Set();let lastStage='';
 for(let i=0;i<4800;i++){
  await page.waitForTimeout(250);const state=await page.evaluate(()=>window.pirateReview);
  if(!state)throw Error('The page reloaded during the journey; use a stable preview or deployed build');
  if(state.stage!==lastStage){lastStage=state.stage;console.log(JSON.stringify({stage:state.stage,frame:state.frame}));}
  if(/wreck|hull|cargo|lookout|hoard|hold|fissure|rigging|escape/i.test(state.stage)&&!captured.has(state.stage)){
   captured.add(state.stage);await page.screenshot({path:`${output}/${state.stage.replaceAll(' ','-')}-${full?'full':'lite'}.png`});
  }
  if(state.done){await writeFile(`${output}/report-${full?'full':'lite'}.json`,JSON.stringify({...state,errors},null,2));console.log(JSON.stringify({frame:state.frame,result:state.result,failure:state.failure,errors}));assert.equal(state.failure,null);assert.deepEqual(errors,[]);assert.equal(state.result.state,'finished');assert.equal(state.result.deaths,0);assert.equal(state.result.checkpoints,4);assert.equal(state.tuningUnchanged,true);assert.ok(state.largestStep<2.2);assert.match(state.stamp,/Codex\/sol fork/);break;}
  if(i===4799)throw Error('Browser journey timed out');
 }
 await page.screenshot({path:`${output}/finish-${full?'full':'lite'}.png`});
}
}finally{await browser.close();}
