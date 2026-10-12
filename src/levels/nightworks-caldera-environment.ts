import type { CustomComponent } from '../level';

type P = [number, number, number];
const ART = { solid:false, scenerySolid:false, edgeGrinding:false, castShadow:false, grp:90 } as const;
const hash = (n:number):number => { const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x); };

/** World-space matte cylinder, not camera-attached: nearby basalt supplies
 * parallax while the kilometre-scale landmark stays on the northern horizon. */
export function calderaHorizon(bonus=false):CustomComponent {
  const radius=bonus?540:1480,centre:P=bonus?[170,0,0]:[45,0,-350];
  const bottom=bonus?-242:-550,top=bonus?235:520;
  const vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  const segments=96;
  for(let i=0;i<=segments;i++){
    const angle=-Math.PI+i/segments*Math.PI*2;
    // The hero panorama spans 158 degrees. Beyond its outskirts, quiet
    // clouds/foothills wrap around the rear without duplicating the volcano.
    const u=angle>=-1.38&&angle<=1.38 ? .5+angle/2.76 :
      angle<0 ? .018+(.11*(1-Math.cos((angle+1.38)*1.78))):.982-(.11*(1-Math.cos((angle-1.38)*1.78)));
    for(const [y,v] of [[bottom,0],[top,1]]){
      vertices.push(Math.sin(angle)*radius,y,-Math.cos(angle)*radius);uvs.push(u,v);
    }
    if(i<segments){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  return {...ART,t:'mesh',nm:'Monumental caldera horizon',p:centre,vertices,indices,uvs,
    tex:'nightworks-caldera',fog:false,doubleSided:true};
}

/** A connected, irregular basin with an actual shoreline. Large cooled rafts
 * are 3D islands above the molten sheet, all below the original death plane. */
export function calderaBasin(bonus=false):CustomComponent[] {
  const result:CustomComponent[]=[];
  const center:P=bonus?[42,-25,-42]:[50,-46,-355];
  const rx=bonus?190:395,rz=bonus?150:610;
  const vertices:number[]=[0,0,0],uvs:number[]=[center[0]/100,center[2]/100],indices:number[]=[];
  const perimeter:P[]=[];
  const n=72,scale=bonus?90:135;
  for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,k=1+.07*Math.sin(a*5+.7)+.035*Math.cos(a*11);
    const x=Math.cos(a)*rx*k,z=Math.sin(a)*rz*k;
    perimeter.push([x+center[0],center[1],z+center[2]]);
    vertices.push(x,0,z);uvs.push((x+center[0])/scale,(z+center[2])/scale);
    indices.push(0,1+(i+1)%n,1+i);
  }
  uvs[0]=center[0]/scale;uvs[1]=center[2]/scale;
  result.push({...ART,t:'mesh',nm:'Crusted caldera lake',p:center,vertices,indices,uvs,
    tex:'nightworks-magma',doubleSided:true,fog:true});
  // Chunked shore lets native frustum/fog culling retire the far perimeter.
  for(let i=0;i<n;i+=6){
    const a=perimeter[i],b=perimeter[(i+3)%n];
    result.push(basaltFormation([a[0],center[1]-6,a[2]],bonus?22:54,bonus?13:28,bonus?17:39,i+41));
    if(i%12===0)result.push(basaltFormation([b[0]*.72,center[1]-3,b[2]*.82],bonus?15:30,bonus?5:7,bonus?12:25,i+73));
  }
  return result;
}

/** Shared generated geology; each placement varies the massing and rotation.
 * All forms are visual-only, outside the original traversal contact graph. */
export function basaltFormation(p:P,width:number,height:number,depth:number,seed:number):CustomComponent {
  return {...ART,t:'decor',dkind:'nightbasalt',nm:'Fractured basalt formation',p,s:[width,height,depth],
    yaw:(hash(seed)*2-1)*38,color:'#c6cad4'};
}

export function calderaNearScenery(bonus=false):CustomComponent[] {
  const result:CustomComponent[]=[];
  const spots:P[]=bonus?[[-17,-25,-19],[12,-25,-29],[48,-25,-34],[79,-25,-28],[110,-25,-16]]:
    [[-52,-46,-38],[64,-46,-96],[-61,-46,-177],[112,-46,-238],[-47,-46,-301],
     [177,-46,-352],[178,-46,-434],[42,-46,-478],[195,-46,-555],[54,-46,-619],[185,-46,-704]];
  if(bonus){
    result.push(basaltFormation([-15,-25,-66],38,42,25,432));
    result.push(basaltFormation([118,-25,-83],52,34,28,453));
  }
  for(const [i,p]of spots.entries()){
    result.push(basaltFormation(p,bonus?24:38,bonus?22+i%3*4:38+i%4*5,bonus?16:32,121+i*19));
    result.push(basaltFormation([p[0]+(i%2?13:-15),p[1],p[2]-10],bonus?12:23,bonus?11:24,bonus?10:19,178+i*7));
  }
  return result;
}
