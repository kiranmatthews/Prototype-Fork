import {build} from 'esbuild';import{mkdir,writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(x=>x.startsWith('http'))||'http://127.0.0.1:5252',out=process.env.COUNTRY_CLUB_OUTPUT||'/private/tmp/country-club-estate';await mkdir(out,{recursive:true});
const f=await build({entryPoints:['src/levels/country-club.ts'],bundle:true,format:'esm',write:false});
const b=await chromium.launch({headless:true,channel:'chrome'}),p=await b.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await p.route('**/estate-review-source.js',r=>r.fulfill({contentType:'application/javascript',body:f.outputFiles[0].text}));
try{
 await p.goto(base+'/?playtest&level=country-club'+(process.argv.includes('--full')?'':'&lite'),{timeout:120000});await p.waitForFunction(()=>window.__game?.getCurrentLevel().id==='country-club'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});await p.waitForTimeout(500);
 await p.screenshot({path:out+'/player-spawn.png'});
 await p.evaluate(async()=>{window.estateSource=await import('/estate-review-source.js');});
 for(const item of ['overview','clubhouse',...Array.from({length:18},(_,i)=>i+1)]){
  const data=await p.evaluate(item=>{
   const g=window.__game,m=window.estateSource,c=g.camera.clone(),r=g.renderer,fog=g.scene.fog,ratio=r.getPixelRatio(),w=r.domElement.width/ratio,h=r.domElement.height/ratio;
   c.near=3;c.far=3500;
   if(item==='overview'){c.position.set(0,1400,-470);c.up.set(0,0,1);c.lookAt(0,0,-470);c.fov=49;c.aspect=1000/1400;r.setSize(1000,1400,false);}
   else if(item==='clubhouse'){const a=g.getCurrentLevel().data.components.find(c=>c.nm==='Clubhouse / seated foundation'),x=a.p[0],z=a.p[2],y=a.p[1]+a.s[1]/2;c.position.set(x+60,y+35,z+65);c.lookAt(x,y+3,z);c.fov=50;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   else{const hole=m.COUNTRY_CLUB_HOLES[item-1],near=m.countryClubNearestRoad(...hole.cup),q=m.countryClubPoint(near.s),x=hole.cup[0],z=hole.cup[1],dx=q[0]-x,dz=q[2]-z,n=Math.hypot(dx,dz)||1,y=m.countryClubGroundHeight(x,z);c.position.set(x+dx/n*42-dz/n*12,y+30,z+dz/n*42+dx/n*12);c.lookAt(x,y,z);c.fov=52;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   c.updateProjectionMatrix();g.scene.fog=null;r.setRenderTarget(null);r.render(g.scene,c);const data=r.domElement.toDataURL('image/png');g.scene.fog=fog;r.setSize(w,h,false);return data.split(',')[1];
  },item);
  await writeFile(out+'/'+(typeof item==='string'?(item==='overview'?'estate-overview':item):`golf-${String(item).padStart(2,'0')}`)+'.png',Buffer.from(data,'base64'));
 }
 const report=await p.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,components:window.__game.getCurrentLevel().data.components.length,holes:window.estateSource.COUNTRY_CLUB_HOLES.map(h=>({n:h.n,cup:h.cup,raceDistance:window.estateSource.countryClubNearestRoad(...h.cup).distance})),corners:window.estateSource.COUNTRY_CLUB_CORNERS}));
 assert.deepEqual(errors,[]);await writeFile(out+'/estate-review.json',JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
}finally{await b.close();}
