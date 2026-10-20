import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';

// Covers every authored fork, gap and row boundary without replacing the
// projection or clipping code with a matching test implementation.
const reference=JSON.parse(await readFile(new URL('./fixtures/hollowwake-tunnel-baseline.json',import.meta.url),'utf8'));
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {HOLLOWWAKE_LEVEL,HOLLOWWAKE_TUNNELS}=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts');
 const meshes=HOLLOWWAKE_LEVEL.components.filter(c=>c.nm==='Seamless circular tunnel collision · no exposed coping');
 const actual={collisionSha256:digest(meshes),tunnelsSha256:digest(HOLLOWWAKE_TUNNELS),tunnels:meshes.length,
  vertices:meshes.reduce((n,c)=>n+c.vertices.length/3,0),triangles:meshes.reduce((n,c)=>n+c.indices.length/3,0)};
 assert.deepEqual(actual,reference.collision,'collision paths, rounded mesh data, triangle order and tunnel descriptors must match the approved geometry');
 console.log(`PASS ${actual.tunnels} exact tunnel meshes, ${actual.vertices} vertices and ${actual.triangles} triangles across common/split/merged bores and authored gaps`);
}finally{await server.close();}
