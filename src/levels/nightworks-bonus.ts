import type { CustomComponent, CustomLevelData, DecorKind } from '../level';

/** Source-owned image allowlist; editor data cannot request arbitrary URLs. */
const NIGHTWORKS_ART: Record<string,{file:string;unlit?:boolean;cutout?:boolean;repeat?:boolean}> = {
  'night-quarry-moon': {file:'nightworks-bonus/moon-quarry.webp',unlit:true},
  'night-quarry-dispatch': {file:'nightworks-bonus/dispatch-cutout.webp',unlit:true,cutout:true},
  'night-quarry-slate': {file:'nightworks-bonus/slate.webp',repeat:true},
};
export const NIGHTWORKS_TEXTURE_KINDS=Object.keys(NIGHTWORKS_ART);
export const nightworksArt=(kind:string|undefined)=>kind&&Object.prototype.hasOwnProperty.call(NIGHTWORKS_ART,kind)?NIGHTWORKS_ART[kind]:undefined;
type P=[number,number,number];

/** Retain the puzzle's exact supported route and switch groups, replacing the
 * thin rectangular floor with textured, faceted stone above the native kit. */
function quarryShelf(c:CustomComponent):CustomComponent {
  const [w,h,d]=c.s!,top=c.p[1]+h/2,vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  const n=Math.max(2,Math.ceil(w/2.2));
  for(let i=0;i<=n;i++) {
    const x=-w/2+w*i/n,world=x+c.p[0],front=d/2+Math.sin(world*2.7)*.24,back=-d/2+Math.cos(world*1.9)*.22;
    const bottom=-1.15-Math.abs(Math.sin(world*1.4))*.85;
    for(const [y,z] of [[0,front],[0,back],[bottom,front*.78],[bottom-.3,back*.72]]){
      vertices.push(x,y,z);uvs.push(world/4,(z-y*1.4)/4);
    }
    if(i<n){const a=i*4,b=a+4;indices.push(a,b+1,b,a,a+1,b+1, a,b,a+2,b,b+2,a+2, a+1,a+3,b+1,b+1,a+3,b+3, a+2,b+2,b+3,a+2,b+3,a+3);}
  }
  indices.push(0,2,3,0,3,1,n*4,n*4+3,n*4+2,n*4,n*4+1,n*4+3);
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  return {...c,p:[c.p[0],top,c.p[2]],s:undefined,vertices,indices,uvs,tex:'night-quarry-slate',color:'#c7ced8',emissive:'#090e1b'};
}

export function rebuildNightworksBonus(data:CustomLevelData):void {
  const gameplay=data.components.filter(c=>c.grp!==90),art:CustomComponent[]=[];
  const gate=gameplay.find(c=>c.t==='gate')!,end=gate.p[0]+7;
  const put=(c:CustomComponent)=>art.push({...c,solid:false,edgeGrinding:false,grp:90});
  const rock=(kind:DecorKind,p:P,s:P,nm:string,yaw=0,color='#bcc9df')=>
    put({t:'decor',dkind:kind,p,s,nm,yaw,color,tex:'night-quarry-slate',emissive:'#111a2b'});
  const torch=(x:number,y:number,z:number,height=3.2)=>
    put({t:'torch',p:[x,y,z],rise:height,w:.85,nm:'Quarry shift brazier'});
  function matte(nm:string,tex:string,p:P,w:number,h:number):void {
    put({t:'mesh',nm,tex,p,vertices:[-w/2,-h/2,0,w/2,-h/2,0,w/2,h/2,0,-w/2,h/2,0],
      indices:[0,1,2,0,2,3],uvs:[0,0,1,0,1,1,0,1],color:'#ffffff',fog:false,castShadow:false});
  }
  data.components=gameplay.map(c=>{
    if(c.t==='pit')return {...c,invisible:true};
    if(c.t!=='mesh'||!c.s||c.solid===false)return c;
    // The high reveal gallery must keep its exact collider and visibility
    // circuit. No decorative duplicate is allowed to give the puzzle away.
    if(c.outline)return {...c,tex:'night-quarry-slate',color:'#adb8ce'};
    const top=c.p[1]+c.s[1]/2,a=c.p[0]-c.s[0]/2,b=c.p[0]+c.s[0]/2;
    const count=Math.max(1,Math.ceil((b-a)/9)),span=(b-a)/count;
    for(let i=0;i<count;i++){
      const x=a+span*(i+.5),height=5.5+Math.sin(x*1.3)*1.1;
      rock('nightlongisland',[x,top-height-.12,0],[span+1,height,6.8],`Hanging slate root ${x.toFixed(1)}`,0,'#c0cad8');
      if(top<1&&i%2===0)torch(x,top,-2.55,2.8);
    }
    return quarryShelf(c);
  });

  // Entirely world-space layers: the camera creates real relative parallax.
  // Cover both the current close view and a 30 m future bonus follow distance.
  matte('Moonlit quarry panorama','night-quarry-moon',[end/2,20,-142],360,120);
  matte('Abandoned dispatch gantries','night-quarry-dispatch',[end/2,5,-66],220,220/3);
  for(const [i,x] of [-18,8,33,59,end+12].entries()){
    const y=-9-(i%2)*3,z=-17-(i%3)*4;
    rock('nightlongisland',[x,y-7,z],[17+(i%2)*3,9,10],`Rear quarry terrace ${i}`,i%2?12:-9,'#9eafc9');
    if(i%2===0)rock('nightdistantarch',[x+5,y-1,z-13],[16,26,8],`Moonlit natural stone arch ${i}`,i*11,'#849ab8');
    rock('nightsteppingrock',[x-4,y-4,z+7],[4,6,4],`Drifting mineral shard ${i}`,i*37,'#b6bfd0');
    torch(x-5,y+2,z,4.3);torch(x+5,y+2,z+1,3.4);
    // A physical ridge and hanging anchor give the image layers a 3D front edge.
    rock('nightrockridge',[x,y+1,z],[14,1.5,1],`Abandoned quarry ridge ${i}`,5,'#c3bdad');
    rock('nightanchorrock',[x+7,y+5,z-2],[3.4,3.8,3],`Suspended quarry anchor ${i}`,i*29,'#9faec2');
  }
  rock('nightdistantarch',[-24,-14,-30],[24,43,11],'Arrival quarry monumental arch',-12,'#8b9ebc');
  rock('nightdistantarch',[end+22,-13,-36],[28,46,12],'Return quarry monumental arch',16,'#90a2bc');
  // Low foreground fragments frame the zoomed-out view without hiding boxes.
  for(const [i,x] of [-15,19,47,end+9].entries())
    rock('nightsteppingrock',[x,-14-i%2*2,6],[7,10,5],`Near hanging crag ${i}`,i*48,'#63728c');
  data.components.push(...art);
  data.sky='night';data.keepPlayFog=true;
  data.atmosphere={fogEnabled:true,fogColor:'#1d2b49',fogNear:38,fogFar:155,
    ambientSky:'#92b1ec',ambientGround:'#444255',ambientIntensity:1.4,
    sunColor:'#b9d4ff',sunIntensity:1.7,fillColor:'#e8b46f',fillIntensity:.6,
    shadowStrength:.68,drawDistance:340,backdrop:'sky',fallbackTop:'#111d36',fallbackBottom:'#304666'};
  data.groups??=[];data.groups.push({id:90,nm:'Nightworks quarry · layered moonlight, gantries and hanging stone'});
}
