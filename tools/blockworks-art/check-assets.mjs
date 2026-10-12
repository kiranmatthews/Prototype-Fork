import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const root=new URL('../../',import.meta.url);
const baseline=JSON.parse(await readFile(new URL('tools/blockworks-art/physics-baseline.json',root),'utf8'));
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const after=(await server.ssrLoadModule('/src/levels/codex-lab.ts')).CODEX_LAB_LEVEL;
 const native=data=>data.components.filter(c=>c.t!=='decor'&&!(c.t==='mesh'&&c.solid===false)).map(c=>{
  const copy={...c};for(const key of ['nm','tex','color','emissive','artProxy','dkind'])delete copy[key];
  if(copy.t==='pit')delete copy.invisible;
  return copy;
 });
 const signature=createHash('sha256').update(JSON.stringify(native(after))).digest('hex');
 assert.equal(signature,baseline.nativeComponentsSha256,'art may not change native collision, paths, hazards or switch wiring');
 assert.deepEqual(after.spawn,baseline.spawn);assert.equal(after.killY,baseline.killY);
 assert.equal(after.cameraAirLift,baseline.cameraAirLift);
 const tasks=JSON.parse(await readFile(new URL('tools/blockworks-art/meshy-tasks.json',root),'utf8'));
 const manifest=JSON.parse(await readFile(new URL('tools/blockworks-art/asset-manifest.json',root),'utf8'));
 let credits=0,triangles=0,bytes=0;
 for(const [name,task]of Object.entries(tasks.tasks)){
  assert.equal(task.state,'SUCCEEDED',name+' provider state');credits+=task.consumedCredits??task.estimatedCredits;
  const entry=manifest[name];assert.ok(entry,name+' packed manifest missing');
  const b=await readFile(new URL(entry.output,root));
  assert.equal(createHash('sha256').update(b).digest('hex'),entry.sha256,name+' packed hash');
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);
  const length=b.readUInt32LE(12),doc=JSON.parse(b.toString('utf8',20,20+length));
  assert.ok(doc.images?.length>0,name+' embedded paint missing');
  for(const mesh of doc.meshes)for(const p of mesh.primitives)assert.ok(p.attributes.TEXCOORD_0!==undefined,name+' original UVs missing');
  assert.ok(entry.triangles<=15000,name+' no longer low-poly');assert.ok(entry.originalTopologyAndUVs);
  triangles+=entry.triangles;bytes+=b.length;
 }
 assert.ok(credits<=1000,'user Meshy budget exceeded');assert.equal(Object.keys(manifest).length,15);
 console.log(JSON.stringify({nativeComponents:native(after).length,baseline:baseline.commit,assets:Object.keys(manifest).length,credits,uniqueAssetTriangles:triangles,packedBytes:bytes,physics:'identical to authored baseline'}));
}finally{await server.close();}

