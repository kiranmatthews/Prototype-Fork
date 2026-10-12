import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CUSTARD_URL||'http://127.0.0.1:5198/',out=new URL('../docs/custard-creek-storyboard/water/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.addInitScript(()=>{window.__plops=0;const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){const tone=original.apply(this,args),set=tone.frequency.setValueAtTime.bind(tone.frequency);tone.frequency.setValueAtTime=(value,time)=>{if(value===420)window.__plops++;return set(value,time);};return tone;};});
 await page.goto(base+'?playtest&level=custard-creek',{timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.keyboard.press('ArrowRight');
 await page.evaluate(async()=>{window.__creek=await import('/src/levels/custard-creek.ts');window.__wetTrace=[];
  const p=window.__game.player,step=p.step.bind(p);p.step=(dt,input,l)=>{step(dt,input,l);if(p.drowningY!==null)window.__wetTrace.push({y:p.pos.y,surface:p.drowningY,time:p.drowningTime,ripple:p.swimEffects?.group.children[0].visible,drops:p.swimEffects?.group.children[1].visible});};
 });
 const report=[];
 for(const s of [60,1590,2390]){
  const before=await page.evaluate(s=>{const g=window.__game,p=g.player,l=g.getLevel(),m=window.__creek;
   p.respawn(l,true,false,{position:p.pos.clone().fromArray(m.custardPoint(s,m.custardHeight(s)+1,14)),heading:p.pos.clone().fromArray(m.custardTangent(s))});
   p.endlessDeaths=true;window.__wetTrace=[];return {deaths:p.totalDeaths,plops:window.__plops};},s);
  await page.waitForFunction(()=>window.__game.player.drowningY!==null,null,{timeout:15000});
  await page.waitForTimeout(230);
  const visible=await page.evaluate(()=>{const g=window.__game,p=g.player,point=p.pos.clone().setY(p.waterDeathSurface+.5).project(g.camera);return {ndc:point.toArray(),camera:g.camera.position.toArray(),pos:p.pos.toArray(),water:p.waterDeathSurface,state:p.state};});console.log(JSON.stringify({s,visible}));assert.ok(Math.abs(visible.ndc[0])<.98&&Math.abs(visible.ndc[1])<.98,'splash surface must remain in the player camera');
  await page.screenshot({path:new URL(`splash-${s}.png`,out).pathname});
  await page.waitForFunction(()=>window.__game.player.drowningY===null&&window.__game.player.grounded,null,{timeout:15000});
  const actual=await page.evaluate(()=>({deaths:window.__game.player.totalDeaths,plops:window.__plops,trace:window.__wetTrace}));
  assert.equal(actual.deaths,before.deaths+1);assert.equal(actual.plops,before.plops+1);
  assert.ok(actual.trace.some(f=>f.ripple&&f.drops),'visible entry droplets and ripples');
  assert.ok(actual.trace.every(f=>f.y>=f.surface-2.73),'finite sink');
  report.push({s,deathDelta:actual.deaths-before.deaths,plopDelta:actual.plops-before.plops,frames:actual.trace.length,
   minimumDepth:Math.min(...actual.trace.map(f=>f.y-f.surface))});
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('review.json',out),JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));
}finally{await browser.close();}
