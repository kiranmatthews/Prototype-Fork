import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {registerPoint,nearbyObjects} from './level-atlas-return.mjs';
const root=new URL('../public/provenance/level-atlas/',import.meta.url);
const inventory=JSON.parse(await readFile(new URL('inventory.json',root),'utf8'));
const source=await readFile(new URL('../src/campaign.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {CAMPAIGN_LEVELS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
assert.deepEqual(inventory.levels.map(l=>l.levelId).sort(),CAMPAIGN_LEVELS.map(l=>l.levelId).sort(),'Every campaign level must appear exactly once');
let objects=0,polygons=0;
for(const row of inventory.levels){
  const manifest=JSON.parse(await readFile(new URL(row.manifest,root),'utf8'));
  const snapshot=gunzipSync(await readFile(new URL(row.snapshot,root)));
  assert.equal(createHash('sha256').update(snapshot).digest('hex'),manifest.sourceDataHash,'Snapshot must match its provenance');
  const svg=await readFile(new URL(row.file,root),'utf8');
  assert.ok((await readFile(new URL(row.file.replace(/\.svg$/,'.plan.svg'),root),'utf8')).includes(row.snapshotId),'Clean vector baseline has a stale source snapshot');
  assert.ok(!/NaN|Infinity|undefined/.test(svg.replace(/data:image\/[^\"]+/g,'')),row.name+' has invalid SVG coordinates');
  for(const id of ['REF-A','REF-B','REF-C','REF-D'])assert.ok(svg.includes(id),row.name+' lost a registration anchor');
  assert.ok(manifest.objects.some(o=>o.id==='START'),row.name+' missing spawn');
  assert.ok(manifest.objects.some(o=>o.kind==='surface'),row.name+' missing runtime surfaces');
  const ids=manifest.objects.map(o=>o.id);assert.equal(new Set(ids).size,ids.length,'Duplicate object ID');
  const p=manifest.projection;
  // Simulate an independently translated, rotated, non-uniformly scaled and
  // sheared returned drawing. Registration must still recover the world.
  const transform=([x,y])=>[.37*x-.24*y+713,.15*x+.63*y-209];
  const anchors=p.anchors.map(a=>transform(a.svg));
  const start=manifest.objects.find(o=>o.id==='START').point;
  const target=[p.offsetX+(start[0]-p.minX)*8,p.offsetY+(start[2]-p.minZ)*8];
  const recovered=registerPoint(p,transform(target),anchors);
  assert.ok(Math.abs(recovered.worldX-start[0])<1e-8&&Math.abs(recovered.worldZ-start[2])<1e-8,'Annotation registration changed world position');
  assert.ok(nearbyObjects(manifest,recovered).some(o=>o.id==='START'),'Registered point cannot identify its source object');
  const bad=structuredClone(anchors);bad[3][0]+=50;assert.throws(()=>registerPoint(p,transform(target),bad),/disagrees/);
  const data=JSON.parse(snapshot);
  if(inventory.visualArt){
    assert.equal(manifest.art.snapshotId,row.snapshotId,'Scenery snapshot mismatch');
    assert.equal(manifest.art.groundMeshes,row.ground,'Loaded assets changed the mapped ground count');
    assert.deepEqual(manifest.art.assets.failed,[],'Missing art assets');
    assert.ok(svg.includes('xlink:href="data:image/webp;base64,'),'Missing portable game art');
    const area=manifest.art.tiles.reduce((sum,t)=>sum+t.width*t.height,0);
    assert.equal(area,(p.maxX-p.minX)*(p.maxZ-p.minZ)*64,'Scenery tiles do not cover the exact plot');
    for(const t of manifest.art.tiles){assert.ok(Math.abs(p.minX+(t.x-p.offsetX)/8-t.worldX)<1e-6);assert.ok(Math.abs(p.minZ+(t.y-p.offsetY)/8-t.worldZ)<1e-6);}
  }
  for(const o of manifest.objects){
    assert.ok([...o.bounds.min,...o.bounds.max].every(Number.isFinite),'Nonfinite object');
    if(o.componentIndex!==undefined)assert.equal(createHash('sha256').update(JSON.stringify(data.components[o.componentIndex])).digest('hex'),o.componentHash,'Source object hash drift');
    for(const polygon of o.paths??[]){assert.ok(polygon.length>=3);assert.ok(polygon.flat().every(Number.isFinite));polygons++;}
    if(o.railId){
      const rail=manifest.objects.find(r=>r.id===o.railId),base=o.motion.base;
      const distance=rail.points.slice(1).reduce((best,b,i)=>{const a=rail.points[i],d=b.map((v,k)=>v-a[k]),len=d.reduce((s,v)=>s+v*v,0),t=Math.max(0,Math.min(1,base.reduce((s,v,k)=>s+(v-a[k])*d[k],0)/len));return Math.min(best,Math.hypot(...base.map((v,k)=>v-a[k]-t*d[k])));},Infinity);
      assert.ok(distance<.002,'Rail travel indicator must be anchored on the real rail, not its offset origin');
    }
  }
  objects+=manifest.objects.length;
}
assert.throws(()=>registerPoint(inventory.levels[0].projection,[0,0],[[0,0],[1,1],[2,2]]),/collinear/);
console.log(`Atlas validated: ${inventory.levels.length} campaign levels, ${objects} objects, ${polygons} polygons; transformed annotation registration and stale-reference rejection pass.`);
