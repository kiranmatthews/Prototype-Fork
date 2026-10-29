import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {homedir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const playwright=process.env.PLAYWRIGHT_MODULE??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(playwright).href);
const baseUrl=process.env.MAYFIELD_POLISH_URL??'http://127.0.0.1:5278/';
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const output=resolve('art/mayfield-mall/polish-v1');
await mkdir(output+'/screenshots',{recursive:true});await mkdir(output+'/concepts',{recursive:true});
const views=[
 ['arrival-galleria','Arrival galleria','Upper Mall',8,{back:14,height:8,look:38}],
 ['angular-support-court','Angular support court','Upper Mall',64,{side:-3,back:10,height:6,look:34}],
 ['fountain-court-wide','Fountain court wide view','Upper Mall',116,{back:4,height:6,look:32}],
 ['geometric-fountain','Geometric fountain garden','Upper Mall',142,{height:9,look:40}],
 ['sculpture-mezzanine','Folded sculpture and mezzanine','Upper Mall',187,{side:10,height:8,look:35}],
 ['escalator-approach','Escalator approach','Upper Mall',230,{side:-10,height:10,look:26}],
 ['escalator-red-car','Escalator and car display','Upper Mall',268,{side:15,height:12,look:24}],
 ['galleria-last-balcony','Galleria final descent','Upper Mall',325,{back:8,height:5,look:22}],
 ['food-court-threshold','Food court threshold','School wing',365,{height:8,look:35}],
 ['gym-entry','Gym entry','School wing',390,{back:5,height:5,look:30}],
 ['basketball-and-banks','Basketball floor and banks','School wing',419,{side:21,height:12,look:22}],
 ['gym-courtyard','Gym courtyard connection','School wing',450,{side:-15,height:10,look:30}],
 ['blue-canopy-descent','Blue canopy descent','School wing',479,{side:8,height:9,look:34}],
 ['canopy-retail-junction','Canopy retail junction','School wing',517,{side:-10,height:9,look:31}],
 ['arcade-portal','Side Quest arcade portal','Crossrail arcade',554,{height:8,look:38}],
 ['crossrail-promenade','Crossrail promenade','Crossrail arcade',585,{side:12,height:10,look:38}],
 ['after-hours-entrance','After Hours bonus entrance','Crossrail arcade',614,{side:5,height:7,look:17}],
 ['after-hours-interior','After Hours bonus interior','After Hours bonus',0,{bonus:true,camera:[45,14,52],target:[45,6,0],fov:70}],
 ['loading-portal','Mayfield Loading portal','Warehouse wing',745,{height:9,look:34}],
 ['warehouse-roll-in','Warehouse roll-in','Warehouse wing',779,{camera:[0,17,-767],target:[0,2,-811]}],
 ['warehouse-halfpipe','Warehouse halfpipe','Warehouse wing',831,{side:-25,height:13,look:30}],
 ['big-rail-island','Big Rail and kicker island','Warehouse wing',805,{camera:[46,3.8,-797],target:[27,.8,-808],fov:70}],
 ['suspended-room','Suspended warehouse room','Warehouse wing',850,{camera:[-31,15,-823],target:[5,7,-858]}],
 ['taxi-loading-bay','Taxi loading bay','Warehouse wing',883,{camera:[-8,10,-863],target:[-33,3,-886]}],
 ['loading-islands','Crate loading island','Warehouse wing',805,{camera:[5,13,-785],target:[12,10,-803],fov:58}],
 ['spinal-grooves-entry','Spinal grooves entrance','Kona recreation courts',956,{side:14,height:11,look:29}],
 ['spinal-grooves-profile','Spinal grooves profile','Kona recreation courts',978,{camera:[22,15,-957],target:[0,4,-975]}],
 ['timber-roll-in','Timber vert and roll-in','Kona recreation courts',969,{camera:[-45,17,-940],target:[-75,8,-973]}],
 ['timber-vert-reverse','Timber vert reverse angle','Kona recreation courts',969,{camera:[-108,16,-997],target:[-75,6,-970]}],
 ['snake-kiosk','Snake-head kiosk court','Kona recreation courts',1002,{camera:[40,5,-985],target:[21,3,-1002]}],
 ['snake-run-entry','Snake run entrance','Kona recreation courts',1030,{side:15,height:11,look:27}],
 ['snake-run-overview','Snake run overview','Kona recreation courts',1080,{camera:[-20,35,-1030],target:[-35,5,-1097],fov:70}],
 ['snake-run-banked-bend','Snake run banked bend','Kona recreation courts',1110,{side:12,height:12,look:24}],
 ['kona-atrium-connection','Kona to atrium connection','Kona recreation courts',1173,{side:-13,height:11,look:29}],
 ['angled-atrium-entry','Angled atrium entry','Grand atrium',1212,{side:11,height:11,look:38}],
 ['angled-atrium-descent','Angled atrium descent','Grand atrium',1252,{back:6,height:6,look:38}],
 ['grand-atrium-turn','Grand atrium turn','Grand atrium',1305,{side:15,height:13,look:33}],
 ['suspended-crossing','Suspended crossing','Grand atrium',1330,{camera:[102,7,-1326],target:[142,-7,-1334],fov:72}],
 ['lower-atrium-promenade','Lower atrium promenade','Grand atrium',1465,{side:10,height:10,look:28}],
 ['mall-exit-court','Mall exit and crystal court','Exit court',1546,{back:5,height:7,look:24}],
].map(([id,title,section,s,view],i)=>({number:i+1,id:`${String(i+1).padStart(2,'0')}-${id}`,title,section,s,view}));
const selected=process.argv.find(a=>a.startsWith('--only='))?.slice(7).split(',').map(Number);
try{const old=JSON.parse(await readFile(output+'/manifest.json','utf8'));for(const v of views){const p=old.views.find(x=>x.number===v.number);Object.assign(v,{placement:p?.placement,screenshot:`screenshots/${v.id}.png`,concept:`concepts/${v.id}.png`});}}catch{}
const fixture=await build({stdin:{contents:"export * from './src/levels/mayfield-mall';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mayfield-polish-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(new URL('?playtest&level=mayfield-mall',baseUrl).href,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mayfield-mall'&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
 await page.evaluate(async()=>{
  const g=window.__game,m=await import('./mayfield-polish-fixture.js');window.polishSource=m;
  g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  g.player.step=()=>{};g.player.group.visible=false;g.player.drawFlyingFruit=()=>{};g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};
 });
 await page.waitForTimeout(1200);
 const meta=await page.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,sourceMatches:JSON.stringify(window.polishSource.MAYFIELD_MALL_LEVEL)===JSON.stringify(window.__game.getCurrentLevel().data)}));assert.ok(meta.sourceMatches);
 for(const view of views.filter(v=>!v.view.bonus&&(!selected||selected.includes(v.number)))){
  const placement=await page.evaluate(v=>{
   const g=window.__game,m=window.polishSource,points=m.MAYFIELD_ROUTE,dist=[0];for(let i=1;i<points.length;i++)dist.push(dist.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][2]-points[i-1][2]));
   let best=Infinity,d=0;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],t=Math.max(0,Math.min(1,(-v.s-a[2])/(b[2]-a[2]||1e-9))),z=a[2]+(b[2]-a[2])*t,score=Math.abs(z+v.s);if(score<best){best=score;d=dist[i-1]+t*(dist[i]-dist[i-1]);}}
   function at(d){let i=1;while(i<points.length-1&&dist[i]<d)i++;const t=Math.max(0,Math.min(1,(d-dist[i-1])/(dist[i]-dist[i-1]||1)));return points[i-1].map((n,k)=>n+(points[i][k]-n)*t);}
   const q=at(d),ahead=at(Math.min(dist.at(-1),d+(v.view.look??28)));let dx=ahead[0]-q[0],dz=ahead[2]-q[2],n=Math.hypot(dx,dz)||1;dx/=n;dz/=n;
   const cam=[q[0]-dx*(v.view.back??20)-dz*(v.view.side??0),q[1]+(v.view.height??9),q[2]-dz*(v.view.back??20)+dx*(v.view.side??0)],aim=[ahead[0],ahead[1]+3,ahead[2]];
   const floor=m.MAYFIELD_CHECKPOINTS.find(c=>c.name==='Warehouse roll-in').y;
   if(v.view.camera){for(let k=0;k<3;k++){cam[k]=v.view.camera[k]+(k===1?floor:0);aim[k]=v.view.target[k]+(k===1?floor:0);}}
   g.player.pos.set(...q);g.player.group.visible=false;
   window.polishView={camera:cam,target:aim,fov:v.view.fov??66};return{routeDistance:d,routePoint:q,...window.polishView};
  },view);
  await page.waitForTimeout(120);
  const png=await page.evaluate(()=>{
   const g=window.__game,v=window.polishView;g.player.group.visible=false;g.camera.position.set(...v.camera);g.camera.fov=v.fov;g.camera.lookAt(...v.target);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);g.getLevel().updateCityVisibility(g.camera.position);
   return g.captureBonusReviewFrame();
  });
  assert.ok(png?.startsWith('data:image/png'));view.placement=placement;view.screenshot=`screenshots/${view.id}.png`;view.concept=`concepts/${view.id}.png`;
  await writeFile(output+'/'+view.screenshot,Buffer.from(png.split(',')[1],'base64'));
  await writeFile(output+'/manifest.json',JSON.stringify({version:1,sourceCommit,...meta,views,errors},null,2)+'\n');console.log(view.id);
 }
 const bonus=views.find(v=>v.view.bonus);
 if(!selected||selected.includes(bonus.number)){
  await page.goto(new URL('?playtest&level=bonus-mayfield-mall',baseUrl).href,{timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='bonus-mayfield-mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);g.player.step=()=>{};g.player.group.visible=false;g.player.drawFlyingFruit=()=>{};g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};});
  await page.waitForTimeout(1200);
  const png=await page.evaluate(v=>{const g=window.__game;g.player.group.visible=false;g.camera.position.set(...v.camera);g.camera.fov=v.fov;g.camera.lookAt(...v.target);g.camera.updateProjectionMatrix();g.camera.updateMatrixWorld(true);g.getLevel().updateCityVisibility(g.camera.position);return g.captureBonusReviewFrame();},bonus.view);
  bonus.placement={camera:bonus.view.camera,target:bonus.view.target,fov:bonus.view.fov,level:'bonus-mayfield-mall'};
  await writeFile(output+'/'+bonus.screenshot,Buffer.from(png.split(',')[1],'base64'));
  await writeFile(output+'/manifest.json',JSON.stringify({version:1,sourceCommit,...meta,views,errors},null,2)+'\n');console.log(bonus.id);
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
