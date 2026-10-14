import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5288/';
const output=process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'docs/drowned-crown/excellence/camera-input-browser.json';
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(base+'?playtest&renderdiag&level=drowned-crown',{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);});
 const report={runs:[]};
 for(const run of [
  {name:'forward',position:[4,8.05,-115],input:{moveY:.65},frames:80},
  {name:'backward',position:[4,8.05,-123],input:{moveY:-.65},frames:60},
  {name:'strafe',position:[-5,8.05,-119],input:{moveX:.7},frames:90},
  {name:'hold',position:[3,-3.95,-182],input:{moveY:.6},frames:90},
  {name:'jump beneath cabin',position:[0,8.05,-110],input:{moveY:-.5},frames:170,jump:true},
 ]){
  await page.evaluate(run=>{
   const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...run.position),heading:p.camDir.clone().set(0,0,-1)});
   const review=window.drownedCameraInput={name:run.name,frame:0,done:false,from:null,to:null,minDownCourse:1,maxHeight:run.position[1],enteredLegacyCabin:false,deaths:0};
   window.drownedCameraStep??=p.step.bind(p);
   p.step=(dt,input,level)=>{
    const frame=review.frame-20,active=frame>=0&&frame<run.frames;
    input.moveX=active?(run.input.moveX??0):0;input.moveY=active?(run.input.moveY??0):0;
    for(const key of ['jump','grind','spin','grab','transfer']){input[key+'Held']=false;input[key+'Pressed']=false;}input.jumpReleased=false;
    if(active&&run.jump){input.jumpHeld=frame<30;input.jumpPressed=frame===0;input.jumpReleased=frame===30;input.moveY=frame<34||frame>=50&&frame<65?0:run.input.moveY;}
    window.drownedCameraStep(dt,input,level);
    if(frame===0)review.from=p.pos.toArray();
    if(active){review.minDownCourse=Math.min(review.minDownCourse,-p.axisF.z);review.maxHeight=Math.max(review.maxHeight,p.pos.y);if(Math.abs(p.pos.x)<10&&p.pos.y>10&&p.pos.y<26&&p.pos.z>-109.5&&p.pos.z<-90.5)review.enteredLegacyCabin=true;}
    review.frame++;
    if(frame===run.frames){review.done=true;review.to=p.pos.toArray();review.state=p.state;review.grounded=p.grounded;review.deaths=p.totalDeaths;}
   };
  },run);
  await page.waitForFunction(()=>window.drownedCameraInput.done,null,{timeout:45000});
  const result=await page.evaluate(()=>window.drownedCameraInput);result.delta=result.to.map((v,i)=>v-result.from[i]);
  console.log(JSON.stringify({name:run.name,delta:result.delta,minDownCourse:result.minDownCourse,maxHeight:result.maxHeight,state:result.state,grounded:result.grounded}));
  assert.equal(result.deaths,0,run.name);assert.equal(result.state,'ride',run.name);assert.equal(result.grounded,true,run.name);
  assert.ok(result.minDownCourse>.75,`${run.name}: camera reversed the control heading`);
  if(run.jump)assert.ok(result.maxHeight>run.position[1]+2&&result.enteredLegacyCabin,'The jump never entered the old cabin view volume');
  else if(run.input.moveX){assert.ok(result.delta[0]>3);assert.ok(Math.abs(result.delta[2])<.05,'Strafing was redirected along the spine');}
  else{assert.ok(Math.abs(result.delta[2])>2);assert.ok(Math.abs(result.delta[0])<.05,'Forward/backward input was redirected sideways');assert.equal(Math.sign(result.delta[2]),-Math.sign(run.input.moveY));}
  report.runs.push(result);
 }
 await page.evaluate(()=>{const g=window.__game;g.player.step=window.drownedCameraStep;g.openEditor();const e=g.editor;window.drownedEditorBaseline=JSON.stringify(e.data);const v=e.data.components.findIndex(c=>c.t==='camnode'&&c.cameraView&&c.nm?.startsWith('Captain cabin'));e.sel=[v];e.renderProps();});
 const movement=page.getByRole('checkbox',{name:'change movement direction',exact:true});assert.equal(await movement.isChecked(),false);
 await movement.check();assert.equal(await page.evaluate(()=>window.__game.editor.data.components[window.__game.editor.sel[0]].cameraPresentationOnly),undefined);
 await page.evaluate(()=>window.__game.editor.undo());
 report.editor=await page.evaluate(()=>{const e=window.__game.editor,nodes=e.data.components.map((c,i)=>({c,i})).filter(({c})=>c.t==='camnode'&&!c.cameraView);return {unchanged:JSON.stringify(e.data)===window.drownedEditorBaseline,firstLabel:e.itemLabel(nodes[0].i),lastLabel:e.itemLabel(nodes.at(-1).i),nodes:nodes.length,groups:e.data.groups.filter(g=>g.nm.startsWith('Camera ·')).map(g=>g.nm),allViewsPresentationOnly:e.data.components.filter(c=>c.t==='camnode'&&c.cameraView).every(c=>c.cameraPresentationOnly)};});
 assert.equal(report.editor.unchanged,true);assert.match(report.editor.firstLabel,/1\/30$/);assert.match(report.editor.lastLabel,/30\/30$/);assert.equal(report.editor.allViewsPresentationOnly,true);
 await page.locator('.ed-test').click();await page.waitForFunction(()=>!window.__game.editor.active);
 report.resolution=await page.evaluate(()=>JSON.parse(document.querySelector('#render-diagnostics').textContent));assert.deepEqual(report.resolution.drawingBuffer,{width:3840,height:2160});assert.equal(report.resolution.settings.enabled,false);
 assert.deepEqual(errors,[]);report.errors=errors;
 await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:true,runs:report.runs.map(r=>({name:r.name,delta:r.delta,minDownCourse:r.minDownCourse,maxHeight:r.maxHeight})),editor:report.editor,errors}));
}finally{await browser.close();}
