// Sample the real game's CPU stacks without monkeypatching its hot functions.
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2];if(!base)throw Error('Supply a Vite game URL');
const output=process.env.FRAME_CPU_OUTPUT||'/private/tmp/frame-cpu';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),rows=[];
try{
 for(const level of (process.env.FRAME_CPU_LEVELS||'sky,warproom,beachfront').split(',')){
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||String(e)));
  await page.goto(new URL(`?playtest&level=${level}`,base).href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{await window.__game.getLevel().prepareJungleAssets();});
  await page.waitForTimeout(6000);
  const cdp=await context.newCDPSession(page),throttle=Number(process.env.FRAME_CPU_THROTTLE||4);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});await page.waitForTimeout(2000);
  await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:250});
  const before=await page.evaluate(()=>({frame:window.__game.frameStats.frame,time:performance.now()}));
  await cdp.send('Profiler.start');await page.waitForTimeout(6000);
  const {profile}=await cdp.send('Profiler.stop');
  const after=await page.evaluate(()=>({frame:window.__game.frameStats.frame,time:performance.now()}));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  const nodes=new Map(profile.nodes.map(n=>[n.id,{...n,self:0,total:0}]));
  for(const n of nodes.values())for(const id of n.children||[])nodes.get(id).parent=n.id;
  for(let i=0;i<profile.samples.length;i++){
   const elapsed=profile.timeDeltas[i]/1000;let node=nodes.get(profile.samples[i]);node.self+=elapsed;
   while(node){node.total+=elapsed;node=nodes.get(node.parent);}
  }
  const table=[...nodes.values()].map(n=>({name:n.callFrame.functionName||'(anonymous)',url:n.callFrame.url,line:n.callFrame.lineNumber+1,selfMs:+n.self.toFixed(2),inclusiveMs:+n.total.toFixed(2),selfMsPerFrame:+(n.self/(after.frame-before.frame)).toFixed(3)}));
  const row={level,throttle,frames:after.frame-before.frame,fps:1000*(after.frame-before.frame)/(after.time-before.time),topSelf:table.sort((a,b)=>b.selfMs-a.selfMs).slice(0,45),topInclusive:table.filter(n=>!['(root)','(idle)'].includes(n.name)).sort((a,b)=>b.inclusiveMs-a.inclusiveMs).slice(0,35),errors};
  rows.push(row);await writeFile(`${output}/${level}.cpuprofile`,JSON.stringify(profile));
  await writeFile(`${output}/summary.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(row));
  await context.close();
 }
}finally{await browser.close();}
