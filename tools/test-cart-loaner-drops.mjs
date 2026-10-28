import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile} from 'node:fs/promises';
const bundle=await build({stdin:{contents:"export * from './src/golf-cart/loanerDrops';export * from './src/golf-cart/physics';export * from './src/golf-cart/fleet';export * as THREE from 'three';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {LoanerDrops,LOANER_DROP,GolfCartPhysics,GolfCartFleet,THREE}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const reports=[];
for(const hz of [30,60,144]){
 const w=new GolfCartPhysics(()=>({height:4,grip:1,drag:.08,supported:true,safe:true}),[{x:0,z:0,yaw:.3}],[],{scale:1.25,gravity:24,stableLandings:true,airRecoveryDelay:6,damageCapacity:11.2});
 const d=new LoanerDrops(),roof=new THREE.Group(),root=new THREE.Group();root.add(roof);root.scale.setScalar(1.25);
 const fleet={models:[{modules:{roof}}],kit:{cabinRise:.6},isPresented:()=>true};
 const present=()=>{const c=w.carts[0];root.position.set(c.x,c.y,c.z);root.rotation.y=c.yaw;root.updateMatrixWorld(true);d.present(fleet,w.carts);};
 d.start(0,w);assert.equal(w.carts[0].y,4+LOANER_DROP.height);assert.ok(d.isDescending(0));assert.equal(d.nearest(new THREE.Vector3(0,4,0),w),0);
 const initial=JSON.stringify(w.carts[0]);for(let n=0;n<10;n++)present();assert.equal(JSON.stringify(w.carts[0]),initial,'Presentation cannot advance the descent');
 let time=0,landed=0,landingTime=null,compression=0;
 for(let n=0;n<hz*8;n++){
  w.advance(1/hz,world=>d.control(world));time=(n+1)/hz;const hits=d.update(1/hz,w);landed+=hits.length;present();
  if(hits.length){landingTime=time;compression=w.carts[0].landingCompression;assert.equal(d.isDescending(0),false);}
  for(const drop of d.root.children)drop.traverse(o=>{if(o.isInstancedMesh)assert.ok([...o.instanceMatrix.array].every(Number.isFinite));});
 }
 assert.equal(landed,1);assert.ok(landingTime>5&&landingTime<5.5);assert.ok(compression>.06);assert.equal(w.carts[0].health,1);assert.equal(w.carts[0].rolls,0);assert.equal(w.carts[0].respawns,0);assert.equal(d.activeCount,0);assert.equal(d.root.children.length,0);
 // Repeated deliveries share authored buffers, and a wreck releases its chute.
 const ids=[];for(let n=0;n<3;n++){w.reset(0);d.start(0,w);ids.push(d.root.children[0].getObjectByName('Paneled vented canopy').geometry.uuid);}
 assert.equal(new Set(ids).size,1);assert.equal(d.activeCount,1);w.carts[0].health=0;d.update(1/hz,w);assert.equal(d.isDescending(0),false);d.dispose();assert.equal(d.activeCount,0);
 reports.push({hz,landingTime,compression,health:1,landed,rolls:0,respawns:0,finiteRopes:true,sharedGeometry:true,finiteCleanup:true});
}
// Check actual roof sockets, not only the simplified presentation fixture.
const fleet=new GolfCartFleet({damageVisuals:true,ground:()=>({height:0,grip:1,drag:.08,safe:true,supported:true}),spawns:[{x:4,z:-5,yaw:.7}],physics:{scale:1.25}}),drop=new LoanerDrops();
fleet.setDriver(0,null);fleet.root.add(drop.root);drop.start(0,fleet.physics);
const body=fleet.physics.carts[0];body.pitch=.2;body.roll=-.15;fleet.present(0);drop.present(fleet,fleet.physics.carts);fleet.root.updateMatrixWorld(true);
const rig=drop.root.children[0],cords=rig.getObjectByName('Suspension lines'),roof=new THREE.Box3().setFromObject(fleet.models[0].root.getObjectByName('canopy')),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
let maxRoofError=0;for(let i=0;i<cords.count;i++){cords.getMatrixAt(i,matrix);point.set(0,-.5,0).applyMatrix4(matrix);cords.localToWorld(point);maxRoofError=Math.max(maxRoofError,roof.distanceToPoint(point));}
assert.ok(maxRoofError<.12,'Every suspension line terminates on the actual pitched/rolled cart roof');
const visibleGeometry=rig.getObjectByName('Paneled vented canopy').geometry.uuid;fleet.visible[0]=false;drop.present(fleet,fleet.physics.carts);assert.equal(rig.visible,false);fleet.visible[0]=true;drop.present(fleet,fleet.physics.carts);assert.equal(rig.visible,true);assert.equal(rig.getObjectByName('Paneled vented canopy').geometry.uuid,visibleGeometry,'Visibility never substitutes the authored canopy');
drop.dispose();fleet.dispose();
const report={passed:true,settings:LOANER_DROP,cases:reports,actualRoofAttachment:{maxError:maxRoofError,allLines:16},visibilityPreservesGeometry:true};await writeFile(process.env.CART_DROP_REPORT??'/private/tmp/cart-loaner-drops.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
