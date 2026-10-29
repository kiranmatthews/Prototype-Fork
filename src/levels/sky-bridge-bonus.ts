import type { CustomComponent, CustomLevelData, DecorKind } from '../level';
import { SKY_BRIDGE_LEVEL } from './sky-bridge';

type P = [number, number, number];

/** Cloudtop Lockers uses the parent's masonry, temples and soft cloud banks.
 * Only the supporting courts and scenery are dressed;
 * crate decisions, the relay chasm and the side-view camera remain authored. */
export function dressSkyBridgeBonus(data: CustomLevelData): void {
  const art: CustomComponent[] = [];
  const put = (c: CustomComponent) => art.push({...c, solid:false, edgeGrinding:false, grp:90});
  const asset = (dkind: DecorKind, p: P, s: P, nm: string, color='#d8dfd9', yaw=0) =>
    put({t:'decor', dkind, p, s, nm, color, yaw});
  const stone = (a:number, b:number, z=0, depth=6.4, top=0, scenic=false) => {
    const w=b-a, x=w/2, d=depth/2, k=.35;
    const c:CustomComponent={t:'platform',p:[(a+b)/2,top-.65,z],s:[w,1.3,depth],
      pts:[[-x+k,d],[x-k,d],[x,d-k],[x,-d+k],[x-k,-d],[-x+k,-d],[-x,-d+k],[-x,d-k]],
      tex:'coast-stone',color:'#d6cfb8',grp:1,nm:'Cloudtop masonry anchor landing'};
    if(scenic) {
      const vertices:number[]=[],indices:number[]=[];
      for(const y of [-.65,.65])for(const [x,z] of c.pts!)vertices.push(x,y,z);
      for(let i=1;i<7;i++)indices.push(8,8+i,9+i,0,i+1,i);
      for(let i=0;i<8;i++){const j=(i+1)%8;indices.push(i,j,8+j,i,8+j,8+i);}
      put({t:'mesh',p:c.p,vertices,indices,tex:c.tex,color:c.color,nm:c.nm});
    }else data.components.push(c);
    asset('coastv2ledge',[(a+b)/2,top-13,z],[w+1.2,11.8,depth+1.4],'Cloudtop anchor cliff cap');
    for(const [bottom,height,extra] of [[-35,27,1.8],[-65,39,3],[-110,52,5]])
      asset('coastv2buttress',[(a+b)/2,top+bottom,z],[w+extra,height,depth+3],
        'Continuous Cloudtop anchor shaft','#c8d4d5');
  };

  // The kit's original supported intervals are [-10,7] and [21,69].
  // Keep those exact extents and the top at Y=0, including below the finite
  // bounce stack. The four metal stepping stones still own the open chasm.
  data.components=data.components.filter(c=>c.grp!==90 && !(c.t==='mesh'&&c.grp===1));
  for(const c of data.components)if(c.t==='pit')c.invisible=true;
  stone(-10,7);stone(52,69);
  // The same exact flat support and crate puzzle, with two floating clouds
  // replacing the receiver court and timber bridge. No cloud closes the relay.
  for(const [i,[a,b]] of [[21,29],[29,52]].entries())
    data.components.push({t:'platform',p:[(a+b)/2,-.09,0],s:[b-a,.18,6.4],cloudRoad:true,
      seed:23747+i*1193,tex:'solid',grp:1,nm:'Cloudtop cumulus landing'});

  // The relay is visibly rooted in slender carved piers, without new footing
  // above or beside its existing metal crates, or a rope bypass over the gap.
  for(const x of [9.2,12.4,15.6,18.8]) {
    asset('coastpillar',[x,-12,0],[.82,12,.82],'Carved pier below a relay steel anchor','#ddd3bb');
    asset('coastv2buttress',[x,-42,0],[1.5,31,1.7],'Relay pier root below the cloud line','#c8d4d5');
  }

  for(const x of [-2,60.5])
    asset('coastarch',[x,0,-2.65],[11.8,8.2,2.1],'Cloudtop temple portal on masonry','#e4d8bd');
  // Coping along the back of each court stays clear of the jumping silhouette.
  for(const [a,b] of [[-9.7,6.7],[52.3,68.7]])
    put({t:'decor',dkind:'block',p:[(a+b)/2,.19,-3],s:[b-a,.38,.32],tex:'coast-stone',
      color:'#bfb69c',nm:'Weathered rear temple coping'});

  // Full-detail parent assets at several depths; no substitute silhouettes.
  for(const [i,x] of [-24,14,44,83].entries()) {
    const z=-25-(i%2)*12;
    asset('coastspire',[x,-42,z],[13,46+(i%2)*8,11],
      'Cloud spire upper cliff','#dbe6eb',i*63);
    asset('coastv2buttress',[x,-105,z],[18,76,16],
      'Cloud spire continuing below view','#d0dfe4',i*63);
  }
  stone(30,43,-22,9,1.8,true);
  asset('coastarch',[36.5,1.8,-23],[12.4,8.6,3.5],
    'Distant sister sanctuary above the clouds','#e4d8bd');
  for(const [i,[x,y,z,w,d]] of [[-15,-7,-18,18,12],[14,-6,-28,22,14],[45,-8,-16,20,12],[76,-5,-24,18,12]].entries())
    put({t:'platform',p:[x,y-.09,z],s:[w,.18,d],cloudRoad:true,tex:'solid',seed:30803+i*1723,
      nm:'Cloudtop floating cumulus scenery'});
  data.components.push(...art);
  data.groups??=[];
  data.groups.push({id:90,nm:'Sky Bridge temple and suspension construction',editorOnly:true});
  data.sky=SKY_BRIDGE_LEVEL.sky;
  data.keepPlayFog=true;
  // The bonus camera sits about 20 m farther from the play plane. Offset
  // distance fog by that amount so the same stone/wood palette stays clear
  // at the player's feet while the rear temples retain the parent's haze.
  data.atmosphere={...structuredClone(SKY_BRIDGE_LEVEL.atmosphere),
    fogNear:SKY_BRIDGE_LEVEL.atmosphere!.fogNear!+20,
    fogFar:SKY_BRIDGE_LEVEL.atmosphere!.fogFar!+20};
}
