import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite'),candidate=process.argv.includes('--candidate');
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5484';
const out=process.env.CARLISLE_EQ_OUT??`art/carlisle-shipyard/render-cost/${baseline?'baseline':lite?'lite':'review'}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,baseline,lite,candidate,errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.source=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);return{build:document.querySelector('.hud-build')?.textContent,art:g.getLevel().carlisleShipyardDiagnostics};});
 // Record complete source geometry and every exact instance transform/attribute,
 // independently of batch count. Camera visibility never enters this inventory.
 report.inventory=await page.evaluate(async()=>{
  const g=window.__game,root=g.scene.getObjectByName('Carlisle shipyard art'),records=[],geometries=new Map();root.updateWorldMatrix(true,true);
  const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
  const bytes=array=>new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
  const meshes=[];root.traverse(n=>{if(n.isInstancedMesh)meshes.push(n);});
  for(const n of meshes){
   const geometry=n.geometry,attributes={};
   if(!geometries.has(geometry)){
    for(const[key,a]of Object.entries(geometry.attributes))if(!a.isInstancedBufferAttribute)attributes[key]={itemSize:a.itemSize,normalized:a.normalized,hash:await digest(bytes(a.array))};
    geometries.set(geometry,JSON.stringify({attributes,index:geometry.index?await digest(bytes(geometry.index.array)):null,groups:geometry.groups}));
   }
   const material=n.material,identity=JSON.stringify({name:n.name,geometry:geometries.get(geometry),material:{name:material.name,type:material.type,color:material.color?.getHex(),roughness:material.roughness,metalness:material.metalness,side:material.side,transparent:material.transparent},castShadow:n.castShadow,receiveShadow:n.receiveShadow});
   for(let i=0;i<n.count;i++){
    const instance=n.matrix.clone().fromArray(n.instanceMatrix.array,i*16).premultiply(n.matrixWorld),attributes={};
    for(const[key,a]of Object.entries(geometry.attributes))if(a.isInstancedBufferAttribute)attributes[key]=Array.from(a.array.slice(i*a.itemSize,(i+1)*a.itemSize));
    records.push(JSON.stringify({identity,instance:instance.toArray(),attributes}));
   }
  }
  records.sort();return{instances:records.length,hash:await digest(new TextEncoder().encode(records.join('\n'))),batches:meshes.length};
 });
 if(!baseline){
  const old=JSON.parse(await readFile('art/carlisle-shipyard/render-cost/baseline/equivalence.json','utf8')).inventory;
  assert.equal(report.inventory.instances,old.instances);assert.equal(report.inventory.hash,old.hash,'complete instance geometry/transform/attribute/material inventory changed');
  if(candidate)assert.ok(report.inventory.batches>old.batches,'spatial batches were not installed');
  else assert.equal(report.inventory.batches,old.batches,'restored production batch layout differs');
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/equivalence.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
