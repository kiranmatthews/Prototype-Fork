// Input-only test pilot. World transforms, speed, gravity and contacts are never changed.
export function relayPilot({player:p,level,THREE,makeInput,jumps,stops,walk,point,startS=0}){
 const events=[],targets=[...jumps.map(j=>({name:j.name,s:j.from[0],y:j.from[1],u:j.from[2]??0,kind:'spring'})),
  ...jumps.filter(j=>!jumps.some(q=>q.from[0]===j.to[0])).map(j=>({name:j.name+' catch',s:j.to[0],y:j.to[1],u:j.to[2]??0,kind:'catch'})),
  ...walk.map(m=>({...m,kind:'walk'})),...stops.filter(m=>m.s>0).map(m=>({...m,u:0,kind:'rest'})),{name:'Finish',s:4001,y:12,u:0,kind:'finish'}].sort((a,b)=>a.s-b.s);
 let next=Math.max(0,targets.findIndex(t=>t.s>startS)),airJump=null,previousVy=0,hop=0,cooldown=0,ticks=0;
 const centreline=Array.from({length:801},(_,i)=>({s:i*5,p:point(i*5,0)}));
 const progress=()=>centreline.reduce((best,q)=>{const d=(p.pos.x-q.p[0])**2+(p.pos.z-q.p[2])**2;return d<best.d?{s:q.s,d}:best;},{s:0,d:Infinity}).s;
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floor=(x,z,top)=>{ray.set(new THREE.Vector3(x,top+12,z),down);ray.far=16;return ray.intersectObjects(level.groundMeshes,false).find(h=>h.face?.normal.y>.2);};
 return {events,get next(){return next;},get target(){return targets[next];},input(){
  ticks++;cooldown=Math.max(0,cooldown-1);const input=makeInput();
  if(p.vVel>15&&previousVy<=0&&!p.grounded){const j=jumps.find(q=>q.name===p.surfaceName);if(j){airJump=j;next=targets.findIndex(t=>t.s>j.from[0]);events.push({frame:ticks,launch:j.name});}}
  previousVy=p.vVel;if(p.grounded)airJump=null;
  // A safe downstream landing can bypass a spring. Continue from the
  // supported deck instead of trying to walk backward up a completed arc.
  if(p.grounded)while(targets[next]&&targets[next].s<progress()-12){events.push({frame:ticks,passed:targets[next].name});next++;}
  let target=targets[next];if(!target||p.state==='dead'||p.state==='finished')return input;
  let at=point(target.s,target.y,target.u);
  const movingTarget=level.movers.find(m=>m.mesh.name===target.name);
  if(movingTarget)at=movingTarget.mesh.position.toArray();
  if(airJump){const nextSpring=jumps.find(q=>q.from[0]===airJump.to[0]);const mover=nextSpring?.moving?level.movers.find(m=>m.mesh.name===nextSpring.name):null;
   at=mover?[mover.mesh.position.x,mover.mesh.position.y+1,mover.mesh.position.z]:point(...airJump.to);
   input.jumpHeld=!!nextSpring;
  }else if(p.grounded&&Math.hypot(p.pos.x-at[0],p.pos.z-at[2])<4&&Math.abs(p.pos.y-at[1])<4&&target.kind!=='spring'&&target.kind!=='finish'&&
    (!/boarding|Dial entry/.test(target.name)||p.groundHit?.moverId!==undefined)){
   events.push({frame:ticks,arrived:target.name});target=targets[++next];if(!target)return input;at=point(target.s,target.y,target.u);
  }
  const targetDistance=Math.hypot(at[0]-p.pos.x,at[2]-p.pos.z);
  if(!airJump&&targetDistance>12)at=point(Math.min(target.s,progress()+9),target.y,target.u);
  const dx=at[0]-p.pos.x,dz=at[2]-p.pos.z,dist=Math.hypot(dx,dz),ux=dx/Math.max(.001,dist),uz=dz/Math.max(.001,dist);
  const forward=dx*p.axisF.x+dz*p.axisF.z,side=dx*p.axisL.x+dz*p.axisL.z;
  if(airJump){input.moveY=Math.abs(forward)>1.5?Math.sign(forward):0;input.moveX=Math.abs(side)>2?Math.sign(side):0;return input;}
  for(const cp of level.checkpoints)if(!cp.active&&cp.box.distanceToPoint(p.pos)<3){input.spinPressed=true;input.spinHeld=true;}
  if(hop){hop--;input.jumpHeld=hop>1;input.jumpPressed=hop===19;input.jumpReleased=hop===1;if(hop>1)return input;}
  if(p.grounded&&!hop){
   const ahead=floor(p.pos.x+ux*4,p.pos.z+uz*4,p.pos.y),landing=floor(p.pos.x+ux*6,p.pos.z+uz*6,p.pos.y);
   if(!ahead||ahead.point.y>p.pos.y+.1){
    if(landing&&landing.point.y<p.pos.y+1.75&&!cooldown){hop=20;cooldown=60;input.jumpHeld=true;input.jumpPressed=true;return input;}
    else return input;
   }
   if(target.name==='Dredger upper quay'&&p.groundHit?.moverId!==undefined){const deck=level.movers[p.groundHit.moverId].mesh;
    if(p.pos.y<45||deck.position.distanceTo(new THREE.Vector3(...point(1850,47)))>30)return input;}
  }
  input.moveY=Math.abs(forward)>1?Math.sign(forward):0;input.moveX=Math.abs(side)>1.5?Math.sign(side):0;
  if(p.surfaceName?.startsWith('Spring-tide reservoir'))input.jumpHeld=true;
  if(target.kind==='spring'&&targetDistance<(movingTarget?9:8))input.jumpHeld=true;
  return input;
 }};
}
