import type {CustomComponent,CustomLevelData} from '../level';
type P=[number,number,number];
/** Open-ended periodic architecture. No vault, floor matte or height fog can
 * reveal a top/bottom. The neighbouring cells use this exact native geometry. */
export function withSpaghettiCavern(source:CustomLevelData):CustomLevelData {
 const data=structuredClone(source),C=data.components,loop=data.verticalLoop!,platforming=!data.skateRace;
 for(const c of C)if(['platform','vertramp','ramp'].includes(c.t))c.emissive??='#24343c';
 const far=Math.min(...C.filter(c=>c.nm==='Periodic corridor end').map(c=>c.p[2]));
 const put=(c:CustomComponent)=>C.push({grp:90,solid:false,scenerySolid:false,castShadow:false,...c});
 const mesh=(nm:string,p:P,v:number[],indices:number[],color:string,tex='solid' as CustomComponent['tex'])=>
  put({t:'mesh',nm,p,vertices:v,indices,color,tex,doubleSided:true,emissive:nm.includes('amber')?'#b28a42':'#1c2b39'});
 // Broad textured wall panels retain vertical rhythm across the seam.
 for(const side of [-1,1]){
  const x=side*52;
  mesh('Endless cavern / basalt curtain',[0,0,0],[x,loop.minY,42,x,loop.minY,far,x,loop.minY+loop.height,far,x,loop.minY+loop.height,42],[0,1,2,0,2,3],platforming?'#594654':'#3c6071','spaghetti-cavern');
  for(let z=24;z>far;z-=platforming?112:96){
   // Faceted pilasters, four repeating strata, no overhead cap.
   const halfStratum=loop.height/8;
   for(let y=loop.minY+halfStratum;y<loop.minY+loop.height;y+=halfStratum*2){
    const vertices=[-1.3,-halfStratum,-3,1.3,-halfStratum,-3,2,-halfStratum,0,1.3,-halfStratum,3,-1.3,-halfStratum,3,-2,-halfStratum,0,
     -1.3,halfStratum,-3,1.3,halfStratum,-3,2,halfStratum,0,1.3,halfStratum,3,-1.3,halfStratum,3,-2,halfStratum,0],indices:number[]=[];
    for(let j=0;j<6;j++){const k=(j+1)%6;indices.push(j,k,j+6,k,k+6,j+6);}
    mesh('Endless cavern / fluted iron pier',[side*50.4,y,z],vertices,indices,platforming?'#987a7a':'#628b97','spaghetti-basalt');
    mesh('Endless cavern / amber seam marker',[side*48.5,y,z],[-.1,-.9,-1,.1,-.9,-1,.1,.9,-1,-.1,.9,-1],[0,1,2,0,2,3],platforming?'#eac78a':'#82d9d9');
   }
  }
 }
 for(const c of [...C])if(c.t==='platform'&&c.s&&c.nm?.startsWith('Race interchange')){
  const y=c.p[1]+c.s[1]/2+.012,z=c.p[2];
  for(const x of [-26,0,26])if(Math.abs(x-c.p[0])+3<c.s[0]/2)mesh('Choose a forward thread',[x,y,z-1],[-2.4,0,2.8,0,0,-3.4,2.4,0,2.8,0,0,1.3],[0,1,3,1,2,3],x===0?'#e2c580':x<0?'#85c8c2':'#c1a5d7');
 }
 if(platforming){
  for(const c of [...C])if(c.t==='platform'&&c.s&&(/\/ step /.test(c.nm??'')||c.nm?.includes('reward balcony')||c.nm?.includes('high vault'))){
   const y=c.p[1]+c.s[1]/2+.018,x=c.p[0],z=c.p[2];
   // Small gilded landing marks make the deliberate jump route legible from
   // the much quieter recovery islands. They are ordinary authored meshes.
   mesh('Lanternworks / landing inlay',[x,y,z],[-2.4,0,1,0,0,-2,2.4,0,1,0,0,.1],[0,1,3,1,2,3],'#dfbf7b');
   if(c.nm?.endsWith('/ step 1')||c.nm?.includes('high vault'))for(const side of [-1,1]){
    const px=x+side*(c.s[0]/2-1.1);
    mesh('Lanternworks / amber lantern',[px,y+5,z],[-.65,0,0,0,0,.65,.65,0,0,0,0,-.65,0,1.1,0,0,-.8,0],
     [0,1,4,1,2,4,2,3,4,3,0,4,1,0,5,2,1,5,3,2,5,0,3,5],'#efbe69');
    mesh('Lanternworks / hanging stem',[px,y,z],[-.07,0,0,.07,0,0,.07,4.2,0,-.07,4.2,0],[0,1,2,0,2,3],'#8c6855');
   }
  }
 }else{
  for(const c of C.filter(c=>c.t==='speedpad')){
   const x=c.p[0],y=c.p[1],z=c.p[2];
   for(const offset of [2,4,6])mesh('Velocity Loom / lane chevron',[x,y+.015,z+offset],[-2.6,0,1,0,0,-1.4,2.6,0,1,0,0,.3],[0,1,3,1,2,3],'#9ce3df');
  }
  for(const c of C.filter(c=>c.t==='platform'&&c.nm?.startsWith('Race interchange')&&c.p[0]===0))for(const side of [-1,1]){
   const y=c.p[1]+c.s![1]/2;
   mesh('Velocity Loom / race fin',[side*45,y,c.p[2]],[-1,0,0,1,0,0,1,12,-7,-1,9,-5],[0,1,2,0,2,3],side<0?'#73d2cf':'#d5bb7c');
  }
 }
 data.atmosphere={backdrop:'fog',fogEnabled:true,fogNear:80,fogFar:platforming?310:240,fogColor:platforming?'#382c42':'#203e50',drawDistance:platforming?640:420,
  ambientSky:platforming?'#dfcbd1':'#bdd6e5',ambientGround:platforming?'#9e8375':'#6f939a',ambientIntensity:1.45,
  sunColor:platforming?'#ffe3b7':'#d3eaf3',sunIntensity:1.3,sunDirection:[.4,.85,.3],fillColor:platforming?'#cba7bd':'#98b7c8',fillIntensity:.7,shadowStrength:.45};
 return data;
}
