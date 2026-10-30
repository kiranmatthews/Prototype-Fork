import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484';
const out=process.env.CARLISLE_PROFILE_OUT??'art/carlisle-shipyard/render-cost/before';
await mkdir(out,{recursive:true});
const bundled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {CARLISLE_RELAY_STOPS:stops}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,out,errors:[],views:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour',{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.source=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();return{build:document.querySelector('.hud-build')?.textContent,art:g.getLevel().carlisleShipyardDiagnostics};});
 for(const [index,normal]of [[0,true],[0,false],[8,true],[15,true]]){
  const stop=stops[index];
  await page.evaluate(({stop,normal})=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(normal?480:null);g.crtGuestSettings.setEnabled(normal);g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...stop.p)});},{stop,normal});
  await page.waitForFunction(()=>window.__game.player.grounded);
  const result=await page.evaluate(async()=>{
   const g=window.__game;for(let i=0;i<90;i++)await new Promise(requestAnimationFrame);
   const times=[],draws=[];let previous=performance.now(),accepted=g.getRenderFrameLimiterStats().acceptedFrames;
   for(let i=0;i<180;i++){await new Promise(requestAnimationFrame);const now=performance.now(),next=g.getRenderFrameLimiterStats().acceptedFrames;if(next!==accepted){times.push(now-previous);draws.push({...g.renderer.info.render});previous=now;accepted=next;}}
   times.sort((a,b)=>a-b);
   const profile={},hooks=[];
   const count=(object,pass,geometry,group)=>{
    const name=object.name||object.geometry?.type||object.type,key=pass+':'+name,entry=profile[key]??(profile[key]={name,pass,draws:0,triangles:0,instances:0,objects:[]});
    const instances=object.isInstancedMesh?object.count:1,triangles=Math.min(group?.count??Infinity,geometry.drawRange.count,geometry.index?.count??geometry.attributes.position?.count??0)/3;
    entry.draws++;entry.triangles+=triangles*instances;entry.instances+=instances;
    if(!entry.objects.includes(object.id))entry.objects.push(object.id);
   };
   g.scene.traverse(n=>{if(!n.isMesh)return;const color=n.onBeforeRender,shadow=n.onBeforeShadow;hooks.push([n,color,shadow]);
    n.onBeforeRender=function(renderer,scene,camera,geometry,material,group){count(n,'color',geometry,group);return color.call(this,renderer,scene,camera,geometry,material,group);};
    n.onBeforeShadow=function(renderer,object,camera,shadowCamera,geometry,material,group){count(n,'shadow',geometry,group);return shadow.call(this,renderer,object,camera,shadowCamera,geometry,material,group);};
   });
   try{const start=g.getRenderFrameLimiterStats().acceptedFrames;do{await new Promise(requestAnimationFrame);}while(g.getRenderFrameLimiterStats().acceptedFrames===start);}finally{for(const[n,color,shadow]of hooks){n.onBeforeRender=color;n.onBeforeShadow=shadow;}}
   return{canvas:[g.renderer.domElement.width,g.renderer.domElement.height],camera:{p:g.camera.position.toArray(),q:g.camera.quaternion.toArray(),fov:g.camera.fov},player:g.player.pos.toArray(),grounded:g.player.grounded,
    timing:{samples:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],min:times[0],max:times[times.length-1]},frames:draws,
    profile:Object.values(profile).sort((a,b)=>b.triangles-a.triangles),limiter:g.getRenderFrameLimiterStats()};
  });
  const id=`${index}-${normal?'normal':'native'}`;report.views.push({id,stop,...result});await page.screenshot({path:out+'/'+id+'.png'});
  console.log(JSON.stringify({id,timing:result.timing,frame:result.frames.at(-1),top:result.profile.slice(0,8)}));
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/profile.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
