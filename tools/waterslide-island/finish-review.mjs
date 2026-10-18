import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import ts from 'typescript';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const referencePath=process.env.FINISH_REFERENCE_SOURCE;
assert.ok(referencePath,'Set FINISH_REFERENCE_SOURCE to an approved earlier src/race/finish.ts');
const reference=ts.transpileModule(await readFile(referencePath,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const output=process.env.FINISH_REVIEW_OUTPUT||'/private/tmp/slipstream-finish-review';await mkdir(output,{recursive:true});
const server=await createServer({logLevel:'silent',server:{host:'127.0.0.1',port:0,hmr:false,ws:false}});await server.listen();
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:768,height:512},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.route('**/__finish-review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Slipstream finish comparison</title><style>body{margin:0}</style>'}));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__finish-review`);
 await page.evaluate(async source=>{
  const transformed=await(await fetch('/src/race/finish.ts')).text(),threeUrl=transformed.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1];
  const THREE=await import(threeUrl),{createRaceFinish}=await import('/src/race/finish.ts');
  const url=URL.createObjectURL(new Blob([source.replace(/from\s+["']three["']/,`from '${new URL(threeUrl,location.href).href}'`)],{type:'text/javascript'}));
  const old=await import(url);URL.revokeObjectURL(url);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(768,512);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#8ebbc5');
  scene.add(new THREE.HemisphereLight('#b1d8d0','#526b52',.78));const sun=new THREE.DirectionalLight('#fff0ce',1.9);sun.position.set(-12,20,16);scene.add(sun);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshLambertMaterial({color:'#328eaa'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;scene.add(floor);
  const models=[old.createRaceFinish(44),createRaceFinish(44)],camera=new THREE.PerspectiveCamera(54,768/512,.1,300),gl=renderer.getContext();
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const select=index=>{for(const model of models)scene.remove(model);scene.add(models[index]);};
  window.finishReview={
   view(spec){for(const model of models){model.rotation.y=spec.yaw||0;model.position.set(0,0,0);}camera.position.fromArray(spec.camera);camera.lookAt(...spec.target);camera.updateMatrixWorld(true);},
   capture(index){select(index);renderer.render(scene,camera);const pixels=new Uint8Array(768*512*4);gl.readPixels(0,0,768,512,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {pixels,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,png:renderer.domElement.toDataURL('image/png')};},
   compare(){const before=this.capture(0),after=this.capture(1);let different=0,maximum=0,total=0;for(let i=0;i<before.pixels.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(before.pixels[i+c]-after.pixels[i+c]);maximum=Math.max(maximum,d);total+=d;if(d>2)changed=true;}if(changed)different++;}return {differentPixels:different,totalPixels:768*512,maxChannelDifference:maximum,meanChannelDifference:total/(768*512*3),before:{draws:before.draws,triangles:before.triangles,png:before.png},after:{draws:after.draws,triangles:after.triangles,png:after.png}};},
   async measure(index){select(index);for(let i=0;i<24;i++)renderer.render(scene,camera);gl.finish();const query=ext?gl.createQuery():null;if(query)gl.beginQuery(ext.TIME_ELAPSED_EXT,query);const start=performance.now();for(let i=0;i<64;i++)renderer.render(scene,camera);if(query)gl.endQuery(ext.TIME_ELAPSED_EXT);gl.finish();const wallMs=(performance.now()-start)/64;let gpuMs=null;if(query){for(let i=0;i<120&&!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE);i++)await new Promise(requestAnimationFrame);if(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)||gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('GPU timer unavailable/disjoint');gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6/64;gl.deleteQuery(query);}return {wallMs,gpuMs,draws:renderer.info.render.calls};}
  };
 },reference);
 const views=[{name:'front',camera:[24,9,33],target:[0,3,0]},{name:'rear',camera:[-18,7,-36],target:[0,3,0]},{name:'rider',camera:[0,1.6,24],target:[0,4,0]},{name:'turned',camera:[28,11,33],target:[0,3,0],yaw:.65}],results=[];
 for(const view of views){
  await page.evaluate(v=>window.finishReview.view(v),view);const row=await page.evaluate(()=>window.finishReview.compare());
  for(const mode of ['before','after']){await writeFile(`${output}/${view.name}-${mode}.png`,Buffer.from(row[mode].png.split(',')[1],'base64'));delete row[mode].png;}
  results.push({name:view.name,...row});
  assert.ok(row.differentPixels/row.totalPixels<.0005,'batching changes visible finish pixels');assert.ok(row.meanChannelDifference<.02);
  // Old per-box culling can omit off-screen squares; the three complete
  // material batches retain identical visible pixels. The floor adds one draw.
  assert.equal(row.after.triangles,1394);assert.ok(row.before.triangles<=1394);assert.ok(row.before.draws>row.after.draws);assert.equal(row.after.draws,4);
 }
 await page.evaluate(v=>window.finishReview.view(v),views[0]);
 const samples=[[],[]];for(let round=0;round<7;round++)for(const index of round%2?[1,0]:[0,1])samples[index].push(await page.evaluate(i=>window.finishReview.measure(i),index));
 const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
 const timing={method:'Isolated finish plus one floor draw; seven alternating AB/BA pairs of 64 renders after 24 warmup renders. This measures the finish fixture, not full-game FPS.',before:{medianWallMs:median(samples[0].map(v=>v.wallMs)),medianGpuMs:median(samples[0].map(v=>v.gpuMs))},after:{medianWallMs:median(samples[1].map(v=>v.wallMs)),medianGpuMs:median(samples[1].map(v=>v.gpuMs))},samples};
 const report={referencePath,results,timing,errors};await writeFile(output+'/report.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);console.log(JSON.stringify({results,timing:{before:timing.before,after:timing.after},errors},null,2));
}finally{await browser.close();await server.close();}
