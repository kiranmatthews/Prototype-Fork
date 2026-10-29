// Test driver only: observe a crossing and issue ordinary movement/jump input.
export function crossingPilot(run,point){
 const track=Array.from({length:Math.ceil(run.b-run.a)+1},(_,i)=>({s:Math.min(run.b,run.a+i),p:point(Math.min(run.b,run.a+i),0)}));
 let hop=0,cooldown=0;
 return (p,dt=1/60)=>{
  const closest=track.reduce((best,q)=>{const d=(p.at[0]-q.p[0])**2+(p.at[2]-q.p[2])**2;return d<best.d?{...q,d}:best;},{d:Infinity});
  const s=closest.s,centre=point(s,0),side=point(s,0,1).map((v,i)=>v-centre[i]);
  const u=(p.at[0]-centre[0])*side[0]+(p.at[2]-centre[2])*side[2],v=p.velocity[0]*side[0]+p.velocity[2]*side[2];
  const done=s>=Math.min(run.b-5,3980)&&p.grounded || p.spring&&p.vy>15&&s>run.b-14;
  const [left,right]=run.bounds(s),middle=(left+right)/2,nextS=Math.min(run.b-4,s+9),nextBounds=run.bounds(nextS);
  const targetU=(nextBounds[0]+nextBounds[1])/2,target=point(nextS,run.y,targetU),dx=target[0]-p.at[0],dz=target[2]-p.at[2];
  const lateral=dx*p.side[0]+dz*p.side[2],predictive=(targetU-u-v*.65)*(side[0]*p.side[0]+side[2]*p.side[2]);
  const steer=p.grounded?predictive:lateral,input={moveY:1,moveX:Math.abs(steer)>1?Math.sign(steer):0};
  cooldown=Math.max(0,cooldown-dt);
  const threat=run.hazards.some(h=>h.s>s&&h.s-s<6.5&&Math.abs(u+v*.3-h.u)<h.width/2+1.2);
  const edge=Math.abs(u+v*.65-middle)>(right-left)/2-3;
  if(p.grounded&&!hop&&!cooldown&&(threat||edge)){hop=7/60;cooldown=.75;input.jumpPressed=true;}
  if(hop){input.jumpHeld=hop>dt+1e-6;input.jumpReleased=!input.jumpHeld;hop=Math.max(0,hop-dt);if(hop<1e-6)hop=0;}
  return {done,input,s,u,v};
 };
}
