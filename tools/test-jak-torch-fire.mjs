import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const packed=fire=>fire.meshes.map(mesh=>['centre','size','rgba','roll'].map(name=>{
  const attr=mesh.geometry.getAttribute(name);
  return Array.from(attr.array.slice(0,mesh.geometry.instanceCount*attr.itemSize));
}));
try{
  const {JakTorchFire}=await server.ssrLoadModule('/src/jakTorchFire.ts');
  const {ParticleMotion}=await server.ssrLoadModule('/src/jak-lab/particleMotion.ts');
  const catalogue=JSON.parse(await readFile(new URL('../public/jak-lab/catalogue.json',import.meta.url)));
  const source=catalogue.groups.find(g=>g.name==='group-part-maincave-torch');
  const baseline=new ParticleMotion(source,new Map(catalogue.particles.map(p=>[p.id,p])),256,19);
  for(let frame=0;frame<90+60*12;frame++)baseline.update(1/60);
  const frames=[],reports=[];
  for(const fps of [30,60,120]){
    const fire=new JakTorchFire(1,false,19);let peak=0;
    for(let frame=0;frame<fps*12;frame++){
      fire.update(1/fps,1);peak=Math.max(peak,fire.diagnostics.particles);
      assert.equal(fire.diagnostics.dropped,0);
      assert.equal(fire.diagnostics.textures,0);
      for(const mesh of fire.meshes){
        assert.ok(mesh.geometry.instanceCount<=256);
        assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.depthTest,true);
        assert.equal(mesh.material.fog,true);
        for(const value of mesh.geometry.getAttribute('centre').array)assert.ok(Number.isFinite(value));
      }
    }
    assert.ok(peak>25&&peak<256,'source torch graph stays inside the fixed pool');
    assert.deepEqual(fire.motion.particles,baseline.particles,'runtime port retains every original particle field');
    frames.push(packed(fire));reports.push({fps,peak,draws:fire.diagnostics.draws});
    assert.equal(fire.diagnostics.draws,2,'preserve normal cooling and additive flame layers');
    fire.update(1/60,0);assert.equal(fire.diagnostics.particles,0);
    for(let i=0;i<240;i++)fire.update(1/60,0);
    assert.equal(fire.motion.particles.filter(p=>p.alive).length,0,'extinguished graph expires');
    for(let i=0;i<30;i++)fire.update(1/60,1);
    assert.ok(fire.diagnostics.particles>10,'phase torch reignites');
    let disposals=0;for(const m of fire.meshes)for(const r of [m.geometry,m.material])r.addEventListener('dispose',()=>disposals++);
    fire.dispose();assert.equal(disposals,4);
  }
  assert.deepEqual(frames[0],frames[1]);assert.deepEqual(frames[1],frames[2]);
  const warm=new JakTorchFire(1,false,11),cool=new JakTorchFire(1,true,11);
  for(let b=0;b<2;b++){
    const w=warm.meshes[b].geometry,c=cool.meshes[b].geometry;
    assert.deepEqual(w.getAttribute('centre').array,c.getAttribute('centre').array);
    assert.deepEqual(w.getAttribute('size').array,c.getAttribute('size').array);
    for(let i=0;i<w.instanceCount;i++){
      assert.equal(w.getAttribute('rgba').getX(i),c.getAttribute('rgba').getZ(i));
      assert.equal(w.getAttribute('rgba').getW(i),c.getAttribute('rgba').getW(i));
    }
  }
  warm.dispose();cool.dispose();
  console.log('PASS Jak torch: original launch graph, 30/60/120 Hz parity, warm/blue cues, bounded buffers, extinction/reignition, disposal',reports);
}finally{await server.close();}

// Exercise the actual shared factory, not an isolated copy: Nightworks has
// static torches, ferry-mounted braziers and both phase-pad flame colours.
await withSkateRuntime(async({level,scene,server})=>{
  const {getFlameHeatSource}=await server.ssrLoadModule('/src/flameHeatSource.ts');
  assert.ok(level.torches.length>20);
  for(const torch of level.torches){
    assert.equal(torch.fire.root.parent,torch.group);
    assert.equal(torch.fire.root.userData.jakTorchSource,'group-part-maincave-torch');
    assert.deepEqual(getFlameHeatSource(torch.group).sprites,torch.flames);
  }
  assert.equal(level.torchLights.length,6,'retain pooled lighting');
  const mover=level.movers.find(m=>m.torch);assert.ok(mover);
  const mount=mover.torch.group.position.clone().sub(mover.mesh.position);
  const blue=level.torches.find(t=>t.fire.cool);assert.ok(blue);
  const pad=level.phasePads[0];let off=false,on=false;
  for(let frame=0;frame<720;frame++){
    level.update(1/60);
    if(pad.torches.every(t=>t.burn<.03)){off=true;assert.ok(pad.torches.every(t=>t.fire.diagnostics.particles===0));}
    if(off&&pad.torches.every(t=>t.burn>.95)){on=true;assert.ok(pad.torches.every(t=>t.fire.diagnostics.particles>0));}
  }
  assert.ok(off&&on,'actual pad cycle extinguishes and restores its flames');
  assert.ok(mover.torch.group.position.clone().sub(mover.mesh.position).distanceTo(mount)<1e-6,'ferry carries its whole flame');
  scene.updateMatrixWorld(true);
  assert.ok(level.torchLights.some(light=>light.intensity>0));
  let disposed=0;const expected=level.torches.length*4;
  for(const t of level.torches)for(const m of t.flames)for(const resource of [m.geometry,m.material])resource.addEventListener('dispose',()=>disposed++);
  level.dispose();assert.equal(disposed,expected,'level teardown owns all new GPU resources');
  console.log(`PASS shared torch integration: ${level.torches.length} torches, ferry transforms, both phase colours, full pad cycle, light pool and level disposal`);
},{levelEntry:{id:'dark',name:'The Nightworks'}});
