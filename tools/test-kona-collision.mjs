import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.KONA_OUTPUT||'/private/tmp/kona-collision';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m,THREE}=r,report={scale:m.KONA_SCALE,walls:[],transitions:[]};
 assert.equal(m.KONA_SCALE,.025,'The whole park must be twice the original survey pass');
 assert.ok(l.walls.length>100,'Imported edge walls and ramp backs need physical colliders');
 const candidates=[];
 for(const wall of m.KONA_WALLS){
  const dx=wall.b[0]-wall.a[0],dz=wall.b[2]-wall.a[2],len=Math.hypot(dx,dz);
  if(wall.height<1.2||len<3)continue;
  const mid=wall.a.map((v,i)=>(v+wall.b[i])/2);
  for(const side of [-1,1]){
   const normal=[dz/len*side,0,-dx/len*side],start=[mid[0]+normal[0]*3,0,mid[2]+normal[2]*3];
   start[1]=m.konaSupport(start[0],start[2]);
   if(!Number.isFinite(start[1])||start[1]<mid[1]-.1||start[1]>mid[1]+wall.height-1)continue;
   candidates.push({wall,mid,normal,start,len});
  }
 }
 // Boundary, both mini backs, timber structure, long quarter and varied walls.
 const selected=[],used=new Set();
 for(const id of [1,88,130,78,23,...new Set(candidates.map(c=>c.wall.source))]){
  for(const c of candidates.filter(c=>c.wall.source===id).sort((a,b)=>b.len-a.len).slice(0,3)){
   if(used.has(c))continue;used.add(c);selected.push(c);
  }
  if(selected.length>=24)break;
 }
 assert.ok(selected.length>=12,'Need broad wall-approach coverage');
 for(const c of process.env.KONA_APPROACH_ONLY?[]:selected)for(const glance of (c.len>10?[0,.65]:[0])){
  const heading=new THREE.Vector3(-c.normal[0]-c.normal[2]*glance,0,-c.normal[2]+c.normal[0]*glance).normalize();
  p.respawn(l,true,false,{position:new THREE.Vector3(c.start[0],c.start[1]+.06,c.start[2]),heading});
  // Initial facing is fixture setup; after this every movement is real input.
  p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  let penetrated=false,closest=3,bails=0;
  for(let frame=0;frame<100;frame++){
   r.tick({moveY:1});
   const distance=(p.pos.x-c.mid[0])*c.normal[0]+(p.pos.z-c.mid[2])*c.normal[2];
   closest=Math.min(closest,distance);bails+=Number(p.isBailing);
   const along=((p.pos.x-c.mid[0])*(c.wall.b[0]-c.wall.a[0])+(p.pos.z-c.mid[2])*(c.wall.b[2]-c.wall.a[2]))/c.len;
   if(Math.abs(along)<c.len/2&&p.pos.y<c.mid[1]+c.wall.height-.1&&p.pos.y+1>c.mid[1]+.1&&distance<-.15)penetrated=true;
   if(p.state==='dead'||p.state==='gameover')break;
  }
  report.walls.push({source:c.wall.source,glance,mid:c.mid,normal:c.normal,start:c.start,closest,penetrated,bails,end:r.snapshot()});
 }
 // Ordinary uncharged, angled and charged approaches from the flat floor.
 // Also measure feet clearance against the actual refined surface each step.
 for(const [i,pipe] of (process.env.KONA_WALL_ONLY?[]:m.KONA_PIPES).entries())for(const side of [-1,1])for(const angle of [0,.25]){
  if(process.env.KONA_APPROACH_ONLY&&process.env.KONA_APPROACH_ONLY!==`${i}:${side}:${angle}`)continue;
  const heading=new THREE.Vector3(side,0,angle).normalize();
  const samples=[];
  p.respawn(l,true,false,{position:new THREE.Vector3(pipe.centre[0],pipe.centre[1]+.06,pipe.centre[2]),heading});
  p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  let worstPenetration=0,climbed=0,transitionFrames=0,bailed=false,airFrames=0,returned=false;
  for(let frame=0;frame<260;frame++){
   // Neutral-air coverage complements test-kona-flow, which keeps Up held.
   r.tick(p.grounded?{moveY:1,jumpHeld:angle!==0}:{});
   climbed=Math.max(climbed,p.pos.y-pipe.centre[1]);
   if(frame%3===0)samples.push({frame,p:p.pos.toArray(),normal:p.groundHit?.normal.toArray(),ride:p.rideNormal.toArray(),heading:p.axisF.toArray(),state:p.state,vertAir:p.vertAir});
   if(p.groundHit?.vert)transitionFrames++;
   if(!p.grounded)airFrames++;
   if(p.grounded&&p.groundHit?.vert){
    const surface=m.konaSupport(p.pos.x,p.pos.z,p.pos.y+2);
    if(Number.isFinite(surface))worstPenetration=Math.max(worstPenetration,surface-p.pos.y);
   }
   bailed||=p.isBailing;
   if(climbed>.7&&p.grounded&&p.pos.y<pipe.centre[1]+.25&&p.groundHit?.vert){returned=true;break;}
   if(p.totalDeaths||p.isBailing)break;
  }
  report.transitions.push({pipe:i,side,angle,climbed,transitionFrames,worstPenetration,bailed,airFrames,returned,samples,end:r.snapshot()});
 }
 await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({scale:report.scale,walls:report.walls.map(({source,closest,penetrated})=>({source,closest,penetrated})),transitions:report.transitions.map(({end,samples,...v})=>v)},null,2));
 assert.ok(report.walls.every(w=>!w.penetrated),'A grounded approach crossed a solid wall');
 if(!process.env.KONA_APPROACH_ONLY){
  assert.ok(report.walls.filter(w=>w.closest<1).length>=20,'At least twenty approaches must reach the collider');
  for(const source of [1,88,130])assert.ok(report.walls.some(w=>w.source===source&&w.closest<1),'Boundary and both ramp structures must receive real contact');
 }
 assert.ok(report.transitions.every(v=>v.transitionFrames>15&&v.climbed>.7&&v.worstPenetration<.12&&!v.bailed&&v.returned),'A pipe approach clipped, failed to return, or bailed');
 console.log(`PASS doubled scale, ${report.walls.length} wall approaches, and ${report.transitions.length} ordinary pipe approaches`);
},{modulePath:'/src/levels/kona.ts',source:m=>m.KONA_LEVEL,levelId:'kona',controlFrame:r=>r.p.axisF,maxFrames:12000});
