import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {MeshBVH,acceleratedRaycast} from 'three-mesh-bvh';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.BANANA_BAY_OUTPUT??'docs/banana-bay-seams';
await mkdir(output,{recursive:true});
const reports=[];
await withBlockworksRuntime(async r=>{
 const {THREE}=r;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const inspect=(water,label,transform=p=>p)=>{
  water.group.updateMatrixWorld(true);
  const mesh=water.group.getObjectByName('Unity curved shoreline ocean ribbon');
  const g=mesh.geometry,p=g.attributes.position,ix=g.index;
  const report={label,triangles:ix.count/3,joinProbes:0,folds:0};
  assert.ok(report.triangles<263168,'wider coverage must stay below the original mesh budget');
  for(let i=0;i<ix.count;i+=3){
   const a=ix.getX(i),b=ix.getX(i+1),c=ix.getX(i+2);
   const area=(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a))-(p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a));
   if(area<=1e-8)report.folds++;
  }
  assert.equal(report.folds,0,label+': no reversed or degenerate water triangles');
  g.boundsTree=new MeshBVH(g);mesh.raycast=acceleratedRaycast;mesh.material.side=THREE.DoubleSide;
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const layers=(x,z)=>{const q=transform(new THREE.Vector3(x,4,z));ray.set(q,down);ray.far=10;return ray.intersectObject(mesh).length;};
  // The former join contained holes and up to three overlapping surfaces.
  for(let z=-726.17;z>-865;z-=2.73)for(let x=-160.31;x<180;x+=3.21){
   assert.equal(layers(x,z),1,`${label}: continuous single surface at ${x},${z}`);report.joinProbes++;
  }
  reports.push(report);return {report,layers};
 };
 window.location.search='';
 const l=new r.Level(r.scene,{id:'beachfront',name:'Banana Bay'});
 try{
  l.root.updateMatrixWorld(true);
  const native=inspect(l.water,'full native');
  const sand=l.root.getObjectByName('Showcase1ContinuousSandSeabed').geometry;
  const p=sand.attributes.position,originalRows=371,columns=65;
  native.report.drySandProbes=0;
  for(let row=4;row<355;row+=2)for(const col of [16,18,24,36]){
   const i=row*columns+col;
   assert.equal(native.layers(p.getX(i),p.getZ(i)),0,'water boundary stays off the actual fine sand contour');
   native.report.drySandProbes++;
  }
  for(const [name,attribute] of Object.entries(sand.attributes))assert.equal(attribute.count,p.count,`sand ${name} covers the welded endcap`);
  assert.equal(p.count,(originalRows+12)*columns);
  for(let i=p.count-columns;i<p.count;i++)assert.ok(p.getY(i)<-2.7,'endcap edge is buried beneath the sea');
  const source=await r.server.ssrLoadModule('/src/beachfront.ts');
  const original=source.createUnityBeachfrontReference({mirrorX:true,cliffs:false});
  try{
   assert.deepEqual(p.array.slice(0,original.sand.geometry.attributes.position.array.length),
     original.sand.geometry.attributes.position.array,'all original sand positions remain exact');
  }finally{original.dispose();}
  const horizon=l.water.group.getObjectByName('Unity ocean horizon fill');
  const ribbon=l.water.group.getObjectByName('Unity curved shoreline ocean ribbon');
  assert.equal(ribbon.material.uniforms.uLandRunup.value,0);
  native.report.dryWaveProbes=0;
  for(let row=355;row<originalRows;row++)for(const col of [20,24,32])for(let time=0;time<14.4;time+=.6){
   const i=row*columns+col,surface=l.water.sampleWaterSurface(p.getX(i),p.getZ(i),time);
   assert.ok(surface.height<p.getY(i),'zero-overlap waves stay beneath dry sand through two surf cycles');native.report.dryWaveProbes++;
  }
  for(const key of ['uCoastMap','uCoastBounds','uHasCoastMap'])assert.equal(horizon.material.uniforms[key],ribbon.material.uniforms[key]);
  assert.equal(horizon.material.uniforms.uHasCoastMap.value,1,'far fill uses the real bed to reveal transparent shallows');
  const captured=l.captureData();
  assert.ok(normalizeCustomLevelData(captured),'native sand and water survive editor normalization');
  for(const invalid of [{ribbonDirection:[0,0]},{ribbonFocus:[80,-80]},{ribbonFocus:[0,Infinity]}]){
   assert.equal(normalizeCustomLevelData({...captured,ocean:{...captured.ocean,...invalid}}),null);
  }
  for(const lite of [false,true]){
   window.location.search=lite?'?lite':'';
   const ocean=structuredClone(captured.ocean);
   // A rotated/translated editor copy must retain the same physical grid.
   ocean.p=[23,-.36,-17];ocean.yaw=37;
   const c=Math.cos(37*Math.PI/180),s=Math.sin(37*Math.PI/180);
   const transform=p=>new THREE.Vector3(23+p.x*c+p.z*s,p.y,-17-p.x*s+p.z*c);
   const copy=new r.Level(r.scene,{id:'banana-water-copy',name:'Water copy',data:{v:1,name:'Water copy',spawn:[0,1,0],killY:-12,components:[],ocean}});
   try{
    const review=inspect(copy.water,lite?'lite editor copy':'full editor copy',transform);
    for(let row=4;row<355;row+=2)for(const col of [18,24,36]){
     const i=row*columns+col;assert.equal(review.layers(p.getX(i),p.getZ(i)),0,'copied water does not clip the dry beach');
    }
    assert.deepEqual(copy.captureData().ocean,ocean);
   }finally{copy.dispose();}
  }
 }finally{l.dispose();}
},{modulePath:'/src/levels/sunny-beach.ts',source:()=>({v:1,name:'Water test host',spawn:[0,1,0],killY:-12,components:[]})});
await writeFile(output+'/water-regression.json',JSON.stringify(reports,null,2));
console.log('PASS Banana Bay water: no folds, overlaps, join holes or dry-shore crossings; exact source sand, welded cap and rotated editor round-trip.',JSON.stringify(reports));
