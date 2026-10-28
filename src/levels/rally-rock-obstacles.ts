import type {CustomComponent} from '../level';
import {cartRallyFrame,rallySurfacePoint} from './cart-stadium-layout';

// Existing Meshy sandstone buttress, reused at full detail and uniform scale.
// Alternating masses pinch the flat racing lane, while leaving the other half
// open for passing. Each sits between the authored takeoff/landing envelopes.
export const RALLY_ROCK_STATIONS=[90,404,785,950,1326,1490,1860,2028,2370,2760,3150,3690,4290,4510] as const;
export function rallyRockObstacles():CustomComponent[]{
 const out:CustomComponent[]=[];
 for(const [i,s]of RALLY_ROCK_STATIONS.entries()){
  const side=i%2?1:-1,u=side*7.4,f=cartRallyFrame(s),yaw=-Math.atan(f.dx)*180/Math.PI;
  const p=rallySurfacePoint(s,u,-1.15),scale=i%3===1?1.5:1.57;
  out.push({t:'decor',dkind:'coastv2buttress',nm:`Rally Meshy rock ${i+1}`,p,w:scale,yaw:yaw+(i%2?180:0),solid:false,scenerySolid:false,color:'#e0c9a5'});
  // A rounded compound body uses the existing native walls/cart contacts.
  // Hidden walls never enter the kart ground sampler or turn into launch pads.
  // Every circle stays inside the substantial lower body of the Meshy source.
  for(const across of [-4.8,0,4.8])for(const along of [-4.8,0,4.8]){
   const x=p[0]+across*f.nx+along*f.nz,z=p[2]+across*f.nz-along*f.nx;
   out.push({t:'wall',nm:`Rally rock contact ${i+1}`,p:[x,p[1],z],s:[7.2,12,7.2],invisible:true});
  }
 }
 return out;
}
