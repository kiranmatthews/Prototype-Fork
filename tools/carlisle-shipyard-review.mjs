import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';

const root=resolve(import.meta.dirname,'..'),base='http://127.0.0.1:5483';
const art=resolve(root,'art/carlisle-shipyard'),docs=resolve(root,'docs/carlisle-relay/shipyard-polish');
const library=JSON.parse(await readFile(resolve(art,'models.json'),'utf8'));
const require=createRequire(import.meta.url);let pw;
try{pw=require.resolve('playwright')}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'}
const {chromium}=await import(pathToFileURL(pw).href);
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
const errors=[],failedResources=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push({message:message.text(),location:message.location()})});
page.on('response',response=>{if(response.status()>=400)failedResources.push({url:response.url(),status:response.status()})});
const report={startedAt:new Date().toISOString(),models:[],errors,failedResources};
async function visibleImagesReady(){
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.card img')).filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).every(image=>image.complete&&image.naturalWidth>0));
  await page.evaluate(()=>Promise.all(Array.from(document.querySelectorAll('.card img')).filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).map(image=>image.decode())));
}
await mkdir(resolve(art,'review'),{recursive:true});
try{
  assert.equal(library.assets.length,12,'Finish generation before the final review');
  await page.goto(base+'/docs/carlisle-relay/shipyard-polish/index.html');
  await page.waitForFunction(()=>window.__shipyardGallery);
  assert.deepEqual(await page.evaluate(()=>window.__shipyardGallery),{concepts:20,props:12,models:12});
  const images=await page.evaluate(async()=>{
    const [concepts,props,models]=await Promise.all([fetch('./concepts.json').then(r=>r.json()),fetch('./props.json').then(r=>r.json()),fetch('/art/carlisle-shipyard/models.json').then(r=>r.json())]);
    const paths=[...concepts.areas.flatMap(a=>[a.concept,a.screenshot]),...props.assets.map(a=>a.reference),...models.assets.map(a=>a.preview)];
    return Promise.all(paths.map(path=>new Promise(done=>{const image=new Image();image.onload=()=>done({path,width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>done({path,error:true});image.src='/'+path})));
  });
  assert.equal(images.length,64);assert(images.every(image=>image.width>0));
  await visibleImagesReady();await page.screenshot({path:resolve(docs,'gallery-desktop.png')});
  for(const [filter,count] of [['1',6],['2',6],['3',6],['bonus',2],['props',12]]){
    await page.locator(`[data-filter="${filter}"]`).click();assert.equal(await page.locator('.card').count(),count);
  }
  assert.equal(await page.locator('.card .actions a').count(),12);
  await visibleImagesReady();await page.screenshot({path:resolve(docs,'props-gallery.png')});
  await page.locator('[data-filter="all"]').click();await page.locator('[data-source="0"]').click();
  assert((await page.locator('#big-image').getAttribute('src')).includes('screenshots/'));
  await page.locator('#source-toggle').click();assert((await page.locator('#big-image').getAttribute('src')).includes('concepts/'));
  await page.keyboard.press('ArrowRight');assert.match(await page.locator('#modal-title').innerText(),/Scissor/);await page.locator('#close').click();
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await visibleImagesReady();await page.screenshot({path:resolve(docs,'gallery-mobile.png')});
  await writeFile(resolve(docs,'gallery-qa.json'),JSON.stringify({date:new Date().toISOString(),images:64,checks:['20 concepts and 12 textured prop cards','all act and bonus filters','greybox comparison','keyboard navigation','390px without horizontal overflow','native 1920x1080 gallery'],errors,failedResources},null,2)+'\n');
  if(process.argv.includes('--gallery-only')){assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);console.log(JSON.stringify({images:64,errors,failedResources}));await browser.close();process.exit(0)}

  await page.setViewportSize({width:1920,height:1080});
  await page.goto(base+'/art/carlisle-shipyard/viewer.html');await page.waitForFunction(()=>window.__shipyardViewer?.current);
  report.proceduralNet=await page.evaluate(()=>window.__shipyardViewer.current);
  await page.screenshot({path:resolve(art,'review/procedural-net-rest.png')});
  const net=await page.evaluate(()=>window.__shipyardViewer.exportNet());await writeFile(resolve(art,'procedural-marine-net.glb'),Buffer.from(net));
  await page.locator('#compression').fill('1');await page.locator('#compression').dispatchEvent('input');await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__shipyardViewer.getNet().compression),1);
  await page.screenshot({path:resolve(art,'review/procedural-net-compressed.png')});
  for(const id of ['assembled-net',...library.assets.map(a=>a.id)]){
    await page.selectOption('#asset',id);await page.waitForFunction(id=>window.__shipyardViewer.current.id===id,id);await page.waitForTimeout(100);
    const metrics=await page.evaluate(()=>({...window.__shipyardViewer.current,framing:window.__shipyardViewer.getFraming()}));
    assert(metrics.framing.maxX<.99&&metrics.framing.maxY<.99,id+' front framing');
    if(id!=='assembled-net')assert.equal(metrics.triangles,library.assets.find(a=>a.id===id).triangles);
    report.models.push(metrics);
    await page.screenshot({path:resolve(art,'review/'+id+'-front.png')});
    if(id==='assembled-net'){
      const data=await page.evaluate(()=>window.__shipyardViewer.exportCurrent());await writeFile(resolve(art,'net-housing-assembly.glb'),Buffer.from(data));
      await page.locator('#compression').fill('1');await page.locator('#compression').dispatchEvent('input');await page.waitForTimeout(100);
      await page.screenshot({path:resolve(art,'review/assembled-net-compressed.png')});await page.locator('#compression').fill('0');await page.locator('#compression').dispatchEvent('input');
    }
    await page.evaluate(()=>{const {camera,controls}=window.__shipyardViewer;camera.position.x=controls.target.x-(camera.position.x-controls.target.x);camera.position.z=controls.target.z-(camera.position.z-controls.target.z);controls.update()});
    await page.waitForTimeout(100);const backFraming=await page.evaluate(()=>window.__shipyardViewer.getFraming());assert(backFraming.maxX<.99&&backFraming.maxY<.99,id+' back framing');await page.screenshot({path:resolve(art,'review/'+id+'-back.png')});
  }
  report.exports=await page.evaluate(async()=>{
    const {loader}=window.__shipyardViewer;const reports=[];
    for(const name of ['procedural-marine-net.glb','net-housing-assembly.glb']){
      const gltf=await loader.loadAsync('/art/carlisle-shipyard/'+name);let triangles=0,morphMeshes=0;const textures=new Set();let finite=true;
      gltf.scene.traverse(node=>{if(!node.isMesh)return;triangles+=(node.geometry.index?.count??node.geometry.attributes.position.count)/3;if(node.morphTargetInfluences?.length)morphMeshes++;for(const attr of [node.geometry.attributes.position,...(node.geometry.morphAttributes.position??[])])finite&&=Array.from(attr.array).every(Number.isFinite);for(const material of Array.isArray(node.material)?node.material:[node.material])for(const value of Object.values(material))if(value?.isTexture)textures.add(value.uuid)});
      reports.push({name,triangles,morphMeshes,textures:textures.size,finite});
    }
    return reports;
  });
  assert.equal(report.exports[0].triangles,report.proceduralNet.triangles);assert.equal(report.exports[1].triangles,report.models[0].triangles);
  assert(report.exports.every(item=>item.morphMeshes===1&&item.finite));assert.equal(report.exports[1].textures,5);
  await page.selectOption('#asset','assembled-net');await page.waitForFunction(()=>window.__shipyardViewer.current.id==='assembled-net');
  await page.locator('#lighting').click();await page.waitForTimeout(100);await page.screenshot({path:resolve(art,'review/assembled-net-night.png')});
  await page.locator('#wire').click();assert(await page.evaluate(()=>{let all=true;window.__shipyardViewer.getObject().traverse(n=>{if(n.isMesh)all&&=(Array.isArray(n.material)?n.material:[n.material]).every(m=>m.wireframe)});return all}));await page.locator('#wire').click();
  await page.locator('#spin').click();assert(await page.evaluate(()=>window.__shipyardViewer.controls.autoRotate));await page.locator('#spin').click();
  await page.setViewportSize({width:960,height:540});await page.locator('#fit').click();await page.waitForTimeout(100);await page.screenshot({path:resolve(art,'review/normal-presentation.png')});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);report.finishedAt=new Date().toISOString();
  report.checks=['native 1920x1080 front and back of every mesh','all triangle counts match GLB audit','live net compression','GLB exports loaded back with identical triangle counts and the baked compression morph','embedded PBR texture round trip','night lighting','wireframe and orbit controls','960x540 presentation','390px responsive viewer'];
  await writeFile(resolve(art,'review/browser-qa.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({models:library.assets.length,exports:report.exports,errors,failedResources}));
}finally{await browser.close()}
