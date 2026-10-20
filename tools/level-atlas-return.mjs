// Register annotations from a Figma frame, exported SVG, or screenshot using
// the map's A/B/C reference crosses. D independently checks the registration.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export function registerPoint(projection, point, anchors=projection.anchors.map(a=>a.svg)) {
  if(anchors.length<3 || ![...point,...anchors.flat()].every(Number.isFinite))throw new Error('Provide finite point coordinates and at least A, B, C');
  const [a,b,c,d]=anchors, ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-a[0],vy=c[1]-a[1];
  const det=ux*vy-uy*vx;
  if(Math.abs(det)<1e-8)throw new Error('Reference crosses are collinear or collapsed');
  const px=point[0]-a[0],py=point[1]-a[1];
  const u=(px*vy-py*vx)/det,v=(ux*py-uy*px)/det;
  const residual=d?Math.hypot(d[0]-(b[0]+c[0]-a[0]),d[1]-(b[1]+c[1]-a[1])):null;
  if(residual!==null&&residual>Math.max(3,Math.min(Math.hypot(ux,uy),Math.hypot(vx,vy))*.005))throw new Error(`D reference disagrees by ${residual.toFixed(2)} pixels. The image is distorted or the references were moved separately.`);
  return {worldX:projection.minX+u*(projection.maxX-projection.minX),worldZ:projection.minZ+v*(projection.maxZ-projection.minZ),registrationResidualPixels:residual};
}
export function nearbyObjects(manifest,point,radius=5) {
  return manifest.objects.map(o=>{
    const b=o.bounds,dx=Math.max(b.min[0]-point.worldX,0,point.worldX-b.max[0]),dz=Math.max(b.min[2]-point.worldZ,0,point.worldZ-b.max[2]);
    return {id:o.id,name:o.name,kind:o.kind,distanceToBounds:Math.hypot(dx,dz),heightRange:[b.min[1],b.max[1]],componentIndex:o.componentIndex,componentHash:o.componentHash,authored:o.authored};
  }).filter(o=>o.distanceToBounds<=radius).sort((a,b)=>a.distanceToBounds-b.distanceToBounds||b.heightRange[1]-a.heightRange[1]);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [manifestPath,x,y,anchorsJson]=process.argv.slice(2);
  if(!manifestPath||x===undefined||y===undefined){console.error('Usage: node tools/level-atlas-return.mjs <map.json> <image-x> <image-y> \'[[Ax,Ay],[Bx,By],[Cx,Cy],[Dx,Dy]]\'\nOmit the final argument for original SVG/frame-local coordinates.');process.exit(1);}
  const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
  const result=registerPoint(manifest.projection,[Number(x),Number(y)],anchorsJson?JSON.parse(anchorsJson):undefined);
  console.log(JSON.stringify({levelId:manifest.levelId,snapshot:manifest.snapshotId,...result,nearby:nearbyObjects(manifest,result)},null,2));
}
