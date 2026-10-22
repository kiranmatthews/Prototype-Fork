import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// These initial placements isolate architectural clearances. After respawn,
// only controller samples drive the production player and collision code.
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,report={};
 const start=(s,u,y,heading)=>{
  const d=new THREE.Vector3(...heading);
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.mallPoint(s,u,y)),heading:d});
  p.axisF.copy(d);p.axisL.set(-d.z,0,d.x);
 };
 start(53,3,12.1,[-1,0,0]);
 let minimumX=p.pos.x;
 for(let i=0;i<100;i++){r.tick({moveY:1,jumpHeld:true});minimumX=Math.min(minimumX,p.pos.x);}
 report.escalatorSide={minimumX,end:p.pos.toArray(),state:p.state};
 start(95,6,12.1,[-1,0,0]);
 let crossed=false,bail=false;
 for(let i=0;i<100;i++){r.tick({moveY:1,jumpHeld:true});bail||=p.isBailing;if(p.pos.x<0){crossed=true;break;}}
 report.galleryUnderpass={crossed,bail,end:p.pos.toArray(),grounded:p.grounded};
 start(49,3.2,12.1,[0,0,-1]);
 let lowerPeak=12,firstPassage=false,firstBail=false;
 for(let i=0;i<180;i++){
  r.tick({moveY:1,jumpHeld:true});lowerPeak=Math.max(lowerPeak,p.pos.y);firstBail||=p.isBailing;
  if(p.pos.z<m.mallPoint(67)[2]){firstPassage=true;break;}
 }
 report.firstUnderpass={passed:firstPassage,peak:lowerPeak,bail:firstBail,end:p.pos.toArray(),grounded:p.grounded};
 start(92,0,12.1,[0,0,-1]);
 let peak=12,landed=false,air=false;
 for(let i=0;i<240;i++){
  r.tick({jumpHeld:i<60});peak=Math.max(peak,p.pos.y);air||=!p.grounded;
  if(air&&i>60&&p.grounded){landed=true;break;}
 }
 report.soffit={peak,landed,end:p.pos.toArray()};
 const ray=new THREE.Raycaster(new THREE.Vector3(...m.mallPoint(92,0,13)),new THREE.Vector3(0,1,0),0,5);
 const underside=ray.intersectObjects(l.groundMeshes,false)[0];
 report.soffit.surface=underside?{name:underside.object.name,y:underside.point.y,normal:underside.face.normal.toArray()}:null;
 const roof= r.source.components.filter(c=>c.nm==='Continuous mall ceiling');
 report.roofSections=roof.length;
 const roofMeshes=[];l.root.traverse(o=>{if(o.isMesh&&o.name==='Continuous mall ceiling')roofMeshes.push(o);});
 let roofProbes=0;
 for(let s=1;s<318;s+=2)for(const u of [-3,0,3]){
  ray.set(new THREE.Vector3(...m.mallPoint(s,u,m.mallHeight(s)+2)),new THREE.Vector3(0,1,0));ray.far=40;
  assert.ok(ray.intersectObjects(roofMeshes,false).length,`Ceiling gap at ${s}, ${u}`);roofProbes++;
 }
 report.roofProbes=roofProbes;
 await writeFile('/private/tmp/mall-recreation/structures.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 assert.ok(minimumX>.7,'The escalator body must block a sideways approach from the lower floor');
 assert.ok(crossed&&!bail&&p.totalDeaths===0,'The gallery must leave a usable lower passage');
 assert.ok(firstPassage&&!firstBail&&lowerPeak<12.2,'The entrance must connect beneath the first concourse beside its escalator');
 assert.ok(air&&landed&&peak<16.35,'A jump below the deck must return to the lower floor');
 assert.ok(underside&&Math.abs(underside.point.y-16.35)<.01&&underside.face.normal.y<-.99,'The gallery must have a real downward-facing soffit');
 assert.equal(roof.length,3,'The roof is three joined continuous meshes');
},{modulePath:'/src/levels/mall.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:1000,controlFrame:r=>r.p.axisF});
