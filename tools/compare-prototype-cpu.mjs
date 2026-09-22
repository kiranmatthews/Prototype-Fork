// Diagnostic only: clean contexts, no timing wrappers around rendering/pose work.
// Run alone, without simultaneous builds or other performance profiles.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {writeFile} from 'node:fs/promises';
const [original,baseline,candidate]=process.argv.slice(2),urls={original,baseline,candidate};
if(!original||!baseline||!candidate)throw Error('Usage: node tools/compare-prototype-cpu.mjs <original-url> <baseline-url> <candidate-url>');
const output=process.env.CPU_COMPARE_OUTPUT||'/private/tmp/board-prototype-cpu.json';
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[];
try {
for(const version of ['original','baseline','candidate']){
const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});await context.addInitScript(()=>{localStorage.setItem('protoLevelId','sky');localStorage.setItem('protoLevelsAdopted','1');});
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(new URL('?playtest&level=sky',urls[version]).href);await page.waitForFunction(()=>window.__game?.player,null,{timeout:120000});await page.waitForTimeout(12000);
await page.evaluate(()=>{const g=window.__game,p=window.__cpu={record:false,steps:0,intervals:[],last:null};const step=g.player.step;g.player.step=function(...args){if(p.record)p.steps++;return step.apply(this,args);};function tick(t){if(p.record&&p.last!==null)p.intervals.push(t-p.last);p.last=t;requestAnimationFrame(tick);}requestAnimationFrame(tick);});
const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
for(const mode of version==='original'?['default']:['default','540p-crt-off']){
if(mode==='540p-crt-off')await page.evaluate(()=>{const g=window.__game;g.crtGuestSettings.setEnabled(false);g.renderQualitySettings.setRegularResolution(540);});
await page.waitForTimeout(4000);
for(let trial=0;trial<2;trial++){
await page.evaluate(()=>{const p=window.__cpu;p.steps=0;p.intervals=[];p.last=null;p.record=true;p.start=performance.now();});await page.waitForTimeout(6500);
const row=await page.evaluate(()=>{const g=window.__game,p=window.__cpu;p.record=false;const elapsed=performance.now()-p.start,s=[...p.intervals].sort((a,b)=>a-b);return {elapsed,frames:p.intervals.length,rafFps:p.intervals.length/(p.intervals.reduce((a,b)=>a+b,0)/1000),steps:p.steps,stepsPerFrame:p.steps/(p.intervals.length+1),fixedStepsPerSecond:p.steps/(elapsed/1000),frameMedian:s[Math.floor(s.length*.5)],frameP95:s[Math.floor(s.length*.95)],level:g.getCurrentLevel().id,state:g.player.state,position:g.player.pos.toArray(),canvas:[g.renderer.domElement.width,g.renderer.domElement.height],quality:g.renderQualitySettings?.snapshot(),crt:g.getCrtDiagnostics?.()?.active,contextLost:g.renderer.getContext().isContextLost()};});
rows.push({version,mode,trial,...row,errors:[...errors]});console.log(JSON.stringify(rows.at(-1)));await writeFile(output,JSON.stringify(rows,null,2));
}
}
await context.close();
}
}finally{await browser.close();}
