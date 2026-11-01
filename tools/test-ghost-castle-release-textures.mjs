import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';

const manifest=JSON.parse(await readFile('release-images/manifest.json','utf8'));
const originals={
 stone:'ghost-train/meshy-castle-stone-v2.png',
 floor:'ghost-train/meshy-castle-floor-v2.png',
 timber:'ghost-train/meshy-castle-timber-v2.png',
 bath:'ghost-train/meshy-bath-tiles-v3.png',
};
const originalFetch=globalThis.fetch,originalBitmap=globalThis.createImageBitmap;
try{
 for(const packed of [true,false]){
  // Emulate the actual release inventory: converted PNG URLs do not exist.
  const available=new Map();
  for(const file of Object.values(originals)){
   const row=packed&&manifest.files.find(row=>row.file===file);
   available.set('/Prototype-Fork/'+(row?file.replace(/\.png$/,'.webp'):file),
    await readFile(row?'release-images/encoded/'+row.sha256+'.webp':'public/'+file));
  }
  const requested=[],bitmaps=[];
  globalThis.fetch=async url=>{
   requested.push(url);
   return available.has(url)?new Response(available.get(url)):new Response('',{status:404});
  };
  globalThis.createImageBitmap=async blob=>{
   assert.ok(blob.size>0);
   const bitmap={width:1024,height:1024,closed:false,close(){this.closed=true;}};
   bitmaps.push(bitmap);return bitmap;
  };
  const compiled=await build({entryPoints:['src/ghostCastleMaterials.ts'],bundle:true,write:false,format:'esm',platform:'node',
   define:{'import.meta.env.BASE_URL':JSON.stringify('/Prototype-Fork/'),'import.meta.env.PROD':String(packed)}});
  const materialModule=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
  const materials=Object.keys(originals).map(kind=>materialModule.createCastleMaterial({t:'platform',tex:'castle-'+kind}));
  try{
   await materialModule.prepareCastleTextures();
   const diagnostics=materialModule.castleTextureDiagnostics();
   for(const kind of Object.keys(originals))assert.equal(diagnostics[kind],'ready',`${packed?'release':'development'} ${kind} fell back instead of loading its authored texture`);
   assert.deepEqual([...requested].sort(),[...available.keys()].sort());
   assert.equal(bitmaps.length,4);
  }finally{for(const material of materials)material.dispose();}
  assert.ok(bitmaps.every(bitmap=>bitmap.closed),'decoded texture lifetime leaked');
 }
 console.log('PASS Ghost Train loads all four authored castle textures from production and development inventories without fallback.');
}finally{globalThis.fetch=originalFetch;globalThis.createImageBitmap=originalBitmap;}
