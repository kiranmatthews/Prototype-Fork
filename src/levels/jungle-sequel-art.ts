import type { CustomComponent } from '../level';
import type { JungleAssetKind } from '../jungleAssets';
import { jungleAssemblyComponents } from '../jungleAssemblies';

type P = [number, number, number];
interface TempleLandscape {
  variant: 1 | 2; end: number; source: readonly CustomComponent[];
  point: (s: number, y: number, side: number) => P;
  height: (s: number) => number;
  frame: (s: number) => { x: number; z: number; fx: number; fz: number; yaw: number };
}

/** Jungle Ruins' planted earth, fitted masonry and roofed spaces, authored as
 * ordinary components. Clearance includes neighbouring routes in this folded
 * world, not just the route alongside each prop. */
export function jungleSequelArt(r: TempleLandscape): CustomComponent[] {
  const out: CustomComponent[] = [];
  const rnd = (n: number) => { const x = Math.sin(n * 12.9898 + r.variant * 17.7) * 43758.5453; return x - Math.floor(x); };
  const pipes = r.source.filter(c => c.t === 'vertramp'), gaps = r.source.filter(c => c.t === 'pit');
  const stairs = r.variant === 1 ? [168, 234] : [258, 340];
  const pipeAt = (s: number) => pipes.find(c => Math.abs(s-c.p[0]) < c.w!+c.rise!*Math.sin((c.arc??60)*Math.PI/180)+(c.deck??0)+1);
  const bankY = (s: number) => { const c = pipeAt(s); return c ? c.p[1]+c.rise!*(1-Math.cos((c.arc??60)*Math.PI/180)) : r.height(s); };
  const inner = (s: number, side: number) => pipeAt(s) ? 9 : side<0 && s>stairs[0]-12 && s<stairs[1]+8 ? 11 : 4.8;
  const samples = Array.from({length:Math.ceil((r.end+40)/3)},(_,i)=>{
    const s=-20+i*3,f=r.frame(s);return {s,x:f.x,z:f.z,y:r.height(s)};
  });
  const clear = (s:number,p:P,radius:number,height:number) => !samples.some(q =>
    Math.abs(s-q.s)>24 && q.y+5>p[1] && q.y<p[1]+height && Math.hypot(q.x-p[0],q.z-p[2])<radius+5);
  const add = (dkind:JungleAssetKind,p:P,s:P,nm:string,color='#ffffff',yaw=0,grp=91) =>
    out.push({t:'decor',dkind,p,s,nm,color,yaw,solid:false,grp});
  const plant = (kind:JungleAssetKind,station:number,side:number,size:P,name:string,tint='#ffffff') => {
    const p=r.point(station,bankY(station)+.48,side);
    if(clear(station,p,Math.min(size[0],size[2])*.4,size[1]))add(kind,p,size,name,tint,rnd(station*7+side)*360);
  };

  // Rounded shoulders anchor the foliage and hide sheer ribbon edges. Short
  // patches stop at other routes and retain independent renderer culling.
  for(let a=-20;a<r.end+6;a+=8)for(const side of [-1,1]){
    const b=Math.min(a+8,r.end+6),mid=(a+b)/2;
    if(!clear(mid,r.point(mid,bankY(mid),side*(inner(mid,side)+4)),3,2))continue;
    const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[];
    const rows=5,offsets=[-.9,0,1,3.5,7,12],heights=[-.18,.4,1.05,.9,.45,-1.1];
    for(let row=0;row<rows;row++){
      const s=a+(b-a)*row/(rows-1),y=bankY(s);
      for(let col=0;col<offsets.length;col++){
        vertices.push(...r.point(s,y+heights[col]+Math.sin(s*.39+side)*.12,side*(inner(s,side)+offsets[col])));
        uvs.push(s/7,offsets[col]/7);
        colors.push(...(col>=2&&col<=4?[.50,.60,.29]:[1,.91,.72]));
      }
    }
    for(let row=0;row<rows-1;row++)for(let col=0;col<offsets.length-1;col++){
      const a=row*offsets.length+col,b=a+1,c=a+offsets.length,d=c+1;
      indices.push(...(side>0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));
    }
    out.push({t:'mesh',p:[0,0,0],vertices,indices,uvs,colors,tex:'dirt',color:'#e5d7b8',solid:false,grp:91,nm:'Continuous planted jungle shoulder'});
    const pts:NonNullable<CustomComponent['pts']>=[],origin=r.point(a,bankY(a)-.3,side*(inner(a,side)+.65));
    for(let s=a;s<=b+.01;s+=(b-a)/4){
      const p=r.point(s,bankY(s)-.3,side*(inner(s,side)+.65));
      pts.push([p[0]-origin[0],p[2]-origin[2],0,p[1]-origin[1]]);
    }
    out.push({t:'wallpath',p:origin,pts,w:.65,rise:4.8,collisionHeight:4.8,containment:true,invisible:true,grp:91,nm:'Planted bank boundary'});
  }
  for(let s=-18,i=0;s<r.end+8;s+=8.5,i++)for(const side of [-1,1]){
    const edge=inner(s,side),seed=i*43+side;
    plant(i%3===0?'junglefern':'jungleleaf',s+side*1.1,side*(edge+2.7),[6.1,2.8+rnd(seed)*.6,6],
      'Trailside broadleaf and fern',i%4===0?'#c3d6a1':'#ffffff');
    if(i%2===0)plant('jungleleaf',s+3,side*(edge+8),[9,5.8,9],'Deep bank undergrowth','#8da786');
    if(i%3===0)plant('junglepalmtree',s-2,side*(edge+8.5),[14,19,13],'Bank palm','#d8e3b6');
    if(i%2===1)plant(i%4===1?'junglecanopy':'junglebackdrop',s+2,side*(edge+14.5),[24,22+rnd(seed+7)*3,23],'Overlapping jungle canopy','#b7cea6');
  }

  // Missing slabs expose real earth, rather than another patterned plane.
  const paved:[number,number][]=r.variant===1?[[ -6,20],[80,108],[144,164],[234,294],[354,378],[424,490]]:
    [[-6,22],[140,172],[222,250],[340,400],[452,464],[568,594],[642,694],[764,818]];
  for(const [a,b]of paved)for(let s=a+1.3;s<b-.7;s+=2.65){
    if(gaps.some(c=>Math.abs(s-c.p[0])<c.s![0]/2+1.4)||pipeAt(s))continue;
    for(const side of [-2.55,0,2.55]){
      if(rnd(s*7+side)<.16)continue;
      add('stonepaver',r.point(s,r.height(s)-.15,side),[2.5,.23,2.55],'Worn court paving',rnd(s+side)>.5?'#e2dcc3':'#f1e6cb',90+r.frame(s).yaw,92);
    }
  }
  for(const c of r.source.filter(c=>c.nm?.startsWith('Jungle temple climbing step'))){
    const a=c.p[0]-c.s![0]/2,b=c.p[0]+c.s![0]/2,y=c.p[1]+c.s![1]/2;
    add('wornstoneblock',r.point(a+.5,y-1.8,c.p[2]),[4.9,1.8,1.05],
      'Exposed masonry stair riser','#e4dcc1',90+r.frame(a).yaw,92);
    for(let s=a+1.4;s<b-.8;s+=2.6)for(const side of [-1.2,1.2])
      add('stonepaver',r.point(s,y-.15,c.p[2]+side),[2.3,.23,2.5],
        'Climbing step paving','#ede3c6',90+r.frame(s).yaw,92);
  }
  const gateway=(s:number,name:string,width=18)=>{
    const p=r.point(s,r.height(s)-.12,0),yaw=90+r.frame(s).yaw;
    out.push(...jungleAssemblyComponents({dkind:'hangingarch',p,s:[width,12.5,2.8],yaw,seed:Math.round(s)},name,92));
    for(const side of [-1,1])out.push({t:'wall',p:r.point(s,r.height(s),side*(width/2-1.6)),s:[2.1,7.8,2.1],yaw,invisible:true,grp:92,nm:`${name} solid pier`});
  };
  const gateways:[number,string][]=r.variant===1?[[ -2,'Fern court gateway'],[82,'Jade reservoir gateway'],[237,'Bridge court gateway'],[357,'Sanctuary garden gateway'],[465,'Sanctuary landing gateway']]:
    [[-2,'Forest arrival gateway'],[143,'Cloud reservoir gateway'],[343,'Crown court gateway'],[575,'Cloud garden gateway'],[666,'Upper landing gateway'],[769,'Sun sanctuary gateway']];
  for(const [s,name]of gateways)gateway(s,name);
  const hall=(s:number,depth:number,name:string)=>{
    const y=r.height(s),yaw=90+r.frame(s).yaw;
    out.push(...jungleAssemblyComponents({dkind:'roofedtemple',p:r.point(s,y,0),s:[19,13.5,depth],yaw,openFloor:true,seed:Math.round(s)},name,93));
    for(const side of [-1,1])for(const along of [-depth/2+1.7,depth/2-1.7])
      out.push({t:'wall',p:r.point(s+along,y,side*7.8),s:[2.2,8,2.2],yaw,invisible:true,grp:93,nm:`${name} solid column`});
  };
  if(r.variant===1){hall(11,14,'Fern court portico');hall(280,12,'Jade bridge reward pavilion');hall(478,18,'High sanctuary');}
  else{hall(11,14,'Forest arrival portico');hall(156,16,'Cloud aqueduct hall');hall(582,14,'Cloud garden rest pavilion');hall(805,18,'Sun sanctuary');}

  // Retaining piers, coping and vines tie each real halfpipe to its reservoir.
  for(const c of pipes){
    const half=c.w!+c.rise!*Math.sin((c.arc??60)*Math.PI/180)+(c.deck??0),lip=bankY(c.p[0]);
    for(let s=c.p[0]-half+2;s<c.p[0]+half;s+=4)for(const side of [-1,1])
      for(let y=c.p[1]-.1,row=0;y<lip+.8;y+=1.8,row++)for(const face of [7.98,8.73])
        add(row%3===0?'wornstoneblock':'stoneblock',r.point(s,y,side*face),[3.9,Math.min(1.75,lip+1-y),.22],
          'Reservoir bonded masonry','#d1cdb3',r.frame(s).yaw,92);
    for(let s=c.p[0]-half+3;s<c.p[0]+half;s+=6)for(const side of [-1,1]){
      add('stonecornice',r.point(s,lip+.05,side*8.6),[5.9,.7,1.5],'Reservoir rim coping','#ded4b5',r.frame(s).yaw,92);
      add('stoneshaft',r.point(s,c.p[1]-.4,side*8.7),[1.4,lip-c.p[1]+.4,1.5],'Reservoir retaining pier','#c8cbb0',r.frame(s).yaw,92);
      if(Math.round(s)%3===0)add('junglevine',r.point(s,lip-1.8,side*8.8),[4,2.5,.8],'Vines over the reservoir','#adc58b',r.frame(s).yaw,92);
    }
  }
  // Enclosure rises with the course, including its high sanctuary storeys.
  const center=r.variant===1?[62,-17]:[56,-7];
  for(let i=0;i<26;i++){
    const angle=i/26*Math.PI*2,radius=r.variant===1?153:159,x=center[0]+Math.cos(angle)*radius,z=center[1]+Math.sin(angle)*radius;
    const nearest=samples.reduce((a,b)=>Math.hypot(a.x-x,a.z-z)<Math.hypot(b.x-x,b.z-z)?a:b);
    const base=Math.max(-14,nearest.y-27),height=46+rnd(i*17)*20;
    add('junglecliff',[x,base,z],[44,height,42],'Outer jungle ravine wall',i%2?'#b4c2ad':'#c6cbb1',angle*180/Math.PI,94);
    add('junglebackdrop',[x,base+height-14,z],[53,37,48],'Ravine canopy silhouette','#8eaf98',rnd(i*37)*360,94);
  }
  for(const s of [-33,r.end+14]){
    const p=r.point(s,bankY(s)-9,0);
    if(clear(s,p,12,28)){
      add('junglecliff',p,[38,11,22],'Terminal jungle bank','#b3bea2',90+r.frame(s).yaw,94);
      add('junglecanopy',[p[0],p[1]+8.6,p[2]],[38,29,28],'Terminal canopy','#a6c395',0,94);
      for(const side of [-7,0,7])add('jungleleaf',r.point(s-4,bankY(s)+.6,side),[11,5,10],
        'Sanctuary backdrop undergrowth','#c7d8ad',rnd(side+91)*360,94);
    }
  }
  const endY=bankY(r.end);
  out.push({t:'mesh',p:[0,0,0],vertices:[
    ...r.point(r.end-1,endY-.08,-20),...r.point(r.end-1,endY-.08,20),
    ...r.point(r.end+40,endY-.8,25),...r.point(r.end+40,endY-.8,-25)],
    indices:[0,1,2,0,2,3],tex:'dirt',color:'#b5b493',solid:false,grp:94,nm:'Earth beneath the sanctuary backdrop'});
  // Bank colour gradients need vertex colours, so the generic decor batcher
  // cannot merge them. Assemble small spatial sectors here instead of issuing
  // a separate draw (and shadow draw) for every eight metres of shoulder.
  const sectors=new Map<string,CustomComponent>();
  const result:CustomComponent[]=[];
  for(const c of out){
    if(c.t!=='mesh'||c.nm!=='Continuous planted jungle shoulder'){result.push(c);continue;}
    const v=c.vertices!,key=`${Math.floor(v[0]/48)},${Math.floor(v[2]/48)}`;
    let sector=sectors.get(key);
    if(!sector){sector={...c,vertices:[],indices:[],uvs:[],colors:[],nm:`Planted earth bank sector ${key}`};sectors.set(key,sector);}
    const offset=sector.vertices!.length/3;
    sector.vertices!.push(...v);sector.indices!.push(...c.indices!.map(i=>i+offset));
    sector.uvs!.push(...c.uvs!);sector.colors!.push(...c.colors!);
  }
  return [...result,...sectors.values()];
}
