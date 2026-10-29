import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=data=>createHash('sha256').update(data).digest('hex');
const report={sourceCommit:'2fa773bd70a7f8677667c6acf60afbca22a64200',courses:{},assets:[]};
// Art must preserve the complete pre-integration source course, including its controls,
// contacts, motion parameters, ordered camera nodes, hazards, crates and checkpoints.
for(const [name,file,key,expected] of [
 ['main','carlisle-tidal-relay','CARLISLE_TIDAL_RELAY_LEVEL','326e69f1bb2f7beae44baccfd273223ea1ee31221a725e5aefb4bb3e303fb421'],
 ['bonus','carlisle-harbour-bonus','CARLISLE_HARBOUR_BONUS','6fc5332d165182fc1a3e8dea81944f26f25eccfb7277d699a614ab21e394ff81']]){
 const compiled=await build({entryPoints:[`src/levels/${file}.ts`],bundle:true,format:'esm',write:false});
 const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
 const data=api[key];
 // The subsequent, explicitly requested airborne cargo layer is independently
 // exercised by test-carlisle-air-cargo. The original course stays protected.
 const airCargo=data.components.filter(c=>c.nm?.startsWith('Air cargo · '));
 assert.ok(airCargo.every(c=>c.t==='crate'));
 const components=data.components.filter(c=>!airCargo.includes(c));
 const actual=hash(JSON.stringify({components,spawn:data.spawn,killY:data.killY}));
 assert.equal(actual,expected,`${name}: the art pass changed course data`);
 report.courses[name]={components:data.components.length,airCargoCrates:airCargo.length,sha256:actual,originalGameplayDataPreserved:true};
}
const provenance=JSON.parse(await readFile('public/props/carlisle-shipyard/provenance.json','utf8'));
for(const asset of provenance.assets){
 const [source,runtime]=await Promise.all([readFile(asset.source),readFile(asset.file)]);
 assert.equal(hash(source),asset.sha256);assert.equal(hash(runtime),asset.sha256,'runtime must retain the complete authored GLB');
 assert.equal(runtime.readUInt32LE(0),0x46546c67);assert.equal(runtime.readUInt32LE(8),runtime.length);
 const json=JSON.parse(runtime.subarray(20,20+runtime.readUInt32LE(12)).toString('utf8'));
 const triangles=json.meshes.reduce((sum,mesh)=>sum+mesh.primitives.reduce((n,p)=>n+json.accessors[p.indices??p.attributes.POSITION].count/3,0),0);
 assert.equal(triangles,asset.triangles);report.assets.push({id:asset.id,sha256:asset.sha256,triangles,bytes:runtime.length});
}
assert.equal(report.assets.length,12);
await writeFile('art/carlisle-shipyard/integration/source-validation.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS original main/bonus course data, authorized air-cargo additions and all 12 complete authored runtime models.');
