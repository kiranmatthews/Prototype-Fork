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
    const ray=new THREE.Raycaster(),near=(name,q,y,from=y+1)=>{ray.set(new THREE.Vector3(q[0],from,q[2]),new THREE.Vector3(0,-1,0));ray.far=15;const hit=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.06,`${name}: ${hit?.point.y} expected ${y}`);report.support.push({name,point:hit.point.toArray()});};
    near('Hoop quarter flat approach',[48.5,0,43.4],0);near('Hoop quarter deck',[48.5,0,45.1],1.35,4);
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
        if(c.observe()){completed=true;break;}
      }
      assert.ok(completed,`${c.name}: timeout`);report.trials.push({name:c.name,kind:c.kind,...c.result,bails:0,end:p.pos.toArray()});
    }
    report.tuningUnchanged=before===JSON.stringify(TUNING);assert.ok(report.tuningUnchanged);
    console.log(`PASS School details: ${report.support.length} supports, ${report.trials.length} native skating cases.`);
  }finally{await writeFile('/private/tmp/school-miami-review/details.json',JSON.stringify(report,null,2));l.dispose();}
});
