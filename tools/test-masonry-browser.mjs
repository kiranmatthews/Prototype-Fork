import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);
let module=process.env.PLAYWRIGHT_MODULE;
if(!module){try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(module.startsWith('/')?pathToFileURL(module).href:module);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5218').replace(/\/$/,'');
const output=process.env.MASONRY_REVIEW_OUTPUT||'/private/tmp/masonry-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[],report={base,levels:[],errors};
page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  for(const [id,lite] of [['sky',true],['flats',true],['sky',false]]) {
    await page.goto(`${base}/?playtest&level=${id}${lite?'&lite':''}`);
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
    await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
    await page.waitForFunction(()=>window.__game.player.grounded);
    await page.waitForTimeout(500);
    const state=await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),materials=new Set(),meshes=[];
      l.root.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m.userData.masonry){materials.add(m);meshes.push(o.name);}});
      return {level:l.name,grounded:g.player.grounded,meshes:meshes.length,materials:materials.size,
        profile:[...materials].map(m=>({type:m.type,...m.userData.masonry})),
        shaderErrors:g.renderer.info.programs.flatMap(p=>p.diagnostics?.runnable===false?[p.diagnostics]:[])};
    });
    assert.ok(state.meshes>0,`${id} did not receive shared masonry`);assert.equal(state.grounded,true);assert.deepEqual(state.shaderErrors,[]);
    assert.ok(state.profile.every(m=>m.type==='MeshPhongMaterial'&&m.metresPerTile>0));
    report.levels.push({id,lite,...state});
    await page.screenshot({path:`${output}/${id}-${lite?'lite':'full'}.jpg`,type:'jpeg',quality:90});
    console.log(`PASS ${id} ${lite?'lite':'full'}: ${state.meshes} masonry meshes, supported spawn, shaders compiled`);
  }
  // Dev-only controlled comparison uses the same live level material. A scaled
  // unit box and an equivalent dimensioned box must sample identical bricks.
  if(!process.argv.includes('--smoke-only')) {
    const fixture=await page.evaluate(async()=>{
      const T=await import('/node_modules/three/build/three.module.js'),g=window.__game;
      const source=g.getLevel().groundMeshes.find(o=>o.material.userData.masonry).material;
      const mat=source.clone();mat.onBeforeCompile=source.onBeforeCompile;mat.customProgramCacheKey=source.customProgramCacheKey;mat.color.set('#ffffff');
      const scene=new T.Scene();scene.background=new T.Color('#ddd9cf');
      const camera=new T.PerspectiveCamera(38,1280/800,.1,100);camera.position.set(6,4.2,6);camera.lookAt(0,.2,0);
      const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1280,800);renderer.setPixelRatio(1);
      const key=new T.DirectionalLight('#fff1d8',2.5);key.position.set(-3,4,2);scene.add(key,new T.HemisphereLight('#e8f2ff','#6f6251',1.5));
      const slab=new T.Mesh(new T.BoxGeometry(6,.48,3),mat);slab.position.y=-.34;scene.add(slab);
      const pier=new T.Mesh(new T.BoxGeometry(1,2,1),mat);pier.position.set(-1,-1.4,0);scene.add(pier);
      const block=new T.Mesh(new T.BoxGeometry(1,1,1),mat);block.scale.set(1.6,.8,1.2);block.position.set(1,.3,-.25);scene.add(block);
      renderer.render(scene,camera);const after=renderer.domElement.toDataURL('image/jpeg',.92);
      // Read pixels without JPEG compression for the scale-invariance assertion.
      const pixels=()=>{const gl=renderer.getContext(),a=new Uint8Array(1280*800*4);gl.readPixels(0,0,1280,800,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
      const scaled=pixels();block.geometry.dispose();block.geometry=new T.BoxGeometry(1.6,.8,1.2);block.scale.setScalar(1);renderer.render(scene,camera);
      const baked=pixels();let mismatch=0;for(let i=0;i<baked.length;i++)if(Math.abs(baked[i]-scaled[i])>2)mismatch++;
      // Disable relief only, preserving the new projection, to prove that
      // joints actually respond to lighting independently of the UV repair.
      const original=mat.onBeforeCompile,cache=mat.customProgramCacheKey;
      mat.onBeforeCompile=(shader,r)=>{original(shader,r);shader.uniforms.masonryRelief.value=0;};
      mat.customProgramCacheKey=()=>cache()+'|no-relief-review';mat.needsUpdate=true;renderer.render(scene,camera);
      const flat=pixels();let reliefPixels=0;for(let i=0;i<baked.length;i+=4)if(Math.abs(baked[i]-flat[i])+Math.abs(baked[i+1]-flat[i+1])+Math.abs(baked[i+2]-flat[i+2])>6)reliefPixels++;
      mat.onBeforeCompile=()=>{};mat.customProgramCacheKey=()=> 'legacy-masonry-review';mat.needsUpdate=true;renderer.render(scene,camera);
      const before=renderer.domElement.toDataURL('image/jpeg',.92);
      const calls=renderer.info.render.calls;for(const o of [slab,pier,block])o.geometry.dispose();mat.dispose();renderer.dispose();
      return {before,after,mismatch,reliefPixels,calls};
    });
    assert.ok(fixture.mismatch<1280*800*.002,`object scale changed masonry: ${fixture.mismatch} channels`);
    assert.ok(fixture.reliefPixels>3000,`relief shader had no visible lighting effect: ${fixture.reliefPixels} pixels`);
    assert.equal(fixture.calls,3,'masonry added draw calls');
    for(const kind of ['before','after']){await writeFile(`${output}/masonry-${kind}.jpg`,Buffer.from(fixture[kind].split(',')[1],'base64'));delete fixture[kind];}
    report.fixture=fixture;console.log('PASS metric projection across nonuniform scale, visible mortar relief and unchanged draw count',fixture);
  }
  assert.deepEqual(errors,[],'browser console errors');
  await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
} finally {await browser.close();}
