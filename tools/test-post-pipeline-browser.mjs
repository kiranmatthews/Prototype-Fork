// Compare the real CRT graph against an unmodified Vite checkout. No game UI,
// timers or random scene data participate in this pixel/resource regression.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv[2], candidate = process.argv[3];
assert.ok(baseline && candidate, 'Usage: node tools/test-post-pipeline-browser.mjs <baseline-url> <candidate-url>');
const output = process.env.POST_PIPELINE_OUTPUT || '/private/tmp/post-pipeline-review';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, channel:'chrome'});
const runs = [];
try {
  for (const base of [baseline, candidate]) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if(message.type()==='error') errors.push(message.text());});
    await page.route('**/__crt-resource-review', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>CRT resource regression</title>'}));
    await page.goto(new URL('__crt-resource-review?nosmaa', base).href);
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const {CrtGuestPass} = await import('/src/crt-guest/pass.ts');
      const {CrtGuestSettings} = await import('/src/crt-guest/settings.ts');
      const {loadCrtGuestLuts,disposeCrtGuestLuts} = await import('/src/crt-guest/luts.ts');
      const renderer = new THREE.WebGLRenderer({antialias:false});
      renderer.setSize(640,360);document.body.append(renderer.domElement);
      const settings = new CrtGuestSettings({storage:null,loadStored:false,persistChanges:false});
      settings.setEnabled(true);
      const luts = await loadCrtGuestLuts('/crt-guest/lut/');
      const pass = new CrtGuestPass(renderer,settings,{luts,respectDisableQuery:false});
      const source = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
      const target = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
      const scene = new THREE.Scene(), camera = new THREE.Camera();
      const material = new THREE.ShaderMaterial({
        uniforms:{tick:{value:0}},depthTest:false,depthWrite:false,toneMapped:false,
        vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:'varying vec2 uvp;uniform float tick;void main(){vec2 p=floor(gl_FragCoord.xy);float c=mod(p.x+p.y+tick,2.);gl_FragColor=vec4(uvp.x*2.1,uvp.y*1.3,c*.9+tick*.025,mod(p.x,3.)*.5);}',
      });
      const geometry = new THREE.PlaneGeometry(2,2);scene.add(new THREE.Mesh(geometry,material));
      const hash = async rt => {
        const pixels = rt.texture.type===THREE.HalfFloatType ? new Uint16Array(rt.width*rt.height*4) : new Uint8Array(rt.width*rt.height*4);
        renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,pixels);
        const digest=await crypto.subtle.digest('SHA-256',pixels);
        return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
      };
      const rows=[];
      const scenarios = [
        {variant:'advanced',width:127,height:73,scale:2,frames:4},
        {variant:'hd',width:127,height:73,scale:2,frames:4},
        {variant:'advanced',width:127,height:73,scale:2,frames:3},
        {variant:'hd',width:320,height:180,scale:1,frames:3},
        {variant:'advanced',width:320,height:180,scale:1,frames:3},
        {variant:'advanced',width:129,height:71,scale:2,frames:2,original:0.5},
        {variant:'hd',width:129,height:71,scale:2,frames:2,original:1},
      ];
      try {
        for(const [index,spec] of scenarios.entries()) {
          settings.setVariant(spec.variant);
          settings.setValue('oimage', spec.original ?? 0);
          source.setSize(spec.width,spec.height);target.setSize(spec.width*spec.scale,spec.height*spec.scale);
          pass.setResolution(spec.width,spec.height,target.width,target.height);
          for(let frame=0;frame<spec.frames;frame++) {
            material.uniforms.tick.value=index*7+frame;
            renderer.setRenderTarget(source);renderer.render(scene,camera);
            pass.render(renderer,target,source,1/60,false);
            const d=pass.diagnostics;
            if(!d.active||d.runtimeFailure)throw new Error(JSON.stringify(d));
            const hashes={output:await hash(target)};
            for(const name of ['encoded','stock0','stock','pre','linear','main','deconvergence']) {
              // Review-only access to actual render targets permits exact
              // RGBA16F bit comparisons, without quantizing to screenshots.
              const rt=pass.targets[name];if(rt)hashes[name]=await hash(rt);
            }
            for(const name of ['afterglow','average']) {
              if(name==='average'&&spec.variant==='hd')continue;
              const pair=pass.targets[name];if(pair)for(let i=0;i<2;i++)hashes[`${name}${i}`]=await hash(pair[i]);
            }
            rows.push({index,frame,...spec,hashes,draws:d.lastDrawCount,bytes:d.estimatedTargetBytes,targets:d.targets,textures:renderer.info.memory.textures,glError:renderer.getContext().getError()});
          }
        }
        settings.setEnabled(false);pass.releaseInactiveTargets();
        const inactive=pass.diagnostics;
        settings.setEnabled(true);pass.render(renderer,target,source,1/60,false);
        const enabled=pass.diagnostics;
        pass.dispose();
        renderer.setRenderTarget(null);
        const {UnityBloomPass} = await import('/src/unityBloom.ts');
        const {visualTreatmentSettings} = await import('/src/visual-treatment/settings.ts');
        const bloom = new UnityBloomPass();
        const bloomRows=[];
        renderer.info.autoReset=false;
        let clearCount=0;
        const actualClear=renderer.clear;
        renderer.clear=function(...args){clearCount++;return actualClear.apply(this,args);};
        for (const [i,spec] of [
          {width:127,height:73,intensity:1.2,downscale:2,maxIterations:4,highQuality:true},
          {width:127,height:73,intensity:1.2,downscale:2,maxIterations:4,highQuality:true},
          {width:128,height:73,intensity:.9,downscale:4,maxIterations:2,highQuality:false},
          {width:129,height:74,intensity:1.8,downscale:4,maxIterations:2,highQuality:false},
          {width:129,height:74,intensity:0,downscale:4,maxIterations:2,highQuality:false},
          {width:129,height:74,intensity:1.2,downscale:2,maxIterations:4,highQuality:true},
          {width:1,height:1,intensity:1.2,downscale:2,maxIterations:4,highQuality:true},
        ].entries()) {
          visualTreatmentSettings.patch({enabled:true,bloom:{...spec,tint:[.3,.6,.9]}});
          source.setSize(spec.width,spec.height);target.setSize(spec.width,spec.height);
          bloom.setSize(spec.width,spec.height);
          const allocated=bloom.downTargets[0];
          let releases=0;if(allocated)allocated.addEventListener('dispose',()=>releases++);
          bloom.setSize(spec.width,spec.height);
          material.uniforms.tick.value=i+1;
          renderer.setRenderTarget(source);renderer.render(scene,camera);
          renderer.info.reset();clearCount=0;
          bloom.render(renderer,target,source,1/60,false);
          bloomRows.push({i,hash:await hash(target),diagnostics:bloom.diagnostics,
            clears:clearCount,draws:renderer.info.render.calls,releases});
        }
        bloom.dispose();
        renderer.clear=actualClear;
        visualTreatmentSettings.patch({enabled:true,bloom:{intensity:1.2}});
        const {CoastPostRenderer}=await import('/src/coastpost.ts');
        const coast=new CoastPostRenderer(renderer,scene,camera,{enabled:true,crtSettings:settings});
        const loadUntil=performance.now()+10000;
        while(!coast.crt.diagnostics.lutsReady){
          if(performance.now()>loadUntil)throw new Error('Coast LUTs timed out');
          await new Promise(resolve=>setTimeout(resolve,10));
        }
        const coastRows=[];
        renderer.setSize(254,146);coast.setSize(254,146);
        for(const [i,spec] of [
          {mode:'native',crt:false}, {mode:'native',crt:true}, {mode:'native',crt:false},
          {mode:'fixed',crt:false}, {mode:'fixed',crt:true},
          {mode:'fixed',crt:false,flow:true}, {mode:'fixed',crt:true,flow:true},
          {mode:'native',crt:true,flow:true}, {mode:'native',crt:true},
        ].entries()) {
          settings.setEnabled(spec.crt);coast.setResolutionMode(spec.mode);
          if(spec.mode==='fixed') {coast.setInputSize(127,73);coast.setOutputSize(254,146);}
          renderer.setRenderTarget(null);renderer.info.reset();
          material.uniforms.tick.value=i+8;
          let facadeStable=null,facadeRebound=null;
          const overlay=ctx=>{
            const priorBound=ctx.renderer.render;
            facadeStable=priorBound===ctx.renderer.render;
            const original=renderer.render;
            renderer.render=function(...args){return original.apply(this,args);};
            facadeRebound=ctx.renderer.render!==priorBound;
            renderer.render=original;
            if(spec.flow)ctx.renderer.render(scene,camera);
          };
          const path=spec.flow?coast.renderGameFlow(1/60,overlay):coast.render(1/60,overlay);
          const pixels=new Uint8Array(254*146*4);
          const gl=renderer.getContext();gl.readPixels(0,0,254,146,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
          const digest=await crypto.subtle.digest('SHA-256',pixels);
          let bytes='';for(let offset=0;offset<pixels.length;offset+=8192)
            bytes+=String.fromCharCode(...pixels.subarray(offset,offset+8192));
          coastRows.push({...spec,i,path,draws:renderer.info.render.calls,facadeStable,facadeRebound,
            hash:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),pixels:btoa(bytes),
            glError:gl.getError()});
        }
        coast.dispose();
        return {rows,bloomRows,coastRows,inactiveBytes:inactive.estimatedTargetBytes,reenabled:enabled.active,disposedTextures:renderer.info.memory.textures};
      } finally {
        pass.dispose();source.dispose();target.dispose();geometry.dispose();material.dispose();disposeCrtGuestLuts(luts);renderer.dispose();
      }
    });
    assert.deepEqual(errors,[]);runs.push({base,...result,errors});await page.close();
  }
  const [before,after]=runs;
  assert.equal(after.rows.length,before.rows.length);
  assert.ok(new Set(before.rows.map(row=>row.hashes.output)).size>4,'fixture must exercise changing output, not an empty framebuffer');
  for(let i=0;i<before.rows.length;i++) {
    const a=before.rows[i],b=after.rows[i];
    assert.equal(a.glError,0);assert.equal(b.glError,0);
    const expected={...a.hashes};delete expected.encoded;
    assert.deepEqual(b.hashes,expected,`pixel mismatch at scenario ${a.index}, frame ${a.frame}`);
    assert.equal(b.draws,a.draws-1);
    const released=1;
    assert.equal(a.bytes-b.bytes,a.width*a.height*4*released);
    assert.equal(a.textures-b.textures,released);
    assert.equal(b.targets.encoded,undefined);
    assert.equal(!!b.targets['average-read'],b.variant==='advanced');
  }
  for(let i=0;i<before.bloomRows.length;i++) {
    const a=before.bloomRows[i],b=after.bloomRows[i];
    assert.equal(b.hash,a.hash,`bloom pixel mismatch ${i}`);
    assert.deepEqual(b.diagnostics,a.diagnostics);
    assert.equal(b.draws,a.draws);assert.equal(b.clears,0);
    assert.equal(a.clears,a.draws);assert.equal(b.releases,0,'unchanged bloom size must retain allocated targets');
  }
  for(let i=0;i<before.coastRows.length;i++) {
    const a=before.coastRows[i],b=after.coastRows[i];
    const expected=Buffer.from(a.pixels,'base64'),actual=Buffer.from(b.pixels,'base64');
    let maxDifference=0;
    for(let j=0;j<expected.length;j++) {
      const difference=Math.abs(expected[j]-actual[j]);maxDifference=Math.max(maxDifference,difference);
      assert.ok(difference<=(a.crt&&j%4!==3?1:0),`presentation pixel mismatch at case${i}channel${j}: ${difference}`);
    }
    b.maxDisplayDifference=maxDifference;delete a.pixels;delete b.pixels;
    assert.equal(b.path,'post');assert.equal(b.glError,0);assert.equal(b.facadeStable,true);assert.equal(b.facadeRebound,true,'underlying renderer method replacement must invalidate facade binding');
    assert.equal(b.draws,a.draws-(b.crt?2:b.mode==='native'?1:0));
  }
  assert.equal(after.inactiveBytes,0);assert.equal(after.reenabled,true);
  assert.equal(after.disposedTextures,before.disposedTextures,'graph disposal must release every owned texture');
  console.log(`PASS ${after.bloomRows.length} exact bloom and ${after.coastRows.length} full presentation comparisons (at most1RGB display LSB; alpha exact); ${after.rows.length} exact RGBA8/RGBA16F frame comparisons, both variants, history, variant switches, resize and disable/re-enable. Fused encoding/stock saves one draw and one RGBA8 texture in both variants.`);
} finally {
  await writeFile(`${output}/results.json`,JSON.stringify(runs,null,2));
  await browser.close();
}
