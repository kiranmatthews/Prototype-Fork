// Original-coordinate authoring regression. Run test-school-scale.mjs for the playable scaled campus.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,Level,Player,scene,CONST,TUNING})=>{
  const source=await server.ssrLoadModule('/src/levels/school-miami.ts'),m={...source,SCHOOL_MIAMI_LEVEL:source.createSchoolMiamiLevel(1)},before=JSON.stringify(TUNING);
  const l=new Level(scene,{id:'school-miami',name:m.SCHOOL_MIAMI_LEVEL.name,data:m.SCHOOL_MIAMI_LEVEL});scene.updateMatrixWorld(true);
  const p=new Player(scene);p.endlessDeaths=true;const report={support:[],trials:[],tuningUnchanged:false};
  const place=(q,h,speed)=>{
    p.rawInput=makeInput();p.respawn(l,true,true,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...h).normalize()});
    p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
    p.groundHit=p.queryGround(l);assert.ok(p.groundHit,'Detail approach has no ground');p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
  };
  try{
    const ray=new THREE.Raycaster(),near=(name,q,y,from=y+1,meshes=l.groundMeshes)=>{ray.set(new THREE.Vector3(q[0],from,q[2]),new THREE.Vector3(0,-1,0));ray.far=15;const hit=ray.intersectObjects(meshes,false)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.06,`${name}: ${hit?.point.y} expected ${y}`);assert.ok(hit.face.normal.y>.1,`${name}: support faces down`);report.support.push({name,point:hit.point.toArray()});};
    for(const x of [-3,0,4])near(`West pavilion supported roof ${x}`,[x,0,12.5],m.SCHOOL_WEST_ANNEX.y,5);
    for(const x of [8,13,19])near(`Closed passage supported roof ${x}`,[x,0,14],m.SCHOOL_WEST_PASSAGE.y,5);
    near('Upper court checkpoint clear of pavilion',[6,0,9],0,3.1);
    place([0,.1,6],[0,0,1],8);let maxZ=6;
    for(let frame=0;frame<80;frame++){p.step(CONST.fixedStep,makeInput({moveY:1}),l);l.update(CONST.fixedStep);maxZ=Math.max(maxZ,p.pos.z);assert.ok(p.pos.z<9.65,'Closed pavilion boundary was penetrated');if(p.isBailing)break;}
    assert.ok(maxZ>8,'Boundary probe did not reach the pavilion');
    for(const [x,z] of [[62.2,40.5],[64.7,40.25],[67.05,40.6]])near(`Joined roof vent top ${x}`,[x,0,z],7.7,9);
    for(const x of [58.3,70.4])near(`Joined roof vent rollout ${x}`,[x,0,40.5],7,9);
    near('Roof checkpoint clear of joined vent',m.SCHOOL_CHECKPOINTS[3],7,9);
    const ac=m.SCHOOL_ROOF_AC;
    for(const [dx,dz] of [[0,0],[-4,-3],[-4,3],[4,-3],[4,3]])near(`Registered AC top ${dx}/${dz}`,[ac.x+dx,0,ac.z+dz],ac.top,11);
    near('Narrow flat lane north of air conditioner',[54.7,0,18.12],7,9);
    for(const [name,toe,h] of [
      ['north',[54.7,7,18.25],[0,0,1]],['west',[48.25,7,21.3],[1,0,0]],['south',[57.5,7,29.15],[0,0,-1]],
    ])for(const angle of [0,30,60,75]){
      const rad=angle*Math.PI/180,d=ac.transition*Math.sin(rad),y=7+ac.transition*(1-Math.cos(rad));
      near(`AC ${name} curved profile ${angle}`,[toe[0]+h[0]*d,0,toe[2]+h[2]*d],y,11);
    }
    for(const side of [-1,1])for(const angle of [10,45,75]){
      const theta=side===-1?-3*Math.PI/4:-5*Math.PI/4,phi=angle*Math.PI/180;
      const radius=ac.corner+ac.transition*(1-Math.sin(phi));
      near(`AC rounded corner ${side}/${angle}`,[ac.x-ac.width/2+ac.corner+radius*Math.cos(theta),0,
        ac.z+side*(ac.depth/2-ac.corner)+radius*Math.sin(theta)],7+ac.transition*(1-Math.cos(phi)),11,
        l.groundMeshes.filter(o=>o.userData.vertComp?.nm==='Air conditioner · three-sided transition and top coping'));
    }
    const acCoping=l.rails.find(r=>r.points[0].distanceTo(new THREE.Vector3(ac.x+ac.width/2,ac.top+.05,ac.z-ac.depth/2))<.1);
    assert.ok(acCoping&&acCoping.points.every(q=>Math.abs(q.y-ac.top-.05)<.001),'AC coping must follow the unit top, not the lower curve join');
    near('Roof 2 Roof approach east of kicker',[65.5,0,23],7,9);
    near('Air conditioner west landing clear roof',[43,0,23.7],7,9);
    for(const [i,points] of m.SCHOOL_ROOF_FLAT_RAILS.entries())for(const t of [-.3,0,.5,1,1.3]){
      const q=new THREE.Vector3(...points[0]).lerp(new THREE.Vector3(...points[1]),t);
      near(`Roof short rail ${i+1} supported approach/bar/rollout ${t}`,q.toArray(),7,9);
      assert.ok(q.y-7>.6,'Roof short rail is buried in its support');
    }
    near('West roof hip flat top',[45.5,0,26.5],8.25,10);
    for(const z of [21.5,31.5])near(`West roof hip rollout ${z}`,[45.5,0,z],7,10);
    for(const x of [30,40,50,60,67])near(`Flat south roof lane ${x}`,[x,0,46.8],7,10);
    for(const x of [30,48,67])near(`Low south parapet ${x}`,[x,0,m.SCHOOL_ROOF_PARAPET.z],7.3,10);
    near('Hoop quarter flat approach',[48.5,0,43.4],0);near('Hoop quarter deck',[48.5,0,45.1],1.35,4);
    for(const [i,b] of m.SCHOOL_GYM_BANKS.entries())for(const d of [0,.4,2,4,6,8,8.7]){
      near(`Gym bank ${i} profile ${d}`,[b.toeX+b.side*d,0,32],m.schoolGymBankHeight(d),5);
    }
    for(const x of [46.5,48.5,50.5])near(`Central gym doorway ${x}`,[x,0,14.6],0,3.1);
    const skylight=m.SCHOOL_SKYLIGHT;
    near('Open skylight reaches the court',[(skylight.hole.minX+skylight.hole.maxX)/2,0,skylight.z],0,9);
    for(const side of [-1,1]){
      near(`Skylight frame X ${side}`,[skylight.x+side*(skylight.width/2+skylight.bank/2),0,skylight.z],7.25,9);
      near(`Skylight frame Z ${side}`,[skylight.x,0,skylight.z+side*(skylight.depth/2+skylight.bank/2)],7.25,9);
    }
    for(let row=0;row<3;row++)for(let col=0;col<2;col++){
      if(row===1&&col===1)continue;
      near(`Intact skylight pane ${row}/${col}`,[skylight.x+(col-.5)*skylight.width/2,0,skylight.z+(row-1)*skylight.depth/3],skylight.lipY,9);
    }
    const bank=m.SCHOOL_REAR_BANK;
    for(const t of [.1,.3,.5,.7,.9]){
      const at=pts=>new THREE.Vector3(...pts[0]).lerp(new THREE.Vector3(...pts[1]),t);
      near(`Rear bank deck ${t}`,at(bank.back).lerp(at(bank.lip),.6).toArray(),bank.y,-2.8);
    }
    const {schoolDetailTrials}=await server.ssrLoadModule('/tools/school-detail-lines.ts');
    for(const c of schoolDetailTrials(p,l,place,CONST.fixedStep)){
      c.init();let completed=false;
      for(let frame=0;frame<c.limit;frame++){
        const input=makeInput(c.sample(frame)),n=Math.max(1,Math.hypot(input.moveX,input.moveY));input.moveX=Math.round(input.moveX/n*100)/100;input.moveY=Math.round(input.moveY/n*100)/100;
        p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);input.consumeEdges();
        assert.ok(!p.isBailing,`${c.name}: bail`);assert.ok(p.pos.toArray().every(Number.isFinite),`${c.name}: non-finite position`);
        try{if(c.observe()){completed=true;break;}}catch(error){throw Error(`${c.name}: ${error.message}; ${JSON.stringify({result:c.result,pos:p.pos.toArray(),state:p.state})}`);}
      }
      assert.ok(completed,`${c.name}: timeout`);report.trials.push({name:c.name,kind:c.kind,...c.result,bails:0,end:p.pos.toArray()});
    }
    report.tuningUnchanged=before===JSON.stringify(TUNING);assert.ok(report.tuningUnchanged);
    console.log(`PASS School details: ${report.support.length} supports, ${report.trials.length} native skating cases.`);
  }finally{await writeFile('/private/tmp/school-miami-review/details.json',JSON.stringify(report,null,2));l.dispose();}
});
