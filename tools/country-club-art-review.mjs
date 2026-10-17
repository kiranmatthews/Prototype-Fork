import {build} from 'esbuild';import{mkdir,writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(x=>x.startsWith('http'))||'http://127.0.0.1:5252',out=process.env.COUNTRY_CLUB_OUTPUT||'/private/tmp/country-club-downhill-review';await mkdir(out,{recursive:true});
const f=await build({entryPoints:['src/levels/country-club.ts'],bundle:true,format:'esm',write:false});
const b=await chromium.launch({headless:true,channel:'chrome'}),p=await b.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await p.route('**/estate-review-source.js',r=>r.fulfill({contentType:'application/javascript',body:f.outputFiles[0].text}));
try{
 await p.goto(base+'/?playtest&level=country-club'+(process.argv.includes('--full')?'':'&lite'),{timeout:120000});await p.waitForFunction(()=>window.__game?.getCurrentLevel().id==='country-club'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});await p.evaluate(async()=>{const l=window.__game.getLevel();await Promise.all([l.prepareJungleAssets(),l.prepareSurfaceImages()]);});await p.waitForTimeout(500);
 await p.screenshot({path:out+'/player-spawn.png'});
 await p.evaluate(async()=>{window.estateSource=await import('/estate-review-source.js');});
 const pitCount=await p.evaluate(()=>window.estateSource.COUNTRY_CLUB_TRACK_PITS.length);
 for(const item of ['boost-start','bend','clubhouse','pit-04',1,13,18,'overview']){
  const data=await p.evaluate(item=>{
   const g=window.__game,m=window.estateSource,c=g.camera.clone(),r=g.renderer,fog=g.scene.fog,ratio=r.getPixelRatio(),w=r.domElement.width/ratio,h=r.domElement.height/ratio;
   c.near=3;c.far=3500;
   if(item==='overview'){c.position.set(0,1400,-470);c.up.set(0,0,1);c.lookAt(0,0,-470);c.fov=49;c.aspect=1000/1400;r.setSize(1000,1400,false);}
   else if(item==='descent'){c.position.set(1000,190,-470);c.lookAt(0,-30,-470);c.fov=54;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   else if(item==='boost-start'){const q=m.countryClubPoint(m.COUNTRY_CLUB_PADS[0].s-28),target=m.countryClubPoint(m.COUNTRY_CLUB_PADS[0].s+10);c.position.set(q[0],q[1]+6,q[2]);c.lookAt(target[0],target[1]+1,target[2]);c.fov=60;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   else if(item==='bend'){const s=m.COUNTRY_CLUB_CORNERS[3].entry,q=m.countryClubPoint(s-35),t=m.countryClubPoint(s+5);c.position.set(q[0],q[1]+6,q[2]);c.lookAt(t[0],t[1]+1,t[2]);c.fov=60;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   else if(typeof item==='string'&&item.startsWith('pit-')){const pit=m.COUNTRY_CLUB_TRACK_PITS[Number(item.slice(4))-1],u=pit.side*(m.countryClubWidth(pit.s)/2+pit.edgeOffset),q=m.countryClubPoint(pit.s,u),eye=m.countryClubPoint(pit.s-25,-pit.side*2);if(pit.edgeOffset>0)q[1]=m.countryClubGroundHeight(q[0],q[2]);c.position.set(eye[0],eye[1]+9,eye[2]);c.lookAt(q[0],q[1]+.8,q[2]);c.fov=60;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   else if(item==='clubhouse'){const a=g.getCurrentLevel().data.components.find(c=>c.nm==='Clubhouse / seated foundation'),x=a.p[0],z=a.p[2],y=a.p[1]+a.s[1]/2;c.position.set(x+60,y+35,z+65);c.lookAt(x,y+3,z);c.fov=50;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   else{const hole=m.COUNTRY_CLUB_HOLES[item-1],near=m.countryClubNearestRoad(...hole.cup),q=m.countryClubPoint(near.s),x=hole.cup[0],z=hole.cup[1],dx=q[0]-x,dz=q[2]-z,n=Math.hypot(dx,dz)||1,y=m.countryClubGroundHeight(x,z);c.position.set(x+dx/n*42-dz/n*12,y+30,z+dz/n*42+dx/n*12);c.lookAt(x,y,z);c.fov=52;c.aspect=1440/1000;r.setSize(1440,1000,false);}
   c.updateProjectionMatrix();c.updateMatrixWorld(true);g.getLevel().updateSceneryView(c);if(item==='overview')g.scene.fog=null;r.setRenderTarget(null);r.render(g.scene,c);const data=r.domElement.toDataURL('image/png');g.scene.fog=fog;r.setSize(w,h,false);g.getLevel().updateSceneryView(g.camera);return data.split(',')[1];
  },item);
  await writeFile(out+'/'+(typeof item==='string'?(item==='overview'?'estate-overview':item):`golf-${String(item).padStart(2,'0')}`)+'.png',Buffer.from(data,'base64'));
 }
 const report=await p.evaluate(()=>({stamp:document.querySelector('.hud-build')?.textContent,components:window.__game.getCurrentLevel().data.components.length,holes:window.estateSource.COUNTRY_CLUB_HOLES.map(h=>({n:h.n,cup:h.cup,raceDistance:window.estateSource.countryClubNearestRoad(...h.cup).distance})),corners:window.estateSource.COUNTRY_CLUB_CORNERS}));
 assert.deepEqual(errors,[]);await writeFile(out+'/art-review.json',JSON.stringify({...report,errors},null,2));console.log(JSON.stringify({...report,errors},null,2));
}finally{await b.close();}
