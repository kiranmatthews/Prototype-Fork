// Ordinary controller samples shared by the native and full-render checks.
// The caller may place the rider once, at rest, on a supported fixture start.
export const mallGapFixtures = [
 {name:'Flying Leap, earlier release',kind:'drop',start:[-6300,315,185],heading:[0,0,-1],release:-4580},
 {name:'Flying Leap, later release',kind:'drop',start:[-6300,315,185],heading:[0,0,-1],release:-4560},
 {name:'Right handrail to suspended tape beam',kind:'tape',start:[-6800,315,830],heading:[-.01,0,-1],release:-4110},
];
export function createMallGapPilot(f){
 let phase='approach',offFrame=-1,frame=0,rollFrames=0,beamFrames=0,approachFrames=0,oldState='ride',previous=null;
 const e={name:f.name,kind:f.kind,frames:0,done:false,reached:false,bail:false,rails:[],launches:[],trace:[],beamFrames:0,beamDistance:0,approachFrames:0};
 return {e, sample(p,source,rail){
  const grinding=p.state==='grind';
  if(f.kind==='drop')return{moveX:0,moveY:p.grounded?1:0,jumpHeld:source[0]<f.release};
  if(phase==='approach'&&source[0]>-5640)phase='catch';
  if(phase==='catch'&&grinding)phase='ride';
  if(phase==='ride'&&source[0]>f.release){phase='transfer';offFrame=frame;}
  if(phase==='transfer'&&rail===54)phase='beam';
  if(phase==='beam'&&!grinding)phase='rollout';
  const lateral=(phase==='ride'&&source[0]>f.release-20)||(phase==='transfer'&&grinding&&rail===60);
  return{
   moveX:lateral?-1:grinding?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,
   moveY:lateral?0:p.grounded||grinding?1:0,
   jumpHeld:phase==='approach'||phase==='ride'||phase==='beam'||phase==='rollout',
   grindHeld:phase==='catch'||phase==='ride'||phase==='beam'||phase==='transfer'&&frame>offFrame+3,
  };
 }, observe(p,source,rail){
  frame++;e.frames=frame;e.bail||=p.isBailing;e.source=source;e.speed=p.speed;e.state=p.state;
  if(rail!==null&&!e.rails.includes(rail))e.rails.push(rail);
  if(p.state==='air'&&oldState!=='air')e.launches.push({frame,source,speed:p.speed,verticalSpeed:p.vVel});
  if(rail===60)approachFrames++;
  if(rail===54){beamFrames++;if(previous)e.beamDistance+=Math.hypot(...p.pos.toArray().map((n,i)=>n-previous[i]));}
  const pastDrop=f.kind==='drop'&&source[0]>-4100;
  const pastBeam=f.kind==='tape'&&phase==='rollout'&&beamFrames>0;
  if((pastDrop||pastBeam)&&p.grounded&&p.state==='ride')rollFrames++;else rollFrames=0;
  e.reached=rollFrames>=30;e.beamFrames=beamFrames;e.approachFrames=approachFrames;e.phase=phase;
  if(frame%6===0||e.reached||e.bail)e.trace.push({frame,source,state:p.state,speed:p.speed,verticalSpeed:p.vVel,rail,phase});
  if(e.reached||e.bail||['dead','gameover'].includes(p.state)||frame>1800)e.done=true;
  oldState=p.state;previous=p.pos.toArray();
 }};
}
