// Ordinary device samples shared by the Node runtime and real browser.
export function* runTempleJourney(r){
 const route=r.route,p=r.p,jump=route.gaps.find(g=>g.switchX===undefined);
 const cornerSpeed=route.id==='jungle-terraces'?10:15;
 let released=false,braking=false;
 for(let frame=0;frame<18500&&p.state!=='finished';frame++){
  if(p.isBailing||['dead','gameover'].includes(p.state))throw Error('Temple journey lost control at '+JSON.stringify({frame,position:p.pos.toArray(),state:p.state}));
  const sample=(()=>{
      // Feed the production camera heading before this device sample.
      if(r.nodeCamera){const camera=r.l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(camera.x,0,camera.z);}
      const local=route.toLocal(p.pos.toArray()),s=local[0];
      const decision=route.gaps.find(g=>g.switchX!==undefined&&s>g.switchX-30&&s<g.switchX+8);
      if(decision){
        const spec=route.data.components.find(c=>c.t==='crate'&&c.kind==='bang'&&c.grp===decision.group);
        const live=r.l.crates.find(c=>c.bang&&Math.abs(c.mesh.position.x-spec.p[0])<.01&&Math.abs(c.mesh.position.z-spec.p[2])<.01);
        if(!live.bangUsed){
          const early=s<decision.switchX-4;
          const q=route.toWorld(early?Math.min(s+Math.min(3,3/route.frameAt(s).scale),decision.switchX-4):decision.switchX,spec.p[1],early?1.25:-2.3),dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,d=Math.hypot(dx,dz);
          return {...r.worldDirectionInput({x:dx,z:dz},Math.min(.55,d/.6)),jumpHeld:true,grabHeld:Math.abs(p.speed)>(early?4:2),
            spinHeld:!early&&Math.hypot(spec.p[0]-p.pos.x,spec.p[2]-p.pos.z)<1.8&&(p.spinning||!r.lastInput.spinHeld)};
        }
      }
      // The uphill bank spends approach speed; charge to the flat apron's lip.
      const pop=!released&&s>=jump.a-.35&&s<jump.a&&p.grounded;
      if(pop)released=true;
      const pipe=route.pipes.find(pipe=>s>pipe.a-55&&s<pipe.b+8);
      const turn=route.frameAt(s),future=route.frameAt(s+10);
      const corner=turn.fx*future.fx+turn.fz*future.fz<.985;
      if(!pipe&&!corner)braking=false;
      else {const pipeSpeed=pipe?Math.sqrt(31.17*pipe.radius)+4.2:15;
        const maximum=corner?cornerSpeed:pipeSpeed,minimum=maximum-3;
        if(p.speed>maximum)braking=true;else if(p.speed<minimum)braking=false;}
      const target=route.toWorld(Math.min(route.end-6,s+(corner?Math.min(2,2.8/turn.scale):Math.min(7,7/turn.scale))),p.pos.y,1.25);
      const delta={x:target[0]-p.pos.x,z:target[2]-p.pos.z};
      const move=!pop&&(p.grounded||!p.airFromSkate)?r.worldDirectionInput(delta):{};
      const switchNear=route.gaps.some(g=>g.switchX!==undefined&&Math.abs(s-g.switchX)<5);
      return {...move,jumpHeld:!pop,spinHeld:switchNear&&p.grounded,grabHeld:!pop&&braking&&p.grounded};
  })();
  // A slow approach must bank the actual checkpoint crate with an attack.
  // Its loaded model can meet the rider before the nominal route centre.
  if(p.grounded){
   const checkpoint=r.l.checkpoints.some(cp=>!cp.active&&cp.box.distanceToPoint(p.pos)<3.5);
   const plainCrate=r.l.crates.some(c=>c.alive&&!c.pending&&!c.metal&&!c.metalBounce&&!c.bang&&!c.nitroBang&&!c.bouncy&&!c.tnt&&!c.nitro&&c.box.distanceToPoint(p.pos)<2.8);
   const explosive=r.l.crates.some(c=>c.alive&&!c.pending&&(c.tnt||c.nitro)&&c.box.distanceToPoint(p.pos)<3.5);
   if(checkpoint||plainCrate&&!explosive)sample.spinHeld=p.spinning||!r.lastInput.spinHeld;
  }
  yield sample;
 }
 if(p.state!=='finished')throw Error('Temple journey timed out');
 if(!released)throw Error('The final gap was not ollied');
 return {state:p.state,deaths:p.totalDeaths,position:p.pos.toArray()};
}
