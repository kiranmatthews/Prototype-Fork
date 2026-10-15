import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const angle=(a,b)=>Math.acos(Math.max(-1,Math.min(1,(a.x*b.x+a.z*b.z)/(Math.hypot(a.x,a.z)*Math.hypot(b.x,b.z)))))*180/Math.PI;
await withBlockworksRuntime(async r=>{
 const {LEGACY_DROWNED_CAMERA,DROWNED_CAMERA,migrateDrownedCamera}=await r.server.ssrLoadModule('/src/levels/pirate-camera.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {DROWNED_INTERIOR_OFFSET_X:offset}=await r.server.ssrLoadModule('/src/levels/pirate-sets.ts');
 const lane=d=>d.components.filter(c=>c.t==='camnode'&&!c.cameraView);
 const geometry=d=>d.components.filter(c=>c.t!=='camnode');
 const before=clone(r.source),legacy=clone(r.source);
 // Exercise the original saved-snapshot migration independently of the new
 // exterior/interior staging and its arrival anchor.
 const stagedNodes=lane(legacy);
 legacy.components=legacy.components.filter(c=>c.t!=='camnode'||c.cameraView);
 for(let i=0;i<LEGACY_DROWNED_CAMERA.length;i++){
  const original=DROWNED_CAMERA[i],staged=[original[0]+(original[2]<-95?offset:0),original[1],original[2]];
  const node=stagedNodes.find(c=>c.p.every((v,k)=>v===staged[k]));assert.ok(node,`Missing staged source anchor ${i}`);
  legacy.components.push({...node,p:[...LEGACY_DROWNED_CAMERA[i]],grp:1});
 }
 for(const c of legacy.components)if(c.t==='camnode'&&c.cameraView&&c.p[0]>offset/2){
  c.p[0]-=offset;if(c.cameraPosition)c.cameraPosition[0]-=offset;if(c.cameraTarget)c.cameraTarget[0]-=offset;
 }
 legacy.groups=legacy.groups.filter(g=>g.id<=10);
 for(const c of legacy.components)if(c.t==='camnode'&&c.cameraView&&['Captain cabin','Crystal grotto','Royal vault'].some(s=>c.nm?.startsWith(s)))delete c.cameraPresentationOnly;
 // Saved non-camera changes survive; opening the exact old course repairs
 // controls rather than requiring the player to delete their editor work.
 geometry(legacy).find(c=>c.t==='crate').nm='My retained crate edit';
 const keptGeometry=clone(geometry(legacy));
 const repaired=clone(legacy);migrateDrownedCamera(repaired);
 assert.ok(normalizeCustomLevelData(clone(repaired)),'Repaired snapshot does not round-trip');
 assert.deepEqual(lane(normalizeCustomLevelData(clone(legacy))).map(c=>c.p),DROWNED_CAMERA,'Import skipped the camera migration');
 assert.deepEqual(lane(repaired).map(c=>c.p),DROWNED_CAMERA);
 assert.ok(JSON.stringify(geometry(repaired))===JSON.stringify(keptGeometry),'Camera migration changed geometry');
 assert.ok(lane(repaired).every(c=>c.grp!==1),'Moving the tunnel still drags every ship camera node');
 assert.ok(repaired.components.filter(c=>c.t==='camnode'&&c.cameraView).every(c=>c.cameraPresentationOnly));
 const once=clone(repaired);migrateDrownedCamera(repaired);assert.ok(JSON.stringify(repaired)===JSON.stringify(once),'Migration is not idempotent');
 for(const edit of [d=>lane(d)[20].p[0]+=.001,d=>lane(d)[20].radius=2,d=>{const n=lane(d);[n[20].p,n[21].p]=[n[21].p,n[20].p];}]){
  const edited=clone(legacy);edit(edited);const saved=clone(edited);migrateDrownedCamera(edited);assert.ok(JSON.stringify(edited)===JSON.stringify(saved),'Replaced an authored camera path');
 }
 const customView=clone(legacy),cabin=customView.components.find(c=>c.t==='camnode'&&c.cameraView&&c.nm?.startsWith('Captain cabin'));
 cabin.cameraPresentationOnly=false;migrateDrownedCamera(customView);assert.equal(customView.components.find(c=>c.nm===cabin.nm).cameraPresentationOnly,false,'Explicit control-view preference was overwritten');
 const grouped=clone(legacy);grouped.groups.push({id:94,nm:'My camera folder',editorOnly:true});lane(grouped).forEach((c,i)=>Object.assign(c,{grp:94,lk:true,nm:`My anchor ${i}`}));
 migrateDrownedCamera(grouped);assert.ok(lane(grouped).every((c,i)=>c.grp===94&&c.lk&&c.nm===`My anchor ${i}`));
 const expectedStaged=[];let arrived=false;
 for(const p of DROWNED_CAMERA){
  if(p[2]<-95&&!arrived){expectedStaged.push([offset,8,-65],[offset,8,-85]);arrived=true;}
  expectedStaged.push([p[0]+(p[2]<-95?offset:0),p[1],p[2]]);
 }
 assert.deepEqual(lane(r.source).map(c=>c.p),expectedStaged,'Staged camera lane lost its interior arrival axis');
 assert.equal(r.l.cameraPresentationViews.length,6,'Unexpected presentation-view count');
 assert.equal(r.l.cameraViews.length,0,'A presentation view changes the movement axes');
 const ground=r.l.cameraDirAt(offset,8,-106),air=r.l.cameraDirAt(offset,12,-106),jumpHeadingChange=angle(ground,air);
 assert.ok(jumpHeadingChange<5,`Jumping under the cabin rotates controls ${jumpHeadingChange} degrees`);
 let samples=0,worstShipHeading=0;
 for(const x of [-11,-8,0,4,11])for(const y of [-4,8,12,16])for(let z=-116;z>=-224;z-=2){
  const d=r.l.cameraDirAt(offset+x,y,z);worstShipHeading=Math.max(worstShipHeading,angle(d,{x:0,z:-1}));samples++;
 }
 assert.ok(worstShipHeading<1,`Straight ship decks steer sideways by ${worstShipHeading} degrees`);
 let worstCabinHeading=0,worstCabinPoint=null;
 for(const x of [-8,-3,0,7])for(const y of [14,18])for(let z=-95;z>=-108;z--){
  const error=angle(r.l.cameraDirAt(offset+x,y,z),{x:0,z:-1});
  if(error>worstCabinHeading){worstCabinHeading=error;worstCabinPoint=[offset+x,y,z];}
 }
 assert.ok(worstCabinHeading<1,`Cabin axis turns ${worstCabinHeading} degrees at ${worstCabinPoint}`);
 const runs=[];
 for(const [name,start,input,frames] of [
  ['forward on deck',[4,8.05,-115],{moveY:.65},80],
  ['backward on deck',[4,8.05,-123],{moveY:-.65},60],
  ['strafe across deck',[-5,8.05,-119],{moveX:.7},90],
  ['forward in hold',[3,-3.95,-182],{moveY:.6},90],
  ['forward in cabin',[-3,14.05,-98],{moveY:.65},60],
  ['backward in cabin',[-3,14.05,-103],{moveY:-.65},60],
 ]){
  r.p.respawn(r.l,true,false,{position:r.p.pos.clone().set(start[0]+offset,start[1],start[2]),heading:r.p.camDir.clone().set(0,0,-1)});r.stepFor(15);
  const a=r.p.pos.clone();r.stepFor(frames,input);const delta=r.p.pos.clone().sub(a);
  assert.equal(r.p.state,'ride',name);assert.ok(r.p.grounded,name);assert.equal(r.p.totalDeaths,0,name);
  if(input.moveX){assert.ok(delta.x>3,name);assert.ok(Math.abs(delta.z)<.05,`${name} hijacked forward/backward movement`);}
  else{assert.ok(Math.abs(delta.z)>2,`${name}: insufficient displacement ${delta.toArray()}`);assert.ok(Math.abs(delta.x)<.05,`${name} hijacked lateral movement`);assert.equal(Math.sign(delta.z),-Math.sign(input.moveY));}
  runs.push({name,frames,delta:delta.toArray()});
 }
 assert.ok(JSON.stringify(r.source)===JSON.stringify(before),'Review mutated source data');
 const report={pass:true,legacyVerticalProbeHeadingChangeDegrees:163.7344397264803,verticalProbeHeadingChangeDegrees:jumpHeadingChange,worstShipHeading,worstCabinHeading,worstCabinPoint,stagedMovementNodes:lane(r.source).length,presentationViews:r.l.cameraPresentationViews.length,samples,runs,migration:'Exact shipped path repaired; geometry, custom paths and custom camera grouping preserved',editor:'Movement nodes in their own folder; framing volumes excluded from lane numbering'};
 await writeFile('docs/drowned-crown/excellence/camera-input-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>m.PIRATE_WRECK_LEVEL});
