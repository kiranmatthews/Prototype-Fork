// Device input only; shared by the live browser and the production-controller run.
export function createCountryClubPilot(m,{nodeCamera=false,shortcut=false,ridge=false}={}){
  let s=7,frame=0,activeGap=null,phase='First tee',shortcutS=0,shortcutDone=false,shortcutJump=null;
  const evidence={checkpoints:[],jumps:[],phases:[],maxSpeed:0,railFrames:0,shortcutFrames:0,shortcutJump:null,crystal:false};
  const direction=(p,l,q)=>{
    const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1;
    const f=p.courseInputDirection(l)??p.camDir;
    return {moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};
  };
  const offset=s=>m.COUNTRY_CLUB_SLALOM.reduce((u,o)=>u-o.side*5.2*Math.exp(-(((s-o.s)/20)**4)),0);
  const snapshot=p=>({s,frame,p:p.pos.toArray(),speed:p.speed,state:p.state,grounded:p.grounded});
  return {
    evidence,get phase(){return phase;},get progress(){return s;},
    sample(p,l){
      if(nodeCamera){const f=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(f)p.camDir.set(f.x,0,f.z);}
      if(p.isBailing||['dead','gameover'].includes(p.state))throw Error('Country Club pilot lost control '+JSON.stringify(snapshot(p)));
      s=m.countryClubProgress(p.pos,s);
      phase=[...m.COUNTRY_CLUB_SECTIONS].reverse().find(a=>s>=a.s)?.name??phase;
      let q=m.countryClubPoint(Math.min(m.COUNTRY_CLUB_LENGTH,s+7),offset(s+7));
      let jump=true,grind=false;
      if(shortcut&&!shortcutDone&&s>m.COUNTRY_CLUB_SHORTCUT.start-10){
        const a=m.COUNTRY_CLUB_SHORTCUT;
        phase='Pond tee shortcut';
        let best=Infinity;
        for(let at=Math.max(0,shortcutS-4);at<=Math.min(a.length,shortcutS+20);at+=.25){const v=a.point(at),d=Math.hypot(v[0]-p.pos.x,v[2]-p.pos.z);if(d<best){best=d;shortcutS=at;}}
        q=a.point(Math.min(a.length,shortcutS+6));evidence.shortcutFrames++;
        if(shortcutS>=a.a-5&&shortcutS<a.b+5){jump=false;shortcutJump??={takeoff:shortcutS,airSeen:false};}
        if(shortcutJump&&!p.grounded)shortcutJump.airSeen=true;
        if(shortcutJump?.airSeen&&p.grounded&&shortcutS>a.b&&!evidence.shortcutJump)evidence.shortcutJump={...shortcutJump,landing:shortcutS,position:p.pos.toArray()};
        if(shortcutS>a.length-3){s=a.end;shortcutDone=true;}
      }
      if(ridge&&s>m.COUNTRY_CLUB_RIDGE.start-12&&s<m.COUNTRY_CLUB_RIDGE.end+1){
        q=m.countryClubPoint(s+5,-5);grind=true;
        if(p.state==='grind')return {jumpHeld:true,grindHeld:true,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7))};
      }
      if(activeGap){
        jump=false;
        if(!p.grounded)activeGap.airSeen=true;
        if(p.grounded&&s>activeGap.b){evidence.jumps.push({...activeGap,landing:s,speed:p.speed});activeGap=null;jump=true;}
      }
      const next=m.COUNTRY_CLUB_GAPS.find(g=>s<g.b);
      if(!activeGap&&next&&p.grounded&&s>=next.a-5&&s<next.a){activeGap={...next,takeoff:s,airSeen:false};jump=false;}
      const cp=l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<6);
      return {...direction(p,l,q),jumpHeld:jump,grindHeld:grind,spinHeld:cp&&frame%24<12};
    },
    observe(p,l){
      frame++;evidence.maxSpeed=Math.max(evidence.maxSpeed,p.speed);
      if(p.state==='grind')evidence.railFrames++;
      evidence.crystal ||=p.hasCrystal;
      if(evidence.phases.at(-1)?.name!==phase)evidence.phases.push({name:phase,frame,s});
      for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
      if(frame>15000)throw Error('Country Club pilot timed out '+JSON.stringify(snapshot(p)));
    },
  };
}
