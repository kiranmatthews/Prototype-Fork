import type { CustomComponent } from '../level';
import { DROWNED_CROWN_BOARD_MODELS } from '../drownedCrownBoards.generated';
import { BILGE_BOWL_LAYOUT as layout, bilgeBowlOutline } from './pirate-bilge-bowl';

type Point=[number,number,number];
const C:CustomComponent[]=[];
const board=DROWNED_CROWN_BOARD_MODELS.crownmeshyplankchipped;

// Dark support remains visible only in the irregular gaps between whole boards.
const apronInner=bilgeBowlOutline(layout.flatHalf+layout.radius);
const apronOuter=bilgeBowlOutline(layout.flatHalf+layout.radius+layout.deckWidth);
const backingVertices:number[]=[],backingIndices:number[]=[];
for(let i=0;i<apronInner.length;i++){
 backingVertices.push(apronInner[i][0],layout.rimY+.002,apronInner[i][1],apronOuter[i][0],layout.rimY+.002,apronOuter[i][1]);
 if(i<apronInner.length-1)backingIndices.push(i*2,i*2+1,(i+1)*2+1,i*2,(i+1)*2+1,(i+1)*2);
}
C.push({t:'mesh',p:[...layout.centre],vertices:backingVertices,indices:backingIndices,
 solid:false,doubleSided:true,tex:'solid',color:'#34251b',grp:5,nm:'Bilge bowl · shadow backing beneath the original boards'});

// Eight concentric courses use the whole original Meshy board, at one scalar
// on every axis. Only placement/heading follow the rounded apron; no board is
// bent, cropped, retextured or used as a replacement collision surface.
const columns=8,scale=layout.deckWidth/(columns*board.size[2]);
const length=board.size[0]*scale,boardWidth=board.size[2]*scale;
for(let col=0;col<columns;col++){
 const path=bilgeBowlOutline(layout.flatHalf+layout.radius+.23+(col+.5)*boardWidth);
 const distances=[0];for(let i=1;i<path.length;i++)distances.push(distances[i-1]+Math.hypot(path[i][0]-path[i-1][0],path[i][1]-path[i-1][1]));
 const total=distances[distances.length-1],count=Math.ceil(total/(length*.985));
 const at=(distance:number)=>{
  const d=Math.max(0,Math.min(total,distance));let i=1;while(i<distances.length-1&&distances[i]<d)i++;
  const t=(d-distances[i-1])/(distances[i]-distances[i-1]);
  return [path[i-1][0]+(path[i][0]-path[i-1][0])*t,path[i-1][1]+(path[i][1]-path[i-1][1])*t];
 };
 for(let i=0;i<count;i++){
  const distance=(i+.5+(col%2)*.5)*total/count,p=at(Math.min(total-length*.2,distance)),a=at(distance-length/2),b=at(distance+length/2);
  C.push({t:'decor',dkind:'crownmeshyplankchipped',
   p:[p[0],layout.rimY+.006,p[1]+layout.centre[2]],
   s:board.size.map(n=>n*scale) as Point,yaw:Math.atan2(-(b[1]-a[1]),b[0]-a[0])*180/Math.PI,
   scenerySolid:false,grp:5,nm:'Bilge bowl · original Meshy timber apron'});
 }
}

// A thin painted brass line follows the existing upper transition. Its open
// ends preserve the north exit throat and its mesh never enters collision.
const low=15,high=15.8;
const offset=(y:number)=>layout.flatHalf+Math.sqrt(layout.radius**2-(layout.radius-y)**2)-.035;
const bottom=bilgeBowlOutline(offset(low)),top=bilgeBowlOutline(offset(high));
const vertices:number[]=[],indices:number[]=[];
for(let i=0;i<bottom.length;i++){
 vertices.push(bottom[i][0],low+.012,bottom[i][1],top[i][0],high+.012,top[i][1]);
 if(i<bottom.length-1)indices.push(i*2,(i+1)*2+1,i*2+1,i*2,(i+1)*2,(i+1)*2+1);
}
C.push({t:'mesh',p:[...layout.centre],vertices,indices,solid:false,tex:'solid',color:'#c99b59',
 doubleSided:true,grp:5,nm:'Bilge bowl · brass paint below the coping'});
export const PIRATE_BILGE_DRESSING=C;
