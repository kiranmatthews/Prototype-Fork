import type {CustomComponent,CustomLevelData} from '../level';
import {HOLLOWWAKE_ROOMS,hollowPoint,hollowRadius,hollowFloorRise} from './hollowwake-route';

type Cargo={s:number;u:number;count:number;kind?:CustomComponent['kind'];job:string};
export const HOLLOWWAKE_CARGO:Cargo[]=[
 {s:-8,u:-2,count:3,job:'COUNT / before the release'},
 {s:6,u:2,count:3,kind:'mask',job:'PREPARE / first pursuit'},
 ...HOLLOWWAKE_ROOMS.flatMap((room,i)=>[
  {s:room.checkpoint-5,u:-1.9,count:4,job:`REST / ${room.name} arrival`},
  {s:room.checkpoint+6,u:1.9,count:3,kind:[1,3,4].includes(i)?'mask' as const:'wood' as const,job:`PREPARE / ${room.name} departure`},
  {s:room.checkpoint+12,u:-1.9,count:3,job:`COUNT / ${room.name} last supplies`},
 ]),
 {s:2472,u:-1.9,count:4,job:'COUNT / escaped wreck throat'},
];

/** Keep the steel steering gates; all counted rewards share the clear route. */
export function arrangeHollowwakeCrates(data:CustomLevelData):void {
 data.components=data.components.filter(c=>c.t!=='crate'||c.kind==='metal');
 for(const [i,cargo]of HOLLOWWAKE_CARGO.entries()){
  const p=hollowPoint(cargo.s,-1,cargo.u,hollowFloorRise(cargo.u,hollowRadius(cargo.s)));
  for(let tier=0;tier<cargo.count;tier++)data.components.push({t:'crate',p:[p[0],p[1]+tier*1.152,p[2]],
   kind:tier?'mystery':cargo.kind??'wood',grp:9700+i,nm:`TUNNELBORE / ${cargo.job} / ${tier}`});
 }
 data.groups=[...(data.groups??[]),...HOLLOWWAKE_CARGO.map((c,i)=>({id:9700+i,nm:c.job}))];
 data.crateLayoutRevision=1;
}
