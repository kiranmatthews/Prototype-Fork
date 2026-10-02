import * as THREE from 'three';
import {waterparkCupLinks} from './waterpark-cup-links';
import type {CustomComponent,CustomLevelData} from '../level';
import {RECOVERED_WATERPARK_LEVEL} from './waterpark-cup-base';

// The last non-linear park, recovered from 8710517, becomes a free-skate
// competition. Its courtyard, lazy river, bridges and perimeter rides remain.
const courseOnly=new Set(['checkpoint','clock','comboorb','crystal','wumpa','crate','bonusplatform','pit','camnode','zone']);
const obsolete=new Set(['Wavebreaker exit kicker','Coaster crest exit kicker','Wavebreaker launch rollers']);
const components:CustomComponent[]=RECOVERED_WATERPARK_LEVEL.components
  .filter(c=>!courseOnly.has(c.t)&&!c.cameraView&&c.nm!=='Standing water in closed service well'&&!obsolete.has(c.nm??'')&&
    !(['Concrete planter','Palm growing from abandoned planter','Overgrown planter'].includes(c.nm??'')&&c.p[0]>-70))
  .map(c=>({...c,
    ...(c.t==='vertramp'?{rails:true}:{}),
    ...(c.nm==='North bridge handrail'?{p:[c.p[0],0,0] as [number,number,number],pts:[[0,-118,0,16.1],[0,-83,0,16.1],[0,-73,0,12.6]]}:{}),
    ...(c.loopRadius!==undefined?{loopRequired:false}:{}),
    ...(c.t==='gate'?{invisible:true,nm:'Competition service exit'}:{}),
    ...(/Palm/.test(c.nm??'')&&c.p[0]>95&&c.p[0]<107&&c.p[2]>53?{p:[c.p[0]-16,c.p[1],c.p[2]+7] as [number,number,number]}:{}),
  }));
const floor=components.findIndex(c=>c.nm==='Desert park ground');
const sand=new THREE.BoxGeometry(1200,6,1200);
components[floor]={t:'mesh',p:[36,-9,-63],vertices:Array.from(sand.getAttribute('position').array),
  indices:Array.from(sand.index!.array),uvs:Array.from(sand.getAttribute('uv').array),
  outOfBounds:true,solid:true,vert:false,edgeGrinding:false,color:'#b4a081',tex:'sand',grp:90,nm:'Out-of-bounds sand'};
sand.dispose();
components.push(...waterparkCupLinks());
components.push({t:'coastwall',p:[-94,-8,80],pts:[[0,0],[270,0],[270,-282],[0,-282],[0,0]],w:.7,rise:85,nm:'Competition perimeter'});
export const WATERPARK_CUP_LEVEL:CustomLevelData={
  ...RECOVERED_WATERPARK_LEVEL,name:'Deadwater Cup',spawn:[18,12.15,-12],skatepark:true,
  cameraAirLift:undefined,medalTimes:undefined,killY:-40,components,
  groups:[...(RECOVERED_WATERPARK_LEVEL.groups??[]),{id:93,nm:'Competition circulation',editorOnly:true}],
};
