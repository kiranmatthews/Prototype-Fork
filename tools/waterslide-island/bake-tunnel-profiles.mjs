import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {WATERPARK_TUNNELS}=await r.server.ssrLoadModule('/src/levels/slipstream-island.ts');
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts'),course=new RaceCourse(r.source.skateRace.line),ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 const floors=r.l.groundMeshes.filter(m=>{const c=r.source.components[m.userData.editorIdx];return c&&c.grp<420&&['mesh','platform','vertramp','terrain','ramp'].includes(c.t)&&!c.outOfBounds&&c.solid!==false;});
 const at=(s,x)=>{const p=course.sample(s,x);ray.set(p.clone().add(new r.THREE.Vector3(0,18,0)),down);ray.far=36;return ray.intersectObjects(floors,false).filter(h=>h.face?.normal.y>.1&&Math.abs(h.point.y-p.y)<17).sort((a,b)=>Math.abs(a.point.y-p.y)-Math.abs(b.point.y-p.y))[0]?.point;};
 const profiles=[];
 for(const [from,to] of WATERPARK_TUNNELS){const rows=[];
  for(let s=from;;s=Math.min(to,s+4)){
   const p=course.sample(s);if(!at(s,0))throw Error('Tunnel floor missing at '+s);
   const edges=[];for(const side of [-1,1]){let inside=0,outside=0;for(let x=.5;x<=35;x+=.5){if(!at(s,x*side)){outside=x;break;}inside=x;}if(!outside)throw Error('No edge at '+s);for(let i=0;i<8;i++){const x=(inside+outside)/2;if(at(s,x*side))inside=x;else outside=x;}edges.push(side*(inside-.06));}
   const heights=[];for(let i=0;i<=16;i++){const x=edges[0]+(edges[1]-edges[0])*i/16,q=at(s,x);if(!q)throw Error('Unsupported cross-section '+s+' '+x);heights.push(q.y-p.y);}
   rows.push([s,...edges,...heights].map(v=>Math.round(v*10000)/10000));if(s===to)break;
  }
  profiles.push({from,to,rows});
 }
 await writeFile(new URL('../../src/levels/slipstream-tunnel-profiles.json',import.meta.url),JSON.stringify(profiles)+'\n');
 console.log(JSON.stringify({tunnels:profiles.length,measuredSections:profiles.reduce((n,p)=>n+p.rows.length,0),floorProbes:profiles.reduce((n,p)=>n+p.rows.length*17,0)}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
