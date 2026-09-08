import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, player, level, step }) => {
  const decks = [
    ['south',[0,4.4,30],[0,0,1]], ['north',[28,4.4,-122],[0,0,-1]],
    ['east',[51,4.4,-42],[1,0,0]], ['west',[-51,4.4,-42],[-1,0,0]],
    ['south-east',[46,4.4,25],[1,0,1]], ['south-west',[-46,4.4,25],[-1,0,1]],
    ['north-east',[46,4.4,-117],[1,0,-1]], ['north-west',[-46,4.4,-117],[-1,0,-1]],
  ];
  const place = (p,h,speed) => {
    player.respawn(level,true,true,{position:new THREE.Vector3(...p),heading:new THREE.Vector3(...h).normalize()});
    player.axisF.set(...h).normalize();player.axisL.set(player.axisF.z,0,-player.axisF.x);
    player.speed=speed;player.freeSkate=true;
    player.groundHit=player.queryGround(level);
    assert.ok(player.groundHit,'missing actual support');
    player.pos.y=player.groundHit.y;player.prevPos.copy(player.pos);
    player.rideNormal.copy(player.groundHit.normal);
    player.points=1234;
  };
  let cases=0,worstRecovery=0;
  const recover = label => {
    let wipeouts=0;player.onWipeout=()=>wipeouts++;
    player.bail();assert.equal(player.isBailing,true);
    let recovered=false;
    for(let frame=0;frame<360;frame++){
      step(makeInput());
      assert.ok(player.pos.toArray().every(Number.isFinite),`${label}: nonfinite position`);
      assert.ok(player.pos.y>=-.05,`${label}: clipped below the foundation`);
      assert.ok(player.axisF.lengthSq()>.99,`${label}: the bail erased the travel heading`);
      assert.equal(player.totalDeaths,0,`${label}: recovery fell out of the park`);
      if(!player.isBailing){
        assert.equal(player.freeSkate,true,`${label}: recovered without the board`);
        assert.equal(player.boardSnapT,0);assert.equal(player.looseBoard,null);
        assert.equal(player.grounded,true,`${label}: finished recovery without support`);
        assert.equal(player.points,1234,'recovery erased banked points');
        assert.equal(wipeouts,1,'recovery created a second bail');
        assert.ok(player.groundHit?.normal.y>=.27,'stood up on vertical support');
        worstRecovery=Math.max(worstRecovery,(frame+1)/60);recovered=true;break;
      }
    }
    assert.ok(recovered,`${label}: soft locked for six seconds`);
    cases++;
  };
  // A feature tag applies to both the curved transition and its flat deck.
  // Each side/corner must recover at rest and at speed, facing in or out.
  for(const [name,p,h] of decks)for(const speed of [0,26])for(const dir of [-1,1]){
    place(p,h.map(v=>v*dir),speed);
    assert.equal(player.groundHit.vert,true);assert.equal(player.groundHit.normal.y,1);
    recover(`${name}/${speed}/${dir}`);
  }
  // Test immediately on either side of the coping seam, rather than only
  // giving the recovery several metres of uninterrupted flat deck.
  for(const z of [28.101,28.12])for(const dir of [-1,1]){
    place([0,4.4,z],[0,0,dir],20);recover(`lip seam ${z}/${dir}`);
  }
  // A falling bail must transition into the same supported recovery after
  // first contact, including the protected timer reserved during airtime.
  for(const [name,p,h] of decks){
    place(p,h,12);player.pos.y+=3;player.prevPos.copy(player.pos);
    player.state='air';player.grounded=false;player.vVel=-6;
    player.airFromSkate=true;player.airGrav='board';player.airMomentum=true;
    recover(`air to ${name}`);
  }
  // Standable transition faces also need recovery when travelling along
  // the wall: procedural roll-out must not repeatedly cancel its own get-up.
  for(const z of [26.3,27.5])for(const dir of [-1,1]){
    place([0,3,z],[dir,0,0],20);
    assert.ok(player.groundHit.normal.y>.27&&player.groundHit.normal.y<.97);
    recover(`along bank ${z}/${dir}`);
  }
  // Enter a real upper-vert contact through riding, then bail and let the
  // body fall back into the bowl. No fake standing support is inserted.
  place([0,.1,10],[0,0,1],15.3);
  let reached=false;
  for(let frame=0;frame<200;frame++){
    step(makeInput({jumpHeld:true,jumpPressed:frame===0}));
    if(player.grounded&&player.rideNormal.y<.05){reached=true;break;}
  }
  assert.ok(reached);recover('actual upper vert');
  console.log(`PASS Jungle Cup bail recovery: ${cases} deck/corner/seam/air/transition cases, no input, no heading loss/death or repeated bail; automatic remount. Longest recovery ${worstRecovery.toFixed(2)}s.`);
});
