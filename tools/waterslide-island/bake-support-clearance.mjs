import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts'),{WATERSLIDE_ASSETS}=await r.server.ssrLoadModule('/src/waterslideAssets.ts'),course=new RaceCourse(r.source.skateRace.line),ray=new r.THREE.Raycaster();
 const floors=r.l.groundMeshes.filter(m=>{const c=r.source.components[m.userData.editorIdx];return c&&c.grp<420&&['mesh','platform','vertramp','terrain','ramp'].includes(c.t)&&c.solid!==false;});
 const supports=r.source.components.filter(c=>c.dkind==='waterslideflumesupport'),bad=new Map();let probes=0;
 for(let s=10;s<course.length;s+=6)for(const x of [-7,-4,0,4,7]){
  const p=course.sample(s,x);ray.set(p.clone().add(new r.THREE.Vector3(0,16,0)),new r.THREE.Vector3(0,-1,0));ray.far=30;const hit=ray.intersectObjects(floors,false).find(h=>h.face?.normal.y>.1&&Math.abs(h.point.y-p.y)<12);if(!hit)continue;probes++;
  for(const c of supports){const q=hit.point.clone().sub(new r.THREE.Vector3(...c.p)).applyAxisAngle(new r.THREE.Vector3(0,1,0),-(c.yaw||0)*Math.PI/180),size=WATERSLIDE_ASSETS.waterslideflumesupport.size.map(v=>v*c.w);
   if(Math.abs(q.x)<size[0]/2+.7&&Math.abs(q.z)<size[2]/2+.7&&q.y+.05<size[1]&&q.y+4.5>0)bad.set(c.p[0].toFixed(3)+','+c.p[2].toFixed(3),{p:c.p,s,x});
  }
 }
 const path=new URL('../../src/levels/slipstream-support-exclusions.json',import.meta.url),previous=JSON.parse(await readFile(path,'utf8').catch(()=>'[]')),all=[...new Set([...previous,...bad.keys()])];await writeFile(path,JSON.stringify(all,null,2)+'\n');console.log(JSON.stringify({probes,remainingSupports:supports.length,newConflicts:[...bad.values()],excluded:all.length}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
