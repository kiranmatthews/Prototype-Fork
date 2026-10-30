import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out=process.env.ATMOS_OUT??'art/carlisle-shipyard/atmosphere/after';
const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite');await mkdir(out,{recursive:true});
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const report={base,baseline,lite,errors:[],sky:[],views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,ground:l.groundMeshes.length,crates:l.crates.length,wetSlopes:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,far:g.camera.far,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.ground,334);assert.equal(report.main.crates,270);assert.equal(report.main.wetSlopes,18);assert.equal(report.main.far,850);
 // An isolated magenta background makes the far-clip failure measurable.
 const probes=[{id:'play-distance',far:850,p:[0,0,0],aim:[0,.22,-1],time:42},{id:'short-distance',far:300,p:[0,0,0],aim:[0,.22,-1],time:42},{id:'long-distance',far:6000,p:[0,0,0],aim:[0,.22,-1],time:42},{id:'translated',far:850,p:[412,238,-2048],aim:[0,.22,-1],time:42},{id:'zenith',far:850,p:[0,0,0],aim:[.05,1,-.1],time:42},{id:'later-clouds',far:850,p:[0,0,0],aim:[0,.22,-1],time:162},
  {id:'west-horizon',far:850,p:[0,0,0],aim:[-1,.1,-.3],time:42},{id:'reflection-camera',far:450,p:[0,-20,0],aim:[0,.22,-1],up:[0,-1,0],time:42},{id:'off-centre',far:850,p:[0,0,0],aim:[0,.22,-1],offset:true,time:42}];
 for(const probe of probes){
  const data=await page.evaluate(spec=>{const g=window.__game,source=g.scene.getObjectByName('Outer Banks blue hour'),sky=source.clone(),scene=new g.scene.constructor(),c=g.camera.clone();
   sky.onBeforeRender=source.onBeforeRender;sky.position.set(0,0,0);scene.add(sky);scene.background=g.scene.background.clone().set('#ff00ff');scene.fog=g.scene.fog?.clone()??null;
   c.position.set(...spec.p);c.far=spec.far;c.fov=60;if(spec.up)c.up.set(...spec.up);c.lookAt(...spec.aim.map((v,i)=>v+spec.p[i]));if(spec.offset)c.setViewOffset(3840,1080,1920,0,1920,1080);c.updateProjectionMatrix();c.updateMatrixWorld(true);
   const oldTime=sky.material.uniforms.time?.value;if(sky.material.uniforms.time)sky.material.uniforms.time.value=spec.time;
   g.renderer.render(scene,c);const url=g.renderer.domElement.toDataURL('image/png'),canvas=document.createElement('canvas');canvas.width=g.renderer.domElement.width;canvas.height=g.renderer.domElement.height;const ctx=canvas.getContext('2d');ctx.drawImage(g.renderer.domElement,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let magenta=0,black=0,hash=2166136261,low=255,high=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]>220&&pixels[i+1]<20&&pixels[i+2]>220)magenta++;if(pixels[i]<2&&pixels[i+1]<2&&pixels[i+2]<2)black++;const luminance=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2];low=Math.min(low,luminance);high=Math.max(high,luminance);for(let k=0;k<3;k++)hash=Math.imul(hash^pixels[i+k],16777619);}
   if(oldTime!==undefined)sky.material.uniforms.time.value=oldTime;scene.remove(sky);
   return{url,uncoveredFraction:magenta/(canvas.width*canvas.height),blackPixels:black,luminanceRange:[low,high],pixelHash:hash>>>0,sourceTriangles:source.geometry.index.count/3,cameraMatched:sky.material.uniforms.harbourCameraWorld?.value.equals(c.matrixWorld)??null};
  },probe);
  await writeFile(`${out}/sky-${probe.id}.png`,Buffer.from(data.url.split(',')[1],'base64'));report.sky.push({...probe,...data,url:undefined});
 }
 if(!baseline){assert.ok(report.sky.every(p=>p.uncoveredFraction===0),'sky exposed the clear colour');assert.ok(report.sky.every(p=>p.blackPixels===0),'black shader seam in sky');assert.ok(report.sky.every(p=>p.cameraMatched),'sky used a different pass camera');assert.equal(report.sky[0].pixelHash,report.sky[1].pixelHash,'far plane changed angular sky');assert.equal(report.sky[0].pixelHash,report.sky[2].pixelHash,'long far plane changed angular sky');assert.equal(report.sky[0].pixelHash,report.sky[3].pixelHash,'camera translation moved the sky');assert.notEqual(report.sky[0].pixelHash,report.sky[5].pixelHash,'clouds did not drift');assert.notEqual(report.sky[0].pixelHash,report.sky[4].pixelHash,'sky ignored camera rotation');assert.notEqual(report.sky[0].pixelHash,report.sky[8].pixelHash,'sky ignored the off-centre projection');assert.ok(report.sky[0].luminanceRange[1]-report.sky[0].luminanceRange[0]>12,'sky is flat');}
 const shots=[
  {id:'arrival',s:5,camera:point(-10,10,0),center:point(85,17)},
  {id:'harbour-horizon',s:260,camera:point(190,30,5),center:point(270,15,-180)},
  {id:'beacon',s:1100,camera:point(1050,34,20),center:point(1160,54,-15)},
  {id:'storm-bounce',s:2830,camera:point(2780,170,60),center:point(2840,15,-40)},
 ];
 for(const shot of (lite?shots.slice(0,2):shots)){
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},point(shot.s,3));await page.waitForTimeout(250);
  const data=await page.evaluate(({camera,center})=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;c.position.set(...camera);c.fov=55;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);
   g.scene.traverse(n=>{if(n.name==='Outer Banks blue hour'||n.name==='Blue-hour tidal water')if(n.material.uniforms.time)n.material.uniforms.time.value=42;});
   g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;return{url,far:c.far,render:{...g.renderer.info.render}};
  },shot);await writeFile(`${out}/${shot.id}.png`,Buffer.from(data.url.split(',')[1],'base64'));report.views.push({...shot,...data,url:undefined});
 }
 if(!lite){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});
  await page.waitForTimeout(250);
  const bonus=await page.evaluate(()=>{const g=window.__game,c=g.camera.clone();c.position.set(32,15,26);c.lookAt(63,4,-13);c.fov=55;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);return{url:g.renderer.domElement.toDataURL('image/png'),far:c.far,movers:g.getLevel().movers.length,sky:g.scene.getObjectByName('Outer Banks blue hour')?.visible};});
  await writeFile(out+'/bonus.png',Buffer.from(bonus.url.split(',')[1],'base64'));report.bonus={...bonus,url:undefined};assert.equal(bonus.movers,4);assert.ok(bonus.sky);
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/normal-arrival.png'});
  report.normal=await page.evaluate(async()=>{const g=window.__game,times=[];let previous=performance.now();for(let i=0;i<130;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return{far:g.camera.far,art:g.getLevel().carlisleShipyardDiagnostics.status,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length};});
  assert.equal(report.normal.far,850);assert.equal(report.normal.art,'ready');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
