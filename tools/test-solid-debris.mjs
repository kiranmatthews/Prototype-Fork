import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,Level,Player,CONST,server})=>{
  const {DiscardedBoards}=await server.ssrLoadModule('/src/skateboard/discarded.ts');
  const {CharacterBreakApart}=await server.ssrLoadModule('/src/character/breakApart.ts');
  const geo=new THREE.BoxGeometry(20,15,.08),component={t:'mesh',p:[0,5,-3],vertices:Array.from(geo.attributes.position.array),indices:Array.from(geo.index.array),solid:false,nm:'Thin visible stone'};
  const level=new Level(new THREE.Scene(),{id:'hard-debris',name:'Hard debris',data:{v:1,name:'Hard debris',spawn:[0,.02,4],killY:-30,components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},component,{t:'wall',p:[0,-2.5,-3],s:[20,15,.08],invisible:true,nm:'Native wall matching visible stone'},{t:'gate',p:[10,0,10]}]}});
  level.prepareWorldSolids();const results=[];
  try{
    for(const fatal of [false,true]){
      const p=new Player(level.scene);p.enterLevel('hard-debris');p.respawn(level,true,false,{position:new THREE.Vector3(0,3,0),heading:new THREE.Vector3(0,0,-1)});
      if(fatal){p.die();p.respawnTimer=20;}else p.bail(false,40);
      p.state=fatal?'dead':'air';p.grounded=false;p.speed=40;p.vVel=0;p.bailVelocity.set(0,0,-40);
      for(let i=0;i<35;i++){p.step(CONST.fixedStep,makeInput(),level);level.update(CONST.fixedStep);assert.ok(p.pos.z> -2.97,'fallen body crossed hard mesh');}
      results.push({mode:fatal?'corpse':'ragdoll',position:p.pos.toArray(),speed:p.speed});
    }
    const boards=new DiscardedBoards(()=>.9),source=new THREE.Group();source.position.set(0,3,0);source.add(new THREE.Mesh(new THREE.BoxGeometry(.4,.1,1.2)));
    const board=boards.spawn(source);board.velocity.set(0,0,-250);board.angular.set(3,5,8);boards.step(board,.1,level);
    assert.ok(board.root.position.z> -2.9&&board.velocity.z>0,'discarded board failed to rebound from visible mesh');results.push({mode:'board',position:board.root.position.toArray(),velocity:board.velocity.toArray()});boards.dispose();
    const root=new THREE.Group();root.position.set(0,3,0);
    for(const name of ['hips','torso-root','head','shoulder-left','wrist-left','shoulder-right','wrist-right','knee-left','knee-right']){const joint=new THREE.Group();joint.name=name;joint.add(new THREE.Mesh(new THREE.BoxGeometry(.3,.7,.3)));root.add(joint);}
    root.updateMatrixWorld(true);const parts=new CharacterBreakApart(root);parts.request('back',new THREE.Vector3(),false,null,{style:'head-pop'});parts.step(1/60,level,false,10,true);
    const head=parts.parts.find(p=>p.name==='head');head.position.set(0,3,0);head.velocity.set(0,0,-250);parts.restore();parts.step(.1,level,false,10,true);
    assert.ok(head.position.z> -2.95&&head.velocity.z>0,'loose head failed to rebound from visible mesh');results.push({mode:'loose head',position:head.position.toArray(),velocity:head.velocity.toArray()});parts.reset();
    console.log(JSON.stringify({pass:true,results}));
  }finally{geo.dispose();level.dispose();}
});
