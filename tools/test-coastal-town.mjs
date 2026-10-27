import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createServer} from 'vite';
import {runInThisContext} from 'node:vm';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const mainOnly=process.argv.includes('--main');
const gameplay=data=>({spawn:data.spawn,killY:data.killY,components:data.components.filter(c=>c.t!=='decor'&&c.solid!==false).map(c=>{
 const {color,tex,emissive,nm,grp,uvs,normals,colors,...physical}=c;return physical;
})});
try{
 const {COASTAL_STREET_RUN_LEVEL:main}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
 const {resolveBonusLevel}=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {COASTAL_TOWN_ASSETS:assets}=await server.ssrLoadModule('/src/coastalTownAssets.ts');
 const {normalizeCustomLevelData,MAX_LEVEL_FILE_BYTES}=await server.ssrLoadModule('/src/level.ts');
 const bonus=resolveBonusLevel('coastal-street-run');
 const baseline=JSON.parse(await readFile(new URL('./coastal-town-assets/gameplay-baseline.json',import.meta.url),'utf8'));
 const stripVisual=x=>({...x,components:x.components.map(({uvs,normals,colors,...c})=>c)});
 // Beach Street deliberately expands its encounters. The imported road,
 // original stairs/rails/gaps and cameras stay intact. Fruit keeps count and
 // lane/station; its height is separately checked against physical surfaces.
 const routeOnly=x=>({...x,components:x.components.filter(c=>c.t!=='enemy'&&!(c.t==='rail'&&c.pts?.length>2&&Math.abs(c.p[0])<7)).map(c=>c.t==='wumpa'?{...c,p:[c.p[0],0,c.p[2]]}:c)});
 const originalMain={...main,components:main.components.filter(c=>c.grp!==11&&!c.nm?.startsWith('street rail '))};
 assert.deepEqual(routeOnly(JSON.parse(JSON.stringify(gameplay(originalMain)))),routeOnly(stripVisual(baseline.main)),'Original road, gap bridges, boundary/stair rails, cameras or collectibles changed');
 if(!mainOnly)assert.deepEqual(JSON.parse(JSON.stringify(gameplay(bonus))),stripVisual(baseline.bonus),'Bonus puzzle physics/cameras/actors changed');
 for(const level of mainOnly?[main]:[main,bonus]){
  assert.ok(level.components.length<9500,'Leave space under the editor limit for owner-added store signage');
  assert.ok(Buffer.byteLength(JSON.stringify(level))<MAX_LEVEL_FILE_BYTES*.8,'Leave space in the editor file budget');
  assert.ok(normalizeCustomLevelData(level),level.name+' remains editable and exportable');
  const edits=Array.from({length:256},(_,i)=>({t:'decor',dkind:'block',p:[-20,0,-i],s:[1,1,.1],solid:false}));
  assert.ok(normalizeCustomLevelData({...level,components:[...level.components,...edits]}),'Reserve editor workload for at least 256 owner-added components');
  assert.equal(level.sky,'coastal-town');
  assert.equal(level.components.filter(c=>c.t==='gate').length,1);
  assert.ok(level.components.some(c=>c.dkind==='bayroof'));
  assert.ok(level.components.some(c=>c.dkind==='bayawning'));
  if(level===main)assert.ok(!level.components.some(c=>c.dkind==='baytownmatte'||c.dkind==='bayheadlandmatte'),'Main street uses spatial islands, never repeated alpha cards');
  else assert.ok(level.components.some(c=>c.dkind==='baytownmatte'));
  assert.ok(!level.components.some(c=>c.dkind==='coastalhouse'));
  const authored=level.components.filter(c=>(c.grp??0)>=100);
  assert.ok(authored.every(c=>c.solid===false),'Scenery must never create an invisible puzzle step');
  assert.ok(!authored.some(c=>/shop sign|plaque|advertis|pictogram|ice.cream sign/i.test(c.nm??'')));
  assert.ok(authored.every(c=>c.p.every(Number.isFinite)));
 }
 const ledger=JSON.parse(await readFile(new URL('./coastal-town-assets/tasks.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(ledger.tasks).length,16);
 assert.ok(Object.values(ledger.tasks).every(t=>t.state==='SUCCEEDED'));
 assert.ok(!Object.keys(ledger.tasks).some(name=>/shop|villa|cafe/.test(name)),'No whole-shop Meshy jobs');
 for(const [kind,spec] of Object.entries(assets)){
  const path=new URL('../public/'+(spec.image??('jungle-kit/'+spec.file+'.glb')),import.meta.url);
  await access(path);assert.ok(spec.size.every(v=>Number.isFinite(v)&&v>0));
  if(spec.matte)continue;
  const raw=await readFile(path),n=raw.readUInt32LE(12),gltf=JSON.parse(raw.subarray(20,20+n));
  assert.equal(gltf.materials.length,1,kind+' should share one atlas');
  assert.ok(gltf.nodes.some(n=>n.name?.endsWith('LOD0')));
  assert.ok(gltf.nodes.some(n=>n.name?.endsWith('LOD1')));
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){
   assert.ok(p.attributes.TEXCOORD_0!==undefined,kind+' UVs');
   assert.ok(p.attributes.NORMAL!==undefined,kind+' normals');
  }
 }
 console.log(`Coastal art: ${main.components.length} main components. Original main road/cameras preserved; spatial offshore islands and 16 textured Meshy components verified.${mainOnly?' Bonus excluded from this main-course check.':' Bonus puzzle unchanged.'}`);
}finally{await server.close();}
