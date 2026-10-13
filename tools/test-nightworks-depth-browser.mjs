import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.NIGHTWORKS_DEPTH_OUTPUT||'/private/tmp/nightworks-depth-proof';
const base=process.argv.find(v=>/^http/.test(v))||'http://127.0.0.1:5236/';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}?playtest&level=nightworks-after-hours`);
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
 await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);g.player.step=()=>{};});
 const rows=[];
 for(const [id,point,name]of [['nightworks-after-hours',[0,10.1,10],'arrival'],['nightworks-after-hours',[-8,12.1,-180],'cutbacks'],['bonus-nightworks-after-hours',[29,6.1,0],'bonus']]){
   await page.evaluate(async({id,point})=>{const g=window.__game;if(g.getCurrentLevel().id!==id)g.switchLevel(id);await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages()]);g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().fromArray(point),heading:g.player.pos.clone().set(0,0,-1)});},{id,point});
   await page.waitForTimeout(800);
   const data=await page.evaluate(()=>{
     const g=window.__game,l=g.getLevel(),r=g.renderer,root=l.root,gl=r.getContext();
     const rim=root.getObjectByName('Front caldera rim'),terrace=root.getObjectByName('Lower caldera terraces'),plume=root.getObjectByName('Distant Gouraud caldera smoke');
     const lights=[];root.traverse(o=>{if(o.userData.calderaLight)lights.push(o);});
     const previous=r.getRenderTarget(),viewport=r.getViewport({copy:v=>({x:v.x,y:v.y,z:v.z,w:v.w})});
     const width=r.domElement.width,height=r.domElement.height;
     function shot(){const a=new Uint8Array(width*height*4);r.setRenderTarget(null);r.setViewport(0,0,width,height);r.clear();r.render(g.scene,g.camera);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
     let a,b,c,d;
     try{
       rim.visible=true;plume.visible=true;a=shot();
       plume.visible=false;b=shot();
       rim.visible=false;plume.visible=true;c=shot();
       plume.visible=false;d=shot();
       rim.visible=true;plume.visible=true;
       let hidden=0,shown=0,raw=0;
       const delta=(x,y,i)=>Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2]);
       for(let i=0;i<a.length;i+=4){const on=delta(a,b,i),off=delta(c,d,i);if(off>8){raw++;if(on<2)hidden++;}if(on>8)shown++;}
       const lit=shot(),powers=lights.map(x=>x.intensity);for(const light of lights)light.intensity=0;const dark=shot();lights.forEach((x,i)=>x.intensity=powers[i]);
       let litPixels=0,redDifference=0;
       for(let i=0;i<lit.length;i+=4){if(delta(lit,dark,i)>9){litPixels++;redDifference+=lit[i]-dark[i];}}
       return {hiddenByRimPixels:hidden,visibleSmokePixels:shown,smokePixelsWithoutRim:raw,litPixels,redDifference,powers,
         layerNames:[rim.name,terrace.name],sharedAtlas:rim.material.map===terrace.material.map,
         viewport:[width,height]};
     }finally{rim.visible=true;plume.visible=true;r.setRenderTarget(previous);r.setViewport(viewport.x,viewport.y,viewport.z,viewport.w);}
   });
   assert.ok(data.hiddenByRimPixels>500,`${name}: the near rim must actually occlude the smoke`);
   assert.ok(data.visibleSmokePixels>2000,`${name}: the rising plume remains visible`);
   assert.ok(data.litPixels>100&&data.redDifference>3000,`${name}: the spill lights must change the stone`);
   assert.ok(data.sharedAtlas,'matte layers reuse one painting');
   rows.push({name,...data});await page.waitForTimeout(100);await page.screenshot({path:`${out}/${name}.png`});
 }
 assert.deepEqual(errors,[]);
 const result={rows,errors};await writeFile(`${out}/proof.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));console.log('PASS rendered caldera depth, visible spill lighting and shared atlas.');
}finally{await browser.close();}
