import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withThemedBonusRuntime} from '../test-themed-bonus-puzzles.mjs';
const baseline=JSON.parse(await readFile('tools/blockworks-art/bonus-physics-baseline.json','utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rounded=n=>Math.round(n*1e6)/1e6;
const sourceTriangles=c=>{
 const scale=c.s??[1,1,1],angle=(c.yaw??0)*Math.PI/180,co=Math.cos(angle),si=Math.sin(angle);
 const points=[];for(let i=0;i<c.vertices.length;i+=3){const x=c.vertices[i]*scale[0],y=c.vertices[i+1]*scale[1],z=c.vertices[i+2]*scale[2];points.push([c.p[0]+co*x+si*z,c.p[1]+y,c.p[2]-si*x+co*z].map(rounded));}
 const triangles=[];for(let i=0;i<c.indices.length;i+=3)triangles.push(c.indices.slice(i,i+3).map(j=>points[j]).map(v=>v.join(',')).sort().join(';'));
 return triangles.sort();
};
const canonical=c=>{
 const o={...c};for(const k of ['dkind','tex','color','emissive','artProxy'])delete o[k];if(c.t==='pit')delete o.invisible;
 if(c.t==='mesh'){o.triangles=sourceTriangles(c);for(const k of ['vertices','indices','s'])delete o[k];}
 return Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
};
await withThemedBonusRuntime('bonus-codex-switchback',async r=>{
 const {source,l,THREE}=r,native=source.components.filter(c=>c.grp!==90),before=baseline.data.components;
 assert.deepEqual(native.map(canonical),before.map(canonical),'bonus gameplay geometry, switch wiring, crates and camera changed');
 assert.deepEqual(source.spawn,baseline.data.spawn);assert.equal(source.killY,baseline.data.killY);assert.equal(source.cameraAirLift,baseline.data.cameraAirLift);
 assert.equal(source.name,'Bonus: Haunted Hassle');assert.equal(source.sky,'haunted');
 const {CODEX_LAB_LEVEL}=await r.server.ssrLoadModule('/src/levels/codex-lab.ts');assert.equal(CODEX_LAB_LEVEL.name,'Haunted Hassle');assert.deepEqual(source.atmosphere,CODEX_LAB_LEVEL.atmosphere);
 const {campaignLevelById}=await r.server.ssrLoadModule('/src/campaign.ts');assert.equal(campaignLevelById('codex-lab').name,'Haunted Hassle');assert.equal(campaignLevelById('codex-lab').progressKey,'codex-switchback');
 const art=source.components.filter(c=>c.grp===90);assert.ok(art.length>60);
 for(const c of art){assert.equal(c.t,'decor');assert.ok(c.dkind.startsWith('bw-'));assert.equal(c.scenerySolid,false);assert.equal(c.solid,false);}
 const old=new r.Level(new THREE.Scene(),{id:baseline.id,name:baseline.data.name,data:baseline.data});
 const geometry=level=>{
  level.root.updateMatrixWorld(true);return level.groundMeshes.map(mesh=>{
   const p=mesh.geometry.attributes.position,ix=mesh.geometry.index,points=[],triangles=[];
   for(let i=0;i<p.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld).toArray().map(rounded).join(','));
   for(let i=0;i<(ix?.count??p.count);i+=3)triangles.push([0,1,2].map(j=>points[ix?ix.getX(i+j):i+j]).sort().join(';'));
   return triangles.sort().join('|');
  }).sort();
 };
 const states=[];
 for(let step=0;step<4;step++){
  if(step===1||step===2)for(const level of [old,l])level.triggerBang(level.crates.filter(c=>c.bang)[step-1]);
  if(step===3)for(const level of [old,l])level.reset(true);
  assert.deepEqual(geometry(l),geometry(old),'native ground changed at switch state '+step);
  states.push({step,groundMeshes:l.groundMeshes.length,sha256:hash(geometry(l))});
 }
 assert.equal(l.totalCrates,old.totalCrates);old.dispose();
 const report={checkedAt:new Date().toISOString(),nativeComponents:native.length,sourceGeometrySha256:hash(native.map(canonical)),groundStates:states,artComponents:art.length,countedCrates:l.totalCrates,sky:source.sky,atmosphereMatchesMain:true,identityPreserved:true};
 await writeFile('docs/blockworks-art/bonus/geometry-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
});
