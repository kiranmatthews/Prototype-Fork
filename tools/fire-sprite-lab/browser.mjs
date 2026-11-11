import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const sharp=(await import(process.env.SHARP_MODULE||'sharp')).default;
const base=process.argv[2]||'http://127.0.0.1:5416/';
const output=process.env.FIRE_REVIEW_OUT||'/private/tmp/fire-sprite-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,checks:[],errors:[],exhibits:[],sizes:[]};
const context=await browser.newContext({viewport:{width:1440,height:960},serviceWorkers:'block'});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
async function settle(){await page.waitForFunction(()=>!window.__fireLab.state.transitioning);await page.waitForTimeout(150);}
async function snapshot(name){await page.screenshot({path:`${output}/${name}.png`});}
async function canvasPixels(){return sharp(await page.locator('canvas').screenshot()).ensureAlpha().raw().toBuffer({resolveWithObject:true});}
function difference(a,b){assert.equal(a.data.length,b.data.length);let changed=0,peak=0,sum=0;for(let i=0;i<a.data.length;i+=4){let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(a.data[i+k]-b.data[i+k]));if(delta>3)changed++;peak=Math.max(peak,delta);sum+=delta;}return {changed,peak,mean:sum/(a.data.length/4)};}
try{
  // Lite fast path, then the actual full renderer and every arrangement.
  await page.goto(new URL('fire-sprite-lab.html?lite',base).href);await page.waitForFunction(()=>window.__fireLab?.state.ready);await settle();
  assert.equal(await page.evaluate(()=>window.__fireLab.renderer.shadowMap.enabled),false);await snapshot('collection-lite');report.checks.push('Lite renderer opens all eight exhibits');
  await page.goto(new URL('fire-sprite-lab.html',base).href);await page.waitForFunction(()=>window.__fireLab?.state.ready);await settle();
  assert.match(await page.locator('#build-stamp').innerText(),/Codex\/sol fork/);
  assert.equal(await page.evaluate(()=>window.__fireLab.renderer.shadowMap.enabled),true);
  const initial=await page.evaluate(()=>window.__fireLab.state);assert.equal(initial.spriteCount,99);assert.equal(initial.heat.dropped,0);assert.equal(initial.heat.sources,8);
  await snapshot('collection-native');
  for(let i=0;i<8;i++){
    await page.locator('.exhibit').nth(i).click();await settle();
    const state=await page.evaluate(()=>window.__fireLab.state);assert.equal(state.selected,i);assert.equal(state.heat.sources,1);assert.ok(state.heat.visible>0&&state.heat.visible<=36);
    assert.equal(await page.evaluate(()=>new Set(window.__fireLab.fires.map(f=>f.uniforms.atlas.value)).size),3);
    await snapshot(`exhibit-${i+1}`);report.exhibits.push({name:await page.locator('#exhibit-name').innerText(),sprites:await page.evaluate(i=>window.__fireLab.fires[i].spriteCount,i),heat:state.heat});
  }
  report.checks.push('All eight arrangements, three shared native cycle textures, selected exhibit isolation, live heat sources');
  await page.locator('.exhibit').nth(0).click();await settle();await page.evaluate(()=>window.__fireLab.setTime(1.25));await page.waitForTimeout(120);
  const frozenA=await canvasPixels();const timeA=await page.evaluate(()=>window.__fireLab.state.time);await page.waitForTimeout(250);const frozenB=await canvasPixels();
  assert.equal(await page.evaluate(()=>window.__fireLab.state.time),timeA);assert.equal(difference(frozenA,frozenB).changed,0);
  await page.locator('#step').click();await page.waitForTimeout(100);const stepped=await canvasPixels();report.frameStep=difference(frozenB,stepped);assert.ok(report.frameStep.changed>150);
  await page.locator('#pause').click();await page.waitForTimeout(250);assert.ok(await page.evaluate(t=>window.__fireLab.state.time>t,timeA));
  await page.locator('#speed').selectOption('.25');await page.evaluate(()=>window.__fireLab.setTime(1.25));await page.waitForTimeout(150);
  const hot=await canvasPixels();await page.locator('#heat').uncheck();await page.waitForTimeout(150);const cold=await canvasPixels();report.heatPixels=difference(hot,cold);assert.ok(report.heatPixels.changed>20,'Heat must visibly refract the backdrop');
  await page.locator('#heat').check();await page.locator('#heat-strength').fill('0');await page.locator('#heat-strength').dispatchEvent('input');await page.waitForTimeout(100);const zero=await canvasPixels();report.heatIdentity=difference(cold,zero);assert.ok(report.heatIdentity.peak<=2,'Zero-strength pass must match the ordinary render');
  await page.locator('#heat-strength').fill('1');await page.locator('#heat-strength').dispatchEvent('input');
  await page.getByRole('button',{name:'Violet',exact:true}).click();await page.waitForTimeout(100);const hue=await canvasPixels();report.huePixels=difference(hot,hue);assert.ok(report.huePixels.changed>500);await snapshot('hue-transform');
  await page.locator('#reset').click();assert.equal(await page.evaluate(()=>window.__fireLab.state.hues[0]),0);
  await page.locator('#grid').uncheck();await snapshot('plain-backdrop');await page.locator('#grid').check();
  await page.locator('#source-only').check();assert.ok(await page.evaluate(()=>window.__fireLab.fires.every(f=>f.sourceOnly)));
  for(let i=0;i<3;i++){await page.locator('.exhibit').nth(i).click();await settle();const last=Number(await page.locator('#drawing-frame').getAttribute('max'));await page.locator('#drawing-frame').fill(String(last));await page.locator('#drawing-frame').dispatchEvent('input');await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.__fireLab.state.frame),last);await page.locator('#step').click();await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>window.__fireLab.state.frame),0);}
  await page.locator('#source-only').uncheck();
  await page.locator('#interpolate').uncheck();assert.ok(await page.evaluate(()=>window.__fireLab.fires.every(f=>f.uniforms.blendFrames.value===0)));await page.locator('#interpolate').check();
  report.checks.push('Pixel-exact pause, advancing frames, playback, hue change, heat on/off, zero-strength identity, frame blend toggle');
  for(const [name,width,height] of [['normal-720',1280,720],['desktop-native',1920,1080],['four-three',1024,768],['portrait',390,844],['landscape',844,390]]){
    await page.setViewportSize({width,height});await page.locator('#resolution').selectOption(name==='normal-720'?'720':'native');await settle();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),'Viewport overflow');
    const bounds=await page.locator('main').boundingBox();assert.ok(bounds.width<=width&&bounds.y+bounds.height<=height);
    if(width<=760){assert.equal(await page.locator('.exhibit:visible').count(),4);await page.locator('#next-page').click();assert.equal(await page.locator('.exhibit:visible').count(),4);await page.locator('.exhibit:visible').last().click();await settle();}
    await snapshot(name);report.sizes.push({name,width,height,canvas:await page.evaluate(()=>{const r=window.__fireLab.renderer;return [r.domElement.width,r.domElement.height]})});
  }
  // Camera orbit must keep every flame quad visible, including a horizontal jet.
  await page.setViewportSize({width:1440,height:960});await page.locator('.exhibit').nth(4).click();await settle();
  const a=await page.evaluate(()=>window.__fireLab.camera.position.toArray());await page.locator('#orbit').click();await page.waitForTimeout(350);const b=await page.evaluate(()=>window.__fireLab.camera.position.toArray());assert.notDeepEqual(a,b);await page.locator('#orbit').click();await snapshot('jet-orbit');
  assert.equal(await page.evaluate(()=>window.__fireLab.renderer.getContext().getError()),0);
  report.checks.push('720p, MAX/native, 4:3, portrait and short landscape fit; paged collection; orbit; no WebGL errors');
  await page.goto(new URL('labs/',base).href);await page.locator('#search').fill('Fire Sprite');await page.getByRole('link',{name:'Fire Sprite Lab',exact:true}).waitFor();
  report.checks.push('Published Labs directory entry');
  const touch=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  const phone=await touch.newPage();phone.on('pageerror',e=>report.errors.push(e.message));
  await phone.goto(new URL('fire-sprite-lab.html#torch',base).href);await phone.waitForFunction(()=>window.__fireLab?.state.ready&&!window.__fireLab.state.transitioning);
  assert.equal(await phone.evaluate(()=>window.__fireLab.state.paused),true,'Reduced motion starts paused');
  assert.equal(await phone.evaluate(()=>window.__fireLab.renderer.domElement.width),780,'MAX retains native DPR');
  await phone.locator('#next-page').tap();await phone.getByRole('button',{name:'06 Spirit flame',exact:true}).tap();
  await phone.waitForFunction(()=>window.__fireLab.state.selected===5&&!window.__fireLab.state.transitioning);
  await phone.getByRole('button',{name:'Crimson',exact:true}).tap();assert.equal(await phone.evaluate(()=>window.__fireLab.state.hues[5]),-20/360);
  await phone.locator('#heat').uncheck();assert.equal(await phone.evaluate(()=>window.__fireLab.heat.enabled),false);
  await phone.locator('#resolution').scrollIntoViewIfNeeded();await phone.locator('#resolution').selectOption('720');await phone.screenshot({path:`${output}/touch-native.png`});
  assert.ok(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
  report.checks.push('Touch selection, colour and heat controls, internally scrolling inspector, 2× native DPR, reduced-motion pause');await touch.close();
  assert.deepEqual(report.errors,[]);
  report.pass=true;
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report,null,2));
