import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const bank=async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))));
const [skate,jak]=await Promise.all([bank('skate'),bank('jak')]);
await withSkateRuntime(async({server,scene,level,Player,THREE,CONST})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {RigBinding,createPlayerStarterAnimationSuite}=await server.ssrLoadModule('/src/animation/index.ts');
  const {createJakDirectSuite,JAK_DIRECT_PHYSICS}=await server.ssrLoadModule('/tools/jak-direct-motion.ts');
  const players=[new Player(scene),new Player(scene)], [p,old]=players;
  const base=players.map(p=>{
    const rig=RigBinding.fromSculptRuntime(p.animationRig.root).definition;
    return createPlayerStarterAnimationSuite(rig);
  });
  const direct=createJakDirectSuite(base[0],RigBinding.fromSculptRuntime(p.animationRig.root).definition,jak);
  const runtimes=players.map((p,i)=>createCharacterAnimationRuntime(p,base[i]));
  const pose=p=>[p.bodyGroup,p.riderG,...p.animationRig.joints.map(j=>j.node)]
    .flatMap(n=>[...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]);
  let frames=0,cases=0,checkedAir=0,checkedRoll=0;
  for(const continuousTransitions of [false,true])for(const useD of [false,true]){
    const motion=new PlayableSkateMotion(p,skate,{continuousTransitions});
    motion.setActive(false);
    players.forEach((player,i)=>{
      player.onFootJumpStudy=i===0&&useD?{...JAK_DIRECT_PHYSICS,flip:true}:null;
      runtimes[i].setDocument(i===0&&useD?direct:base[i]);
      player.enterLevel('skate-abandon');player.respawn(level,true,true);runtimes[i].restart();
      player.freeSkate=true;player.speed=18;player.lastPlanar=18;
      player.grounded=true;player.state='ride';player.groundHit=player.queryGround(level);
    });
    motion.setActive(true);
    let held=false,hadAbandon=false,hadInversion=false,hadRoll=false;
    const step=(jumpHeld=false,moveY=0)=>{
      const input=makeInput({moveY,jumpHeld,jumpPressed:jumpHeld&&!held,jumpReleased:!jumpHeld&&held});held=jumpHeld;
      for(const player of players){player.step(1/60,input,level);player.commitRenderStep(level);}
      level.update(1/60);frames++;
      assert.ok(p.pos.distanceTo(old.pos)<1e-9,'presentation changed the trajectory');
      for(const key of ['state','grounded','speed','vVel','freeSkate','airFromSkate','rollLandingT'])
        assert.equal(p[key],old[key],`${key} differs at ${frames}`);
      if(p.emergencyEjectLandingPending||p.rollLandingT>=0){
        hadAbandon=true;
        const rolling=p.rollLandingT>=0;
        // The final roll intentionally recovers into the selected run cycle.
        // Its flip and planted contact phase must still be the original action.
        if(!rolling||p.rollLandingT/p.rollLandingDuration<.6){
          const a=pose(p),b=pose(old);
          a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,
            `${useD?'D':'native'} ${continuousTransitions?'fluid':'baseline'} abandon pose ${i} differs at ${frames}: ${v} vs ${b[i]}`));
          rolling?checkedRoll++:checkedAir++;
        }
        assert.equal(motion.boardScribble.active,false,'abandon played mount/dismount ink');
        assert.equal(motion.retarget.board.visible,false,'carried board survived abandonment');
        assert.ok(p.looseBoard,'abandon lost its independently flying board');
        assert.ok(p.looseBoard.root.visible||p.looseBoard.broken,'loose deck vanished without a physical break');
        const up=new THREE.Vector3(0,1,0).applyQuaternion(p.bodyGroup.quaternion);
        if(up.y<-.9)hadInversion=true;
        if(rolling)hadRoll=true;
      }
    };
    // Start on the board; both actual press/release edges go through native controls.
    for(let i=0;i<30;i++)step();
    for(let i=0;i<12;i++)step(true);
    step();assert.equal(p.boardOllieAir,true);
    for(let i=0;i<4;i++)step();
    for(let i=0;i<3;i++)step(true);
    step();assert.equal(p.emergencyEjectLandingPending,true);
    for(let i=0;i<180;i++)step();
    assert.ok(hadAbandon&&hadInversion&&hadRoll,'abandon must complete a somersault and supported landing roll');
    assert.equal(p.rollLandingT,-1);assert.equal(p.freeSkate,false);
    assert.equal(motion.boardScribble.appearances,0);assert.equal(motion.boardScribble.disappearances,0);
    assert.equal(p.flipTimer,0);assert.equal(p.emergencyEjectLandingPending,false);
    // A later deliberate mount must still work and own exactly one appearance.
    for(let i=0;i<120;i++)step(true,1);
    assert.equal(p.freeSkate,true);assert.equal(motion.boardScribble.appearances,1);
    motion.dispose();cases++;
  }
  runtimes.forEach(r=>r.dispose());
  console.log(JSON.stringify({cases,frames,checkedAir,checkedRoll,flipDuration:CONST.flipDuration}));
},{levelEntry:{id:'skate-abandon',name:'Skate abandon',data:{v:1,name:'Skate abandon',spawn:[0,.03,6],killY:-20,
  components:[{t:'platform',p:[0,-.5,-100],s:[1000,1,1000],edgeGrinding:false},{t:'gate',p:[0,0,-400]}]}}});
