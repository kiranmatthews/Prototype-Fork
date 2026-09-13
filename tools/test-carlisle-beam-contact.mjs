import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({player:p,level,THREE,server})=>{
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const {cityRailVisual,CITY_BEAM_WIDTH}=await server.ssrLoadModule('/src/cityAssets.ts');
 const {GRIND_TRICKS}=await server.ssrLoadModule('/src/skateTricks.ts');
 const {CARLISLE_COAST_LEVEL:d}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const v=(...a)=>new THREE.Vector3(...a),up=v(0,1,0),ray=new THREE.Raycaster();let poses=0,worst=0,penetration=0,meshChecks=0;
 for(const id of [116,132,146]){
  const c=d.components.find(c=>c.nm===`Test Course ${id}`),points=c.pts.map(q=>v(c.p[0]+q[0],c.p[1]+(q[3]??0),c.p[2]+q[1]));
  const rail=new Rail(points,false),beam=cityRailVisual(points);beam.updateMatrixWorld(true);
  for(const dir of [-1,1])for(const stance of [-1,1])for(const style of Object.keys(GRIND_TRICKS)){
   const t=rail.totalLength*.37,tangent=rail.tangentAt(t).multiplyScalar(dir),right=v().crossVectors(up,tangent).normalize(),normal=v().crossVectors(tangent,right).normalize();
   p.respawn(level,true,true,{position:rail.pointAt(t).addScaledVector(up,.15),heading:tangent});
   p.freeSkate=p.airFromSkate=true;p.visualYaw=Math.atan2(tangent.x,tangent.z)-Math.PI;
   p.sidePose=p.deckPose=p.skatePose=1;p.speed=10;p.stance=stance;p.skateMountT=-1;p.state='grind';p.grounded=false;p.balance=0;p.wallridePose=p.grabPose=0;
   p.grindPoseX=p.grindPoseZ=p.grindYawPose=p.grindCrossPose=0;p.alignPose=p.slopePose=p.slopeRoll=0;p.specialGrind=p.specialFlip=p.specialGrab=null;
   p.grindRail=rail;p.grindT=t;p.grindDir=dir;p.grindStyle=style;p.grindApproachSide=stance;p.grindCrossDir=dir;p.grindYawDir=stance;p.prevPos.copy(p.pos);
   for(let f=0;f<65;f++){p.runTime+=1/60;p.syncVisual(makeInput(),1/60);}
   const contact=p.boardG.userData.skateContact,point=p.boardG.localToWorld(v(...contact.local));
   ray.set(point.clone().addScaledVector(normal,.4),normal.clone().negate());ray.far=.8;
   const hit=ray.intersectObject(beam,true)[0];assert.ok(hit,`${id}/${style}: no beam under board`);
   const error=point.distanceTo(hit.point);worst=Math.max(worst,error);assert.ok(error<.003,`${id}/${dir}/${stance}/${style} penetrates or floats ${error}`);
   const s=p.boardG.userData.settings;
   assert.ok(CITY_BEAM_WIDTH/2<(s.wheelTrackHalfWidth-s.wheelWidth/2)*s.overallScale,'flange fits within the wheel gap');
   // Check actual deck and wheel vertices against the closed beam, not just
   // the contact point: a wide flange can still cut into the wheels/deck.
   p.boardG.traverse(mesh=>{
    if(!mesh.isMesh||!(mesh.name==='Deck_ContinuousRoundedKick'||mesh.name.startsWith('Wheel_')))return;
    const a=mesh.geometry.getAttribute('position');
    for(let i=0;i<a.count;i++){
     const vertex=v().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld),closest=rail.closest(vertex),offset=vertex.clone().sub(closest.point);
     if(Math.abs(offset.dot(right))>CITY_BEAM_WIDTH/2+.003||offset.dot(normal)>.091||offset.dot(normal)<-.49)continue;
     ray.set(vertex.clone().addScaledVector(normal,.8),normal.clone().negate());ray.far=1.6;const above=ray.intersectObject(beam,true)[0];
     ray.set(vertex.clone().addScaledVector(normal,-.8),normal);const below=ray.intersectObject(beam,true)[0];
     if(above&&below){const depth=above.point.clone().sub(vertex).dot(normal),lower=vertex.clone().sub(below.point).dot(normal);if(depth>0&&lower>0)penetration=Math.max(penetration,Math.min(depth,lower));}meshChecks++;
    }
   });
   assert.ok(penetration<.003,`${id}/${style}: deck/wheel penetrates the beam by ${penetration}`);
   assert.ok(contact.footError<.006,'feet remain planted on board');poses++;
  }
  beam.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});
 }
 console.log(`PASS ${poses} actual board/beam poses across rising, falling, N/E rails, both travel directions and stances, all eight grinds; ${meshChecks} deck/wheel clearance probes, max penetration ${(penetration*1000).toFixed(3)} mm, max top-contact error ${(worst*1000).toFixed(3)} mm.`);
});
