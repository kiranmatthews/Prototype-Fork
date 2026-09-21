import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
  const {rooAtlasCap}=await server.ssrLoadModule('/src/roo-type/resolution.ts');
  for(const [w,h,dpr,expected] of [[393,852,3,128],[852,393,3,128],[1024,1366,2,256],[1366,1024,2,256],[1920,1080,1,128],[3840,2160,1,512],[1920,1080,2,512],[0,0,1,128]])assert.equal(rooAtlasCap(w,h,dpr),expected);
  const {ROO_ATLAS_METRICS:metrics}=await server.ssrLoadModule('/src/roo-type/atlas-metrics.ts');
  const bytes={128:0,256:0,512:0};
  for(const [palette,m] of Object.entries(metrics))for(let frame=0;frame<m.lightFrames;frame++)for(const cap of [128,256,512]){
    const name=`roo-${palette}-v${m.version}${frame?'-light'+frame:''}${cap===512?'':'-cap'+cap}.png`;
    const image=await readFile(new URL('../public/fonts/'+name,import.meta.url));
    const w=image.readUInt32BE(16),h=image.readUInt32BE(20);
    assert.equal(w,Math.round(m.width*cap/m.capPixels));assert.ok(Math.abs(h-m.height*cap/m.capPixels)<=.5);
    bytes[cap]+=w*h*4;
    for(const g of Object.values(m.glyphs))if(g.width){assert.ok(g.x+g.width<=m.width&&g.y+g.height<=m.height,'glyph fits the same normalized source atlas');}
  }
  assert.ok(bytes[128]<12*1048576);assert.ok(bytes[256]<48*1048576);assert.equal(bytes[512],198868992);
  const {retireIdleDecoderWorkers}=await server.ssrLoadModule('/src/sceneryTextureLoader.ts');
  let retired=0;const jobs=[];
  const loader={workerPool:{postMessage:()=>new Promise((resolve,reject)=>jobs.push({resolve,reject})),dispose(){retired++;}}};
  retireIdleDecoderWorkers(loader,15);
  const one=loader.workerPool.postMessage('one'),two=loader.workerPool.postMessage('two');
  jobs[0].resolve(1);await one;await new Promise(r=>setTimeout(r,30));assert.equal(retired,0,'never retire a worker with pending texture jobs');
  jobs[1].resolve(2);await two;await new Promise(r=>setTimeout(r,30));assert.equal(retired,1);
  const third=loader.workerPool.postMessage('three');jobs[2].reject(Error('bad texture'));await assert.rejects(third,/bad texture/);
  await new Promise(r=>setTimeout(r,30));assert.equal(retired,2,'failed jobs also release idle decoder memory');
  const fourth=loader.workerPool.postMessage('four');jobs[3].resolve(4);await fourth;
  const fifth=loader.workerPool.postMessage('five');await new Promise(r=>setTimeout(r,30));assert.equal(retired,2,'new work cancels idle retirement');jobs[4].resolve(5);await fifth;
  console.log('PASS display-aware font budgets, preserved glyph layout, full 4K art, decoder busy/idle/failure/restart lifetime.',bytes);
}finally{await server.close();}
