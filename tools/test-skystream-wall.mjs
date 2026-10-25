import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m}=r;
 const {sampleLoop}=await r.server.ssrLoadModule('/src/loopRide.ts');
 const [wx,wy,wz]=m.SKYSTREAM_WALL.p,[sx,sy,sz]=m.SKYSTREAM_WALL.s;
 const barrier=l.walls.find(box=>Math.abs(box.min.x-(wx-sx/2))<.001&&Math.abs(box.max.x-(wx+sx/2))<.001&&Math.abs(box.min.z-(wz-sz/2))<.001);
 assert.ok(barrier,'Missing physical central wall');
 assert.equal(barrier.max.y,wy+sy,'Wall origins are at the base, unlike platform centres');
 for(let i=0;i<=720;i++)for(const lateral of [-6,0,6]){
  const q=sampleLoop(m.SKYSTREAM_LOOP,i/720*Math.PI*2,lateral).point.map((v,k)=>v+m.SKYSTREAM_LOOP.entry[k]);
  assert.ok(Math.abs(q[0]-wx)>sx/2+.8||Math.abs(q[2]-wz)>sz/2+.8||q[1]>barrier.max.y+2,'Loop clips the solid central wall');
 }
 let airborne=false,maxX=p.pos.x,hit=false;
 for(let frame=0;frame<300;frame++){
  // Charge on the real approach and try to jump directly to the exit lane.
  const release=frame>20&&p.grounded&&p.pos.x>85;
  r.tick({...r.worldDirectionInput([1,0,0]),jumpHeld:!release});
  airborne ||= !p.grounded;maxX=Math.max(maxX,p.pos.x);
  if(p.isBailing){hit=true;break;}
 }
 assert.ok(airborne&&hit,'The attempted bypass must contact the physical wall');
 assert.ok(maxX>99&&maxX<wx-sx/2+.5,'The wall must physically stop the attempted crossing');
 assert.equal(p.loopStatus.completed,0);assert.equal(l.loopMeshes[0].userData.loopRequired,false);
 console.log('PASS native jump blocked by the central wall, with full-width loop clearance and no required-loop counter.',{maxX});
},{modulePath:'/src/levels/skystream.ts',source:m=>m.SKYSTREAM_LEVEL,levelId:'skystream',
 start:[73,-329.9,-1754],heading:[1,0,0],maxFrames:320,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
