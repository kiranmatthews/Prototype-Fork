import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,player:p,level:l,step})=>{
  const {JUNGLE_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  assert.ok(parseCustomLevelJson(JSON.stringify(data)),'complete festival survives the editor contract');
  let triangles=0;
  for(const c of data.components.filter(c=>c.t==='mesh'))for(let i=0;i<c.indices.length;i+=3){
    const a=new THREE.Vector3().fromArray(c.vertices,c.indices[i]*3),b=new THREE.Vector3().fromArray(c.vertices,c.indices[i+1]*3),d=new THREE.Vector3().fromArray(c.vertices,c.indices[i+2]*3);
    assert.ok(b.sub(a).cross(d.sub(a)).lengthSq()>1e-12,`${c.nm}: degenerate triangle`);triangles++;
  }
  assert.equal(l.loopMeshes.length,1);assert.equal(l.motuBeachDiagnostics.graphics,4);
  assert.equal(data.components.filter(c=>c.gravityTrack).length,2);
  assert.ok(data.components.some(c=>c.nm==='Motu / coral wave wall'&&c.arcSteps===48));
  for(const key of ['lagoon','vert','loop','street'])assert.ok(!data.components.some(c=>c.nm===`Motu / graphic sign / ${key}`),'individual obstacle labels are removed');
  assert.ok(data.components.some(c=>c.nm==='Motu / sponsor boards and pasted stickers'),'sponsors remain');
  const closures=data.components.filter(c=>c.nm?.startsWith('Motu / closed ramp end / '));
  assert.equal(closures.length,8,'both ends of the four open transitions are closed');
  let fittedPoints=0,sideContacts=0;
  const {MeshSideCollisions}=await server.ssrLoadModule('/src/meshSideCollisions.ts');
  for(const c of closures){
    const sourceName=c.nm.slice('Motu / closed ramp end / '.length).replace(/ \/ [12]$/,''),sourceIndex=data.components.findIndex(c=>c.nm===sourceName);
    const source=l.groundMeshes.find(m=>m.userData.editorIdx===sourceIndex&&m.userData.vertRampMesh);
    assert.ok(source,sourceName);
    const positions=source.geometry.getAttribute('position'),surface=[];
    for(let i=0;i<positions.count;i++)surface.push(new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(source.matrixWorld));
    const mesh=l.groundMeshes.find(m=>m.userData.editorIdx===data.components.indexOf(c)),sides=new MeshSideCollisions();
    assert.ok(mesh&&mesh.userData.solidSides);sides.add(mesh,()=>true);
    const beforeContacts=sideContacts;
    for(let i=0;i<c.vertices.length;i+=12){
      const a=new THREE.Vector3().fromArray(c.vertices,i),b=new THREE.Vector3().fromArray(c.vertices,i+3);
      for(const point of [a,b]){assert.ok(surface.some(v=>v.distanceTo(point)<.0001),`${c.nm}: cap fits the native surface`);fittedPoints++;}
      if(Math.min(a.y,b.y)<.36)continue;
      const point=a.clone().add(b).multiplyScalar(.5);point.y=.015;
      const normal=b.clone().sub(a);normal.set(-normal.z,0,normal.x).normalize();
      for(const sign of [-1,1]){
        const from=point.clone().addScaledVector(normal,sign*.9),to=point.clone().addScaledVector(normal,-sign*.9),contact=new THREE.Vector3();
        assert.ok(sides.resolve(from,to,{x:.2,y:.3,z:.2},contact),`${c.nm}: swept side contact`);sideContacts++;
      }
    }
    assert.ok(sideContacts>beforeContacts,`${c.nm}: end has blocking construction`);
    sides.dispose();
  }
  // Every indexed ribbon edge belongs to two faces, including the apron cap.
  for(const c of data.components.filter(c=>c.gravityTrack)){
    const edges=new Map();
    for(let i=0;i<c.indices.length;i+=3)for(const [a,b]of [[0,1],[1,2],[2,0]]){
      const ids=[c.indices[i+a],c.indices[i+b]].sort((a,b)=>a-b),key=ids.join(':');edges.set(key,(edges.get(key)??0)+1);
    }
    assert.ok([...edges.values()].every(n=>n===2),`${c.nm}: watertight body`);
    for(let i=0;i<c.vertices.length/3;i++)if(i%4>=2)assert.equal(c.vertices[i*3+1],-.06);
  }
  const {MOTU_LOOP}=await server.ssrLoadModule('/src/levels/motu-festival.ts');
  const supports=data.components.filter(c=>c.nm?.startsWith('Motu / loop exterior '));
  assert.equal(supports.length,8,'four exterior uprights and four braces');
  assert.equal(data.components.filter(c=>c.nm==='Motu / loop buttress footing').length,8);
  let braceContacts=0;
  for(const c of supports){
    const points=c.vertices?Array.from({length:c.vertices.length/3},(_,i)=>c.vertices.slice(i*3,i*3+3)):
      [-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[c.p[0]+x*c.s[0]/2,c.p[1]+y*c.s[1]/2,c.p[2]+z*c.s[2]/2])));
    assert.ok(points.every(v=>Math.hypot(v[1]-MOTU_LOOP.radius,v[2]-MOTU_LOOP.entry[2])>MOTU_LOOP.radius+.3),`${c.nm}: outside the loop opening`);
    if(c.t!=='mesh')continue;
    const mesh=l.groundMeshes.find(m=>m.userData.editorIdx===data.components.indexOf(c));
    assert.ok(mesh?.userData.solidSides,`${c.nm}: visible brace has native contact`);
    const sides=new MeshSideCollisions();sides.add(mesh,()=>true);
    const center=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());center.y-=.15;
    for(const sign of [-1,1]){
      const from=center.clone().add(new THREE.Vector3(sign*1.2,0,0)),to=center.clone().add(new THREE.Vector3(-sign*1.2,0,0));
      assert.ok(sides.resolve(from,to,{x:.2,y:.3,z:.2},new THREE.Vector3()),`${c.nm}: side sweep`);braceContacts++;
    }
    sides.dispose();
  }
  const place=(point,heading,speed=0)=>{
    p.respawn(l,true,true,{position:new THREE.Vector3(...point),heading:new THREE.Vector3(...heading)});
    p.freeSkate=true;p.speed=speed;p.axisF.set(...heading);p.axisL.set(p.axisF.z,0,-p.axisF.x);
  };
  const safe=name=>{assert.ok(!p.isBailing,`${name}: bail`);assert.ok(p.pos.y>=-.05&&p.pos.toArray().every(Number.isFinite),`${name}: lost floor`);assert.equal(p.totalDeaths,0);};
  // Start at rest: no artificial entry velocity or movement tuning changes.
  place([-59,6.4,25],[0,0,-1]);let entered=false,maxY=0,maxSpeed=0,loopFrames=0;
  for(;loopFrames<900;loopFrames++){
    step(makeInput({moveY:1,jumpHeld:true,jumpPressed:loopFrames===0}));safe('gravity approach and loop');
    entered ||= !!p.loopRide;maxY=Math.max(maxY,p.pos.y);maxSpeed=Math.max(maxSpeed,p.speed);
    if(p.completedLoops.size)break;
  }
  assert.ok(entered&&p.completedLoops.size===1,'approach must complete the full loop');
  assert.ok(maxY>8.35&&Math.abs(p.pos.x+50)<2&&Math.abs(p.pos.y)<.1,'crown and separated exit');
  const loop={frames:loopFrames+1,maxY,maxSpeed,exit:p.pos.toArray()};
  // Controller-style steering climbs the curved timber return to the summit.
  place([-42,.1,-7],[0,0,1],6);const targets=[[-42,4],[-43,19],[-49,27],[-58,27]];
  let target=0,walkMaxY=0,walkFrames=0;
  for(;walkFrames<1200&&target<targets.length;walkFrames++){
    const [x,z]=targets[target],dx=x-p.pos.x,dz=z-p.pos.z;
    // Competition controls steer relative to the board, unlike the campaign
    // camera-relative stick. Charge uphill and use the ordinary brake in bends.
    const angle=Math.atan2(dx,dz)-Math.atan2(p.axisF.x,p.axisF.z),delta=Math.atan2(Math.sin(angle),Math.cos(angle));
    step(makeInput({moveX:Math.max(-1,Math.min(1,-delta*2)),moveY:1,jumpHeld:true,jumpPressed:walkFrames===0,grabHeld:p.speed>12.5}));
    safe('boardwalk ascent');walkMaxY=Math.max(walkMaxY,p.pos.y);
    if(Math.hypot(x-p.pos.x,z-p.pos.z)<2.1)target++;
  }
  assert.equal(target,targets.length,`curved boardwalk reaches the loop summit: position ${p.pos.toArray()}, speed ${p.speed}, ground ${p.surfaceName}`);assert.ok(walkMaxY>6.2);
  // The horseshoe wall works from its open mouth without an invisible end cap.
  place([0,.1,-138],[0,0,-1],19);let air=false,land=false,released=false,waveMaxY=0;
  for(let i=0;i<450;i++){
    const release=!released&&p.grounded&&p.rideNormal.y<.42;if(release)released=true;
    step(makeInput({jumpHeld:!released,jumpPressed:i===0,jumpReleased:release}));safe('coral wave');
    air ||= p.vertAir||p.state==='air';waveMaxY=Math.max(waveMaxY,p.pos.y);
    if(air&&p.grounded){land=true;break;}
  }
  assert.ok(air&&land,'coral wave returns to supported ground');
  const report={passed:true,triangles,graphics:4,closedRampEnds:closures.length,fittedPoints,sideContacts,watertightRaisedRamps:2,exteriorSupports:supports.length,braceContacts,
    loop,boardwalk:{frames:walkFrames,maxY:walkMaxY,targets},wave:{air,land,maxY:waveMaxY},movementChanged:false};
  await writeFile(process.env.MOTU_FESTIVAL_REPORT??'/private/tmp/motu-festival-native.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
});
