import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {sourceModule:m,l,THREE}=r,C=r.source.components;
 assert.deepEqual(m.COUNTRY_CLUB_HOLES.map(h=>h.n),Array.from({length:18},(_,i)=>i+1));
 assert.equal(C.filter(c=>c.nm?.includes('visible cup number')).length,18);
 assert.equal(new Set(m.COUNTRY_CLUB_HOLES.map(h=>h.name)).size,18);
 assert.ok(new Set(m.COUNTRY_CLUB_HOLES.map(h=>h.shape)).size===18);
 assert.equal(l.checkpoints.length,18);assert.equal(C.filter(c=>c.t==='enemy').length,12);
 const ray=new THREE.Raycaster(undefined,new THREE.Vector3(0,-1,0),0,20);
 let fastSamples=0,landSamples=0,padCorners=0,patrolSamples=0;
 for(let s=10;s<m.COUNTRY_CLUB_LENGTH-20;s+=2){
  if(m.COUNTRY_CLUB_GAPS.some(g=>s>g.a-.2&&s<g.b+.2))continue;
  const center=m.countryClubRacingOffset(s);
  for(const u of [center-1.5,center,center+1.5]){
   const q=m.countryClubPoint(s,u);ray.ray.origin.set(q[0],q[1]+.3,q[2]);ray.far=.55;
   const hits=ray.intersectObjects(l.groundMeshes,false);
   assert.ok(hits.some(h=>Math.abs(h.point.y-q[1])<.1&&!h.object.userData.groundSpeedLimit),`Racing corridor lacks fast support ${s}/${u}`);fastSamples++;
  }
 }
 const b=m.COUNTRY_CLUB_BOUNDS;ray.far=200;
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
 assert.equal(C.filter(c=>c.nm?.endsWith('/ numbered cup flag')).length,18);
 assert.equal(C.filter(c=>c.nm?.endsWith('/ cup flagpole')).length,18);
 assert.equal(C.filter(c=>c.nm?.endsWith('/ tee marker')).length,36);
 assert.ok(!C.some(c=>/tee sign|numbered tee|visible numeral/.test(c.nm??'')));
 const golf=m.COUNTRY_CLUB_HOLES.map(h=>{const near=m.countryClubNearestRoad(...h.cup),field=m.countryClubGolfField(...h.cup);assert.equal(field.green,h.n,'cup outside its green');assert.equal(field.bunker,0,'cup planted in bunker');
  const y=m.countryClubGroundHeight(...h.cup);assert.equal(l.swimmingSurfaceAt(h.cup[0],h.cup[1],y+.008),null,'cup is in water: '+h.n);ray.ray.origin.set(h.cup[0],y+.5,h.cup[1]);ray.far=1;
  const hits=ray.intersectObjects(l.groundMeshes,false);const top=hits.find(q=>q.object.userData.groundSpeedLimit!==undefined);
  assert.ok(top&&Math.abs(top.point.y-y)<.025,'cup is buried in another surface: '+h.n);
  assert.ok(near.distance>m.countryClubWidth(near.s)/2+3,'cup touches the graded racing shoulder: '+h.n);
  return {number:h.n,tee:h.tee,cup:h.cup,length:h.golfLength,raceDistance:near.distance,greenClearOfRace:near.distance>m.countryClubWidth(near.s)/2+Math.max(h.rx,h.rz)+3};});
 assert.ok(golf.filter(h=>h.greenClearOfRace).length>=12,'too many holes still form track sections');
 assert.ok(golf.every(h=>h.length>100),'missing tee-to-green approach');
 const trees=C.filter(c=>c.t==='decor'&&c.dkind==='tree');assert.ok(trees.every(c=>!m.countryClubGolfField(c.p[0],c.p[2]).fairway&&m.COUNTRY_CLUB_HOLES.every(h=>Math.hypot(c.p[0]-h.tee[0],c.p[2]-h.tee[1])>=12)),'tree obstructs a tee or fairway');
 assert.ok(m.COUNTRY_CLUB_CORNERS.length>=5&&m.COUNTRY_CLUB_CORNERS.every(c=>c.angle>=75&&c.radius<=25),'corners are still broad curves');
 const report={holes:18,numberedCupFlags:18,teeMarkers:36,golf,sharpCorners:m.COUNTRY_CLUB_CORNERS,greenSilhouettes:new Set(m.COUNTRY_CLUB_HOLES.map(h=>h.shape)).size,ponds:5,jumps:6,waterRails:5,pads:m.COUNTRY_CLUB_PADS.length,enemies:12,fastSamples,landSamples,padCorners,patrolSamples,stationLength:m.COUNTRY_CLUB_LENGTH,sculptedCentreLength:m.COUNTRY_CLUB_TRAVEL_LENGTH,componentCount:C.length};
 await writeFile(`${tmpdir()}/country-club-composition.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club'});
