// Exhaustive player-menu catalogue, real touch targets, bounded navigation and PNG artwork.
// The review entry and all saves/results used here are memory-only authoring fixtures.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.MENU_BROWSER||'chromium';
const courseId=process.env.MENU_CUP;
const base=process.argv[2]||'http://127.0.0.1:5173/';
const output=process.env.MENU_TEST_OUT||'/private/tmp/menus-responsive-review';
await mkdir(output,{recursive:true});
const browser=await playwright[engine].launch({...(engine==='chromium'?{channel:'chrome'}:{}),headless:true});
const report={layouts:[],navigation:[],errors:[]};
const configurations=[
 {width:320,height:568,touch:true,prompts:'touch'},
 {width:568,height:320,touch:true,prompts:'touch'},
 {width:390,height:844,touch:true,prompts:'touch'},
 {width:844,height:390,touch:true,prompts:'ps5'},
 {width:768,height:1024,touch:true,prompts:'touch'},
 {width:1280,height:720,touch:false,prompts:'keyboard'},
 {width:1920,height:1080,touch:false,prompts:'ps5'},
 {width:1024,height:768,touch:false,prompts:'ps5'},
].map(c=>process.env.MENU_TOUCH?{...c,touch:process.env.MENU_TOUCH==='true',prompts:process.env.MENU_PROMPTS||(process.env.MENU_TOUCH==='true'?'touch':'keyboard')}:c);
try {
 for(const lite of [true,false]){
  for(const configuration of configurations.filter(c=>(lite||process.env.MENU_FULL_PROFILE==='true'||(c.width===390||c.width===844||c.width===1280))&&
    (!process.env.MENU_PROFILE||process.env.MENU_PROFILE.split(',').includes(`${c.width}x${c.height}`)))){
   const {width,height,touch,prompts}=configuration;
   const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
   const page=await context.newPage();
   await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
   page.on('pageerror',e=>report.errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
   if(touch&&engine==='chromium'){
    const session=await context.newCDPSession(page),{windowId}=await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds',{windowId,bounds:{width:Math.max(1200,width+100),height:Math.max(1400,height+200)}});
    await session.detach();
   }
   await page.goto(base+'menu-review.html?playtest&level=codex-lab'+(lite?'&lite':''));
   await page.waitForFunction(()=>window.__menuReview&&!window.__game.gameFlow.transitionActive,null,{timeout:90000});
   await page.locator('[aria-label="Review prompts"]').selectOption(prompts);
   const screens=await page.evaluate(()=>window.__menuReview.selectors);
   assert.equal(screens.length,26,'catalogue must cover each GameFlow and Cup screen plus home/map variants');
   for(const screen of screens.filter(screen=>!process.env.MENU_SCREENS||process.env.MENU_SCREENS.split(',').includes(screen))){
    await page.evaluate(async({screen,courseId})=>{
     window.__menuReview.show(screen);
     if(courseId&&screen.startsWith('cup-')){
      const {competitionCourse}=await import('/src/competition/courses.ts');
      const ui=window.__game.competitionUI;
      ui.event.course=competitionCourse(courseId);ui.key='';ui.render(ui.event,false);
     }
    },{screen,courseId});
    await page.waitForTimeout(120);
    const layout=await page.evaluate(()=>window.__menuReview.audit());
    assert.deepEqual(layout.problems,[],`${screen} ${width}x${height}: ${layout.problems.join(', ')}`);
    const art=await page.evaluate(()=>{
     const root=window.__menuReview.root;
     const visible=e=>{for(let n=e;n;n=n.parentElement)if(n.hidden||getComputedStyle(n).display==='none')return false;return !!e.getBoundingClientRect().width;};
     return {labels:[...root.querySelectorAll('[data-roo-menu]')].filter(visible).map(e=>({text:e.querySelector('.roo-menu-source')?.textContent,ready:e.hasAttribute('data-ready'),fallback:e.hasAttribute('data-fallback'),art:!!e.querySelector('.roo-menu-art svg')})),
      hints:[...root.querySelectorAll('.game-control-hint')].filter(visible).length,
      panelScroll:document.querySelector('.game-shell-panel')?[document.querySelector('.game-shell-panel').scrollTop,document.querySelector('.game-shell-panel').scrollLeft]:[0,0]};
    });
    assert.ok(art.labels.length,`${screen} lacks PNG labels`);
    for(const label of art.labels)assert.ok(label.ready&&label.art&&!label.fallback,`${screen}: PNG label missing: ${label.text}`);
    assert.deepEqual(art.panelScroll,[0,0],`${screen}: whole menu moved`);
    if(touch)assert.equal(art.hints,0,`${screen}: hints overlap touch menus`);
    if(touch&&engine==='chromium'&&screen==='home-options'){
     const region=await page.locator('.game-toggle-list').evaluate(e=>{
      const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,overflow:e.scrollHeight>e.clientHeight+1};
     });
     if(region.overflow){
      const session=await context.newCDPSession(page),x=region.x+region.width/2,from=region.y+region.height-16,to=region.y+16;
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
      for(let step=1;step<=12;step++){
       await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*step/12}]});await page.waitForTimeout(20);
      }
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
      await page.waitForTimeout(80);
      assert.ok(await page.locator('.game-toggle-list').evaluate(e=>e.scrollTop)>0,'Options must respond to a real touch swipe');
      assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'options','swiping activated a menu action');
      report.navigation.push({lite,width,height,screen,swipe:true});
     }
    }
    // Scroll each active action into the bounded region, without moving the screen.
    await page.evaluate(()=>{
     const root=window.__menuReview.root;
     for(const button of root.querySelectorAll('button:not(:disabled)')){
      const region=button.closest('.game-scroll-segment,.comp-content,.comp-guide-grid');
      if(!region||region.scrollHeight<=region.clientHeight+1)continue;
      const r=button.getBoundingClientRect(),p=region.getBoundingClientRect();
      if(r.top<p.top)region.scrollTop-=p.top-r.top;
      else if(r.bottom>p.top+region.clientHeight)region.scrollTop+=r.bottom-(p.top+region.clientHeight);
     }
    });
    const scrolled=await page.evaluate(()=>({audit:window.__menuReview.audit(),panel:[window.__game.gameFlow.panel.scrollTop,window.__game.gameFlow.panel.scrollLeft]}));
    assert.deepEqual(scrolled.audit.problems,[],`${screen}: scrolling broke layout`);
    assert.deepEqual(scrolled.panel,[0,0],`${screen}: bounded scroll moved the screen`);
    if(screen.startsWith('cup-')&&['cup-standings','cup-final-win','cup-final-loss'].includes(screen)){
     const table=await page.evaluate(()=>{
      const wrap=document.querySelector('.comp-table-wrap'),content=wrap.closest('.comp-content');
      const rows=[...wrap.querySelectorAll('tbody tr')];
      content.scrollTop=content.scrollHeight;wrap.scrollLeft=wrap.scrollWidth;
      const last=rows.at(-1).getBoundingClientRect(),r=content.getBoundingClientRect();
      return {count:rows.length,lastVisible:last.top>=r.top-1&&last.bottom<=r.bottom+1,fullVisible:rows.every(row=>{const b=row.getBoundingClientRect();return b.top>=r.top-1&&b.bottom<=r.bottom+1;})};
     });
     assert.equal(table.count,6);assert.equal(table.lastVisible,true,'last Cup skater must remain reachable');
     report.navigation.push({lite,width,height,screen,table});
    }
    if((lite&&[320,568,1280].includes(width))||['launch','home-options','save-load','confirm-quit-main','time-trial','cup-intro','cup-final-win'].includes(screen))
     await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-${screen}.png`});
    if(screen==='trick-guide'||screen==='cup-guide'){
     const pager=screen==='trick-guide'?'.game-trick-pager':'.comp-guide-pager';
     const pages=Number((await page.locator(`${pager} > span`).textContent()).split('/')[1]);
     let specialPrompts=0;
     for(let i=0;i<pages;i++){
      assert.equal((await page.locator(`${pager} > span`).textContent()).trim(),`${i+1} / ${pages}`);
      assert.deepEqual((await page.evaluate(()=>window.__menuReview.audit())).problems,[]);
      assert.equal(await page.locator('.game-trick-content,.comp-guide-grid').filter({visible:true}).evaluate(e=>e.scrollHeight<=e.clientHeight+1),true,'guide page must fit without scrolling');
      if(await page.locator('[data-guide-prompt]').filter({visible:true}).evaluateAll(nodes=>nodes.some(e=>e.matches('td')))){
       const recipeInk=await page.evaluate(async()=>{
        const {sampleInputPrompts}=await import('/src/inputPromptUI.ts');
        const root=window.__menuReview.root.querySelector('.game-trick-content,.comp-guide-grid'),frame=sampleInputPrompts(root);
        const touch=document.body.dataset.promptFamily==='touch';
        const ink=touch?frame.words:frame.glyphs;
        return {touch,count:ink.length,ready:ink.every(item=>touch?
         item.color!=='transparent'&&!/rgba\([^)]*,\s*0\)/.test(item.color):item.ready),
         clipped:ink.every(item=>!!item.clip)};
       });
       specialPrompts+=recipeInk.count;
       assert.equal(recipeInk.ready,true,'Special recipe ink must be visible/loaded');
       assert.equal(recipeInk.clipped,true,'Special recipe ink must respect the bounded guide page');
      }
      await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}-${screen}-${i+1}.png`});
      if(i<pages-1){await page.getByRole('button',{name:'Next trick page',exact:true})[touch?'tap':'click']();await page.waitForTimeout(80);}
     }
     assert.ok(specialPrompts>=9,'all three Special recipes must display both directions and their action across pages');
     if(touch){await page.getByRole('button',{name:'Back',exact:true}).filter({visible:true}).tap();
      if(screen==='trick-guide')assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'options');
      else assert.equal(await page.locator('.comp-intro').count(),1);
     }
     report.navigation.push({lite,width,height,screen,pages,close:touch});
    }
    report.layouts.push({...configuration,lite,screen,pngLabels:art.labels.length});
   }
   // Real touch activation of results, game-over, populated/empty bays and Cancel.
   if(touch){
    await page.evaluate(()=>window.__menuReview.show('results'));
    await page.getByRole('button',{name:'CONTINUE',exact:true}).tap();
    assert.ok(await page.evaluate(()=>window.__menuReview.actions.includes('results:continue')));
    await page.evaluate(()=>window.__menuReview.show('gameover'));
    await page.getByRole('button',{name:'NO',exact:true}).tap();
    assert.ok(await page.evaluate(()=>window.__menuReview.actions.includes('gameover:quit')));
    await page.evaluate(()=>window.__menuReview.show('new-slots'));
    await page.getByRole('button',{name:/Slot 1:/}).tap();
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'confirm-new');
    await page.getByRole('button',{name:'CANCEL',exact:true}).tap();
    assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'new-slots');
    assert.equal(await page.locator('.game-save-slot.selected').getAttribute('data-save-slot'),'1');
    await page.getByRole('button',{name:'Slot 2: Empty',exact:true}).tap();
    assert.ok(await page.evaluate(()=>window.__menuReview.actions.includes('new:2')));
    report.navigation.push({lite,width,height,results:true,gameover:true,saveBays:true});
   }
   // Keyboard navigation must reveal the last bounded Options action at phone heights.
   await page.evaluate(()=>window.__menuReview.show('home-options'));
   await page.locator('#menu-review select').first().blur();
   const steps=await page.evaluate(()=>window.__game.gameFlow.navButtons.filter(button=>!button.disabled).length-1);
   for(let i=0;i<steps;i++)await page.keyboard.press('ArrowDown');
   const last=await page.evaluate(()=>{
    const b=window.__game.gameFlow.navButtons[window.__game.gameFlow.selected],r=b.getBoundingClientRect(),s=b.closest('.game-scroll-segment').getBoundingClientRect();
    return {label:b.textContent.trim(),visible:r.top>=s.top-1&&r.bottom<=s.bottom+1};
   });
   assert.equal(last.label,'TRICK GUIDE');assert.equal(last.visible,true,'focused Options action must scroll into view');
   // The pause switch uses the same visibility, persistence and focus path as M.
   await page.evaluate(()=>window.__menuReview.show('pause'));
   const debug=page.locator('.game-debug-toggle');
   await debug[touch?'tap':'click']();
   assert.equal(await debug.getAttribute('aria-pressed'),'true');
   assert.equal(await debug.textContent(),'HIDE DEBUG MENUS');
   assert.equal(await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible),true);
   assert.equal(await page.locator('.game-shell').getAttribute('aria-modal'),'false');
   assert.equal(await page.evaluate(()=>localStorage.getItem('solProtoDebugChrome')),'visible');
   await page.keyboard.press('KeyM');
   assert.equal(await debug.getAttribute('aria-pressed'),'false');
   assert.equal(await debug.textContent(),'SHOW DEBUG MENUS');
   assert.equal(await page.locator('.game-shell').getAttribute('aria-modal'),'true');
   assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'pause');
   report.navigation.push({lite,width,height,debugToggle:true});
   await context.close();
  }
 }
 assert.deepEqual(report.errors,[]);
 console.log(`Passed ${report.layouts.length} player-menu layouts, ${report.navigation.length} touch/page navigation checks, PNG readiness, bounded focus scrolling and console checks.`);
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
