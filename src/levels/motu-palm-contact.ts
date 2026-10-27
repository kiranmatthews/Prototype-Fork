import type {CustomComponent} from '../level';
import {COASTAL_TOWN_ASSETS} from '../coastalTownAssets';

/** Reachable palms use their complete existing GLB for native scenery contact.
 * The soft crown stays separate. Background groves need no contact surfaces. */
export function withMotuPalmContact(source:readonly CustomComponent[]):CustomComponent[]{
  const boundary=source.find(c=>c.nm==='Outer deck parapet');
  if(!boundary?.pts?.length)return [...source];
  const polygon=boundary.pts.map(p=>[p[0]+boundary.p[0],p[1]+boundary.p[2]]);
  return source.map(c=>{
    if(c.t!=='decor'||c.dkind!=='baytrunk')return c;
    const [x,,z]=c.p,size=c.s??COASTAL_TOWN_ASSETS.baytrunk.size;
    const reach=Math.hypot(size[0],size[2])*(c.w??1)/2+.25;
    let inside=false,near=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[j],b=polygon[i],dx=b[0]-a[0],dz=b[1]-a[1];
      if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
      near ||= Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<=reach;
    }
    return inside||near?{...c,solid:true,scenerySolid:true}:c;
  });
}
