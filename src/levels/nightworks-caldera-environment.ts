import type { CustomComponent } from '../level';

type P=[number,number,number];
type Contour=readonly (readonly [number,number])[];
const ART={solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false,grp:90} as const;
const hash=(n:number):number=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const setting=(bonus:boolean)=>({radius:bonus?540:1480,centre:(bonus?[170,0,0]:[45,0,-350]) as P,bottom:bonus?-242:-550,top:bonus?235:520});

/** All three depth layers sample the same approved painting. The profiles
 * follow its rock silhouettes; no new bitmap or painted smoke is involved. */
export function calderaHorizon(bonus=false):CustomComponent {
  const {radius,centre,bottom,top}=setting(bonus);
  const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=96;i++){
    const a=-Math.PI+i/96*Math.PI*2;
    const u=a>=-1.38&&a<=1.38?.5+a/2.76:a<0?.018+.11*(1-Math.cos((a+1.38)*1.78)):.982-.11*(1-Math.cos((a-1.38)*1.78));
    for(const [y,v]of [[bottom,0],[top,1]]){vertices.push(Math.sin(a)*radius,y,-Math.cos(a)*radius);uvs.push(u,v);}
    if(i<96){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  const scale=bonus?.365:1;
  return {...ART,t:'mesh',nm:'Monumental caldera horizon',p:centre,vertices,indices,uvs,tex:'nightworks-caldera',fog:false,doubleSided:true,
    // The source is down inside the bowl and behind the nearer crater lip.
    to:[centre[0]-radius*.0414,bottom+(top-bottom)*.710,centre[2]-radius*.99914+7*scale],w:80*scale};
}

// Image coordinates: x left-to-right; y measured down from the top.
const CRATER_LIP:Contour=[
  [0,.79],[.20,.79],[.28,.65],[.32,.51],[.36,.47],[.393,.43],[.414,.33],
  [.431,.296],[.439,.278],[.448,.247],[.452,.225],[.462,.228],[.469,.242],
  [.479,.248],[.487,.249],[.493,.270],[.506,.283],[.519,.290],[.533,.344],
  [.553,.402],[.58,.478],[.64,.55],[.73,.72],[1,.80],
];
const LOWER_TERRACES:Contour=[
  [0,.83],[.04,.75],[.076,.689],[.108,.663],[.141,.670],[.178,.720],[.218,.698],
  [.253,.634],[.284,.646],[.319,.755],[.354,.740],[.381,.678],[.42,.735],
  [.457,.637],[.483,.635],[.514,.649],[.543,.660],[.580,.636],[.615,.679],
  [.657,.733],[.702,.782],[.744,.680],[.786,.648],[.827,.652],[.864,.666],[.898,.714],[.94,.750],[1,.79],
];

function cutLayer(bonus:boolean,name:string,tex:string,depth:number,profile:Contour):CustomComponent {
  const {radius,centre,bottom,top}=setting(bonus),eye:P=[centre[0],bonus?8:18,centre[2]];
  const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  const p:P=[eye[0]+(centre[0]-eye[0])*depth,eye[1]+(centre[1]-eye[1])*depth,eye[2]+(centre[2]-eye[2])*depth];
  // Extra columns preserve the curve between authored silhouette corners.
  const knots:[number,number][]=[];
  for(let i=0;i<profile.length-1;i++){
    const a=profile[i],b=profile[i+1],n=Math.max(1,Math.ceil((b[0]-a[0])*120));
    for(let j=0;j<n;j++){const t=j/n;knots.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  knots.push([...profile[profile.length-1]]);
  for(const [i,[u,y]]of knots.entries()){
    const angle=(u-.5)*2.76;
    for(const v of [0,1-y]){
      vertices.push(Math.sin(angle)*radius*depth,(bottom+v*(top-bottom))*depth,-Math.cos(angle)*radius*depth);uvs.push(u,v);
    }
    if(i<knots.length-1){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  }
  return {...ART,t:'mesh',nm:name,p,vertices,indices,uvs,tex,fog:false,doubleSided:true};
}

export function calderaLayers(bonus=false):CustomComponent[]{return [calderaHorizon(bonus),
  cutLayer(bonus,'Front caldera rim','nightworks-caldera-rim',.978,CRATER_LIP),
  cutLayer(bonus,'Lower caldera terraces','nightworks-caldera-terraces',.86,LOWER_TERRACES)];}

export function basaltFormation(p:P,width:number,height:number,depth:number,seed:number):CustomComponent {
  return {...ART,t:'decor',dkind:width>145?'nightbasaltfar':'nightbasalt',nm:'Fractured basalt formation',p,s:[width,height,depth],
    yaw:(hash(seed)*2-1)*38,color:width>65?'#8490aa':'#b4bdd0'};
}

export function calderaBasin(bonus=false):CustomComponent[] {
  const result:CustomComponent[]=[],center:P=bonus?[42,-25,-42]:[50,-46,-355];
  const rx=bonus?190:395,rz=bonus?150:610,scale=bonus?90:135;
  const vertices:number[]=[0,0,0],uvs:number[]=[center[0]/scale,center[2]/scale],indices:number[]=[],perimeter:P[]=[];
  for(let i=0;i<72;i++){
    const a=i/72*Math.PI*2,k=1+.07*Math.sin(a*5+.7)+.035*Math.cos(a*11),x=Math.cos(a)*rx*k,z=Math.sin(a)*rz*k;
    perimeter.push([x+center[0],center[1],z+center[2]]);vertices.push(x,0,z);uvs.push((x+center[0])/scale,(z+center[2])/scale);
    indices.push(0,1+(i+1)%72,1+i);
  }
  result.push({...ART,t:'mesh',nm:'Crusted caldera lake',p:center,vertices,indices,uvs,tex:'nightworks-magma',doubleSided:true,fog:true});
  for(let i=0;i<72;i+=6){const a=perimeter[i],b=perimeter[(i+3)%72];
    result.push(basaltFormation([a[0],center[1]-6,a[2]],bonus?32:70,bonus?16:35,bonus?29:64,i+41));
    if(i%12===0)result.push(basaltFormation([b[0]*.72,center[1]-3,b[2]*.82],bonus?18:40,bonus?5:7,bonus?18:36,i+73));
  }
  return result;
}

/** Staggered, overlapping terraces bridge the live rocks into the nearer
 * painted slopes. Their backs fade out before the streaming boundary. */
export function calderaNearScenery(bonus=false):CustomComponent[] {
  const result:CustomComponent[]=[];
  if(bonus){
    for(let i=0;i<6;i++){
      const x=-52+i*38;
      result.push(basaltFormation([x,-49,-37-(i%2)*12],55,32+hash(i+44)*16,48,343+i));
      result.push(basaltFormation([x+15,-75,-105-(i%2)*15],90,76+hash(i+88)*27,88,388+i));
    }
    for(const [i,x]of [-17,48,110].entries())result.push(basaltFormation([x,-26,-16],21,19+i*3,19,510+i));
  }else{
    for(let i=0;i<11;i++){
      const z=50-i*91,shift=Math.max(0,Math.min(1,(-z-290)/160)),left=-112+104*shift,right=151+93*shift;
      for(const [j,x]of [left,right].entries()){
        result.push(basaltFormation([x,-88,z+(j?28:0)],104+hash(i*4+j)*20,72+hash(i*7+j)*26-(j===0&&z<-340&&z>-450?16:0),134,210+i*13+j));
        result.push(basaltFormation([x+(j?119:-112),-115,z-38],170,128+hash(i*11+j)*45,181,620+i*17+j));
      }
    }
    for(const [i,p]of [[-51,-46,-38],[71,-46,-107],[-49,-46,-208],[120,-46,-260],[-35,-46,-320],
      [178,-46,-419],[49,-46,-480],[186,-46,-557],[51,-46,-643]].entries())
      result.push(basaltFormation(p as P,38,34+i%3*5,44,121+i*19));
  }
  return result;
}

/** Warm glow cards mark actual light positions in the chasm. Point lights
 * use a fixed two-slot pool, so the course never gains dozens of lights. */
export function calderaVentLights(bonus=false):CustomComponent[] {
  const points:P[]=bonus?[[-11,-8,-9],[24,-3,-12],[60,-3,-10],[95,-3,-10]]:
    [[-13,-4,4],[22,-4,-76],[-29,-2,-175],[69,0,-225],[3,0,-279],[40,0,-370],[98,0,-433],[131,5,-514],[102,19,-584],[146,21,-678]];
  return points.map((p,i)=>({...ART,t:'mesh',nm:'Caldera fissure light',p,
    vertices:[-14,-12,0,14,-12,0,14,12,0,-14,12,0],indices:[0,1,2,0,2,3],uvs:[0,0,1,0,1,1,0,1],
    tex:'nightworks-heat',to:[p[0],p[1]+18,p[2]],opacity:.18,color:i%2?'#ff4521':'#ff2818',amp:28,radius:52,doubleSided:true,fog:false}));
}
