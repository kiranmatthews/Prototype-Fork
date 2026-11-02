import type {CustomComponent,CustomLevelData} from '../level';
type P=[number,number,number];
/** Open-ended periodic architecture. No vault, floor matte or height fog can
 * reveal a top/bottom. The neighbouring cells use this exact native geometry. */
export function withSpaghettiCavern(source:CustomLevelData):CustomLevelData {
 const data=structuredClone(source),C=data.components,loop=data.verticalLoop!;
 for(const c of C)if(['platform','vertramp','ramp'].includes(c.t))c.emissive??='#24343c';
 const far=Math.min(...C.filter(c=>c.nm==='Periodic corridor end').map(c=>c.p[2]));
 const put=(c:CustomComponent)=>C.push({grp:90,solid:false,scenerySolid:false,castShadow:false,...c});
 const mesh=(nm:string,p:P,v:number[],indices:number[],color:string,tex='solid' as CustomComponent['tex'])=>
  put({t:'mesh',nm,p,vertices:v,indices,color,tex,doubleSided:true,emissive:nm.includes('amber')?'#b28a42':'#1c2b39'});
 // Broad textured wall panels retain vertical rhythm across the seam.
 for(const side of [-1,1]){
  const x=side*52;
  mesh('Endless cavern / basalt curtain',[0,0,0],[x,loop.minY,42,x,loop.minY,far,x,loop.minY+loop.height,far,x,loop.minY+loop.height,42],[0,1,2,0,2,3],'#526374','spaghetti-cavern');
  for(let z=24;z>far;z-=72){
   // Faceted pilasters, four repeating strata, no overhead cap.
   for(let y=loop.minY+36;y<loop.minY+loop.height;y+=72){
    const vertices=[-1.3,-36,-3,1.3,-36,-3,2,-36,0,1.3,-36,3,-1.3,-36,3,-2,-36,0,
     -1.3,36,-3,1.3,36,-3,2,36,0,1.3,36,3,-1.3,36,3,-2,36,0],indices:number[]=[];
    for(let j=0;j<6;j++){const k=(j+1)%6;indices.push(j,k,j+6,k,k+6,j+6);}
    mesh('Endless cavern / fluted iron pier',[side*50.4,y,z],vertices,indices,'#70878a','spaghetti-basalt');
    mesh('Endless cavern / amber seam marker',[side*48.5,y,z],[-.1,-.9,-1,.1,-.9,-1,.1,.9,-1,-.1,.9,-1],[0,1,2,0,2,3],'#d8b16c');
   }
  }
 }
 for(const c of [...C])if(c.t==='platform'&&c.s&&c.nm?.startsWith('Decision')){
  const y=c.p[1]+c.s[1]/2+.012,z=c.p[2];
  for(const x of [-26,0,26])if(Math.abs(x-c.p[0])+3<c.s[0]/2)mesh('Choose a forward thread',[x,y,z-1],[-2.4,0,2.8,0,0,-3.4,2.4,0,2.8,0,0,1.3],[0,1,3,1,2,3],x===0?'#e2c580':x<0?'#85c8c2':'#c1a5d7');
 }
 data.atmosphere={backdrop:'fog',fogEnabled:true,fogNear:100,fogFar:350,fogColor:'#263847',drawDistance:640,
  ambientSky:'#c1d2e3',ambientGround:'#748e8a',ambientIntensity:1.35,
  sunColor:'#d1e0ee',sunIntensity:1.25,sunDirection:[.4,.85,.3],fillColor:'#d1b690',fillIntensity:.65,shadowStrength:.5};
 return data;
}
