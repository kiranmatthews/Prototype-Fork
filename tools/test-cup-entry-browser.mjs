import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.CUP_BROWSER||'chromium',base=process.argv[2]||'http://127.0.0.1:5187/';
const output=process.env.CUP_OUTPUT||'/private/tmp/cup-entry-qa';await mkdir(output,{recursive:true});
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'chrome'}:{})});
const errors=[],rows=[];
try{
  const context=await browser.newContext({viewport:{width:852,height:393},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
    window.__cupWork={};
    const p=WebGL2RenderingContext.prototype;
    for(const name of ['createTexture','createBuffer','createRenderbuffer','bufferData','compileShader','linkProgram']){
      const original=p[name];p[name]=function(...args){
        const g=window.__game;
        if(g?.getCurrentLevel().id==='jungle-cup'){
          const stage=(g.gameFlow.loadingPhase||'live')+':'+g.getCompetition()?.phase;
          const row=window.__cupWork[stage]??={};row[name]=(row[name]||0)+1;
        }
        return original.apply(this,args);
      };
    }
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const waitReady=()=>page.waitForFunction(()=>window.__game?.getCompetition()?.phase==='intro'&&!window.__game.gameFlow.blocksGameplay&&window.__game.getLoadingDiagnostics().pending.length===0,null,{timeout:120000});
  for(const route of ['cold','map','repeat']){
    if(route==='cold'){await page.goto(base+'?playtest&level=jungle-cup');await waitReady();}
    else{
      await page.evaluate(async()=>{const g=window.__game;await g.gameFlow.transition(()=>{g.switchLevel('warproom');g.gameFlow.hide();});window.__cupWork={};g.ui.onLevelSelect('jungle-cup');});
      await waitReady();
    }
    await page.waitForTimeout(350);
    const row=await page.evaluate(()=>{
      const g=window.__game,root=g.competitionUI.element;
      return {work:window.__cupWork,camera:g.camera.position.toArray(),hiddenAtlasImages:root.querySelectorAll('svg image').length,rootOpacity:getComputedStyle(root).opacity,rootFilter:getComputedStyle(root).filter,
        ui:g.getInterfaceSurfaceDiagnostics(),loading:g.getLoadingDiagnostics(),report:JSON.parse(localStorage.getItem('solProtoStabilityV1')),contextLost:g.renderer.getContext().isContextLost()};
    });
    assert.equal(row.hiddenAtlasImages,0);assert.equal(row.rootOpacity,'0');assert.equal(row.rootFilter,'none');assert.deepEqual(row.camera,[90,85,54]);assert.equal(row.contextLost,false);assert.deepEqual(row.loading.failed,[]);
    assert.deepEqual(row.work['live:intro']??{}, {},'first displayed Cup frame must not allocate buffers/textures or compile shaders');
    assert.ok(row.report.sessions.at(-1).events.some(e=>e.stage==='destination:ready'));rows.push({route,...row});
    if(route==='cold'){
      const parity=await page.evaluate(async()=>{
        const root=window.__game.competitionUI.element,painter=window.__game.competitionUI.surface;
        const descriptor=Object.getOwnPropertyDescriptor(performance,'now'),time=performance.now(),canvases=[];
        Object.defineProperty(performance,'now',{configurable:true,value:()=>time});
        const rects=()=>[...root.querySelectorAll('[data-roo-menu]')].map(e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height];});
        const paint=()=>{const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;canvases.push(c);const ctx=c.getContext('2d',{willReadFrequently:true});painter.paintElement(ctx,root);return ctx.getImageData(0,0,c.width,c.height).data;};
        try{
          const before=paint(),layout=JSON.stringify(rects());root.removeAttribute('data-precrt-composited');document.body.classList.remove('game-interface-composited');await Promise.resolve();await Promise.resolve();
          const nativeImages=root.querySelectorAll('svg image').length,after=paint();let different=0;
          for(let i=0;i<before.length;i++)if(before[i]!==after[i])different++;
          return {nativeImages,different,layoutEqual:layout===JSON.stringify(rects())};
        }finally{
          root.setAttribute('data-precrt-composited','');document.body.classList.add('game-interface-composited');
          if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;
          canvases.forEach(c=>c.width=c.height=1);
        }
      });
      assert.ok(parity.nativeImages>200);assert.equal(parity.different,0);assert.equal(parity.layoutEqual,true);rows.at(-1).inkParity=parity;
    }
    await page.screenshot({path:`${output}/${engine}-${route}-intro.png`});
    await page.getByRole('button',{name:'START RUN 1',exact:true}).click();
    await page.waitForFunction(()=>window.__game.getCompetition().phase==='running',null,{timeout:15000});
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(()=>window.__game.competitionUI.element.querySelectorAll('svg image').length),0);
  }
  // Finish the remaining heats through the actual scorecard/input path.
  for(let heat=1;heat<=3;heat++){
    await page.evaluate(()=>window.__game.getCompetition().remaining=.05);
    await page.waitForFunction(()=>{const e=window.__game.getCompetition();return e.phase==='judges'&&e.revealedJudges===3;},null,{timeout:25000});
    await page.getByRole('button',{name:'VIEW STANDINGS',exact:true}).click();
    if(heat<3){await page.getByRole('button',{name:`START RUN ${heat+1}`,exact:true}).click();await page.waitForFunction(()=>window.__game.getCompetition().phase==='running',null,{timeout:15000});}
  }
  assert.equal(await page.evaluate(()=>window.__game.getCompetition().phase),'final');
  await page.screenshot({path:`${output}/${engine}-final.png`});
  await page.goto(base+'stability-report.html');assert.ok((await page.locator('#report').textContent()).includes('jungle-cup'));assert.equal(await page.locator('canvas').count(),0);
  assert.deepEqual(errors,[]);console.log(`${engine}: PASS cold/real-menu/repeated Cup entry, zero exposed-frame allocations/compiles, hidden ink, all three heats, report recovery and clean console.`);
}finally{await writeFile(`${output}/${engine}.json`,JSON.stringify({base,rows,errors},null,2));await browser.close();}
