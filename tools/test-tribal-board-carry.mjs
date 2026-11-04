import assert from 'node:assert/strict';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

const base={v:1,name:'Tribal board support',spawn:[0,.1,0],killY:-80,components:[
  {t:'platform',p:[0,-.5,0],s:[10,1,10]}, {t:'gate',p:[0,0,-3]},
]};
await withSkateRuntime(async({THREE,Level,server})=>{
  const {TRIBAL_RUN_LEVEL}=await server.ssrLoadModule('/src/levels/tribal-run.ts');
  const data={...base,components:[...base.components,...TRIBAL_RUN_LEVEL.components.filter(c=>c.t==='mover')]};
  const level=new Level(new THREE.Scene(),{id:'tribal-board-support',name:data.name,data});
  const {DiscardedBoards}=await server.ssrLoadModule('/src/skateboard/discarded.ts');
  const {createSkateboardPresentation}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const template=createSkateboardPresentation();template.updateMatrixWorld(true);
  const bottom=new THREE.Box3().setFromObject(template).min.y;
  const pile=new DiscardedBoards(()=>.9);level.root.add(pile.root);
  const records=[];
  try {
    level.update(0);level.update(0);level.root.updateMatrixWorld(true);
    for(const mover of level.movers){
      mover.mesh.geometry.computeBoundingBox();
      const source=template.clone(true);
      const local=new THREE.Vector3(.6,mover.mesh.geometry.boundingBox.max.y-bottom+.012,0);
      source.position.copy(local).applyMatrix4(mover.mesh.matrixWorld);source.quaternion.copy(mover.mesh.quaternion);
      const board=pile.spawn(source);pile.release(board);
      records.push({mover,board,local,maxError:0});
    }
    assert.equal(records.length,29,'expected all authored Tribal Run movers');
    // Establish contact before the first movement, just as a landed board does.
    pile.update(1/60,level);
    for(let i=0;i<240;i++){level.update(1/60);pile.update(1/60,level);}
    for(const r of records)assert.ok(r.board.rest && r.board.support===r.mover.mesh,`mover ${r.mover.mesh.userData.moverId}: board did not settle on its original deck`);
    for(const r of records)r.local.copy(r.mover.mesh.worldToLocal(r.board.root.position.clone()));
    for(let i=0;i<1800;i++){
      level.update(1/60);pile.update(1/60,level);
      for(const r of records){
        const error=r.mover.mesh.worldToLocal(r.board.root.position.clone()).distanceTo(r.local);
        r.maxError=Math.max(r.maxError,error);
        assert.ok(error<.01,`frame ${i}, mover ${r.mover.mesh.userData.moverId}: board drifted ${error}m`);
        assert.ok(r.board.root.visible,'platform board was retired');
      }
    }
    assert.equal(pile.diagnostics.settledPieces,29);
    assert.equal(pile.diagnostics.active,0);
    const surfaces=level.worldSolids.diagnostics.surfaces;
    const staticSource=template.clone(true);staticSource.position.set(2,-bottom+.012,0);
    const staticBoard=pile.spawn(staticSource);pile.release(staticBoard);
    for(let i=0;i<120;i++){level.update(1/60);pile.update(1/60,level);}
    assert.ok(staticBoard.rest,'static deck stopped settling');
    assert.equal(level.worldSolids.diagnostics.surfaces,surfaces,'resting board batch became a new scenery collider');
    console.log(JSON.stringify({pass:true,staticColliderCountPreserved:true,seconds:30,movers:records.length,maxError:Math.max(...records.map(r=>r.maxError)),pile:pile.diagnostics},null,2));
  }finally{pile.dispose();level.dispose();template.traverse(object=>{object.geometry?.dispose();});}
},{levelEntry:{id:'board-support-base',name:base.name,data:base}});
