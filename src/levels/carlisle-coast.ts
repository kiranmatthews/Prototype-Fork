import type {CustomComponent,CustomLevelData} from '../level';
import {buildCarlisleBoxes} from './carlisle-boxes';
import originalEntry from '../../tools/carlisle-coast/original-course.json';

// Restore the original materials and visible geometry without the city makeover.
// Preserve the later crate encounters, removed side park and traversal fixes.
const original=originalEntry.data as unknown as CustomLevelData;
const range=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
export const CARLISLE_REMOVED_PARK_INDICES=[1,...range(20,30),...range(71,86),...range(121,123),175,176,...range(242,253),276,490,493,499,502];
const removed=new Set(CARLISLE_REMOVED_PARK_INDICES);
export const CARLISLE_ORIGINAL_INDICES=original.components.map((_,i)=>i).filter(i=>!removed.has(i)&&original.components[i].t!=='crate');
const C:CustomComponent[]=CARLISLE_ORIGINAL_INDICES.map(index=>{
 const c=JSON.parse(JSON.stringify(original.components[index])) as CustomComponent;
 c.nm=`Test Course ${index}`;
 // This rail previously cut below the two raised landings. Keep its old
 // anchors and horizontal route, adding support-height knots at the crests.
 if(index===132)c.pts=[[0,0,0,0],[0,-23,0,2.98],[0,-63,0,3.2],[0,-88,0,5.96],[0,-128,0,6.2],[0,-150,0,9]];
 if(index===92)c.cameraCutaway=true;
 if(index===69){c.p[0]=0;c.s![0]=22;}
 return c;
});

const boxLayout=buildCarlisleBoxes(original);
export const CARLISLE_CRATE_SECTIONS=boxLayout.sections;
export const CARLISLE_CRATES=boxLayout.components;
C.push(...boxLayout.components);

export const CARLISLE_COAST_LEVEL:CustomLevelData={
 ...JSON.parse(JSON.stringify(original)),name:'Carlisle Coast',
 medalTimes:{gold:180,silver:210,bronze:255},
 groups:[...(original.groups??[]),...boxLayout.groups],components:C,
};
