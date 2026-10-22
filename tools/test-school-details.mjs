import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,Level,Player,scene,CONST,TUNING})=>{
  const m=await server.ssrLoadModule('/src/levels/school-miami.ts'),before=JSON.stringify(TUNING);
  const l=new Level(scene,{id:'school-miami',name:m.SCHOOL_MIAMI_LEVEL.name,data:m.SCHOOL_MIAMI_LEVEL});scene.updateMatrixWorld(true);
  const p=new Player(scene);p.endlessDeaths=true;const report={support:[],trials:[],tuningUnchanged:false};
  const place=(q,h,speed)=>{
    p.rawInput=makeInput();p.respawn(l,true,true,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...h).normalize()});
    p.axisF.set(...h).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.freeSkate=true;p.speed=speed;
    p.groundHit=p.queryGround(l);assert.ok(p.groundHit,'Detail approach has no ground');p.pos.y=p.groundHit.y;p.prevPos.copy(p.pos);p.grounded=true;p.rideNormal.copy(p.groundHit.normal);
  };
  try{
    const ray=new THREE.Raycaster(),near=(name,q,y,from=y+1)=>{ray.set(new THREE.Vector3(q[0],from,q[2]),new THREE.Vector3(0,-1,0));ray.far=15;const hit=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.06,`${name}: ${hit?.point.y} expected ${y}`);assert.ok(hit.face.normal.y>.1,`${name}: support faces down`);report.support.push({name,point:hit.point.toArray()});};
    for(const x of [-3,0,4])near(`West pavilion supported roof ${x}`,[x,0,12.5],m.SCHOOL_WEST_ANNEX.y,5);
    for(const x of [8,13,19])near(`Closed passage supported roof ${x}`,[x,0,14],m.SCHOOL_WEST_PASSAGE.y,5);
    near('Upper court checkpoint clear of pavilion',[6,0,9],0,3.1);
    place([0,.1,6],[0,0,1],8);let maxZ=6;
    for(let frame=0;frame<80;frame++){p.step(CONST.fixedStep,makeInput({moveY:1}),l);l.update(CONST.fixedStep);maxZ=Math.max(maxZ,p.pos.z);assert.ok(p.pos.z<9.65,'Closed pavilion boundary was penetrated');if(p.isBailing)break;}
    assert.ok(maxZ>8,'Boundary probe did not reach the pavilion');
    for(const [x,z] of [[59.4,38.7],[61.9,38.45],[64.25,38.8]])near(`Joined roof vent top ${x}`,[x,0,z],7.7,9);
    for(const x of [55.5,68])near(`Joined roof vent rollout ${x}`,[x,0,38.7],7,9);
    near('Roof checkpoint clear of joined vent',m.SCHOOL_CHECKPOINTS[3],7,9);
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
