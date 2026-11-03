import type {CustomComponent} from '../level';
import {beachfrontPointAtDistance,beachfrontYawAtDistance} from '../beachfrontCourse';

/** The first act belongs to a substantial island, not a thin freestanding
 * cliff wall. Full existing sandstone meshes overlap behind the coastal rim;
 * their buried feet and the final tapered headland keep the lagoon open. */
export function createBananaBayIsland():CustomComponent[] {
  const parts:CustomComponent[]=[];
  // Close the land beneath the rock silhouette. The core stays landward of
  // the existing cliff collision and covers the otherwise open rear faces.
  const outline:[number,number][]=[];
  for(let d=0;d<=740;d+=20){
    const q=beachfrontPointAtDistance(d,10.5);
    outline.push([-q[0],q[2]]);
  }
  outline.push([-85,-740],[-250,-739],[-420,-734],[-540,-715],[-570,-590],[-560,65],[-30,65]);
  parts.push({t:'platform',p:[-250,-6,-340],s:[600,16,810],
    pts:outline.map(([x,z])=>[x+250,z+340]),tex:'sunny-sand',color:'#cbbd9e',
    nm:'Banana Bay mainland / closed island core',grp:80});
  const rock=(distance:number,lateral:number,width:number,height:number,depth:number,yaw:number,label:string)=>{
    const q=beachfrontPointAtDistance(distance,lateral,-7);
    parts.push({t:'decor',dkind:'sunnycliff',p:[-q[0],q[1],q[2]],s:[width,height,depth],
      yaw:90-beachfrontYawAtDistance(distance)+yaw,scenerySolid:false,solid:false,grp:80,
      nm:`Banana Bay mainland / ${label}`});
  };
  // Broad overlapping shoulders join the narrow existing coastal face.
  for(const [i,d]of [45,145,245,345,445,545,645].entries())
    rock(d,90,146,63+(i%3)*5,94,(i%3-1)*6,`coastal shoulder ${i+1}`);
  // A second, higher ridge carries the island hundreds of metres inland.
  for(const [i,d]of [75,205,335,465,595].entries())
    rock(d,158,190,105+(i%3)*8,150,(i%2?7:-7),`inland ridge ${i+1}`);
  for(const [i,d]of [115,285,455,605].entries())
    rock(d,278,215,128+(i%3)*9,170,(i%2?11:-8),`western massif ${i+1}`);
  // Round off the island before the first over-water bridge: there is no
  // scenery across the route or underneath the lagoon's open crossings.
  rock(698,74,85,37,116,-12,'departure headland');
  rock(678,198,116,48,172,8,'western headland');
  // Continue the small-scale cliff strata around the exposed southern rim,
  // concealing the simple closed core beneath the larger inland rocks.
  for(let i=0;i<7;i++)parts.push({t:'decor',dkind:'sunnycliff',
    p:[-67-i*72,-7,-716+(i>4?(i-4)*6:0)],s:[104,34+(i%3)*6,76],yaw:(i%3-1)*5,
    scenerySolid:false,solid:false,grp:80,nm:`Banana Bay mainland / southern rim ${i+1}`});
  return parts;
}
