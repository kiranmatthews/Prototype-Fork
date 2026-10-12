import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
const root=new URL('../../',import.meta.url),file=new URL('src/levels/.blockworks-baseline-art-check.ts',root);
const baseline=execFileSync('git',['show','27884c4:src/levels/codex-lab.ts'],{encoding:'utf8'});
await writeFile(file,baseline);
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const before=(await server.ssrLoadModule('/src/levels/.blockworks-baseline-art-check.ts')).CODEX_LAB_LEVEL;
 const after=(await server.ssrLoadModule('/src/levels/codex-lab.ts')).CODEX_LAB_LEVEL;
 const signature=data=>data.components.filter(c=>c.t!=='decor'&&!(c.t==='mesh'&&c.solid===false)).map(c=>{
  const copy={...c};for(const key of ['nm','tex','color','emissive','artProxy','dkind'])delete copy[key];
  if(copy.t==='pit')delete copy.invisible;
  return copy;
 });
 assert.deepEqual(signature(after),signature(before),'art may not change collision, paths, hazards, movement fields or switch wiring');
 assert.deepEqual(after.spawn,before.spawn);assert.equal(after.killY,before.killY);
 assert.equal(after.cameraAirLift,before.cameraAirLift);
 const tasks=JSON.parse(await readFile(new URL('tools/blockworks-art/meshy-tasks.json',root),'utf8'));
 const manifest=JSON.parse(await readFile(new URL('tools/blockworks-art/asset-manifest.json',root),'utf8'));
 let credits=0,triangles=0,bytes=0;
 for(const [name,task]of Object.entries(tasks.tasks)){
  assert.equal(task.state,'SUCCEEDED',name+' provider state');
  credits+=task.consumedCredits??task.estimatedCredits;
  const entry=manifest[name];assert.ok(entry,name+' packed manifest missing');
  const b=await readFile(new URL(entry.output,root));
  assert.equal(createHash('sha256').update(b).digest('hex'),entry.sha256,name+' packed hash');
  assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);
  const length=b.readUInt32LE(12),doc=JSON.parse(b.toString('utf8',20,20+length));
  assert.ok(doc.images?.length>0,name+' embedded paint missing');
  for(const mesh of doc.meshes)for(const p of mesh.primitives)assert.ok(p.attributes.TEXCOORD_0!==undefined,name+' original UVs missing');
  assert.ok(entry.triangles<=15000,name+' no longer low-poly');
  assert.ok(entry.originalTopologyAndUVs,name+' source preservation');
  triangles+=entry.triangles;bytes+=b.length;
 }
 assert.ok(credits<=1000,'user Meshy budget exceeded');assert.equal(Object.keys(manifest).length,15);
 console.log(JSON.stringify({nativeComponents:signature(after).length,assets:Object.keys(manifest).length,credits,uniqueAssetTriangles:triangles,packedBytes:bytes,physics:'identical to authored baseline'}));
}finally{await server.close();await unlink(file);}
