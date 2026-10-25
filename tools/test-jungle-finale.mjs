import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runJungleFinale} from './jungle-finale-pilot.mjs';

const out=process.env.JUNGLE_FINALE_OUT||join(tmpdir(),'jungle-finale');await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
  const api=await r.server.ssrLoadModule('/src/level.ts');
  const {RUINS_SKATE_GAPS:gaps,RUINS_CLIMB_LEDGES:ledges}=await r.server.ssrLoadModule('/src/levels/jungle-ruins-finale.ts');
  assert.ok(api.normalizeCustomLevelData(r.source),'complete native level and extension survive editor validation');
  assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
  assert.equal(r.l.captureData().components.filter(c=>c.t==='speedpad').length,4,'capture preserves boost mechanics');
  const {CameraViewFraming}=await r.server.ssrLoadModule('/src/cameraViews.ts');
  const camera=new THREE.PerspectiveCamera(60,16/9,.1,300),subject=new THREE.Vector3(56,8.8,-1360);
  const view=r.l.cameraPresentationViews[0];
  new CameraViewFraming().apply(camera,{view,weight:1},subject,true,undefined,{travel:{x:1,z:0},distance:6});
  assert.ok(Math.abs(camera.position.distanceTo(subject.clone().add(new THREE.Vector3(0,1.3,0)))-18)<.001,'side camera retains enough distance to show the next ledge');
  for(const pad of r.l.groundMeshes.filter(m=>m.userData.speedPadSpeed))assert.equal(pad.material.color.getHexString(),'75ab8b','jade pad tint survives capture/rebuild');
  const tuning=JSON.stringify(r.TUNING),generator=runJungleFinale(r,gaps,ledges);
  let next=generator.next(),events,routeSeconds;const recovery=[];
  try{
    while(!next.done){r.tick(next.value);next=generator.next();}
    events=next.value;
    assert.equal(r.p.totalDeaths,0);assert.equal(r.p.state,'finished');
    assert.equal(JSON.stringify(r.TUNING),tuning);
    assert.ok(events.slice(0,4).every(e=>e.launch.speed>30),'all four gaps use high-speed skating');
    assert.equal(r.l.checkpoints.filter(c=>c.active&&c.spawnPos.z<-690).length,5,'earn every new checkpoint through ordinary inputs');
    routeSeconds=r.frame*r.dt;
    for(const [name,position]of [['aqueduct pit',[0,3,-853]],['climbing pit',[114,12,-1360]]]){
      const spawn=r.l.currentSpawn.clone(),begin=r.frame;let died=false;
      r.p.respawn(r.l,false,false,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(1,0,0)});
      for(let i=0;i<900;i++){r.tick({});died||=r.p.state==='dead';if(died&&r.p.state==='ride'&&r.p.grounded)break;}
      assert.ok(died&&r.p.grounded&&r.p.pos.distanceTo(spawn)<3,name+' returns to the earned checkpoint');
      recovery.push({name,seconds:(r.frame-begin)*r.dt,spawn:spawn.toArray(),returned:r.p.pos.toArray()});
    }
    console.log(JSON.stringify({seconds:routeSeconds,events,recovery},null,2));
  }finally{await writeFile(out+'/native.json',JSON.stringify({stage:r.stage,seconds:routeSeconds??r.frame*r.dt,events:r.events,recovery,trace:r.trace},null,2)+'\n');}
},{modulePath:'/src/level.ts',levelId:'jungle',source:m=>{
  const l=new m.Level(new THREE.Scene(),{id:'jungle',name:'Jungle Ruins'}),data=l.captureData();l.dispose();return data;
},start:[0,.1,-690],heading:[0,0,-1],endlessDeaths:true,maxFrames:16000});
