// Device-input pilot for the authored city. No position, speed, movement
// tuning, collision or checkpoint writes occur during traversal.
export function createRooftopPilot(m,{nodeCamera=false,takeoff,mode='skate',route='main',lateral=0,maxFrames=110000,start=0}={}){
 let frame=0,progress=start,active=null,charge=0,stallAt=0,stallFrame=0;
 const gaps=m.rooftopGaps(route),evidence={route,mode,jumps:[],roofs:[],checkpoints:[],districts:[],peakSpeed:0,minimumLandingMargin:Infinity,doubleJumps:0,crystal:false,branchLandings:[]};
 const direction=(p,l,q,pace=1)=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return {moveX:(dx*-f.z+dz*f.x)/n*pace,moveY:(dx*f.x+dz*f.z)/n*pace};};
 return{evidence,get progress(){return progress;},
  sample(p,l){
   progress=m.rooftopProject(p.pos.x,p.pos.z,progress);
   if(nodeCamera){const d=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(d)p.camDir.set(d.x,0,d.z);}
   if(p.isBailing||['dead','gameover'].includes(p.state))throw Error(`Lost city run ${JSON.stringify({frame,progress,p:p.pos.toArray(),state:p.state,bail:p.isBailing,active})}`);
   if(progress>stallAt+2){stallAt=progress;stallFrame=frame;}else if(frame-stallFrame>600)throw Error(`Stalled at ${progress}: ${JSON.stringify({p:p.pos.toArray(),active,speed:p.speed,state:p.state})}`);
   const gap=gaps.find(g=>progress<g.b+.15),offset=takeoff??(mode==='foot'?.7:1.6);
   let jump=mode==='skate',q=m.rooftopPoint(Math.min(m.ROOFTOP_LENGTH-7,progress+(mode==='foot'?3.5:p.groundHit?.slippy?11:7)),route);
   if(active){
    jump=false;if(!p.grounded){active.air=true;active.airFrames++;}
    if(mode==='foot'&&active.double&&active.air&&active.airFrames>=17&&active.airFrames<=20)jump=true;
    if(mode==='foot'&&active.double&&active.airFrames===21&&!active.doubleCounted){active.doubleCounted=true;evidence.doubleJumps++;}
    if(p.grounded&&progress>active.b){evidence.jumps.push({...active,landing:progress,speed:p.speed,foot:!p.freeSkate});active=null;jump=mode==='skate';charge=0;}
   }
   if(!active&&gap&&p.grounded){
    if(mode==='skate'&&progress>=gap.a-offset){active={...gap,takeoff:progress,air:false,airFrames:0};jump=false;}
    if(mode==='foot'&&progress>=gap.a-offset-3.6){charge++;jump=charge<=24;if(charge===25){active={...gap,takeoff:progress,air:false,airFrames:0,double:gap.b-gap.a>3.5||gap.ramp||gap.to-gap.from>.25};jump=false;}}
   }
   const aiming=active??gap;
   if(aiming&&progress>aiming.a-12)q=m.rooftopPoint(aiming.b+Math.max(5,p.speed*.55),route);
   // Line up with a visible checkpoint early; never turn back at skate speed.
   const cp=l.checkpoints.find((c,i)=>!c.active&&p.grounded&&m.ROOFTOP_CHECKPOINTS[i].s>progress-.5&&c.spawnPos.distanceTo(p.pos)<22);
   if(cp)q=[cp.spawnPos.x,cp.spawnPos.y,cp.spawnPos.z];
   if(lateral&&!cp){const yaw=m.rooftopYaw(progress)*Math.PI/180;q[0]+=Math.cos(yaw)*lateral;q[2]-=Math.sin(yaw)*lateral;}
   const steer=p.state==='air'&&p.airFromSkate?{}:direction(p,l,q);
   if(mode==='foot'&&p.state==='air'&&Math.abs(steer.moveX??0)<.18){steer.moveX=0;steer.moveY=Math.sign(steer.moveY??1);}
   // Wet roofs retain downhill momentum: use the normal brake to keep a
   // controllable approach speed, releasing it for takeoff. No state writes.
   const alignment=((q[0]-p.pos.x)*p.axisF.x+(q[2]-p.pos.z)*p.axisF.z)/(Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z)||1);
   const brake=mode==='skate'&&p.grounded&&p.groundHit?.slippy&&alignment>.995&&p.speed>25&&(!gap||gap.a-progress>10);
   return{...steer,jumpHeld:jump,grabHeld:brake,spinHeld:p.grounded&&l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.7)};
  },
  observe(p,l){
   frame++;evidence.crystal=p.hasCrystal;progress=m.rooftopProject(p.pos.x,p.pos.z,progress);evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);
   const mesh=p.groundHit?.mesh??(p.groundHit?.crumbleId===undefined?null:l.crumbles[p.groundHit.crumbleId]?.mesh);
   const component=l.builtFromData?.components[mesh?.userData.editorIdx],match=/^RR:(\d+)/.exec(component?.nm??'');
   const id=match?Number(match[1]):null,r=id===null?null:[...m.ROOFTOP_ROOFS,...m.ROOFTOP_BRANCH_ROOFS].find(r=>r.index===id);
   if(p.grounded&&r){
    if(!evidence.roofs.includes(r.index)){
     evidence.roofs.push(r.index);evidence.minimumLandingMargin=Math.min(evidence.minimumLandingMargin,r.b-progress);
     if(r.route>=0)evidence.branchLandings.push({roof:r.index,route:r.route,station:progress,position:p.pos.toArray(),component:component.nm});
    }
    if(!evidence.districts.includes(r.district))evidence.districts.push(r.district);
   }
   for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
   if(frame>maxFrames)throw Error(`City run timed out at ${progress}`);
  }
 };
}
