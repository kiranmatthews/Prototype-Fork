// Continuous device-input pilot, shared by fixed-step and real-keyboard tests.
// It reads live boat positions and waits for a reachable gap before jumping.
export function harbourPilot(boats) {
 const route=[['cargo',-5],['spring',5,'First skiff'],['ferry','First skiff',27],
  ['cargo',31],['spring',39,'Cargo lighter'],['ferry','Cargo lighter',61],
  ['cargo',64],['spring',70,'Spring skiff'],['rebound','Spring skiff',92.9],
  ['cargo',94],['spring',100,'Homeward ferry'],['ferry','Homeward ferry',124],['cargo',129],['finish',139]];
 let stage=0,entered=null,charge=null,flight=false,lastJump=false,lastSpin=false;
 const history=[];
 const controls=values=>{const i={moveX:0,moveY:0,jumpHeld:false,spinHeld:false,...values};
  i.jumpPressed=i.jumpHeld&&!lastJump;i.jumpReleased=!i.jumpHeld&&lastJump;i.spinPressed=i.spinHeld&&!lastSpin;
  lastJump=i.jumpHeld;lastSpin=i.spinHeld;return i;};
 const ahead=(x,p,tolerance=.25)=>Math.abs(x-p.at[0])>tolerance?Math.sign(x-p.at[0]):0;
 const arrival=(p,height=1.2)=>{
  const peak=p.vy>0?p.at[1]+p.vy*p.vy/66:p.at[1];
  return p.vy>0?p.vy/33+Math.sqrt(Math.max(0,2*(peak-height)/119)):
   (Math.sqrt(p.vy*p.vy+238*Math.max(0,p.at[1]-height))+p.vy)/119;
 };
 return {history,sample(p){
  entered??=p.time;
  const advance=()=>{history.push({stage:route[stage].join(' / '),at:p.at,time:p.time});stage++;entered=p.time;charge=null;flight=false;};
  for(let attempt=0;attempt<3;attempt++){
   const [kind,a,b]=route[stage]??['finish',139];
   const label=route[stage]?.join(' / ')??'complete';
   if(p.state==='finished')return{done:true,input:controls({}),stage:label};
   if(kind==='cargo'){
    const boxes=p.crates.filter(c=>c.name.startsWith(`Harbour cargo ${a} ·`)&&c.alive);
    if(!boxes.length){advance();continue;}
    const target=boxes.reduce((q,c)=>Math.abs(c.at[0]-p.at[0])<Math.abs(q.at[0]-p.at[0])?c:q);
    return{stage:label,input:controls({moveX:ahead(target.at[0],p,.7),spinHeld:(p.time-entered)%.5<.32})};
   }
   if(kind==='spring'){
    if(b==='Spring skiff'&&p.spring&&p.surface===b&&p.vy>8){advance();continue;}
    if(p.grounded&&p.surface===b){advance();continue;}
    if(p.spring){flight=true;const boat=boats.find(q=>q.name===b),t=p.levelTime+arrival(p);
     const x=boat.x+Math.sin(t*boat.speed+boat.phase)*boat.amp;
     return{stage:label,input:controls({moveX:ahead(x,p,.4),jumpHeld:true})};
    }
    return{stage:label,input:controls({moveX:ahead(a,p),jumpHeld:Math.abs(a-p.at[0])<4})};
   }
   if(kind==='ferry'){
    if(p.grounded&&p.at[0]>=b-.25&&p.surface!==a){advance();continue;}
    if(flight)return{stage:label,input:controls({moveX:ahead(b+1,p,.3)})};
    const boat=p.boats.find(q=>q.name===a),front=boat.right-1.1;
    if(charge!==null){
     if(p.time-charge>=.42){flight=true;return{stage:label,input:controls({moveX:1})};}
     return{stage:label,input:controls({jumpHeld:true})};
    }
    if(p.grounded&&Math.abs(front-p.at[0])<.45&&b-p.at[0]<5.3){charge=p.time;return{stage:label,input:controls({jumpHeld:true})};}
    return{stage:label,input:controls({moveX:ahead(front,p,.3)})};
   }
   if(kind==='rebound'){
    if(p.grounded&&p.at[0]>91){advance();continue;}
    return{stage:label,input:controls({moveX:ahead(b,p,.3),jumpHeld:true})};
   }
   return{stage:label,input:controls({moveX:1})};
  }
 }};
}

export const harbourObservation=(p,l)=>({at:p.pos.toArray(),time:p.runTime,levelTime:l.time,grounded:p.grounded,state:p.state,
 vy:p.vVel,spring:p.trampolineAir,surface:p.surfaceName,bail:p.isBailing,deaths:p.totalDeaths,cratesBroken:p.cratesBroken,
 boats:l.movers.map(m=>({name:l.builtFromData?.components[m.mesh.userData.editorIdx]?.nm,x:m.mesh.position.x,right:m.mesh.position.x+(m.mesh.geometry.boundingBox?.max.x??0)})),
 crates:l.crates.map(c=>({name:l.builtFromData?.components[c.mesh.userData.editorIdx]?.nm??c.mesh.userData.sourceName??'',at:c.mesh.position.toArray(),alive:c.alive}))});
