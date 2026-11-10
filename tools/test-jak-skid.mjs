import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// D's skid to a halt out of a run. It has to be a whole, unmirrored body
// stopping on its feet: he sits back over soles that take the floor flat and
// slide on it, braking, all the way to the stop, with dust; he comes up and
// over them as they slow; and his arms are out for balance, not thrown about.
// Nothing in it pops, however it is cut short. It is presentation only, and
// is sized to the pace he stops from.
//   JAK_SKID_REPORT=1 lists every failure instead of stopping at the first.
//   JAK_SKID_SOURCE=1 puts the source skid back, to show what these checks are for.
const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
const problems=[],check=(ok,message)=>{if(ok)return;if(process.env.JAK_SKID_REPORT)problems.push(message);else assert.fail(message);};
const JOINTS=['hips','chest','neck','head','shoulderLeft','shoulderRight','wristLeft','wristRight','kneeLeft','kneeRight','ankleLeft','ankleRight'];
// The largest change of speed in one 60 Hz frame, m/s, in the body's own frame.
const KINK=11,CUT={rerun:13,turn:13,jump:16,crouch:9};
// An arm's own motion, hand about shoulder: the fastest it goes (m/s) and how far it travels (m) in one stop.
const ARM={speed:7.5,path:3};
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {JAK_SKID,jakSkidSize,JAK_SKID_SIZES}=await server.ssrLoadModule('/src/animation/jakSkid.ts');
  const {puffs,PUFF_PRESETS}=await server.ssrLoadModule('/src/puffs.ts');
  // Dust laid by a skidding sole, counted as it is spawned.
  let dust=0;const spawn=puffs.spawn.bind(puffs);
  puffs.spawn=(preset,...rest)=>{if(preset===PUFF_PRESETS.dustFootSkid)dust++;return spawn(preset,...rest);};
  const stopAt=JAK_SKID.rise+JAK_SKID.catch,results=[];
  const play=(name,steps,fps=60)=>{
    const players=[new Player(scene),new Player(scene)],[p,control]=players,v=new THREE.Vector3();
    const runtimes=players.map((player,i)=>{
      const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
      const suite=createJakDirectSuite(base,rig,bank);
      if(i===0){
        assert.ok(suite.clips.find(c=>c.id==='player.run-stop').metadata.jakSkid,'D has no skid of its own');
        assert.equal(suite.clips.filter(c=>c.metadata?.jakSkidSizeOf==='player.run-stop').length,JAK_SKID_SIZES-1,'the skid is not baked at every size');
        if(process.env.JAK_SKID_SOURCE)suite.clips=suite.clips.map(c=>c.id==='player.run-stop'?base.clips.find(b=>b.id===c.id):c);
      }
      player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
      return createCharacterAnimationRuntime(player,i?base:suite);
    });
    for(const [i,player] of players.entries()){player.enterLevel('skid-test');player.respawn(level,true,true);runtimes[i].restart();}
    const frames=[];let f=0,jumpWas=false;
    for(const [seconds,keys] of [[1.4,{}],...steps])for(let k=0,n=Math.round(seconds*fps);k<n;k++,f++){
      const jump=!!keys.jump,grab=!!keys.grab;
      const input=()=>makeInput({moveX:keys.x??0,moveY:keys.y??0,jumpHeld:jump,jumpPressed:jump&&!jumpWas,jumpReleased:!jump&&jumpWas,grabHeld:grab,grabPressed:grab&&k===0});
      dust=0;
      for(const player of players){player.step(1/fps,input(),level);player.commitRenderStep(level);}
      level.update(1/fps);jumpWas=jump;
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&p.state===control.state,`${name}: the skid changed movement at frame ${f}`);
      const yaw=p.visualYaw,c=Math.cos(yaw),s=Math.sin(yaw),local={};
      for(const id of JOINTS){p.animationRig.jointsById.get(id).node.getWorldPosition(v);const x=v.x-p.pos.x,z=v.z-p.pos.z;local[id]=[x*-c+z*s,v.y-p.pos.y,x*-s+z*-c];}
      const soles=['left','right'].map(side=>{const sole=p.proceduralFootwear.find(part=>part.side===side).sole,points=sole.geometry.getAttribute('position');
        let low=Infinity,x=0,z=0;for(let i=0;i<points.count;i++){v.fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld);low=Math.min(low,v.y-p.pos.y);x+=v.x;z+=v.z;}
        return {low,x:x/points.count,z:z/points.count};});
      frames.push({f,clip:runtimes[0].activeClipId,time:runtimes[0].diagnostics.timelineTime??0,speed:p.walkVelocity.length(),grounded:p.grounded,
        pos:[p.pos.x,p.pos.z],held:Math.min(...(p.keyedSoleHold??[0,0])),dust,local,soles});
    }
    for(const runtime of runtimes)runtime.dispose();
    for(const player of players)scene.remove(player.group);
    // m/s in one 60 Hz frame, whatever rate it was run at
    const kink=(from,to)=>{let worst=0,at='';for(let i=Math.max(1,from);i<Math.min(frames.length-1,to);i++)for(const id of JOINTS){
      const a=frames[i-1].local[id],b=frames[i].local[id],d=frames[i+1].local[id];
      const k=Math.hypot(...[0,1,2].map(j=>(d[j]-2*b[j]+a[j])*fps))*fps/60;if(k>worst){worst=k;at=`${id}@${frames[i].f}`;}}return {worst,at};};
    const first=frames.findIndex(fr=>fr.clip==='player.run-stop');
    // How the soles go along the ground: the way he was going, the front sole and the back one,
    // from the frame both are held to the frame he stops.
    let slide=null;
    if(first>8){
      const skid=frames.slice(first).filter((fr,i,all)=>all.slice(0,i+1).every(g=>g.clip==='player.run-stop'));
      const a=frames[first-8].pos,b=frames[first].pos,len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,way=[(b[0]-a[0])/len,(b[1]-a[1])/len];
      const along=(fr,i)=>fr.soles[i].x*way[0]+fr.soles[i].z*way[1];
      const moving=skid.filter(fr=>fr.speed>1e-3),held=moving.filter(fr=>fr.held>=.999),stop=skid.find(fr=>fr.speed<=1e-3),rest=skid.at(-1);
      if(held.length>1&&stop){
        const front=along(held[0],0)>along(held[0],1)?0:1,order=[front,1-front],late=held.slice(-Math.max(2,Math.round(fps*.1)));
        let back=0,jerk=0;
        for(let i=1;i<held.length;i++)for(const k of order){
          const step=along(held[i],k)-along(held[i-1],k);back=Math.min(back,step*fps/60);
          if(i>1)jerk=Math.max(jerk,(step-(along(held[i-1],k)-along(held[i-2],k)))*fps);}
        slide={travel:order.map(k=>along(stop,k)-along(held[0],k)),late:order.map(k=>along(late.at(-1),k)-along(late[0],k)),back,jerk,
          spare:Math.max(...order.map(k=>Math.abs(along(stop,k)-along(rest,k)))),
          after:Math.max(...skid.filter(fr=>fr.speed<=1e-3).flatMap(fr=>order.map(k=>Math.hypot(fr.soles[k].x-rest.soles[k].x,fr.soles[k].z-rest.soles[k].z)))),
          apart:along(held[0],front)-along(held[0],1-front),dust:moving.reduce((n,fr)=>n+fr.dust,0),
          dustAfter:skid.filter(fr=>fr.speed<=1e-3).slice(2).reduce((n,fr)=>n+fr.dust,0)};
      }
    }
    return {frames,kink,first,fps,slide};
  };

  // A stop out of a flat run, at three frame rates.
  for(const fps of [60,30,120]){
    const name=`stop@${fps}`,{frames,kink,first,slide}=play(name,[[1.6,{y:1}],[2.2,{}]],fps);
    check(first>0,`${name}: nobody skidded`);if(first<0)continue;
    const skid=frames.filter(fr=>fr.clip==='player.run-stop'),end=first+skid.length,standing=frames.slice(end+Math.round(fps*.9));
    const stand={hips:standing.at(-1).local.hips[1],head:standing.at(-1).local.head[1]};
    check(frames[end]?.clip==='player.idle',`${name}: the skid did not end in the idle (${frames[end]?.clip})`);
    const moving=skid.filter(fr=>fr.speed>1e-3),stopped=skid.filter(fr=>fr.speed<1e-3);
    check(moving.length>=fps*.3&&stopped.length>fps*.6,`${name}: no slide and settle to look at (${moving.length}, ${stopped.length} frames)`);
    // Whole body, and not mirrored: one foot out in front as they come down; he sits back, then goes over.
    const sink=stand.hips-Math.min(...skid.map(fr=>fr.local.hips[1]));
    check(sink>.1,`${name}: he never sits into the stop (${sink.toFixed(2)} m)`);
    const back=Math.min(...moving.map(fr=>fr.local.head[2]-fr.local.hips[2]),0),behind=Math.min(...moving.map(fr=>fr.local.hips[2]),0);
    const over=Math.max(...stopped.map(fr=>fr.local.head[2]));
    check(back<-.06&&behind<-.08&&over>.06,`${name}: he does not sit back behind his feet and then come over them (head ${back.toFixed(2)} m behind hips, hips ${behind.toFixed(2)} m, then ${over.toFixed(2)} m)`);
    // The arms are out for balance and kept there: below his neck, slow, and not doing the same thing.
    const arm=side=>{let fastest=0,path=0;for(let i=1;i<skid.length;i++){
      const step=Math.hypot(...[0,1,2].map(j=>(skid[i].local[`wrist${side}`][j]-skid[i].local[`shoulder${side}`][j])-(skid[i-1].local[`wrist${side}`][j]-skid[i-1].local[`shoulder${side}`][j])));
      fastest=Math.max(fastest,step*fps);path+=step;}return {fastest,path};};
    const arms={left:arm('Left'),right:arm('Right')};
    const high=Math.max(...skid.flatMap(fr=>[fr.local.wristLeft[1]-fr.local.neck[1],fr.local.wristRight[1]-fr.local.neck[1]]));
    const apart=Math.max(...skid.map(fr=>Math.abs(fr.local.wristLeft[1]-fr.local.wristRight[1])));
    for(const [side,own] of Object.entries(arms))check(own.fastest<ARM.speed&&own.path<ARM.path,`${name}: the ${side} arm flails (${own.fastest.toFixed(1)} m/s at its fastest, ${own.path.toFixed(2)} m in all)`);
    check(high<-.1,`${name}: a hand goes up to ${high.toFixed(2)} m of his neck`);
    check(apart>.08,`${name}: both arms do the same thing (${apart.toFixed(2)} m apart at most)`);
    // The floor: nothing in it, the lower sole on it.
    const lowest=Math.min(...skid.map(fr=>Math.min(...fr.soles.map(s=>s.low))));
    const floating=Math.max(...skid.slice(Math.round(fps*.2)).map(fr=>Math.min(...fr.soles.map(s=>s.low))));
    check(lowest>-.003&&floating<.03,`${name}: soles ${lowest.toFixed(3)} m into the floor, or ${floating.toFixed(3)} m off it`);
    // And on it they slide: both, thrown apart as they come down, forward only, slowing without a catch,
    // still sliding in the last tenth of a second, on their marks as he stops, and laying dust until then.
    check(!!slide,`${name}: the soles never took the floor`);
    if(slide){
      check(slide.apart>.3,`${name}: the feet are not thrown apart as they come down (${slide.apart.toFixed(2)} m)`);
      check(slide.travel[0]>.2&&slide.travel[1]>.4,`${name}: the soles do not slide (${slide.travel.map(x=>x.toFixed(2))} m)`);
      check(slide.late[0]>.03&&slide.late[1]>.03,`${name}: the soles are not sliding at the end (${slide.late.map(x=>x.toFixed(3))} m in the last tenth of a second)`);
      check(slide.back>-.004,`${name}: a sole slid ${(-slide.back).toFixed(3)} m back the way it came in a frame`);
      check(slide.jerk<2,`${name}: a sliding sole sped up by ${slide.jerk.toFixed(1)} m/s in a frame`);
      check(slide.spare<.02&&slide.after<.02,`${name}: a sole was ${slide.spare.toFixed(3)} m off its mark as he stopped, and moved ${slide.after.toFixed(3)} m after`);
      check(slide.dust>=8&&slide.dustAfter===0,`${name}: ${slide.dust} puffs of dust from sliding soles, ${slide.dustAfter} after he had stopped`);
    }
    const stoppedAt=stopped[0].time;
    check(Math.abs(stoppedAt-stopAt)<.05,`${name}: the feet stopped at ${stoppedAt.toFixed(3)} s of the clip, not ${stopAt.toFixed(3)}`);
    // Soft: nothing in it changes speed like a cut, and the idle takes over a body already standing as it stands.
    const worst=kink(first-1,end+Math.round(fps*.5));
    check(worst.worst<KINK,`${name}: ${worst.at} changed speed by ${worst.worst.toFixed(1)} m/s in a frame (limit ${KINK})`);
    const handoff=Math.hypot(...[0,1,2].map(j=>frames[end].local.head[j]-frames[end-1].local.head[j]))*fps/60;
    check(handoff<.02,`${name}: the idle took over with a ${handoff.toFixed(3)} m step of the head`);
    results.push({name,frames:skid.length,sink,back,behind,over,arms,high,apart,lowest,floating,slide,stoppedAt,kink:worst});
  }

  // Sized to the pace, and at every pace the soles slide and lay dust.
  const paces=[];
  for(const y of [.5,.65,.8,1]){
    const {frames,kink,first,slide}=play(`pace ${y}`,[[1.6,{y}],[2,{}]]);
    check(first>0,`pace ${y}: nobody skidded`);if(first<0)continue;
    const skid=frames.filter(fr=>fr.clip==='player.run-stop'),worst=kink(first-1,first+skid.length+20);
    check(worst.worst<KINK,`pace ${y}: ${worst.at} changed speed by ${worst.worst.toFixed(1)} m/s in a frame (limit ${KINK})`);
    check(!!slide&&slide.dust>0&&slide.back>-.012&&slide.spare<.02,`pace ${y}: the soles do not slide to their marks (${JSON.stringify(slide)})`);
    paces.push({y,size:jakSkidSize(y),low:Math.min(...skid.slice(6).map(fr=>fr.local.hips[1])),travel:slide?.travel,dust:slide?.dust,kink:worst.worst});
  }
  if(paces.length===4){
    check(paces[0].size===0&&paces[3].size===JAK_SKID_SIZES-1,`the paces did not span the skid's sizes: ${paces.map(p=>p.size)}`);
    check(paces[0].low>paces[3].low+.05,`a jog stops as hard as a flat run: ${JSON.stringify(paces)}`);
    for(let i=1;i<paces.length;i++)check(paces[i].low<=paces[i-1].low+.05,`the skid does not grow with the pace: ${JSON.stringify(paces)}`);
  }

  // Cut short by anything, at any point in it: carried on, not dropped.
  const cuts=[];
  for(const [kind,keys,gaps] of [['rerun',{y:1},[.08,.2,.36,.52,.7]],['turn',{x:1},[.3,.5]],['jump',{jump:true},[.15,.35,.5,.7]],['crouch',{grab:true},[.6,.9]]])for(const gap of gaps){
    const name=`${kind} after ${gap}`,{frames,kink,first}=play(name,[[1.6,{y:1}],[gap,{}],[kind==='jump'?.2:1,keys],[1,{}]]);
    const off=frames.findIndex((fr,i)=>i>first&&fr.clip!=='player.run-stop');
    check(first>0&&off>first,`${name}: fixture missed the skid`);if(!(off>first))continue;
    const worst=kink(off-2,off+10);
    check(worst.worst<CUT[kind],`${name}: ${worst.at} changed speed by ${worst.worst.toFixed(1)} m/s in a frame (limit ${CUT[kind]})`);
    cuts.push({name,to:frames[off].clip,kink:+worst.worst.toFixed(1)});
  }
  if(problems.length){console.log(problems.join('\n'));process.exitCode=1;}
  console.log(`${problems.length?'FAIL':'PASS'} D's skid is a whole body sliding to a stop on its feet`,JSON.stringify({results,paces,cuts},(key,value)=>typeof value==='number'?+value.toFixed(3):value,1));
},{levelEntry:{id:'skid-test',name:'Skid test',data:{v:1,name:'Skid test',spawn:[0,.02,60],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[300,1,300],edgeGrinding:false},{t:'gate',p:[140,0,-140]}]}}});
