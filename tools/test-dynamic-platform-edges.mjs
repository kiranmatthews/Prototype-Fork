import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ server, THREE, Level, player: p, CONST }) => {
  const { fallAwayPlatform } = await server.ssrLoadModule('/src/surfaceBehavior.ts');
  const { normalizeCustomLevelData } = await server.ssrLoadModule('/src/level.ts');
  const cube = { vertices: [-4,-1,6,4,-1,6,4,0,6,-4,0,6,-4,-1,-6,4,-1,-6,4,0,-6,-4,0,-6],
    indices: [3,2,6,3,6,7,0,4,5,0,5,1,0,1,2,0,2,3,4,7,6,4,6,5,0,3,7,0,7,4,1,5,6,1,6,2] };
  const build = (components) => {
    const data = { v: 1, name: 'Moving edge regression', spawn: [-30,.1,0], killY: -30,
      components: [{ t:'platform',p:[-30,-.5,0],s:[10,1,10],edgeGrinding:false }, ...components,
        { t:'gate',p:[-30,0,-4] }] };
    assert.ok(normalizeCustomLevelData(data));
    return new Level(new THREE.Scene(), { id:'__dynamic_edges',name:data.name,data });
  };
  const owned = (l, mesh) => l.surfaceEdgeRails.filter(r => l.surfaceEdgeOwners.get(r) === mesh);
  const catchRail = (l, rail, fraction=.5) => {
    const at = rail.totalLength * fraction, heading=rail.tangentAt(at),position=rail.pointAt(at);
    position.y+=.15;
    // Reset only the rider fixture; the platform's live clock/switch state
    // must survive, otherwise a respawn would undo the very state under test.
    p.pos.copy(position);p.settle(l,heading);p.pos.copy(position);p.prevPos.copy(position);
    p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.speed=8;p.vVel=0;
    p.step(CONST.fixedStep,makeInput({grindHeld:true,grindPressed:true}),l);
    assert.equal(p.state,'grind');assert.ok(p.grindRail===rail,'caught the selected live platform rim');
  };
  for(const axis of ['x','y','z'])for(const disabled of [false,true]){
    const l=build([{t:'platform',p:[0,-.5,0],s:[8,1,12]},
      {t:'mover',p:[0,0,0],s:[8,1,12],axis,amp:4,speed:1,yaw:37,...(disabled?{edgeGrinding:false}:{})}]);
    try{
      const mesh=l.movers[0].mesh,rails=owned(l,mesh);
      assert.equal(rails.length,disabled?0:4,'a mover must retain its complete rim, including at a dock');
      if(disabled)continue;
      const original=rails.map(r=>r.points.map(v=>v.clone())),base=mesh.position.clone();
      for(let frame=0;frame<100;frame++){
        l.update(.016);const delta=mesh.position.clone().sub(base);
        rails.forEach((r,j)=>r.points.forEach((point,k)=>assert.ok(point.distanceTo(original[j][k].clone().add(delta))<1e-5)));
      }
      catchRail(l,rails.find(r=>r.totalLength>8),axis==='z'?.8:.5);
      for(let frame=0;frame<12;frame++){
        l.update(CONST.fixedStep);p.step(CONST.fixedStep,makeInput({grindHeld:true}),l);
        assert.equal(p.state,'grind');assert.ok(p.grindRail.closest(p.pos).distance<.17);
      }
      l.reset(true);assert.ok(rails.every(r=>r.grindable));
    }finally{l.dispose();}
  }

  const falling=build([fallAwayPlatform([0,0,0],[8,1,20],{shake:.15})]);
  try{
    const c=falling.crumbles[0],rails=owned(falling,c.mesh);
    assert.equal(rails.length,4);catchRail(falling,rails.find(r=>r.totalLength>15));
    for(let f=0;f<30&&c.state!=='fall';f++){
      p.step(CONST.fixedStep,makeInput({grindHeld:true}),falling);falling.update(CONST.fixedStep);
    }
    assert.equal(c.state,'fall','grinding must trigger the ordinary fallaway clock');
    assert.ok(rails.every(r=>!r.grindable));
    p.step(CONST.fixedStep,makeInput({grindHeld:true}),falling);assert.notEqual(p.state,'grind');
    for(let f=0;f<650&&c.state!=='idle';f++)falling.update(CONST.fixedStep);
    assert.equal(c.state,'idle');assert.ok(rails.every(r=>r.grindable));
    catchRail(falling,rails.find(r=>r.totalLength>15));
    assert.equal(fallAwayPlatform([0,0,0],[3,1,8],{edgeGrinding:true}).edgeGrinding,true);
    assert.equal(fallAwayPlatform([0,0,0],[3,1,8],{edgeGrinding:false}).edgeGrinding,false);
  }finally{falling.dispose();}

  const phase=build([{t:'phasepad',p:[0,0,0],s:[8,1,20],cycle:1,amp:.4}]);
  try{
    const pad=phase.phasePads[0],rails=owned(phase,pad.mesh);assert.equal(rails.length,4);
    catchRail(phase,rails.find(r=>r.totalLength>15));
    for(let i=0;i<37;i++)phase.update(CONST.fixedStep);
    assert.equal(pad.on,false);assert.ok(rails.every(r=>!r.grindable));
    p.step(CONST.fixedStep,makeInput({grindHeld:true}),phase);assert.notEqual(p.state,'grind');
    for(let i=0;i<31;i++)phase.update(CONST.fixedStep);
    assert.ok(rails.every(r=>r.grindable));
  }finally{phase.dispose();}

  const outline=build([{t:'mesh',p:[0,0,0],...cube,outline:true,grp:8},
    {t:'crate',p:[-32,0,0],kind:'bang',grp:8}]);
  try{
    const surface=outline.outlinedSurfaces[0],rails=owned(outline,surface.mesh);
    assert.equal(rails.length,4);assert.ok(rails.every(r=>!r.grindable),'ghost geometry cannot be a grind shortcut');
    outline.triggerBang(outline.crates[0]);assert.ok(rails.every(r=>r.grindable));
    catchRail(outline,rails.find(r=>r.totalLength>8));
    outline.reset(true);assert.ok(rails.every(r=>!r.grindable));
  }finally{outline.dispose();}

  const bridge=build([{t:'spinbridge',p:[0,0,0],s:[12,.4,3],yaw:31}]);
  try{
    const b=bridge.spinBridges[0],rails=owned(bridge,b.mesh);
    assert.equal(rails.length,4);assert.ok(rails.every(r=>!r.grindable));
    b.trigger(b.hitBox.clone());bridge.update(.2);assert.ok(rails.every(r=>!r.grindable));
    bridge.update(1);assert.equal(b.deployed,true);assert.ok(rails.every(r=>r.grindable));
    assert.ok(rails.every(r=>r.points.every(point=>Math.abs(point.y-.05)<1e-5)));
    catchRail(bridge,rails.find(r=>r.totalLength>8));bridge.reset(true);assert.ok(rails.every(r=>!r.grindable));
  }finally{bridge.dispose();}
  console.log('PASS moving XYZ rims/catches/opt-outs, fallaway grind-trigger/drop/return, phase visibility, switch ghosts and spin-deployed edges.');
});
