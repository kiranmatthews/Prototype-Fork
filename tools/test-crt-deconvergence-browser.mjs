// Browser proof for final-stage CRT deconvergence + decode + OutputPass: graph texels, alpha
// and canonical fallbacks remain exact; active final RGB differs by at most 1/255.
// Reference and deferred CRT instances use the same current module and settings.
// Optional second URL compares complete Coast presentation with an older checkout.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const candidate=process.argv[2],baseline=process.argv[3];
assert.ok(candidate,'Usage: node tools/test-crt-deconvergence-browser.mjs <candidate-url> [baseline-url]');
const output=process.env.CRT_DECONVERGENCE_REVIEW||'/private/tmp/crt-deconvergence-review';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={candidate,baseline};
const open=async base=>{
  const page=await browser.newPage({viewport:{width:387,height:213}}),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/__crt-output-review',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>CRT output fusion regression</title>'}));
  await page.goto(new URL('__crt-output-review?nosmaa',base).href);
  return {page,errors};
};
try{
  const {page,errors}=await open(candidate);
  report.fusion=await page.evaluate(async()=>{
    const assert=(condition,message)=>{if(!condition)throw new Error(message);};
    const sourceModule=await(await fetch('/src/crt-guest/pass.ts')).text();
    const threeUrl=sourceModule.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)?.[1];
    assert(threeUrl,'Cannot resolve shared Three module');
    const THREE=await import(threeUrl);
    const {CrtGuestPass}=await import('/src/crt-guest/pass.ts');
    const {CrtGuestOutputPass}=await import('/src/crt-guest/output.ts');
    const outputSource=await(await fetch('/src/crt-guest/output.ts')).text();
    const outputUrl=outputSource.match(/import\s*\{\s*OutputPass\s*\}\s*from\s*["']([^"']+)/)?.[1];
    assert(outputUrl,'Cannot resolve standard OutputPass');
    const {OutputPass}=await import(outputUrl);
    const {CrtGuestSettings}=await import('/src/crt-guest/settings.ts');
    const {loadCrtGuestLuts,disposeCrtGuestLuts}=await import('/src/crt-guest/luts.ts');
    const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);renderer.info.autoReset=false;document.body.append(renderer.domElement);
    const settings=new CrtGuestSettings({storage:null,loadStored:false,persistChanges:false});settings.setEnabled(true);
    const luts=await loadCrtGuestLuts('/crt-guest/lut/');
    const reference=new CrtGuestPass(renderer,settings,{luts,respectDisableQuery:false});
    const deferred=new CrtGuestPass(renderer,settings,{luts,respectDisableQuery:false,deferOutput:true,deferDeconvergence:true});
    const standard=new OutputPass(),fused=new CrtGuestOutputPass(()=>deferred.deferredOutput,()=>deferred.deferredDeconvergence);
    assert(deferred.needsSwap===false,'Deferred CRT must preserve the composer read buffer');
    assert(deferred.deferredDeconvergence===null,'Unrendered CRT must not expose a guest texture');
    const hdr=()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
    const source=hdr(),decoded=hdr(),unused=hdr(),expected=hdr(),actual=hdr();
    const scene=new THREE.Scene(),camera=new THREE.Camera(),geometry=new THREE.PlaneGeometry(2,2);
    const material=new THREE.ShaderMaterial({
      uniforms:{tick:{value:0}},depthTest:false,depthWrite:false,toneMapped:false,
      vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'varying vec2 uvp;uniform float tick;void main(){vec2 p=floor(gl_FragCoord.xy);float c=mod(p.x+p.y+tick,2.);gl_FragColor=vec4(uvp.x*3.9-.04,uvp.y*1.7,c*.97+tick*.007,mod(p.x+2.*p.y,9.)*.125);}',
    });scene.add(new THREE.Mesh(geometry,material));
    const hash=async pixels=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(x=>x.toString(16).padStart(2,'0')).join('');
    const read=rt=>{const pixels=new Uint16Array(rt.width*rt.height*4);renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,pixels);return pixels;};
    const screen=()=>{const gl=renderer.getContext(),pixels=new Uint8Array(renderer.domElement.width*renderer.domElement.height*4);gl.readPixels(0,0,renderer.domElement.width,renderer.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
    const mismatches=[],rows=[],graphs=[],fallbacks=[];
    const compare=async(a,b,label,policy='exact')=>{
      let differing=0,maxDifference=0,maxAbsoluteDifference=0,alphaDifferences=0;const samples=[];
      for(let i=0;i<a.length;i++)if(a[i]!==b[i]){
        differing++;maxDifference=Math.max(maxDifference,Math.abs(a[i]-b[i]));if(i%4===3)alphaDifferences++;
        const delta=a instanceof Uint16Array?Math.abs(THREE.DataUtils.fromHalfFloat(a[i])-THREE.DataUtils.fromHalfFloat(b[i])):Math.abs(a[i]-b[i])/255;
        maxAbsoluteDifference=Math.max(maxAbsoluteDifference,delta);if(samples.length<8)samples.push({i,a:a[i],b:b[i]});
      }
      const valid=alphaDifferences===0&&(policy==='hdr'||(policy==='display'?maxDifference<=1:differing===0));
      if(!valid)mismatches.push({label,policy,differing,maxDifference,maxAbsoluteDifference,alphaDifferences,samples});
      return {reference:await hash(a),candidate:await hash(b),policy,differing,maxDifference,maxAbsoluteDifference,alphaDifferences};
    };
    const toneMaps=['NoToneMapping','LinearToneMapping','ReinhardToneMapping','CineonToneMapping','ACESFilmicToneMapping','CustomToneMapping','AgXToneMapping','NeutralToneMapping'];
    const spaces=['SRGBColorSpace','LinearSRGBColorSpace'];
    for(const name of ['DisplayP3ColorSpace','LinearDisplayP3ColorSpace'])if(THREE[name]&&THREE.ColorManagement.spaces?.[THREE[name]])spaces.push(name);
    // r166 exposes registered spaces through getTransfer rather than .spaces.
    for(const name of ['DisplayP3ColorSpace','LinearDisplayP3ColorSpace'])if(THREE[name]&&!spaces.includes(name)){
      try{if(THREE.ColorManagement.getTransfer(THREE[name])!==undefined)spaces.push(name);}catch{}
    }
    const outputPair=async(label,readBuffer,allMappings=false)=>{
      const mappings=allMappings?toneMaps:['ACESFilmicToneMapping'];
      for(const toneName of mappings)for(const spaceName of allMappings?spaces:['SRGBColorSpace']){
        renderer.toneMapping=THREE[toneName];renderer.outputColorSpace=THREE[spaceName];renderer.toneMappingExposure=toneName==='NoToneMapping'?1:1.37;
        standard.renderToScreen=false;fused.renderToScreen=false;
        standard.render(renderer,expected,readBuffer,1/60,false);const hdrA=read(expected);
        fused.render(renderer,actual,source,1/60,false);const hdrB=read(actual);
        const canonical=label.startsWith('resample/')||label.startsWith('fallback/');
        const half=await compare(hdrA,hdrB,`${label}/${toneName}/${spaceName}/RGBA16F`,canonical?'exact':'hdr');
        standard.renderToScreen=true;fused.renderToScreen=true;
        standard.render(renderer,expected,readBuffer,1/60,false);const screenA=screen();
        fused.render(renderer,actual,source,1/60,false);const screenB=screen();
        const display=await compare(screenA,screenB,`${label}/${toneName}/${spaceName}/screen`,canonical?'exact':'display');
        const glError=renderer.getContext().getError();assert(glError===0,`GL error ${glError} in ${label}`);
        rows.push({label,toneName,spaceName,half,display,glError});
      }
    };
    try{
      const specs=[
        {variant:'advanced',width:127,height:73,scale:2,original:0,frames:2,allMappings:true},
        {variant:'hd',width:127,height:73,scale:2,original:0,frames:2,allMappings:true},
        {variant:'advanced',width:128,height:74,scale:1,original:.5,frames:2},
        {variant:'hd',width:128,height:74,scale:1,original:1,frames:2},
        {variant:'advanced',width:129,height:71,scale:3,original:.5,frames:2},
        {variant:'hd',width:129,height:71,scale:3,original:.5,frames:2},
        ...['advanced','hd'].flatMap(variant=>[
          {variant,width:127,height:73,scale:2,original:0,frames:3,allMappings:true,patch:{deconrr:15,deconrg:-15,deconrb:7.5,deconrry:-15,deconrgy:15,deconrby:7.5,addnoised:1}},
          {variant,width:129,height:71,scale:1,original:0,frames:3,patch:{addnoised:-1,noisetype:1,post_br:5,gamma_out:5}},
          {variant,width:130,height:72,scale:3,original:.5,frames:3,patch:{post_br:.25,gamma_out:1,halation:1,bloom:1}},
        ]),
      ];
      for(const [scenario,spec] of specs.entries()){
        renderer.setRenderTarget(null);renderer.setSize(spec.width*spec.scale,spec.height*spec.scale);
        source.setSize(spec.width,spec.height);
        for(const rt of [decoded,unused,expected,actual])rt.setSize(spec.width*spec.scale,spec.height*spec.scale);
        settings.setVariant(spec.variant);
        settings.resetCurrentDefaults();
        settings.setValue('oimage',spec.original);
        for(const [key,value] of Object.entries(spec.patch||{}))settings.setValue(key,value);
        for(const pass of [reference,deferred])pass.setResolution(source.width,source.height,decoded.width,decoded.height);
        assert(deferred.deferredDeconvergence===null,'Resolution/settings changes must invalidate a previously completed guest output');
        for(let frame=0;frame<spec.frames;frame++){
          material.uniforms.tick.value=scenario*7+frame;
          renderer.setRenderTarget(source);renderer.render(scene,camera);
          renderer.info.reset();reference.render(renderer,decoded,source,1/60,false);const referenceDraws=renderer.info.render.calls;
          renderer.info.reset();deferred.render(renderer,unused,source,1/60,false);const deferredDraws=renderer.info.render.calls;
          assert(reference.active&&deferred.active,JSON.stringify({reference:reference.diagnostics,deferred:deferred.diagnostics}));
          assert(deferred.deferredDeconvergence?.material===deferred.materialSets[spec.variant].deconvergence,'Deferred output must borrow this configured stage');
          assert(deferred.targets.deconvergence===null,'Deferred final stage must not allocate a deconvergence texture');
          assert(deferredDraws===referenceDraws-2,'Fusion must defer both deconvergence and decode');
          assert(reference.diagnostics.estimatedTargetBytes-deferred.diagnostics.estimatedTargetBytes===decoded.width*decoded.height*8,'Fusion must release exactly the full-output RGBA16F target');
          const guest=await compare(read(reference.targets.main),read(deferred.targets.main),`${scenario}/${frame}/guest-graph`);
          graphs.push({...spec,scenario,frame,referenceDraws,deferredDraws,guest});
          await outputPair(`${scenario}/${frame}`,decoded,spec.allMappings&&frame===0);
        }
        if(scenario===0||scenario===3){
          // Filtering a decoded half-float image is not equivalent to first
          // filtering guest colour and then decoding it. Standalone consumers
          // may resize after CRT; their guarded decode path must stay exact.
          for(const factor of [.7,1.25]){
            const width=Math.max(1,Math.round(decoded.width*factor)+1),height=Math.max(1,Math.round(decoded.height*factor)-1);
            renderer.setRenderTarget(null);renderer.setSize(width,height);expected.setSize(width,height);actual.setSize(width,height);
            await outputPair(`resample/${scenario}/${width}x${height}`,decoded);
          }
        }
      }
      // Inactive deferred CRT performs no swap/copy. Its consumer must use the
      // existing linear source, including fixed-mode upscale and source alpha.
      const checkFallback=async(label)=>{
        assert(deferred.deferredDeconvergence===null,`${label}: stale guest texture was exposed before rendering`);
        renderer.info.reset();deferred.render(renderer,unused,source,1/60,false);
        assert(deferred.deferredDeconvergence===null,`${label}: inactive graph exposed a guest texture`);
        const draws=renderer.info.render.calls;
        assert(draws===0,`${label}: deferred bypass should preserve the composer input without a draw`);
        await outputPair(`fallback/${label}`,source);
        fallbacks.push({label,draws,diagnostics:deferred.diagnostics});
      };
      settings.setEnabled(false);await checkFallback('disabled');
      settings.setEnabled(true);deferred.render(renderer,unused,source,1/60,false);assert(deferred.deferredDeconvergence,'Re-enable failed');
      deferred.setLuts(null);await checkFallback('loading');
      deferred.setLuts(luts);deferred.render(renderer,unused,source,1/60,false);
      deferred.setForcedDisabled(true);await checkFallback('forced-disabled');
      deferred.setForcedDisabled(false);deferred.render(renderer,unused,source,1/60,false);
      deferred.enabled=false;await checkFallback('composer-disabled');
      deferred.enabled=true;deferred.render(renderer,unused,source,1/60,false);
      const originalGraph=deferred.executeGraph;
      deferred.executeGraph=()=>{throw new Error('synthetic CRT graph failure');};
      deferred.render(renderer,unused,source,1/60,false);deferred.executeGraph=originalGraph;
      assert(deferred.diagnostics.runtimeFailure?.includes('synthetic CRT graph failure'),'Expected graph failure was not recorded');
      await checkFallback('runtime-failure');
      deferred.retryAfterFailure();deferred.render(renderer,unused,source,1/60,false);assert(deferred.deferredDeconvergence,'Explicit graph retry failed');
      let borrowedDisposed=0;const borrowed=deferred.targets.main;
      borrowed.addEventListener('dispose',()=>borrowedDisposed++);
      const beforeOutputDispose=read(borrowed),memoryBefore=renderer.info.memory.textures;
      fused.dispose();assert(borrowedDisposed===0,'Output pass must not dispose its borrowed graph target');
      await compare(beforeOutputDispose,read(borrowed),'borrowed texture survives OutputPass disposal');
      assert(renderer.info.memory.textures===memoryBefore,'Output pass changed texture ownership');
      deferred.dispose();deferred.dispose();assert(borrowedDisposed===1,'CRT owns and disposes the borrowed target once');
      assert(deferred.deferredDeconvergence===null,'Disposed CRT must not expose guest output');
      reference.dispose();standard.dispose();
      for(const rt of [source,decoded,unused,expected,actual])rt.dispose();disposeCrtGuestLuts(luts);geometry.dispose();material.dispose();
      return {graphs,rows,fallbacks,mismatches,spaces,toneMaps,borrowedDisposed,texturesAfterDispose:renderer.info.memory.textures};
    }finally{
      renderer.setRenderTarget(null);reference.dispose();deferred.dispose();standard.dispose();fused.dispose();
      for(const rt of [source,decoded,unused,expected,actual])rt.dispose();geometry.dispose();material.dispose();disposeCrtGuestLuts(luts);renderer.dispose();
    }
  });
  report.errors=errors;assert.deepEqual(errors,[]);await page.close();
  if(baseline){
    report.presentation=[];
    for(const base of [baseline,candidate]){
      const {page,errors}=await open(base);
      const result=await page.evaluate(async()=>{
        const source=await(await fetch('/src/coastpost.ts')).text();
        const threeUrl=source.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)?.[1];
        const THREE=await import(threeUrl);
        const {CoastPostRenderer}=await import('/src/coastpost.ts');
        const {CrtGuestSettings}=await import('/src/crt-guest/settings.ts');
        const settings=new CrtGuestSettings({storage:null,loadStored:false,persistChanges:false});settings.setEnabled(true);
        const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.info.autoReset=false;renderer.setSize(254,146);
        const scene=new THREE.Scene(),camera=new THREE.Camera(),geometry=new THREE.PlaneGeometry(2,2);
        const material=new THREE.ShaderMaterial({uniforms:{tick:{value:0}},depthTest:false,depthWrite:false,toneMapped:false,
          vertexShader:'varying vec2 uvp;void main(){uvp=uv;gl_Position=vec4(position.xy,0.,1.);}',
          fragmentShader:'varying vec2 uvp;uniform float tick;void main(){gl_FragColor=vec4(uvp.x*2.1,uvp.y*1.3,mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y)+tick,2.),1.);}',
        });scene.add(new THREE.Mesh(geometry,material));
        const coast=new CoastPostRenderer(renderer,scene,camera,{enabled:true,crtSettings:settings});
        const until=performance.now()+15000;
        while(!coast.crt.diagnostics.lutsReady){if(performance.now()>until)throw new Error('Coast LUT timeout');await new Promise(r=>setTimeout(r,10));}
        const rows=[];
        try{
          for(const [i,spec] of [
            {mode:'native',crt:true},{mode:'native',crt:false},{mode:'native',crt:true,variant:'hd'},
            {mode:'fixed',crt:true},{mode:'fixed',crt:false},{mode:'fixed',crt:true,variant:'hd'},
            {mode:'fixed',crt:true,flow:true},{mode:'fixed',crt:false,flow:true},{mode:'fixed',crt:true,flow:true,variant:'hd'},
            {mode:'native',crt:true,flow:true},{mode:'native',crt:false,flow:true},{mode:'native',crt:true},
            {mode:'fixed',crt:true,fail:true,inputWidth:128,inputHeight:74},{mode:'fixed',crt:true,heldFailure:true,inputWidth:128,inputHeight:74},{mode:'fixed',crt:true,retry:true,inputWidth:128,inputHeight:74},
            {mode:'fixed',crt:true,loading:true,inputWidth:128,inputHeight:74},{mode:'fixed',crt:true,restored:true,inputWidth:128,inputHeight:74},
          ].entries()){
            settings.setEnabled(spec.crt);settings.setVariant(spec.variant||'advanced');coast.setResolutionMode(spec.mode);
            if(spec.mode==='fixed'){coast.setInputSize(spec.inputWidth||127,spec.inputHeight||73);coast.setOutputSize(254,146);}else coast.setSize(254,146);
            if(spec.retry)coast.crt.retryAfterFailure();
            const savedGraph=coast.crt.executeGraph,savedLuts=coast.crt.luts;
            if(spec.fail)coast.crt.executeGraph=()=>{throw new Error('synthetic Coast CRT failure');};
            if(spec.loading)coast.crt.setLuts(null);
            material.uniforms.tick.value=i+1;renderer.setRenderTarget(null);renderer.info.reset();
            let path;
            try{path=spec.flow?coast.renderGameFlow(1/60,ctx=>ctx.renderer.render(scene,camera)):coast.render(1/60);}
            finally{coast.crt.executeGraph=savedGraph;}
            if(path==='direct')renderer.render(scene,camera);
            const pixels=new Uint8Array(254*146*4),gl=renderer.getContext();gl.readPixels(0,0,254,146,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
            const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))].map(x=>x.toString(16).padStart(2,'0')).join('');
            let raw='';for(let start=0;start<pixels.length;start+=8192)raw+=String.fromCharCode(...pixels.subarray(start,start+8192));
            const diagnostics=coast.crt.diagnostics;
            if((spec.fail||spec.heldFailure)&&!diagnostics.runtimeFailure?.includes('synthetic Coast CRT failure'))throw new Error('Coast failure was not retained');
            if(spec.retry&&!diagnostics.active)throw new Error('Coast retry failed');
            if(spec.loading&&diagnostics.active)throw new Error('Loading Coast CRT unexpectedly active');
            rows.push({...spec,i,path,hash,pixels:btoa(raw),draws:renderer.info.render.calls,glError:gl.getError(),crtActive:diagnostics.active,runtimeFailure:diagnostics.runtimeFailure});
            if(spec.loading)coast.crt.setLuts(savedLuts);
          }
          return {rows};
        }finally{coast.dispose();geometry.dispose();material.dispose();renderer.dispose();}
      });
      assert.deepEqual(errors,[]);report.presentation.push({base,...result,errors});await page.close();
    }
  }
  assert.equal(report.fusion.mismatches.length,0,`Fused CRT output differs: ${JSON.stringify(report.fusion.mismatches.slice(0,6).map(({label,differing,maxDifference})=>({label,differing,maxDifference})))}`);
  assert.equal(report.fusion.texturesAfterDispose,0,'CRT output test must release all GPU textures');
  if(report.presentation)for(let i=0;i<report.presentation[0].rows.length;i++){
    const before=report.presentation[0].rows[i],after=report.presentation[1].rows[i];
    assert.equal(before.glError,0);assert.equal(after.glError,0);assert.equal(after.path,before.path);
    const left=Buffer.from(before.pixels,'base64'),right=Buffer.from(after.pixels,'base64');
    let differing=0,maxDifference=0,alphaDifferences=0;
    for(let channel=0;channel<left.length;channel++)if(left[channel]!==right[channel]){differing++;maxDifference=Math.max(maxDifference,Math.abs(left[channel]-right[channel]));if(channel%4===3)alphaDifferences++;}
    delete before.pixels;delete after.pixels;after.difference={differing,maxDifference,alphaDifferences};
    assert.equal(alphaDifferences,0,`Coast alpha changed in ${i}`);
    const tolerance=before.crt&&!before.heldFailure&&!before.loading?1:0;
    assert.ok(maxDifference<=tolerance,`Coast display error exceeds bound in ${i}: ${JSON.stringify(after.difference)}`);
    assert.ok(after.draws<=before.draws,'Fusion increased presentation draws');
  }
  console.log(`PASS ${report.fusion.graphs.length} exact upstream CRT graph frames; ${report.fusion.rows.length} output comparisons with active RGB <=1/255 and exact alpha/canonical fallback; ${report.fusion.toneMaps.length} tone maps, ${report.fusion.spaces.length} colour spaces, ${report.fusion.fallbacks.length} fallback paths, borrowed texture disposal${report.presentation?`, ${report.presentation[0].rows.length} native/fixed/GameFlow presentation comparisons`:''}.`);
}finally{await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));await browser.close();}
