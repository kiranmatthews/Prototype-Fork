import type { CustomComponent, CustomLevelData } from '../level';
import { stadiumFloodlight } from './stadium-floodlights';
import type { RaceKnot } from '../race/types';
import { lazySourceField } from './lazy-source';
import { CART_RALLY_LENGTH,CART_RALLY_JUMPS,CART_RALLY_SUPPLY_ROWS,CART_RALLY_CORNERS,STADIUM,cartRallyPoint,cartRallyFrame,stadiumPoint,stadiumStandQuad,stadiumSections,stadiumBoundaryPaths,rallyMudWetness,rallySurfacePoint } from './cart-stadium-layout';
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
      const s=a+(b-a)*j/rows,u=profile[i];vertices.push(...rallySurfacePoint(s,u,lift));uvs.push(Math.round(u/5*1e5)/1e5,Math.round(s/5*1e5)/1e5);
      const left=rallySurfacePoint(s,u-.01),right=rallySurfacePoint(s,u+.01),back=rallySurfacePoint(s-.01,u),front=rallySurfacePoint(s+.01,u);
      const x=right.map((v,k)=>v-left[k]),z=front.map((v,k)=>v-back[k]);
      const n=[x[1]*z[2]-x[2]*z[1],x[2]*z[0]-x[0]*z[2],x[0]*z[1]-x[1]*z[0]],length=Math.hypot(...n)||1;normals.push(...n.map(v=>Math.round(v/length*1e6)/1e6));
      const wet=rallyMudWetness(s,u),rut=(.91+.08*Math.sin(u*2.7+s*.047)*Math.sin(u*.6+s*.13))*(1-.24*wet);
      colors.push(...[rut,rut*(1-.035*wet),rut*(1-.085*wet)].map(v=>Math.round(v*1000)/1000));
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const p=j*(cols+1)+i,q=p+cols+1;indices.push(p,p+1,q,p+1,q+1,q);}
    add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,uvs,normals,colors,solid,color,tex:name==='Painted dirt launch marks'?'dirt':'rally-mud',smoothCollision:true,...(soft?{groundSpeedLimit:7}:{}),castShadow:false});
  };
  for(let s=-8;s<CART_RALLY_LENGTH+48;s+=24){
    const end=Math.min(s+24,CART_RALLY_LENGTH+48),cuts=[s,end,...CART_RALLY_JUMPS.flatMap(j=>[j.start+8,j.end+4]).filter(v=>v>s&&v<end)].sort((a,b)=>a-b);
    for(let i=0;i<cuts.length-1;i++){
      const a=cuts[i],b=cuts[i+1],soft=CART_RALLY_JUMPS.some(j=>(a+b)/2>j.start+8&&(a+b)/2<j.end+4);
      strip(soft?'Soft dirt landing trough':'Packed stadium dirt',a,b,Array.from({length:15},(_,i)=>-14+i*2),soft?'#81522e':'#bd8245',soft);
      for(const side of [-1,1]){
        strip('Loose dirt runoff',a,b,(side<0?[-17,-14]:[14,17]),'#b5743e',true);
        const profile=[17,19,21,23,24.5,25.5,26.2,26.65,27,27.4].map(u=>u*side).sort((x,y)=>x-y);
        strip('Tall dirt quarter-pipe bank',a,b,profile,'#c58a4c');
      }
    }
  }
  // Continuous curved upper barriers are visible, with the same authored paths
  // used for swept on-foot collision and the kart's spatially indexed contacts.
  for(const [index,path]of stadiumBoundaryPaths().entries()){
    const vertices:number[]=[],indices:number[]=[];
    for(const p of path)vertices.push(p[0],p[1]+(index<2?9.5:0),p[2],p[0],p[1]+STADIUM.wallTop,p[2]);
    for(let i=0;i<path.length-1;i++){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
    add({t:'mesh',nm:'Stadium upper crash wall',p:[0,0,0],vertices,indices,doubleSided:true,color:'#395b59',tex:'metal',solid:false});
    add({t:'coastwall',nm:'Continuous stadium containment',p:[0,18,0],pts:path.map(p=>[p[0],p[2]]),w:.65,rise:24});
  }
  // Each grandstand is one authored stepped mesh. Individual seats and people
  // are shared instanced geometry in StadiumCrowd, grouped by these sections.
  for(const section of stadiumSections()){
    const vertices:number[]=[],indices:number[]=[],colors:number[]=[],{start,end,side}=section;
    const quad=(a:number[],b:number[],d:number[],e:number[],shade:number)=>{const n=vertices.length/3;vertices.push(...a,...b,...d,...e);indices.push(n,n+1,n+2,n+1,n+3,n+2);for(let k=0;k<4;k++)colors.push(shade,shade,shade);};
    for(let row=0;row<STADIUM.rows;row++){
      const lo=side*(STADIUM.standStart+row*STADIUM.rowDepth),y=15.5+row*STADIUM.rowRise;
      for(let s=start;s<end;s+=STADIUM.standSegmentLength){const b=Math.min(end,s+STADIUM.standSegmentLength);quad(...stadiumStandQuad(s,b,side,row),row%2?.84:1);quad(stadiumPoint(s,lo,y-.85),stadiumPoint(s,lo,y),stadiumPoint(b,lo,y-.85),stadiumPoint(b,lo,y),.7);}
    }
    add({t:'mesh',nm:'Stepped stadium grandstand',p:[0,0,0],vertices,indices,colors,doubleSided:true,color:'#99aca0',tex:'solid',solid:false});
    const mid=(start+end)/2;
    const boardV:number[]=[],boardI:number[]=[],boardUV:number[]=[];
    for(let at=start+2,board=0;at<end-4;at+=22,board++){
      const finish=Math.min(at+20,end-2),brand=(Math.floor((start+8)/48)+board+(side>0?1:0))%4;
      for(let t=at;t<finish;t+=4){
        const next=Math.min(t+4,finish),n=boardV.length/3;
        for(const [along,h]of [[t,10.05],[next,10.05],[t,14.5],[next,14.5]]){
          boardV.push(...stadiumPoint(along,side*27.23,h));
          const x=(along-at)/(finish-at);boardUV.push(side>0?1-x:x,(brand+(h>12?1:0))/4);
        }
        boardI.push(n,n+1,n+2,n+1,n+3,n+2);
      }
    }
    add({t:'mesh',nm:'Stadium sponsor hoarding',p:[0,0,0],vertices:boardV,indices:boardI,uvs:boardUV,doubleSided:true,color:'#ffffff',tex:'rally-sponsors',solid:false,castShadow:false});
    if(Math.floor((start+8)/48)%3===0){
      for(const fixture of stadiumFloodlight(mid,side))add(fixture);
    }
  }
  // High festival bunting and pit awnings are visual-only meshes. Their
  // silhouettes stay intact; the route, mounds and containment are untouched.
  const cloth=['#efc75e','#d76239','#399788','#82b86a'];
  for(let s=70,span=0;s<CART_RALLY_LENGTH;s+=190,span++){
    const vertices:number[]=[],indices:number[]=[],colors:number[]=[];
    const point=(u:number,down=0)=>stadiumPoint(s,u,21-4.5*(1-(u/28)**2)-down);
    const face=(points:number[][],colour:string)=>{
      const n=vertices.length/3,r=parseInt(colour.slice(1,3),16)/255,g=parseInt(colour.slice(3,5),16)/255,b=parseInt(colour.slice(5,7),16)/255;
      points.forEach(p=>{vertices.push(...p);colors.push(r*r,g*g,b*b);});
      indices.push(n,n+1,n+2);if(points.length===4)indices.push(n,n+2,n+3);
    };
    for(let u=-28,i=0;u<28;u+=2,i++){
      face([point(u),point(u+2),point(u+2,.055),point(u,.055)],'#72664a');
      const a=point(u+.22),b=point(u+1.75),tip=point(u+.97,1.55+(i%3)*.15);tip[2]+=.38*Math.sin(i*1.7+span);
      face([a,b,tip],cloth[(i+span)%cloth.length]);
    }
    add({t:'mesh',nm:'Faded festival bunting',p:[0,0,0],vertices,indices,colors,doubleSided:true,color:'#ffffff',tex:'solid',solid:false,castShadow:false});
    for(const side of [-1,1]){
      const post=stadiumPoint(s,side*28,17);add({t:'platform',nm:'Festival bunting mast',p:post,s:[.15,8,.15],color:'#877b5f',tex:'metal',solid:false});
      const at=s+side*12,u=side*47,roof:number[]=[];
      for(const [ds,du,h]of [[-5,-5,26],[-5,5,26],[5,-5,26],[5,5,26],[0,0,29]])roof.push(...stadiumPoint(at+ds,u+du,h));
      add({t:'mesh',nm:'Mud festival pit canopy',p:[0,0,0],vertices:roof,indices:[0,1,4,1,3,4,3,2,4,2,0,4],doubleSided:true,color:cloth[(span+(side>0?1:0))%cloth.length],tex:'solid',solid:false});
      add({t:'platform',nm:'Raised festival pit deck',p:stadiumPoint(at,u,17.7),s:[10.5,.6,10.5],yaw:-Math.atan(cartRallyFrame(at).dx)*180/Math.PI,color:'#71634e',tex:'wood',solid:false});
      for(const ds of [-4.8,4.8])for(const du of [-4.8,4.8])add({t:'platform',nm:'Festival canopy pole',p:stadiumPoint(at+ds,u+du,22),s:[.14,8,.14],color:'#897a5d',tex:'metal',solid:false});
    }
  }
  for(const [index,s]of [90,390,780,950,1300,1470,1860,2020].entries()){
    const side=index%2?1:-1,p=cartRallyPoint(s,side*10);
    add({t:'wall',nm:'Stadium tyre-colour chicane',p,s:[4,1.5,3],yaw:-Math.atan(cartRallyFrame(s).dx)*180/Math.PI,color:'#4b5351',tex:'solid'});
    strip('Soft dirt chicane',s-9,s+14,side>0?[-14,-10,-6,-3]:[3,6,10,14],'#655039',true,.04);
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
    for(let s=j.start-16;s<j.start-3;s+=5)strip('Painted dirt launch marks',s,s+.9,[-12,0,12],'#ceb68a',false,.045,false);
    for(const side of [-1,1]){const p=cartRallyPoint(j.start-1,side*16);add({t:'platform',nm:`Dirt jump ${i+1} flagpole`,p:[p[0],p[1]+3,p[2]],s:[.14,6,.14],tex:'solid',color:'#e3c28e',solid:false});add({t:'platform',nm:'Dirt launch flag',p:[p[0],p[1]+5.4,p[2]],s:[1.8,.9,.08],tex:'solid',color:i%2?'#ee7838':'#56bfa0',solid:false});}
  }
  for(let s=65;s<CART_RALLY_LENGTH-70;s+=115){if(CART_RALLY_JUMPS.some(j=>s>j.start-45&&s<j.start+70))continue;for(const u of [-9,-3,3,9])add({t:'crate',kind:'mystery',p:cartRallyPoint(s,u),nm:'Rally item row'});}
  for(const s of CART_RALLY_SUPPLY_ROWS){for(const u of [-6,0,6])add({t:'crate',kind:'empty',p:cartRallyPoint(s+8,u),nm:'Rally box gem crate'});}
  for(let s=0;s<=CART_RALLY_LENGTH+35;s+=16)add({t:'camnode',p:cartRallyPoint(s),nm:'Rally chase camera'});
  add({t:'gate',p:cartRallyPoint(CART_RALLY_LENGTH),yaw:-Math.atan(cartRallyFrame(CART_RALLY_LENGTH).dx)*180/Math.PI,nm:'Coconut Cart Rally finish'});
  add({t:'pit',p:[0,-35,-CART_RALLY_LENGTH/2],s:[600,1,CART_RALLY_LENGTH+160],invisible:true,nm:'Stadium emergency recovery'});
  return c;
}
export const COCONUT_CART_RALLY_LEVEL:CustomLevelData={
  v:1,name:'Coconut Cart Rally',spawn:cartRallyPoint(18,0,.12),startWarpPad:false,killY:-45,
  sky:'sunset',keepPlayFog:true,cameraLookAhead:14,cameraAirLift:.8,cameraRig:{camDist:13,camHeight:7.5,camPitch:18,camFov:68},
  atmosphere:{fogEnabled:true,fogNear:110,fogFar:420,fogColor:'#c4c4ac',ambientSky:'#b8d9ed',ambientGround:'#96704a',ambientIntensity:1.15,sunColor:'#ffe1a6',sunIntensity:2.8,sunDirection:[-.18,.16,-.97],fillColor:'#83bfb4',fillIntensity:.48,shadowStrength:.78,backdrop:'painted sky',drawDistance:600,fallbackTop:'#a8ab8a',fallbackBottom:'#e1c28e',fallbackRidges:false,fallbackStars:false},
  medalTimes:{gold:125,silver:150,bronze:185},
  skateRace:{v:1,racers:8,vehicle:'golf-cart',seed:251026,stages:['Stadium stampede','Mud-bowl mayhem','Dirt double trouble','Grandstand sprint'],line,jumps:CART_RALLY_JUMPS.map(j=>({takeoff:cartRallyPoint(j.start),landing:cartRallyPoint(j.end)})),finishWidth:34,originalLength:CART_RALLY_LENGTH},components:[],
};
lazySourceField(COCONUT_CART_RALLY_LEVEL,'components',build);
