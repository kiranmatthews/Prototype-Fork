// Compare the real CRT graph against an unmodified Vite checkout. No game UI,
// timers or random scene data participate in this pixel/resource regression.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseline = process.argv[2], candidate = process.argv[3];
assert.ok(baseline && candidate, 'Usage: node tools/test-crt-resource-browser.mjs <baseline-url> <candidate-url>');
const output = process.env.CRT_RESOURCE_OUTPUT || '/private/tmp/crt-resource-review';
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
    await page.goto(new URL('__crt-resource-review', base).href);
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
      ];
      try {
        for(const [index,spec] of scenarios.entries()) {
          settings.setVariant(spec.variant);
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
        return {rows,inactiveBytes:inactive.estimatedTargetBytes,reenabled:enabled.active,disposedTextures:renderer.info.memory.textures};
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
    assert.equal(a.hashes.stock0,a.hashes.stock,'original stock stages must be identical');
    const expected={...a.hashes};delete expected.stock0;
    assert.deepEqual(b.hashes,expected,`pixel mismatch at scenario ${a.index}, frame ${a.frame}`);
    assert.equal(b.draws,a.draws-1);
    const released=a.variant==='advanced'?1:3;
    assert.equal(a.bytes-b.bytes,a.width*a.height*4*released);
    assert.equal(a.textures-b.textures,released);
    assert.equal(b.targets.stock0,undefined);
    assert.equal(!!b.targets['average-read'],b.variant==='advanced');
  }
  assert.equal(after.inactiveBytes,0);assert.equal(after.reenabled,true);
  assert.equal(after.disposedTextures,before.disposedTextures,'graph disposal must release every owned texture');
  console.log(`PASS ${after.rows.length} exact RGBA8/RGBA16F frame comparisons, both variants, history, variant switches, resize and disable/re-enable. Saves one draw; Advanced one texture, HD three textures.`);
} finally {
  await writeFile(`${output}/results.json`,JSON.stringify(runs,null,2));
  await browser.close();
}
