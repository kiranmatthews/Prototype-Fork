// Deep review probe: where the nine Temple of Embers sentinels actually burn.
// Steps every firetiki through one full cycle with the production TempleBreath,
// projects each hot contact box into station space (s along the route, side
// across it, y up) and tests the authored targets against that sweep map:
// every crate's collection footprint, the fuse-court refuges, checkpoints,
// masks and the five pilot lanes. Also records pure geometry that the review
// needs (gap fall landings, checkpoint/nitro spacing, guardian lane widths,
// suspended-cap lip offsets). Nothing here changes level data or tuning.
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const OUT=process.env.TEMPLE_DEEP_OUTPUT||'docs/temple-embers-design/deep';
await mkdir(OUT,{recursive:true});

await withBlockworksRuntime(async r=>{
 const {l,p,THREE,CONST,TUNING}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE;
 const hitboxHalf={...p.hitboxHalf},bodyHeight=hitboxHalf.y*2;
 const far=new THREE.Vector3(1e5,0,1e5);
 const dt=1/120;
 const local=q=>route.toLocal(Array.isArray(q)?q:q.toArray());
 // Station-space footprint of a world AABB, using the lane frame at its centre.
 const footprint=box=>{
  const c=box.getCenter(new THREE.Vector3()),h=box.getSize(new THREE.Vector3()).multiplyScalar(.5);
  const [s,,side]=local(c),f=route.frameAt(s);
  let s0=Infinity,s1=-Infinity,d0=Infinity,d1=-Infinity;
  for(const dx of [-h.x,h.x])for(const dz of [-h.z,h.z]){
   const ds=(dx*f.fx+dz*f.fz)/f.scale,dd=-dx*f.fz+dz*f.fx;
   s0=Math.min(s0,s+ds);s1=Math.max(s1,s+ds);d0=Math.min(d0,side+dd);d1=Math.max(d1,side+dd);
  }
  return {s0,s1,side0:d0,side1:d1,y0:box.min.y,y1:box.max.y};
 };
 const hits=(a,b)=>a.s0<=b.s1&&a.s1>=b.s0&&a.side0<=b.side1&&a.side1>=b.side0&&a.y0<=b.y1&&a.y1>=b.y0;
 // 1. Sweep map per sentinel.
 const tikis=[];
 for(const [index,tiki]of l.fireTikis.entries()){
  const spec=tiki.spec,cycle=spec.cycle??7.8,steps=Math.round(cycle/dt);
  const head=local(spec.p),frames=[];
  for(let k=0;k<steps;k++){
   const t=k*dt;tiki.update(t,far);
   const boxes=tiki.boxes.filter(b=>!b.isEmpty()).map(footprint);
   if(boxes.length)frames.push({t:+t.toFixed(4),phase:tiki.state.phase,boxes});
  }
  const all=frames.flatMap(f=>f.boxes);
  const sign=Math.sign(head[2])||1; // head side; flames travel toward -sign
  const centreLine=all.filter(b=>b.side0<=.5&&b.side1>=-.5);
  const farthest=all.length?Math.min(...all.map(b=>sign>0?b.side0:-b.side1))*(sign>0?1:1):null;
  tikis.push({index:index+1,nm:spec.nm,phase:spec.phase,range:spec.range,amp:spec.amp,cycle,
   head:{s:+head[0].toFixed(2),y:+head[1].toFixed(2),side:+head[2].toFixed(2)},
   hotFrames:frames.length,hotSeconds:+(frames.length*dt).toFixed(2),hotBoxes:all.length,
   fireWindow:(()=>{const a=((.70*cycle-(spec.phase??0))%cycle+cycle)%cycle;return [+a.toFixed(2),+((a+.23*cycle)%cycle).toFixed(2)];})(),
   extent:all.length?{s0:+Math.min(...all.map(b=>b.s0)).toFixed(2),s1:+Math.max(...all.map(b=>b.s1)).toFixed(2),
    sideNear:+(sign>0?Math.max(...all.map(b=>b.side1)):Math.min(...all.map(b=>b.side0))).toFixed(2),
    sideFar:+(sign>0?Math.min(...all.map(b=>b.side0)):Math.max(...all.map(b=>b.side1))).toFixed(2),
    y0:+Math.min(...all.map(b=>b.y0)).toFixed(2),y1:+Math.max(...all.map(b=>b.y1)).toFixed(2)}:null,
   centreLine:centreLine.length?{s0:+Math.min(...centreLine.map(b=>b.s0)).toFixed(2),s1:+Math.max(...centreLine.map(b=>b.s1)).toFixed(2)}:null,
   farthestReachPastHeadSide:farthest===null?null:+farthest.toFixed(2),
   frames});
 }
 // Exposure of a station-space target box against one sentinel's frames.
 const exposure=(target,tiki)=>{
  const times=tiki.frames.filter(f=>f.boxes.some(b=>hits(b,target))).map(f=>f.t);
  if(!times.length)return null;
  const cycle=tiki.cycle,sorted=[...times].sort((a,b)=>a-b);
  let longestSafe=0;for(let i=0;i<sorted.length;i++){const next=i+1<sorted.length?sorted[i+1]:sorted[0]+cycle;longestSafe=Math.max(longestSafe,next-sorted[i]);}
  return {tiki:tiki.index,hotSeconds:+(times.length*dt).toFixed(2),fraction:+(times.length*dt/cycle).toFixed(3),
   first:+sorted[0].toFixed(2),last:+sorted.at(-1).toFixed(2),longestSafeWindow:+longestSafe.toFixed(2)};
 };
 const exposeAll=target=>tikis.map(t=>exposure(target,t)).filter(Boolean);
 const bodyAt=(s,side,up=0)=>{const y=route.groundAt(s)+up;return {s0:s-hitboxHalf.x,s1:s+hitboxHalf.x,side0:side-hitboxHalf.z,side1:side+hitboxHalf.z,y0:y,y1:y+bodyHeight};};
 // 2. Crates: the box itself and the collector standing beside it.
 const kind=c=>c.nitroBang?'nitrobang':c.bang?'bang':c.metalBounce?'metalbounce':c.metal?'metal':c.nitro?'nitro':c.tnt?'tnt':c.mask?'mask':c.life?'life':c.multiHit?'multihit':c.mystery?'mystery':c.bouncy?'bouncy':'wood';
 const crates=[];
 for(const c of l.crates){
  const fp=footprint(c.box),[s,,side]=local(c.box.getCenter(new THREE.Vector3()));
  const ground=route.groundAt(s);
  const collector={s0:fp.s0-1.6,s1:fp.s1+1.6,side0:fp.side0-1.6,side1:fp.side1+1.6,y0:Math.min(fp.y0,ground)-.05,y1:Math.max(fp.y1,Math.min(fp.y0,ground)+bodyHeight+.4)};
  const strict={s0:fp.s0-.3,s1:fp.s1+.3,side0:fp.side0-.3,side1:fp.side1+.3,y0:fp.y0-.3,y1:fp.y1+.3};
  const inBox=exposeAll(strict),inCollector=exposeAll(collector);
  if(!inBox.length&&!inCollector.length)continue;
  crates.push({s:+s.toFixed(1),side:+side.toFixed(2),y:+fp.y0.toFixed(2),kind:kind(c),outline:!!c.wasOutline,nm:l.crates.indexOf(c),crateExposed:inBox,collectorExposed:inCollector});
 }
 // 3. Refuges, caches, checkpoints, masks and lanes.
 const refuges=[];
 for(const [s,label]of [[371.5,'summit fuse court refuge'],[818.5,'cloud fuse court refuge']])
  for(const side of [-1.1,0,1.1,-2.3])refuges.push({label,s,side,exposed:exposeAll(bodyAt(s,side))});
 const checkpoints=l.checkpoints.map(cp=>{const fp=footprint(cp.box),[s,,side]=local(cp.spawnPos);return {s:+s.toFixed(1),side:+side.toFixed(2),boxExposed:exposeAll({s0:fp.s0-.3,s1:fp.s1+.3,side0:fp.side0-.3,side1:fp.side1+.3,y0:fp.y0-.3,y1:fp.y1+.3}),
  collectorExposed:exposeAll({s0:fp.s0-1.6,s1:fp.s1+1.6,side0:fp.side0-1.6,side1:fp.side1+1.6,y0:fp.y0-.05,y1:fp.y0+bodyHeight+.4}),
  spawnBodyExposed:exposeAll(bodyAt(s,side))};});
 const lanes=[];
 for(const tiki of tikis){
  const laneReport={tiki:tiki.index,head:tiki.head,lanes:{}};
  for(const side of [-3.15,-1.25,0,1.25,3.15]){
   let s0=Infinity,s1=-Infinity,worst=0;
   for(let s=tiki.head.s-12;s<=tiki.head.s+12;s+=.25){
    const e=exposure(bodyAt(s,side),tiki);if(!e)continue;s0=Math.min(s0,s);s1=Math.max(s1,s);worst=Math.max(worst,e.fraction);
   }
   laneReport.lanes[side]=s0===Infinity?null:{s0:+s0.toFixed(2),s1:+s1.toFixed(2),worstFraction:worst};
  }
  lanes.push(laneReport);
 }
 // 4. Geometry the review needs: gap landings, checkpoint/nitro spacing,
 //    guardian lane widths and suspended-cap lip offsets.
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const gaps=route.gaps.map(g=>{
  const probes=[];
  for(let s=g.a+.5;s<g.b;s+=1)for(const side of [-5.4,-4.6,-4.2,-3.5,0,3.5,4.2,4.6,5.4]){
   const q=new THREE.Vector3(...route.toWorld(s,g.y-.3,side));ray.set(q,down);ray.far=250;
   const hit=ray.intersectObjects(l.groundMeshes,false)[0];
   const pit=l.pitBoxes.some(b=>q.x>=b.min.x&&q.x<=b.max.x&&q.z>=b.min.z&&q.z<=b.max.z&&!l.pitMissesPoly(b,q.x,q.z));
   probes.push({s,side,pitBelow:pit,landing:hit?{drop:+(g.y-hit.point.y).toFixed(1),y:+hit.point.y.toFixed(1),name:hit.object.name||hit.object.userData?.name||null}:null});
  }
  return {...g,killY:l.killY,probes};
 });
 const nitroBoxes=l.crates.filter(c=>c.nitro).map(c=>({box:c.box,local:local(c.box.getCenter(new THREE.Vector3()))}));
 const checkpointNitro=l.checkpoints.map(cp=>{
  const [s,,side]=local(cp.spawnPos);
  const nearest=nitroBoxes.map(n=>({s:+n.local[0].toFixed(1),side:+n.local[2].toFixed(2),distance:+n.box.distanceToPoint(cp.spawnPos).toFixed(2)})).sort((a,b)=>a.distance-b.distance)[0];
  return {checkpoint:+s.toFixed(1),side:+side.toFixed(2),nearestNitro:nearest};
 }).filter(q=>q.nearestNitro&&q.nearestNitro.distance<12);
 const guardians=l.enemies.map(e=>{
  const home=local(e.group.position),a=e.group.position.clone(),b=e.group.position.clone();
  a[e.axis]=e.x0;b[e.axis]=e.x1;const la=local(a),lb=local(b);
  const size=e.box.getSize(new THREE.Vector3());
  return {foe:e.kind,s:+home[0].toFixed(1),side:+home[2].toFixed(2),axis:e.axis,speed:e.speed,
   patrol:{from:{s:+la[0].toFixed(2),side:+la[2].toFixed(2)},to:{s:+lb[0].toFixed(2),side:+lb[2].toFixed(2)}},box:{w:+size.x.toFixed(2),h:+size.y.toFixed(2)}};
 });
 const caps=[];
 for(const pipe of route.pipes){
  const half=(pipe.b-pipe.a)/2,deck=2,wall=pipe.radius*Math.sin(pipe.arc*Math.PI/180),flat=half-wall-deck,mid=(pipe.a+pipe.b)/2;
  const lipEntry=mid-flat-wall,lipExit=mid+flat+wall;
  for(const c of l.crates){const [s,y,side]=local(c.box.getCenter(new THREE.Vector3()));
   if(Math.abs(side)>.6||c.box.min.y<pipe.lipY+1)continue;
   if(s>pipe.a-1&&s<pipe.b+1)caps.push({pipe:pipe.name,kind:kind(c),s:+s.toFixed(2),bottom:+c.box.min.y.toFixed(2),lipY:pipe.lipY,
    aboveLip:+(c.box.min.y-pipe.lipY).toFixed(2),lipEntry:+lipEntry.toFixed(2),lipExit:+lipExit.toFixed(2),
    crateFaceToNearestLipTop:+Math.min(Math.abs(s-.576-lipExit),Math.abs(s+.576-lipEntry),Math.abs(s+.576-lipExit),Math.abs(s-.576-lipEntry)).toFixed(3),
    wallTangentDeg:pipe.arc});}
 }
 const report={generated:new Date().toISOString(),level:route.data.name,dt,bodyHalf:hitboxHalf,bodyHeight:+bodyHeight.toFixed(3),spinReach:CONST.spinReach,
  tntRadius:TUNING.tntRadius,nitroRadius:TUNING.nitroRadius,killY:l.killY,
  tikis:tikis.map(({frames,...rest})=>rest),lanes,crates,refuges,checkpoints,gaps,checkpointNitro,guardians,caps};
 await writeFile(`${OUT}/flame-coverage.json`,JSON.stringify(report,null,1));
 // Keep the full frame list separately; it is large.
 await writeFile(`${OUT}/flame-frames.json`,JSON.stringify(tikis.map(t=>({index:t.index,frames:t.frames}))));
 const summary={tikis:report.tikis.map(t=>({i:t.index,s:t.head.s,side:t.head.side,hot:t.hotSeconds,fire:t.fireWindow,extent:t.extent,centre:t.centreLine,far:t.farthestReachPastHeadSide})),
  exposedCrates:crates.map(c=>({s:c.s,side:c.side,kind:c.kind,box:c.crateExposed.map(e=>`T${e.tiki}:${e.fraction}`),collector:c.collectorExposed.map(e=>`T${e.tiki}:${e.fraction}/safe${e.longestSafeWindow}`)})),
  refuges:refuges.filter(q=>q.exposed.length).map(q=>({label:q.label,s:q.s,side:q.side,exposed:q.exposed})),
  checkpoints:checkpoints.filter(c=>c.boxExposed.length||c.collectorExposed.length||c.spawnBodyExposed.length),
  lanes,checkpointNitro,guardians,caps,
  gaps:gaps.map(g=>({a:g.a,b:g.b,y:g.y,landings:g.probes.filter(q=>q.landing).map(q=>`${q.s}/${q.side}:${q.landing.drop}m ${q.landing.name}`),noPit:g.probes.filter(q=>!q.pitBelow).map(q=>`${q.s}/${q.side}`)}))};
 console.log(JSON.stringify(summary,null,1));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,
 controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
