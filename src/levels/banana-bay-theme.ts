import type { CustomComponent, DecorKind } from '../level';
import type { CustomAtmosphereData } from '../levelAtmosphere';
import { COASTAL_TOWN_ASSETS } from '../coastalTownAssets';

export type BayPoint = [number, number, number];
export const BAY_OCEAN_LOOK = {normalStrength:1.35,reflectionStrength:.38,causticsStrength:.4,
  shallow:{r:.07,g:.82,b:.75,a:.7},deep:{r:.015,g:.42,b:.56,a:1},depthDistance:2.5,foamStrength:.48,intersectionWidth:.85};
export const BAY_ATMOSPHERE: CustomAtmosphereData = {
  fogEnabled:true,fogNear:160,fogFar:620,fogColor:'#b8e7ed',
  ambientSky:'#d5efff',ambientGround:'#ead2a0',ambientIntensity:1.4,
  sunColor:'#fff9ec',sunIntensity:2.15,sunDirection:[.36,.91,.22],
  fillColor:'#c7edff',fillIntensity:.42,shadowStrength:.62,drawDistance:720,backdrop:'painted sky',
  fallbackTop:'#229de6',fallbackBottom:'#d7f5f3',fallbackRidges:false,
  fallbackStars:false,fallbackSunColor:'#fffef5',fallbackSunU:.62,fallbackSunV:.12,
};

/** Parent and bonus use exactly the same authored models and sun-warmed kit. */
export function bayProp(dkind:DecorKind,p:BayPoint,s:BayPoint,yaw=0,nm=dkind as string,grp=80):CustomComponent {
  return {t:'decor',dkind,p,s,yaw,scenerySolid:false,solid:false,nm,grp};
}
export function bayPalm(p:BayPoint,k:number,yaw:number,grp=80):CustomComponent[] {
  const a=yaw*Math.PI/180;
  return [bayProp('baytrunk',p,COASTAL_TOWN_ASSETS.baytrunk.size.map(v=>v*k) as BayPoint,yaw,'Bay palm trunk',grp),
    bayProp('baycrown',[p[0]+Math.cos(a)*.65*k,p[1]+7*k,p[2]-Math.sin(a)*.65*k],
      COASTAL_TOWN_ASSETS.baycrown.size.map(v=>v*k) as BayPoint,yaw,'Bay palm crown',grp)];
}
export function bayBoardwalk(points:BayPoint[],width:number,nm:string,grp=71):CustomComponent {
  const p=points[0];
  return {t:'woodpath',p:[...p],pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),
    w:width,widths:points.map(()=>width),curve:points.length>2?'spline':undefined,
    structureStyle:'beach',plankPalette:'sunny-oak',polePalette:'placeholder-pole',
    scaffold:true,supports:true,rails:true,terrainSupports:false,supportBaseY:-3.6,supportDepth:5,
    spacing:.68,baySpacing:4.2,tex:'plank',color:'#c89758',nm,grp};
}
