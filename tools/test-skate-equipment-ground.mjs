import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const data=JSON.parse(await readFile(process.argv[2]||'.skate-reference-data/motion.json','utf8'));
await withSkateRuntime(async({server,player:p,THREE})=>{
  const {PlayableSkateMotion}=await server.ssrLoadModule('/src/skateReferenceLab/playableMotion.ts');
  const {boardGroundClearance,groundBoard}=await server.ssrLoadModule('/src/skateReferenceLab/boardGrounding.ts');
  const motion=new PlayableSkateMotion(p,data),board=motion.retarget.board,fit=motion.fitEquipmentGround.bind(motion);
  const plane=new THREE.Plane(),point=new THREE.Vector3();
  // Independent world-vertex oracle includes wheels and hardware, not a deck
  // proxy or the same local-plane formula used by the implementation.
  const clearance=()=>{board.updateWorldMatrix(true,true);let d=Infinity;board.traverse(n=>{
    if(!n.isMesh)return;
    for(let a=n;a&&a!==board;a=a.parent)if(!a.visible)return;
    const vertices=n.geometry.getAttribute('position');
    for(let i=0;i<vertices.count;i++)d=Math.min(d,plane.distanceToPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(n.matrixWorld)));
  });return d;};
  p.rawInput=makeInput();p.grounded=true;p.state='ride';
  let checked=0,minBefore=Infinity,minAfter=Infinity,maxStep=0;const cases=[];
  for(const [height,slope,yaw] of [[0,0,0],[1.4,.22,.8],[2.3,-.30,-1.2]]){
    p.pos.set(0,height,0);p.group.position.copy(p.pos);p.visualYaw=yaw;
    const normal=new THREE.Vector3(.05*slope,1,slope).normalize();p.groundHit={normal,y:height};plane.setFromNormalAndCoplanarPoint(normal,p.pos);
    for(const name of ['BR_STAND_0_INTO_MOUNT','BR_RUN_FWD_0_INTO_MOUNT','BR_DISMOUNT_LO_INTO_STAND_0','BR_DISMOUNT_LO_INTO_RUN_FWD']){
      const phase=name.includes('DISMOUNT')?'dismount':'mount',clip=data.clips.find(c=>c.name===name);
      let before=Infinity,after=Infinity,previous=null,step=0;
      const apply=(time,correct)=>{
        p.playerAnimationBridge.prepareLegacyPose();p.freeSkate=phase==='mount';motion.wasMounted=p.freeSkate;motion.wasGrounded=true;
        motion.enter(phase,name);motion.fade=1;motion.fromPose=null;motion.time=time;motion.fitEquipmentGround=correct?fit:()=>{};
        motion.update({deltaSeconds:0,applyDeformations:v=>p.playerAnimationBridge.applyDeformations(v)});p.group.updateMatrixWorld(true);
      };
      for(let f=0;f<(clip.frames.length-1)*2;f++){
        apply(f/120,false);const raw=clearance();before=Math.min(before,raw);
        const rotation=board.quaternion.clone(),scale=board.scale.clone(),head=motion.retarget.rig.jointsById.get('head').node.getWorldPosition(new THREE.Vector3());
        apply(f/120,true);const corrected=clearance();after=Math.min(after,corrected);checked++;
        assert.ok(corrected>=.002-1e-7,`${name}/${f}/slope ${slope} intersects support: ${corrected}`);
        assert.ok(Math.abs(corrected-boardGroundClearance(board,plane))<1e-8,'clearance formula differs from world geometry');
        assert.ok(board.quaternion.angleTo(rotation)<1e-7&&board.scale.distanceTo(scale)<1e-9,'ground contact changed source board angle or dimensions');
        assert.ok(motion.retarget.rig.jointsById.get('head').node.getWorldPosition(new THREE.Vector3()).distanceTo(head)<1e-9,'ground contact moved the whole rider');
        assert.deepEqual(p.pos.toArray(),[0,height,0],'presentation changed gameplay position');
        const center=board.getWorldPosition(new THREE.Vector3());if(previous)step=Math.max(step,center.distanceTo(previous));previous=center;
      }
      assert.ok(before<-.02,`${name} did not reproduce the original intersection`);
      assert.ok(step<.16,`${name}: board contact jumped ${step} m in one half-frame`);
      minBefore=Math.min(minBefore,before);minAfter=Math.min(minAfter,after);maxStep=Math.max(maxStep,step);cases.push({name,height,slope,before,after,maxStep:step});
    }
  }
  // A late-arriving or rebuilt mesh participates immediately; invisible
  // alternatives do not hold the board up. No cached approximate box.
  plane.set(new THREE.Vector3(0,1,0),0);board.position.set(0,5,0);board.quaternion.identity();
  const late=new THREE.Mesh(new THREE.BoxGeometry(.1,.1,.1),new THREE.MeshBasicMaterial());late.position.y=-20;board.add(late);
  const shift=new THREE.Vector3();assert.ok(groundBoard(board,plane,shift)>0);assert.ok(clearance()>=.002-1e-7);
  late.visible=false;const stable=board.position.clone();assert.equal(groundBoard(board,plane,shift),0);assert.ok(board.position.equals(stable));
  late.removeFromParent();late.geometry.dispose();late.material.dispose();motion.dispose();
  console.log(JSON.stringify({checked,minBefore,minAfter,maxStep,lateAsset:true,cases}));
},{levelEntry:{id:'equipment-ground-test',name:'equipment-ground-test',data:{v:1,name:'equipment-ground-test',spawn:[0,.03,0],killY:-20,components:[{t:'platform',p:[0,-.5,0],s:[100,1,100]},{t:'gate',p:[0,0,-40]}]}}});
