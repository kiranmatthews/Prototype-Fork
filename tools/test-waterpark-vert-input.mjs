import assert from 'node:assert/strict';
import {withWaterparkRuntime} from './waterpark-runner.mjs';
import {createWaterparkPilot} from './waterpark-pilot.mjs';

await withWaterparkRuntime(async r=>{
 const {p,l}=r,results=[];
 for(const angle of [0,.08,.22])for(const steer of [0,-.4,.4]){
  p.respawn(l,true);const pilot=createWaterparkPilot(r.source,{giantAngle:angle});let aired=false,landing=null,after=0,minForward=1;
  for(let frame=0;frame<900;frame++){
   r.tick(landing?{moveY:1,moveX:steer,jumpHeld:true}:pilot.sample(p,l));pilot.observe(p,l);
   aired ||= p.vertAir;
   if(aired&&p.grounded&&!landing)landing={p:p.pos.clone(),heading:p.axisF.clone()};
   if(landing){
    const cf=p.courseInputDirection(l);minForward=Math.min(minForward,cf.z);
    assert.ok(cf.z>.99,'Returning to the left side selected the uphill input lane');
    assert.ok(!p.isBailing&&p.state!=='dead');
    if(++after>=30)break;
   }
  }
  assert.ok(landing&&after===30);assert.ok(p.pos.y<landing.p.y-12&&p.pos.z>landing.p.z+6,'Held forward must carry the drop-in down the wall');
  if(steer)assert.ok(p.axisF.x*steer<-.1,'Lateral input inverted relative to the descending view');
  results.push({angle,steer,landing:landing.p.toArray(),end:p.pos.toArray(),minForward});
  p.respawn(l,true);assert.equal(p.authoredVertReturnInput,null,'Respawn retained a return input frame');
 }
 // The ordinary authored lane takes over at the receiving chute, including
 // a left-hand landing whose old lane cursor was still on the climb.
 p.respawn(l,true);const pilot=createWaterparkPilot(r.source,{giantAngle:.08});let reached=false;
 for(let i=0;i<2000;i++){
  r.tick(pilot.sample(p,l));pilot.observe(p,l);assert.ok(!p.isBailing&&p.state!=='dead');
  if(p.groundHit?.name==='Giant vert right exit chute'){
   p.courseInputDirection(l);assert.equal(p.authoredVertReturnInput,null);reached=true;break;
  }
 }
 assert.ok(reached);console.log(JSON.stringify(results));console.log('PASS left/middle/right vert returns, held forward, both lateral inputs, chute handoff and respawn reset.');
});
