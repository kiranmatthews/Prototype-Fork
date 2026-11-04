import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const dt=1/60, rows=[];
try {
  const {DiscardedBoards}=await server.ssrLoadModule('/src/skateboard/discarded.ts');
  const material=new THREE.MeshBasicMaterial();
  const geometry=new THREE.BoxGeometry(.45,.12,1.1);
  function fixture() {
    const scene=new THREE.Scene(),support=new THREE.Mesh(new THREE.BoxGeometry(12,1,18),material);
    support.userData.moverId=0;support.position.y=2;scene.add(support);scene.updateMatrixWorld(true);
    const source=new THREE.Group();source.add(new THREE.Mesh(geometry,material));source.position.set(1,2.568,2);
    const pile=new DiscardedBoards(()=>.9);scene.add(pile.root);
    const body=pile.spawn(source),world={groundMeshes:[support],crumbles:[],killY:-30};
    const tick=()=>{scene.updateMatrixWorld(true);pile.update(dt,world);};
    const local=()=>support.worldToLocal(body.root.position.clone());
    return {scene,support,source,pile,body,world,tick,local};
  }
  for(const axis of ['x','y','z','orbit-spin']) {
    const f=fixture();for(let i=0;i<60;i++)f.tick();
    assert.ok(f.body.rest,'board did not settle before platform moved');
    const start=f.local(),q=f.body.root.quaternion.clone();let maxError=0;
    for(let i=1;i<=720;i++) {
      const t=i*dt;
      if(axis==='orbit-spin'){f.support.position.set(4*Math.sin(t),2+Math.sin(t*.6),3*(Math.cos(t)-1));f.support.rotation.y=t*.7;}
      else f.support.position[axis]=(axis==='y'?2:0)+4*Math.sin(t);
      f.tick();maxError=Math.max(maxError,f.local().distanceTo(start));
      assert.ok(maxError<1e-5,`${axis}: sleeping board left platform by ${maxError}m`);
      assert.equal(f.pile.diagnostics.active,0,'sleeping platform board restarted physics');
      const matrix=new THREE.Matrix4();f.body.slots[0].batch.mesh.getMatrixAt(f.body.slots[0].index,matrix);
      f.body.slots[0].batch.mesh.updateWorldMatrix(true,false);
      const rendered=new THREE.Vector3().setFromMatrixPosition(matrix.premultiply(f.body.slots[0].batch.mesh.matrixWorld));
      assert.ok(rendered.distanceTo(f.body.root.position)<2e-5,'batched visual stayed behind the board');
    }
    if(axis==='orbit-spin')assert.ok(f.body.root.quaternion.angleTo(f.support.quaternion.clone().multiply(q))<1e-5,'board did not rotate with its deck');
    rows.push({scenario:axis,maxError,active:f.pile.diagnostics.active});f.pile.dispose();f.support.geometry.dispose();
  }
  // A coasting board keeps relative travel while the platform carries it.
  const moving=fixture(),stationary=fixture();moving.body.velocity.z=stationary.body.velocity.z=-3;
  let maxCoastError=0;
  for(let i=1;i<=90;i++) {
    moving.support.position.x=i*dt*3;moving.support.position.y=2+Math.sin(i*dt)*2;
    moving.tick();stationary.tick();
    maxCoastError=Math.max(maxCoastError,moving.local().distanceTo(stationary.local()));
  }
  assert.ok(maxCoastError<.07,`platform transport changed relative coasting: ${maxCoastError}`);
  rows.push({scenario:'coasting',maxCoastError});moving.pile.dispose();stationary.pile.dispose();
  // External player stepping and the level-owned update must carry only once.
  const handoff=fixture();handoff.tick();
  handoff.support.position.x=.5;handoff.scene.updateMatrixWorld(true);
  handoff.pile.step(handoff.body,dt,handoff.world);const once=handoff.body.root.position.clone();
  handoff.pile.release(handoff.body);handoff.pile.update(dt,handoff.world);
  assert.ok(handoff.body.root.position.distanceTo(once)<1e-8,'player/level handoff carried twice');
  rows.push({scenario:'single-step',x:once.x});handoff.pile.dispose();
  // A larger caller step must not apply the platform delta for every internal
  // substep. Once rolling off, inherit its travel velocity exactly once.
  for(const frameDt of [1/30,1/60,1/120]) {
    const f=fixture();f.pile.update(frameDt,f.world);
    f.body.velocity.z=-12;
    let released=false;
    for(let i=1;i<=240;i++){
      f.support.position.x=i*frameDt*3;f.scene.updateMatrixWorld(true);f.pile.update(frameDt,f.world);
      if(!released&&f.body.root.position.z < -9.1){
        assert.ok(Math.abs(f.body.velocity.x-3)<.01,`lost platform departure speed at ${1/frameDt} Hz`);released=true;
      }
      if(released&&f.body.root.position.y<0)break;
    }
    assert.ok(released,`board did not roll off at ${1/frameDt} Hz`);
    rows.push({scenario:'roll off with momentum',hz:1/frameDt,velocityX:f.body.velocity.x});f.pile.dispose();
  }
  // Removed support wakes the batch and gravity takes over; hidden render
  // meshes still count as collision until removed from the world's support list.
  const gone=fixture();for(let i=0;i<60;i++)gone.tick();
  gone.support.visible=false;gone.support.position.y+=1;gone.tick();assert.ok(gone.body.rest,'render visibility removed support');
  gone.tick(); // Stop the lift before removing it; test gravity independently of departure momentum.
  const height=gone.body.root.position.y;gone.world.groundMeshes=[];for(let i=0;i<15;i++)gone.tick();
  assert.ok(!gone.body.rest&&gone.body.root.position.y<height-.5,'board floated after its support disappeared');
  rows.push({scenario:'removed support',fall:height-gone.body.root.position.y});gone.pile.dispose();
  const crumble=fixture();for(let i=0;i<60;i++)crumble.tick();
  crumble.support.position.y-=2;crumble.world.groundMeshes=[];crumble.tick();
  const actualCenter=new THREE.Box3().setFromObject(crumble.body.root).getCenter(new THREE.Vector3());
  assert.ok(actualCenter.distanceTo(crumble.body.root.position)<1e-6,'waking on a falling support separated geometry from its physics pose');
  crumble.pile.dispose();
  // An airborne board is never parented merely because a platform passes below.
  const air=fixture();air.body.root.position.y=8;air.support.position.x=3;air.tick();
  assert.ok(Math.abs(air.body.root.position.x-1)<1e-8,'airborne board was dragged sideways');air.pile.dispose();
  // Spin hits query the board where the moving batch actually renders.
  const spin=fixture();for(let i=0;i<60;i++)spin.tick();spin.support.position.x=9;spin.tick();
  const box=new THREE.Box3().setFromCenterAndSize(spin.body.root.position,new THREE.Vector3(2,2,2));
  assert.equal(spin.pile.spinAttack(box,{}),1,'moved board could not be hit');
  assert.equal(spin.pile.diagnostics.snapped,1);assert.equal(spin.pile.diagnostics.active,2);
  spin.pile.clear();assert.equal(spin.support.children.length,0,'clear left borrowed board batches on the platform');
  spin.pile.dispose();geometry.dispose();material.dispose();
  console.log(JSON.stringify({pass:true,rows},null,2));
} finally {await server.close();}
