import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {AnimationClip} from 'three';
const bundle=await build({entryPoints:['src/enemies/kookAnimation.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {decodeKookAnimation}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),reports=[];
for(const name of ['karen-rain','kook-rain']){
 const source=await readFile(`tools/rooftop-kook-assets/animation-clips/${name}-clips.json`),packed=await readFile(`public/rooftop-kook/${name}-clips.bin`);
 const manifest=JSON.parse(await readFile(`public/rooftop-kook/${name}-clips.manifest.json`,'utf8'));
 assert.deepEqual(gunzipSync(packed),source,'Independent zlib decoder must restore every original JSON byte');
 assert.equal(hash(source),manifest.sourceSha256);assert.equal(hash(packed),manifest.packedSha256);
 const decoded=decodeKookAnimation(packed.buffer.slice(packed.byteOffset,packed.byteOffset+packed.byteLength)),original=JSON.parse(source);
 assert.deepEqual(decoded,original,'Production decoder must preserve every key, value, time and track property');
 let tracks=0,samples=0;
 for(let i=0;i<original.length;i++){
  const before=AnimationClip.parse(original[i]),after=AnimationClip.parse(decoded[i]);assert.equal(before.duration,after.duration);
  for(let j=0;j<before.tracks.length;j++){
   const a=before.tracks[j],b=after.tracks[j];assert.deepEqual(b.times,a.times);assert.deepEqual(b.values,a.values);assert.equal(b.getInterpolation(),a.getInterpolation());
   const ia=a.createInterpolant(),ib=b.createInterpolant();
   for(const t of [-.1,0,.017,.123,before.duration*.3,before.duration*.71,before.duration,before.duration+.1]){assert.deepEqual(ib.evaluate(t),ia.evaluate(t));samples++;}tracks++;
  }
 }
 reports.push({name,sourceBytes:source.length,packedBytes:packed.length,savedBytes:source.length-packed.length,clips:original.length,tracks,interpolatedSamples:samples,sha256:hash(source)});
}
assert.throws(()=>decodeKookAnimation(new Uint8Array([1,2,3,4]).buffer),'Damaged payload must fail instead of silently changing animation');
const out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/animation-packing';await mkdir(out,{recursive:true});await writeFile(out+'/lossless.json',JSON.stringify({reports,savedBytes:reports.reduce((n,r)=>n+r.savedBytes,0)},null,2)+'\n');
console.log('PASS exact JSON bytes, all animation values/interpolation and invalid-payload handling',JSON.stringify(reports));
