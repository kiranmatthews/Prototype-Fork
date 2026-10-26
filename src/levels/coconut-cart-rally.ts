import type { CustomComponent, CustomLevelData } from '../level';
import type { RaceKnot } from '../race/types';
import { lazySourceField } from './lazy-source';
import { CART_RALLY_LENGTH,CART_RALLY_JUMPS,CART_RALLY_SUPPLY_ROWS,CART_RALLY_CORNERS,STADIUM,cartRallyPoint,cartRallyFrame,stadiumPoint,stadiumSections,stadiumBoundaryPaths } from './cart-stadium-layout';
export { CART_RALLY_LENGTH,CART_RALLY_JUMPS,CART_RALLY_PIPES,CART_RALLY_SUPPLY_ROWS,cartRallyPoint } from './cart-stadium-layout';
const line:RaceKnot[]=[];
for(let s=18;s<=CART_RALLY_LENGTH;s+=2)line.push([...cartRallyPoint(s),34]);
function build():CustomComponent[]{
  const c:CustomComponent[]=[],add=(v:CustomComponent)=>{
    if(v.t==='platform'&&v.solid===false){
      // Visual boxes use the existing mesh primitive, avoiding unnecessary
      // platform contact slabs and polygon-scan work for banners and lamps.
      const [w,h,d]=v.s!,angle=(v.yaw??0)*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle),vertices:number[]=[];
      for(const [x,y,z]of [[-1,-1,-1],[1,-1,-1],[-1,1,-1],[1,1,-1],[-1,-1,1],[1,-1,1],[-1,1,1],[1,1,1]])vertices.push(x*w/2*cs+z*d/2*sn,y*h/2,-x*w/2*sn+z*d/2*cs);
      c.push({t:'mesh',nm:v.nm,p:v.p,vertices,indices:[0,2,1,1,2,3,4,5,6,5,7,6,0,4,2,4,6,2,1,3,5,5,3,7,2,6,3,3,6,7,0,1,4,4,1,5],color:v.color,tex:v.tex,emissive:v.emissive,solid:false,castShadow:false});
    }else c.push(v);
  };
  const strip=(name:string,a:number,b:number,profile:number[],color:string,soft=false,lift=0,solid=true)=>{
    const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],normals:number[]=[],colors:number[]=[],rows=Math.max(1,Math.ceil((b-a)/2)),cols=profile.length-1;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      const s=a+(b-a)*j/rows,u=profile[i];vertices.push(...cartRallyPoint(s,u,lift));uvs.push(Math.round(u/5*1e5)/1e5,Math.round(s/5*1e5)/1e5);
      const left=cartRallyPoint(s,u-.01),right=cartRallyPoint(s,u+.01),back=cartRallyPoint(s-.01,u),front=cartRallyPoint(s+.01,u);
      const x=right.map((v,k)=>v-left[k]),z=front.map((v,k)=>v-back[k]);
      const n=[x[1]*z[2]-x[2]*z[1],x[2]*z[0]-x[0]*z[2],x[0]*z[1]-x[1]*z[0]],length=Math.hypot(...n)||1;normals.push(...n.map(v=>Math.round(v/length*1e6)/1e6));
      const rut=.89+.09*Math.sin(u*2.7+s*.047)*Math.sin(u*.6+s*.13);colors.push(...[rut,rut,rut].map(v=>Math.round(v*1000)/1000));
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const p=j*(cols+1)+i,q=p+cols+1;indices.push(p,p+1,q,p+1,q+1,q);}
    add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,uvs,normals,colors,solid,color,tex:'dirt',smoothCollision:true,...(soft?{groundSpeedLimit:7}:{}),castShadow:false});
  };
  for(let s=-8;s<CART_RALLY_LENGTH+48;s+=24){
    const end=Math.min(s+24,CART_RALLY_LENGTH+48),cuts=[s,end,...CART_RALLY_JUMPS.flatMap(j=>[j.start+8,j.end+4]).filter(v=>v>s&&v<end)].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1],soft=CART_RALLY_JUMPS.some(j=>(a+b)/2>j.start+8&&(a+b)/2<j.end+4);
      strip(soft?'Soft dirt landing trough':'Packed stadium dirt',a,b,[-14,-10,-6,-2,2,6,10,14],soft?'#805235':'#bc8653',soft);
      for(const side of [-1,1]){
        strip('Loose dirt runoff',a,b,(side<0?[-17,-14]:[14,17]),'#a36c40',true);
        const profile=[17,19,21,23,24.5,25.5,26.2,26.65,27,27.4].map(u=>u*side).sort((x,y)=>x-y);
        strip('Tall dirt quarter-pipe bank',a,b,profile,'#a76c43');
      }
    }
  }
  // Continuous curved upper barriers are visible, with the same authored paths
  // used for swept on-foot collision and the kart's spatially indexed contacts.
  for(const [index,path]of stadiumBoundaryPaths().entries()){
    const vertices:number[]=[],indices:number[]=[];
    for(const p of path)vertices.push(p[0],p[1]+(index<2?9.5:0),p[2],p[0],p[1]+STADIUM.wallTop,p[2]);
    for(let i=0;i<path.length-1;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    add({t:'mesh',nm:'Stadium upper crash wall',p:[0,0,0],vertices,indices,doubleSided:true,color:'#536f70',tex:'metal',solid:false});
    add({t:'coastwall',nm:'Continuous stadium containment',p:[0,18,0],pts:path.map(p=>[p[0],p[2]]),w:.65,rise:24});
  }
  // Each grandstand is one authored stepped mesh. Individual seats and people
  // are shared instanced geometry in StadiumCrowd, grouped by these sections.
  for(const section of stadiumSections()){
    const vertices:number[]=[],indices:number[]=[],colors:number[]=[],{start,end,side}=section;
    const quad=(a:number[],b:number[],d:number[],e:number[],shade:number)=>{const n=vertices.length/3;vertices.push(...a,...b,...d,...e);indices.push(n,n+1,n+2,n+1,n+3,n+2);for(let k=0;k<4;k++)colors.push(shade,shade,shade);};
    for(let row=0;row<STADIUM.rows;row++){
      const lo=side*(STADIUM.standStart+row*STADIUM.rowDepth),hi=side*(STADIUM.standStart+(row+1)*STADIUM.rowDepth),y=15.5+row*STADIUM.rowRise;
      for(let s=start;s<end;s+=8){const b=Math.min(end,s+8);quad(stadiumPoint(s,lo,y),stadiumPoint(s,hi,y),stadiumPoint(b,lo,y),stadiumPoint(b,hi,y),row%2?.84:1);quad(stadiumPoint(s,lo,y-.85),stadiumPoint(s,lo,y),stadiumPoint(b,lo,y-.85),stadiumPoint(b,lo,y),.7);}
    }
    add({t:'mesh',nm:'Stepped stadium grandstand',p:[0,0,0],vertices,indices,colors,doubleSided:true,color:'#b6ad97',tex:'solid',solid:false});
    // Broad team-colour panels break up the rim; the large geometry stays at every distance.
    const mid=(start+end)/2,p=stadiumPoint(mid,side*27.15,10.6),yaw=-Math.atan(cartRallyFrame(mid).dx)*180/Math.PI;
    add({t:'platform',nm:'Coconut stadium team banner',p,s:[.22,2.0,Math.max(1,end-start-4)],yaw,color:Math.floor(start/48)%2?'#e3b142':'#dc6241',tex:'solid',solid:false});
    if(Math.floor((start+8)/48)%3===0){
      const q=stadiumPoint(mid,side*42,13);add({t:'platform',nm:'Stadium floodlight mast',p:[q[0],q[1]+10,q[2]],s:[.6,20,.6],color:'#647477',tex:'metal',solid:false});
      add({t:'platform',nm:'Floodlight head',p:[q[0],q[1]+20,q[2]],s:[1.3,2.6,7],yaw,color:'#fff1c2',emissive:'#ffcb71',tex:'solid',solid:false});
    }
  }
  for(const [index,s]of [70,670,1230,1790,2250].entries()){
    const side=index%2?1:-1,p=cartRallyPoint(s,side*10);
    add({t:'wall',nm:'Stadium tyre-colour chicane',p,s:[4,1.5,3],yaw:-Math.atan(cartRallyFrame(s).dx)*180/Math.PI,color:'#4b5351',tex:'solid'});
    strip('Soft dirt chicane',s-9,s+14,side>0?[-14,-10,-6,-3]:[3,6,10,14],'#805235',true,.04);
  }
  for(const [i,s]of CART_RALLY_CORNERS.entries()){
    const side=i%2?-1:1;
    // Chunky repeated chevrons follow each outside wall and show the turn early.
    for(let d=-60;d<=60;d+=12){
      const at=s+d,p=stadiumPoint(at,side*27.05,11.8),f=cartRallyFrame(at);
      const vertices=[[-1.5,-1],[-.6,-1],[.8,0],[-.6,1],[-1.5,1],[-.1,0]].flatMap(([along,y])=>[along*f.dx/f.n,y,-along/f.n]);
      add({t:'mesh',nm:'Sharp turn chevron',p,vertices,indices:[0,1,5,1,2,5,2,3,5,3,4,5],doubleSided:true,color:'#fff2b5',emissive:'#5a4114',tex:'solid',solid:false});
    }
  }
  for(const [i,j]of CART_RALLY_JUMPS.entries()){
    for(let s=j.start-16;s<j.start-3;s+=5)strip('Painted dirt launch marks',s,s+.9,[-12,0,12],'#e9c688',false,.045,false);
    for(const side of [-1,1]){const p=cartRallyPoint(j.start-1,side*16);add({t:'platform',nm:`Dirt jump ${i+1} flagpole`,p:[p[0],p[1]+3,p[2]],s:[.14,6,.14],tex:'solid',color:'#e3c28e',solid:false});add({t:'platform',nm:'Dirt launch flag',p:[p[0],p[1]+5.4,p[2]],s:[1.8,.9,.08],tex:'solid',color:i%2?'#ed8152':'#5ac9b7',solid:false});}
  }
  for(let s=65;s<CART_RALLY_LENGTH-70;s+=115){if(CART_RALLY_JUMPS.some(j=>s>j.start-45&&s<j.start+70))continue;for(const u of [-9,-3,3,9])add({t:'crate',kind:'mystery',p:cartRallyPoint(s,u),nm:'Rally item row'});}
  for(const s of CART_RALLY_SUPPLY_ROWS){for(const u of [-6,0,6])add({t:'crate',kind:'empty',p:cartRallyPoint(s+8,u),nm:'Rally box gem crate'});}
  for(let s=0;s<=CART_RALLY_LENGTH+35;s+=16)add({t:'camnode',p:cartRallyPoint(s),nm:'Rally chase camera'});
  add({t:'gate',p:cartRallyPoint(CART_RALLY_LENGTH),yaw:-Math.atan(cartRallyFrame(CART_RALLY_LENGTH).dx)*180/Math.PI,nm:'Coconut Cart Rally finish'});
  add({t:'pit',p:[240,-35,-CART_RALLY_LENGTH/2],s:[850,1,CART_RALLY_LENGTH+160],invisible:true,nm:'Stadium emergency recovery'});
  return c;
}
export const COCONUT_CART_RALLY_LEVEL:CustomLevelData={
  v:1,name:'Coconut Cart Rally',spawn:cartRallyPoint(18,0,.12),startWarpPad:false,killY:-45,
  sky:'day',keepPlayFog:true,cameraLookAhead:14,cameraAirLift:.8,cameraRig:{camDist:13,camHeight:7.5,camPitch:18,camFov:68},
  atmosphere:{fogEnabled:true,fogNear:170,fogFar:500,fogColor:'#d7bea0',ambientSky:'#e1eff2',ambientGround:'#a47b53',ambientIntensity:1.15,sunColor:'#fff0ce',sunIntensity:2,fillColor:'#c1e0e2',fillIntensity:.5,shadowStrength:.65,backdrop:'sky',drawDistance:600,fallbackTop:'#5fabc7',fallbackBottom:'#e4d4af',fallbackRidges:false,fallbackStars:false},
  medalTimes:{gold:125,silver:150,bronze:185},
  skateRace:{v:1,racers:8,vehicle:'golf-cart',seed:251026,stages:['Stadium stampede','Mud-bowl mayhem','Dirt double trouble','Grandstand sprint'],line,jumps:CART_RALLY_JUMPS.map(j=>({takeoff:cartRallyPoint(j.start),landing:cartRallyPoint(j.end)})),finishWidth:34,originalLength:CART_RALLY_LENGTH},components:[],
};
lazySourceField(COCONUT_CART_RALLY_LEVEL,'components',build);
