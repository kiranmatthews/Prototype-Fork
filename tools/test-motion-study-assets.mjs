import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const nativeFetch=globalThis.fetch;
try{
  const {loadMotionStudyBuffer,loadMotionStudyJson}=await server.ssrLoadModule('/src/motionStudyAssets.ts');
  const json=JSON.stringify({version:1,fps:60,clips:{jump:{frames:1}}}),binary=new Uint8Array([0x67,0x6c,0x54,0x46,1,2,3,4]);
  for(const encoded of [false,true]){
    globalThis.fetch=async()=>new Response(encoded?gzipSync(json):json);
    assert.deepEqual(await loadMotionStudyJson('jak-motion'),JSON.parse(json));
    globalThis.fetch=async()=>new Response(encoded?gzipSync(binary):binary);
    assert.deepEqual(new Uint8Array(await loadMotionStudyBuffer('jak-motion','eichar-lod0.glb')),binary);
  }
  globalThis.fetch=async()=>new Response('',{status:404});
  await assert.rejects(loadMotionStudyJson('jak-motion'),/unavailable \(404\)/);
  console.log('PASS motion assets: raw gzip and HTTP-decoded JSON/GLB, explicit missing-asset errors');
}finally{globalThis.fetch=nativeFetch;await server.close();}
