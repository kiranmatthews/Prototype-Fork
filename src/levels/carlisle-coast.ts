import type {CustomComponent,CustomLevelData} from '../level';
import {buildCarlisleBoxes} from './carlisle-boxes';
import {buildCarlisleArt,CARLISLE_ART_GROUPS} from './carlisle-coast-art';
import {buildCarlisleRockTerrain} from './carlisle-rock-terrain';
import {buildCarlisleChannelRock} from './carlisle-channel-rock';
import originalEntry from '../../tools/carlisle-coast/original-course.json';

// Retain encounter timing and the supported traversal lane while rebuilding
// the native ground volume and independently dressing the ravine.
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
 // Native analytic halfpipe floor shares its support plane with the sculpt.
 // The presentation helper biases only the flat floor behind that solid.
 if(index===95)c.rise=4.5;
 if(index===69){c.p[0]=0;c.s![0]=22;}
 if(c.t==='platform'||c.t==='ramp'||c.t==='wall'||c.t==='vertramp'){
  if(c.tex!=='wood'){c.tex='coast-bedrock';c.color='#ddd3ba';}
 }
 if(c.t==='wall')c.invisible=true;
 if(c.t==='rail')c.color='#b9ad8d';
 return c;
});

const boxLayout=buildCarlisleBoxes(original);
export const CARLISLE_CRATE_SECTIONS=boxLayout.sections;
export const CARLISLE_CRATES=boxLayout.components;
export const CARLISLE_NATIVE_TERRAIN=C.map(c=>JSON.parse(JSON.stringify(c)) as CustomComponent);
const protectedPoints: [number,number,number][]=[...boxLayout.components,...C.filter(c=>['enemy','checkpoint','gate','crystal','clock','stone','crusher'].includes(c.t))].flatMap(c=>{
 const points: [number,number,number][]=[c.p];
 if(c.t==='enemy')for(const side of [-1,1])points.push([c.p[0]+side*(c.range??2.5),c.p[1],c.p[2]]);
 // Respawn resolves the checkpoint crate by stepping one metre to its left.
 if(c.t==='checkpoint')points.push([c.p[0]-1.05,c.p[1],c.p[2]]);
 return points;
});
const sculpted:CustomComponent[]=[];
const floorAtNative=(c:CustomComponent,x:number,z:number):number|null=>{
 if(c.t==='platform'&&c.s&&Math.abs(x-c.p[0])<=c.s[0]/2+.01&&Math.abs(z-c.p[2])<=c.s[2]/2+.01)return c.p[1]+c.s[1]/2;
 if(c.t==='ramp'&&Math.abs(x-c.p[0])<=(c.w??12)/2+.01&&Math.abs(z-c.p[2])<=(c.len??12)/2+.01)
  return c.p[1]+(c.rise??0)*((c.p[2]+(c.len??12)/2-z)/(c.len??12));
 return null;
};
const joinedEnds=(c:CustomComponent,index:number)=>{
 if(c.t!=='platform'&&c.t!=='ramp')return {near:true,far:true};
 const east=index>=49&&index<=56,half=east?c.s![0]/2:c.t==='ramp'?(c.len??12)/2:c.s![2]/2;
 const joined=(side:number)=>{
  const x=c.p[0]+(east?side*(half+.08):0),z=c.p[2]+(east?0:side*(half+.08));
  const ownY=c.t==='ramp'?c.p[1]+(c.rise??0)*(.5-side*.5):c.p[1]+c.s![1]/2;
  return CARLISLE_NATIVE_TERRAIN.some(other=>other.nm!==c.nm&&floorAtNative(other,x,z)!==null&&Math.abs(floorAtNative(other,x,z)!-ownY)<.8);
 };
 return {near:joined(1),far:joined(-1)};
};
for(let i=0;i<C.length;i++){
 const native=C[i],built=buildCarlisleRockTerrain(native,CARLISLE_ORIGINAL_INDICES[i],protectedPoints,joinedEnds(native,CARLISLE_ORIGINAL_INDICES[i]));
 C[i]=built.surfaces[0];C[i].nm=native.nm;
 for(const d of built.dressing){d.tex=d.tex==='coast-moss'?'coast-turf':'coast-bedrock';sculpted.push(d);}
 C[i].tex=C[i].t==='mesh'?'coast-terrain':C[i].tex;
 // The reusable worn-board kit follows each native timber collider. Keep the
 // original wood marker during sculpting so these never become rock solids.
 if(native.tex==='wood'||native.t==='mover'||native.t==='pendulum')C[i].tex='coast-timber';
}
export const CARLISLE_SCULPTED_SURFACES=C.filter(c=>c.t==='mesh');
export const CARLISLE_SCULPTED_DRESSING=sculpted;
const art=buildCarlisleArt(CARLISLE_NATIVE_TERRAIN,C,sculpted);
art.push(...CARLISLE_NATIVE_TERRAIN.filter(c=>c.t==='vertramp').flatMap(buildCarlisleChannelRock));
// The solid rock carries the grass/stone blend. Retain only the genuinely
// overhanging tongues from the authoring cap; no flat duplicated paint plane.
const renderedDress=sculpted.flatMap(c=>{
 if(!c.nm?.startsWith('Carlisle moss cap'))return [c];
 const i=Number(c.nm.match(/\d+$/)?.[0]);
 const solid=C[CARLISLE_ORIGINAL_INDICES.indexOf(i)];if(!solid.vertices||!c.vertices||!c.indices)return [];
 let shared=0;for(;shared<c.vertices.length/3;shared++){
  const n=shared*3;if(Math.abs(solid.vertices[n]-c.vertices[n])>.00002||Math.abs(solid.vertices[n+2]-c.vertices[n+2])>.00002||Math.abs(solid.vertices[n+1]+.003-c.vertices[n+1])>.00002)break;
 }
 const selected:number[]=[];for(let n=0;n<c.indices.length;n+=3)if(c.indices.slice(n,n+3).some(k=>k>=shared))selected.push(...c.indices.slice(n,n+3));
 if(!selected.length)return [];
 const map=new Map<number,number>(),ids:number[]=[],vertices:number[]=[],normals:number[]=[],uvs:number[]=[],colors:number[]=[];
 for(const k of selected){let id=map.get(k);if(id===undefined){id=map.size;map.set(k,id);vertices.push(...c.vertices.slice(k*3,k*3+3));normals.push(...c.normals!.slice(k*3,k*3+3));uvs.push(...c.uvs!.slice(k*2,k*2+2));colors.push(...c.colors!.slice(k*3,k*3+3));}ids.push(id);}
 return [{...c,vertices,normals,uvs,colors,indices:ids,nm:`Carlisle torn turf lip ${i}`}];
});
C.push(...boxLayout.components,...renderedDress,...art);

export const CARLISLE_COAST_LEVEL:CustomLevelData={
 ...JSON.parse(JSON.stringify(original)),name:'Carlisle Coast',
 sky:'day',jungleAtmosphere:true,jungleDepthFade:false,jungleStyle:'painterly',keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:24,fogFar:102,fogColor:'#aea99a',
  ambientSky:'#d7daca',ambientGround:'#6d624d',ambientIntensity:1.3,
  sunColor:'#ffdfad',sunIntensity:1.55,fillColor:'#c3cebd',fillIntensity:.36,
  shadowStrength:.78,drawDistance:160,backdrop:'fog',fallbackTop:'#819588',fallbackBottom:'#c2c1a0'},
 medalTimes:{gold:180,silver:210,bronze:255},
 groups:[...(original.groups??[]),...boxLayout.groups,...CARLISLE_ART_GROUPS],components:C,
};
