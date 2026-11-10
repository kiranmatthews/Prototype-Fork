import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// D's standing jump charge. He winds down over soles that stay where the
// idle stood, unmirrored, and at full charge he is never quite still: the
// charge used to be one pose held for as long as X was. But what he does at
// the bottom is a slow give, not a wobble, and his arms hang back off his
// shoulders: neither reaches up behind him and neither pumps. Getting into
// it, riding it and leaving it for the jump are carried, not cut.
//   JAK_CHARGE_REPORT=1 lists every failure instead of stopping at the first.
//   JAK_CHARGE_SOURCE=1 puts the source charge back, to show what these checks are for.
const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
const problems=[],check=(ok,message)=>{if(ok)return;if(process.env.JAK_CHARGE_REPORT)problems.push(message);else assert.fail(message);};
const JOINTS=['hips','chest','head','shoulderLeft','shoulderRight','wristLeft','wristRight','kneeLeft','kneeRight'];
const KINK={hips:9,chest:9,head:10,shoulderLeft:10,shoulderRight:10,wristLeft:12,wristRight:12,kneeLeft:12,kneeRight:12};
// At full charge: metres the hips may travel up and down, how fast (m/s), and how fast a hand may go about its own shoulder.
const CALM={hips:.025,sink:.12,arm:.6};
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const results=[];
  for(const [name,held,fps] of [['held',2.4,60],['held',2.4,30],['held',2.4,120],['full',.6,60],['half',.25,60],['tap',.05,60]]){
    const label=`${name}@${fps}`,players=[new Player(scene),new Player(scene)],[p,control]=players,v=new THREE.Vector3();
    const runtimes=players.map((player,i)=>{
      const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
      const suite=createJakDirectSuite(base,rig,bank);
      if(i===0){
        assert.ok(suite.clips.find(c=>c.id==='player.jump-charge').metadata.jakCharge,'D has no jump charge of its own');
        if(process.env.JAK_CHARGE_SOURCE)suite.clips=suite.clips.map(c=>c.id==='player.jump-charge'?base.clips.find(b=>b.id===c.id):c);
      }
      player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
      return createCharacterAnimationRuntime(player,i?base:suite);
    });
    for(const [i,player] of players.entries()){player.enterLevel('charge-test');player.respawn(level,true,true);runtimes[i].restart();}
    const frames=[];let f=0,jumpWas=false;
    // Long enough standing for the idle's stance to be known, then X, then the jump and its landing.
    for(const [seconds,jump] of [[1.6,false],[held,true],[1.4,false]])for(let k=0,n=Math.round(seconds*fps);k<n;k++,f++){
      const input=()=>makeInput({jumpHeld:jump,jumpPressed:jump&&!jumpWas,jumpReleased:!jump&&jumpWas});
      for(const player of players){player.step(1/fps,input(),level);player.commitRenderStep(level);}
      level.update(1/fps);jumpWas=jump;
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&Math.abs(p.vVel-control.vVel)<1e-9&&p.state===control.state,`${label}: the charge changed movement at frame ${f}`);
      const local={};for(const id of JOINTS){p.animationRig.jointsById.get(id).node.getWorldPosition(v);local[id]=[v.x-p.pos.x,v.y-p.pos.y,v.z-p.pos.z];}
      const soles=['left','right'].map(side=>{const sole=p.proceduralFootwear.find(part=>part.side===side).sole,points=sole.geometry.getAttribute('position');
        let low=Infinity,x=0,z=0;for(let i=0;i<points.count;i++){v.fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld);low=Math.min(low,v.y-p.pos.y);x+=v.x;z+=v.z;}
        return {low,x:x/points.count,z:z/points.count};});
      frames.push({f,clip:runtimes[0].activeClipId,grounded:p.grounded,charge:p.chargePose??0,local,soles});
    }
    for(const runtime of runtimes)runtime.dispose();
    for(const player of players)scene.remove(player.group);
    const first=frames.findIndex(fr=>fr.clip==='player.jump-charge'),charging=frames.filter(fr=>fr.clip==='player.jump-charge');
    check(first>0&&charging.length>=Math.round(held*fps)-2,`${label}: the charge never played`);if(first<0)continue;
    const jumped=first+charging.length,idle=frames[first-1];
    check(frames[jumped]?.clip==='player.jump',`${label}: the charge did not end in the jump (${frames[jumped]?.clip})`);
    // m/s in one 60 Hz frame: into the charge, through it, and over the takeoff.
    // (The jump's own clip counts in 60 Hz frames, so its first steps are only measured at that rate.)
    const kinks=Object.fromEntries(JOINTS.map(id=>[id,0]));
    for(let i=first;i<Math.min(frames.length-1,jumped+(fps===60?Math.round(fps*.12):-1));i++)for(const id of JOINTS){
      const a=frames[i-1].local[id],b=frames[i].local[id],c=frames[i+1].local[id];
      kinks[id]=Math.max(kinks[id],Math.hypot(...[0,1,2].map(j=>(c[j]-2*b[j]+a[j])*fps))*fps/60);}
    for(const [id,limit] of Object.entries(KINK))check(kinks[id]<limit,`${label}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame (limit ${limit})`);
    // He goes down, and never up first by more than a breath.
    const rise=Math.max(...charging.map(fr=>fr.local.hips[1]))-idle.local.hips[1];
    check(rise<.025,`${label}: he bobbed up ${rise.toFixed(3)} m going into the charge`);
    // His soles stay where the idle stood, on the floor.
    const drift=Math.max(...charging.flatMap(fr=>fr.soles.map((s,i)=>Math.hypot(s.x-idle.soles[i].x,s.z-idle.soles[i].z))));
    const lows=charging.flatMap(fr=>fr.soles.map(s=>s.low));
    check(drift<.06,`${label}: a sole moved ${drift.toFixed(3)} m from where the idle stood`);
    check(Math.min(...lows)>-.003&&Math.max(...lows)<.03,`${label}: soles ${Math.min(...lows).toFixed(3)} m into the floor, or ${Math.max(...lows).toFixed(3)} m off it`);
    const row={label,frames:charging.length,rise,drift,kinks};
    if(name==='held'){
      const full=charging.filter(fr=>fr.charge>.995).slice(Math.round(fps*.3));
      const sink=idle.local.hips[1]-Math.min(...full.map(fr=>fr.local.hips[1]));
      check(sink>.18,`${label}: he does not wind down (${sink.toFixed(2)} m)`);
      // Not mirrored: the hands are at different heights and the knees go different ways.
      const hands=Math.max(...full.map(fr=>Math.abs(fr.local.wristLeft[1]-fr.local.wristRight[1])));
      check(hands>.08,`${label}: both arms do the same thing (${hands.toFixed(2)} m apart)`);
      // Never still: every quarter second at full charge something has travelled.
      let stillest=Infinity;
      for(let i=0;i+fps/4<=full.length;i+=Math.round(fps/8)){
        const window=full.slice(i,i+Math.round(fps/4));let most=0;
        for(const id of JOINTS)for(const axis of [0,1,2]){const values=window.map(fr=>fr.local[id][axis]);most=Math.max(most,Math.max(...values)-Math.min(...values));}
        stillest=Math.min(stillest,most);}
      check(stillest>.008,`${label}: held at full charge he stands still (${stillest.toFixed(3)} m in a quarter second)`);
      // But calm: the bottom gives slowly and by little, and the arms only ride it.
      const heights=full.map(fr=>fr.local.hips[1]),give=Math.max(...heights)-Math.min(...heights);
      let fastest=0,pump=0;
      for(let i=1;i<full.length;i++){
        fastest=Math.max(fastest,Math.abs(heights[i]-heights[i-1])*fps);
        for(const side of ['Left','Right'])pump=Math.max(pump,Math.hypot(...[0,1,2].map(j=>
          (full[i].local[`wrist${side}`][j]-full[i].local[`shoulder${side}`][j])-(full[i-1].local[`wrist${side}`][j]-full[i-1].local[`shoulder${side}`][j])))*fps);}
      check(give<CALM.hips&&fastest<CALM.sink,`${label}: he wobbles at the bottom (hips ${give.toFixed(3)} m, at up to ${fastest.toFixed(2)} m/s)`);
      check(pump<CALM.arm,`${label}: an arm pumps at full charge (${pump.toFixed(2)} m/s about its shoulder)`);
      // Neither hand is up behind him: both hang well below their shoulders.
      const reach=Math.max(...full.flatMap(fr=>['Left','Right'].map(side=>fr.local[`wrist${side}`][1]-fr.local[`shoulder${side}`][1])));
      check(reach<-.2,`${label}: a hand is up by its shoulder (${reach.toFixed(2)} m)`);
      Object.assign(row,{sink,hands,stillest,give,fastest,pump,reach});
    }
    results.push(row);
  }
  if(problems.length){console.log(problems.join('\n'));process.exitCode=1;}
  console.log(`${problems.length?'FAIL':'PASS'} D's jump charge winds down over planted soles and never stands still`,JSON.stringify(results,(key,value)=>typeof value==='number'?+value.toFixed(3):value,1));
},{levelEntry:{id:'charge-test',name:'Charge test',data:{v:1,name:'Charge test',spawn:[0,.02,60],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[300,1,300],edgeGrinding:false},{t:'gate',p:[140,0,-140]}]}}});
