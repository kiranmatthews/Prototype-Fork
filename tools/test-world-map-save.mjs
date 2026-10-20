import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
new Function(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const api=await server.ssrLoadModule('/src/level.ts');
 const points=api.worldMapComponentPoints();
 assert.equal(Math.max(...points.map(p=>p[3])),129);
 const data={v:1,name:'Six-island map',spawn:[0,2,0],killY:-30,components:[{t:'worldmap',p:[0,0,0],pts:points}]};
 const normalized=api.normalizeCustomLevelData(data);
 assert.ok(normalized,'the elevated secret island must remain saveable');
 assert.deepEqual(normalized.components[0].pts,points);
 assert.deepEqual(api.normalizeCustomLevelData(JSON.parse(JSON.stringify(normalized))),normalized);
 for(const [axis,limit] of [[0,1536],[1,512],[3,256]]){
  const edited=structuredClone(data);edited.components[0].pts[0][axis]=limit;
  assert.ok(api.normalizeCustomLevelData(edited),`allow bounded axis ${axis}`);
  edited.components[0].pts[0][axis]=limit+.01;
  assert.equal(api.normalizeCustomLevelData(edited),null,`reject unbounded axis ${axis}`);
 }
 console.log('PASS elevated six-island map JSON round-trip and bounded editable hub coordinates.');
}finally{await server.close();}
