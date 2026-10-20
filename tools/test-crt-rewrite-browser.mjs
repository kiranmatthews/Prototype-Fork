// Compare the rewrite with a separately served, immutable pre-rewrite checkout.
// npm dependencies may be supplied by the desktop's PLAYWRIGHT_MODULE runtime.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const candidate = process.argv[2] || 'http://127.0.0.1:5186';
const baseline = process.argv[3] || 'http://127.0.0.1:5187';
const output = process.env.CRT_REWRITE_REVIEW || '/private/tmp/crt-rewrite-review';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { candidate, baseline, referencePolicy:'Fresh legacy graph per preset; candidate reuses one graph through every preset/size transition.', results: [] };
try {
  for (const [label, base] of [['before', baseline], ['after', candidate]]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('**/__rewrite', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><style>body{margin:0}</style>' }));
    await page.goto(`${base}/__rewrite`);
    const result = await page.evaluate(async ({cases, samples, batch, freshReference}) => {
      const code = await (await fetch('/src/crt-guest/pass.ts')).text();
      const THREE = await import(code.match(/import\s+\*\s+as\s+THREE\s+from\s+["']([^"']+)/)[1]);
      const { CrtGuestPass } = await import('/src/crt-guest/pass.ts');
      const { CrtGuestOutputPass } = await import('/src/crt-guest/output.ts');
      const { CrtGuestSettings } = await import('/src/crt-guest/settings.ts');
      const { loadCrtGuestLuts, disposeCrtGuestLuts } = await import('/src/crt-guest/luts.ts');
      const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1); renderer.setSize(960, 540); renderer.info.autoReset = false;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      document.body.append(renderer.domElement);
      const gl = renderer.getContext();
      const gpu = gl.getExtension('WEBGL_debug_renderer_info');
      const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      const settings = new CrtGuestSettings({ storage: null, persistChanges: false, loadStored: false });
      const luts = await loadCrtGuestLuts('/crt-guest/lut/');
      let crt = new CrtGuestPass(renderer, settings, { luts, respectDisableQuery: false, deferOutput: true, deferDeconvergence: true });
      let final = new CrtGuestOutputPass(() => crt.deferredOutput, () => crt.deferredDeconvergence);
      final.renderToScreen = true;
      const source = new THREE.WebGLRenderTarget(320, 180, { type: THREE.HalfFloatType, depthBuffer: false });
      const spare = new THREE.WebGLRenderTarget(960, 540, { type: THREE.HalfFloatType, depthBuffer: false });
      const scene = new THREE.Scene(), camera = new THREE.Camera(), geometry = new THREE.PlaneGeometry(2, 2);
      const pattern = new THREE.ShaderMaterial({
        uniforms: { tick: { value: 0 } }, depthTest: false, depthWrite: false, toneMapped: false,
        vertexShader: 'varying vec2 p;void main(){p=uv;gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: `varying vec2 p; uniform float tick;
          void main(){
            vec3 c=vec3(p.x*p.x*1.4,p.y*.7,.2+.7*p.x*p.y);
            if(p.y>.7)c=vec3(step(.5,fract(p.x*7.)),step(.5,fract(p.x*5.)),step(.5,fract(p.x*3.)));
            if(p.y<.35)c=vec3(mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.));
            if(p.x<.25 && p.y<.7 && p.y>.35)c=vec3(.002);
            vec2 d=p-vec2(.2+tick*.027,.5);c+=vec3(2.,.7,.1)*exp(-1500.*dot(d,d));
            gl_FragColor=vec4(c,1.);
          }`,
      }); scene.add(new THREE.Mesh(geometry, pattern));
      const rows = [];
      const specs = [
        { name: 'startup-hd', variant: 'hd', startup: true },
        { name: 'startup-advanced', variant: 'advanced', startup: true },
        ...['hd', 'advanced'].flatMap(variant => [
          { name: `${variant}-defaults`, variant },
          { name: `${variant}-effects`, variant, patch: { bloom: .8, halation: .5, mask_bloom: .4, glow: .25, vigstr: .4 } },
          { name: `${variant}-magic`, variant, patch: { glow: .7, m_glow: 2, m_glow_cutoff: .15, FINE_GLOW: 0, SIZEH: 25, SIZEV: 25, SIGMA_H: 2.5, SIGMA_V: 2.5 } },
          { name: `${variant}-negative`, variant, patch: { glow: -.2, bloom: -.5, halation: -.3, AS: 0, BP: -15 } },
          { name: `${variant}-wide`, variant, patch: { glow: .4, bloom: .7, SIZEH: 50, SIZEV: 50, SIZEHB: 50, SIZEVB: 50, SIGMA_H: 5, SIGMA_V: 5, SIGMA_HB: 4, SIGMA_VB: 4 } },
          { name: `${variant}-off`, variant, patch: { glow: 0, bloom: 0, AS: 0, BP: 0, CP: -1, shadowMask: -1 } },
          { name: `${variant}-interlace`, variant, height: 401, patch: { interm: 1, intres: 0, iscan: .7, dctypex: .5, deconrr: 4, deconrb: -3, addnoised: .2 } },
        ]),
        { name: 'advanced-raster', variant: 'advanced', patch: { BLOOM: 12, smart_ei: 0 } },
        { name: 'advanced-edges', variant: 'advanced', patch: { BLOOM: 0, smart_ei: .5 } },
        { name: 'advanced-raster-transition', variant: 'advanced', patch: { BLOOM: 12, smart_ei: .5 } },
        { name: 'hd-auto', variant: 'hd', width: 643, height: 243, patch: { auto_res: 1, glow: .2, bloom: .5, internal_res: 1.5 } },
        { name: 'startup-native-1080', variant: 'hd', startup:true, width:1920, height:1080, ow:1920, oh:1080 },
        { name: 'startup-fixed-1080', variant: 'hd', startup:true, width:640, height:360, ow:1920, oh:1080 },
        { name: 'hd-effects-1080', variant: 'hd', width:640, height:360, ow:1920, oh:1080, patch:{glow:.4,bloom:.5,halation:.5,mask_bloom:.25} },
        { name: 'hd-wide-sigma', variant: 'hd', width:127, height:73, ow:387, oh:213, patch:{glow:.4,bloom:-.5,SIZEH:50,SIZEV:50,SIZEHB:50,SIZEVB:50,SIGMA_H:15,SIGMA_V:15,SIGMA_HB:15,SIGMA_VB:15} },
        { name: 'hd-odd', variant: 'hd', width:127, height:73, ow:387, oh:213, patch:{glow:.3,bloom:.5,FINE_GLOW:5,FINE_BLOOM:-1,TNTC:2,vigstr:.5,warpX:.1,addnoised:.2,HSHARPNESS:1.5,internal_res:1.2} },
        { name: 'advanced-colour', variant: 'advanced', width:127, height:73, ow:387, oh:213, patch:{CP:3,CS:2,TNTC:4,WP:35,wp_saturation:1.3,contr:.2,pre_gc:.8} },
        { name: 'hd-apple-tv', variant: 'hd', quality:'apple-tv', patch:{glow:.5,bloom:.5,m_glow:1,FINE_GLOW:2} },
        { name: 'advanced-balanced', variant: 'advanced', quality:'balanced', patch:{BLOOM:10,smart_ei:.2,glow:.1,bloom:.3} },
        { name: 'native-threshold-only', variant:'hd', startup:true, width:1280,height:720,ow:1280,oh:720,patch:{AS:0,BP:25,bth:125} },
        { name: 'advanced-threshold-only', variant:'advanced',patch:{AS:0,BP:25,bth:16,glow:0} },
        { name: 'native-gamma', variant:'hd',startup:true,width:1280,height:720,ow:1280,oh:720,patch:{GAMMA_INPUT:3.2,gamma_c:.7,gamma_out:5,post_br:2} },
        { name: 'native-curved', variant:'hd',startup:true,width:1280,height:720,ow:1280,oh:720,patch:{warpX:.05,warpY:.05} },
        { name: 'native-low-scan-gamma', variant:'hd',startup:true,width:1280,height:720,ow:1280,oh:720,patch:{GAMMA_INPUT:5,scangamma:.5,bmask:.25,post_br:2} },
      ];
      const render = () => { crt.render(renderer, spare, source, 1/60, false); final.render(renderer, spare, source, 1/60, false); };
      for (const spec of specs.filter(s=>!cases||cases.split(',').includes(s.name))) {
        settings.applyStartupPreset(); settings.setVariant(spec.variant);
        if (!spec.startup) settings.resetCurrentDefaults();
        settings.setEnabled(true);
        settings.setQuality(spec.quality || 'exact');
        for (const [id, value] of Object.entries(spec.patch || {})) settings.setValue(id, value);
        if (freshReference) {
          // The old graph doesn't reallocate immutable mip storage when changing
          // HD -> Advanced at identical dimensions. Its fresh graph is the
          // canonical preset reference; the candidate must match it after reuse.
          final.dispose();crt.dispose();
          crt=new CrtGuestPass(renderer,settings,{luts,respectDisableQuery:false,deferOutput:true,deferDeconvergence:true});
          final=new CrtGuestOutputPass(()=>crt.deferredOutput,()=>crt.deferredDeconvergence);final.renderToScreen=true;
        }
        source.setSize(spec.width || 320, spec.height || 180);
        const width=spec.ow||960,height=spec.oh||540;
        renderer.setRenderTarget(null);renderer.setSize(width,height);spare.setSize(width,height);
        crt.setResolution(source.width, source.height, width, height); crt.frameIndex = 0; crt.resetHistory('comparison');
        for (let i = 0; i < 5; i++) {
          pattern.uniforms.tick.value = i;
          renderer.setRenderTarget(source); renderer.render(scene, camera); render();
        }
        gl.finish();
        const pixels = new Uint8Array(width*height*4); gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let averageAlpha=null;
        if(crt.targets?.average){const t=crt.targets.average[crt.historyPing?1:0],p=new Uint8Array(4);renderer.readRenderTargetPixels(t,Math.floor(t.width/2),Math.floor(t.height/2),1,1,p);averageAlpha=p[3];}
        let raw = ''; for (let i=0;i<pixels.length;i+=8192) raw += String.fromCharCode(...pixels.subarray(i,i+8192));
        const times = [], gpuTimes = [];
        for(let i=0;i<16;i++)render();gl.finish();
        for (let i=0;i<samples;i++) {
          const query = timer ? gl.createQuery() : null;
          if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT,query);
          const start = performance.now();for(let j=0;j<batch;j++)render();
          if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
          gl.finish(); times.push((performance.now()-start)/batch);
          if (query) {
            while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) await new Promise(r=>setTimeout(r,5));
            if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) gpuTimes.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6/batch);
            gl.deleteQuery(query);
          }
        }
        rows.push({ name: spec.name, spec, width,height,batch,averageAlpha,gpuSamples:gpuTimes,pixels: btoa(raw), cpuGpuMedianMs: times.sort((a,b)=>a-b)[Math.floor(times.length/2)],
          gpuMedianMs: gpuTimes.length ? gpuTimes.sort((a,b)=>a-b)[Math.floor(gpuTimes.length/2)] : null,
          diagnostics: crt.diagnostics, glError: gl.getError() });
      }
      const info = { renderer: gpu ? gl.getParameter(gpu.UNMASKED_RENDERER_WEBGL) : null, timerAvailable: !!timer };
      crt.dispose(); final.dispose(); source.dispose(); spare.dispose(); pattern.dispose(); geometry.dispose(); disposeCrtGuestLuts(luts);
      info.texturesAfterDispose = renderer.info.memory.textures; renderer.dispose();
      return { rows, info };
    }, {cases:process.env.CRT_CASES,samples:Number(process.env.CRT_SAMPLES||9),batch:Number(process.env.CRT_BATCH||1),freshReference:label==='before'});
    await page.screenshot({ path: `${output}/${label}.png` });
    report.results.push({ label, ...result, errors });
    console.log(label, result.info, errors.slice(0,3));
    await page.close();
  }
  const [before, after] = report.results;
  for (let i=0;i<before.rows.length;i++) {
    const a=before.rows[i], b=after.rows[i], left=Buffer.from(a.pixels,'base64'), right=Buffer.from(b.pixels,'base64');
    let max=0,sum=0,squares=0,over2=0,alpha=0;const locations=[];
    for (let j=0;j<left.length;j++) {
      const d=Math.abs(left[j]-right[j]); if(j%4===3){alpha+=d;continue;}
      max=Math.max(max,d);sum+=d;squares+=d*d; if(d>2){over2++;if(locations.length<12)locations.push({x:Math.floor(j/4)%b.width,y:Math.floor(j/4/b.width),channel:j%4,a:left[j],b:right[j]});}
    }
    b.difference={max,mean:sum/(left.length*.75),rmse:Math.sqrt(squares/(left.length*.75)),fractionOver2:over2/(left.length*.75),alpha,locations};
    delete a.pixels; delete b.pixels;
    console.log(b.name, JSON.stringify(b.difference), `${a.diagnostics.lastDrawCount+1}→${b.diagnostics.lastDrawCount+1} draws`, `${a.gpuMedianMs?.toFixed(3)}→${b.gpuMedianMs?.toFixed(3)} GPU ms`);
  }
  await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));
  assert.deepEqual(after.errors,[],'Browser/shader errors');
  for (const row of after.rows) {
    assert.equal(row.glError,0,row.name); assert.equal(row.difference.alpha,0,row.name);
    assert.ok(row.difference.max <= 2,`${row.name}: ${JSON.stringify(row.difference)}`);
  }
  assert.equal(after.info.texturesAfterDispose,0);
} finally { await writeFile(`${output}/results.json`,JSON.stringify(report,null,2)); await browser.close(); }
