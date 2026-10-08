import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(v=>/^https?:/.test(v))??'http://127.0.0.1:5260').replace(/\/$/,''),out=process.env.SOLID_WORLD_OUTPUT??'/private/tmp/solid-world-browser';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[],errors=[];
try{
  for(const id of (process.env.SOLID_WORLD_LEVELS??'custard-creek,treehouse-trail,beachfront,nightworks-after-hours,ghost-train').split(',')){
    const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(180000);
    await page.addInitScript(()=>{Object.defineProperty(navigator,'getGamepads',{value:()=>[]});});
    page.on('pageerror',e=>errors.push({id,message:e.message}));page.on('console',m=>{if(m.type()==='error')errors.push({id,message:m.text()});});
    await page.goto(base+'/?playtest&level='+id,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
    const report=await page.evaluate(async()=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      await l.prepareJungleAssets();l.prepareWorldSolids();const w=l.worldSolids,V=p.pos.constructor,v=(x=0,y=0,z=0)=>new V(x,y,z);
      const hit={surface:null,normal:v(),point:v(),position:v(),surfaceDelta:v(),fraction:1,depth:0,top:0},samples=[];
      const checked=new Set();
      for(const surface of w.surfaces){
        const mesh=surface.mesh,name=mesh.userData.jungleAsset??mesh.userData.cityAsset??surface.name;
        if(!name||checked.has(name)||mesh.userData.worldSolidProxy)continue;
        const a=surface.geometry.attributes.position,index=surface.geometry.index;
        for(let i=0;i<Math.min(index?.count??a.count,1800);i+=3){
          const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),pts=ids.map(id=>v().fromBufferAttribute(a,id).applyMatrix4(surface.matrix));
          const n=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));if(n.length()<.03)continue;n.normalize();if(Math.abs(n.y)>.5)continue;
          const centre=pts[0].clone().add(pts[1]).add(pts[2]).multiplyScalar(1/3),from=centre.clone().addScaledVector(n,.8),to=centre.clone().addScaledVector(n,-.8);
          const start=performance.now(),contact=w.cast(from,to,{low:0,high:0,radius:.1,ignore:s=>s!==surface},hit);
          samples.push({name,contact,milliseconds:performance.now()-start,triangles:w.diagnostics.lastTriangles});checked.add(name);break;
        }
        if(samples.length>=60)break;
      }
      const times=[],native=p.step;
      p.step=function(...args){const start=performance.now(),result=native.apply(this,args);times.push(performance.now()-start);return result;};
      await new Promise(resolve=>{const timer=setInterval(()=>{if(times.length>=90){clearInterval(timer);resolve();}},50);setTimeout(()=>{clearInterval(timer);resolve();},15000);});p.step=native;
      times.sort((a,b)=>a-b);return{world:l.worldSolidDiagnostics,assets:l.jungleAssetDiagnostics,city:l.cityAssetDiagnostics,samples,player:{state:p.state,grounded:p.grounded,position:p.pos.toArray()},step:{count:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)]},render:g.getRenderFrameStats(),stamp:document.querySelector('.hud-build')?.textContent};
    });
    assert.match(report.stamp,/Codex\/sol fork/);assert.ok(report.samples.length>0&&report.samples.every(s=>s.contact),id+' hard surfaces');
    await page.screenshot({path:out+'/'+id+'.png'});reports.push({id,...report});console.log(JSON.stringify({id,world:report.world,samples:report.samples.length,step:report.step,player:report.player}));await page.close();
  }
  assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/report.json',JSON.stringify({base,reports,errors},null,2));await browser.close();}
