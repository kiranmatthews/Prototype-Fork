import * as THREE from 'three';
import type { CustomComponent, CustomOceanData } from '../level';

type Point = [number, number, number];
const r = (n:number) => Math.round(n * 100000) / 100000;

/** Length is added to ordinary connecting ground. Native jumps, grinds,
 * river stones, rock treads and the complete halfpipe retain their shapes. */
export const TREEHOUSE_TRIALS_JOINS = [
  {near:16, far:28, extra:32, y:0, name:'Coastal clearing into the deep forest'},
  {near:112, far:116, extra:32, y:-14, name:'Downhill into the coastal forest'},
  {near:158, far:162, extra:20, y:-14, name:'Forest into the coastal settlement'},
  {near:189, far:193, extra:24, y:-14, name:'Coast into enclosed village'},
  {near:222, far:226, extra:24, y:-14, name:'Village into the riverbank'},
  {near:242, far:276, extra:32, y:-14, name:'River into the distant cave mouth'},
  {near:314, far:326, extra:18, y:-7.2, name:'Rock climb into the cavern gallery'},
  {near:372, far:378, extra:20, y:-7.2, name:'Cavern pipe into the broken bridge'},
  {near:405, far:417, extra:20, y:-7.2, name:'Cave mouth into sunlit jungle'},
] as const;

export function treehouseTrialZ(z:number):number {
  const progress=-z;
  let extra=0;
  for(const join of TREEHOUSE_TRIALS_JOINS)
    extra+=join.extra*THREE.MathUtils.smoothstep(progress,join.near,join.far);
  return r(z-extra);
}

export function treehouseTrialOffset(z:number):number {
  const t=-z;
  return r(6*THREE.MathUtils.smoothstep(t,112,116)-6*THREE.MathUtils.smoothstep(t,189,193)
    +8*THREE.MathUtils.smoothstep(t,242,276)-8*THREE.MathUtils.smoothstep(t,372,378)
    +6*THREE.MathUtils.smoothstep(t,405,417));
}
export function treehouseTrialPoint(p:readonly number[]):Point {
  return [r(p[0]+treehouseTrialOffset(p[2])),p[1],treehouseTrialZ(p[2])];
}
function sourceZ(z:number):number {
  let near=z,far=z+222;
  for(let i=0;i<22;i++){const middle=(near+far)/2;if(treehouseTrialZ(middle)<z)near=middle;else far=middle;}
  return (near+far)/2;
}
/** The smooth camera spine follows the same extended terrain, including
 * the bend centres, while retaining every authored mechanical landmark. */
export function densifyTreehouseRoute(nodes:readonly Point[]):Point[]{
  const result:Point[]=[];
  for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i],zs=[a[2]];
    for(const join of TREEHOUSE_TRIALS_JOINS)for(let n=0;n<=4;n++){
      const z=-(join.near+(join.far-join.near)*n/4);
      if(z<a[2]&&z>b[2])zs.push(z);
    }
    if(i===nodes.length-1)zs.push(b[2]);
    for(const z of [...new Set(zs)].sort((a,b)=>b-a)){
      const t=(z-a[2])/(b[2]-a[2]);
      result.push([r(a[0]+(b[0]-a[0])*t),r(a[1]+(b[1]-a[1])*t),z]);
    }
  }
  return result;
}
const terrainProfile:Point[]=[[35,0,-16],[35,0,-28],[35,-3,-42],[35,-2.2,-46],[35,-5.1,-50],
  [35,-6.7,-67],[35,-5.9,-71],[35,-9,-75],[35,-10.6,-94],[35,-9.8,-98],[35,-13,-102],
  [35,-14,-112],[35,-14,-282],[35,-7.2,-314],[35,-7.2,-520]];
function landscapeY(z:number):number{
  for(let i=1;i<terrainProfile.length;i++){
    const a=terrainProfile[i-1],b=terrainProfile[i];
    if(z<=a[2]&&z>=b[2])return a[1]+(b[1]-a[1])*(z-a[2])/(b[2]-a[2]);
  }
  return z>-16?0:-7.2;
}
function landscapeSkirts():CustomComponent[]{
  const result:CustomComponent[]=[];
  const strip=(near:number,far:number,inner:number,outer:number,solid:boolean,name:string)=>{
    const v:number[]=[],ix:number[]=[],uv:number[]=[],color:number[]=[],rows=Math.ceil((near-far)/3),cols=6;
    for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
      const z=near+(far-near)*row/rows,x=inner+(outer-inner)*col/cols;
      const relief=Math.sin(z*.13+x*.17)*.45*col/cols+Math.sin(x*.11)*.22*col/cols;
      v.push(x,landscapeY(z)+.28+relief,z);uv.push(x/9,z/9);
      const paint=new THREE.Color('#697b49').lerp(new THREE.Color('#4d6341'),col/cols*.55);
      color.push(paint.r,paint.g,paint.b);
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;
      if(outer>inner)ix.push(a,b,c,b,d,c);else ix.push(a,c,b,b,c,d);
    }
    result.push({t:'mesh',p:[0,0,0],vertices:v.map(r),indices:ix,uvs:uv.map(r),colors:color.map(r),
      solid,edgeGrinding:false,tex:'treehouse-loam',color:'#ffffff',nm:name,grp:16});
  };
  for(const side of [-1,1])for(const [near,far] of [[-28,-162],[-189,-282],[-404,-500]] as const)
    strip(near,far,35+side*42,35+side*96,false,'Continuous distant forest earth outside the containment');
  strip(-162,-189,22,-7,true,'Supported left forest shoulder behind the coastal hut');
  strip(-162,-189,-7,-61,false,'Distant coast forest earth beyond the left shoulder');
  for(const side of [-1,1])strip(-228,-240,35+side*27,35+side*42,true,'Supported distant forest bank beside the shallow river');
  strip(-444,-500,-7,77,true,'Sunlit forest earth beyond the finish');
  return result.map(stretchComponent);
}
const shoreZ=(x:number)=>16+x*.07+Math.sin(x*.1)*1.4;
const shoreline=Array.from({length:81},(_,i)=>{
  const x=-35+i*1.25,slope=.07+.14*Math.cos(x*.1),length=Math.hypot(1,slope);
  return [x,shoreZ(x),-slope/length,1/length] as [number,number,number,number];
});
export const TREEHOUSE_TRIALS_OPENING_OCEAN:CustomOceanData={
  p:[0,-.85,0],geometryVersion:2,length:100,seaward:1,width:180,overlap:8,
  longitudinalSegments:96,lateralSegments:32,sourceCoordinates:'three',extendTails:false,shore:[
    [-48,-96,-1,0],[-48,-63,-1,0],[-45,-30,-1,0],[-42,-6,-.95,.31],[-35,shoreZ(-35),-.7,.7],...shoreline.slice(1),
  ],
};

/** Clip the original clearing at a shared, sampled shoreline. The adjoining
 * sand uses exactly the same edge, avoiding layered coplanar rectangles. */
function clipOpening(c:CustomComponent):CustomComponent {
  const source=c.vertices!,ix=c.indices!,v:number[]=[],uv:number[]=[],paint:number[]=[],out:number[]=[];
  const shared=new Map<string,number>();
  const sample=(id:number)=>[
    source[id*3],source[id*3+1],source[id*3+2],
    ...(c.uvs?.slice(id*2,id*2+2)??[0,0]),...(c.colors?.slice(id*3,id*3+3)??[1,1,1]),
  ];
  const edge=(p:number[])=>shoreZ(p[0]+c.p[0])-p[2]-c.p[2];
  const insert=(p:number[])=>{
    const blend=1-THREE.MathUtils.smoothstep(edge(p),0,4.5);
    const sand=new THREE.Color('#ead5ad');
    p=p.map((value,i)=>i>=5?value+(sand.toArray()[i-5]-value)*blend:value);
    const key=p.map(r).join('/');let index=shared.get(key);
    if(index===undefined){index=v.length/3;shared.set(key,index);v.push(...p.slice(0,3).map(r));
      uv.push(...p.slice(3,5).map(r));paint.push(...p.slice(5,8).map(r));}
    return index;
  };
  for(let i=0;i<ix.length;i+=3){
    const poly=[sample(ix[i]),sample(ix[i+1]),sample(ix[i+2])],clipped:number[][]=[];
    for(let j=0;j<3;j++){
      const a=poly[j],b=poly[(j+1)%3],aa=edge(a),bb=edge(b);
      if(aa>=0)clipped.push(a);
      if((aa>=0)!==(bb>=0)){
        const t=aa/(aa-bb);clipped.push(a.map((value,k)=>value+(b[k]-value)*t));
      }
    }
    for(let j=1;j<clipped.length-1;j++)out.push(insert(clipped[0]),insert(clipped[j]),insert(clipped[j+1]));
  }
  return {...c,vertices:v,uvs:uv,colors:paint,indices:out,normals:undefined};
}

function openingCoast():CustomComponent[] {
  const v:number[]=[],ix:number[]=[],uv:number[]=[],colors:number[]=[],rows=[0,1.6,4.4,8.2,13];
  for(let row=0;row<rows.length;row++)for(const [x,z] of shoreline){
    const y=[0,-.14,-.62,-1.3,-2.8][row];
    const reach=rows[row]*(1+.17*Math.sin(x*.21))+.24*Math.sin(x*.39)*row/4;
    const relief=row&&row<4?Math.sin(x*.24+row*.7)*.045:0;
    v.push(x,y+relief,z+reach);uv.push(x/6.5,(z+reach)/6.5);
    const color=new THREE.Color('#f1dfb5').lerp(new THREE.Color('#b6a681'),row/(rows.length-1)*.32);
    colors.push(color.r,color.g,color.b);
  }
  for(let row=0;row<rows.length-1;row++)for(let col=0;col<80;col++){
    const a=row*81+col,b=a+1,c=a+81,d=c+1;ix.push(a,c,b,b,c,d);
  }
  const coast:CustomComponent[]=[{t:'mesh',p:[0,0,0],vertices:v.map(r),indices:ix,uvs:uv.map(r),colors:colors.map(r),
    tex:'treehouse-loam',color:'#ffffff',edgeGrinding:false,nm:'Opening ocean · continuous curved sandy shore',grp:10},
    {t:'decor',dkind:'treehousetrialscoastmatte',p:[-118,-38.36,25],s:[158,65.833,.02],yaw:90,
      nm:'Opening ocean · distant island shore beyond the lagoon',grp:6}];
  for(const [x,z,w,h,yaw] of [[-30,14,5.4,2.1,28],[-24,16.4,3.3,1.4,-18],[-6,19,4.1,1.5,32],[32,22.5,5.2,1.9,17]] as const)
    coast.push({t:'decor',dkind:'treehousemossrock',p:[x,-1.15,z],s:[w,h,w*.8],yaw,
      nm:'Opening ocean · rounded shore rock partly submerged in the tide',grp:10});
  const west:number[]=[],wu:number[]=[],wc:number[]=[],wi:number[]=[];
  for(let row=0;row<=24;row++)for(let col=0;col<=4;col++){
    const z=-28+42*row/24,x=-35-col*2.8,y=[0,-.12,-.5,-1.05,-2.25][col];
    west.push(x,y,z);wu.push(x/6.5,z/6.5);
    const color=new THREE.Color('#e7d5ad').lerp(new THREE.Color('#b9ac87'),col/4*.3);wc.push(color.r,color.g,color.b);
  }
  for(let row=0;row<24;row++)for(let col=0;col<4;col++){
    const a=row*5+col,b=a+1,c=a+5,d=c+1;wi.push(a,b,c,b,d,c);
  }
  coast.push({t:'mesh',p:[0,0,0],vertices:west.map(r),indices:wi,uvs:wu.map(r),colors:wc.map(r),
    tex:'treehouse-loam',color:'#ffffff',edgeGrinding:false,nm:'Opening ocean · western sandy shelf below the host trees',grp:10});
  return coast;
}

function stretchComponent(source:CustomComponent):CustomComponent {
  const c:CustomComponent={...source,p:[...source.p]},oldZ=c.p[2];
  c.p=treehouseTrialPoint(c.p);
  if(c.to)c.to=treehouseTrialPoint(c.to);
  if(c.pts)c.pts=c.pts.map(p=>[r(p[0]+treehouseTrialOffset(oldZ+p[1])-treehouseTrialOffset(oldZ)),r(treehouseTrialZ(oldZ+p[1])-c.p[2]),...p.slice(2)] as typeof p);
  const broad=c.t==='mesh'&&c.vertices&&['dirt','sand','stone','treehouse-loam','treehouse-stone'].includes(c.tex??'');
  if(broad){
    const vertices=[...c.vertices!],zs=vertices.filter((_,i)=>i%3===2);
    if(Math.max(...zs)-Math.min(...zs)>5){
      const uvs=c.uvs?[...c.uvs]:undefined,tile=(c.grp??0)>=16?6:9;
      for(let i=2;i<vertices.length;i+=3){
        const world=oldZ+vertices[i],moved=treehouseTrialZ(world);
        vertices[i-2]=r(vertices[i-2]+treehouseTrialOffset(world)-treehouseTrialOffset(oldZ));
        vertices[i]=r(moved-c.p[2]);
        if(uvs)uvs[(i-2)/3*2+1]=r(uvs[(i-2)/3*2+1]+(moved-world)/tile);
      }
      c.vertices=vertices;c.uvs=uvs;delete c.normals;
    }
  }
  if(c.t==='mesh'&&c.materialStyle&&c.vertices){
    c.vertices=c.vertices.map((value,i)=>i%3===2?r(treehouseTrialZ(oldZ+value)-c.p[2])
      :i%3===0?r(value+treehouseTrialOffset(oldZ+c.vertices![i+2])-treehouseTrialOffset(oldZ)):value);
  }
  if(c.t==='platform'&&c.s&&!(c.yaw??0)){
    const near=treehouseTrialZ(oldZ+c.s[2]/2),far=treehouseTrialZ(oldZ-c.s[2]/2);
    c.p[2]=r((near+far)/2);c.s=[c.s[0],c.s[1],r(near-far)];
  }
  return c;
}

function joinPlanting():CustomComponent[] {
  const C:CustomComponent[]=[];
  const plant=(kind:NonNullable<CustomComponent['dkind']>,p:Point,s:Point,yaw:number,name:string)=>
    C.push({t:'decor',dkind:kind,p:[r(p[0]+treehouseTrialOffset(sourceZ(p[2]))),r(p[1]),r(p[2])],s,yaw,nm:name,grp:17});
  for(const [j,join] of TREEHOUSE_TRIALS_JOINS.entries()){
    if(j===2||j===6||j===7)continue;
    const near=treehouseTrialZ(-join.near),far=treehouseTrialZ(-join.far);
    for(let z=near-5,i=0;z>far+3;z-=8.8,i++)for(const side of [-1,1]){
      const shift=Math.sin(i*2.1+j)*.7;
      plant(i%2?'trialsv2ferna':'trialsv2fernb',[35+side*(6.6+shift),join.y-.12,z+side*.7],
        [3.4,i%2?1.815:2.083,i%2?3.171:3.351],side*70+i*41,'Joining landscape · grouped fern at the winding verge');
      if(i%2===0)plant(i%4?'trialsv2treea':'trialsv2treeb',[35+side*(16+shift),join.y-.35,z-3.8],
        i%4?[22,15.033,21.925]:[23,14.809,15.665],side*31+i*43,'Joining landscape · mature tree with supported roots');
      if(i%3===0)plant('trialsv2groundcovera',[35+side*9.7,join.y-.14,z+2.2],
        [5.2,1.085,2.684],side*92+i*29,'Joining landscape · low leaf skirt below the taller fern');
    }
  }
  // Extra cavern length is enclosed by the warped rock shell. Sculpted
  // shoulders make that longer gallery read as a continuous natural room.
  for(const [near,far] of [[314,326],[372,378]] as const){
    let i=0;
    for(let z=treehouseTrialZ(-near)-5;z>treehouseTrialZ(-far)+3;z-=10,i++)for(const side of [-1,1]){
      plant('trialsv2cavewallb',[35+side*14,-9.45,z],[11.5,11.057,7.13],side*90+i*7,
        'Joining cavern · broad sculpted wall shoulder');
      plant(i%2?'trialsv2ferna':'trialsv2fernb',[35+side*8.9,-6.95,z+2.1],
        [3.6,i%2?1.921:2.206,i%2?3.358:3.548],side*73+i*19,'Joining cavern · fern in a natural daylight pocket');
    }
  }
  plant('trialsv2treeb',[25,-14.35,treehouseTrialZ(-260)],[26,16.741,17.709],65,'River-to-cave forest · broad branching canopy before the distant portal');
  return C;
}

export function treehouseTrialContinuity(components:readonly CustomComponent[]):CustomComponent[] {
  const result:CustomComponent[]=[];
  for(let c of components){
    if(c.cameraView)continue;
    if(c.nm==='Quiet background porch beyond the river')continue;
    if(c.dkind==='treehousetrialsforestmatte')c={...c,p:[c.p[0],Math.min(c.p[1],landscapeY(c.p[2])-4),c.p[2]]};
    if(c.dkind==='treehousetrialscoastmatte')c={...c,p:[c.p[0],-37.4,c.p[2]]};
    if(c.dkind==='treehousemattemid')c={...c,dkind:'treehousetrialsforestmatte',color:'#b6cbbb'};
    if(c.nm==='Separate irregular porch approach board')continue;
    // Keep every porch door and cloth frontage visible. These three large
    // trunks previously occupied the same volumes as their hut roofs.
    if(c.nm==='Hero rooted tree frames the route in three dimensions'){
      const sites=new Map([[-169,[14.8,-183]],[-196,[15,-208]],[-221,[16,-227]]]);
      const site=sites.get(c.p[2]);if(site)c={...c,p:[site[0],c.p[1],site[1]]};
    }
    if(c.nm?.startsWith('Continuous painted opening ground'))c=clipOpening(c);
    if(c.nm==='Planted understory clump'&&c.p[2]>shoreZ(c.p[0])-.7)continue;
    if(c.nm==='Framing jungle tree'&&c.p[2]>shoreZ(c.p[0])-3)c={...c,p:[c.p[0],c.p[1],shoreZ(c.p[0])-4]};
    result.push(stretchComponent(c));
  }
  const opening:CustomComponent={t:'camnode',cameraView:true,p:[-3,5,12],s:[82,60,92],radius:18,
    cameraPosition:[-1,8.5,36],cameraTarget:[-1,5.5,-5],cameraFov:49,cameraFollowDistance:14.5,
    cameraFollowTargetHeight:4.3,nm:'Original opening framing · gentle hand-off to the continuous follow rig',grp:7};
  return [...result,...openingCoast(),...joinPlanting(),...landscapeSkirts(),opening];
}
