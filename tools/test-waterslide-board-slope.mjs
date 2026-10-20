import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');race.start('race',19410);race.phase='running';race.drive=()=>normalizeGameInput({});
 const rows=[];
 for(const s of [3200,3300,3450,3550,3650]){
  const at=race.course.support(r.l,s);assert.ok(at);r.p.resetRacePosition(r.l,at,race.course.tangent(s));r.p.speed=24;race.riders[0].progress=s;
  for(let i=0;i<35;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput({}));}
  r.scene.updateMatrixWorld(true);assert.ok(r.p.grounded&&r.p.boardRolling);
  const up=new r.THREE.Vector3(0,1,0).transformDirection(r.p.boardG.matrixWorld);
  const normal=r.p.rideNormal,slope=Math.acos(normal.y)*180/Math.PI,board=Math.acos(up.y)*180/Math.PI,error=up.angleTo(normal)*180/Math.PI;
  rows.push({s,slope,board,error,alignment:r.p.alignPose});assert.ok(r.p.alignPose>.99);assert.ok(error<6,JSON.stringify(rows.at(-1)));
 }
 assert.ok(rows.some(row=>row.slope>30));console.log(JSON.stringify({mountedDeckMatchesSteepSurface:rows}));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
