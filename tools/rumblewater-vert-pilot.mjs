/** One documented initial approach fixture; every subsequent action is input. */
export function prepareRumblewaterVert(p,l,m){
 const station=460,cross=7.7,radius=3.5,flat=4.5;
 const d=m.rumbleTangent(station),heading=p.axisF.clone().set(.62*-d[2]+.78*d[0],0,.62*d[0]+.78*d[2]).normalize();
 const position=p.pos.clone().fromArray(m.rumblePoint(station,m.rumbleHeight(station)+radius-Math.sqrt(radius*radius-(cross-flat)**2)+.02,cross));
 p.respawn(l,true,false,{position,heading});p.groundHit=p.queryGround(l);
 if(!p.groundHit?.vert)throw Error('Vert fixture must start on the real transition');
 p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.speed=28;p.freeSkate=true;p.grounded=true;p.rideNormal.copy(p.groundHit.normal);p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);
 l.boulder.course.reset(p.pos);p.commitRenderStep(l);
 return {position:p.pos.toArray(),speed:28,kind:'Initial supported approach on the source-owned first serpent pipe'};
}
export function createRumblewaterVertPilot(p,l,m){
 let frame=0,launched=false;const report={launch:null,landing:null,gapAirFrames:0,gravitySamples:[]};let prior=null;
 return {report,get frame(){return frame;},next(){
  const station=m.rumbleProgress(p.pos);
  if(p.isBailing||p.state==='dead')throw Error('Pipe transfer bailed or died');
  if(p.vertAir&&!launched){launched=true;report.launch={station,position:p.pos.toArray(),vy:p.vVel};}
  if(launched&&p.grounded){report.landing={station,position:p.pos.toArray(),speed:p.speed};if(station<479||!p.groundHit?.vert)throw Error('Did not land on the receiving pipe: '+JSON.stringify({...report,gravitySamples:report.gravitySamples.length,ground:p.groundHit?.name,vert:p.groundHit?.vert}));return null;}
  if(station>470&&station<479){if(!p.vertAir)throw Error('Gap changed hangtime into ordinary air');report.gapAirFrames++;}
  if(prior&&p.vertAir&&prior.vert)report.gravitySamples.push((prior.vy-p.vVel)*60);
  prior={vy:p.vVel,vert:p.vertAir};if(++frame>300)throw Error('Pipe transfer timed out');
  if(launched)return {jumpHeld:true};
  const d=m.rumbleTangent(station),dx=.62*-d[2]+.78*d[0],dz=.62*d[0]+.78*d[2],f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z);
  return {moveX:dx*-f.z+dz*f.x,moveY:dx*f.x+dz*f.z,jumpHeld:true};
 }};
}
