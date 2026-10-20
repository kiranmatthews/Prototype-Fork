// Input-only, adaptive production-controller pilot. The three gap releases are
// deliberate ollies; all other sections keep charge and wheel contact.
export function createAfterHoursPilot(source) {
 let jump=0,air=null,mounted=false;
 const evidence={gaps:[],checkpoints:[],mountedFrames:0,footFrames:0,finished:false};
 const direction=(p,l,x,z)=>{
  const f=p.courseInputDirection(l)??p.camDir,n=Math.hypot(x,z)||1,fn=Math.hypot(f.x,f.z)||1;
  return {moveX:(x*-f.z+z*f.x)/n/fn,moveY:(x*f.x+z*f.z)/n/fn};
 };
 const snakeX=z=>{
  const q=source.AFTER_HOURS_SNAKE;
  if(z>=q[0][2]||z<=q.at(-1)[2])return 0;
  for(let i=0;i<q.length-1;i++)if(z<=q[i][2]&&z>=q[i+1][2]){
   const t=(q[i][2]-z)/(q[i][2]-q[i+1][2]);return q[i][0]+(q[i+1][0]-q[i][0])*t;
  }
  return 0;
 };
 return {evidence,sample(p,l){
  const z=p.pos.z,targetZ=z-11,targetX=snakeX(targetZ);
  let jumpHeld=true;
  const gap=source.AFTER_HOURS_GAPS[jump];
  if(gap&&(p.grounded||p.coyoteTimer>0)&&z-gap.takeoff[2]<1.2&&z>gap.takeoff[2]-.7){
   air={name:gap.name,index:jump,start:p.pos.toArray(),peak:p.pos.y,airborne:false};jump++;jumpHeld=false;
  }
  return {...direction(p,l,targetX-p.pos.x,-11),jumpHeld};
 },observe(p,l){
  mounted ||= p.boardRolling;
  if(mounted){if(p.boardRolling)evidence.mountedFrames++;else if(p.state!=='finished')evidence.footFrames++;}
  if(air){air.peak=Math.max(air.peak,p.pos.y);air.airborne||=!p.grounded;
   if(air.airborne&&p.grounded){evidence.gaps.push({...air,end:p.pos.toArray()});air=null;}}
  for(const [i,cp]of l.checkpoints.entries())if(cp.active&&!evidence.checkpoints.includes(i))evidence.checkpoints.push(i);
  evidence.finished=p.state==='finished';
 }};
}
