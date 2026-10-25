import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const report={traversals:[],drySandProbes:0};
await withBlockworksRuntime(async r=>{
  const {p,l,THREE}=r,camera=new THREE.PerspectiveCamera();
  const {treehouseShoreZ:shore}=await r.server.ssrLoadModule('/src/levels/treehouse-trials-continuity.ts');
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(l.captureData()),'shore data survives editor capture/import');
  const boundary=r.source.components.find(c=>c.nm==='Treehouse fitted course-edge safety perimeter').pts;
  function inside(x,z){
    let yes=false;
    for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){
      const a=boundary[i],b=boundary[j];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;
    }
    return yes;
  }
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),water=l.water.group.getObjectByName('Unity curved shoreline ocean ribbon');
  for(let x=-30;x<=45;x+=1.25)for(let d=0;d<=7;d+=.25){
    const z=shore(x)+d;ray.set(new THREE.Vector3(x,5,z),down);
    const ground=ray.intersectObjects(l.groundMeshes,false)[0];
    if(!ground||ground.point.y<-.6)continue;
    assert.equal(ray.intersectObject(water).length,0,`no water triangles over dry sand at ${x}/${z}`);
    assert.equal(ray.intersectObject(l.water.group.getObjectByName('Unity ocean horizon fill')).length,0,`no far-sea fill over dry sand at ${x}/${z}`);
    report.drySandProbes++;
  }
  assert.ok(report.drySandProbes>900);
  for(const p of r.source.components.filter(c=>c.t==='camnode'&&!c.cameraView&&c.p[2]<-28))
    assert.equal(l.swimmingSurfaceAt(p.p[0],p.p[2]),null,'opening swimming cannot flood the lower inland route');
  const cases=[...[-24,-12,0,12,24,36,44].map(x=>({name:`front ${x}`,start:[x,.1,shore(x)-1],direction:[0,0,1]})),
    ...[0,7].map(z=>({name:`west ${z}`,start:[-36,.1,z],direction:[-1,0,0]})),
    {name:'joined beach corner',start:[-33,.1,shore(-35)-1],direction:[-Math.SQRT1_2,0,Math.SQRT1_2]}];
  for(const c of cases){
    p.respawn(l,true,false,{position:new THREE.Vector3(...c.start),heading:new THREE.Vector3(...c.direction)});p.snapRenderInterpolation();
    let firstSwim=null;const dir=new THREE.Vector3(...c.direction);
    const step=input=>{
      l.water.update(r.dt,camera);r.tick(input);
      assert.equal(p.totalDeaths,0,`${c.name}: swimming must remain recoverable`);
      assert.ok(inside(p.pos.x,p.pos.z),`${c.name}: player crossed the containment wall`);
      assert.ok(p.pos.toArray().every(Number.isFinite));
    };
    for(let i=0;i<1100;i++){
      step(r.worldDirectionInput(dir,.8));
      if(p.state==='swim'&&!firstSwim)firstSwim=p.pos.toArray();
    }
    assert.ok(firstSwim,`${c.name}: approach must reach swimming depth`);
    assert.equal(p.state,'swim',`${c.name}: boundary must retain buoyancy`);
    const wall=p.pos.toArray(),swimDistance=p.pos.clone().sub(new THREE.Vector3(...firstSwim)).dot(dir);
    assert.ok(swimDistance>=2.5&&swimDistance<15,`${c.name}: expected a few metres of swimming, got ${swimDistance}`);
    let returned=false;
    for(let i=0;i<1100;i++){
      step(r.steerToward(c.start,{pace:.8}));
      if(p.grounded&&Math.hypot(p.pos.x-c.start[0],p.pos.z-c.start[2])<.6){returned=true;break;}
    }
    assert.ok(returned,`${c.name}: swim back onto supported sand`);
    report.traversals.push({name:c.name,firstSwim,wall,swimDistance,returned,end:p.pos.toArray(),deaths:p.totalDeaths});
    console.log(`PASS ${c.name}: ${swimDistance.toFixed(2)}m swimming, contained and returned ashore.`);
  }
},{modulePath:'/src/levels/treehouse-trail.ts',levelId:'treehouse-trail',source:m=>m.TREEHOUSE_TRAIL_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(process.env.TREEHOUSE_SHORE_REPORT??join(tmpdir(),'treehouse-shore-native.json'),JSON.stringify(report,null,2));
console.log(`PASS ${report.drySandProbes} dry-sand water-mesh probes and editor roundtrip.`);
