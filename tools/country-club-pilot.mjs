// Ordinary device inputs only: never set speed, state, position or checkpoint state.
export function createCountryClubPilot(m,{nodeCamera=false,waterRails=false,ridge=false}={}){
  let previousPosition=null,s=7,frame=0,activeGap=null,phase='Clubhouse drive',activeRail=null;
  const evidence={checkpoints:[],jumps:[],phases:[],corners:[],maxSpeed:0,railFrames:0,rails:[],crystal:false,pads:[],fastFrames:0,cruisingFrames:0,slowSamples:[],minimumCruiseSpeed:Infinity};
  const direction=(p,l,q)=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return {moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};};
  const offset=s=>m.countryClubRacingOffset(s);
  const snapshot=p=>({s,frame,p:p.pos.toArray(),speed:p.speed,state:p.state,grounded:p.grounded});
  return {
    evidence,get phase(){return phase;},get progress(){return s;},
    sample(p,l){
      if(nodeCamera){const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);}
      if(p.isBailing||['dead','gameover','swim'].includes(p.state))throw Error('Country Club pilot lost control '+JSON.stringify(snapshot(p)));
      s=m.countryClubProgress(p.pos,s);
      phase=[...m.COUNTRY_CLUB_SECTIONS].reverse().find(a=>s>=a.s)?.name??phase;
      const look=Math.max(7,Math.abs(p.speed)*.32);
      let q=m.countryClubPoint(Math.min(m.COUNTRY_CLUB_LENGTH,s+look),offset(s+look)),jump=true,grind=false;
      const candidate=[...(waterRails?m.COUNTRY_CLUB_WATER_RAILS:[]),...(ridge?[{...m.COUNTRY_CLUB_RIDGE,side:-1,offset:8,hole:15}]:[])].find(r=>s>r.start-10&&s<r.end-2);
      if(candidate){
        activeRail=candidate;grind=true;q=m.countryClubRailPoint(candidate,Math.min(candidate.end,s+5));
        if(p.state==='grind')return {jumpHeld:true,grindHeld:true,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7))};
      }else activeRail=null;
      if(activeGap){jump=false;if(!p.grounded)activeGap.airSeen=true;if(p.grounded&&s>activeGap.b){evidence.jumps.push({...activeGap,landing:s,speed:p.speed});activeGap=null;jump=true;}}
      const next=m.COUNTRY_CLUB_GAPS.find(g=>s<g.b);
      if(!activeRail&&!activeGap&&next&&p.grounded&&s>=next.a-5&&s<next.a){activeGap={...next,takeoff:s,airSeen:false};jump=false;}
      const cp=l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<6);
      const enemy=l.enemies.some(e=>e.alive&&e.group.position.distanceTo(p.pos)<7);
      return {...direction(p,l,q),jumpHeld:jump,grindHeld:grind,spinHeld:(cp||enemy)&&frame%24<12};
    },
    observe(p,l){
      const current=p.pos.toArray(),motion=previousPosition?[current[0]-previousPosition[0],current[2]-previousPosition[2]]:null;previousPosition=current;
      for(const c of m.COUNTRY_CLUB_CORNERS??[])if(s>=c.entry-3&&s<=c.exit+3){
        let e=evidence.corners.find(e=>e.index===c.index);if(!e){e={index:c.index,authoredAngle:c.angle,radius:c.radius,minimumSpeed:Infinity,maximumOffset:0,frames:0,firstMotion:null,lastMotion:null};evidence.corners.push(e);}
        e.frames++;e.minimumSpeed=Math.min(e.minimumSpeed,p.speed);e.maximumOffset=Math.max(e.maximumOffset,m.countryClubNearestRoad(p.pos.x,p.pos.z).distance);
        if(motion&&Math.hypot(...motion)>.01){e.firstMotion??=motion;e.lastMotion=motion;const a=e.firstMotion,b=e.lastMotion;e.actualHeadingChange=Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1])/(Math.hypot(...a)*Math.hypot(...b)))))*180/Math.PI;}
      }
      frame++;evidence.maxSpeed=Math.max(evidence.maxSpeed,p.speed);
      if(s>80&&p.grounded&&p.state==='ride'){
        evidence.cruisingFrames++;if(p.speed>=22.5)evidence.fastFrames++;
        evidence.minimumCruiseSpeed=Math.min(evidence.minimumCruiseSpeed,p.speed);
        if(p.speed<18&&frame%30===0)evidence.slowSamples.push(snapshot(p));
      }
      if(p.state==='grind'){evidence.railFrames++;if(activeRail&&!evidence.rails.includes(activeRail.hole))evidence.rails.push(activeRail.hole);}
      if(p.groundHit?.mesh?.userData?.speedPadId&&!evidence.pads.includes(p.groundHit.mesh.userData.speedPadId))evidence.pads.push(p.groundHit.mesh.userData.speedPadId);
      evidence.crystal ||=p.hasCrystal;
      if(evidence.phases.at(-1)?.name!==phase)evidence.phases.push({name:phase,frame,s});
      for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
      if(frame>20000)throw Error('Country Club pilot timed out '+JSON.stringify(snapshot(p)));
    },
  };
}
