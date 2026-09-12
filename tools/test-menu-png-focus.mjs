import assert from 'node:assert/strict';import fs from 'node:fs/promises';import{pathToFileURL}from'node:url';import{execFileSync}from'node:child_process';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.MENU_TEST_URL||'http://127.0.0.1:5178/',out=process.env.MENU_TEST_OUT||'/private/tmp/menu-png-focus-review';await fs.mkdir(out,{recursive:true});
const reference=JSON.parse(await fs.readFile(new URL('../docs/menu-focus-reference.json',import.meta.url),'utf8'));
for(const name of ['atlas.ts','dom.ts']){
 const path='src/roo-type/'+name;assert.deepEqual(await fs.readFile(new URL('../'+path,import.meta.url)),execFileSync('git',['show','0a26dd9:'+path]),path+' changed from the approved PNG renderer');
}
for(const palette of ['bonus','counter']){
 const current=JSON.parse(await fs.readFile(new URL(`../public/fonts/roo-${palette}-v10.json`,import.meta.url),'utf8'));
 const prior=JSON.parse(await fs.readFile(new URL(`../public/fonts/roo-${palette}-v9.json`,import.meta.url),'utf8'));
 delete current.version;delete prior.version;assert.deepEqual(current,prior,'Colour-only font update changed glyph geometry');
}
const b=await chromium.launch({channel:'chrome',headless:true}),report={reference:{fps:reference.fps,cycle:reference.cycle,lumaRatio:reference.lumaRatio},modes:[],errors:[]};
try{
 for(const lite of [true,false]){
  const p=await b.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await p.addInitScript(()=>{localStorage.setItem('solProtoRooAppearanceV4',JSON.stringify({tracking:-.065,shimmer:false,lightStrength:1}));window.menuPad={id:'DualSense Wireless Controller',index:0,connected:true,mapping:'standard',timestamp:1,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.menuPad]});});
  await p.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));await p.waitForFunction(()=>window.__game?.gameFlow&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await p.evaluate(()=>window.__game.gameFlow.showLaunch());await p.waitForFunction(()=>document.querySelector('.game-menu-button.selected [data-ready]'));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(200);
  const sampled=await p.evaluate(async()=>{
   const root=document.querySelector('.game-shell'),button=root.querySelector('.game-menu-button.selected'),svg=button.querySelector('.roo-text-svg'),hrefs=[...svg.querySelectorAll('image')].map(e=>e.getAttribute('href')),trace=[];
   let previous=-1,started=false;
   return await new Promise((resolve,reject)=>{
    const start=performance.now();
    function read(){
     if(performance.now()-start>10000){reject(new Error('Menu did not present sixty reference frames'));return;}
     const frame=Number(root.dataset.menuPngFrame);
     if(!started&&frame===0){started=true;previous=-1;}
     if(started&&frame!==previous){
      const c=window.__game.gameFlow.gameFlowSurface.resources.canvas,ctx=c.getContext('2d'),r=button.getBoundingClientRect(),sx=c.width/innerWidth,sy=c.height/innerHeight,d=ctx.getImageData(Math.round(r.x*sx),Math.round(r.y*sy),Math.round(r.width*sx),Math.round(r.height*sy)).data;
      let n=0;const rgb=[0,0,0];for(let i=0;i<d.length;i+=4)if(d[i+3]>240){n++;for(let c=0;c<3;c++)rgb[c]+=d[i+c];}
      trace.push({frame,phase:root.dataset.menuPngPhase,rgb:rgb.map(v=>v/Math.max(1,n)),ms:performance.now()-start});previous=frame;
     }
     if(trace.length===60){resolve({trace,sameSvg:svg===button.querySelector('.roo-text-svg'),sameImages:JSON.stringify(hrefs)===JSON.stringify([...svg.querySelectorAll('image')].map(e=>e.getAttribute('href'))),filter:getComputedStyle(button.querySelector('.roo-menu-art')).filter});return;}
     requestAnimationFrame(read);
    }requestAnimationFrame(read);
   });
  });
  assert.ok(sampled.sameSvg&&sampled.sameImages,'Flash replaced the original PNG markup');
  for(const [i,s]of sampled.trace.entries()){
   assert.equal(s.frame,i%4,'A 30 fps reference frame was skipped');assert.equal(s.phase,reference.frames[i].state);
   assert.equal(s.rgb[2]>150,s.phase==='white','Displayed pixels do not match the reference frame state');
  }
  const average=phase=>[0,1,2].map(c=>{const samples=sampled.trace.filter(s=>s.phase===phase);return samples.reduce((n,s)=>n+s.rgb[c],0)/samples.length;});
  const orange=average('orange'),white=average('white'),luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722,ratio=luma(white)/luma(orange);
  // The latest brief keeps the normal orange PNG untouched; only the white peak is calibrated.
  assert.ok(Math.abs(luma(white)-reference.whiteLuma)<6,`White intensity ${luma(white)} differs from reference ${reference.whiteLuma}`);
  for(const s of ['orange','white']){await p.waitForFunction(s=>document.querySelector('.game-shell').dataset.menuPngPhase===s,s);await p.screenshot({path:`${out}/launch-${s}-${lite?'lite':'full'}.png`});}
  const shape=await p.evaluate(()=>{
   const painter=window.__game.gameFlow.gameFlowSurface.rooAtlas,c=document.createElement('canvas');c.width=700;c.height=140;const ctx=c.getContext('2d',{willReadFrequently:true});
   const draw=filter=>{ctx.filter='none';ctx.clearRect(0,0,700,140);ctx.filter=filter;painter.draw(ctx,'NEW GAME',350,70,{size:60,palette:'counter',lightPosition:0,align:'center'});return ctx.getImageData(0,0,700,140).data;};
   const a=draw('none'),filtered=draw('saturate(0) brightness(1.93726)'),restored=draw('none');let alpha=0,restoration=0;for(let i=0;i<a.length;i++){if(i%4===3)alpha=Math.max(alpha,Math.abs(a[i]-filtered[i]));restoration+=Number(a[i]!==restored[i]);}return{alpha,restoration};
  });assert.equal(shape.alpha,0);assert.equal(shape.restoration,0);
  await p.evaluate(()=>{window.menuPad.buttons[13]={pressed:true,touched:true,value:1};window.menuPad.timestamp++;});await p.waitForFunction(()=>document.querySelector('.game-menu-button.selected')?.textContent==='LOAD GAME');await p.evaluate(()=>{window.menuPad.buttons[13]={pressed:false,touched:false,value:0};window.menuPad.timestamp++;});
  await p.emulateMedia({reducedMotion:'reduce'});await p.waitForTimeout(200);assert.equal(await p.locator('.game-shell').getAttribute('data-menu-png-phase'),'orange');await p.waitForTimeout(500);assert.equal(await p.locator('.game-shell').getAttribute('data-menu-png-phase'),'orange');await p.emulateMedia({reducedMotion:'no-preference'});
  for(const screen of ['pause','options','level-select','save-load']){
   await p.evaluate(screen=>{const g=window.__game;g.campaign.newGame(1);if(screen==='pause')g.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false});else g.gameFlow.showMapSection(screen);},screen);await p.waitForTimeout(250);
   const style=await p.locator('.game-menu-button.selected').evaluate(e=>({arrow:getComputedStyle(e,'::before').display,outline:getComputedStyle(e).outlineStyle,shadow:getComputedStyle(e).boxShadow}));assert.deepEqual(style,{arrow:'none',outline:'none',shadow:'none'});
   await p.screenshot({path:`${out}/${screen}-${lite?'lite':'full'}.png`});
  }
  // Six live sliders belong to M-dismissible debug chrome, never the game menu.
  await p.evaluate(()=>window.__game.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false}));await p.keyboard.press('KeyM');await p.locator('.secondary-text-tuner summary').click();
  assert.equal(await p.locator('[data-menu-png-setting]').count(),6);assert.equal(await p.locator('.game-shell [data-menu-png-setting]').count(),0);
  const slider=async(key,value)=>{await p.locator(`[data-menu-png-setting="${key}"]`).evaluate((e,v)=>{e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));},value);await p.waitForTimeout(80);};
  await slider('whitePercent',0);assert.equal(await p.locator('.game-menu-button.selected').evaluate(e=>e.style.getPropertyValue('--menu-png-colour-filter')),'none');
  await slider('whitePercent',100);await slider('whiteBrightness',2.5);assert.match(await p.locator('.game-menu-button.selected').evaluate(e=>e.style.getPropertyValue('--menu-png-colour-filter')),/brightness\(2.5\)/);
  await slider('whiteDesaturation',.8);assert.match(await p.locator('.game-menu-button.selected').evaluate(e=>e.style.getPropertyValue('--menu-png-colour-filter')),/saturate\(0.19|saturate\(0.2/);
  await slider('inactiveSaturation',.2);await slider('inactiveBrightness',.7);
  assert.equal(await p.locator('.game-pause-actions .game-menu-button:not(.selected)').first().evaluate(e=>e.style.getPropertyValue('--menu-png-colour-filter')),'saturate(0.2) brightness(0.7)');
  await slider('rateHz',3.75);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('solProtoMenuPngFocusV2')).rateHz),3.75);
  await p.locator('[data-menu-png-reset]').click();await p.waitForTimeout(80);
  assert.equal(await p.locator('[data-menu-png-setting="rateHz"]').inputValue(),'7.5');assert.equal(await p.locator('[data-menu-png-setting="whitePercent"]').inputValue(),'25');
  await p.screenshot({path:`${out}/sliders-${lite?'lite':'full'}.png`});
  await p.locator('[data-roo-setting="shimmer"]').check();await p.keyboard.press('KeyM');assert.equal(await p.locator('.secondary-text-tuner').isVisible(),false);
  // Menu items display the original neutral PNG; the underlying PNG decoder stays unchanged.
  const visibleWeights=await p.locator('.game-pause-actions .game-menu-button .roo-text-svg').first().locator(':scope >g>g').evaluateAll(es=>es.map(e=>getComputedStyle(e).opacity));assert.deepEqual(visibleWeights,['1','0','0']);
  await p.evaluate(()=>window.__game.gameFlow.hide());await p.waitForTimeout(100);const idle=await p.locator('.game-shell').getAttribute('data-menu-png-frame');await p.waitForTimeout(300);assert.equal(await p.locator('.game-shell').getAttribute('data-menu-png-frame'),idle);
  report.modes.push({lite,orange,white,ratio,shape,sampled});await p.close();
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log('PASS: sixty displayed reference frames, 1-white/3-orange cadence, calibrated intensity, unchanged PNG pipeline/alpha/markup, controller focus, neutral PNG, six live sliders, reduced motion and idle behaviour (lite/full).');
}finally{await b.close();}
