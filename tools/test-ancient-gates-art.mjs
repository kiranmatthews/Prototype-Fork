import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const compiled=await build({stdin:{contents:"export * from './src/levels/ancient-gates-route';export * from './src/levels/ancient-gates-bonus';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const bounds=c=>{
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const yaw=(c.yaw??0)*Math.PI/180,roll=(c.amp??0)*Math.PI/180;
 for(const x of [-.5,.5])for(const y of [0,1])for(const z of [-.5,.5]){
  const a=x*c.s[0],b=y*c.s[1],d=z*c.s[2],rx=a*Math.cos(roll)-b*Math.sin(roll),ry=a*Math.sin(roll)+b*Math.cos(roll);
  const q=[rx*Math.cos(yaw)+d*Math.sin(yaw),ry,-rx*Math.sin(yaw)+d*Math.cos(yaw)].map((v,i)=>v+c.p[i]);
  for(let i=0;i<3;i++){min[i]=Math.min(min[i],q[i]);max[i]=Math.max(max[i],q[i]);}
 }return{min,max};
};
const reports=[];
for(const [id,level,decks] of [
 ['jungle-gate-run',m.JUNGLE_GATE_RUN_LEVEL,m.ANCIENT_GATES_DECKS],
 ['bonus-jungle-gate',m.ANCIENT_GATES_BONUS,m.ANCIENT_GATES_BONUS.components.filter(c=>c.t==='mesh'&&!c.outline&&c.s).map(c=>({a:c.p[0]-c.s[0]/2,b:c.p[0]+c.s[0]/2,y:c.p[1]+c.s[1]/2,name:c.nm}))],
]){
 const scenery=level.components.filter(c=>c.grp===90),overlaps=[];
 for(const c of scenery){
  if(c.t==='torch')continue;
  assert.ok(c.solid===false&&c.scenerySolid===false,`${c.nm} can alter collision`);
  assert.ok(c.s?.every(n=>Number.isFinite(n)&&n>0),`${c.nm} has invalid dimensions`);
  if(['ancientgatevalley','ancientgatehoard','treehousetrialssunshaft'].includes(c.dkind))continue;
  const {min,max}=bounds(c);
  if(min[2]>.5||max[2]<-.5)continue;
  for(const d of decks)if(min[0]<d.b-.25&&max[0]>d.a+.25&&min[1]<d.y+3&&max[1]>d.y+.1)
   overlaps.push({scenery:c.nm,deck:d.name,kind:c.dkind,min,max});
 }
 reports.push({id,scenery:scenery.length,explicitlyNonColliding:true,conservativeBodyOverlaps:overlaps});
}
const images=JSON.parse(await readFile('docs/ancient-gates/imagegen-prompts.json','utf8'));
const result={reports,shippedImageBytes:images.shippedImageBytes,images:images.assets.map(a=>({path:a.runtime,bytes:a.bytes,width:a.width,height:a.height}))};
await mkdir('docs/ancient-gates/evidence/art',{recursive:true});
await writeFile('docs/ancient-gates/evidence/art/clearance.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
assert.ok(reports.every(r=>!r.conservativeBodyOverlaps.length),'Scenery overlaps a supported player body corridor');
assert.ok(images.shippedImageBytes<1500000,'Keep the two original-resolution paintings compact');
