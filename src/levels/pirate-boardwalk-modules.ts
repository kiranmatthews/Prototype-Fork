import type { CustomComponent } from '../level';
import { DROWNED_CROWN_SECTION_MODELS, DROWNED_BOARDWALK_DECK_HEIGHT, DROWNED_BOARDWALK_Z_BOUNDS } from '../drownedCrownSections.generated';
import { DROWNED_BOARDWALK_GROUND } from '../drownedCrownSectionGround.generated';
import type { P } from './pirate-meshes';

// These are collision samples of the Meshy model, never visible geometry. A
// half-resolution grid keeps a long run of complete modules inside editor limits.
const ground={vertices:[] as number[],indices:[] as number[]};
for(let z=0;z<=64;z+=2)for(let x=0;x<=16;x+=2){
 const i=(z*17+x)*3;ground.vertices.push(...DROWNED_BOARDWALK_GROUND.vertices.slice(i,i+3));
}
for(let z=0;z<32;z++)for(let x=0;x<8;x++){
 const i=z*9+x;ground.indices.push(i,i+9,i+10,i,i+10,i+1);
}

/** Place an intact provider-made jetty between measured deck endpoints. */
export function pirateBoardwalkModule(nm:string,a:P,b:P,width=5.25):CustomComponent[]{
 const original=DROWNED_CROWN_SECTION_MODELS.crowncrashboardwalk.size;
 const length=Math.hypot(b[0]-a[0],b[2]-a[2]),deckY=(a[1]+b[1])*.5,base=-11;
 const heightScale=(deckY-base)/DROWNED_BOARDWALK_DECK_HEIGHT;
 const [lo,hi]=DROWNED_BOARDWALK_Z_BOUNDS,size:P=[width,original[1]*heightScale,length/(hi-lo)];
 const angle=Math.atan2(a[0]-b[0],a[2]-b[2]),shift=(lo+hi)*.5*size[2];
 const position:P=[(a[0]+b[0])*.5-Math.sin(angle)*shift,base,(a[2]+b[2])*.5-Math.cos(angle)*shift];
 const yaw=angle*180/Math.PI;
 return [
  {t:'decor',dkind:'crowncrashboardwalk',p:position,s:size,yaw,scenerySolid:true,nm:nm+' · complete Meshy boardwalk'},
  {t:'mesh',p:position,s:size,yaw,...ground,solid:true,artProxy:true,doubleSided:true,
   tex:'solid',color:'#4b3d2d',nm:nm+' · sampled Meshy deck support'},
 ];
}
