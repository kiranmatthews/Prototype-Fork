import type {CustomComponent,CustomLevelData,DecorKind} from '../level';
import {HAUNTED_ISLAND_ATMOSPHERE} from './blockworks-art';

/** The existing bonus puzzle, dressed with the main course's actual Meshy kit.
 * Reordering the box vertices keeps every native triangle in the same place,
 * while exposing its +X riding face to the shared surface fitter. */
export function dressBlockworksBonus(data:CustomLevelData):void{
  const native=[...data.components],art:CustomComponent[]=[];
  const put=(kind:DecorKind,nm:string,p:[number,number,number],s:[number,number,number],yaw=0)=>
    art.push({t:'decor',dkind:kind,nm,p,s,yaw,grp:90,solid:false,scenerySolid:false,edgeGrinding:false});
  const prop=(kind:DecorKind,nm:string,p:[number,number,number],height:number,yaw=0)=>
    art.push({t:'decor',dkind:kind,nm,p,rise:height,yaw,grp:90,solid:false,scenerySolid:false,edgeGrinding:false});
  const stoneFloors:{a:number;b:number;y:number}[]=[];
  for(const c of native){
    if(c.t==='pit')c.invisible=true;
    if(c.t==='crate'&&c.kind==='bang')c.dkind='bw-steel-switch';
    if(c.t==='crate'&&c.kind==='metal')c.dkind='bw-steel-block';
    if(c.t!=='mesh'||!c.s||c.vertices?.length!==24||c.indices?.length!==36)continue;
    const scale=c.s,source=c.vertices,order=[3,7,6,2,0,4,5,1],inverse=order.map((_,i)=>order.indexOf(i));
    if(!c.outline)stoneFloors.push({a:c.p[0]-scale[0]/2,b:c.p[0]+scale[0]/2,y:c.p[1]+scale[1]/2});
    c.vertices=order.flatMap(i=>[source[i*3]*scale[0],source[i*3+1]*scale[1],source[i*3+2]*scale[2]]);
    c.indices=c.indices.map(i=>inverse[i]);c.s=[1,1,1];
    c.dkind=c.outline?'bw-rivet-deck-v2':'bw-flagstone-deck-v4';
    if(!c.outline)c.artProxy=true;
  }

  // Castle foundations stop at every real chasm. Nothing props up the ghost
  // gallery or bridge before its switch is pressed.
  for(const floor of stoneFloors){
    const bays=Math.ceil((floor.b-floor.a)/8),width=(floor.b-floor.a)/bays;
    for(let i=0;i<bays;i++){
      const x=floor.a+(i+.5)*width;
      put('bw-viaduct-v2','Haunted bonus · gothic bridge foundation',[x,floor.y-12.4,-.15],[width+.08,11.55,5.8]);
      prop('bw-hanging-vines','Haunted bonus · ivy below the front ledge',[x+.8,floor.y-3.8,2.7],3.0,i%2?15:-10);
      if(i%2===0){
        put('bw-parapet-v2','Haunted bonus · rear coping',[x,floor.y-.06,-3.55],[width,.62,.88]);
        prop('bw-foliage','Haunted bonus · ferns on rear coping',[x-1.4,floor.y-.25,-3.35],1.1,i*31);
      }
    }
    // Warm lamps meet the rear coping; keep the near edge open to the camera.
    for(let x=floor.a+2;x<floor.b-1;x+=12)prop('bw-lantern','Haunted bonus · attached amber lantern',[x,floor.y-.3,-3.55],1.85);
  }

  put('bw-toxic-basin','Haunted bonus · toxic bridge basin',[51,-11,0],[25,4.6,25]);
  put('bw-sludge-outfall','Haunted bonus · dripping return outfall',[51,-4.6,-10],[2.6,3.7,6]);
  put('bw-sludge-stream','Haunted bonus · toxic flow',[51,-7, -7.7],[2,4.1,2]);

  // Nearby scenery forms three connected courts behind the side-view play
  // plane. It never enters the player's collision or camera blocker lists.
  for(const [x,z,h]of [[-8,-12,15],[15,-18,22],[32,-13,17],[67,-17,21],[91,-15,19],[111,-12,17]]){
    prop('bw-cliff','Haunted bonus · rooted castle island',[x,-27,z],26,35+x);
    put('bw-jungle-shelf-v2','Haunted bonus · overgrown island shoulder',[x,-9.2,z],[14,8,11],x%2?24:-18);
    prop('bw-spire-v2','Haunted bonus · purple-roof castle spire',[x,-8,z-1],h);
    prop('bw-palm','Haunted bonus · palm beside the masonry',[x+4,-1.5,z+2],8+(x%3),x*11);
    prop('bw-foliage','Haunted bonus · island crown planting',[x-3,-1.5,z+3],2.2,x*7);
  }
  for(const [x,z]of [[2,-9],[26,-10],[73,-10],[100,-9]]){
    put('bw-cliff','Haunted bonus · buttress footing',[x,-18,z],[9,17,8],x*3);
    prop('bw-buttress','Haunted bonus · mossy castle buttress',[x,-1.8,z],8.2);
  }

  // The switch-built crossing belongs to the same abandoned ride machinery
  // as the main foundry. Hoists stand on modeled rock shoulders at each bank.
  for(const x of [40,62]){
    put('bw-cliff','Haunted bonus · hoist island',[x,-12.6,-6.8],[7,12.4,6]);
    prop('bw-winch','Haunted bonus · bridge hoist',[x,-.45,-6.5],3.7,x===40?0:180);
    prop('bw-foliage','Haunted bonus · reclaimed hoist footing',[x+2,-.6,-6],1.5,x*3);
  }
  put('bw-coaster-v2','Haunted bonus · derelict coaster behind the works',[51,-10.5,-23],[29,15,3.6]);
  prop('bw-wheel','Haunted bonus · abandoned park wheel',[52,-13,-42],31,8);
  prop('bw-turret','Haunted bonus · return-court tower',[106,-10,-22],25,-8);

  // Reuse the shared, fixed distant world. No camera-facing or room-specific
  // replacement panoramas are introduced.
  put('bw-castle-matte','Haunted bonus · shared distant castle',[1,-42,-130],[172,112,1]);
  put('bw-rides-matte','Haunted bonus · shared distant rides',[110,-46,-150],[182,121,1]);
  put('bw-jungle-matte','Haunted bonus · shared tropical horizon',[56,-48,-185],[290,132,1]);
  data.components.push(...art);
  (data.groups??=[]).push({id:90,nm:'Haunted Hassle · shared Meshy bonus scenery',editorOnly:true});
  data.sky='haunted';data.keepPlayFog=true;data.atmosphere={...HAUNTED_ISLAND_ATMOSPHERE};
}
