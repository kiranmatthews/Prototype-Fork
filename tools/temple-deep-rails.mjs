// Gold rail audit for Temple of Embers: can each rail be mounted from the
// riding line without an ollie (snap radius vs. 0.8 m mount height), what the
// grind meets along its length (offering stacks, patrols, flames), where it
// ends and in what state. Input-only pilots on the production Level/Player.
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const args=Object.fromEntries(process.argv.slice(2).filter(a=>a.startsWith('--')).map(a=>{const [k,v]=a.slice(2).split('=');return [k,v??'1'];}));
const OUT=args.out??'docs/temple-embers-design/deep/rails.json';
const round=(n,d=2)=>typeof n==='number'&&Number.isFinite(n)?Math.round(n*10**d)/10**d:n;

await withBlockworksRuntime(async r=>{
  const route=r.sourceModule.JUNGLE_TERRACES_ROUTE,{p,l,THREE}=r;
  const local=()=>route.toLocal(p.pos.toArray());
  const kindOf=c=>c.nitroBang?'nitrobang':c.bang?'bang':c.metalBounce?'metalbounce':c.metal?'metal':c.bouncy?'bouncy':c.tnt?'tnt':c.nitro?'nitro':c.multiHit?'multihit':c.mask?'mask':c.life?'life':c.mystery?'mystery':'wood';
  const crateRows=()=>l.crates.map(c=>{const [s,,side]=route.toLocal([c.home?.x??c.mesh.position.x,c.box.min.y,c.home?.z??c.mesh.position.z]);return {c,s,side,bottom:c.box.min.y,top:c.box.max.y,kind:kindOf(c)};});
  const enemyRows=()=>l.enemies.map(e=>{const [s,,side]=route.toLocal(e.group.position.toArray());return {e,s,side,kind:e.kind};});
  const armSwitches=()=>{for(const box of l.crates.filter(c=>c.bang&&!c.bangUsed))l.triggerBang(box);l.root.updateMatrixWorld(true);};
  const place=(s,side)=>{const f=route.frameAt(s);p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s,route.groundAt(s)+.12,side)),heading:new THREE.Vector3(f.fx,0,f.fz)});armSwitches();r.stepFor(12);};
  const camera=()=>{const c=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(c.x,0,c.z);};
  const steer=(ahead,side)=>{const [s]=local();const t=route.toWorld(Math.min(route.end-6,s+ahead),p.pos.y,side);return r.worldDirectionInput({x:t[0]-p.pos.x,z:t[2]-p.pos.z});};
  const dead=()=>p.isBailing||['dead','gameover'].includes(p.state);

  // Rail geometry in station space from the published components.
  const rails=route.data.components.filter(c=>c.t==='rail').map(c=>{
    const pts=c.pts.map(q=>[c.p[0]+q[0],c.p[1]+(q[3]??0),c.p[2]+q[1]]);
    const a=route.toLocal(pts[0]),b=route.toLocal(pts[pts.length-1]);
    const lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);
    const groundA=route.groundAt(a[0]),groundB=route.groundAt(b[0]);
    return {nm:c.nm,s0:round(a[0],1),s1:round(b[0],1),y0:round(a[1]),y1:round(b[1]),side:round((a[2]+b[2])/2,2),aboveGroundStart:round(a[1]-groundA),aboveGroundEnd:round(b[1]-groundB),lo,hi};
  }).sort((x,y)=>x.lo-y.lo);

  // Hazard-free starts per rail mount: [start station, start lane, lane-merge station].
  const STARTS={44:[30,-2.5,0],104:[98.5,-2.5,0],176:[158,-2.5,0],374:[369.5,-3.6,373.3],447:[436,-2.5,0],646:[622,-2.5,0],742:[738.5,-2.5,0],842:[826,-2.5,0],970:[960,-2.5,0],1080:[1058,-2.5,0],1178:[1150,-2.5,0],1216:[1200,-2.5,0]};
  const ride=(rail,{jump=false,speedCap=40,label,endS})=>{
    const key=Object.keys(STARTS).map(Number).reduce((best,k)=>Math.abs(k-rail.lo)<Math.abs(best-rail.lo)?k:best,44);
    const [startS,startLane,mergeAt]=STARTS[key],side=rail.side;
    place(startS,startLane);
    const rows=crateRows().filter(q=>q.s>rail.lo-8&&q.s<rail.hi+10),aliveBefore=rows.map(q=>q.c.alive);
    const foes=enemyRows().filter(q=>q.s>rail.lo-12&&q.s<rail.hi+10),foeAlive=foes.map(q=>q.e.alive);
    let grindStart=null,grindEnd=null,died=null,prevGrind=false,prevGrounded=true,jumped=false,minSpeedOnRail=Infinity,maxSpeedOnRail=0,grindFrames=0,maskBefore=p.masks;
    const notes=[];
    for(let i=0;i<60*40;i++){
      camera();const [s,y,sd]=local();
      if(dead()){died={s:round(s,1),side:round(sd,1),y:round(y),state:p.state,bailing:p.isBailing,frame:i};break;}
      const grinding=p.state==='grind';
      if(grinding){grindFrames++;minSpeedOnRail=Math.min(minSpeedOnRail,Math.abs(p.grindVel??p.speed));maxSpeedOnRail=Math.max(maxSpeedOnRail,Math.abs(p.grindVel??p.speed));}
      if(grinding&&!grindStart)grindStart={s:round(s,2),side:round(sd,2),y:round(y),frame:i,speed:round(p.speed),fromGrounded:prevGrounded,heightAboveGround:round(y-route.groundAt(s))};
      if(!grinding&&prevGrind&&!grindEnd)grindEnd={s:round(s,2),side:round(sd,2),y:round(y),frame:i,state:p.state,speed:round(p.speed),grounded:p.grounded};
      if(grindEnd&&p.grounded&&i>grindEnd.frame+2){notes.push({landed:{s:round(s,2),side:round(sd,2),speed:round(p.speed),ground:p.groundHit?.name}});break;}
      if(s>(endS??rail.hi+10)&&!grinding&&p.grounded)break;
      prevGrounded=p.grounded;prevGrind=grinding;
      let sample;
      if(!grinding){
        const lane=s>mergeAt?side:startLane;
        const nearMount=s>rail.lo-.4&&s<rail.lo+4&&Math.abs(sd-side)<.7;
        sample={...steer(6,lane),jumpHeld:true,grindHeld:nearMount||grindStart!==null,grabHeld:p.speed>speedCap&&p.grounded};
        if(jump&&!jumped&&nearMount&&s>rail.lo-2.2&&p.grounded){sample.jumpHeld=false;sample.jumpReleased=true;jumped=true;}
      }else{
        const correction=Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7));
        sample={moveX:correction,moveY:1,grindHeld:true,jumpHeld:false};
      }
      r.tick(sample);
    }
    const broken=rows.filter((q,i)=>aliveBefore[i]&&!q.c.alive).map(q=>({s:round(q.s,1),side:round(q.side,1),kind:q.kind,bottom:round(q.bottom),top:round(q.top)}));
    const killed=foes.filter((q,i)=>foeAlive[i]&&!q.e.alive).map(q=>({s:round(q.s,1),side:round(q.side,1),kind:q.kind}));
    const onLine=rows.filter(q=>Math.abs(q.side-rail.side)<.7&&q.s>rail.lo-.5&&q.s<rail.hi+.5).map(q=>({s:round(q.s,1),side:round(q.side,1),kind:q.kind,bottom:round(q.bottom),top:round(q.top),railYHere:round(rail.y0+(rail.y1-rail.y0)*(q.s-rail.s0)/((rail.s1-rail.s0)||1))}));
    const foesOnLine=foes.filter(q=>Math.abs(q.side-rail.side)<1.6&&q.s>rail.lo-1&&q.s<rail.hi+1).map(q=>({s:round(q.s,1),side:round(q.side,1),kind:q.kind}));
    return {label,rail:rail.nm,jump,grindStart,grindEnd,grindFrames,grindSeconds:round(grindFrames/60),minSpeedOnRail:round(minSpeedOnRail),maxSpeedOnRail:round(maxSpeedOnRail),masksSpent:maskBefore-p.masks,broken,killed,cratesOnRailLine:onLine,patrolsOnRailLine:foesOnLine,died,notes};
  };

  const report={generated:new Date().toISOString(),rails:[]};
  for(const rail of rails){
    const entry={...rail,rides:[]};
    entry.rides.push(ride(rail,{jump:false,label:'ride the lane with X held, hold grind beside the mount, no ollie'}));
    entry.rides.push(ride(rail,{jump:true,label:'same, with a charged ollie 2 m before the mount'}));
    if(rail.lo===1178)entry.rides.push(ride(rail,{jump:true,endS:1246,label:'finale rail with ollie mount, hold grind through the final gap rail to 1246'}));
    report.rails.push(entry);
    console.log(JSON.stringify({rail:rail.nm,s:[rail.s0,rail.s1],side:rail.side,above:[rail.aboveGroundStart,rail.aboveGroundEnd],rides:entry.rides.map(x=>({label:x.label,start:x.grindStart,end:x.grindEnd,sec:x.grindSeconds,speed:[x.minSpeedOnRail,x.maxSpeedOnRail],broken:x.broken,killed:x.killed,onLine:x.cratesOnRailLine,patrols:x.patrolsOnRailLine,died:x.died,masks:x.masksSpent,notes:x.notes}))}));
  }
  await writeFile(OUT,JSON.stringify(report,null,1));
  console.log('wrote',OUT);
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z},maxFrames:2_000_000});
