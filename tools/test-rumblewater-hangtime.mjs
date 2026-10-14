import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const pipe=(x,a,b)=>({t:'vertramp',p:[x,0,-a],pts:[[0,0],[0,a-b]],w:4.5,rise:3.5,arc:86,arcSteps:18,vkind:'half',curve:'corner',deck:1.1,rails:true,hangLock:true});
const fixture={v:1,name:'Reachable pipe gap transfer',spawn:[0,.12,-5],killY:-30,startWarpPad:false,components:[pipe(0,0,140),pipe(40,0,50),pipe(40,59,140),{t:'gate',p:[100,0,-140]}]};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,flights=[];
 for(const x of [0,40]){
  const cross=7.7,y=3.5-Math.sqrt(3.5**2-(cross-4.5)**2);
  p.respawn(l,true,false,{position:new THREE.Vector3(x+cross,y+.01,-25),heading:new THREE.Vector3(.62,0,-.78).normalize()});
  p.pos.y=y;p.prevPos.copy(p.pos);p.speed=28;p.freeSkate=true;p.groundHit=p.queryGround(l);p.rideNormal.copy(p.groundHit.normal);p.grounded=true;
  const points=[];let launch=false,landed=false;
  for(let i=0;i<300;i++){
   r.tick(launch?{jumpHeld:true}:{moveX:.62,moveY:.78,jumpHeld:true});
   if(p.vertAir)launch=true;
   points.push({frame:i,position:p.pos.toArray(),vy:p.vVel,vert:p.vertAir,grounded:p.grounded,bail:p.isBailing});
   if(launch&&p.grounded){landed=true;break;}
   if(p.isBailing||p.state==='dead')break;
  }
  flights.push({x,launch,landed,points});
 }
 await writeFile('/private/tmp/rumblewater-hangtime.json',JSON.stringify(flights));
 for(const flight of flights){assert.ok(flight.launch,'fixture must earn its own real wall launch');assert.ok(flight.landed,'hang must return to an actual pipe');assert.ok(flight.points.every(p=>!p.bail));}
 const [continuous,transfer]=flights;
 assert.ok(transfer.points.some(p=>p.position[2]<-50&&p.position[2]>-59&&p.vert),'real gap uses vert flight');
 assert.ok(transfer.points.at(-1).position[2]<-59,'lands beyond the open nine-metre break');
 const airborne=continuous.points.filter(p=>p.vert).length;
 let maxHeightDifference=0,maxVelocityDifference=0;
 for(let i=0;i<Math.min(continuous.points.length,transfer.points.length)-1;i++){
  maxHeightDifference=Math.max(maxHeightDifference,Math.abs(continuous.points[i].position[1]-transfer.points[i].position[1]));
  maxVelocityDifference=Math.max(maxVelocityDifference,Math.abs(continuous.points[i].vy-transfer.points[i].vy));
 }
 assert.ok(maxHeightDifference<1e-5&&maxVelocityDifference<1e-5,'crossing the gap cannot change the flight gravity or vertical arc');
 console.log(JSON.stringify({pass:true,airborne,gap:9,landing:transfer.points.at(-1).position,maxHeightDifference,maxVelocityDifference}));
},{modulePath:'/src/levels/rumblewater-run.ts',source:()=>fixture,levelId:'rumblewater-hangtime',controlFrame:()=>({x:0,z:-1}),maxFrames:1000});
await withBlockworksRuntime(async r=>{
 const {prepareRumblewaterVert,createRumblewaterVertPilot}=await import('./rumblewater-vert-pilot.mjs');
 const fixture=prepareRumblewaterVert(r.p,r.l,r.sourceModule),pilot=createRumblewaterVertPilot(r.p,r.l,r.sourceModule);
 let sample;while((sample=pilot.next())!==null)r.tick(sample);
 assert.ok(pilot.report.gapAirFrames>0);assert.ok(pilot.report.gravitySamples.every(g=>Math.abs(g-r.TUNING.pipeAirGravity)<1e-5));
 await writeFile('/private/tmp/rumblewater-real-pipe-transfer.json',JSON.stringify({fixture,...pilot.report}));
 console.log(JSON.stringify({actualCourse:true,fixture,...pilot.report,gravitySamples:pilot.report.gravitySamples.length}));
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:m=>m.RUMBLEWATER_RUN_LEVEL,maxFrames:500});
