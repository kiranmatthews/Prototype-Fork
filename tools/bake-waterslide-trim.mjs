import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Fit panel seams and rolled lip trim to native floor triangles. No guessed
// course widths, hidden bridges, collision changes or runtime fitting work.
await withBlockworksRuntime(async r=>{
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts');
 const course=new RaceCourse(r.source.skateRace.line),ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 const ground=r.l.groundMeshes.filter(m=>{const c=r.source.components[m.userData.editorIdx];return c&&['platform','vertramp','terrain','mesh','ramp'].includes(c.t)&&c.solid!==false&&!c.lethal&&!c.outOfBounds&&c.grp<420;});
 const gaps=r.source.skateRace.jumps.map(j=>[course.project(new r.THREE.Vector3(...j.takeoff)).s-3,course.project(new r.THREE.Vector3(...j.landing)).s+3]);
 const inGap=s=>gaps.some(([a,b])=>s>=a&&s<=b);
 const hit=(s,u)=>{
  const p=course.sample(s,u);ray.set(p.clone().addScaledVector(down,-18),down);ray.far=30;
  const h=ray.intersectObjects(ground,false).filter(h=>h.face?.normal.y>.1&&h.point.y-p.y>-9&&h.point.y-p.y<17).sort((a,b)=>Math.abs(a.point.y-p.y)-Math.abs(b.point.y-p.y))[0];
  return h?h.point.clone().addScaledVector(down,-.035):null;
 };
 const batches=new Map();
 const batch=s=>{const key=Math.floor(s/120);if(!batches.has(key))batches.set(key,{p:course.sample(s).toArray(),vertices:[],indices:[]});return batches.get(key);};
 const quad=(s,a,b,c,d)=>{
  if([a,b,c,d].some(p=>!p))return;
  const row=batch(s),offset=row.vertices.length/3;
  for(const p of [a,b,c,d])row.vertices.push(...p.toArray().map((v,i)=>Math.round((v-row.p[i])*10000)/10000));
  row.indices.push(offset,offset+1,offset+2,offset+2,offset+1,offset+3);
 };
 let previous=null,sections=0,seams=0;
 for(let s=0;s<course.length-1;s+=2){
  if(inGap(s)||!hit(s,0)){previous=null;continue;}
  const edges=[];
  for(const side of [-1,1]){
   let u=0;for(let next=.5;next<=28;next+=.5){if(!hit(s,next*side))break;u=next;}
   if(u<3){edges.push(null);continue;}
   let outside=u+.5;for(let i=0;i<6;i++){const middle=(u+outside)/2;if(hit(s,middle*side))u=middle;else outside=middle;}
   edges.push({u:side*(u-.25),inner:hit(s,side*(u-.52)),outer:hit(s,side*(u-.1))});
  }
  if(previous&&s-previous.s===2)for(let i=0;i<2;i++){
   const a=previous.edges[i],b=edges[i];
   if(!a?.inner||!a.outer||!b?.inner||!b.outer||a.outer.distanceTo(b.outer)>6)continue;
   quad(s,a.inner,a.outer,b.inner,b.outer);
   quad(s,a.outer,a.outer.clone().addScaledVector(down,.48),b.outer,b.outer.clone().addScaledVector(down,.48));sections++;
  }
  if(s%24===12&&edges.every(Boolean)){
   for(let u=edges[0].u;u<edges[1].u;u+=.5){const v=Math.min(edges[1].u,u+.5);quad(s,hit(s-.12,u),hit(s-.12,v),hit(s+.12,u),hit(s+.12,v));}
   seams++;
  }
  previous={s,edges};
 }
 const components=[...batches.values()].map(({p,vertices,indices})=>({t:'mesh',p:p.map(v=>Math.round(v*10000)/10000),vertices,indices,tex:'metal',color:'#d2c8a8',solid:false,doubleSided:true,edgeGrinding:false,castShadow:false,grp:431,nm:'Weathered fiberglass flanges'}));
 if(components.some(c=>c.indices.length>12288))throw Error('Trim cell exceeds editor geometry limit');
 await writeFile(new URL('../src/levels/slipstream-waterslide-trim.json',import.meta.url),JSON.stringify(components)+'\n');
 console.log(JSON.stringify({cells:components.length,edgeSections:sections,seams,triangles:components.reduce((n,c)=>n+c.indices.length/3,0)}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
