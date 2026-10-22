import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, Level, Player, scene, CONST, TUNING }) => {
  const m=await server.ssrLoadModule('/src/levels/school-miami.ts');
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  const data=m.SCHOOL_MIAMI_LEVEL,originalTuning=JSON.stringify(TUNING);
  const level=new Level(scene,{id:'school-miami',name:data.name,data});scene.updateMatrixWorld(true);
  const p=new Player(scene);p.endlessDeaths=true;p.rawInput=makeInput();
  const ray=new THREE.Raycaster(),report={components:data.components.length,rails:level.rails.length,support:[],rides:[],airs:[],grinds:[],circuits:[]};
  const support=(x,z,from=30)=>{ray.set(new THREE.Vector3(x,from,z),new THREE.Vector3(0,-1,0));ray.far=60;return ray.intersectObjects(level.groundMeshes,false)[0];};
  const near=(label,x,z,y,from=30)=>{const hit=support(x,z,from);assert.ok(hit&&Math.abs(hit.point.y-y)<.06,`${label}: expected ${y}, got ${hit?.point.y}`);report.support.push({label,y:hit.point.y});};
  const place=(position,heading,speed=12)=>{
    p.rawInput=makeInput();p.respawn(level,true,true,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading).normalize()});
    p.axisF.set(...heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
    p.groundHit=p.queryGround(level);assert.ok(p.groundHit,`No support at ${position}`);p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
  };
  const step=(input)=>{const n=Math.max(1,Math.hypot(input.moveX,input.moveY));input.moveX=Math.round(input.moveX/n*100)/100;input.moveY=Math.round(input.moveY/n*100)/100;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();};
  try {
    assert.ok(parseCustomLevelJson(JSON.stringify(data)),'source must survive editor validation');
    assert.equal(data.skatepark,true);assert.equal(m.SCHOOL_TABLES.length,5);assert.equal(m.SCHOOL_POOLS.length,2);assert.equal(m.SCHOOL_PLANTERS.length,8);
    near('start canopy',.5,0,3.4);near('upper court',8,11,0);near('gym floor under roof',48.5,31.75,0,4);
    near('gym roof',61,36,7);near('gym north doorway',31,14.6,0,3.8);
    near('separate bonus roof',63,7.5,7);near('west-descent wedge',m.SCHOOL_WEST_WEDGE.p[0],m.SCHOOL_WEST_WEDGE.p[2],-3.85);
    for(const b of m.SCHOOL_POOLS)near(b.name,b.centre[0],b.centre[2],b.bottom);
    for(const [i,b] of m.SCHOOL_BRIDGES.entries())near(`footbridge ${i+1}`,b.p[0],b.p[2],-4.58);
    // Terrain sampling checks the actual collision triangles, including the
    // deep basin centres and the real clearance underneath the footbridges.
    for(const [i,b] of m.SCHOOL_BRIDGES.entries())near(`under bridge ${i+1}`,b.p[0],b.p[2],-6.5,-5.2);
    for(const [i,q] of m.SCHOOL_CHECKPOINTS.entries())near(`checkpoint ${i+1}`,q[0],q[2],q[1],q[1]+1.8);
    // Use the native spawn with no placement/facing override. Camera nodes
    // alone do not set a skatepark's initial heading.
    p.respawn(level,true);assert.ok(p.axisF.x>.99,'native spawn must face along the blue canopy');
    for(let i=0;i<90;i++){step(makeInput({moveY:1}));assert.ok(!p.isBailing,'native canopy start bailed');}
    assert.ok(p.pos.x>9&&Math.abs(p.pos.z)<.1&&Math.abs(p.pos.y-3.4)<.06,'native start left the canopy');
    report.rides.push({label:'native spawn along starting canopy',frames:90,bails:0,end:p.pos.toArray()});
    const steer=(target)=>{
      const angle=Math.atan2(target[0]-p.pos.x,-(target[2]-p.pos.z)),heading=Math.atan2(p.axisF.x,-p.axisF.z);
      const delta=Math.atan2(Math.sin(angle-heading),Math.cos(angle-heading));return Math.max(-1,Math.min(1,delta*3));
    };
    const ride=(label,points,{speed=12,charge=true,fullTurn=false,arrival=3,brake=()=>false}={})=>{
      const a=points[0],b=points[1];place([a[0],a[1]+.08,a[2]],[b[0]-a[0],0,b[2]-a[2]],speed);
      let index=1,frames=0,maxStep=0,minSpeed=100,bails=0,lastBail=false;
      for(;frames<1200;frames++){
        while(index<points.length-1&&Math.hypot(p.pos.x-points[index][0],p.pos.z-points[index][2])<arrival)index++;
        const target=points[index],before=p.pos.clone();
        const turn=steer(target);
        step(makeInput({moveX:turn,moveY:fullTurn?Math.sqrt(1-turn*turn):1,jumpHeld:charge,jumpPressed:frames===0&&charge,grabHeld:brake()}));
        maxStep=Math.max(maxStep,before.distanceTo(p.pos));minSpeed=Math.min(minSpeed,p.speed);
        if(p.isBailing&&!lastBail){bails++;console.log('BAIL',label,p.pos.toArray(),index);}lastBail=p.isBailing;
        assert.ok(p.pos.toArray().every(Number.isFinite),`${label}: non-finite`);
        if(index===points.length-1&&Math.hypot(p.pos.x-target[0],p.pos.z-target[2])<2.2)break;
      }
      const r={label,frames,bails,maxStep,minSpeed,end:p.pos.toArray(),target:points.at(-1)};report.rides.push(r);
      console.log(JSON.stringify(r));assert.ok(frames<1200,`${label}: did not arrive`);assert.equal(bails,0,`${label}: interrupted by collision`);
    };
    ride('canopy drop to upper court',[...m.SCHOOL_START_CANOPY.slice(1,4),[30,0,11]],{speed:8,charge:false});
    const st=m.SCHOOL_STAIRS;
    ride('handicap downhill',[[st.a[0]+2,0,-4],[st.a[0]+2,0,-8],[41,-2,-22],[39,-5,-36],[37,-5,-39]],{speed:12,charge:false});
    ride('gym doorway and court',[[31,0,9],[31,0,19],[38,0,25],[48.5,0,32],[48.5,0,42]],{speed:8,charge:false});
    ride('gym service-hill ascent',m.SCHOOL_ROOF_ACCESS.filter((_,i,a)=>i%7===0||i===a.length-1),{speed:18,fullTurn:true,arrival:2,brake:()=>p.pos.z<39&&p.speed>12});
    ride('west descent to pools',m.SCHOOL_WEST_DESCENT,{speed:10,charge:false});
    ride('Huge Rail halfpipe corridor',m.SCHOOL_LONG_HALFPIPE,{speed:12,charge:false,fullTurn:true});
    // Footbridges are crossed at street speed, in either direction. These
    // tests include their actual ground joins rather than starting on top.
    const ditch=m.SCHOOL_DITCH,dl=Math.hypot(ditch.b[0]-ditch.a[0],ditch.b[2]-ditch.a[2]),nx=(ditch.b[2]-ditch.a[2])/dl,nz=-(ditch.b[0]-ditch.a[0])/dl;
    for(const [i,b] of m.SCHOOL_BRIDGES.entries())for(const sign of [-1,1]){
      const at=u=>[b.p[0]+nx*u*sign,-5,b.p[2]+nz*u*sign];
      ride(`footbridge ${i+1}/${sign}`,[at(-b.halfSpan-2),at(0),at(b.halfSpan+2)],{speed:12,charge:false});
    }
    // Two facing wedges must accept a normal charged ollie in both
    // directions, and give a clean supported landing after the gap.
    for(const dir of [-1,1]){
      const k=m.SCHOOL_KICKER,h=k.direction.map(v=>v*dir),run=k.gap/2+k.run+7;
      place([k.x-h[0]*run,-4.9,k.z-h[2]*run],h,18);
      let popped=false,air=false,landed=false,bails=0,maxY=-5;
      for(let i=0;i<180;i++){
        const distance=(k.x-p.pos.x)*h[0]+(k.z-p.pos.z)*h[2],release=!popped&&distance<k.gap/2+.9;if(release)popped=true;
        step(makeInput({jumpHeld:!popped,jumpPressed:i===0,jumpReleased:release}));
        air||=p.state==='air';maxY=Math.max(maxY,p.pos.y);if(p.isBailing)bails++;
        if(air&&p.grounded&&(p.pos.x-k.x)*h[0]+(p.pos.z-k.z)*h[2]>k.gap/2){landed=true;break;}
      }
      const r={name:'Kicker Gap',dir,air,landed,maxY,bails,end:p.pos.toArray()};report.airs.push(r);console.log(JSON.stringify(r));
      assert.ok(air&&landed,`Kicker Gap/${dir}: no clean arrival`);assert.equal(bails,0);
    }
    // Each swimming pool must support an unassisted real vert air and return.
    for(const pool of m.SCHOOL_POOLS)for(const dir of [-1,1]){
      place([pool.centre[0],pool.bottom+.08,pool.centre[2]],[dir,0,0],16);
      let air=false,landed=false,maxY=p.pos.y,bails=0;
      for(let i=0;i<300;i++){
        step(makeInput({jumpHeld:true,jumpPressed:i===0}));maxY=Math.max(maxY,p.pos.y);if(p.isBailing)bails++;
        if(p.vertAir)air=true;if(air&&p.grounded){landed=true;break;}
      }
      const r={name:pool.name,dir,air,landed,maxY,bails,end:p.pos.toArray()};report.airs.push(r);console.log(JSON.stringify(r));
      assert.ok(air&&landed,`${pool.name}/${dir}: no returned vert air`);assert.equal(bails,0);
    }
    // The rooftop kicker must clear the air conditioner, then land beyond
    // its west face. This exercises the actual solid box, not a gap marker.
    place([70,7.08,27.5],[-1,0,0],18);
    let acAir=false,acLanded=false,acPopped=false,acBails=0;
    for(let i=0;i<240;i++){
      const release=!acPopped&&p.pos.x<61;if(release)acPopped=true;
      step(makeInput({jumpHeld:!acPopped,jumpPressed:i===0,jumpReleased:release}));
      acAir||=p.state==='air';if(p.isBailing)acBails++;
      if(acAir&&p.grounded&&p.pos.x<49.7){acLanded=true;break;}
    }
    report.airs.push({name:'Over the Air Conditioner',air:acAir,landed:acLanded,bails:acBails,end:p.pos.toArray()});
    assert.ok(acLanded,'AC roof jump did not reach the far side');assert.equal(acBails,0,'AC roof collision');
    // Forward held through a charged native vert air exits the gym coping
    // and reaches the distinct bonus roof. No launch impulse is injected.
    for(const speed of [16,18]){
      place([63,7.1,23],[0,0,-1],speed);let air=false,landed=false,frames=0,maxY=7;
      for(;frames<180;frames++){
        step(makeInput({moveY:1,jumpHeld:true,jumpPressed:frames===0}));air||=p.state==='air';maxY=Math.max(maxY,p.pos.y);
        assert.ok(!p.isBailing,'Roof 2 Roof transfer bailed');
        if(air&&p.grounded&&p.pos.z<m.SCHOOL_BONUS_ROOF.maxZ){
          assert.ok(p.pos.z>1&&Math.abs(p.pos.y-7)<.06,'roof transfer landed outside the bonus roof');landed=true;break;
        }
      }
      assert.ok(landed,'Roof 2 Roof did not reach the separate roof');
      report.airs.push({name:'Roof 2 Roof',speed,air,landed,frames,maxY,bails:0,end:p.pos.toArray()});
    }
    // Start on the ditch bed between bridges 2 and 3, ride the launch
    // wedge, clear the entire third bridge, then roll onto the yard.
    for(const speed of [12,18]){
      const k=m.SCHOOL_DITCH_KICKER,h=k.direction,b=m.SCHOOL_BRIDGES[2];
      place([k.p[0]-h[0]*3.8,-6.4,k.p[2]-h[2]*3.8],h,speed);
      assert.ok(Math.abs(p.pos.y+6.5)<.06,'ditch approach must begin on its bed');
      let popped=false,air=false,landed=false,frames=0,overBridge=false;
      for(;frames<180;frames++){
        const d=(k.p[0]-p.pos.x)*h[0]+(k.p[2]-p.pos.z)*h[2],release=!popped&&d< -k.run/2+.6;if(release)popped=true;
        step(makeInput({jumpHeld:!popped,jumpPressed:frames===0,jumpReleased:release}));air||=p.state==='air';
        assert.ok(!p.isBailing,'Over a Footbridge bailed');
        const past=(p.pos.x-b.p[0])*h[0]+(p.pos.z-b.p[2])*h[2];
        if(Math.abs(past)<.5&&p.state==='air'&&p.pos.y>-4.58)overBridge=true;
        if(air&&p.grounded&&past>b.width/2){landed=true;break;}
      }
      assert.ok(landed&&overBridge,'ditch jump did not clear and land beyond bridge 3');
      report.airs.push({name:'Over a Footbridge',speed,air,landed,overBridge,frames,bails:0,end:p.pos.toArray()});
    }
    // A pool transfer must land in the other basin on its FIRST landing.
    // Rolling across the shared deck and dropping in does not count.
    for(const from of [0,1]){
      const a=m.SCHOOL_POOLS[from],b=m.SCHOOL_POOLS[1-from],dir=from===0?1:-1;
      place([a.centre[0],a.bottom+.1,a.centre[2]],[dir,0,0],18);
      let popped=false,air=false,exited=false,landed=false,frames=0;
      for(;frames<220;frames++){
        const release=!popped&&p.grounded&&p.rideNormal.y<.12;if(release)popped=true;
        step(makeInput({moveY:1,jumpHeld:!popped,jumpPressed:frames===0,jumpReleased:release}));
        assert.ok(!p.isBailing,'Swim Team Gap bailed');air||=p.vertAir;exited||=air&&!p.vertAir;
        if(exited&&p.grounded){
          assert.ok(p.pos.y<-5.3&&p.pos.y>=b.bottom-.06&&Math.abs(p.pos.x-b.centre[0])<8&&Math.abs(p.pos.z-b.centre[2])<10,'Swim Team first landing missed the other basin');
          landed=true;break;
        }
      }
      assert.ok(landed,'Swim Team Gap never landed');report.airs.push({name:'Swim Team Gap',from:a.name,to:b.name,air,landed,firstLandingInTarget:true,frames,bails:0,end:p.pos.toArray()});
    }
    // Ditch Slap crosses the open trench between bridges, clearing both
    // banks with a normal ollie and landing on the opposite yard.
    const ditchHalf=ditch.half+ditch.radius*Math.sin(65*Math.PI/180),ditchCross=ditch.a.map((v,i)=>v+(ditch.b[i]-v)*.58);
    for(const dir of [-1,1]){
      const h=[nx*dir,0,nz*dir];place([ditchCross[0]-h[0]*(ditchHalf+5),-4.9,ditchCross[2]-h[2]*(ditchHalf+5)],h,18);
      let popped=false,air=false,landed=false,frames=0;
      for(;frames<180;frames++){
        const d=(ditchCross[0]-p.pos.x)*h[0]+(ditchCross[2]-p.pos.z)*h[2],release=!popped&&d<ditchHalf+1;if(release)popped=true;
        step(makeInput({jumpHeld:!popped,jumpPressed:frames===0,jumpReleased:release}));air||=p.state==='air';assert.ok(!p.isBailing,'Ditch Slap bailed');
        if(air&&p.grounded){assert.ok((p.pos.x-ditchCross[0])*h[0]+(p.pos.z-ditchCross[2])*h[2]>ditchHalf&&Math.abs(p.pos.y+5)<.06,'Ditch Slap did not clear the opposite bank');landed=true;break;}
      }
      assert.ok(landed,'Ditch Slap never landed');report.airs.push({name:'Ditch Slap',dir,air,landed,frames,bails:0,end:p.pos.toArray()});
    }
    // Low garbage is a real obstacle. Require the feet to pass over the
    // isolated last crate, then touch down beyond it on the rear apron.
    place([18.2,.1,52.2],[1,0,0],12);
    let garbagePopped=false,garbageAir=false,overGarbage=false,garbageLanded=false,garbageFrames=0;
    for(;garbageFrames<140;garbageFrames++){
      const release=!garbagePopped&&p.pos.x>18.6;if(release)garbagePopped=true;
      step(makeInput({jumpHeld:!garbagePopped,jumpPressed:garbageFrames===0,jumpReleased:release}));garbageAir||=p.state==='air';assert.ok(!p.isBailing,'Garbage Ollie bailed');
      if(Math.abs(p.pos.x-23.3)<.4&&Math.abs(p.pos.z-52.2)<.3&&p.pos.y>.48)overGarbage=true;
      if(garbageAir&&p.grounded){assert.ok(overGarbage&&p.pos.x>23.64&&Math.abs(p.pos.y)<.06,'Garbage Ollie missed the actual crate');garbageLanded=true;break;}
    }
    assert.ok(garbageLanded,'Garbage Ollie never landed');report.airs.push({name:'Garbage Ollie',air:garbageAir,landed:garbageLanded,overGarbage,frames:garbageFrames,bails:0,end:p.pos.toArray()});
    // Start on the alley, catch the first dumpster rail, pop the gap,
    // freshly press grind to catch the second rail, and roll off onto land.
    const dumpsterA=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(18,.55,28))<.1),dumpsterB=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(18,1.1,40.5))<.1);
    assert.ok(dumpsterA&&dumpsterB);place([18,.1,26],[0,0,1],14);
    let dumpsterCaught=false,dumpsterPopped=false,dumpsterRepress=false,dumpsterLanded=false,dumpsterFrames=0,dumpsterAFrames=0,dumpsterBFrames=0;
    for(;dumpsterFrames<220;dumpsterFrames++){
      const release=dumpsterCaught&&!dumpsterPopped&&p.pos.z>34.6;if(release)dumpsterPopped=true;
      const press=dumpsterPopped&&!dumpsterRepress&&p.pos.z>41.8;if(press)dumpsterRepress=true;
      step(makeInput({grindHeld:!dumpsterPopped||dumpsterRepress,grindPressed:dumpsterFrames===0||press,jumpHeld:dumpsterCaught&&!dumpsterPopped,jumpPressed:dumpsterAFrames===1,jumpReleased:release}));
      assert.ok(!p.isBailing,'Dumpster Rail Gap bailed');dumpsterCaught||=p.state==='grind'&&p.grindRail===dumpsterA;
      if(p.state==='grind'&&p.grindRail===dumpsterA)dumpsterAFrames++;
      if(dumpsterPopped&&p.state==='grind'&&p.grindRail===dumpsterB)dumpsterBFrames++;
      if(dumpsterBFrames>=8&&p.grounded){assert.ok(p.pos.z>47&&Math.abs(p.pos.y)<.06,'Dumpster rollout missed alley');dumpsterLanded=true;break;}
    }
    assert.ok(dumpsterLanded&&dumpsterAFrames>=20,'Dumpster transfer did not grind both rails and roll out');
    report.grinds.push({name:'Dumpster Rail Gap',caught:dumpsterCaught,landed:dumpsterLanded,takeoffFrames:dumpsterAFrames,receivingFrames:dumpsterBFrames,frames:dumpsterFrames,bails:0,end:p.pos.toArray()});
    // Tap an ollie over the Mini Gap with a pre-held right transfer input.
    // The bend's receiving coping is angled. Release grind during the air
    // and press it again on arrival, then verify a clean ground rollout.
    const miniCentre=new THREE.Vector3(...m.SCHOOL_MINI_GAP.before).add(new THREE.Vector3(6.1,3.05,0));
    const miniRails=level.rails.filter(r=>r.points.some(q=>q.distanceTo(miniCentre)<4));
    const miniTakeoff=miniRails.find(r=>r.totalLength>20),miniReceiver=miniRails.find(r=>r.totalLength<10);
    assert.ok(miniTakeoff&&miniReceiver,'Mini Gap needs two separated coping runs');
    const mq=miniTakeoff.pointAt(4).add(new THREE.Vector3(0,.3,0)),mh=miniTakeoff.tangentAt(4).multiplyScalar(-1).setY(0).normalize();
    place(mq.toArray(),mh.toArray(),6);p.pos.copy(mq);p.prevPos.copy(mq);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';p.balanceBoostT=10;
    let miniCaught=false,miniPopped=false,miniLanded=false,miniFrames=0,miniReceivingFrames=0;
    for(;miniFrames<180;miniFrames++){
      const d=p.pos.distanceTo(miniTakeoff.points[0]),release=miniCaught&&!miniPopped&&d<1;
      if(release)miniPopped=true;
      const camLen=Math.hypot(p.camDir.x,p.camDir.z)||1,side=d<1.35?.55:0;
      step(makeInput({moveX:-p.camDir.z/camLen*side,moveY:p.camDir.x/camLen*side,grindHeld:!miniPopped||miniFrames>=60,grindPressed:miniFrames===0||miniFrames===60,jumpHeld:miniCaught&&!miniPopped&&d<1.35,jumpPressed:miniCaught&&d<1.35&&d>=1.2,jumpReleased:release}));
      miniCaught||=p.state==='grind'&&p.grindRail===miniTakeoff;
      assert.ok(!p.isBailing,'Mini Gap transfer bailed');
      if(miniPopped&&p.state==='grind'&&p.grindRail===miniReceiver)miniReceivingFrames++;
      if(miniReceivingFrames>=8&&p.grounded){miniLanded=true;break;}
    }
    assert.ok(miniLanded,'Mini Gap did not transfer to the receiving coping and roll out');
    report.airs.push({name:'Mini Gap',air:miniPopped,landed:miniLanded,bails:0,frames:miniFrames,receivingGrindFrames:miniReceivingFrames,end:p.pos.toArray()});
    const plank=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(...m.SCHOOL_ROOF_PLANK[0]).add(new THREE.Vector3(0,.06,0)))<.1);assert.ok(plank);
    const pq=plank.pointAt(.4).add(new THREE.Vector3(0,.3,0)),ph=plank.tangentAt(.4).setY(0).normalize();
    place(pq.toArray(),ph.toArray(),14);p.pos.copy(pq);p.prevPos.copy(pq);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';p.balanceBoostT=10;
    let plankCaught=false,awningLanded=false,plankBails=0,plankFrames=0;
    for(let i=0;i<220;i++){
      step(makeInput({grindHeld:true,grindPressed:i===0}));
      if(p.state==='grind'&&p.grindRail===plank){plankCaught=true;plankFrames++;}
      if(p.isBailing)plankBails++;
      if(plankCaught&&p.state==='ride'&&p.grounded&&Math.abs(p.pos.y-3.4)<.08){awningLanded=true;break;}
    }
    report.grinds.push({name:'Roof to Awning',caught:plankCaught,landed:awningLanded,frames:plankFrames,bails:plankBails,end:p.pos.toArray()});
    assert.ok(plankCaught&&awningLanded,'plank did not connect to blue awning');assert.equal(plankBails,0,'plank clearance collision');
    // Catch the actual long descending rail in both directions, then ride a
    // substantial part of it; validate continuity rather than just its data.
    const rail=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(...m.SCHOOL_MAIN_RAIL[0]))<.1);assert.ok(rail);
    for(const dir of [-1,1]){
      const t=rail.totalLength*(dir>0?.2:.8),q=rail.pointAt(t).add(new THREE.Vector3(0,.3,0)),h=rail.tangentAt(t).multiplyScalar(dir).setY(0).normalize();
      place(q.toArray(),h.toArray(),14);p.pos.copy(q);p.prevPos.copy(q);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';p.balanceBoostT=10;
      step(makeInput({grindHeld:true,grindPressed:true}));assert.equal(p.state,'grind');assert.equal(p.grindRail,rail);
      let frames=1;for(;frames<50&&p.state==='grind';frames++)step(makeInput({grindHeld:true}));
      report.grinds.push({dir,frames,end:p.pos.toArray()});assert.ok(frames>=35,'downhill rail prematurely interrupted');
    }
    const {createBalancedGrind,createRoofMiniGap}=await server.ssrLoadModule('/tools/school-grind-lines.ts');
    const longStart=m.SCHOOL_WEST_DESCENT[0].map((v,i)=>v+[-3.9,.45,1.2][i]),longRail=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(...longStart))<.1);
    const sign=m.schoolMapPoint(352,78);sign[1]=-2.45;
    const playground=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(...sign))<.1);
    for(const [name,r] of [['Long Ass Rail',longRail],['Huge Rail',miniTakeoff],['Playground Rail',playground]]){
      assert.ok(r,`${name} missing`);const h=r.tangentAt(.4).setY(0).normalize(),q=r.pointAt(.4);
      if(name==='Long Ass Rail'){const a=r.points[0].clone().addScaledVector(h,-1.5);place([a.x,.1,a.z],h.toArray(),14);}
      else{q.y+=.3;place(q.toArray(),h.toArray(),14);p.pos.copy(q);p.prevPos.copy(q);p.grounded=false;p.state='air';p.vVel=0;p.airFromSkate=true;p.airGrav='board';}
      assert.equal(p.balanceBoostT,0,'long grinds must use normal balance');assert.equal(p.uberTimer,0);
      const line=createBalancedGrind(p,r,CONST.fixedStep);let complete=false;
      for(let i=0;i<900;i++){step(makeInput(line.sample()));assert.ok(!p.isBailing,`${name} bailed`);if(line.observe()){complete=true;break;}}
      assert.ok(complete,`${name} never completed`);report.grinds.push({name,...line.report,bails:0,end:p.pos.toArray()});
    }
    const roofA=level.rails.find(r=>r.points.at(-1).distanceTo(new THREE.Vector3(...m.SCHOOL_ROOF_MINI_GAP.left).add(new THREE.Vector3(0,1.85,-1.8)))<.6&&r.totalLength>25);
    const roofB=level.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(...m.SCHOOL_ROOF_MINI_GAP.right).add(new THREE.Vector3(0,1.85,-1.8)))<.1);
    assert.ok(roofA&&roofB);const rq=roofA.pointAt(roofA.totalLength-4).add(new THREE.Vector3(0,.3,0)),rh=roofA.tangentAt(roofA.totalLength-4).setY(0).normalize();
    place(rq.toArray(),rh.toArray(),12);p.pos.copy(rq);p.prevPos.copy(rq);p.state='air';p.grounded=false;p.vVel=0;p.airFromSkate=true;p.airGrav='board';assert.equal(p.balanceBoostT,0);
    const roofMini=createRoofMiniGap(p,roofA,roofB,CONST.fixedStep);let roofMiniComplete=false;
    for(let i=0;i<300;i++){step(makeInput(roofMini.sample()));assert.ok(!p.isBailing,'Roof Mini Gap bailed');if(roofMini.observe()){roofMiniComplete=true;break;}}
    assert.ok(roofMiniComplete,'Roof Mini Gap did not land back on the roof');report.airs.push({name:'Roof Mini Gap',...roofMini.report,bails:0,end:p.pos.toArray()});
    // Complete the opening grind, downhill gap, rear corridor, pool deck,
    // and uphill return in one native-spawn run with no intermediate reset.
    const {createSchoolCircuit}=await server.ssrLoadModule('/tools/school-circuit.ts');
    p.respawn(level,true);const circuit=createSchoolCircuit(p);let arrived=false;
    for(let i=0;i<2400;i++){
      step(makeInput(circuit.sample()));assert.ok(!p.isBailing,'continuous campus circuit bailed');
      if(circuit.observe()){arrived=true;break;}
    }
    assert.ok(arrived,'continuous campus circuit timed out');report.circuits.push(circuit.report);
    assert.equal(JSON.stringify(TUNING),originalTuning,'geometry changed movement tuning');
    console.log('PASS School Miami: supported topology, connected routes, basin airs and sloped rail continuity.');
  } finally {
    await mkdir('/private/tmp/school-miami-review',{recursive:true});await writeFile('/private/tmp/school-miami-review/physics.json',JSON.stringify(report,null,2));level.dispose();
  }
});
