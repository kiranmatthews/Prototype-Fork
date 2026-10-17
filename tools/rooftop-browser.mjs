import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5261').replace(/\/$/,''),full=process.argv.includes('--full'),mode=process.argv.includes('--foot')?'foot':'skate',tag=`${full?'full':'lite'}-${mode}`;
const out=process.env.ROOFTOP_OUTPUT||'/private/tmp/rooftop-browser';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/codex-lab'; export {createRooftopPilot} from './tools/rooftop-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/rooftop-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=rooftop-relay${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForTimeout(600);await page.screenshot({path:`${out}/${tag}-spawn.png`});
 await page.evaluate(async mode=>{
  const {source:m,createRooftopPilot}=await import('/rooftop-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),pilot=createRooftopPilot(m,{mode,takeoff:mode==='foot'?1:2.5});
  const report=window.rooftopReview={done:false,error:null,steps:0,seconds:0,state:p.state,evidence:pilot.evidence,landingsInView:[],stamp:document.querySelector('.hud-build')?.textContent,expected:JSON.stringify(m.ROOFTOP_RELAY_LEVEL),actual:JSON.stringify(g.getCurrentLevel().data),before:JSON.stringify(g.TUNING)};
  const step=p.step.bind(p),update=g.input.update.bind(g.input),commit=p.commitRenderStep.bind(p);let sample={},advanced=false;
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};return{id:'Rooftop playability controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
  p.step=(dt,input,level)=>{
   if(report.done)return;
   try{sample=pilot.sample(p,l);update();step(dt,input,level);pilot.observe(p,l);report.steps++;report.seconds+=dt;advanced=true;}
   catch(e){report.error=String(e);report.done=true;}
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced||report.done)return;advanced=false;
   report.state=p.state;report.position=p.pos.toArray();report.deaths=p.totalDeaths;report.roof=pilot.evidence.roofs.at(-1);
   const gap=m.ROOFTOP_GAPS.find(gap=>-p.pos.z>=gap.a-4&&-p.pos.z<gap.a+2);
   if(gap&&!report.landingsInView.some(x=>x.index===gap.index)){
    const q=p.pos.clone().set(gap.x,gap.to,-(gap.b+4)).project(g.camera);
    report.landingsInView.push({index:gap.index,screen:[q.x,q.y,q.z],player:p.pos.toArray(),camera:g.camera.position.toArray()});
   }
   if(p.state==='finished'){report.done=true;report.after=JSON.stringify(g.TUNING);}
  };
 },mode);
 const shots=new Set();
 for(let i=0;i<700;i++){
  await page.waitForTimeout(200);const r=await page.evaluate(()=>({done:window.rooftopReview.done,roof:window.rooftopReview.roof,views:window.rooftopReview.landingsInView.length}));
  if(r.views&&!shots.has(r.views)){shots.add(r.views);await page.screenshot({path:`${out}/${tag}-transfer-${String(r.views).padStart(2,'0')}.png`});}
  if(r.done)break;
 }
 const report=await page.evaluate(()=>window.rooftopReview);await page.screenshot({path:`${out}/${tag}-finish.png`});
 const overview=await page.evaluate(()=>{const g=window.__game,c=g.camera.clone(),r=g.renderer,fog=g.scene.fog,ratio=r.getPixelRatio(),w=r.domElement.width/ratio,h=r.domElement.height/ratio;c.position.set(290,280,150);c.lookAt(0,40,-245);c.fov=58;c.far=2500;c.updateProjectionMatrix();g.scene.fog=null;r.setRenderTarget(null);r.setSize(1440,900,false);r.render(g.scene,c);const b=r.domElement.toDataURL('image/png').split(',')[1];g.scene.fog=fog;r.setSize(w,h,false);return b;});
 await writeFile(`${out}/${tag}-overview.png`,Buffer.from(overview,'base64'));
 await writeFile(`${out}/${tag}.json`,JSON.stringify({base,report,errors},null,2));
 console.log(JSON.stringify({...report,expected:undefined,actual:undefined,before:undefined,after:undefined,errors},null,2));
 assert.equal(report.error,null);assert.equal(report.state,'finished');assert.equal(report.deaths,0);assert.equal(report.expected,report.actual);assert.equal(report.before,report.after);assert.equal(report.evidence.roofs.length,13);assert.equal(report.evidence.checkpoints.length,4);assert.equal(report.evidence.jumps.length,12);assert.match(report.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 assert.ok(report.landingsInView.every(v=>Math.abs(v.screen[0])<1&&Math.abs(v.screen[1])<1&&v.screen[2]<1),'A receiving roof was outside the takeoff view');
}finally{await browser.close();}
