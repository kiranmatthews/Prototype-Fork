// Tony Hawk line audit for Temple of Embers: what the production physics does
// with each reservoir bowl. Input-only pilots on the real Level/Player: straight
// drop-ins at governed entry speeds (centre lane and both carving lanes), pumped
// (X held) and unpumped, a release-at-the-lip variant, a deliberate turnaround
// back into the bowl toward the entry lip, and the aqueduct-rail hop toward each
// suspended cap. Nothing is placed except the start pose; crates and switches
// are restored by a hard respawn before every scenario.
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const [k,v]=a.slice(2).split('=');return [k,v??'1'];}));
const pick=v=>v===undefined?null:v==='none'?[]:v.split(',').map(Number);
const dropBowls=pick(args.dropins??args.bowl),hopBowls=pick(args.hops??args.bowl);
const OUT=args.out??'docs/temple-embers-design/deep/bowl-airs.json';
const round=(n,d=2)=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*10**d)/10**d:n;
// Hazard-free approaches, in station space: [start station, approach lane, station after which the test lane is taken].
const APPROACH={1:[99.5,1.5,98],2:[346,3,379],3:[739,1.25,747],4:[959.5,0,0],5:[1058,.9,1087.5]};
// Aqueduct-rail hop approaches: [start station, start lane] beside the rail at side -2.5.
const RAIL_APPROACH={1:[99,-2.5],2:[369.5,-3.6],3:[738.5,-2.5],4:[960,-2.5],5:[1058,-2.5]};

await withBlockworksRuntime(async r=>{
  const route=r.sourceModule.JUNGLE_TERRACES_ROUTE,{p,l,THREE,TUNING}=r;
  const local=()=>route.toLocal(p.pos.toArray());
  const kindOf=c=>c.nitroBang?'nitrobang':c.bang?'bang':c.metalBounce?'metalbounce':c.metal?'metal':c.bouncy?'bouncy':c.tnt?'tnt':c.nitro?'nitro':c.multiHit?'multihit':c.mask?'mask':c.life?'life':c.mystery?'mystery':'wood';
  const crateRows=()=>l.crates.map(c=>{const [s,,side]=route.toLocal([c.home?.x??c.mesh.position.x,c.box.min.y,c.home?.z??c.mesh.position.z]);return {c,s,side,bottom:c.box.min.y,top:c.box.max.y,kind:kindOf(c)};});
  const armSwitches=()=>{for(const box of l.crates.filter(c=>c.bang&&!c.bangUsed))l.triggerBang(box);l.root.updateMatrixWorld(true);};
  const place=(s,side)=>{const f=route.frameAt(s);p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s,route.groundAt(s)+.12,side)),heading:new THREE.Vector3(f.fx,0,f.fz)});armSwitches();r.stepFor(12);};
  const camera=()=>{const c=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(c.x,0,c.z);};
  const toward=(s,side)=>{const t=route.toWorld(Math.max(-18,Math.min(route.end-6,s)),p.pos.y,side);return r.worldDirectionInput({x:t[0]-p.pos.x,z:t[2]-p.pos.z});};
  const dead=()=>p.isBailing||['dead','gameover'].includes(p.state);
  const bodyTop=()=>p.crateBodyBox?p.crateBodyBox.max.y-p.pos.y:NaN;
  const pose=(s,sd)=>({s:round(s,2),side:round(sd,2),y:round(p.pos.y),speed:round(p.speed),vVel:round(p.vVel),state:p.state,grounded:p.grounded,spinning:!!p.spinning,head:round(p.pos.y+bodyTop())});

  const bowls=route.pipes.map((b,i)=>{const vr=route.data.components.find(c=>c.t==='vertramp'&&c.nm===b.name);return {index:i+1,...b,lip0:b.a+2,lip1:b.b-2,flatHalf:vr?.w,deck:vr?.deck,arc:vr?.arc,rails:vr?.rails};});

  const dropIn=(bowl,o)=>{
    const {side=0,target=null,release=false,pump=true,turnaround=false,label}=o;
    const [startS,approachLane,laneFrom]=APPROACH[bowl.index];
    const {lip0,lip1}=bowl;
    place(startS,approachLane);
    const rows=crateRows().filter(q=>q.s>bowl.a-6&&q.s<bowl.b+8),aliveBefore=rows.map(q=>q.c.alive);
    const watch=rows.filter(q=>aliveBefore[rows.indexOf(q)]).map(q=>({row:q,alive:true}));
    let braking=false,launch=null,apex=null,landing=null,died=null,tLip=null,tOut=null,entrySpeed=null,bottomSpeed=null,exitSpeed=null,secondHang=null,lastSpeed=0,lastGrounded=true,maxSpeed=0,stillFrames=0,plowReadyAt=null,returning=false,returnLanding=null,returnApex=null,deaths=[];
    const trace=[],crateEvents=[];
    for(let i=0;i<60*40;i++){
      camera();
      const [s,,sd]=local();
      if(!turnaround&&s>bowl.b+12&&p.grounded)break;
      if(turnaround&&returning&&returnLanding&&i>returnLanding.frame+30)break;
      if(dead()){died={...pose(s,sd),frame:i,bailing:p.isBailing};break;}
      if(tLip===null&&s>=lip0-20)tLip=i;if(tOut===null&&s>=bowl.b+10)tOut=i;
      if(entrySpeed===null&&s>=lip0)entrySpeed=round(lastSpeed);
      if(bottomSpeed===null&&s>=(bowl.a+bowl.b)/2)bottomSpeed=round(p.speed);
      if(exitSpeed===null&&s>=lip1-.4)exitSpeed=round(lastSpeed);
      maxSpeed=Math.max(maxSpeed,Math.abs(p.speed));
      const airborne=!p.grounded&&p.state==='air';
      if(airborne&&lastGrounded&&s>lip1-3&&!returning){const h={...pose(s,sd),frame:i,speedBefore:round(lastSpeed),aboveLip:round(p.pos.y-bowl.lipY)};if(!launch)launch=h;else if(!secondHang)secondHang=h;}
      if(airborne&&lastGrounded&&returning&&s<lip0+3){secondHang={...pose(s,sd),frame:i,speedBefore:round(lastSpeed),aboveLip:round(p.pos.y-bowl.lipY),entryLip:true};}
      if(launch&&!returning&&airborne){if(!apex||p.pos.y>apex.y)apex={...pose(s,sd),aboveLip:round(p.pos.y-bowl.lipY)};}
      if(returning&&airborne){if(!returnApex||p.pos.y>returnApex.y)returnApex={...pose(s,sd),aboveLip:round(p.pos.y-bowl.lipY)};}
      if(launch&&!landing&&p.grounded&&i>launch.frame){landing={...pose(s,sd),frame:i,ground:p.groundHit?.name};}
      if(landing&&!returning){if(p.grounded&&Math.abs(p.speed)<.1)stillFrames++;if(plowReadyAt===null&&Math.abs(p.speed)>=TUNING.smashSpeed)plowReadyAt={s:round(s,2),frame:i,sinceLanding:i-landing.frame};}
      if(turnaround&&landing&&!returning&&i>landing.frame+40)returning=true;
      if(returning&&secondHang&&!returnLanding&&p.grounded&&i>secondHang.frame)returnLanding={...pose(s,sd),frame:i};
      for(const w of watch){if(w.alive&&!w.row.c.alive){w.alive=false;crateEvents.push({crate:{s:round(w.row.s,1),side:round(w.row.side,1),kind:w.row.kind,bottom:round(w.row.bottom),top:round(w.row.top)},player:pose(s,sd),frame:i});}}
      lastGrounded=p.grounded;lastSpeed=p.speed;
      if(target!==null&&s<lip0-1){if(p.speed>target)braking=true;else if(p.speed<target-1.5)braking=false;}else braking=false;
      const lane=s>laneFrom?side:approachLane;
      const steering=(p.grounded||!p.airFromSkate);
      let move=steering?toward(s+7,lane):{};
      if(returning&&steering){const t=route.toWorld(Math.max(-18,lip0-6),p.pos.y,0),dx=t[0]-p.pos.x,dz=t[2]-p.pos.z,dl=Math.hypot(dx,dz)||1,hx=p.axisF.x,hz=p.axisF.z,dot=(dx*hx+dz*hz)/dl;
        move=dot<-0.35?r.worldDirectionInput({x:-hz,z:hx}):r.worldDirectionInput({x:dx,z:dz});}
      else if(returning)move={};
      let jumpHeld=pump||s<lip0||returning,jumpReleased=false;
      if(release&&launch===null&&s>=lip1-.9&&s<lip1+1&&p.grounded){jumpHeld=false;jumpReleased=true;}
      if(release&&launch!==null&&!landing)jumpHeld=false;
      const sample={...move,jumpHeld,grabHeld:braking&&p.grounded};
      if(jumpReleased)sample.jumpReleased=true;
      r.tick(sample);
      if(i%5===0)trace.push([round(s,1),round(p.pos.y,2),round(p.speed,1),round(p.vVel,1),p.state,p.grounded?1:0]);
    }
    const broken=rows.filter((q,i)=>aliveBefore[i]&&!q.c.alive).map(q=>({s:round(q.s,1),side:round(q.side,1),kind:q.kind}));
    const caps=rows.filter(q=>Math.abs(q.side)<.6&&q.bottom>bowl.lipY+1).map(q=>({s:round(q.s,1),kind:q.kind,bottom:round(q.bottom),alive:q.c.alive}));
    const offerings=rows.filter(q=>Math.abs(Math.abs(q.side)-2.6)<.3&&Math.abs(q.s-(bowl.b+3))<.8).map(q=>({s:round(q.s,1),side:round(q.side,1),alive:q.c.alive}));
    return {label,bowl:bowl.index,name:bowl.name,side,target,release,pump,turnaround,entrySpeed,bottomSpeed,exitSpeed,maxSpeed:round(maxSpeed),launch,apex,landing,stillFramesAfterLanding:stillFrames,plowReadyAt,secondHang,returnApex,returnLanding,died,
      framesLipMinus20ToBPlus10:tLip!==null&&tOut!==null?tOut-tLip:null,broken,crateEvents,caps,offerings,trace};
  };

  const railHop=(bowl,{lead,spin=true,label})=>{
    const capS=bowl.b-2.6,railStart=bowl.a-4,[startS,startLane]=RAIL_APPROACH[bowl.index];
    place(startS,startLane);
    const rows=crateRows();const cap=rows.find(q=>Math.abs(q.s-capS)<1&&Math.abs(q.side)<.6);const capAlive0=cap?.c.alive;
    let grindStart=null,jumpAt=null,landing=null,died=null,maxY=-Infinity,maxYAt=null,grindEnd=null,prevGrind=false,holdFrames=0,prevGrounded=true,capBreak=null;
    for(let i=0;i<60*25;i++){
      camera();const [s,,sd]=local();
      if(dead()){died={...pose(s,sd),bailing:p.isBailing};break;}
      const grinding=p.state==='grind';
      if(grinding&&!grindStart)grindStart={...pose(s,sd),frame:i,fromGrounded:prevGrounded,railHeightAboveGround:round(p.pos.y-route.groundAt(s))};
      if(!grinding&&prevGrind&&!jumpAt&&!grindEnd)grindEnd={...pose(s,sd),frame:i};
      if(jumpAt&&p.pos.y>maxY){maxY=p.pos.y;maxYAt={...pose(s,sd),aboveLip:round(p.pos.y-bowl.lipY)};}
      if(cap&&capAlive0&&!capBreak&&!cap.c.alive)capBreak={...pose(s,sd),frame:i};
      if(jumpAt&&p.grounded&&i>jumpAt.frame+3){landing={...pose(s,sd),ground:p.groundHit?.name};break;}
      if(s>bowl.b+12)break;
      prevGrounded=p.grounded;
      let sample;
      const capWorld=route.toWorld(capS,p.pos.y,0),dir=r.worldDirectionInput({x:capWorld[0]-p.pos.x,z:capWorld[2]-p.pos.z});
      if(!grinding&&!jumpAt){
        const lane=s>railStart-2.5?-2.5:startLane;
        sample={...toward(s+6,lane),jumpHeld:true,grindHeld:s>railStart-.3&&s<railStart+4&&Math.abs(sd+2.5)<.7,grabHeld:p.speed>13&&p.grounded};
      }else if(grinding&&!jumpAt){
        const dist=capS-s,actualLead=lead==='auto'?Math.max(2.5,Math.abs(p.speed)*.45):lead;
        if(dist<=actualLead){sample={...dir,jumpHeld:false,jumpReleased:true,grindHeld:false,spinHeld:spin};jumpAt={...pose(s,sd),frame:i,lead:round(actualLead),heldFrames:holdFrames};}
        else{const hold=dist<=actualLead+Math.max(.6,Math.abs(p.speed)*6/60);if(hold)holdFrames++;sample={...(hold?dir:{}),jumpHeld:true,grindHeld:true};}
      }else sample={...dir,spinHeld:spin&&(p.spinning||!r.lastInput.spinHeld)};
      prevGrind=grinding;
      r.tick(sample);
    }
    return {label,bowl:bowl.index,name:bowl.name,lead,spin,railY:round(bowl.lipY+.65),railStart,capStation:round(capS,1),capBottom:round(cap?.bottom),capTop:round(cap?.top),capAliveBefore:capAlive0,capAliveAfter:cap?.c.alive,capBreak,grindStart,grindEnd,jumpAt,maxYAt,landing,died};
  };

  const report={generated:new Date().toISOString(),approaches:APPROACH,railApproaches:RAIL_APPROACH,physics:{pipeAirGravity:TUNING.pipeAirGravity,boardRiseGravity:TUNING.boardRiseGravity,boardFallGravity:TUNING.boardFallGravity,groundGravity:TUNING.groundGravity,vertLaunchConserve:TUNING.vertLaunchConserve,hangLaunch:TUNING.hangLaunch,pipePop:TUNING.pipePop,pipePumpGain:TUNING.pipePumpGain,grindJumpForce:TUNING.grindJumpForce,grindTransferSpeed:TUNING.grindTransferSpeed,smashSpeed:TUNING.smashSpeed,crateTripSpeed:TUNING.crateTripSpeed,maxSpeed:TUNING.maxSpeed,downhillMax:TUNING.downhillMax,vertMax:TUNING.vertMax,cruiseSpeed:TUNING.cruiseSpeed,brakeLockTime:TUNING.brakeLockTime,railSnapDistance:TUNING.railSnapDistance,vertLip:TUNING.vertLip},bowls:[]};
  for(const bowl of bowls){
    if(dropBowls!==null&&!dropBowls.includes(bowl.index)&&hopBowls!==null&&!hopBowls.includes(bowl.index))continue;
    const entry={index:bowl.index,name:bowl.name,a:bowl.a,b:bowl.b,lip0:bowl.lip0,lip1:bowl.lip1,lipY:bowl.lipY,baseY:bowl.baseY,radius:bowl.radius,flatHalf:bowl.flatHalf,deck:bowl.deck,arc:bowl.arc,copingRails:bowl.rails,dropIns:[],railHops:[]};
    const doDrops=dropBowls===null||dropBowls.includes(bowl.index),doHops=hopBowls===null||hopBowls.includes(bowl.index);
    if(doDrops)for(const target of [9,12,15,18,21,null])entry.dropIns.push(dropIn(bowl,{side:0,target,label:`centre lane, governed to ${target??'max'} m/s, X held (pump)`}));
    if(doDrops)for(const target of [10,13,16,19,null])entry.dropIns.push(dropIn(bowl,{side:0,target,pump:false,label:`centre lane, governed to ${target??'max'} m/s, X released inside the bowl (no pump)`}));
    if(doDrops)entry.dropIns.push(dropIn(bowl,{side:0,target:15,release:true,label:'centre lane 15 m/s, release X at the exit lip'}));
    if(doDrops)for(const side of [-2.6,2.6])entry.dropIns.push(dropIn(bowl,{side,target:15,label:`carving lane side ${side}, 15 m/s, pumped`}));
    if(doDrops)for(const side of [-2.6,2.6])entry.dropIns.push(dropIn(bowl,{side,target:13,pump:false,label:`carving lane side ${side}, 13 m/s, no pump`}));
    if(doDrops&&bowl.index===5){const saved=APPROACH[5];APPROACH[5]=[1058,0,0];entry.dropIns.push(dropIn(bowl,{side:0,target:null,label:'bowl 5 control: centre lane 0 all the way (entry life in the body path)'}));APPROACH[5]=saved;}
    if(doDrops||args.turnaround)entry.dropIns.push(dropIn(bowl,{side:0,target:15,turnaround:true,label:'centre lane 15 m/s, then turn around on the exit deck and pump back to the entry lip'}));
    if(doHops)for(const lead of [3,5,'auto'])entry.railHops.push(railHop(bowl,{lead,spin:true,label:`aqueduct rail hop toward the exit cap, release ${lead} m before it, spinning`}));
    if(doHops)entry.railHops.push(railHop(bowl,{lead:'auto',spin:false,label:'aqueduct rail hop, auto lead, no spin'}));
    report.bowls.push(entry);
    console.log(JSON.stringify({bowl:bowl.index,name:bowl.name,dropIns:entry.dropIns.map(d=>({label:d.label,entry:d.entrySpeed,exit:d.exitSpeed,launch:d.launch&&{s:d.launch.s,v:d.launch.speedBefore,vVel:d.launch.vVel},apex:d.apex&&{aboveLip:d.apex.aboveLip,s:d.apex.s},landing:d.landing&&{s:d.landing.s,speed:d.landing.speed},still:d.stillFramesAfterLanding,plow:d.plowReadyAt,second:d.secondHang&&{s:d.secondHang.s,vVel:d.secondHang.vVel},retApex:d.returnApex&&d.returnApex.aboveLip,broken:d.broken,events:d.crateEvents.map(e=>[e.crate.s,e.crate.kind,e.player.s,e.player.y,e.player.state,e.player.vVel,e.player.speed]),caps:d.caps,offerings:d.offerings,died:d.died&&{s:d.died.s,state:d.died.state},frames:d.framesLipMinus20ToBPlus10})),railHops:entry.railHops.map(h=>({label:h.label,grindStart:h.grindStart&&{s:h.grindStart.s,y:h.grindStart.y,above:h.grindStart.railHeightAboveGround,fromGrounded:h.grindStart.fromGrounded},grindEnd:h.grindEnd&&{s:h.grindEnd.s,state:h.grindEnd.state},jumpAt:h.jumpAt&&{s:h.jumpAt.s,speed:h.jumpAt.speed,lead:h.jumpAt.lead,held:h.jumpAt.heldFrames},maxYAt:h.maxYAt&&{s:h.maxYAt.s,side:h.maxYAt.side,head:h.maxYAt.head,aboveLip:h.maxYAt.aboveLip},capBottom:h.capBottom,capAlive:[h.capAliveBefore,h.capAliveAfter],capBreak:h.capBreak&&{s:h.capBreak.s,side:h.capBreak.side,y:h.capBreak.y,vVel:h.capBreak.vVel,spinning:h.capBreak.spinning},landing:h.landing&&{s:h.landing.s,side:h.landing.side,ground:h.landing.ground},died:h.died&&{s:h.died.s,side:h.died.side,state:h.died.state}}))}));
  }
  await writeFile(OUT,JSON.stringify(report,null,1));
  console.log('wrote',OUT);
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z},maxFrames:4_000_000});
