import type {CustomComponent,CustomLevelData} from '../level';
import {buildCarlisleBoxes} from './carlisle-boxes';
import {buildCarlisleArt,CARLISLE_ART_GROUPS} from './carlisle-coast-art';
import originalEntry from '../../tools/carlisle-coast/original-course.json';

// Preserve the original traversal, encounters and supported collision exactly.
// The ravine presentation is independently authored, non-solid level data.
const original=originalEntry.data as unknown as CustomLevelData;
const range=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
export const CARLISLE_REMOVED_PARK_INDICES=[1,...range(20,30),...range(71,86),...range(121,123),175,176,...range(242,253),276,490,493,499,502];
const removed=new Set(CARLISLE_REMOVED_PARK_INDICES);
export const CARLISLE_ORIGINAL_INDICES=original.components.map((_,i)=>i).filter(i=>!removed.has(i)&&original.components[i].t!=='crate'&&original.components[i].t!=='comboorb');
const C:CustomComponent[]=CARLISLE_ORIGINAL_INDICES.map(index=>{
 const c=JSON.parse(JSON.stringify(original.components[index])) as CustomComponent;
 c.nm=`Test Course ${index}`;
 // This rail previously cut below the two raised landings. Keep its old
 // anchors and horizontal route, adding support-height knots at the crests.
 if(index===132)c.pts=[[0,0,0,0],[0,-23,0,2.98],[0,-63,0,3.2],[0,-88,0,5.96],[0,-128,0,6.2],[0,-150,0,9]];
 if(index===92)c.cameraCutaway=true;
 if(index===69){c.p[0]=0;c.s![0]=22;}
 if(c.t==='platform'||c.t==='ramp'||c.t==='wall'||c.t==='vertramp'){
  if(c.tex!=='wood'){c.tex='coast-stone';c.color='#c9c5ae';}
 }
 if(c.t==='rail')c.color='#b9ad8d';
 return c;
});

const boxLayout=buildCarlisleBoxes(original);
export const CARLISLE_CRATE_SECTIONS=boxLayout.sections;
export const CARLISLE_CRATES=boxLayout.components;
const art=buildCarlisleArt(C);
C.push(...boxLayout.components,...art);

export const CARLISLE_COAST_LEVEL:CustomLevelData={
 ...JSON.parse(JSON.stringify(original)),name:'Carlisle Coast',
 sky:'day',jungleAtmosphere:true,jungleDepthFade:false,jungleStyle:'painterly',keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:36,fogFar:142,fogColor:'#8d9980',
  ambientSky:'#c2d1b5',ambientGround:'#78684b',ambientIntensity:1.0,
  sunColor:'#ffe0a4',sunIntensity:1.5,fillColor:'#afc8ac',fillIntensity:.3,
  shadowStrength:.7,drawDistance:205,backdrop:'fog',fallbackTop:'#819588',fallbackBottom:'#c2c1a0'},
 medalTimes:{gold:180,silver:210,bronze:255},
 groups:[...(original.groups??[]),...boxLayout.groups,...CARLISLE_ART_GROUPS],components:C,
};
