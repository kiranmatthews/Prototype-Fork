import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Unit changes must not split a source seam or change a rail junction. This
// builds only the data module, avoiding the DOM and the full game runtime.
const root=dirname(dirname(fileURLToPath(import.meta.url))),file=join(root,'src/levels/mall-measured.ts');
const source=await readFile(file,'utf8'),temporary=await mkdtemp(join(tmpdir(),'mall-scale-')),reports=[];
try{
 for(const scale of [.025,.035,.045]){
  const outfile=join(temporary,`${scale}.mjs`);
  await build({entryPoints:[file],bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent',plugins:[{name:'scale-probe',setup(b){
   b.onLoad({filter:/mall-measured\.ts$/},()=>({contents:source.replace(/MALL_SCALE=[\d.]+;/,`MALL_SCALE=${scale};`),loader:'ts',resolveDir:dirname(file)}));
  }}]});
  const m=await import(pathToFileURL(outfile).href),meshes=m.MALL_LEVEL.components.filter(c=>c.t==='mesh');
  reports.push({scale,...m.MALL_SURVEY_STATS,components:m.MALL_LEVEL.components.length,
   vertices:meshes.reduce((n,c)=>n+c.vertices.length/3,0),triangles:meshes.reduce((n,c)=>n+c.indices.length/3,0),
   bytes:new TextEncoder().encode(JSON.stringify(m.MALL_LEVEL)).byteLength});
 }
 assert.equal(new Set(reports.map(r=>r.vertTriangles)).size,1);
 assert.equal(new Set(reports.map(r=>r.railPaths)).size,1);
 assert.ok(reports.every(r=>r.railEdges===637&&r.vertices<100000&&r.triangles<100000&&r.bytes<8*1024*1024));
 console.log(JSON.stringify(reports));
 await writeFile('/private/tmp/mall-recreation/measured/scale-topology.json',JSON.stringify(reports,null,2));
}finally{await rm(temporary,{recursive:true,force:true});}
