// Compare candidate GPU colour maps with the accepted portable atlases in the
// same frozen native-4K scene. Measure only visible treasure pixels as well as
// the whole frame; the unchanged control must remain exact.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {textureDigest} from '../release-textures.mjs';
import {separateKtxFormatPreferences} from '../ktx-format-preferences.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),arg=name=>process.argv.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const source=path.resolve(arg('source')??path.join(root,'.img2threejs/drowned-crown/excellence/treasure-gpu-candidates'));
const out=path.resolve(arg('out')??'/private/tmp/crown-treasure-gpu-review');await mkdir(out,{recursive:true});
const shadowManifest=JSON.parse(await readFile(path.join(root,'tools/drowned-crown/excellence/treasure-shadow-manifest.json')));
const nativeModels=new Map();
for(const name of ['shallow','bank','hero']){const bytes=await readFile(path.join(source,'treasure-mound-'+name+'-source.glb'));assert.equal(textureDigest(bytes),shadowManifest.assets.find(a=>a.name==='treasure-mound-'+name).outputSha256,'Review requires the exact original portable-atlas stage');nativeModels.set(name,bytes);}
const names=['shallow','bank','hero'].filter(name=>!arg('only')||arg('only').split(',').includes(name));assert.ok(names.length);
const bundle=await build({stdin:{contents:`
import * as THREE from 'three';
import {sceneryTextureLoader} from './src/sceneryTextureLoader.ts';
window.treasureGpu={THREE,async load(renderer,names){const loader=sceneryTextureLoader(renderer),maps={};for(const name of names){const map=await loader.loadAsync('/__treasure-'+name+'.ktx2');map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;map.flipY=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;maps['crowntreasuremound'+name]=map;}return maps;}};
`,resolveDir:root,sourcefile:'treasure-gpu-review.ts',loader:'ts'},bundle:true,write:false,format:'esm',platform:'browser',define:{'import.meta.env.BASE_URL':"'/'"},plugins:[{name:'ktx-fix',setup(b){b.onLoad({filter:/KTX2Loader\.js$/},async args=>({contents:separateKtxFormatPreferences(await readFile(args.path,'utf8')),loader:'js'}));}}]});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={base,source,views:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('crash',()=>report.errors.push('Page crashed'));
 await page.addInitScript(()=>{for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{e.stopImmediatePropagation();e.preventDefault();},true);Object.defineProperty(navigator,'getGamepads',{value:()=>[]});localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:1,fixed60:true}));});
 await page.route('**/__treasure-review.js',r=>r.fulfill({contentType:'text/javascript',body:Buffer.from(bundle.outputFiles[0].contents)}));
 // Supply the verified original packing stage even when preview already
 // uses GPU images, so a later review cannot compare a texture to itself.
 for(const [name,bytes]of nativeModels)await page.route('**/drowned-crown/excellence/treasure-mound-'+name+'.glb',r=>r.fulfill({contentType:'model/gltf-binary',body:bytes}));
 for(const name of names)await page.route('**/__treasure-'+name+'.ktx2',r=>r.fulfill({contentType:'image/ktx2',path:path.join(source,'treasure-mound-'+name+'-colour.ktx2')}));
 await page.goto(new URL('?playtest&renderdiag&level=drowned-crown',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.addScriptTag({url:'/__treasure-review.js',type:'module'});
 await page.waitForFunction(()=>window.treasureGpu);
 await page.evaluate(async names=>{window.treasureMaps=await window.treasureGpu.load(window.__game.renderer,names);window.__game.campaign.startEphemeral();},names);
 for(const [view,position,heading]of [['entrance',[1032,18.1,-407],[0,0,-1]],['treasury',[1032,20.1,-425],[0,0,-1]],['left-piles',[1027,20.1,-424],[-1,0,0]],['return-view',[1032,20.1,-431],[0,0,1]]]){
  await page.evaluate(async({position,heading})=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...position),heading:g.player.camDir.clone().set(...heading)});await g.getLevel().prepareJungleAssets();},{position,heading});
  await page.waitForTimeout(2200);await page.waitForFunction(()=>!window.__game.getLoadingDiagnostics().pending.length&&window.__game.player.grounded,null,{timeout:90000});
  const data=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),r=g.renderer,gl=r.getContext(),THREE=window.treasureGpu.THREE,width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
   g.player.snapRenderInterpolation();g.scene.updateMatrixWorld(true);
   const materials=new Map(),treasure=new Set();
   l.jungleAssets.root.traverse(m=>{const map=window.treasureMaps[m.userData.jungleAsset];if(m.isMesh&&map){treasure.add(m);materials.set(m.material,{old:m.material.map,gpu:map});}});
   for(const maps of materials.values())if(maps.old?.isCompressedTexture)throw Error('Baseline must use the retained original portable colour image');
   const pixels=()=>{const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;};
   const capture=()=>{for(let i=0;i<2;i++){r.info.reset();r.setRenderTarget(null);r.render(g.scene,g.camera);}return{pixels:pixels(),jpeg:r.domElement.toDataURL('image/jpeg',.94).split(',')[1],render:{...r.info.render}};};
   const bind=gpu=>{for(const [material,maps]of materials){material.map=gpu?maps.gpu:maps.old;material.needsUpdate=true;}};
   const oldClear=r.getClearColor(new THREE.Color()).clone(),oldAlpha=r.getClearAlpha();
   const oldAuto=r.autoClear,oldBackground=g.scene.background,oldShadow=r.shadowMap.autoUpdate,oldNeeds=r.shadowMap.needsUpdate;
   const hidden=[],replaced=[],maskMaterial=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false,fog:false,depthWrite:false});let mask;
   try{
    bind(false);const baseline=capture();
    // Keep the actual scene depth while clearing only colour. Rendering just
    // the original pile meshes then produces their correctly occluded mask.
    g.scene.traverse(m=>{if(!m.isMesh&&!m.isSprite&&!m.isLine&&!m.isPoints)return;if(treasure.has(m)){replaced.push([m,m.material]);m.material=maskMaterial;}else if(m.visible){hidden.push(m);m.visible=false;}});
    r.autoClear=false;g.scene.background=null;r.shadowMap.autoUpdate=false;r.shadowMap.needsUpdate=false;r.setClearColor(0x000000,1);r.clear(true,false,false);r.render(g.scene,g.camera);mask=pixels();
    for(const m of hidden)m.visible=true;hidden.length=0;for(const [m,material]of replaced)m.material=material;replaced.length=0;
    r.setClearColor(oldClear,oldAlpha);r.autoClear=oldAuto;g.scene.background=oldBackground;r.shadowMap.autoUpdate=oldShadow;r.shadowMap.needsUpdate=oldNeeds;
    bind(true);const candidate=capture();bind(false);const control=capture();
    const measure=selected=>{let n=0,sum=0,square=0,max=0,over8=0;const histogram=new Uint32Array(256);for(let i=0;i<baseline.pixels.length;i+=4){if(selected&&mask[i]<250)continue;n++;let peak=0;for(let c=0;c<3;c++){const d=Math.abs(baseline.pixels[i+c]-candidate.pixels[i+c]);sum+=d;square+=d*d;max=Math.max(max,d);peak=Math.max(peak,d);histogram[d]++;}if(peak>8)over8++;}let cumulative=0,p99=0;for(let i=0;i<256;i++){cumulative+=histogram[i];if(cumulative>=n*3*.99){p99=i;break;}}return{pixels:n,meanAbs:sum/(n*3),psnr:square?10*Math.log10(255*255/(square/(n*3))):null,p99,max,over8PixelPercent:100*over8/n};};
    let controlMax=0;for(let i=0;i<baseline.pixels.length;i++)controlMax=Math.max(controlMax,Math.abs(baseline.pixels[i]-control.pixels[i]));
    return{width,height,whole:measure(false),treasure:measure(true),controlMax,baseline:baseline.render,candidate:candidate.render,grounded:g.player.grounded,position:g.player.pos.toArray(),deaths:g.player.totalDeaths,glError:gl.getError(),maps:[...materials].map(([m,t])=>({width:t.gpu.image.width,height:t.gpu.image.height,format:t.gpu.format,mips:t.gpu.mipmaps.length,bytes:t.gpu.mipmaps.reduce((n,m)=>n+m.data.byteLength,0)})),jpegs:{baseline:baseline.jpeg,candidate:candidate.jpeg}};
   }finally{for(const m of hidden)m.visible=true;for(const [m,material]of replaced)m.material=material;bind(false);r.setClearColor(oldClear,oldAlpha);r.autoClear=oldAuto;g.scene.background=oldBackground;r.shadowMap.autoUpdate=oldShadow;r.shadowMap.needsUpdate=oldNeeds;maskMaterial.dispose();}
  });
  for(const [name,jpeg]of Object.entries(data.jpegs))await writeFile(path.join(out,view+'-'+name+'.jpg'),Buffer.from(jpeg,'base64'));delete data.jpegs;
  report.views.push({view,...data});await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({view,whole:data.whole,treasure:data.treasure,controlMax:data.controlMax}));
  assert.deepEqual([data.width,data.height],[3840,2160]);assert.equal(data.controlMax,0);assert.equal(data.glError,0);assert.equal(data.grounded,true);assert.equal(data.deaths,0);assert.ok(data.treasure.pixels>10000);assert.equal(data.baseline.calls,data.candidate.calls);assert.equal(data.baseline.triangles,data.candidate.triangles);
  assert.ok(data.treasure.psnr===null||data.treasure.psnr>=40,'Visible treasure detail changed too much');assert.ok(data.treasure.p99<=12&&data.whole.meanAbs<.2,'Texture comparison exceeds reviewed error limits');
 }
 assert.deepEqual(report.errors,[]);
}finally{await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
