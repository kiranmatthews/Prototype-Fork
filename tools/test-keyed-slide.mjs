import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// D keys its own slide and slide jump. They are presentation only: the same
// inputs must move the player exactly as the native clips do. Every way out
// of them (standing up, running on, a held crouch, a held crawl, the jump and
// its landing into a stand or a run) must carry the body across without a jump
// in its pose or its speed, and without sinking a foot into the floor. Running
// on out of the jump, or out of a second jump after it, must keep the pace an
// ordinary running jump lands with.
const bank=JSON.parse(gunzipSync(await readFile(new URL('../public/motion-study/jak/motion.json.gz',import.meta.url))));
const EXITS=['stand','run','crouch','crawl','jump','jump-run','jump2-run'];
// The largest change of world speed in one 60 Hz frame, m/s, that a part may
// show while it is being carried. Leaving and meeting the ground are contacts,
// not pops, and are left out. A cut that drops a pose shows as several times these.
// KEYED_SLIDE_REPORT=1 lists every failure instead of stopping at the first.
const problems=[],check=(ok,message)=>{if(ok)return;if(process.env.KEYED_SLIDE_REPORT)problems.push(message);else assert.fail(message);};
const KINK={hips:10.5,chest:10.5,head:10.5,wristLeft:13,wristRight:13};
await withSkateRuntime(async({server,scene,level,Player,THREE,TUNING})=>{
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {JAK_SLIDE,JAK_SLIDE_JUMP}=await server.ssrLoadModule('/src/animation/jakSlide.ts');
  const results=[];
  for(const fps of [30,60,120])for(const mode of EXITS){
    const players=[new Player(scene),new Player(scene)],[p,control]=players;
    const runtimes=players.map((player,i)=>{
      const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition,base=createPlayerStarterAnimationSuite(rig);
      return createCharacterAnimationRuntime(player,i?base:createJakDirectSuite(base,rig,bank));
    });
    p.onFootJumpStudy=control.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
    for(const [i,player] of players.entries()){player.enterLevel('slide-test');player.respawn(level,true,true);runtimes[i].restart();}
    const joint=id=>p.animationRig.jointsById.get(id).node,v=new THREE.Vector3();
    const world=id=>joint(id).getWorldPosition(new THREE.Vector3());
    const q=id=>joint(id).quaternion.clone();
    const soles=()=>['left','right'].flatMap(side=>['foot','heel'].map(part=>p.group.getObjectByName(`socket-${part}-${side}`).getWorldPosition(new THREE.Vector3())));
    const dt=1/fps,idle=Math.round(fps*1.6),slideAt=idle+Math.round(fps*.7),hop=slideAt+Math.round(fps*.2);
    const jump=mode.startsWith('jump'),low=mode==='crouch'||mode==='crawl',keep=mode==='run'||mode==='crawl'||mode.endsWith('-run');
    // "jump2" taps again in the air: the double jump out of the slide jump.
    const again=mode.startsWith('jump2')?hop+Math.round(fps*.3):-1,tap=Math.round(fps*.06);
    let slideEnd=-1,ended=-1,landed=-1,apart=0,sink=0,slip=0,flip=0,previousPitch=null,air=0,dip=Infinity,stood=-1,held=null;
    let slowest=Infinity,doubled=false;const before=new THREE.Vector3();
    const clips=[],kinks=Object.fromEntries(Object.keys(KINK).map(id=>[id,0])),history=[];
    for(let f=0;f<fps*4.2;f++){
      const input=()=>makeInput({moveY:f>=idle&&(f<slideAt+Math.round(fps*.2)||keep)?1:0,
        grabHeld:f===slideAt||low&&f>=slideAt,grabPressed:f===slideAt,
        jumpHeld:jump&&f>=hop&&f<hop+Math.round(fps*.08)||again>=0&&f>=again&&f<again+tap,
        jumpPressed:jump&&f===hop||f===again,jumpReleased:jump&&f===hop+Math.round(fps*.08)||again>=0&&f===again+tap});
      before.copy(p.pos);
      for(const player of players){player.step(dt,input(),level);player.commitRenderStep(level);}
      level.update(dt);
      // Presentation never moves the player.
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&Math.abs(p.vVel-control.vVel)<1e-9&&p.state===control.state,
        `${mode}@${fps}: the keyed slide changed movement at frame ${f}`);
      if(f<slideAt-2)continue;
      const clip=runtimes[0].activeClipId,time=runtimes[0].diagnostics.timelineTime??0;
      if(clips.at(-1)!==clip)clips.push(clip);
      const now=Object.fromEntries(Object.keys(KINK).map(id=>[id,world(id)]));
      history.push({now,landed:landed>=0&&f-landed<=Math.ceil(fps/30)||p.grounded!==history.at(-1)?.grounded,grounded:p.grounded});
      if(f<slideAt)continue;
      const since=(f-slideAt)*dt;
      if(slideEnd<0&&!p.sliding)slideEnd=f;
      if(jump&&air&&landed<0&&p.grounded)landed=f;
      doubled||=p.lastJumpType==='Double Jump';
      // From the frame after the touchdown, how fast he is actually travelling.
      if(landed>=0&&f>landed&&(f-landed)*dt<.7)slowest=Math.min(slowest,Math.hypot(p.pos.x-before.x,p.pos.z-before.z)/dt);
      // A second jump hands the air to the stock double jump, and running on
      // hands the touchdown to the stock running landing; their own motion is
      // the ordinary one and is not judged here.
      if(history.length>=3&&since<2.2&&!doubled&&!(keep&&landed>=0)){
        // How much each part's world velocity changed over this frame, at a 60 Hz frame's scale.
        const [a,b,c]=history.slice(-3);
        if(!a.landed&&!b.landed&&!c.landed)for(const id of Object.keys(KINK)){
          const change=v.copy(c.now[id]).addScaledVector(b.now[id],-2).add(a.now[id]).length()*fps*fps/60;
          kinks[id]=Math.max(kinks[id],change);
        }
      }
      if(p.grounded&&since<2){
        // No sole sinks: on the floor through the keyed clips, and no deeper than
        // the crouch and crawl themselves stand once they have taken over.
        const depth=-Math.min(...soles().map(point=>point.y-p.pos.y));
        const allowed=low&&slideEnd>=0?(f-slideEnd)*dt<.4?.07:Infinity:.035;
        if(depth>allowed)sink=Math.max(sink,depth);
      }
      if(clip==='player.slide'&&time>.25&&time<JAK_SLIDE.rise){
        // Nothing is mirrored, and the skid is low.
        apart=Math.max(apart,q('hipLeft').angleTo(q('hipRight').set(-q('hipRight').x,q('hipRight').y,q('hipRight').z,q('hipRight').w)));
        assert.ok(world('head').y-p.pos.y<1.75,`${mode}@${fps}: the skid is not low`);
      }
      if(mode==='stand'&&p.slideRiseT>=JAK_SLIDE.step[1]+.04&&p.slideRiseT<=JAK_SLIDE.lock){
        // Both soles are on their marks from here: he stands up over planted feet.
        const here=soles().filter((_,i)=>i%2===0);
        if(held)slip=Math.max(slip,...here.map((point,i)=>Math.hypot(point.x-held[i].x,point.z-held[i].z)));
        else held=here;
        if(stood<0&&world('hips').y-p.pos.y>.93)stood=p.slideRiseT;
      }
      if(clip==='player.slide-jump'&&!p.grounded&&!doubled){
        air++;
        const up=new THREE.Vector3(0,1,0).applyQuaternion(joint('hips').quaternion),pitch=Math.atan2(up.z,up.y);
        if(previousPitch!==null)flip+=Math.atan2(Math.sin(pitch-previousPitch),Math.cos(pitch-previousPitch));
        previousPitch=pitch;
      }
      if(landed>=0&&(f-landed)*dt<.35)dip=Math.min(dip,world('hips').y-p.pos.y);
      if(slideEnd>=0&&ended<0&&clip!=='player.slide'&&clip!=='player.slide-jump')ended=f;
    }
    const flow=clips.map(id=>id.replace('player.','')).join('>');
    check(clips.includes('player.slide'),`${mode}@${fps}: the slide never played`);
    if(!jump)check(apart>.35,`${mode}@${fps}: the skid's legs mirror each other (${apart})`);
    check(sink===0,`${mode}@${fps}: a sole sank ${sink.toFixed(3)} into the floor`);
    if(fps>=60)for(const [id,limit] of Object.entries(KINK))
      check(kinks[id]<=limit,`${mode}@${fps}: ${id} changed speed by ${kinks[id].toFixed(1)} m/s in a frame (limit ${limit})`);
    const seconds=(ended-slideEnd)*dt;
    if(jump){
      check(air>fps*(again>=0?.15:.3),`${mode}@${fps}: the slide jump never played`);
      // He straightens out of the laid-back skid and stays upright: no flip.
      check(Math.abs(flip)<1.6,`${mode}@${fps}: the slide jump turned ${flip} rad`);
      check(landed>0&&p.state!=='dead',`${mode}@${fps}: the slide jump never landed`);
      if(again>=0)check(doubled&&clips.includes('player.double-jump'),`${mode}@${fps}: the second jump never fired (${flow})`);
      if(keep){
        // With a direction held he runs on at full pace from the first frame
        // on the ground, through the same landing an ordinary running jump has.
        check(slowest>=TUNING.walkSpeed-.01,`${mode}@${fps}: running on out of the jump slowed to ${slowest.toFixed(2)} m/s`);
        check(clips.includes('player.jak-run-land')&&!clips.slice(clips.indexOf('player.jak-run-land')).includes('player.slide-jump'),
          `${mode}@${fps}: running on did not take the ordinary running landing (${flow})`);
      }else{
        // A neutral stick stops on the spot in the jump's own touchdown: no stock landing.
        check(!clips.some(id=>/land/.test(id)),`${mode}@${fps}: a stock landing played (${flow})`);
        check(slowest<.01,`${mode}@${fps}: a neutral stick kept ${slowest.toFixed(2)} m/s after the touchdown`);
        // It gives at the knees and comes back up; it does not stay down.
        check(dip>.55&&dip<.92,`${mode}@${fps}: the landing's lowest hips were ${dip.toFixed(3)} above the floor`);
        check((ended-landed)*dt<=JAK_SLIDE_JUMP.settle+.1,`${mode}@${fps}: the landing held on for ${(ended-landed)*dt}s`);
      }
    }else if(low){
      // Circle held through the skid: the crouch or the crawl has him at once.
      check(ended-slideEnd<=2,`${mode}@${fps}: the skid held on for ${seconds}s before the ${mode}`);
      check(clips.at(-1)===(mode==='crawl'?'player.crawl':'player.crouch'),`${mode}@${fps}: ended in ${flow}`);
    }else{
      check(seconds<=JAK_SLIDE.lock+JAK_SLIDE.tail+.1,`${mode}@${fps}: the get-up held on for ${seconds}s`);
      if(mode==='stand'){
        check(stood>0&&stood<=JAK_SLIDE.stand+.03,`${mode}@${fps}: he was not up by ${JAK_SLIDE.stand}s (${stood})`);
        check(slip<.02,`${mode}@${fps}: planted soles slid ${slip} while he stood up`);
      }
    }
    if(keep&&mode!=='crawl')check(control.walkVelocity.length()>TUNING.walkSpeed*.5&&clips.at(-1)==='player.run',`${mode}@${fps}: the run never resumed (${flow})`);
    results.push({fps,mode,flow,sink:+sink.toFixed(3),slip:+slip.toFixed(4),flip:+flip.toFixed(3),stood:+stood.toFixed(3),
      slowest:Number.isFinite(slowest)?+slowest.toFixed(2):null,
      dip:Number.isFinite(dip)?+dip.toFixed(3):null,kinks:Object.fromEntries(Object.entries(kinks).map(([id,value])=>[id,+value.toFixed(1)]))});
    for(const runtime of runtimes)runtime.dispose();
    for(const player of players)scene.remove(player.group);
  }
  if(problems.length){console.log(problems.join('\n'));console.log(results.map(r=>`${r.mode}@${r.fps} ${r.flow} sink ${r.sink} slip ${r.slip} stood ${r.stood} dip ${r.dip} slowest ${r.slowest} kinks ${JSON.stringify(r.kinks)}`).join('\n'));process.exitCode=1;return;}
  console.log(JSON.stringify({status:'pass',results},null,1));
},{levelEntry:{id:'slide-test',name:'Slide test',data:{v:1,name:'Slide test',spawn:[0,.02,60],killY:-30,
  components:[{t:'platform',p:[0,-.5,0],s:[300,1,300],edgeGrinding:false},{t:'gate',p:[140,0,-140]}]}}});
