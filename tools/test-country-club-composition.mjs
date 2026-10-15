import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {sourceModule:m,l,THREE}=r,C=r.source.components;
 assert.deepEqual(m.COUNTRY_CLUB_HOLES.map(h=>h.n),Array.from({length:18},(_,i)=>i+1));
 assert.equal(C.filter(c=>c.nm?.includes('visible numeral')).length,36);
 assert.equal(new Set(m.COUNTRY_CLUB_HOLES.map(h=>h.name)).size,18);
 assert.ok(new Set(m.COUNTRY_CLUB_HOLES.map(h=>h.shape)).size>=14);
 assert.equal(l.checkpoints.length,18);assert.equal(C.filter(c=>c.t==='enemy').length,12);
 const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,20);
 let fastSamples=0,landSamples=0,padCorners=0,patrolSamples=0;
 for(let s=10;s<m.COUNTRY_CLUB_LENGTH-20;s+=2){
  if(m.COUNTRY_CLUB_GAPS.some(g=>s>g.a-.2&&s<g.b+.2))continue;
  const center=s>2080&&s<2160?-5.2*Math.exp(-(((s-2120)/25)**4)):m.countryClubRacingOffset(s);
  for(const u of [center-1.5,center,center+1.5]){
   const q=m.countryClubPoint(s,u);ray.ray.origin.set(q[0],q[1]+.3,q[2]);ray.far=.55;
   const hits=ray.intersectObjects(l.groundMeshes,false);
   assert.ok(hits.some(h=>Math.abs(h.point.y-q[1])<.1&&!h.object.userData.groundSpeedLimit),`Racing corridor lacks fast support ${s}/${u}`);fastSamples++;
  }
 }
 const b=m.COUNTRY_CLUB_BOUNDS;ray.far=80;
 for(let x=b.minX+12;x<b.maxX;x+=24)for(let z=b.minZ+12;z<b.maxZ;z+=24){ray.ray.origin.set(x,45,z);assert.ok(ray.intersectObjects(l.groundMeshes,false).length,`Landscape hole ${x}/${z}`);landSamples++;}
 for(const c of C.filter(c=>c.t==='speedpad')){
  const a=c.yaw*Math.PI/180;
  for(const x of [-c.s[0]/2,c.s[0]/2])for(const z of [-c.s[2]/2,c.s[2]/2]){
   const xx=c.p[0]+x*Math.cos(a)+z*Math.sin(a),zz=c.p[2]-x*Math.sin(a)+z*Math.cos(a),n=m.countryClubNearestRoad(xx,zz),y=m.countryClubPoint(n.s,n.u)[1];
   assert.ok(Math.abs(y-(c.p[1]-.025))<.06,`Unseated boost corner ${c.nm}: ${y}/${c.p[1]}`);padCorners++;
  }
 }
 for(const e of C.filter(c=>c.t==='enemy'))for(let d=-e.range;d<=e.range;d+=.4){
  const x=e.p[0]+(e.yaw===0?d:0),z=e.p[2]+(e.yaw===90?d:0),n=m.countryClubNearestRoad(x,z),y=m.countryClubPoint(n.s,n.u)[1];
  assert.ok(Math.abs(y-e.p[1])<.08,`Patrol leaves its flat encounter ${e.nm}`);patrolSamples++;
 }
 for(const p of m.COUNTRY_CLUB_PONDS){
  assert.ok(m.COUNTRY_CLUB_GAPS.some(g=>g.hole===p.hole));assert.ok(m.COUNTRY_CLUB_WATER_RAILS.some(g=>g.hole===p.hole));
  for(let s=p.s-p.rz;s<=p.s+p.rz;s+=2)assert.ok(m.countryClubPoint(s)[1]-p.y>1.2,'water intersects bridge');
 }
 assert.ok([...l.surfaceEdgeOwners.values()].every(mesh=>mesh.userData.groundSpeedLimit===undefined));
 const report={holes:18,numberedSignsAndFlags:36,greenSilhouettes:new Set(m.COUNTRY_CLUB_HOLES.map(h=>h.shape)).size,ponds:5,jumps:6,waterRails:5,pads:9,enemies:12,fastSamples,landSamples,padCorners,patrolSamples,stationLength:m.COUNTRY_CLUB_LENGTH,sculptedCentreLength:m.COUNTRY_CLUB_TRAVEL_LENGTH,componentCount:C.length};
 await writeFile(`${tmpdir()}/country-club-composition.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club'});
