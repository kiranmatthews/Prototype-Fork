import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SPAGHETTI_OUTPUT??'/tmp/spaghetti-crate-review';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {l,source,THREE}=r,C=source.components;
 const {RACE_CRATE_HOVER,RACE_CRATE_SIZE}=await r.server.ssrLoadModule('/src/crateDimensions.ts');
 assert.equal(l.crates.length,706);assert.ok(l.crates.every(b=>b.mystery));
 assert.equal(l.totalCrates,0);assert.equal(l.enemies.length,0);assert.equal(l.checkpoints.length,0);
 assert.equal(l.raceCheckpoints.length,0);assert.ok(!l.allowsBonus);assert.equal(source.skateRace.gemReward,'win');
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),report={items:706,gemBoxes:0,enemies:0,checkpoints:0,bonus:false,winReward:true,itemHover:RACE_CRATE_HOVER,itemSize:RACE_CRATE_SIZE,roles:{},railItems:0,groundItems:0,maxRailAnchorDistance:0,minPickupMargin:Infinity,maxFloorError:0,misses:[]};
 for(const b of l.crates){
  const c=C[b.mesh.userData.editorIdx];assert.ok(c?.t==='crate');
  const anchorY=b.box.min.y-RACE_CRATE_HOVER;
  assert.ok(Math.abs(b.box.max.y-b.box.min.y-RACE_CRATE_SIZE)<.001);
  const role=c.nm.startsWith('Rail item / ')?'rail':c.nm;report.roles[role]=(report.roles[role]??0)+1;
  if(role==='rail'){
   const name=c.nm.slice('Rail item / '.length).replace(/ \/ \d+$/,''),rail=l.rails.find(rail=>rail.object.userData.sourceName===name);assert.ok(rail,c.nm);
   const closest=rail.closest(new THREE.Vector3(b.mesh.position.x,anchorY+.9,b.mesh.position.z));
   const point=rail.pointAt(closest.t),center=point.clone().add(new THREE.Vector3(0,r.CONST.railRideHeight+r.CONST.playerHalf.y,0));
   // Surface seating can move an item off its raw anchor. The real pickup
   // volume must still contain the upright rider's body centre on the rail.
   const margin=Math.min(center.x-b.box.min.x,b.box.max.x-center.x,center.y-b.box.min.y,b.box.max.y-center.y,center.z-b.box.min.z,b.box.max.z-center.z);
   report.maxRailAnchorDistance=Math.max(report.maxRailAnchorDistance,closest.distance);report.minPickupMargin=Math.min(report.minPickupMargin,margin);
   if(!b.box.containsPoint(center))report.misses.push({name:c.nm,railPoint:point.toArray(),bodyCenter:center.toArray(),min:b.box.min.toArray(),max:b.box.max.toArray(),distance:closest.distance});
   report.railItems++;
  }else{
   ray.set(new THREE.Vector3(b.mesh.position.x,anchorY+3,b.mesh.position.z),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,c.nm+' floor');
   const error=Math.abs(h.point.y-anchorY);report.maxFloorError=Math.max(report.maxFloorError,error);assert.ok(error<.04,JSON.stringify({name:c.nm,source:c.p,anchorY,floor:h.point.toArray(),floorName:h.object.name}));report.groundItems++;
  }
 }
 await writeFile(out+'/inventory.json',JSON.stringify(report,null,2));assert.equal(report.misses.length,0,'Every rail pickup volume contains the normal rider line');console.log('PASS all 706 race item volumes intersect their named riding lines or supported reward decks; win-only gem, no adventure quota, enemy or bonus');
},{modulePath:'/src/levels/spaghetti-rails.ts',source:m=>m.SPAGHETTI_RAILS_LEVEL,levelId:'spaghetti-rails'});
