// Real WebGL regression for reusing the ocean opaque pass as primary colour/depth.
// For reused primary frames the reference deliberately refreshes this frame's
// full-scene shadows before legacy renderPasses + main render, correcting its
// previous-frame shadow lag. Fallback frames compare the unmodified legacy path.
// Usage: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/test-ocean-primary-browser.mjs <reference-vite-url> <candidate-vite-url>
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [baseline, candidate] = process.argv.slice(2);
assert.ok(baseline && candidate, 'Supply reference and candidate Vite URLs.');
const output = process.env.OCEAN_PRIMARY_OUTPUT || '/private/tmp/ocean-primary-review';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, channel:'chrome'});
const runs = [];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  for (const [index, base] of [baseline, candidate].entries()) {
    const page = await browser.newPage({viewport:{width:508,height:292}});
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => {if (message.type()==='error') errors.push(message.text());});
    await page.route('**/__ocean-primary-review', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Ocean primary regression</title>'}));
    await page.goto(new URL('__ocean-primary-review', base).href);
    const result = await page.evaluate(async optimized => {
      const assert = (condition, message) => {if (!condition) throw new Error(message);};
      // Use the same Three module as the runtime: reflection cameras use instanceof.
      const oceanSource = await (await fetch('/src/unityOcean.ts')).text();
      const threeUrl = oceanSource.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)?.[1];
      assert(threeUrl, 'Cannot identify transformed Three import');
      const THREE = await import(threeUrl);
      const {UnityOcean} = await import('/src/unityOcean.ts');
      const {UnitySmaaPass} = await import('/src/unitySmaa.ts');
      const {UnityBloomPass} = await import('/src/unityBloom.ts');
      const {UnityPostPass} = await import('/src/unityPost.ts');
      const {visualTreatmentSettings} = await import('/src/visual-treatment/settings.ts');
      const {CrtGuestPass} = await import('/src/crt-guest/pass.ts');
      const {CrtGuestSettings} = await import('/src/crt-guest/settings.ts');
      const {loadCrtGuestLuts,disposeCrtGuestLuts} = await import('/src/crt-guest/luts.ts');
      const coastSource=await (await fetch('/src/coastpost.ts')).text();
      const outputUrl=coastSource.match(/import\s*\{\s*OutputPass\s*\}\s*from\s*["']([^"']+)/)?.[1];
      assert(outputUrl,'Cannot identify transformed OutputPass import');
      const {OutputPass} = await import(outputUrl);
      const renderer = new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
      renderer.setPixelRatio(1);renderer.setSize(254,146);
      renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.info.autoReset=false;document.body.append(renderer.domElement);
      const scene = new THREE.Scene();scene.background=new THREE.Color(0x87a8c0);
      scene.fog=new THREE.Fog(0x87a8c0,25,100);
      const ambient = new THREE.HemisphereLight(0xb3deff,0x725134,2);
      const sun = new THREE.DirectionalLight(0xffe2b0,3);
      sun.position.set(-3,9,4);sun.castShadow=true;
      sun.shadow.mapSize.set(128,128);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;
      sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=.1;sun.shadow.camera.far=40;
      scene.add(ambient,sun,sun.target);
      const ownedGeometry=[],ownedMaterials=[];
      const material = opts => {const value=new THREE.MeshStandardMaterial(opts);ownedMaterials.push(value);return value;};
      const solid=material({color:0xcf782f,roughness:.8});
      const sand=material({color:0xd9c190,roughness:1});
      const glass=material({color:0xff3366,roughness:.2,transparent:true,opacity:.45,depthWrite:false});
      const blueGlass=material({color:0x3399ff,transparent:true,opacity:.65,depthWrite:false});
      const faded=material({color:0x55ffaa,opacity:.65});
      const makeBox=(name,size,position,mat=solid,parent=scene)=>{
        const geometry=new THREE.BoxGeometry(...size);ownedGeometry.push(geometry);
        const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.position.set(...position);
        mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
      };
      makeBox('underwater floor',[24,.4,34],[6,-1.2,-4],sand);
      makeBox('shore',[5,1,34],[-3,-.5,-4],sand);
      const moving=makeBox('moving shadow caster',[1.1,3,1.1],[1,1,-2]);
      const nested=makeBox('opaque parent with transparent child',[1.2,1,1.2],[3,.1,-5]);
      makeBox('transparent child',[1.2,1.2,.2],[0,1.2,.3],glass,nested);
      const transparentParent=makeBox('transparent parent with opaque child',[1,1,1],[5,.5,-2],blueGlass);
      const ambiguousChild=makeBox('opaque child of transparent parent',[.6,.6,.6],[.1,1,0],solid,transparentParent);
      const mixed=makeBox('mixed material array',[1.3,2,1.3],[2,1,-7],[solid,glass,solid,glass,solid,glass]);
      makeBox('opacity without transparent',[1,1.2,1],[6,.7,-7],faded);
      const backdrop=makeBox('oceanOpaqueBackdrop transparent',[2.3,1,.6],[4,.2,-10],blueGlass);
      backdrop.userData.oceanOpaqueBackdrop=true;
      const hidden=makeBox('hidden parent',[1,1,1],[0,3,1]);hidden.visible=false;
      makeBox('hidden descendant',[1,1,1],[0,1,0],glass,hidden);
      // Many cheap opaque draws make the eliminated traversal measurable.
      for(let i=0;i<16;i++)makeBox(`opaque post ${i}`,[.25,1+i%3*.25,.25],[i%8-3,0,-12-Math.floor(i/8)*2]);
      const ocean = new UnityOcean({
        seaLevel:0,shoreDirX:1,shoreDirZ:0,quality:'full',oceanWidth:24,lateralSegments:24,
        shore:[{x:0,z:12,sx:1,sz:0,beachSlope:.2,bedSlope:.05},{x:0,z:-25,sx:1,sz:0,beachSlope:.2,bedSlope:.05}],
        course:[{x:0,z:12},{x:0,z:-25}],terrainHeight:()=>-1,
      });
      scene.add(ocean.group);
      assert(!optimized || typeof ocean.renderPrimary==='function','Candidate has no renderPrimary API');
      // Occlusion queries are asynchronous and have their own focused test.
      // Disable their callbacks here so every deterministic case exercises reuse.
      ocean.ribbon.onBeforeRender=()=>{};ocean.ribbon.onAfterRender=()=>{};
      const deadline=performance.now()+15000;
      while(!ocean.group.visible){assert(performance.now()<deadline,'Ocean textures failed or timed out');await new Promise(r=>setTimeout(r,10));}
      const perspective=new THREE.PerspectiveCamera(55,127/73,.15,120);
      const ortho=new THREE.OrthographicCamera(-12,12,12*73/127,-12*73/127,.15,120);
      const hdr=(width,height,options={})=>new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,depthBuffer:true,...options});
      const target=hdr(127,73),warmTarget=hdr(127,73),sentinel=hdr(3,5),postA=hdr(127,73),postB=hdr(127,73);
      const depthTarget=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,depthBuffer:false});
      const depthGeometry=new THREE.PlaneGeometry(2,2),depthScene=new THREE.Scene(),depthCamera=new THREE.Camera();
      const depthMaterial=new THREE.RawShaderMaterial({
        glslVersion:THREE.GLSL3,uniforms:{source:{value:null}},depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending,
        vertexShader:'precision highp float;in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:'precision highp float;uniform highp sampler2D source;out vec4 color;void main(){color=vec4(texelFetch(source,ivec2(gl_FragCoord.xy),0).r,0.,0.,1.);}',
      });
      depthScene.add(new THREE.Mesh(depthGeometry,depthMaterial));
      const settings=new CrtGuestSettings({storage:null,loadStored:false,persistChanges:false});settings.setEnabled(true);
      const luts=await loadCrtGuestLuts('/crt-guest/lut/');
      const crt=new CrtGuestPass(renderer,settings,{luts,respectDisableQuery:false});
      const smaa=new UnitySmaaPass(),bloom=new UnityBloomPass(),post=new UnityPostPass(),display=new OutputPass();
      const lookupDeadline=performance.now()+15000;
      while(!smaa.areaTexture.image?.width || !smaa.searchTexture.image?.width){assert(performance.now()<lookupDeadline,'SMAA textures timed out');await new Promise(r=>setTimeout(r,10));}
      visualTreatmentSettings.patch({enabled:true,bloom:{intensity:1.2}});
      const encode = bytes => {
        let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
        return btoa(binary);
      };
      const read = rt => {
        const pixels=rt.texture.type===THREE.HalfFloatType?new Uint16Array(rt.width*rt.height*4):rt.texture.type===THREE.FloatType?new Float32Array(rt.width*rt.height*4):new Uint8Array(rt.width*rt.height*4);
        renderer.readRenderTargetPixels(rt,0,0,rt.width,rt.height,pixels);
        return encode(new Uint8Array(pixels.buffer));
      };
      const objectState=()=>{
        const rows=[];scene.traverse(object=>rows.push([object.uuid,object.visible,object.layers.mask,
          ...(object.material?(Array.isArray(object.material)?object.material:[object.material]).map(m=>[m.uuid,m.visible,m.colorWrite,m.depthWrite]):[])]));
        return JSON.stringify(rows);
      };
      const rendererState=()=>JSON.stringify({
        target:renderer.getRenderTarget()?.texture.uuid,face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),
        viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),
        scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,autoColor:renderer.autoClearColor,autoDepth:renderer.autoClearDepth,
        xr:renderer.xr.enabled,shadows:renderer.shadowMap.enabled,shadowAuto:renderer.shadowMap.autoUpdate,
        fog:scene.fog?.color.getHex(),background:scene.background?.getHex(),override:scene.overrideMaterial?.uuid,
      });
      const submissions={};scene.traverse(object=>{if(object.isMesh && !ocean.group.children.includes(object))object.onBeforeRender=(_r,_s,c)=>{if(c===perspective||c===ortho)submissions[object.name]=(submissions[object.name]||0)+1;};});
      const rows=[],rejections=[],failureRecovery=[];
      const specs=[
        {width:127,height:73,scale:1,camera:'perspective',frames:3},
        {width:254,height:146,scale:1,camera:'perspective',frames:3},
        {width:127,height:73,scale:1,camera:'orthographic',frames:2},
        {width:127,height:73,scale:.5,camera:'perspective',frames:2},
        {width:254,height:146,scale:.5,camera:'perspective',frames:2},
        {width:127,height:73,scale:1,camera:'perspective',frames:2,ambiguous:'mixed-material'},
        {width:127,height:73,scale:1,camera:'perspective',frames:2,ambiguous:'opaque-child'},
        {width:127,height:73,scale:1,camera:'perspective',frames:1,ambiguous:'opaque-opacity'},
      ];
      let disposedTargets=0;
      try {
        for(const [scenario,spec] of specs.entries()){
          const {width,height}=spec,camera=spec.camera==='perspective'?perspective:ortho;
          mixed.material=spec.ambiguous==='mixed-material'?[solid,glass,solid,glass,solid,glass]:[solid,solid,solid,solid,solid,solid];
          ambiguousChild.visible=spec.ambiguous==='opaque-child';
          faded.opacity=spec.ambiguous==='opaque-opacity'?.65:1;
          renderer.setSize(width*2,height*2);ocean.setPreCrtRenderSize(width,height);ocean.prepassScale=spec.scale;
          for(const rt of [target,warmTarget,postA,postB])rt.setSize(width,height);
          for(const pass of [smaa,bloom,post])pass.setSize(width,height);
          crt.setResolution(width,height,width*2,height*2);
          for(let frame=0;frame<spec.frames;frame++){
            const glStages={},checkGl=phase=>{glStages[phase]=renderer.getContext().getError();};
            const tick=scenario*3+frame;
            moving.position.x=.2+frame*1.3;moving.rotation.y=tick*.3;
            mixed.rotation.y=-tick*.11;
            camera.position.set(12+frame*.25,8+frame*.13,14);camera.lookAt(2,0,-5);camera.updateMatrixWorld(true);
            sun.position.x=-4+frame*2;sun.target.position.set(3,0,-3);sun.target.updateMatrixWorld(true);
            ocean.update(.13,camera);
            const expectedReuse=spec.scale===1&&!spec.ambiguous;
            renderer.shadowMap.autoUpdate=true;
            // The original reference refreshed a pending shadow request while
            // transparent casters were hidden. That separate bug is fixed by
            // the candidate; ordinary fallback frames use autoUpdate instead.
            renderer.shadowMap.needsUpdate=expectedReuse;
            // In the reference, the main pass normally prepares the same current
            // shadows one scene render too late for refraction. Prepare them now.
            if(!optimized&&expectedReuse){
              // Water casts no shadows. Omit its colour-only draws from this
              // oracle-only refresh so it cannot sample freshly resized ocean
              // render textures before their first framebuffer allocation.
              ocean.group.visible=false;
              try{renderer.setRenderTarget(warmTarget);renderer.render(scene,camera);}
              finally{ocean.group.visible=true;}
            }
            checkGl('reference-shadow-refresh');
            renderer.setRenderTarget(sentinel);renderer.setViewport(1,2,2,3);renderer.setScissor(0,1,2,3);renderer.setScissorTest(false);
            const beforeObjects=objectState(),beforeRenderer=rendererState();
            for(const name of Object.keys(submissions))delete submissions[name];renderer.info.reset();
            let reused=false;
            if(optimized)reused=ocean.renderPrimary(renderer,scene,camera,target);
            assert(!optimized||reused===expectedReuse,`Unexpected primary support in ${scenario}/${frame}: ${reused}`);
            if(reused){
              assert(objectState()===beforeObjects,'Primary changed scene drawable state');
              assert(rendererState()===beforeRenderer,'Primary did not restore renderer state');
            }else{
              ocean.renderPasses(renderer,scene,camera);renderer.setRenderTarget(target);renderer.render(scene,camera);
            }
            const draws=renderer.info.render.calls,triangles=renderer.info.render.triangles;
            checkGl('primary');
            assert(submissions['transparent child']>0,'Transparent child under opaque parent was omitted');
            if(ambiguousChild.visible)assert(submissions['opaque child of transparent parent']>0,'Opaque child under transparent parent was omitted');
            assert(!submissions['hidden descendant'],'Invisible tree was traversed');
            const pixels=read(target),prepass=read(ocean.prepassTarget),reflection=read(ocean.reflectionTarget),shadow=read(sun.shadow.map);
            depthTarget.setSize(ocean.prepassTarget.width,ocean.prepassTarget.height);
            depthMaterial.uniforms.source.value=ocean.prepassTarget.depthTexture;
            renderer.setRenderTarget(depthTarget);renderer.render(depthScene,depthCamera);
            const depth=read(depthTarget);depthMaterial.uniforms.source.value=null;
            checkGl('read-primary');
            // The unchanged production post stages amplify any small primary
            // mismatch and verify that the copied colour remains linear HDR.
            renderer.setViewport(0,0,width*2,height*2);renderer.setScissorTest(false);
            smaa.render(renderer,postA,target,1/60,false);checkGl('smaa');bloom.render(renderer,postB,postA,1/60,false);checkGl('bloom');
            post.render(renderer,postA,postB,1/60,false);
            checkGl('grade');
            const crtTarget=hdr(width*2,height*2,{depthBuffer:false});
            crt.render(renderer,crtTarget,postA,1/60,false);checkGl('crt');display.renderToScreen=true;display.render(renderer,postB,crtTarget);checkGl('output');
            const presented=new Uint8Array(width*2*height*2*4),gl=renderer.getContext();
            gl.readPixels(0,0,width*2,height*2,gl.RGBA,gl.UNSIGNED_BYTE,presented);crtTarget.dispose();
            rows.push({...spec,scenario,frame,reused,draws,triangles,submissions:{...submissions},pixels,prepass,reflection,shadow,depth,presented:encode(presented),glStages,glError:gl.getError()});
          }
        }
        if(optimized){
          ocean.prepassScale=1;ocean.setPreCrtRenderSize(127,73);renderer.setSize(254,146);target.setSize(127,73);
          const trials=[
            ['screen',null],['byte colour',new THREE.WebGLRenderTarget(127,73)],
            ['multisample',hdr(127,73,{samples:4})],['no depth',hdr(127,73,{depthBuffer:false})],
            ['wrong size',hdr(128,73)],['partial viewport',hdr(127,73)],
          ];
          trials.at(-1)[1].viewport.set(1,0,126,73);
          trials.push(['generic camera',hdr(127,73),new THREE.Camera()]);
          const shortDepth=hdr(127,73);shortDepth.depthTexture=new THREE.DepthTexture(127,73,THREE.UnsignedShortType);
          trials.push(['non-24-bit depth',shortDepth]);
          for(const [name,rt,camera=perspective] of trials){
            renderer.setRenderTarget(sentinel);const before=rendererState(),objects=objectState();renderer.info.reset();
            const accepted=ocean.renderPrimary(renderer,scene,camera,rt);
            assert(!accepted,`Unsupported ${name} accepted`);assert(rendererState()===before&&objectState()===objects,`Rejected ${name} changed state`);
            rejections.push({name,accepted,draws:renderer.info.render.calls});rt?.dispose();
          }
          faded.opacity=1;ambiguousChild.visible=false;mixed.material=[solid,solid,solid,solid,solid,solid];
          for(const object of [moving,backdrop]){
            renderer.setRenderTarget(sentinel);renderer.shadowMap.needsUpdate=true;
            const before=rendererState(),objects=objectState(),original=object.onBeforeRender;
            let message='';
            object.onBeforeRender=(_r,_s,c)=>{if(c===perspective)throw new Error(`synthetic ${object.name} failure`);};
            try{ocean.renderPrimary(renderer,scene,perspective,target);}
            catch(error){message=String(error);}
            finally{object.onBeforeRender=original;}
            assert(message.includes(`synthetic ${object.name} failure`),'Expected synthetic primary failure');
            assert(rendererState()===before&&objectState()===objects,'Failed primary did not restore scene and renderer state');
            assert(ocean.renderPrimary(renderer,scene,perspective,target),'Primary failed to recover after draw exception');
            assert(rendererState()===before&&objectState()===objects,'Recovered primary changed scene and renderer state');
            assert(renderer.getContext().getError()===0,'Failed primary left a WebGL error');
            failureRecovery.push(object.name);
          }
        }
        for(const rt of [ocean.prepassTarget,ocean.reflectionTarget])rt.addEventListener('dispose',()=>disposedTargets++);
        const texturesBeforeDispose=renderer.info.memory.textures;
        ocean.dispose();ocean.dispose();
        assert(disposedTargets===2,'Ocean targets must be disposed exactly once');
        return {rows,rejections,failureRecovery,disposedTargets,texturesBeforeDispose,texturesAfterDispose:renderer.info.memory.textures};
      } finally {
        renderer.setRenderTarget(null);ocean.dispose();smaa.dispose();bloom.dispose();post.dispose();crt.dispose();display.dispose();disposeCrtGuestLuts(luts);
        for(const rt of [target,warmTarget,sentinel,postA,postB,depthTarget])rt.dispose();depthGeometry.dispose();depthMaterial.dispose();
        sun.shadow.dispose();for(const geometry of ownedGeometry)geometry.dispose();for(const mat of ownedMaterials)mat.dispose();renderer.dispose();
      }
    }, index===1);
    assert.deepEqual(errors,[]);runs.push({base,...result,errors});await page.close();
  }
  const [reference,optimized]=runs;
  assert.equal(optimized.rows.length,reference.rows.length);
  assert.ok(new Set(reference.rows.map(row=>sha(Buffer.from(row.pixels,'base64')))).size>6,'Moving fixture must change visible pixels');
  assert.ok(new Set(reference.rows.map(row=>sha(Buffer.from(row.shadow,'base64')))).size>3,'Moving fixture must change shadow maps');
  const mismatches=[];
  for(let i=0;i<reference.rows.length;i++){
    const a=reference.rows[i],b=optimized.rows[i];assert.equal(a.glError,0);assert.equal(b.glError,0);
    assert.ok(Object.values(a.glStages).every(n=>n===0),`Reference GL error ${i}: ${JSON.stringify(a.glStages)}`);
    assert.ok(Object.values(b.glStages).every(n=>n===0),`Candidate GL error ${i}: ${JSON.stringify(b.glStages)}`);
    for(const channel of ['pixels','prepass','reflection','shadow','depth','presented']){
      const left=Buffer.from(a[channel],'base64'),right=Buffer.from(b[channel],'base64');
      if(!left.equals(right)){
        let differing=0,maxDifference=0;
        if(channel==='pixels'||channel==='prepass'||channel==='reflection'){
          const x=new Uint16Array(left.buffer,left.byteOffset,left.byteLength/2),y=new Uint16Array(right.buffer,right.byteOffset,right.byteLength/2);
          for(let p=0;p<x.length;p++)if(x[p]!==y[p]){differing++;maxDifference=Math.max(maxDifference,Math.abs(x[p]-y[p]));}
        }else for(let p=0;p<left.length;p++)if(left[p]!==right[p]){differing++;maxDifference=Math.max(maxDifference,Math.abs(left[p]-right[p]));}
        mismatches.push({i,scenario:a.scenario,frame:a.frame,channel,differing,maxDifference});
        await writeFile(`${output}/${i}-${channel}-reference.bin`,left);await writeFile(`${output}/${i}-${channel}-optimized.bin`,right);
      }
      a[`${channel}Hash`]=sha(left);b[`${channel}Hash`]=sha(right);delete a[channel];delete b[channel];
    }
    if(b.reused){
      assert.equal(b.submissions['moving shadow caster'],1,'Opaque primary mesh must draw once');
      assert.equal(a.submissions['moving shadow caster'],2,'Reference fixture must draw opaque mesh twice');
      assert.equal(b.submissions['transparent child'],1,'Nested transparent child must draw once');
    }
  }
  await writeFile(`${output}/mismatches.json`,JSON.stringify(mismatches,null,2));
  assert.deepEqual(mismatches,[],'Ocean colour/depth reuse differs from current-shadow reference');
  console.log(`PASS ${optimized.rows.length} exact ocean RGBA16F and full post-output comparisons; moving shadows, nested transparents, mixed material arrays, backdrop, perspective/orthographic, odd sizes, reduced-prepass fallback, ${optimized.rejections.length} unsupported-target cases, ${optimized.failureRecovery.length} draw-failure recoveries, and disposal.`);
} finally {
  await writeFile(`${output}/results.json`,JSON.stringify(runs,null,2));await browser.close();
}
