import type {CustomLevelData} from '../level';
import {tribalPoint,tribalProgress} from './tribal-run-route';

/** Reward pauses on fixed ground; the crossing choreography stays empty. */
export function arrangeTribalCrates(data:CustomLevelData,height:(s:number)=>number,offset:(s:number)=>number,group:(s:number)=>number):void {
 const C=data.components;for(let i=C.length-1;i>=0;i--)if(C[i].t==='crate')C.splice(i,1);
 // Each row is a checkpoint section: 3 + 3 + 4 boxes. Masks face the
 // fire-head encounters, rather than promising protection against water.
 const sections:readonly (readonly [number,number,number])[]=[
  [30,139,173],[274,349,515],[548,663,770],[840,921,974],[1107,1255,1364],
  [1386,1412,1501],[1527,1543,1610],[1668,1760,1928],[2010,2163,2170],[2232,2291,2302],
 ];
 const masks=new Map([[139,3.6],[349,3.6],[663,-3.6],[921,3.6],[1386,-3.6],[1610,3.6],[1760,-3.6],[2010,3.6]]);
 for(const stations of sections)for(const [index,s]of stations.entries()){
  const count=index===2?4:3,mask=masks.has(s),u=masks.get(s)??(s===2170?3.6:-3.6),p=tribalPoint(s,height(s),offset(s)+u);
  // Single columns preserve a precise foothold on the rising curved roads.
  for(let i=0;i<count;i++)C.push({t:'crate',p:[p[0],p[1]+i*.96,p[2]],kind:i===0?(mask?'mask':'wood'):'mystery',grp:group(s),
   nm:`TRIBAL / ${mask?'PREPARE / fire-head protection':index===0?'TEACH / fixed-bank harvest':index===1?'TEST / crossing pause':'COUNT / restart approach'} / ${s}`});
 }
 const guardians=[41,137,181,271,385,544,657,778,844,939,973,1013,1102,1250,1370,1546,1606,1779,1926,2028,2230];
 for(let i=C.length-1;i>=0;i--){const c=C[i];if(c.t!=='enemy')continue;const s=Math.round(tribalProgress(c.p));
  if(!guardians.includes(s))C.splice(i,1);else c.nm=`TRIBAL / ${s===41?'TEACH':'TEST'} / island guardian at ${s}`;
 }
}

/** Keep the drum and gallery geometry; make the authored reveal real. */
export function arrangeResonanceCrates(data:CustomLevelData):void {
 const C=data.components;for(let i=C.length-1;i>=0;i--)if(C[i].t==='crate'&&C[i].kind!=='bang')C.splice(i,1);
 const groups:readonly (readonly [number,number,number,string])[]=[
  [-8,0,3,'First offering'],[-4,0,3,'Second offering'],[1,0,4,'Call'],[14,1.2,3,'First response'],
  [25,2.4,3,'Second response'],[28,2.4,3,'Drum approach'],[45,6.8,4,'High echo'],[49,6.8,3,'Vault cache'],[54,6.8,3,'Gallery gift'],
  [65,6.8,3,'Stone one'],[71.4,6.8,3,'Stone two'],[77.8,6.8,3,'Stone three'],[86,3.4,3,'Lower answer'],
  [97,0,3,'Return offering'],[101,0,4,'Last call'],[105,0,3,'Final answer'],
 ];
 for(const [x,y,count,name]of groups){const outline=name.startsWith('Stone ');
  for(let i=0;i<count;i++)C.push({t:'crate',p:[x+(count===4?(i%2)*.96:0),y+(count===4?Math.floor(i/2):i)*.96,0],
   kind:i>=(count===4?2:1)?'mystery':'wood',grp:outline?20:2,...(outline?{outline:true}:{}),nm:i?`${name} · upper ${i}`:name});
 }
 C.push({t:'crate',p:[91.3,7.6,0],kind:'life',grp:2,nm:'Vault life'});
 const cube={vertices:[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]};
 // Generic platforms ignore outline; the mesh primitive supports it. Its
 // identical box dimensions, position, texture and default grind edges stay.
 for(const c of C)if(c.t==='platform'&&c.outline)Object.assign(c,{t:'mesh',...cube});
 const offerings=data.groups?.find(g=>g.id===2);if(offerings)offerings.nm='Fifty-two offerings';
}
