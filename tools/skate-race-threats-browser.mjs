import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5229').replace(/\/$/,'');
const output=process.env.RACE_THREATS_OUTPUT||'/private/tmp/skate-race-threats-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],reports=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:720},serviceWorkers:'block'}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/?playtest&level=slipstream-race${process.env.RACE_LITE?'&lite':''}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),step=r.step.bind(r);window.weaponReview={freeze:false,at:0};
  r.step=(dt,input)=>{if(window.weaponReview.freeze)return;step(dt,input);if(window.weaponReview.at&&r.elapsed>=window.weaponReview.at)window.weaponReview.freeze=true;};
  window.setupWeaponReview=(kind,at)=>{
   window.weaponReview={freeze:false,at};r.reset('race');r.phase='running';r.drive=()=>({moveX:0,moveY:0});
   r.riders.forEach((a,i)=>{const s=140-i*5,point=r.course.support(r.level,s)||r.course.sample(s);point.x+=(i%2?1:-1)*2;
    a.player.resetRacePosition(r.level,point,r.course.tangent(s));a.player.invulnTimer=0;a.progress=a.previousProgress=a.anchorProgress=s;a.anchor.copy(point);a.itemCooldown=999;a.knockGrace=0;
   });
   r.riders[1].item=kind;r.useItem(1);
  };
 });
 for(const [name,kind,at] of [['red-warning','red-shell',.7],['blue-orbit','blue-shell',.8],['lightning-charge','shock-shell',.8],['lightning-strike','shock-shell',1.63]]){
  await page.evaluate(([kind,at])=>window.setupWeaponReview(kind,at),[kind,at]);
  await page.waitForFunction(()=>window.weaponReview.freeze);await page.waitForTimeout(350);
  const report=await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();return {threats:r.hud().threats,bolts:g.scene.getObjectsByProperty('name','lightning strike').length,stormMarkers:r.riders.filter(a=>a.storm.visible).length,hints:document.querySelectorAll('.race-interface .input-glyph').length,slots:[...document.querySelectorAll('[data-race-threats] [data-reward]')].map(e=>({kind:e.dataset.reward,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))};});
  await page.screenshot({path:`${output}/${name}.png`});
  assert.equal(report.hints,0);
  if(name==='lightning-strike')assert.ok(report.bolts>=1);else{assert.ok(report.threats.length);assert.ok(report.slots.some(s=>s.kind===kind));for(const slot of report.slots)assert.ok(slot.w>=60&&slot.h>=60,'Warning model must have visible area');}
  reports.push({name,...report});
 }
 for(const [w,h] of [[390,844],[844,390]]){
  await page.setViewportSize({width:w,height:h});await page.evaluate(()=>window.setupWeaponReview('red-shell',.7));await page.waitForFunction(()=>window.weaponReview.freeze);
  await page.evaluate(()=>{const r=window.__game.getSkateRace();r.riders[0].threats.push({item:'shock-shell',seconds:1,bearing:0,urgent:false});r.riders[0].item='horn';});await page.waitForTimeout(350);
  const rects=await page.evaluate(()=>[...document.querySelectorAll('[data-threat],[data-race-action="item"]')].map(e=>({name:e.dataset.threat??'held-item',x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  for(const rect of rects)assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.w<=w+1&&rect.y+rect.h<=h+1);
  assert.equal(rects.length,3);await page.screenshot({path:`${output}/two-threats-${w}x${h}.png`});reports.push({name:`two-threats-${w}x${h}`,rects});
 }
 await writeFile(output+'/report.json',JSON.stringify({reports,errors},null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({states:reports.length,errors}));
}finally{await browser.close();}
