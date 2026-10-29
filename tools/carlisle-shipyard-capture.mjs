import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);let pw;try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href);
const b=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const out='docs/carlisle-relay/shipyard-polish',base='http://127.0.0.1:5483';await mkdir(out+'/screenshots',{recursive:true});
const motifs=['Arrival quay: net launch berths, warehouse and cargo receiving apron','Scissor cargo booms on a segmented working jetty','Boat-lift slipway with rising net cradle and skip berths','Modular pontoon sockets and bright orange net catch basins','Paired heavy dock winches and opposing cargo hoists','Towering harbour control beacon with a spiral of net launch ledges','Giant circular dry-dock turntable and tidal pump machinery','Opposing pinwheel loading gantries with moving deck ends','Dredger pump terraces, big sea pipes and open staged net ascent','Cross-thread dock transfers above narrow shipping lanes','Heavy ship-lift counterweight stacks with sliding ballast platforms','Scissor swingbridges and moving harbour loading arms','Storm-exposed breakwater fingers with diagonal net leaps','Helical turbine maintenance gantry with spinning radial decks','Pendulum crane pier: suspended work platforms over churning ocean','Rigging slingshot: net launch into mandatory high steel cable grinds','Broken crane crown: fragmented elevated decks and crossed grind cables','Homeward tow cable dive into the commercial harbour finish quay'];
const plan=api.CARLISLE_RELAY_SECTIONS.map(([name,a,z],i)=>{
 const components=api.CARLISLE_TIDAL_RELAY_LEVEL.components.filter(c=>c.grp===i+1&&!['pit','zone','camnode'].includes(c.t));
 const points=[];for(const c of components){const p=c.p??[0,0,0];if(!c.vertices)points.push(p);if(c.vertices)for(let n=0;n<c.vertices.length;n+=3)points.push(c.vertices.slice(n,n+3).map((v,j)=>v+p[j]));if(c.s)for(const sign of [-1,1])points.push(p.map((v,j)=>v+sign*c.s[j]/2));if(c.pts)for(const q of c.pts)points.push([p[0]+q[0],p[1]+(q[3]??0),p[2]+q[1]]);}
 const min=[0,1,2].map(j=>Math.min(...points.map(p=>p[j]))),max=[0,1,2].map(j=>Math.max(...points.map(p=>p[j])));
 const center=min.map((v,j)=>(v+max[j])/2),span=Math.max(max[0]-min[0],max[2]-min[2],(max[1]-min[1])*1.4,70),pa=api.carlislePoint(a,0),pb=api.carlislePoint(z,0),dx=pb[0]-pa[0],dz=pb[2]-pa[2],len=Math.hypot(dx,dz),f=[dx/len,0,dz/len];
 const camera=[center[0]-f[2]*span*.7-f[0]*span*.8,center[1]+span*.72,center[2]+f[0]*span*.7-f[2]*span*.8];
 const stop=api.CARLISLE_RELAY_STOPS[i];
 return{id:String(i+1).padStart(2,'0')+'-'+name.toLowerCase().replaceAll(' ','-'),name,act:Math.floor(i/6)+1,range:[a,z],motif:motifs[i],center,camera,placement:stop?.p??api.carlislePoint(a,2),level:'carlisle-coast'};
});
plan.push({id:'19-springtide-skippers',name:'Springtide Skippers',act:2,motif:'Harbour bonus: small orange marine net launchers between moving fishing skiffs, flat cargo lighter decks and safe cargo quays',center:[63,3,0],camera:[35,81,110],placement:[-10,1.32,0],level:'bonus-carlisle-coast'},
 {id:'20-spring-skiff-close',name:'Spring skiff and homeward ferry',act:2,motif:'Close bonus view: a small orange net trampoline built into a moored skiff, followed by a moving ferry work deck, repeated white rope bumpers and buoy floats',center:[96,2,0],camera:[73,32,44],placement:[91.5,1.32,0],level:'bonus-carlisle-coast'});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),report={sourceCommit:'5a4cc84f6cd82429da927dfd0227badcf0de1982',errors:[],captures:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
try{
 await page.goto(base+'/?playtest&level=carlisle-coast',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 for(const shot of plan){
  await page.evaluate(async shot=>{const g=window.__game;if(g.getCurrentLevel().id!==shot.level){g.switchLevel(shot.level);await g.getLevel().prepareJungleAssets();}g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...shot.placement)});},shot);
  await page.waitForTimeout(180);
  const result=await page.evaluate(shot=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible,fog=g.scene.fog;g.scene.fog=null;g.player.group.visible=false;c.position.set(...shot.camera);c.fov=50;c.near=.1;c.far=5000;c.lookAt(...shot.center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;g.scene.fog=fog;return{url,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],components:g.getCurrentLevel().data.components.length};},shot);
  assert.deepEqual(result.canvas,[1920,1080]);const path=`${out}/screenshots/${shot.id}.png`;await writeFile(path,Buffer.from(result.url.split(',')[1],'base64'));report.captures.push({...shot,screenshot:path,canvas:result.canvas,components:result.components});console.log('Captured '+shot.id);
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(`${out}/captures.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
