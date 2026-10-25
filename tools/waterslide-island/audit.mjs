import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts'),{WATERPARK_TUNNELS}=await r.server.ssrLoadModule('/src/levels/slipstream-island.ts'),{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(r.source));const course=new RaceCourse(r.source.skateRace.line),ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 const original=r.l.groundMeshes.filter(m=>{const c=r.source.components[m.userData.editorIdx];return c&&c.grp<420&&['mesh','platform','vertramp','terrain','ramp'].includes(c.t)&&c.solid!==false;});
 const floor=(s,x=0)=>{const p=course.sample(s,x);ray.set(p.clone().add(new r.THREE.Vector3(0,18,0)),down);ray.far=36;return ray.intersectObjects(original,false).filter(h=>h.face?.normal.y>.1&&Math.abs(h.point.y-p.y)<17).sort((a,b)=>Math.abs(a.point.y-p.y)-Math.abs(b.point.y-p.y))[0]?.point;};
 const shells=[];r.scene.traverse(o=>{if(o.isMesh&&/^Enclosed flume \d+ \/ inner$/.test(o.name))shells.push(o);});
 const reports=[],issues=[];let rays=0,columnProbes=0;
 for(const [index,[a,b]] of WATERPARK_TUNNELS.entries()){
  const {WATERPARK_SKYLIGHTS}=await r.server.ssrLoadModule('/src/levels/slipstream-island.ts');
  const own=shells.filter(o=>o.name===`Enclosed flume ${index+1} / inner`),row={tunnel:index+1,from:a,to:b,sections:0,openRoofSamples:0,maxLinerGap:0,minHeadroom:Infinity};assert.ok(own.length);
  for(let s=a+7.5;s<b-5;s+=9.3){const p=floor(s);assert.ok(p,'Native floor '+s);const origin=p.clone().add(new r.THREE.Vector3(0,2.5,0)),f=course.tangent(s),right=new r.THREE.Vector3(-f.z,0,f.x).normalize();
   for(const [name,dir] of [['roof',new r.THREE.Vector3(0,1,0)],['floor',down],['left',right.clone().negate()],['right',right]]){
    ray.set(origin,dir);ray.near=0;ray.far=80;rays++;const hit=ray.intersectObjects(own,false)[0];if(!hit){
     if(name==='roof'&&WATERPARK_SKYLIGHTS.some(g=>g.tunnel===index&&Math.abs(s-g.s)<g.length/2+5))row.openRoofSamples++;
     else issues.push({tunnel:index+1,s,missing:name});continue;
    }
    if(name==='floor'){const gap=hit.distance-2.5;row.maxLinerGap=Math.max(row.maxLinerGap,gap);if(gap>1.1||gap<-.06)issues.push({tunnel:index+1,s,floorGap:gap});}
    if(name==='roof'){row.minHeadroom=Math.min(row.minHeadroom,hit.distance+2.5);if(hit.distance<6)issues.push({tunnel:index+1,s,headroom:hit.distance+2.5});}
   }row.sections++;
  }assert.ok(row.openRoofSamples>0,'Every enclosure has real openings to the sky');reports.push(row);
 }
 const {WATERSLIDE_ASSETS}=await r.server.ssrLoadModule('/src/waterslideAssets.ts');
 const trestles=r.source.components.filter(c=>c.dkind==='waterslideflumesupport');
 const columns=r.source.components.filter(c=>c.nm==='Weathered structural column').map(c=>new r.THREE.Box3().setFromCenterAndSize(new r.THREE.Vector3(...c.p),new r.THREE.Vector3(...c.s)));
 for(let s=10;s<course.length;s+=6)for(const x of [-7,-4,0,4,7]){
  const p=floor(s,x);if(!p)continue;columnProbes++;const body=new r.THREE.Box3().setFromCenterAndSize(p.clone().add(new r.THREE.Vector3(0,2.3,0)),new r.THREE.Vector3(1.4,4.5,1.4));if(columns.some(c=>c.intersectsBox(body)))issues.push({s,x,columnIntersectsRidingSpace:true});
  for(const c of trestles){const q=p.clone().sub(new r.THREE.Vector3(...c.p)).applyAxisAngle(r.THREE.Object3D.DEFAULT_UP,-(c.yaw??0)*Math.PI/180),size=WATERSLIDE_ASSETS.waterslideflumesupport.size.map(v=>v*(c.w??1));
   if(Math.abs(q.x)<size[0]/2+.7&&Math.abs(q.z)<size[2]/2+.7&&q.y+.05<size[1]&&q.y+4.5>0)issues.push({s,x,trestleIntersectsRidingSpace:c.p});
  }
 }
 assert.ok(r.source.components.filter(c=>/^Waterpark (hillside|gorge|valley)/.test(c.nm??'')).every(c=>c.invisible),'Retired broad tiled landscape must not draw');
 assert.equal(r.source.components.filter(c=>c.swimDepth).length,8);assert.equal(r.source.skateRace.jumps.length,18);
 const report={tunnels:reports,rays,columnProbes,columns:columns.length,trestles:trestles.length,issues};const output=process.env.ISLAND_AUDIT_OUTPUT||join(tmpdir(),'waterslide-island-audit.json');await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert.deepEqual(issues,[]);
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
