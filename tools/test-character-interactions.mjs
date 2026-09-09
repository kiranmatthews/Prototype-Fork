import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({THREE,server,Level,Player,TUNING})=>{
  const {setMilkVariant}=await server.ssrLoadModule('/src/milk.ts');
  const {CharacterInteractionBounds}=await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const measure=new CharacterInteractionBounds(),out=new THREE.Box3();
  const parent=new THREE.Group(),rider=new THREE.Group();parent.add(rider);
  const body=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());body.position.y=1;rider.add(body);
  const head=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial());head.position.y=2.5;rider.add(head);
  const unused=new THREE.Mesh(new THREE.BoxGeometry(100,100,100),new THREE.MeshBasicMaterial());unused.visible=false;rider.add(unused);
  parent.add(new THREE.Mesh(new THREE.BoxGeometry(500,500,500),new THREE.MeshBasicMaterial()));
  measure.measure(rider,out);assert.equal(out.max.y,3);assert.equal(out.max.x,.5);
  head.scale.set(2,3,2);measure.measure(rider,out);assert.equal(out.max.y,4);assert.equal(out.max.x,1);
  head.scale.setScalar(1);body.scale.y=.5;body.position.y=.5;head.position.y=1.5;measure.measure(rider,out);assert.equal(out.max.y,2);
  head.visible=false;measure.measure(rider,out);assert.equal(out.max.y,1,'hidden head inflated body');
  parent.visible=false;measure.measure(rider,out);assert.equal(out.max.y,1,'presentation blink removed physical silhouette');
  // Current morph weights, not the union of every possible target.
  const morphGeometry=new THREE.BoxGeometry(1,1,1),target=morphGeometry.attributes.position.clone();
  for(let i=0;i<target.count;i++)target.setXYZ(i,target.getX(i)*4,target.getY(i),target.getZ(i));
  morphGeometry.morphAttributes.position=[target];
  const morph=new THREE.Mesh(morphGeometry,new THREE.MeshBasicMaterial());const morphRoot=new THREE.Group();morphRoot.add(morph);
  measure.measure(morphRoot,out);assert.equal(out.max.x,.5);
  morph.morphTargetInfluences[0]=1;measure.measure(morphRoot,out);assert.equal(out.max.x,2);
  morph.morphTargetInfluences[0]=0;measure.measure(morphRoot,out);assert.equal(out.max.x,.5);
  // Skinning must be refreshed even in a physics-only step without a render.
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Array(12).fill(0),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const skin=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial()),bone=new THREE.Bone();skin.add(bone);skin.bind(new THREE.Skeleton([bone]));
  const skinRoot=new THREE.Group();skinRoot.add(skin);measure.measure(skinRoot,out);assert.equal(out.max.y,1);
  bone.position.y=2;measure.measure(skinRoot,out);assert.equal(out.max.y,3);

  const scene=new THREE.Scene(),level=new Level(scene,{id:'interaction-test',name:'Interaction test',data:{v:1,name:'Interaction test',spawn:[0,.02,0],killY:-20,groups:[],components:[
    {t:'platform',p:[0,-.5,0],s:[40,1,40]},
    {t:'crate',p:[10,10,10],kind:'wood'},{t:'crate',p:[14,10,10],kind:'wood'},
    {t:'gate',p:[0,0,-18]},
  ]}});
  const p=new Player(scene);p.respawn(level,true);p.rawInput=makeInput();p.prepareStartPresentation(level);
  const initial={...p.characterProportionDiagnostics.settings},initialStyle=p.characterHeadStyle,initialMagnet=TUNING.milkMagnetRange;
  const box=()=>{p.refreshCharacterBounds();return p.characterBounds.clone();};
  try{
    p.setCharacterHeadStyle('skull');p.setCharacterProportions({height:1,headSize:1,headWidth:1,headDepth:1});p.prepareStartPresentation(level);
    const small=box(),headSmall=new THREE.Box3();measure.measure(p.headM,headSmall);
    p.setCharacterProportions({height:1.4,headSize:2.4,headWidth:1.5,headDepth:1.5});p.prepareStartPresentation(level);
    const large=box();assert.ok(large.max.y>small.max.y+.3,'height/head sliders did not reach interaction bounds');
    const headLarge=new THREE.Box3();measure.measure(p.headM,headLarge);
    assert.ok(headLarge.getSize(new THREE.Vector3()).x>headSmall.getSize(new THREE.Vector3()).x,'head width did not update');
    assert.ok(large.containsBox(headLarge),'collection bounds excluded the enlarged head');
    const moveCrate=(crate,center)=>{const delta=center.clone().sub(crate.box.getCenter(new THREE.Vector3()));crate.box.translate(delta);crate.mesh.position.add(delta);};
    const center=large.getCenter(new THREE.Vector3());
    moveCrate(level.crates[0],new THREE.Vector3(center.x,large.max.y+.48-.04,center.z));
    moveCrate(level.crates[1],new THREE.Vector3(center.x,large.max.y+.48+.15,center.z));
    p.spinTimer=1;p.collide(level);
    assert.equal(level.crates[0].alive,false,'spin ignored contact at the current crown');
    assert.equal(level.crates[1].alive,true,'spin smashed outside the current character');
    p.spinTimer=0;
    for(const f of p.fruits)p.retireFruit(f);
    p.setCharacterProportions(initial);p.prepareStartPresentation(level);
    const p2=new Player(scene);p2.respawn(level,true);p2.rawInput=makeInput();p2.prepareStartPresentation(level);
    const actor=box(),near=actor.getCenter(new THREE.Vector3());near.x=actor.max.x+1.2;
    level.pickup(near.x,near.y,near.z);const pickup=level.pickups.at(-1);
    setMilkVariant(pickup.mesh,4);
    scene.updateMatrixWorld(true);TUNING.milkMagnetRange=.5;p.updateFruit(1/60,level);
    assert.equal(pickup.magnetOwner,undefined,'milk outside the live radius was attracted');
    TUNING.milkMagnetRange=1.75;p.updateFruit(1/60,level);
    const attracted=p.fruits.find(f=>f.phase==='magnet');assert.ok(attracted,'near fruit did not enter world magnet phase');
    assert.equal(attracted.mesh.userData.milkVariant,4,'magnet changed the source milk shape');
    assert.equal(attracted.mesh.parent,scene);assert.equal(p.fruit,0);assert.equal(pickup.alive,true);
    assert.equal(pickup.magnetOwner,p);assert.equal(pickup.mesh.visible,false);
    assert.equal(p.bankFlyingFruit(),0,'uncollected magnet was banked as a HUD flight');
    // A second player cannot claim the same visible-world pickup twice.
    p2.updateFruit(1/60,level);assert.equal(p2.fruits.filter(f=>f.phase==='magnet'||f.phase==='fly').length,0);
    let frames=0;
    while(attracted.phase==='magnet'&&frames++<120){p.pos.z+=.02;p.updateFruit(1/60,level);}
    assert.equal(attracted.phase,'fly','magnet failed to catch the moving character');
    assert.equal(pickup.alive,false);assert.equal(pickup.magnetOwner,undefined);
    assert.equal(p.fruit,0,'counter skipped its existing HUD arrival animation');
    assert.equal(attracted.mesh.parent,p.fruitLayer);
    assert.equal(attracted.mesh.userData.milkVariant,4,'HUD handoff changed the milk shape');
    for(let i=0;i<180;i++)p.updateFruit(1/60,level);
    assert.equal(p.fruit,1);assert.equal(p.fruitCollectionRevision,1);assert.equal(p2.fruit,0);
    assert.equal(p.bankFlyingFruit(),0,'HUD arrival could be banked twice');
    // Crate fruit belongs to the world, even when the other player smashed
    // its crate. Only the player who claims it gets the HUD flight/reward.
    p2.spawnFruit(new THREE.Box3().setFromCenterAndSize(near,new THREE.Vector3(.2,.2,.2)),1);
    const shared=p2.fruits.find(f=>f.phase==='idle');assert.ok(shared);
    p.updateFruit(1/60,level);assert.ok(p.fruits.includes(shared));
    assert.equal(p2.fruits.includes(shared),false);assert.equal(shared.phase,'magnet');
    for(let i=0;i<180;i++){p.updateFruit(1/60,level);p2.updateFruit(1/60,level);}
    assert.equal(p.fruit,2);assert.equal(p2.fruit,0);
    const earned=p.fruit;
    // Death releases a native reservation without awarding or losing it.
    const next=box().getCenter(new THREE.Vector3());next.x=p.characterBounds.max.x+1.2;
    level.pickup(next.x,next.y,next.z);const waiting=level.pickups.at(-1);scene.updateMatrixWorld(true);
    p.updateFruit(1/60,level);assert.equal(waiting.magnetOwner,p);
    p.state='dead';p.updateFruit(1/60,level);
    assert.equal(waiting.alive,true);assert.equal(waiting.magnetOwner,undefined);assert.equal(waiting.mesh.visible,true);assert.equal(p.fruit,earned);
    // A spin attracts crate fruit instead of discarding the reward. An
    // interrupted attraction remains unearned world fruit in a snapshot.
    p.state='ride';waiting.alive=false;waiting.mesh.visible=false;p.spinTimer=1;
    p.spawnFruit(new THREE.Box3().setFromCenterAndSize(next,new THREE.Vector3(.2,.2,.2)),1);
    p.updateFruit(1/60,level);const loose=p.fruits.find(f=>f.phase==='magnet');assert.ok(loose);
    const snapshot=p.captureIdleFruit();assert.equal(snapshot.length,1);assert.equal(snapshot[0].hop,0);
    assert.deepEqual(snapshot[0].home,snapshot[0].position);assert.equal(p.bankFlyingFruit(),0);
    p.state='dead';p.updateFruit(1/60,level);assert.equal(loose.phase,'idle');assert.equal(p.fruit,earned);
    p.state='ride';p.ttActive=true;level.setTimeTrial(true);p.updateFruit(1/60,level);
    assert.equal(p.fruits.some(f=>f.phase==='idle'||f.phase==='magnet'),false,'run mode left world fruit collectable');
    p.ttActive=false;level.setTimeTrial(false);
    // Turning P2 off releases reservations and hands over uncollected clumps.
    waiting.alive=true;waiting.mesh.visible=true;
    p2.updateFruit(1/60,level);assert.equal(waiting.magnetOwner,p2);
    p2.spawnFruit(new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(8,1,8),new THREE.Vector3(.2,.2,.2)),1);
    const before=p.captureIdleFruit().length;p2.handoffWorldFruit(p);
    assert.equal(waiting.magnetOwner,undefined);assert.equal(waiting.alive,true);
    assert.equal(p.captureIdleFruit().length,before+1);assert.equal(p2.captureIdleFruit().length,0);
    // Zero disables proximity attraction but keeps direct contact with a
    // peer's world drop, even when its centre lies just outside the body.
    TUNING.milkMagnetRange=0;
    const contact=box().getCenter(new THREE.Vector3());contact.x=box().max.x+.2;
    p2.spawnFruit(new THREE.Box3().setFromCenterAndSize(contact,new THREE.Vector3(.2,.2,.2)),1);
    const touch=p2.fruits.find(f=>f.phase==='idle');touch.mesh.position.copy(contact);touch.home.copy(contact);touch.hop=0;
    p.updateFruit(1/60,level);
    assert.equal(touch.phase,'fly','zero magnet range blocked direct peer-drop contact');
    assert.ok(p.fruits.includes(touch));assert.equal(p2.fruits.includes(touch),false);
    console.log(`PASS live head/height/pose/morph/skin bounds; crown-only box smash; world magnet -> contact -> HUD; moving target, spin, death, snapshots, run modes and two-player ownership (${frames} magnet frames).`);
  }finally{TUNING.milkMagnetRange=initialMagnet;p.setCharacterHeadStyle(initialStyle);p.setCharacterProportions(initial);level.dispose();}
});
