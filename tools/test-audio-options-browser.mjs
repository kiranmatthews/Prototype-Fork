import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.MENU_TEST_URL||'http://127.0.0.1:5196/';
const output=process.env.MENU_TEST_OUT||'/private/tmp/audio-options-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={checks:[],errors:[]};
try {
  for(const lite of process.env.AUDIO_TEST_RENDER==='full'?[false]:[true,false]){
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
    await page.addInitScript(()=>{
      window.menuPad={id:'DualSense Wireless Controller',index:0,connected:true,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:18},()=>({pressed:false,touched:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[window.menuPad]});
      // Real legacy preferences should migrate before any control is touched.
      if(!localStorage.getItem('solProtoGameOptionsV1'))localStorage.setItem('solProtoGameOptionsV1',JSON.stringify({sfxMuted:true,musicMuted:false}));
    });
    await page.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));
    await page.waitForFunction(()=>window.__game?.gameFlow&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    console.log(`Checking ${lite?'lite':'full'} audio Options.`);
    await page.evaluate(()=>window.__game.gameFlow.showLaunch());
    await page.getByRole('button',{name:'OPTIONS',exact:true}).click();
    const sfx=page.getByRole('slider',{name:'SFX volume'}),music=page.getByRole('slider',{name:'Music volume'});
    await sfx.waitFor();
    assert.equal(await sfx.inputValue(),'0');assert.equal(await music.inputValue(),'10');
    assert.equal(await sfx.getAttribute('aria-valuetext'),'Muted');
    const checkAudio=async(sfxVolume,musicVolume)=>{
      const actual=await page.evaluate(()=>({sfx:window.__game.sfx.sfxBus.gain.value,music:window.__game.sfx.musicBus.gain.value,saved:JSON.parse(localStorage.getItem('solProtoGameOptionsV1'))}));
      assert.ok(Math.abs(actual.sfx-sfxVolume)<1e-6);assert.ok(Math.abs(actual.music-musicVolume)<1e-6);
      assert.deepEqual(actual.saved,{sfxVolume,musicVolume});
    };
    await sfx.focus();
    for(let step=1;step<=10;step++){
      await page.keyboard.press('ArrowRight');assert.equal(await sfx.inputValue(),String(step));await checkAudio(step/10,1);
    }
    await page.keyboard.press('ArrowRight');assert.equal(await sfx.inputValue(),'10');
    await page.keyboard.press('Home');assert.equal(await sfx.inputValue(),'0');await checkAudio(0,1);
    await page.keyboard.press('ArrowLeft');assert.equal(await sfx.inputValue(),'0');
    await page.keyboard.press('End');assert.equal(await sfx.inputValue(),'10');
    await page.keyboard.press('ArrowDown');assert.equal(await music.evaluate(e=>document.activeElement===e),true);
    await page.keyboard.press('KeyA');assert.equal(await music.inputValue(),'9');
    await page.keyboard.press('Tab');await page.waitForFunction(()=>document.activeElement.matches('button.game-toggle')&&document.activeElement.textContent.trim().startsWith('CRT'));
    await page.keyboard.press('Shift+Tab');await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Music volume');
    const pad=async(index,axis=false)=>{
      await page.evaluate(({index,axis})=>{if(axis)window.menuPad.axes[0]=-1;else Object.assign(window.menuPad.buttons[index],{pressed:true,value:1});window.menuPad.timestamp++;},{index,axis});
      await page.waitForTimeout(180);
      await page.evaluate(()=>{window.menuPad.axes.fill(0);window.menuPad.buttons.forEach(b=>Object.assign(b,{pressed:false,value:0}));window.menuPad.timestamp++;});
      await page.waitForTimeout(100);
    };
    await pad(14);assert.equal(await music.inputValue(),'8');
    await pad(14,true);assert.equal(await music.inputValue(),'7');
    await pad(12);assert.equal(await sfx.evaluate(e=>document.activeElement===e),true);
    await pad(14);assert.equal(await sfx.inputValue(),'9');
    const bounds=await sfx.boundingBox();
    await sfx.click({position:{x:9+(bounds.width-18)*.43,y:bounds.height/2}});
    assert.equal(await sfx.inputValue(),'4');await checkAudio(.4,.7);
    const musicBounds=await music.boundingBox();
    await page.mouse.move(musicBounds.x+9+(musicBounds.width-18)*.7,musicBounds.y+musicBounds.height/2);
    await page.mouse.down();await page.mouse.move(musicBounds.x+9+(musicBounds.width-18)*.23,musicBounds.y+musicBounds.height/2,{steps:8});await page.mouse.up();
    assert.equal(await music.inputValue(),'2');await checkAudio(.4,.2);
    await page.keyboard.press('KeyQ');assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'launch');
    await page.evaluate(()=>window.__game.gameFlow.showPause({levelName:'CODEX GEOMETRY LAB',inWarpRoom:false}));
    await page.getByRole('button',{name:'OPTIONS',exact:true}).click();
    assert.equal(await sfx.inputValue(),'4');assert.equal(await music.inputValue(),'2');
    await page.keyboard.press('KeyQ');assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),'pause');
    await page.evaluate(()=>window.__game.gameFlow.showMapSection('options'));
    assert.equal(await sfx.inputValue(),'4');assert.equal(await music.inputValue(),'2');
    if(!lite){
      const crt=page.locator('button.game-toggle').filter({hasText:'CRT'});
      if(await crt.getAttribute('aria-pressed')==='false')await crt.click();
      assert.equal(await crt.getAttribute('aria-pressed'),'true');
    }
    for(const [width,height] of [[1280,720],[1920,1080],[1024,768],[390,844],[844,390]]){
      await page.setViewportSize({width,height});await sfx.focus();await page.waitForTimeout(350);
      const layout=await page.evaluate(()=>({pageWidth:document.documentElement.scrollWidth,rows:[...document.querySelectorAll('.game-volume')].map(row=>{
        const track=row.querySelector('.game-volume-track'),input=row.querySelector('input');
        return {width:row.getBoundingClientRect().width,trackWidth:track.getBoundingClientRect().width,ticks:track.querySelectorAll('i').length,filled:track.querySelectorAll('i.filled').length,value:Number(input.value)};
      })}));
      assert.ok(layout.pageWidth<=width+1);assert.equal(layout.rows.length,2);
      for(const row of layout.rows){assert.ok(row.trackWidth>40&&row.trackWidth<row.width);assert.equal(row.ticks,10);assert.equal(row.filled,row.value);}
      await page.screenshot({path:`${output}/${lite?'lite':'full'}-${width}x${height}.png`});
    }
    if(!lite){
      await page.setViewportSize({width:1920,height:1080});
      await page.evaluate(()=>{window.__game.renderQualitySettings.setEnabled(false);window.__game.gameFlow.requestGameplayFrame();});
      await page.waitForTimeout(400);
      const native=await page.evaluate(()=>({surface:window.__game.getGameFlowSurfaceDiagnostics(),width:window.__game.renderer.domElement.width,height:window.__game.renderer.domElement.height,composited:document.querySelector('.game-shell').classList.contains('precrt-composited')}));
      assert.equal(native.composited,true);assert.equal(native.surface.width,native.width);assert.equal(native.surface.height,native.height);
      report.native=native;await page.screenshot({path:output+'/full-native.png'});
    }
    await page.reload();
    await page.waitForFunction(()=>window.__game?.gameFlow&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    await page.evaluate(()=>window.__game.gameFlow.showMapSection('options'));
    assert.equal(await sfx.inputValue(),'4');assert.equal(await music.inputValue(),'2');await checkAudio(.4,.2);
    report.checks.push({lite,migration:true,steps:true,keyboard:true,gamepad:true,mouse:true,allMenus:true,reload:true});
    await page.close();
  }
  for(const [width,height] of [[390,844],[844,390]]){
    const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
    page.on('pageerror',error=>report.errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
    await page.goto(base+'?playtest&level=codex-lab&lite');
    await page.waitForFunction(()=>window.__game?.gameFlow&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    await page.evaluate(()=>window.__game.gameFlow.showMapSection('options'));
    const slider=page.getByRole('slider',{name:'SFX volume'});await slider.scrollIntoViewIfNeeded();
    const bounds=await slider.boundingBox();assert.ok(bounds.height>=48);
    await page.touchscreen.tap(bounds.x+9+(bounds.width-18)*.33,bounds.y+bounds.height/2);
    assert.equal(await slider.inputValue(),'3');
    assert.ok(Math.abs(await page.evaluate(()=>window.__game.sfx.sfxBus.gain.value)-.3)<1e-6);
    await page.screenshot({path:`${output}/touch-${width}x${height}.png`});
    await page.locator('.game-map-close').tap();assert.equal(await page.evaluate(()=>window.__game.gameFlow.currentScreen),null);
    report.checks.push({touch:true,width,height});await page.close();
  }
  assert.deepEqual(report.errors,[]);console.log('PASS audio sliders: all steps, migration, immediate bus levels, keyboard/controller/mouse/touch, all Options origins, reload, lite/full/native rendering.');
}catch(error){
  report.failure=error.message;
  for(const page of browser.contexts().flatMap(context=>context.pages())){
    report.focus=await page.evaluate(()=>({active:document.activeElement?.outerHTML,selected:[...document.querySelectorAll('.game-menu-button.selected')].map(e=>e.textContent)})).catch(()=>null);
    await page.screenshot({path:output+'/failure.png'}).catch(()=>{});
  }
  throw error;
}finally{await writeFile(output+'/report.json',JSON.stringify(report,null,2));await browser.close();}
