import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5261').replace(/\/$/,''),native=process.argv.includes('--native'),full=native||process.argv.includes('--full'),mode=process.argv.includes('--foot')?'foot':'skate',route=process.env.ROOF_ROUTE||'main',district=Number(process.env.ROOF_DISTRICT??-1),tag=`${native?'native':full?'full':'lite'}-${mode}-${route}-${district}`;
const out=process.env.ROOFTOP_OUTPUT||'/private/tmp/rooftop-city-browser';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/codex-lab'; export {createRooftopPilot} from './tools/rooftop-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:native?{width:2560,height:1440}:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/rooftop-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=rooftop-relay${full?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 if(native){
  await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
  const display=await page.evaluate(()=>({buffer:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height],resolution:window.__game.renderQualitySettings.regularResolution,crt:window.__game.crtGuestSettings.enabled}));
  assert.deepEqual(display,{buffer:[2560,1440],resolution:'max',crt:false});
 }
 if(district>0){await page.evaluate(async d=>{const {source:m}=await import('/rooftop-fixture.js'),g=window.__game,target=m.ROOFTOP_CHECKPOINTS.findIndex(c=>c.district===d);for(let i=0;i<=target;i++)g.player.warpCheckpoint(g.getLevel(),1);},district);await page.waitForTimeout(250);}
 await page.screenshot({path:`${out}/${tag}-spawn.png`});
 await page.evaluate(async({mode,route,district})=>{
  const{source:m,createRooftopPilot}=await import('/rooftop-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),start=m.rooftopProject(p.pos.x,p.pos.z),pilot=createRooftopPilot(m,{mode,route,start});
  const report=window.rooftopReview={done:false,error:null,steps:0,seconds:0,state:p.state,progress:start,evidence:pilot.evidence,views:[],stamp:document.querySelector('.hud-build')?.textContent,sourceMatches:JSON.stringify(m.ROOFTOP_RELAY_LEVEL)===JSON.stringify(g.getCurrentLevel().data),tuningBefore:JSON.stringify(g.TUNING),expected:{districts:m.ROOFTOP_DISTRICTS.length,length:m.ROOFTOP_LENGTH,roofs:m.ROOFTOP_ROOFS.length,gaps:m.rooftopGaps(route).length,checkpoints:m.ROOFTOP_CHECKPOINTS.length,branchRoofs:m.ROOFTOP_BRANCH_ROOFS.map(r=>r.index)},stop:district<0?Infinity:m.ROOFTOP_DISTRICTS[district].b-10};
  const step=p.step.bind(p),update=g.input.update.bind(g.input),commit=p.commitRenderStep.bind(p);let sample={},advanced=false;
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};return{id:'Rooftop city review controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
  p.step=(dt,input,level)=>{if(report.done)return;try{sample=pilot.sample(p,l);update();step(dt,input,level);pilot.observe(p,l);report.steps++;report.seconds+=dt;advanced=true;}catch(e){report.error=String(e);report.done=true;}};
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced||report.done)return;advanced=false;
   report.state=p.state;report.position=p.pos.toArray();report.deaths=p.totalDeaths;report.progress=pilot.progress;report.district=pilot.evidence.districts.at(-1);const districtData=m.ROOFTOP_DISTRICTS[report.district??0];report.districtProgress=(pilot.progress-districtData.a)/(districtData.b-districtData.a);
   const gap=m.rooftopGaps(route).find(gap=>pilot.progress>=gap.a-3&&pilot.progress<gap.a);
   if(gap&&!report.views.some(v=>v.index===gap.index)){
    const target=m.rooftopPoint(gap.b+4,route),q=p.pos.clone().fromArray(target).project(g.camera);
    report.views.push({index:gap.index,screen:q.toArray(),player:p.pos.toArray(),camera:g.camera.position.toArray()});
   }
   if(p.state==='finished'||pilot.progress>=report.stop){report.done=true;report.tuningUnchanged=report.tuningBefore===JSON.stringify(g.TUNING);delete report.tuningBefore;}
  };
 },{mode,route,district});
 const shots=new Set();let previous=-1;
 for(let i=0;i<4600;i++){
  await page.waitForTimeout(200);const r=await page.evaluate(()=>({done:window.rooftopReview.done,district:window.rooftopReview.district,progress:window.rooftopReview.progress,districtProgress:window.rooftopReview.districtProgress,views:window.rooftopReview.views.length}));
  if(r.district!==undefined&&r.district!==previous){console.log('DISTRICT',r.district,'s',r.progress.toFixed(1));previous=r.district;}
  if(r.district!==undefined&&!shots.has(r.district)){shots.add(r.district);await page.screenshot({path:`${out}/${tag}-district-${String(r.district).padStart(2,'0')}.png`});}
  for(const fraction of [.35,.65]){const key=`${r.district}-${fraction}`;if(r.district!==undefined&&r.districtProgress>=fraction&&!shots.has(key)){shots.add(key);await page.screenshot({path:`${out}/${tag}-district-${String(r.district).padStart(2,'0')}-${fraction}.png`});}}
  if(r.done)break;
 }
 const report=await page.evaluate(()=>window.rooftopReview);await page.screenshot({path:`${out}/${tag}-end.png`});
 const display=await page.evaluate(()=>({buffer:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height],resolution:window.__game.renderQualitySettings.regularResolution,crt:window.__game.crtGuestSettings.enabled}));
 await writeFile(`${out}/${tag}.json`,JSON.stringify({base,native,display,mode,route,district,report,errors},null,2));
 console.log(JSON.stringify({...report,evidence:{...report.evidence,jumps:report.evidence.jumps.length},views:report.views.length,errors},null,2));
 assert.equal(report.error,null);assert.equal(report.deaths,0);assert.equal(report.sourceMatches,true);assert.equal(report.tuningUnchanged,true);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 if(district<0){assert.equal(report.state,'finished');assert.equal(report.evidence.districts.length,report.expected.districts);assert.equal(report.evidence.checkpoints.length,report.expected.checkpoints);assert.equal(report.evidence.jumps.length,report.expected.gaps);if(route==='main')for(let id=0;id<report.expected.roofs;id++)assert.ok(report.evidence.roofs.includes(id),'Missing actual main roof contact '+id);if(route==='challenge'){assert.equal(report.evidence.crystal,true);for(const id of report.expected.branchRoofs)assert.ok(report.evidence.roofs.includes(id),'Missing actual branch contact '+id);}}
 else assert.ok(report.progress>=report.stop);
 const hidden=report.views.filter(v=>Math.abs(v.screen[0])>=1||Math.abs(v.screen[1])>=1||v.screen[2]>=1);assert.equal(hidden.length,0,`Receiving roofs outside the takeoff view: ${JSON.stringify(hidden.slice(0,5))}`);
}finally{await browser.close();}
