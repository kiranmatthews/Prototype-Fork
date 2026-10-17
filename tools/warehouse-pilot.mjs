/** Isolated native diagnostic pilot. place()/face() reset state; never use this as rendered session or camera evidence. */
export function createWarehousePilot(p,l){
 const records=[];let frame=0,launchHeading=null;
 const tick=(o={})=>{
  const heading=p.skateCameraHeading;
  if(Math.hypot(heading.x,heading.z)>.01)p.camDir.copy(heading).setY(0).normalize();
  const input={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,
   spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,
   consumeEdges(){},...o};
  // On foot, a direction is screen-relative translation, not a board carve.
  // Aim the next push through that normal input frame after waiting at rest.
  if(launchHeading&&!p.freeSkate&&input.moveY>0){
   input.moveX=-p.camDir.z*launchHeading[0]+p.camDir.x*launchHeading[2];
   input.moveY=p.camDir.x*launchHeading[0]+p.camDir.z*launchHeading[2];
  }
  p.step(1/60,input,l);l.update(1/60);frame++;
  if(p.freeSkate)launchHeading=null;
  if(frame%12===0)records.push({frame,pos:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,bail:p.isBailing,grind:p.grindT,rail:p.grindRail?.object?.name,tokens:l.skateCollectathon.collected,input:o});
 };
 const place=(pos,heading=[0,0,-1],hard=true)=>{
  p.respawn(l,hard,true,{position:p.pos.clone().fromArray(pos),heading:p.axisF.clone().fromArray(heading)});
  p.axisF.fromArray(heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=0;launchHeading=null;
 };
 const fail=()=>p.isBailing||p.state==='dead'||p.state==='gameover';
 const snapshot=()=>({frame,pos:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,bail:p.isBailing,tokens:l.skateCollectathon.collected,combo:p.comboMult,points:p.points});
 const follow=(points,{speed=13,radius=1.5,maxFrames=2500,stop=true,charge=speed>12}={})=>{
  let index=0;const start=frame;
  for(let i=0;i<maxFrames&&index<points.length;i++){
   const q=points[index],dx=q[0]-p.pos.x,dz=q[2]-p.pos.z;
   if(Math.hypot(dx,dz)<radius&&Math.abs(p.pos.y-q[1])<2.2){index++;continue;}
   const a=Math.atan2(dx,-dz)-Math.atan2(p.axisF.x,-p.axisF.z),angle=Math.atan2(Math.sin(a),Math.cos(a));
   const end=points[points.length-1],remaining=Math.hypot(end[0]-p.pos.x,end[2]-p.pos.z);
   const limit=stop?Math.min(speed,Math.sqrt(Math.max(0,(remaining-1)*32))):speed;
   const turnBrake=Math.abs(angle)>.65&&((p.groundHit?.normal.y??1)>.998||p.speed>6);
   const walking=p.grounded&&!p.freeSkate;
   tick({moveX:walking?Math.sin(angle):p.grounded?Math.max(-1,Math.min(1,angle*2.7)):0,
    moveY:walking?Math.cos(angle):1,jumpHeld:charge,
    grabHeld:!walking&&p.grounded&&(p.speed>limit+1||turnBrake)});
   if(fail())break;
  }
  if(stop)for(let i=0;i<120&&Math.abs(p.speed)>.1&&!fail();i++)tick({grabHeld:true});
  return {index,total:points.length,frames:frame-start,...snapshot()};
 };
 const ribbonPoints=name=>{
  const c=l.captureData().components.find(c=>c.nm===name);if(!c?.vertices)throw Error('Missing ribbon '+name);
  const points=[];for(let i=0;i<c.vertices.length;i+=12)points.push([(c.vertices[i]+c.vertices[i+3])/2,c.vertices[i+1],(c.vertices[i+2]+c.vertices[i+5])/2]);
  return points;
 };
 const rideRibbon=(name,options={})=>{
  const points=ribbonPoints(name);let nearest=0,distance=Infinity;
  for(let i=0;i<points.length;i++){const q=points[i],d=Math.hypot(q[0]-p.pos.x,q[1]-p.pos.y,q[2]-p.pos.z);if(d<distance){distance=d;nearest=i;}}
  return follow(distance<10?points.slice(nearest):points,options);
 };
 const run=(until,input,maxFrames=1000)=>{
  const start=frame;let reached=until();
  while(frame-start<maxFrames&&!reached&&!fail()){tick(typeof input==='function'?input(frame-start):input);reached=until();}
  return {reached,frames:frame-start,...snapshot()};
 };
 const balance=()=>Math.max(-1,Math.min(1,-p.balance*14-p.balanceVel*2));
 const face=heading=>{
  if(!l.alwaysSkate&&Math.abs(p.speed)<.1){launchHeading=heading;return;}
  for(let i=0;i<150;i++){
   const a=Math.atan2(heading[0],-heading[2])-Math.atan2(p.axisF.x,-p.axisF.z),angle=Math.atan2(Math.sin(a),Math.cos(a));
   if(Math.abs(angle)<.015&&p.speed<.1)break;
   tick(p.freeSkate?{moveX:Math.max(-1,Math.min(1,angle*3)),grabHeld:true,jumpHeld:true}
    :{moveX:Math.sin(angle),moveY:Math.cos(angle),jumpHeld:true});
  }
 };
 const stop=()=>{for(let i=0;i<120&&Math.abs(p.speed)>.05&&!fail();i++)tick({grabHeld:true});};
 return {p,l,tick,place,follow,ribbonPoints,rideRibbon,run,balance,face,stop,fail,snapshot,records};
}
