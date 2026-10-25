import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(x=>x.startsWith('http'))||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.DETAIL_OUTPUT||'docs/rooftop-kook/native-global';
const levels=(process.env.DETAIL_LEVELS||'codex-lab,hollowwake-descent,rolling-bones,coastal-street-run,waterpark,country-club,treehouse-trail').split(',');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),reports=[];
try{
 for(const id of levels){
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[],lowRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{if(/-lod\.glb(?:\?|$)/.test(r.url()))lowRequests.push(r.url());});
  try{
   await page.goto(`${base}/?playtest&level=${id}&frameprobe`,{waitUntil:'domcontentloaded',timeout:180000});
   await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:240000});
   await page.evaluate(async()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);await g.getLevel().prepareJungleAssets();});
   await page.waitForTimeout(500);
   const views=[];
   for(const mode of ['spawn','middle']){
    if(mode==='middle')await page.evaluate(()=>{const g=window.__game,l=g.getLevel();for(let i=0;i<=Math.floor(l.checkpoints.length/2);i++)if(l.checkpoints.length)g.player.warpCheckpoint(l,1);});
    await page.waitForTimeout(700);await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
    const view=await page.evaluate(()=>{
     const g=window.__game,l=g.getLevel(),counts={native:0,reduced:0,lodControllers:0,blockworks:0,hazards:0,tunnels:0,city:0},samples=[];
     const nativeBores=new Set(l.hollowwakeTunnels?.bores?.flatMap(b=>[b.near?.id,b.floor?.id]).filter(Boolean)??[]);
     const reduced=o=>(o.userData.sceneryLod??0)>0||(o.userData.bwLod??0)>0||(o.userData.hollowwakeBore&&!nativeBores.has(o.id));
     const audit=()=>{l.root.updateMatrixWorld(true);l.root.traverseVisible(o=>{if(o.isLOD)counts.lodControllers++;if(!o.isMesh)return;
      const data=o.userData,authored=data.jungleAsset||data.bwLod!==undefined||data.hazardVisual||data.hollowwakeBore||data.cityAsset;
      if(!authored)return;
      counts.native++;if(reduced(o))counts.reduced++;
      if(data.bwLod!==undefined)counts.blockworks++;if(data.hazardVisual)counts.hazards++;if(data.hollowwakeBore)counts.tunnels++;if(data.cityAsset)counts.city++;
      const p=g.camera.position.clone();o.getWorldPosition(p);const distance=p.distanceTo(g.camera.position);
      if(distance>70&&samples.length<12)samples.push({name:o.name,kind:data.jungleAsset??null,distance,triangles:(o.geometry.index?.count??o.geometry.attributes.position.count)/3});
     });};audit();
     const captures=[];l.jungleAssets?.withSceneryCapture(()=>{l.jungleAssets.root.traverseVisible(o=>{if(o.isMesh)captures.push(o.userData.sceneryLod??0);});});
     const checks=[];l.root.traverse(o=>{if(o.isMesh&&(o.userData.bwLod!==undefined||o.userData.hazardVisual||o.userData.hollowwakeBore))checks.push([o.id,o.geometry.uuid,o.geometry.index?.count??o.geometry.attributes.position.count]);});
     // Cross the old 38/48/100m switching bands without changing player physics.
     const camera=g.camera.position.clone(),distanceProof=[];
     for(const delta of [0,60,140]){const p=camera.clone();p.z+=delta;l.blockworksAssets?.setView(p,750);l.blockworksSurfaces?.setView(p,750);l.hollowwakeTunnels?.setView(p,750);
      const selected=[];let reducedMeshes=0;l.root.traverse(o=>{if(o.isMesh&&o.visible&&(o.userData.bwLod!==undefined||o.userData.hazardVisual||o.userData.hollowwakeBore)){selected.push([o.id,o.geometry.uuid,o.geometry.index?.count??o.geometry.attributes.position.count]);if(reduced(o))reducedMeshes++;}});
      distanceProof.push({delta,selected,original:checks,reducedMeshes});}
     l.updateSceneryView(g.camera);
     return {counts,samples,captures,distanceProof,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],resolution:g.renderQualitySettings.regularResolution,assets:l.jungleAssetDiagnostics,blockworks:l.blockworksArtDiagnostics,hazards:l.hazardAssetDiagnostics,tunnels:l.hollowwakeDiagnostics,stamp:document.querySelector('.hud-build')?.textContent};
    });
    assert.deepEqual(view.buffer,[1920,1080]);assert.equal(view.resolution,'max');assert.equal(view.counts.reduced,0);assert.equal(view.counts.lodControllers,0);assert.ok(view.captures.every(n=>n===0));
    for(const proof of view.distanceProof){assert.equal(proof.reducedMeshes,0);const original=new Map(proof.original.map(row=>[row[0],row.slice(1)]));for(const row of proof.selected)assert.deepEqual(row.slice(1),original.get(row[0]));delete proof.original;proof.selected=proof.selected.length;}
    await page.screenshot({path:`${out}/${id}-${mode}.png`});views.push({mode,...view});
   }
   assert.deepEqual(errors,[]);assert.deepEqual(lowRequests,[]);
   if(id==='codex-lab')assert.ok(views.some(v=>v.counts.blockworks>0));
   if(id==='hollowwake-descent')assert.ok(views.some(v=>v.counts.tunnels>0));
   if(id==='rolling-bones')assert.ok(views.some(v=>v.counts.hazards>0));
   reports.push({id,views,errors,lowRequests});console.log(id,JSON.stringify(views.map(v=>({mode:v.mode,counts:v.counts}))));
  }finally{await page.close();}
 }
}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,reports},null,2)+'\n');await browser.close();}
