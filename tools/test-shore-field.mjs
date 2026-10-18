import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {shoreFieldCases,disposeShoreCases} from './shore-field-cases.mjs';

const references=JSON.parse(await readFile(new URL('./fixtures/shore-field-baseline.json',import.meta.url),'utf8'));
const fixtures=shoreFieldCases();
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {createShoreField}=await server.ssrLoadModule('/src/coastalSurf.ts');
 assert.equal(fixtures.length,references.cases.length);
 for(const [i,fixture]of fixtures.entries()){
  const field=createShoreField(fixture.meshes,fixture.seaLevel,fixture.bounds);
  try{
   const data=field.texture.image.data;
   const actual={name:fixture.name,size:[field.texture.image.width,field.texture.image.height],bounds:field.bounds.toArray(),segments:field.segments,hasBed:field.hasBed,sha256:createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex')};
   assert.deepEqual(actual,references.cases[i],fixture.name+': all coast texture bytes must match the pre-optimization reference');
  }finally{field.texture.dispose();}
 }
 console.log('PASS 8 exact coast fields: empty, seabed, long edges, opposing ties, transformed negative coordinates, closed island, ripples and excluded meshes.');
}finally{disposeShoreCases(fixtures);await server.close();}
