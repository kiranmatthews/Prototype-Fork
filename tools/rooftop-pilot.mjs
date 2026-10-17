// Reproducible device-input pilot. Geometry, velocities, tuning, checkpoint and
// finish state are never changed; the browser uses the ordinary gamepad path.
export function createRooftopPilot(m,{nodeCamera=false,takeoff=2.5,lateral=0,mode='skate'}={}) {
 let frame=0,active=null,charge=0;
 const evidence={jumps:[],roofs:[],checkpoints:[],peakSpeed:0,minimumLandingMargin:Infinity};
 const direction=(p,l,q)=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir;return {moveX:(dx*-f.z+dz*f.x)/n,moveY:(dx*f.x+dz*f.z)/n};};
 return {evidence,
  sample(p,l){
   if(nodeCamera){const d=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z,{s:p.laneCursor.s});if(d)p.camDir.set(d.x,0,d.z);}
   if(p.isBailing||['dead','gameover'].includes(p.state))throw Error(`Lost rooftop run ${JSON.stringify({frame,p:p.pos.toArray(),state:p.state,bail:p.isBailing,active})}`);
   const s=-p.pos.z,gap=m.ROOFTOP_GAPS.find(g=>s<g.b);
   let jump=mode==='skate',q=m.rooftopPoint(s+Math.max(4,p.speed*.35));q[0]+=lateral*Math.max(0,Math.min(1,(m.ROOFTOP_LENGTH-25-s)/18));
   if(active){jump=false;if(!p.grounded)active.air=true;
    if(p.grounded&&s>active.b){evidence.jumps.push({...active,landing:s,landingX:p.pos.x,speed:p.speed,foot:!p.freeSkate});active=null;jump=mode==='skate';charge=0;}
   }
   if(!active&&gap&&p.grounded){
    if(mode==='skate'&&s>=gap.a-takeoff){active={...gap,takeoff:s,air:false};jump=false;}
    if(mode==='foot'&&s>=gap.a-takeoff-3.6){charge++;jump=charge<=24;if(charge===25)active={...gap,takeoff:s,air:false};}
   }
   if(gap&&s>gap.a-9){q=[gap.x+lateral,gap.to,-(gap.b+14)];}
   const cp=l.checkpoints.find(c=>!c.active&&s>=-c.spawnPos.z-8&&s<-c.spawnPos.z+1);
   if(cp&&p.grounded)q=[cp.spawnPos.x,cp.spawnPos.y,-(s+5)];
   const steer=p.state==='air'&&p.airFromSkate?{}:direction(p,l,q);
   return {...steer,jumpHeld:jump,spinHeld:p.grounded&&l.checkpoints.some(c=>!c.active&&c.spawnPos.distanceTo(p.pos)<2.5)};
  },
  observe(p,l){
   frame++;evidence.peakSpeed=Math.max(evidence.peakSpeed,p.speed);
   if(p.grounded){const r=m.ROOFTOP_ROOFS.find(r=>Math.abs(p.pos.y-r.top)<.15&&-p.pos.z>=r.a-.5&&-p.pos.z<=r.b+.5);if(r&&!evidence.roofs.includes(r.index)){evidence.roofs.push(r.index);evidence.minimumLandingMargin=Math.min(evidence.minimumLandingMargin,r.b+p.pos.z,r.width/2-Math.abs(p.pos.x-r.x));}}
   for(let i=0;i<l.checkpoints.length;i++)if(l.checkpoints[i].active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
   if(frame>15000)throw Error('Rooftop run timed out');
  },
 };
}
