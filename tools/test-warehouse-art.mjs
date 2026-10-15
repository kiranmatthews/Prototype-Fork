import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const replay=JSON.parse(await readFile(new URL('./fixtures/warehouse-bank-collision.json',import.meta.url),'utf8'));
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p,CONST})=>{
 level.dispose();const {WAREHOUSE_PARK_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {normalizeCustomLevelData,setEditorBuild}=await server.ssrLoadModule('/src/level.ts');
 const {warehouseFlicker}=await server.ssrLoadModule('/src/warehouseArt.ts');
 const {fitWarehouseWallSection}=await server.ssrLoadModule('/src/warehouseWallSections.ts');
 const sourceWall=new THREE.PlaneGeometry(10,8).translate(0,4,0);
 const pier=fitWarehouseWallSection(sourceWall,[10,8,1],[3,8,1]);
 const wallPosition=pier.getAttribute('position'),wallUv=pier.getAttribute('uv');
 for(let i=0;i<wallPosition.count;i++){
  assert.ok(Math.abs(wallUv.getX(i)-(.5+wallPosition.getX(i)/10))<1e-6,'narrow piers crop the source atlas without stretching it');
  assert.ok(Math.abs(wallUv.getY(i)-wallPosition.getY(i)/8)<1e-6);
 }
 assert.equal(pier.boundingBox.max.x-pier.boundingBox.min.x,3);assert.equal(pier.boundingBox.max.y-pier.boundingBox.min.y,8);
 sourceWall.dispose();pier.dispose();
 const {surfaceBoundaryEdges}=await server.ssrLoadModule('/src/surfaceEdges.ts');
 const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
 assert.equal(normalizeCustomLevelData(structuredClone(data)).warehouseArt,true);
 assert.equal(data.skatepark,true,'warehouse retains the competition chase rig');
 assert.equal(data.alwaysSkate,false,'the competition camera does not force boarding');
 assert.equal(data.cameraRig,undefined,'warehouse uses the shared competition-camera calibration');
 const core=data.components.filter(c=>c.grp!==208),baseline={...data,warehouseArt:false,components:core};
 const bare=new Level(scene,{id:'warehouse',name:data.name,data:baseline});
 const dressed=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
 const geometry=(l)=>l.groundMeshes.filter(m=>Number.isInteger(m.userData.editorIdx)&&m.userData.editorIdx<core.length).map(m=>{
  const g=m.geometry,position=g.getAttribute('position'),index=g.index,triangles=[];
  for(let i=0;i<(index?.count??position.count);i+=3){const v=[];for(let j=0;j<3;j++){const k=index?index.getX(i+j):i+j;v.push([position.getX(k),position.getY(k),position.getZ(k)].join(','));}triangles.push(v.sort().join('|'));}
  const sides=[...new Set((Array.isArray(m.material)?m.material:[m.material]).map(m=>m.side))].sort();
  return {component:m.userData.editorIdx,name:m.name,matrix:m.matrixWorld.toArray(),sides,
   geometry:createHash('sha256').update(triangles.sort().join('\n')).digest('hex'),parameters:g.parameters??null,
   grindBoundaries:surfaceBoundaryEdges(m).map(edge=>edge.map(p=>p.toArray().join(',')).sort().join('|')).sort()};
 }).sort((a,b)=>a.component-b.component||a.name.localeCompare(b.name));
 assert.deepEqual(geometry(dressed),geometry(bare),'art cannot change native triangle support, grind boundaries, side tests, transforms or primitive dimensions');
 assert.equal(dressed.movers[0].mesh.geometry.parameters.height,.8,'lift dimensions survive render UV expansion');
 let triangles=0;
 for(const mesh of dressed.groundMeshes){
  if(!mesh.material?.userData?.warehouseSurface)continue;
  const g=mesh.geometry,pos=g.getAttribute('position'),uv=g.getAttribute('uv'),index=g.index;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),triangle=new THREE.Triangle(a,b,c);
  for(let i=0;i<(index?.count??pos.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k);a.fromBufferAttribute(pos,ids[0]);b.fromBufferAttribute(pos,ids[1]);c.fromBufferAttribute(pos,ids[2]);if(triangle.getArea()<1e-8)continue;
   const [ia,ib,ic]=ids,area=(uv.getX(ib)-uv.getX(ia))*(uv.getY(ic)-uv.getY(ia))-(uv.getY(ib)-uv.getY(ia))*(uv.getX(ic)-uv.getX(ia));
   assert.ok(Number.isFinite(area)&&Math.abs(area)>1e-12,`collapsed PBR UV on ${mesh.name}`);triangles++;
  }
 }
 const traces=[];for(const l of[bare,dressed]){
  p.competitionMode=false;p.endlessDeaths=replay.endlessDeaths;p.enterLevel('warehouse');p.respawn(l,true);
  const take=new Replayer(),input=makeInput(),trace=[];take.begin(replay);
  try{for(let f=0;f<replay.frames;f++){take.feed(input,p.camDir);p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);input.consumeEdges();trace.push([...p.pos.toArray(),p.speed,p.vVel,p.state,p.grounded]);}}
  finally{take.end();}traces.push(trace);
 }
 for(let f=0;f<replay.frames;f++){for(let i=0;i<5;i++)assert.ok(Math.abs(traces[0][f][i]-traces[1][f][i])<1e-7,`art changed replay frame ${f}, field ${i}`);assert.deepEqual(traces[0][f].slice(5),traces[1][f].slice(5));}
 const flicker=Array.from({length:1200},(_,i)=>warehouseFlicker(i/60,1));assert.ok(Math.min(...flicker)>=.27&&Math.min(...flicker)<.4&&Math.max(...flicker)<=1.03);
 const sameSpawn=dressed.currentSpawn.toArray();assert.deepEqual(sameSpawn,bare.currentSpawn.toArray());
 bare.dispose();dressed.dispose();
 setEditorBuild(true);const editorLevel=new Level(scene,{id:'warehouse',name:data.name,data});
 const ids=new Set();editorLevel.root.traverse(o=>{if(o.type==='Group'&&Number.isInteger(o.userData.editorIdx)&&data.components[o.userData.editorIdx]?.dkind?.startsWith('warehouse'))ids.add(o.userData.editorIdx);});
 assert.ok(ids.size>=100,'editor keeps individually addressable warehouse props');editorLevel.dispose();setEditorBuild(false);
 const report={nativeSurfaces:geometry(dressed).length,checkedUvTriangles:triangles,replayFrames:replay.frames,replayIdentical:true,editorProps:ids.size,flickerRange:[Math.min(...flicker),Math.max(...flicker)]};
 if(process.env.WAREHOUSE_ART_REPORT)await writeFile(process.env.WAREHOUSE_ART_REPORT,JSON.stringify(report,null,2));
 console.log('PASS native geometry/side/dimension invariants, finite PBR UVs, identical recorded movement, bounded flicker and individual editor props',JSON.stringify(report));
});
