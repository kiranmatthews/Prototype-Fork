import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/quality-pass';
const bundle=await build({stdin:{contents:"export * as THREE from 'three';export {applyKookPolygonUVs} from './src/rooftopKookAssets';export {ROOFTOP_RELAY_LEVEL} from './src/levels/codex-lab';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const {THREE,applyKookPolygonUVs,ROOFTOP_RELAY_LEVEL:data}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const report={polygons:[],meshFaces:0,unchangedGameplay:null};
for(const c of data.components.filter(c=>c.pts&&['platform','wall'].includes(c.t)&&c.tex?.startsWith('kook-'))){
 const points=c.pts,shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z))),g=new THREE.ExtrudeGeometry(shape,{depth:c.s[1],bevelEnabled:false});g.rotateX(-Math.PI/2);g.computeBoundingBox();
 const before=g.clone(),bounds=g.boundingBox.clone(),width=bounds.max.x-bounds.min.x,depth=bounds.max.z-bounds.min.z,wall=c.t==='wall';
 const w=wall?Math.max(width,depth):width,d=wall?c.s[1]+2:depth;applyKookPolygonUVs(g,points,w,d,wall);
 assert.ok(bounds.equals(g.boundingBox),'The surface envelope must not change');
 const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,repeat=[Math.max(1,Math.round(w/4))*4,Math.max(1,Math.round(d/4))*4];
 let minRatio=Infinity,maxRatio=0,area=0;
 const sideVertices=geometry=>{const p=geometry.attributes.position,n=geometry.attributes.normal;return Array.from({length:p.count},(_,i)=>i).filter(i=>Math.abs(n.getY(i))<.6).map(i=>[p.getX(i),p.getY(i),p.getZ(i)]);};
 assert.deepEqual(sideVertices(g),sideVertices(before),'Original wall faces and perimeter vertices must survive');
 for(let i=0;i<p.count;i+=3){
  const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1).sub(a),d=new THREE.Vector3().fromBufferAttribute(p,i+2).sub(a),normal=b.clone().cross(d),worldArea=normal.length()/2;
  const du=[(uv.getX(i+1)-uv.getX(i))*repeat[0],(uv.getY(i+1)-uv.getY(i))*repeat[1]],dv=[(uv.getX(i+2)-uv.getX(i))*repeat[0],(uv.getY(i+2)-uv.getY(i))*repeat[1]],uvArea=Math.abs(du[0]*dv[1]-du[1]*dv[0])/2;
  if(worldArea<1e-7)continue;
  assert.ok(uvArea>1e-7,c.nm+' must not collapse texture coordinates');
  assert.ok(normal.normalize().dot(new THREE.Vector3().fromBufferAttribute(n,i))>.999,'Face winding must match its unchanged outward normal');
  const ratio=uvArea/worldArea;minRatio=Math.min(minRatio,ratio);maxRatio=Math.max(maxRatio,ratio);
  if(n.getY(i)>.6)area+=worldArea;
 }
 const polygonArea=Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
 assert.ok(Math.abs(area-polygonArea)<.001,'Retriangulation must cover exactly the original footprint');
 assert.ok(minRatio>.55&&maxRatio<1.8,`${c.nm}: texture density ${minRatio}..${maxRatio}`);
 if(!wall)assert.ok(g.userData.kookRoofSections>=2,'Every authored flat roof must use matching cross-sections');
 const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),oldMesh=new THREE.Mesh(before,material),newMesh=new THREE.Mesh(g,material),ray=new THREE.Raycaster();let samples=0;
 for(let x=bounds.min.x+.07;x<bounds.max.x;x+=1.13)for(let z=bounds.min.z+.11;z<bounds.max.z;z+=1.27){
  ray.set(new THREE.Vector3(x,bounds.max.y+1,z),new THREE.Vector3(0,-1,0));const a=ray.intersectObject(oldMesh)[0],b=ray.intersectObject(newMesh)[0];assert.equal(!!a,!!b,'Supported footprint changed');if(a)assert.ok(Math.abs(a.point.y-b.point.y)<1e-5,'Surface height changed');samples++;
 }
 report.polygons.push({name:c.nm,wall,sections:g.userData.kookRoofSections,triangles:p.count/3,minRatio,maxRatio,samples});g.dispose();before.dispose();material.dispose();
}
for(const c of data.components.filter(c=>c.t==='mesh'&&c.nm?.startsWith('RR:')&&c.uvs))for(let i=0;i<c.indices.length;i+=3){
 const ids=c.indices.slice(i,i+3),[a,b,d]=ids.map(id=>new THREE.Vector3(...c.vertices.slice(id*3,id*3+3))),area=b.clone().sub(a).cross(d.clone().sub(a)).length()/2;
 if(area<1e-7)continue;
 const [u,v,w]=ids.map(id=>c.uvs.slice(id*2,id*2+2)),uvArea=Math.abs((v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]))/2;
 assert.ok(uvArea>1e-9,`${c.nm} triangle ${i/3} has collapsed fascia UVs`);report.meshFaces++;
}
if(process.env.ROOF_BEFORE){
 const old=JSON.parse(await readFile(process.env.ROOF_BEFORE,'utf8'));
 const gameplay=level=>level.components.filter(c=>(c.grp??0)<450&&!(c.t==='mesh'&&c.solid===false)).map(({uvs,normals,...c})=>c);
 assert.deepEqual(gameplay(data),gameplay(old),'Every gameplay component, collider vertex, pickup and enemy stays unchanged');
 for(const key of ['spawn','killY','cameraRig','atmosphere'])assert.deepEqual(data[key],old[key]);report.unchangedGameplay=true;
}
await mkdir(out,{recursive:true});await writeFile(out+'/uv-audit.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS roof UV density, winding, preserved boundaries/heights, side texture seams and pitched fascia',JSON.stringify({polygons:report.polygons.length,meshFaces:report.meshFaces,rays:report.polygons.reduce((s,p)=>s+p.samples,0),unchangedGameplay:report.unchangedGameplay}));
