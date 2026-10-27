import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5274',mode=process.env.WATERFALL_MODE||'lite';
const out=process.env.WATERFALL_OUTPUT||'docs/waterfall-climb/runs/review';await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:"export {WATERFALL_CLIMB_LEVEL as source,WATERFALL_ACTIONS as route} from './src/levels/waterfall-climb';export {WATERFALL_CLIMB_BONUS as bonus} from './src/levels/waterfall-climb-bonus';export {runWaterfallBonus} from './tools/waterfall-climb-pilot.mjs';export {puzzleControls} from './tools/puzzle-controls.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[],evidence=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/waterfall-review-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text}));
const ready=async id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
const snapshot=async label=>{
 await page.evaluate(async()=>{await window.__game.getLevel().jungleAssets?.ready();});
 await page.waitForTimeout(250);
 const value=await page.evaluate(label=>{const g=window.__game,p=g.player,l=g.getLevel();return {label,id:g.getCurrentLevel().id,position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,lives:p.lives,crates:p.cratesBroken,bonusCrates:p.bonusCrates,bonusComplete:l.bonusRoundCompleted,bonusMode:p.bonusMode,camera:g.camera.position.toArray(),resolution:g.renderQualitySettings.regularResolution,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],size:g.getRenderQualitySizes(),assets:l.jungleAssets?.diagnostics};},label);
 assert.deepEqual(value.assets?.errors??[],[],'Scenery assets loaded');
 if(mode==='full'&&!label.endsWith('normal'))assert.deepEqual(value.buffer,[1920,1080]);
 evidence.push(value);console.log('REVIEW',JSON.stringify(value));await page.screenshot({path:`${out}/${mode}-${label}.png`});return value;
};
async function pilot(kind){
 await page.evaluate(async kind=>{
  window.waterfallReviewRestore?.();const m=await import('/waterfall-review-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const report=window.waterfallReview={frame:0,done:false,error:null,actions:[],evidence:[],kind},ctx={p,l,source:kind==='bonus'?m.bonus:m.source,report,get frame(){return report.frame;}};
  const c=m.puzzleControls(ctx);
  const enter=function*(){const b=l.bonusPlatformDiagnostics;yield* c.stepFor(12);yield* c.walk([b.x+5,b.y,b.z],'Approach the raised bonus entrance');yield* c.hop([b.x,b.topY,b.z],'Jump onto the bonus entrance',{tolerance:1.6});return {enteredByJump:true};};
  const gen=kind==='bonus'?m.runWaterfallBonus(ctx):enter();let next=gen.next(),last={},advanced=false;
  const originalStep=p.step,originalCommit=p.commitRenderStep;
  window.waterfallReviewRestore=()=>{p.step=originalStep;p.commitRenderStep=originalCommit;window.waterfallReviewRestore=null;};
  p.step=function(dt,input,level){
   if(report.done)return originalStep.call(this,dt,input,level);
   const s=next.value??{};input.moveX=s.moveX??0;input.moveY=s.moveY??0;const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
   input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){input[held]=s[held]??false;input[held.replace('Held','Pressed')]=s[held.replace('Held','Pressed')]??(input[held]&&!last[held]);}
   input.jumpReleased=s.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.jumpCancelled=false;input.restartPressed=false;last={...s};originalStep.call(this,dt,input,level);advanced=true;
  };
  p.commitRenderStep=function(...args){originalCommit.apply(this,args);if(!advanced||report.done)return;advanced=false;report.frame++;
   try{next=gen.next();if(next.done){report.done=true;report.result=next.value;}}catch(e){report.done=true;report.error=String(e);}
  };
 },kind);
 const began=Date.now();let state;
 do{await page.waitForTimeout(1000);state=await page.evaluate(()=>({done:window.waterfallReview.done,error:window.waterfallReview.error,stage:window.waterfallReview.stage,frame:window.waterfallReview.frame}));
  if(state.frame%600<65)console.log('PILOT',JSON.stringify(state));
 }while(!state.done&&Date.now()-began<300000);
 const report=await page.evaluate(()=>{window.waterfallReviewRestore?.();return window.waterfallReview;});
 await writeFile(`${out}/${mode}-${kind}-pilot.json`,JSON.stringify(report,null,2));assert.ok(report.done,kind+' pilot finished');assert.equal(report.error,null);return report;
}
try{
 await page.goto(`${base}/?playtest&level=waterfall-climb${mode==='lite'?'&lite':''}`,{timeout:180000});await ready('waterfall-climb');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 if(process.env.WATERFALL_REVIEW!=='bonus'){
  await snapshot('river-start');
  for(let i=0;i<10;i++){
   await page.keyboard.press('m');await page.keyboard.press('l');await page.keyboard.press('m');await page.waitForTimeout(800);
   const state=await page.evaluate(()=>({grounded:window.__game.player.grounded,state:window.__game.player.state}));assert.ok(state.grounded);assert.equal(state.state,'ride');
   await snapshot(`checkpoint-${String(i).padStart(2,'0')}`);
   if(mode==='full'&&[1,6,9].includes(i)){
    await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(720);g.crtGuestSettings.setEnabled(true);});
    await page.waitForTimeout(450);await snapshot(`checkpoint-${String(i).padStart(2,'0')}-normal`);
    await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
    await page.waitForTimeout(250);
   }
  }
  if(mode==='full'){
   await page.waitForTimeout(500);
   const overview=await page.evaluate(async()=>{
    const g=window.__game,l=g.getLevel(),r=g.renderer,camera=g.camera.clone();
    camera.aspect=16/9;camera.fov=48;camera.near=.1;camera.far=1500;
    camera.position.set(118,105,-855);camera.lookAt(0,78,-1143);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    l.updateSceneryView(camera);await l.jungleAssets?.ready();g.scene.updateMatrixWorld(true);
    const old=r.getRenderTarget(),visible=g.player.group.visible;
    try{
     g.player.group.visible=false;r.setRenderTarget(null);r.render(g.scene,camera);
     const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;canvas.getContext('2d').drawImage(r.domElement,0,0,640,360);
     return {png:r.domElement.toDataURL('image/png'),jpeg:canvas.toDataURL('image/jpeg',.9),camera:camera.position.toArray(),assets:l.jungleAssets?.diagnostics};
    }finally{g.player.group.visible=visible;r.setRenderTarget(old);l.updateSceneryView(g.camera);}
   });
   await writeFile(`${out}/full-overview.png`,Buffer.from(overview.png.split(',')[1],'base64'));
   await writeFile(`${out}/full-overview-preview.jpg`,Buffer.from(overview.jpeg.split(',')[1],'base64'));
   evidence.push({label:'art-overview',camera:overview.camera,assets:overview.assets,note:'Separate presentation camera; gameplay camera remains unchanged.'});
  }
  if(process.env.WATERFALL_REVIEW==='camera'){assert.deepEqual(errors,[]);console.log('PASS supported checkpoint/camera tour');}
 }
 if(process.env.WATERFALL_REVIEW!=='camera'){
  if(process.env.WATERFALL_REVIEW!=='bonus'){await page.evaluate(()=>window.__game.switchLevel('waterfall-climb'));await ready('waterfall-climb');}
  await page.keyboard.press('m');for(let i=0;i<5;i++){await page.keyboard.press('l');await page.waitForTimeout(180);}await page.keyboard.press('m');
  await page.waitForTimeout(500);const parent=await snapshot('bonus-parent-before');
  await page.evaluate(()=>{const g=window.__game;window.waterfallParent=g.getLevel();window.waterfallParentTuning=JSON.stringify(g.TUNING);});
  await pilot('enter');await ready('bonus:waterfall-climb');await snapshot('bonus-first-entry');
  // An actual leftward jump clears the arrival edge; the bonus keeps its
  // authored depth walls and ordinary walking edge guard.
  await page.keyboard.down('Space');await page.waitForTimeout(450);await page.keyboard.down('ArrowLeft');await page.keyboard.up('Space');await page.waitForTimeout(1500);await page.keyboard.up('ArrowLeft');
  await ready('waterfall-climb');await page.waitForTimeout(500);const failed=await snapshot('bonus-failure-return');
  assert.equal(failed.bonusComplete,false);assert.equal(failed.bonusCrates,0);assert.equal(failed.lives,parent.lives);assert.equal(failed.crates,parent.crates);
  await pilot('enter');await ready('bonus:waterfall-climb');const complete=await pilot('bonus');await ready('waterfall-climb');await page.waitForTimeout(800);
  const paid=await snapshot('bonus-success-return');assert.ok(paid.grounded);assert.equal(paid.bonusCrates,22);assert.equal(paid.bonusComplete,true);assert.equal(paid.crates,parent.crates);
  assert.ok(await page.evaluate(()=>window.waterfallParent===window.__game.getLevel()));
  assert.ok(await page.evaluate(()=>window.waterfallParentTuning===JSON.stringify(window.__game.TUNING)));
  assert.equal(complete.result.completionScope,'bonus-detour');assert.equal(complete.result.gemEarned,false);assert.deepEqual(errors,[]);
  console.log('PASS actual jump entry, free failed return, retry, 22-box bonus, real payout and same-parent restoration');
 }
}finally{await writeFile(`${out}/${mode}-review.json`,JSON.stringify({evidence,errors},null,2));await browser.close();}
