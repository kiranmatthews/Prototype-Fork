// Ordinary device inputs, shared by native physics and the real browser.
export function* runLanternStair(r,c){
 const y=34.5;
 const assert={equal:(a,b)=>{if(a!==b)throw Error(`Expected ${b}, got ${a}`);},ok:(value,message)=>{if(!value)throw Error(message??"Lantern staircase assertion failed");}};
  yield* c.stepFor(25);
  const switchBox=c.crateNamed('Lantern stair: restore the three outlined metal towers');
  const steps=r.l.crates.filter(box=>box.metal&&box.pending&&box.mesh.position.x>512&&box.mesh.position.x<522);
  assert.equal(steps.length,48);
  const bridges=r.l.outlinedSurfaces.filter(s=>s.component.nm.includes('materialising bridge'));
  assert.equal(bridges.length,2);
  yield* c.hit(switchBox,'restore the complete metal staircase');
  assert.ok(steps.every(box=>box.alive&&!box.pending));
  assert.ok(bridges.every(s=>!r.l.groundMeshes.includes(s.mesh)),'stair switch must leave both main bridge circuits untouched');
  yield* c.walk([506.9,y,6],'step around the used metal switch');
  yield* c.walk([511.1,y,6],'pass the switch on the clear courtyard floor');
  yield* c.walk([511.1,y,8],'approach the first restored step');
  for(const [s,h]of [[513,1.92],[516,3.84],[519,5.76]])
    yield* c.hop([s,y+h+.035,8],`jump onto restored tower at ${s}`,{tolerance:.8,heightTolerance:.08});
  yield* c.hop([522.2,y+7.8,8],'reach the upper lantern offering shelf',{tolerance:.8});
  const rewards=r.l.crates.filter(box=>!box.metal&&!box.bang&&box.mesh.position.x>=522&&box.mesh.position.x<=526&&box.box.min.y>42);
  assert.equal(rewards.length,3);
  for(const reward of rewards)if(reward.alive)yield* c.hit(reward,'claim the upper lantern offering');
  yield* c.walk([522.2,y+7.8,8],'return to the shelf lip');
  for(const [s,h]of [[519,5.76],[516,3.84],[513,1.92],[510,0]])
    yield* c.hop([s,y+h+.035,8],`return via supported tower at ${s}`,{tolerance:.8,heightTolerance:.1});
  yield* c.walk([510,y,1.25],'rejoin the main causeway');
  assert.equal(r.p.totalDeaths,0);assert.ok(r.p.grounded&&!r.p.isBailing);
  assert.ok(rewards.every(box=>!box.alive));
  return{deaths:r.p.totalDeaths,frames:r.frame,steps:steps.length,rewards:rewards.length,position:r.p.pos.toArray(),actions:r.report.actions,evidence:r.report.evidence};
 }
