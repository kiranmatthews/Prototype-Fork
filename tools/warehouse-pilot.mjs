/** The same input-only pilot runs in the native harness and production Chrome. */
export function createWarehousePilot(p,l){
 const records=[];let frame=0;
 const tick=(o={})=>{
  const heading=p.skateCameraHeading;
  if(Math.hypot(heading.x,heading.z)>.01)p.camDir.copy(heading).setY(0).normalize();
  const input={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,
   spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,
   consumeEdges(){},...o};
  p.step(1/60,input,l);l.update(1/60);frame++;
  if(frame%12===0)records.push({frame,pos:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,bail:p.isBailing,grind:p.grindT,rail:p.grindRail?.object?.name,tokens:l.skateCollectathon.collected,input:o});
 };
 const place=(pos,heading=[0,0,-1],hard=true)=>{
  p.respawn(l,hard,true,{position:p.pos.clone().fromArray(pos),heading:p.axisF.clone().fromArray(heading)});
  p.axisF.fromArray(heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=0;p.freeSkate=true;
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
   tick({moveX:p.grounded?Math.max(-1,Math.min(1,angle*2.7)):0,moveY:1,jumpHeld:charge,
    grabHeld:p.grounded&&(p.speed>limit+1||turnBrake)});
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
  for(let i=0;i<150;i++){
   const a=Math.atan2(heading[0],-heading[2])-Math.atan2(p.axisF.x,-p.axisF.z),angle=Math.atan2(Math.sin(a),Math.cos(a));
   if(Math.abs(angle)<.015&&p.speed<.1)break;
   tick({moveX:Math.max(-1,Math.min(1,angle*3)),grabHeld:true});
  }
 };
 const stop=()=>{for(let i=0;i<120&&Math.abs(p.speed)>.05&&!fail();i++)tick({grabHeld:true});};
 return {p,l,tick,place,follow,ribbonPoints,rideRibbon,run,balance,face,stop,fail,snapshot,records};
}

export function warehouseDock(t,hard=false){
 const {p,l}=t;t.place([-45,.15,-117],[0,0,-1],hard);let popped=false;
 return t.run(()=>l.skateCollectathon.tokens[0].collected&&p.grounded,()=>{
  const pop=!popped&&p.pos.z<-157;if(pop)popped=true;return {moveY:1,jumpHeld:!popped,jumpReleased:pop};
 });
}

export function warehouseGallery(t,hard=false){
 const {p,l}=t;t.place([-63,.15,-151],[0,0,1],hard);
 const approach=t.follow(t.ribbonPoints('Gallery discovery bank').filter(q=>q[2]<-115),{speed:23,stop:false});
 const grind=t.run(()=>l.skateCollectathon.tokens[1].collected&&p.grounded,
  ()=>({moveY:1,jumpHeld:true,grindHeld:true,moveX:p.state==='grind'?t.balance():0}),600);
 return {approach,grind};
}

/** One continuous journey, from the ground ramp through the loft, lift, gantry and roof. */
export function warehouseUpperJourney(t,hard=false){
 const {p,l}=t;t.place([60,.15,-39],[0,0,-1],hard);const stages=[];
 const stage=(name,result)=>{stages.push({name,...result});return !t.fail();};
 stage('service climb',t.rideRibbon('Curving service ramp / ground to 18 m',{speed:15}));
 stage('loft launch staging',t.follow([[40,18,-164],[42.8,18,-165]],{speed:5,radius:.3}));
 t.face([-1,0,0]);let popped=false;
 stage('loft transfer',t.run(()=>l.skateCollectathon.tokens[2].collected&&p.grounded,()=>{
  const pop=!popped&&p.pos.x<36.4;if(pop)popped=true;return {moveY:1,jumpHeld:!popped,jumpReleased:pop};
 },300));t.stop();
 stage('lift staging',t.follow([[26,18,-168]],{speed:5,radius:.3}));t.face([0,0,1]);
 const liftTop=()=>l.movers[0].mesh.position.y+l.movers[0].mesh.geometry.parameters.height/2;let lastTop=liftTop();
 stage('wait for freight lift',t.run(()=>{const top=liftTop(),ready=top<19&&top<lastTop;lastTop=top;return ready;},{grabHeld:true},900));
 popped=false;stage('board freight lift',t.run(()=>p.grounded&&p.groundHit?.moverId===0,()=>{
  const pop=!popped&&p.pos.z>-161.3;if(pop)popped=true;return {moveY:1,jumpHeld:!popped,jumpReleased:pop};
 },250));
 stage('rise to gantry',t.run(()=>p.pos.y>27.75&&p.groundHit?.moverId===0,{grabHeld:true},900));
 stage('gantry arrival',t.rideRibbon('Lift landing to gantry',{speed:12,charge:true,stop:false}));
 stage('gantry curved grind',t.run(()=>p.pos.x<-25.5,()=>({moveY:1,jumpHeld:true,grindHeld:true,moveX:p.state==='grind'?t.balance():0}),900));
 stage('leave gantry rail',t.run(()=>p.grounded&&p.pos.x<-26,()=>({moveY:1,jumpHeld:true,moveX:0}),180));
 stage('curved roof catwalk',t.rideRibbon('Curved roof maintenance catwalk',{speed:12,charge:true,stop:false}));
 popped=false;stage('roof transfer',t.run(()=>l.skateCollectathon.tokens[4].collected&&p.grounded,()=>{
  const pop=!popped&&p.pos.z>-101;if(pop)popped=true;return {moveY:1,jumpHeld:!popped,jumpReleased:pop};
 },300));
 return {stages,...t.snapshot()};
}

export function warehouseHalfpipe(t,hard=false){
 const {p}=t;t.place([-46,.15,-91],[-1,0,0],hard);
 let launched=false,apex=0;
 const result=t.run(()=>launched&&p.grounded,()=>{
  launched||=p.vertAir;apex=Math.max(apex,p.pos.y);return {moveY:launched?0:1,jumpHeld:true};
 },1200);
 return {...result,launched,apex,surface:p.groundHit?.name};
}

export function warehouseStreetCombo(t,hard=false){
 const {p,l}=t;t.place([24,.15,-16],[8,0,-14],hard);
 let popped=false,grindFrames=0,maxMult=0,curvedTurn=0,firstHeading=null;
 const result=t.run(()=>popped&&p.grounded,()=>{
  if(p.state==='grind'){
   grindFrames++;firstHeading??=p.skateCameraHeading.clone();curvedTurn=Math.max(curvedTurn,firstHeading.angleTo(p.skateCameraHeading));
  }
  maxMult=Math.max(maxMult,p.comboMult);
  const remaining=p.grindRail?(p.grindDir>0?p.grindRail.totalLength-p.grindT:p.grindT):Infinity;
  const pop=!popped&&p.state==='grind'&&remaining<4.5;
  if(pop)popped=true;
  return {moveY:1,jumpHeld:!popped,jumpReleased:pop,spinPressed:pop,spinHeld:pop,grindHeld:!popped,
   moveX:p.state==='grind'?t.balance():0};
 },1400);
 for(let i=0;i<100&&!t.fail();i++){maxMult=Math.max(maxMult,p.comboMult);t.tick({grabHeld:true});}
 return {...result,...t.snapshot(),grindFrames,maxMult,curvedTurn};
}
