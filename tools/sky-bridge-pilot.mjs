const clamp=(n,limit=1)=>Math.max(-limit,Math.min(limit,n));
/** Ordinary input for the walking bridge followed by its skate skyway. */
export function createSkyBridgePilot(source){
 const data=source.SKY_BRIDGE_LEVEL;
 const supports=data.components.filter(c=>(c.t==='platform'||c.t==='crumble')&&c.p[0]===0&&c.solid!==false&&c.p[2]>-243);
 const depth=c=>Math.abs(Math.cos((c.yaw??0)*Math.PI/180))*c.s[2]+Math.abs(Math.sin((c.yaw??0)*Math.PI/180))*c.s[0];
 let hold=0,rest=0,air=null;
 const evidence={jumps:0,ice:[],falling:[],grindFrames:[0,0],gaps:[],checkpoints:[],bails:0};
 return {evidence,sample(p,l){
  const z=p.pos.z,spin=l.checkpoints.some(c=>!c.active&&Math.abs(c.spawnPos.z-z)<2);
  if(z>-235){
   const lane=z<-106&&z>-132?.95:((z<-12&&z>-36)||(z<-177&&z>-198))?-.95:0,dx=lane-p.pos.x;
   const moveX=p.groundHit?.slippy?clamp(dx*.2-p.walkVelocity.x*.18,.22):clamp(dx*1.1,.65);
   const ground=supports.find(c=>Math.abs(z-c.p[2])<=depth(c)/2+.12),distance=ground?z-(ground.p[2]-depth(ground)/2):null;
   if(hold>0)hold--;else if(rest>0)rest--;else if(p.grounded&&distance!==null&&distance<1.8&&z>-229){hold=5;rest=12;evidence.jumps++;}
   const enemy=l.enemies.some(e=>e.alive&&Math.hypot(e.group.position.x-p.pos.x,e.group.position.z-z)<3.2);
   const bomb=l.crates.some(c=>c.alive&&(c.tnt||c.nitro)&&c.mesh.position.distanceTo(p.pos)<3);
   return {moveY:1,moveX,jumpHeld:hold>0,spinHeld:spin||enemy&&!bomb};
  }
  if(p.state==='grind')return {moveY:1,moveX:clamp(-p.balance*8-p.balanceVel*.8),grindHeld:true,spinHeld:spin};
  const crossing=source.SKY_BRIDGE_GRIND_CROSSINGS.find(c=>z<c.near+1.3&&z>c.far);
  const jumping=source.SKY_BRIDGE_SKATE_GAPS.some(g=>z<g.takeoff+.7&&z>g.landing);
  // Re-press on support, not during the landing buffer: an early airborne
  // press would intentionally queue another jump on touching down.
  return {moveY:1,moveX:clamp(-p.pos.x*.65-p.lastVelX*.13,.4),jumpHeld:p.grounded&&!crossing&&!jumping,grindHeld:!!crossing,spinHeld:spin};
 },observe(p,l){
  const hit=p.groundHit,id=hit?.mesh?.userData.editorIdx;
  if(hit?.slippy&&!evidence.ice.includes(id))evidence.ice.push(id);
  if(hit?.crumbleId!==undefined&&!evidence.falling.includes(hit.crumbleId))evidence.falling.push(hit.crumbleId);
  l.checkpoints.forEach((c,i)=>{if(c.active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);});
  if(p.isBailing)evidence.bails++;
  if(p.state==='grind')source.SKY_BRIDGE_GRIND_CROSSINGS.forEach((c,i)=>{if(p.pos.z<=c.near+1&&p.pos.z>=c.far-1)evidence.grindFrames[i]++;});
  for(const [i,g]of source.SKY_BRIDGE_SKATE_GAPS.entries()){
   if(!air&&p.state==='air'&&p.pos.z<g.takeoff+2&&p.pos.z>g.landing)air={index:i,from:p.pos.toArray(),speed:p.speed,board:p.airFromSkate};
   if(air?.index===i&&p.grounded&&p.pos.z<g.landing+.2){evidence.gaps.push({...air,to:p.pos.toArray()});air=null;}
  }
 }};
}
