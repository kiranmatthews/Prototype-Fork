import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// The deck lies on the ground it is riding, under the authored ride as under
// the native one. A street level leaves the drawn root upright on a ramp and a
// park lays it all the way onto the surface; the authored ride has to take
// what is left of the ground, and nothing more, in either. It used to tip the
// deck the wrong way down a street ramp (twice the slope out) and stand it
// back up level on every slope of a park.
//   SKATE_GROUND_REPORT=1 lists every failure instead of stopping at the first.
const load=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([load('skate'),load('jak')]);
const problems=[],check=(ok,message)=>{if(ok)return;if(process.env.SKATE_GROUND_REPORT)problems.push(message);else assert.fail(message);};
const deg=radians=>radians*180/Math.PI;
// One lane, ridden toward -Z: a long deck, 18 degrees down, a flat, 11 degrees up and a deck to finish on.
// A second lane beside it is banked across the way he rides.
const BANK=60,WIDE=40,course=park=>({id:park?'ground-lie-park':'ground-lie-street',name:'Ground lie',data:{v:1,name:'Ground lie',
  spawn:[0,20.02,100],killY:-40,...(park?{skatepark:true}:{}),components:[
    {t:'platform',p:[0,19.5,85],s:[WIDE,1,50],edgeGrinding:false},
    {t:'ramp',p:[0,0,30],len:60,rise:20,w:WIDE,yaw:180},
    {t:'platform',p:[0,-.5,-20],s:[WIDE,1,40],edgeGrinding:false},
    {t:'ramp',p:[0,0,-55],len:30,rise:6,w:WIDE,yaw:0},
    {t:'platform',p:[0,5.5,-100],s:[WIDE,1,60],edgeGrinding:false},
    {t:'ramp',p:[BANK,18.5,40],len:14,rise:3,w:260,yaw:90},
    {t:'gate',p:[0,6,-126]},
  ]}});
const mount=[[.4,{y:1}],[1.1,{y:1,jump:true}],[.9,{y:1}]];

await withSkateRuntime(async({server,Level,Player,THREE})=>{
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {skateboardSettings}=await server.ssrLoadModule('/src/skateboard/settings.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const Y=new THREE.Vector3(0,1,0),v=new THREE.Vector3();
  // A node's turn in the world through its joints: the scaled body shears a world matrix under it.
  const turnOf=node=>{const q=new THREE.Quaternion();for(let n=node;n;n=n.parent)q.premultiply(n.quaternion);return q;};
  const deckSurface=(x,z)=>{const s=skateboardSettings.value,k=s.overallScale;return (s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,x/k,z/k))*k;};
  const worlds=new Map();
  const world=park=>{
    if(!worlds.has(park)){const scene=new THREE.Scene(),level=new Level(scene,course(park));level.update(0);scene.updateMatrixWorld(true);worlds.set(park,{scene,level});}
    return worlds.get(park);
  };
  /** Ride `steps` after getting on. Returns one row per frame the authored ride had him on the ground. */
  const play=(name,park,steps,{lane=0,stance=0,deckYaw=0}={})=>{
    const {scene,level}=world(park),id=course(park).id;
    const players=[new Player(scene),new Player(scene)],[p,control]=players;
    const runtimes=players.map(player=>{
      const rig=RigBinding.fromSculptRuntime(player.animationRig.root).definition;
      player.onFootJumpStudy={...JAK_DIRECT_PHYSICS,flip:true};
      return createCharacterAnimationRuntime(player,createJakDirectSuite(createPlayerStarterAnimationSuite(rig),rig,jak));
    });
    const motion=new PlayableSkateMotion(p,skate,{continuousTransitions:true});
    for(const [i,player] of players.entries()){
      player.enterLevel(id);player.respawn(level,true,true);runtimes[i].restart();
      if(lane){player.pos.x=lane;player.prevPos.copy(player.pos);}
    }
    const rider=p.animationRig.root.getObjectByName('procedural-rider');
    const sockets=['Left','Right'].map(side=>p.animationRig.jointsById.get(`ankle${side}`).node.getObjectByName(`socket-foot-${side.toLowerCase()}`));
    const rows=[];let f=0,jumpWas=false,set=false;
    for(const [seconds,keys] of [[.5,{}],...(park?[]:mount),...steps])for(let k=0,n=Math.round(seconds*60);k<n;k++,f++){
      const jump=!!keys.jump;
      // A lead foot or a deck heading is the controller's to hold: it is set on both riders once he is on the board.
      if(!set&&p.freeSkate&&p.grounded&&(stance||deckYaw)){set=true;for(const player of players){if(stance)player.stance=stance;player.deckYawOffset=deckYaw;}}
      for(const player of players){const input=makeInput({moveX:keys.x??0,moveY:keys.y??0,jumpHeld:jump,jumpPressed:jump&&!jumpWas,jumpReleased:!jump&&jumpWas});
        player.rawInput=input;player.step(1/60,input,level);player.commitRenderStep(level);}
      level.update(1/60);jumpWas=jump;
      assert.ok(p.pos.distanceTo(control.pos)<1e-9&&p.speed===control.speed&&p.state===control.state&&p.freeSkate===control.freeSkate,
        `${name}: lying on the ground moved the player at frame ${f}`);
      const normal=p.groundHit?.normal;
      if(process.env.SKATE_GROUND_TRACE===name&&f%6===0)console.log(f,p.state,p.freeSkate?'board':'foot',p.grounded?'ground':'air',`owner ${motion.diagnostics.nativeOwner}`,motion.phase,
        `at ${p.pos.toArray().map(value=>value.toFixed(1))}`,`speed ${p.speed.toFixed(1)}`,normal?`slope ${deg(Math.acos(Math.min(1,normal.y))).toFixed(1)}`:'',p.groundHit?.name??'',`stance ${p.stance}`,`deck yaw ${p.deckYawOffset.toFixed(2)}`);
      if(!(p.freeSkate&&p.grounded&&normal&&p.state==='ride'&&motion.diagnostics.nativeOwner===null&&p.boardG.visible)){rows.push(null);continue;}
      p.group.updateMatrixWorld(true);
      const board=p.boardG,deckUp=new THREE.Vector3().setFromMatrixColumn(board.matrixWorld,1).normalize();
      const nose=new THREE.Vector3().setFromMatrixColumn(board.matrixWorld,2).normalize();
      const travel=p.pos.clone().sub(p.prevPos);
      rows.push({f,phase:motion.phase,z:p.pos.z,x:p.pos.x,slope:deg(Math.acos(Math.min(1,normal.y))),normal:normal.clone(),lean:deg(Math.abs(p.lean??0)),
        deck:deg(deckUp.angleTo(normal)),along:travel.lengthSq()>1e-8?Math.abs(nose.dot(travel.normalize())):1,
        rider:deg(Y.clone().applyQuaternion(turnOf(rider)).angleTo(normal)),
        soles:sockets.map(socket=>{board.worldToLocal(socket.getWorldPosition(v));return v.y-deckSurface(v.x,v.z);}),
        nativeDeck:deg(new THREE.Vector3().setFromMatrixColumn(control.boardG.matrixWorld,1).normalize().angleTo(normal)),
        root:p.alignPose,fade:motion.diagnostics.fade});
    }
    motion.dispose();for(const runtime of runtimes)runtime.dispose();
    for(const player of players)scene.remove(player.group);
    return rows;
  };
  const most=(rows,key)=>rows.reduce((worst,row)=>row[key]>worst[key]?row:worst,rows[0]);
  const settledOn=(rows,pick)=>{
    // Frames at least half a second into a stretch of ground that `pick` accepts: he has come round to it.
    const out=[];let run=0;
    for(const row of rows){run=row&&pick(row)?run+1:0;if(run>30)out.push(row);}
    return out;
  };
  // A pose still being faded in (after getting on, a landing, a respawn) is on its way to the ground, not on it.
  const riding=frames=>frames.map(row=>row&&row.fade>=1&&row.phase!=='mount'&&row.phase!=='land'?row:null);
  const results={};
  for(const park of [false,true])for(const [label,options] of [['regular',{}],['fakie',{stance:1}],['deck reversed',{deckYaw:Math.PI}]]){
    const name=`${park?'park':'street'}, ${label}`;
    // Down the ramp, across the flat and up the other side: pushing first in a park, then coasting.
    const frames=riding(play(name,park,park?[[2.4,{y:1}],[9,{}]]:[[9,{}]],options)),rows=frames.filter(Boolean);
    const onDown=row=>row.z>0&&row.slope>10,onUp=row=>row.z<0&&row.slope>5;
    const down=rows.filter(onDown),up=rows.filter(onUp),flat=settledOn(frames,row=>row.slope<.5);
    check(down.length>40,`${name}: only ${down.length} frames of the authored ride on the way down`);
    check(up.length>12,`${name}: only ${up.length} frames of the authored ride on the way up`);
    if(!down.length||!up.length||!flat.length)continue;
    // The deck: on the ground at once, both ways, and still pointing along the way he is going.
    for(const [where,list] of [['down the ramp',down],['up the ramp',up],['on the flat',flat]]){
      const worst=most(list,'deck');
      check(worst.deck<2.5,`${name}: ${where} the deck lay ${worst.deck.toFixed(1)} degrees off a ${worst.slope.toFixed(1)} degree slope (frame ${worst.f}, ${worst.phase})`);
      const turned=list.reduce((least,row)=>row.along<least.along?row:least,list[0]);
      check(turned.along>.96,`${name}: ${where} the deck pointed ${deg(Math.acos(turned.along)).toFixed(1)} degrees off the way he was going (frame ${turned.f})`);
    }
    // The rider: late onto each new slope, then all the way round to it, and never past it.
    const late={};
    for(const [where,on] of [['down',onDown],['up',onUp]]){
      const at=frames.findIndex((row,i)=>row&&on(row)&&frames[i-1]&&frames[i-1].slope<.5);
      check(at>0,`${name}: the authored ride did not carry him onto the way ${where}`);
      if(at<=0)continue;
      const first=frames[at],after=frames.slice(at,at+50).filter(row=>row&&on(row));
      check(first.rider>first.slope*.6,`${name}: he was thrown onto the way ${where} with the board (${first.rider.toFixed(1)} of ${first.slope.toFixed(1)} degrees left after one frame)`);
      const back=after.slice(1).map((row,i)=>({f:row.f,from:after[i].rider,to:row.rider})).reduce((worst,step)=>step.to-step.from>worst.to-worst.from?step:worst,{f:first.f,from:0,to:0});
      check(back.to-back.from<.3,`${name}: coming round to the way ${where} he swung back out (${back.from.toFixed(1)} to ${back.to.toFixed(1)} degrees in frame ${back.f})`);
      const settled=after.slice(35);
      check(settled.length>3&&most(settled,'rider').rider<2,`${name}: over half a second onto the way ${where} he still stood ${settled.length?most(settled,'rider').rider.toFixed(1):'?'} degrees off it`);
      late[where]=[first.rider,settled.length?most(settled,'rider').rider:NaN];
    }
    // His soles: where they are on the flat, to the same deck.
    const span=list=>{const values=list.filter(row=>row.phase==='ride').flatMap(row=>row.soles);return [Math.min(...values),Math.max(...values)];};
    const [low,high]=span(flat),[slopeLow,slopeHigh]=span([...settledOn(frames,onDown),...settledOn(frames,onUp)]);
    check(slopeLow>low-.012&&slopeHigh<high+.012,`${name}: his soles sat ${(slopeLow*1000).toFixed(0)} to ${(slopeHigh*1000).toFixed(0)} mm off the deck on the slopes, ${(low*1000).toFixed(0)} to ${(high*1000).toFixed(0)} on the flat`);
    results[name]={frames:rows.length,phases:[...new Set(down.map(row=>row.phase))].join(' '),deckDown:most(down,'deck').deck,deckUp:most(up,'deck').deck,deckFlat:most(flat,'deck').deck,
      riderOntoDown:late.down,riderOntoUp:late.up,soleFlat:[low,high].map(value=>value*1000),soleSlope:[slopeLow,slopeHigh].map(value=>value*1000),
      root:most(down,'root').root,nativeDeckDown:most(down,'nativeDeck').nativeDeck};
  }
  // A carve leans rider and deck together, as the controller rolls them: on a slope as on the flat.
  for(const park of [false,true]){
    const name=`${park?'park':'street'}, carving`;
    // Half a swing one way, then whole swings each way: a weave about the line he started on.
    const weave=Array.from({length:23},(_,i)=>[i?.36:.18,{x:i%2?-1:1,...(park&&i<8?{y:1}:{})}]);
    const frames=riding(play(name,park,weave)),rows=frames.filter(Boolean);
    const leaning=rows.filter(row=>row.lean>6),sloped=leaning.filter(row=>row.slope>10),level=leaning.filter(row=>row.slope<.5);
    check(level.length>20,`${name}: only ${level.length} frames leaning on the flat`);
    check(sloped.length>20,`${name}: only ${sloped.length} frames leaning on the ramp`);
    for(const [where,list] of [['on the flat',level],['on the ramp',sloped]]){
      if(!list.length)continue;
      const worst=list.reduce((far,row)=>Math.abs(row.deck-row.lean)>Math.abs(far.deck-far.lean)?row:far,list[0]);
      check(Math.abs(worst.deck-worst.lean)<2.5,`${name}: ${where} the deck leaned ${worst.deck.toFixed(1)} degrees off the ground in a ${worst.lean.toFixed(1)} degree carve (frame ${worst.f})`);
    }
    // Once it has settled on the flat the native deck is right in either kind of level: the authored one leans exactly as far.
    const steady=settledOn(frames,row=>row.slope<.5).filter(row=>row.lean>6);
    const apart=steady.length?steady.reduce((far,row)=>Math.abs(row.deck-row.nativeDeck)>Math.abs(far.deck-far.nativeDeck)?row:far,steady[0]):null;
    check(steady.length>20,`${name}: only ${steady.length} settled frames leaning on the flat`);
    if(apart)check(Math.abs(apart.deck-apart.nativeDeck)<2.5,`${name}: on the flat the deck leaned ${apart.deck.toFixed(1)} degrees where the native one leans ${apart.nativeDeck.toFixed(1)} (frame ${apart.f})`);
    results[name]={leaningFlat:level.length,leaningRamp:sloped.length,most:leaning.length?most(leaning,'lean').lean:0};
  }
  // A bank across the way he rides rolls the deck, the right way.
  for(const park of [false,true]){
    const name=`${park?'park':'street'}, across a bank`;
    const rows=riding(play(name,park,[[2.5,park?{y:1}:{}]],{lane:BANK})).filter(Boolean).filter(row=>row.slope>5);
    check(rows.length>20,`${name}: only ${rows.length} frames of the authored ride on the bank`);
    if(!rows.length)continue;
    const worst=rows.reduce((far,row)=>row.deck-row.lean>far.deck-far.lean?row:far,rows[0]);
    check(worst.deck-worst.lean<2.5,`${name}: the deck lay ${worst.deck.toFixed(1)} degrees off a ${worst.slope.toFixed(1)} degree bank (frame ${worst.f}, ${worst.phase}, leaning ${worst.lean.toFixed(1)})`);
    results[name]={frames:rows.length,deck:worst.deck,lean:worst.lean,slope:worst.slope};
  }
  for(const {level} of worlds.values())level.dispose();
  if(problems.length){console.log(problems.join('\n'));process.exitCode=1;}
  console.log(`${problems.length?'FAIL':'PASS'} the authored ride lies on the ground it is riding`,JSON.stringify(results,(key,value)=>typeof value==='number'?+value.toFixed(2):value,1));
},{levelEntry:course(false)});
