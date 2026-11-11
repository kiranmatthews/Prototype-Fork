import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// A rider under D is never a held pose. Charging, he is down in a deep
// crouch that folds toward the hard landing's low point and keeps pumping
// at full charge; coasting, he still moves; he leans into a turn and takes
// a bump in his knees. None of it pops, and none of it moves the player.
//   SKATE_LIFE_REPORT=1 lists every failure instead of stopping at the first.
const load=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([load('skate'),load('jak')]);
const problems=[],check=(ok,message)=>{if(ok)return;if(process.env.SKATE_LIFE_REPORT)problems.push(message);else assert.fail(message);};
const JOINTS=['hips','chest','head','wristLeft','wristRight','kneeLeft','kneeRight'];
// A ramp up and a ramp down, to ride over, in a lane of their own beside the flat one.
const LANE=12,hump=(z,rise,len)=>[{t:'ramp',p:[LANE,0,z-len/2],len,rise,w:8,yaw:180},{t:'ramp',p:[LANE,0,z-len*1.5],len,rise,w:8,yaw:0}];
const mount=[[.4,{y:1}],[1.1,{y:1,jump:true}],[.9,{y:1}]];
await withSkateRuntime(async({server,scene,level,Player,THREE})=>{
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const play=(name,steps,fps=60,lane=0)=>{
    const players=[new Player(scene),new Player(scene)],[p,control]=players,v=new THREE.Vector3();
    const runtimes=players.map(player=>{
      const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition;
      player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
      return createCharacterAnimationRuntime(player,createJakDirectSuite(createPlayerStarterAnimationSuite(rig),rig,jak));
    });
    const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
    for(const [i,player] of players.entries()){
      player.enterLevel('skate-life');player.respawn(level,true,true);runtimes[i].restart();
      if(lane){player.pos.x=lane;player.prevPos.copy(player.pos);}
    }
    const frames=[];let f=0,jumpWas=false;
    for(const [seconds,keys] of [[1,{}],...mount,...steps])for(let k=0,n=Math.round(seconds*fps);k<n;k++,f++){
      const jump=!!keys.jump;
      for(const player of players){const input=makeInput({moveX:keys.x??0,moveY:keys.y??0,jumpHeld:jump,jumpPressed:jump&&!jumpWas,jumpReleased:!jump&&jumpWas});
        player.rawInput=input;player.step(1/fps,input,level);player.commitRenderStep(level);}
      level.update(1/fps);jumpWas=jump;
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&p.speed===control.speed&&p.state===control.state&&p.freeSkate===control.freeSkate,`${name}: the rider's life moved the player at frame ${f}`);
      const yaw=p.visualYaw,c=Math.cos(yaw),s=Math.sin(yaw),local={};
      for(const id of JOINTS){p.animationRig.jointsById.get(id).node.getWorldPosition(v);const x=v.x-p.pos.x,z=v.z-p.pos.z;
        assert.ok(Number.isFinite(v.x+v.y+v.z),`${name}: ${id} is not a number at frame ${f}`);local[id]=[x*-c+z*s,v.y-p.pos.y,x*-s+z*-c];}
      frames.push({f,phase:motion.phase,owner:motion.diagnostics.nativeOwner,grounded:p.grounded,speed:p.speed,charge:p.chargePose??0,steer:p.lean??0,life:motion.lifeDiagnostics,local});
    }
    motion.dispose();for(const runtime of runtimes)runtime.dispose();
    for(const player of players)scene.remove(player.group);
    return frames;
  };
  // The most any tracked joint travels in each half second of a stretch: how still he is at his stillest.
  const stillest=(frames,fps=60)=>{let least=Infinity;
    for(let i=0;i+fps/2<=frames.length;i+=Math.round(fps/4)){const window=frames.slice(i,i+Math.round(fps/2));let most=0;
      for(const id of JOINTS)for(const axis of [0,1,2]){const values=window.map(fr=>fr.local[id][axis]);most=Math.max(most,Math.max(...values)-Math.min(...values));}
      least=Math.min(least,most);}
    return least;};
  // The head's largest step in one 60 Hz frame, over frames that are all riding or charging. The controller
  // rolls rider and board together into a turn, fastest as the stick is first pushed; `steady` leaves those
  // frames to it, to look at what the rider's own life does.
  const step=(frames,fps=60,steady=false)=>{let worst=0;for(let i=1;i<frames.length;i++)
    if(frames[i].f===frames[i-1].f+1&&!(steady&&Math.abs(frames[i].steer-frames[i-1].steer)*fps/60>.004))
      worst=Math.max(worst,Math.hypot(...[0,1,2].map(j=>frames[i].local.head[j]-frames[i-1].local.head[j]))*fps/60);return worst;};
  const riding=fr=>(fr.phase==='ride'||fr.phase==='charge')&&fr.owner===null&&fr.grounded;
  const results={};

  // Coasting: upright, and still not still.
  for(const fps of [60,30,120]){
    const frames=play(`coast@${fps}`,[[.5,{y:1}],[4,{}]],fps),coast=frames.filter(fr=>fr.phase==='ride'&&fr.owner===null).slice(Math.round(fps*.4));
    check(coast.length>fps*3,`coast@${fps}: fixture never coasted`);if(coast.length<=fps*3)continue;
    const least=stillest(coast,fps),head=step(coast,fps);
    check(least>.05,`coast@${fps}: coasting, he stands still (${least.toFixed(3)} m in half a second)`);
    check(head<.05,`coast@${fps}: coasting, his head stepped ${head.toFixed(3)} m in a frame`);
    results[`coast@${fps}`]={least,head,hips:coast.reduce((sum,fr)=>sum+fr.local.hips[1],0)/coast.length,headHeight:coast.reduce((sum,fr)=>sum+fr.local.head[1],0)/coast.length};
  }
  const upright=results['coast@60'];

  // Charging at speed: deep, folded, and pumping for as long as it is held; steered under it, he leans.
  for(const fps of [60,30,120]){
    const frames=play(`charge@${fps}`,[[1.6,{y:1,jump:true}],[1,{x:1,y:1,jump:true}],[1,{x:-1,y:1,jump:true}],[.6,{y:1,jump:true}],[.3,{y:1}]],fps);
    const charge=frames.filter(fr=>fr.phase==='charge'&&fr.owner===null),full=charge.filter(fr=>fr.charge>.995);
    check(full.length>fps*3,`charge@${fps}: fixture never held a full charge`);if(full.length<=fps*3||!upright)continue;
    const straight=full.filter(fr=>Math.abs(fr.steer)<.01&&Math.abs(fr.life.lean)<.08);
    const hips=straight.reduce((sum,fr)=>sum+fr.local.hips[1],0)/straight.length,head=straight.reduce((sum,fr)=>sum+fr.local.head[1],0)/straight.length;
    check(upright.hips-hips>.22&&upright.headHeight-head>.45,`charge@${fps}: the charge is not a deep, folded crouch (hips ${(upright.hips-hips).toFixed(2)} m down, head ${(upright.headHeight-head).toFixed(2)} m)`);
    const least=stillest(full,fps),jolt=step(charge,fps,true),turned=step(charge,fps);
    check(least>.08,`charge@${fps}: held at full charge he is still (${least.toFixed(3)} m in half a second)`);
    check(jolt<.06&&turned<.13,`charge@${fps}: charging, his head stepped ${jolt.toFixed(3)} m in a frame (${turned.toFixed(3)} as he is turned)`);
    const leans=[Math.max(...full.map(fr=>fr.life.lean)),Math.min(...full.map(fr=>fr.life.lean))];
    check(leans[0]>.4&&leans[1]<-.4,`charge@${fps}: steering under the charge does not lean him (${leans.map(x=>x.toFixed(2))})`);
    results[`charge@${fps}`]={down:upright.hips-hips,fold:upright.headHeight-head,least,jolt,turned,leans};
  }

  // X kept down through a landing: the charge takes him at the landing's low point. He does not stand up to crouch again.
  {
    const frames=play('land',[[1.2,{y:1,jump:true}],[.15,{y:1}],[2.2,{y:1,jump:true}]]);
    const land=frames.findIndex((fr,i)=>i>0&&fr.phase==='land'&&frames[i-1].phase==='air'&&frames[i-1].f>260);
    const after=land<0?[]:frames.slice(land+10,land+70);
    check(land>0&&after.some(fr=>fr.phase==='charge'),'land: fixture missed the landing into a held charge');
    if(after.length&&upright){
      const top=Math.max(...after.map(fr=>fr.local.hips[1]));
      check(upright.hips-top>.15,`land: held through the landing he stood up before crouching again (hips within ${(upright.hips-top).toFixed(2)} m of riding)`);
      results.land={top:upright.hips-top};
    }
  }

  // Turning while he coasts: he leans into it, further than the board tilts him, and presses down.
  // (The stick points across the road and he turns until he faces it, so each turn is a moment, not a hold.)
  {
    const into=[1,-1].map(x=>play(`carve ${x}`,[[.5,{y:1}],[1.2,{}],[1.4,{x}],[.6,{}]]).filter(riding).filter(fr=>Math.abs(fr.steer)>.08||Math.abs(fr.life.lean)>.3));
    check(into.every(list=>list.length>12),`carve: fixture never turned (${into.map(list=>list.length)})`);
    if(into.every(list=>list.length>12)&&upright){
      const leans=into.map(list=>list.reduce((most,fr)=>Math.abs(fr.life.lean)>Math.abs(most)?fr.life.lean:most,0));
      const press=into.map(list=>upright.hips-Math.min(...list.map(fr=>fr.local.hips[1])));
      check(Math.min(...leans.map(Math.abs))>.6&&leans[0]*leans[1]<0,`carve: a turn does not lean him into it (${leans.map(x=>x.toFixed(2))})`);
      check(Math.min(...press)>.03,`carve: a turn does not press him down (${press.map(x=>x.toFixed(3))} m)`);
      const head=Math.max(...into.map(list=>step(list,60,true)));
      check(head<.06,`carve: turning, his head stepped ${head.toFixed(3)} m in a frame`);
      results.carve={leans,press,head};
    }
  }

  // The road: a hump goes into his knees and comes back out.
  {
    const frames=play('bumps',[[.5,{y:1}],[3.5,{}]],60,LANE).filter(riding);
    const kicked=Math.max(...frames.map(fr=>fr.life.bump)),thrown=Math.min(...frames.map(fr=>fr.life.bump));
    check(kicked>.12&&thrown<-.015,`bumps: the road never reached his knees (${kicked.toFixed(3)}, ${thrown.toFixed(3)})`);
    const head=step(frames);
    // (He used to be thrown over with the board as it met each slope: 0.35 m in a frame over these humps.)
    check(head<.09,`bumps: over a hump his head stepped ${head.toFixed(3)} m in a frame`);
    results.bumps={kicked,thrown,head};
  }
  if(problems.length){console.log(problems.join('\n'));process.exitCode=1;}
  console.log(`${problems.length?'FAIL':'PASS'} a rider under D is never a held pose`,JSON.stringify(results,(key,value)=>typeof value==='number'?+value.toFixed(3):value,1));
},{levelEntry:{id:'skate-life',name:'Skate life',data:{v:1,name:'Skate life',spawn:[0,.02,140],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[40,1,320],edgeGrinding:false},...hump(96,.14,1.6),...hump(84,.1,1.2),{t:'gate',p:[18,0,-150]}]}}});
