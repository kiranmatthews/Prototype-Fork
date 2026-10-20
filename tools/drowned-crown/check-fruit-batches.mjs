// Compare actual native pickup draws with their production batches at the same
// frozen pose. The game keeps ownership of morph state and collection flags.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-fruit-batches';
const lite=process.argv.includes('--lite'),fourK=process.argv.includes('--4k');
const viewport=fourK?{width:3840,height:2160}:{width:1440,height:900};
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={base,lite,viewport,views:[],errors};
try{
 const page=await browser.newPage({viewport,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('crash',()=>errors.push('browser crash'));
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true})));
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown'+(lite?'&lite':''),base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 for(const [name,position]of [['harbour',[-72,-5.3,205]],['cargo',[-71.5004,-6.05,193.0957]],['fort',[-43,-5.3,90]],['moonpool',[-48,-5.8,-75]],['treasury',[1032,20.1,-425]]]){
  await page.evaluate(async position=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(0,0,-1)});await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages(),g.player.preparePresentationAssets()]);},position);
  await page.waitForTimeout(2000);
  await page.waitForFunction(()=>!window.__game.getLoadingDiagnostics().pending.length,null,{timeout:90000});
  const result=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),owner=l.pickupVisualBatch,r=g.renderer,gl=r.getContext();
   if(!owner?.diagnostics.cells)throw Error('Production pickup batches missing');
   g.player.snapRenderInterpolation();l.updateSceneryView(g.camera);g.scene.updateMatrixWorld(true);
   const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,original=owner.root.visible;
   const rows=owner.cells.flatMap(c=>c.rows),flags=rows.map(row=>row.body.visible);
   const state=()=>JSON.stringify(l.pickups.map(p=>[p.alive,p.mesh.visible,p.mesh.position.toArray(),p.box.min.toArray(),p.box.max.toArray(),p.mesh.children.map(c=>[c.quaternion.toArray(),c.morphTargetInfluences])]));
   const beforeState=state();
   const capture=batched=>{
    owner.root.visible=batched;
    for(const row of rows)row.body.visible=batched?false:row.visible;
    for(let frame=0;frame<2;frame++){r.info.reset();l.water?.renderPasses(r,g.scene,g.camera);r.setRenderTarget(null);r.render(g.scene,g.camera);}
    const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return{pixels,render:{...r.info.render},jpeg:r.domElement.toDataURL('image/jpeg',.9).split(',')[1]};
   };
   try{
    const baseline=capture(false),candidate=capture(true),control=capture(false);
    let total=0,max=0,different=0,over8=0,controlMax=0;
    for(let i=0;i<baseline.pixels.length;i+=4){let pixel=0;for(let c=0;c<3;c++){const d=Math.abs(baseline.pixels[i+c]-candidate.pixels[i+c]);total+=d;pixel=Math.max(pixel,d);controlMax=Math.max(controlMax,Math.abs(baseline.pixels[i+c]-control.pixels[i+c]));}max=Math.max(max,pixel);different+=pixel>0;over8+=pixel>8;}
    return{width,height,baseline:baseline.render,candidate:candidate.render,diagnostics:owner.diagnostics,
     position:g.player.pos.toArray(),grounded:g.player.grounded,deaths:g.player.totalDeaths,
     glError:gl.getError(),contextLost:gl.isContextLost(),stateUnchanged:beforeState===state(),controlMax,max,
     meanRgb:total/(width*height*3),differentPercent:different/(width*height)*100,over8Percent:over8/(width*height)*100,
     memory:{...r.info.memory},baselineJpeg:baseline.jpeg,candidateJpeg:candidate.jpeg};
   }finally{owner.root.visible=original;rows.forEach((row,i)=>row.body.visible=flags[i]);}
  });
  for(const key of ['baseline','candidate']){await writeFile(`${out}/${name}-${key}.jpg`,Buffer.from(result[key+'Jpeg'],'base64'));delete result[key+'Jpeg'];}
  report.views.push({name,...result});await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
  assert.deepEqual([result.width,result.height],[viewport.width*(lite ? .5 : 1),viewport.height*(lite ? .5 : 1)]);
  assert.equal(result.controlMax,0);assert.equal(result.glError,0);assert.equal(result.contextLost,false);assert.equal(result.stateUnchanged,true);assert.equal(result.grounded,true);
  // Floating-point placement may change a handful of edge samples. Record
  // all differences; require a much smaller error than even 1/255 on average.
  assert.ok(result.meanRgb<.002);assert.ok(result.over8Percent<.005);
  console.log(JSON.stringify({name,drawsBefore:result.baseline.calls,drawsAfter:result.candidate.calls,trianglesBefore:result.baseline.triangles,trianglesAfter:result.candidate.triangles,max:result.max,meanRgb:result.meanRgb,over8Percent:result.over8Percent,diagnostics:result.diagnostics}));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
