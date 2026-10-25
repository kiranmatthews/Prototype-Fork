import type { CustomComponent, CustomLevelData } from '../level';
import type { TempleRoute } from './jungle-sequels';
import { polishTempleEmbers } from './temple-embers-polish';
type P = [number, number, number];
export const TEMPLE_NIGHT_ATMOSPHERE: CustomLevelData['atmosphere'] = {
  fogNear: 28, fogFar: 185, fogColor: '#101f30', drawDistance: 240,
  ambientSky: '#7594bd', ambientGround: '#25332d', ambientIntensity: .78,
  sunColor: '#a1bde9', sunIntensity: .68, fillColor: '#6b93be', fillIntensity: .26,
  shadowStrength: .7, fallbackTop: '#040a19', fallbackBottom: '#172b40',
  fallbackStars: true, fallbackSunColor: null,
};

/** Both original temples are rigidly placed, so collision and every climb keep
 * their authored scale. A single ordered station frame spans the level seam. */
export function mergeTempleRoutes(a: TempleRoute, b: TempleRoute): TempleRoute {
  const link = 64, offset = a.end + link + 20, lift = a.peak;
  const join = a.toWorld(a.end, lift), anchor: P = [join[0] - link, lift, join[2]];
  const origin = b.toWorld(-20, 0);
  const transform = (p: readonly number[]): P => [anchor[0] + p[2] - origin[2], p[1] + lift, anchor[2] - p[0] + origin[0]];
  const direction = (p: readonly number[]): P => [p[2], p[1], -p[0]];
  const end = offset + b.end;
  const groundAt = (s: number) => s <= a.end ? a.groundAt(s) : s < offset-20 ? lift : lift + b.groundAt(s-offset);
  const toWorld = (s: number, y: number, side = 0): P => s <= a.end ? a.toWorld(s,y,side) :
    s < offset-20 ? [join[0]-(s-a.end),y,join[2]-side] : transform(b.toWorld(s-offset,y-lift,side));
  const frameAt = (s: number): ReturnType<TempleRoute['frameAt']> => {
    if(s<=a.end)return a.frameAt(s);
    if(s<offset-20)return {x:join[0]-(s-a.end),z:join[2],fx:-1,fz:0,scale:1,yaw:180};
    const f=b.frameAt(s-offset),p=transform([f.x,0,f.z]);
    return {...f,x:p[0],z:p[2],fx:f.fz,fz:-f.fx,yaw:f.yaw+90};
  };
  const samples=Array.from({length:Math.ceil(end+21)},(_,i)=>{const s=i-20;return {s,p:toWorld(s,groundAt(s))};});
  const toLocal = (p: readonly number[]): P => {
    let best=samples[0],cost=Infinity;
    for(const q of samples){const d=(q.p[0]-p[0])**2+(q.p[2]-p[2])**2+(q.p[1]-p[1])**2*.65;if(d<cost){cost=d;best=q;}}
    const f=frameAt(best.s),dx=p[0]-f.x,dz=p[2]-f.z;
    return [best.s+(dx*f.fx+dz*f.fz)/f.scale,p[1],-dx*f.fz+dz*f.fx];
  };
  const relocate = (c: CustomComponent): CustomComponent => {
    const out:CustomComponent={...c,p:transform(c.p),yaw:(c.yaw??0)+90,grp:c.grp===undefined?undefined:c.grp+100};
    // Mesh coordinates/rail points are baked world axes, whereas ordinary
    // primitives are local geometry. Rotate each representation exactly once.
    if(c.t==='mesh'){
      out.yaw=0;
      if(c.vertices){out.vertices=[];for(let i=0;i<c.vertices.length;i+=3)out.vertices.push(...direction(c.vertices.slice(i,i+3)));}
      if(c.normals){out.normals=[];for(let i=0;i<c.normals.length;i+=3)out.normals.push(...direction(c.normals.slice(i,i+3)));}
    }
    if(c.pts){out.yaw=0;out.pts=c.pts.map(q=>[q[1],-q[0],q[2]??0,q[3]??0,...(q.length>4?[q[4]!]:[])] as NonNullable<CustomComponent['pts']>[number]);}
    if(c.to)out.to=transform(c.to);
    return out;
  };
  const prune=(c:CustomComponent,first:boolean)=>c.t!=='camnode'&&c.t!=='bonusplatform'&&c.grp!==94&&!c.nm?.startsWith('Bonded stone ')&&
    !(first&&(c.t==='gate'||c.t==='crystal'))&&!(c.t==='clock'&&!first);
  const components:CustomComponent[]=[...a.data.components.filter(c=>prune(c,true)),...b.data.components.filter(c=>prune(c,false)).map(relocate)];
  // Preserve ordinary surface-edge grinds and the original gold rail lines.
  // Masonry material cleanup does not change their authored riding behavior.
  for(const c of components){
    if(c.nm?.startsWith('Playable temple storey')){c.tex='stone';c.color='#b7ba9f';}
  }
  // The old 28m square turning courts can cover an adjacent folded bowl.
  // Remove those overhanging triangles; each bowl owns its complete entry,
  // floor and exit, so there is no hidden upper floor or unexpected drop.
  const bowls=components.filter(c=>c.t==='vertramp');
  for(const court of components.filter(c=>c.t==='mesh'&&c.nm?.startsWith('Playable temple courtyard'))){
    const v=court.vertices!,keep:number[]=[];
    for(let i=0;i<court.indices!.length;i+=3){
      const tri=court.indices!.slice(i,i+3),points=tri.map(j=>[v[j*3]+court.p[0],v[j*3+1]+court.p[1],v[j*3+2]+court.p[2]]);
      const overlap=bowls.some(bowl=>{
        if(points[0][1]<bowl.p[1]+.1)return false;
        const a=(bowl.yaw??0)*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
        const half=bowl.w!+bowl.rise!*Math.sin((bowl.arc??60)*Math.PI/180)+(bowl.deck??0);
        return points.some(p=>{const dx=p[0]-bowl.p[0],dz=p[2]-bowl.p[2];return Math.abs(cs*dx-sn*dz)<half+.4&&Math.abs(sn*dx+cs*dz)<bowl.len!/2+.4;});
      });
      if(!overlap)keep.push(...tri);
    }
    court.indices=keep;
  }
  const add=(c:CustomComponent)=>components.push(c);
  const point=(s:number,side=0,up=0)=>toWorld(s,groundAt(s)+up,side);
  add({t:'platform',p:point(a.end+link/2,0,-.615),s:[link+0.08,1.3,10],tex:'dirt',color:'#a5a78a',grp:201,nm:'Continuous torch causeway: level seam with matched supported edges'});
  add({t:'platform',p:point(a.end+link/2,-4,-.615),s:[20,1.3,12],tex:'dirt',color:'#a5a78a',grp:201,nm:'Ember Reliquary bonus landing: protected side courtyard'});
  add({t:'checkpoint',p:point(a.end+14,1.1,.04),grp:205,nm:'Torch causeway checkpoint before the skyline climb'});
  add({t:'bonusplatform',p:point(a.end+link/2,-6,.04),to:point(a.end+link/2+5,1.25,.15),grp:205,nm:'Ember Reliquary: the single temple bonus and safe return'});
  // Low visible parapets frame the new crossing. The central route is 8m clear.
  for(const side of [-1,1])for(const [lo,hi] of [[492,510],[534,552]]){
    add({t:'wall',p:point((lo+hi)/2,side*5.1),s:[hi-lo,.85,.6],tex:'stone',color:'#929d87',edgeGrinding:false,grp:201,nm:'Causeway parapet with open bonus courtyard access'});
  }
  for(let s=492;s<554;s+=2.7)for(const side of [-2.6,0,2.6]){
    add({t:'decor',dkind:'stonepaver',p:point(s,side,-.15),s:[2.6,.23,2.5],yaw:90,solid:false,color:'#c6c7ab',grp:201,nm:'Worn processional slabs across the causeway'});
  }
  for(const s of [496,507,538,549])for(const side of [-1,1]){
    add({t:'decor',dkind:'stonebase',p:point(s,side*5.7,-.2),s:[2.5,.65,2.5],solid:false,grp:201,nm:'Causeway fern planter base'});
    add({t:'decor',dkind:'trialsv2ferna',p:point(s,side*5.7,.3),s:[2.8,1.49,2.61],yaw:s*19%360,solid:false,cameraCutaway:true,grp:209,nm:'Treehouse fern spilling over the causeway parapet'});
  }
  for(const s of [515,529]){
    add({t:'decor',dkind:'trialsv2groundcoverb',p:point(s,-8.8,.1),s:[3.8,1.39,3.43],solid:false,grp:209,nm:'Treehouse planting at the reliquary courtyard edge'});
    add({t:'torch',p:point(s,-8.8,.2),rise:1.4,w:1.1,grp:207,nm:'Reliquary courtyard welcoming brazier'});
  }
  for(let s=-20;s<=end;s+=4)add({t:'camnode',p:point(s),radius:0,grp:206,nm:'Continuous ordered terrace-to-skyline camera spine'});
  // Keep both switch circuits independent after relocating the skyline.
  const gaps=[...a.gaps,...b.gaps.map(g=>({...g,a:g.a+offset,b:g.b+offset,y:g.y+lift,switchX:g.switchX===undefined?undefined:g.switchX+offset,group:g.group===undefined?undefined:g.group+100}))];
  const pipes=[...a.pipes,...b.pipes.map(p=>({...p,a:p.a+offset,b:p.b+offset,lipY:p.lipY+lift,baseY:p.baseY+lift}))];
  const rooms=[...a.rooms,...b.rooms.map(r=>({...r,x:r.x+offset,y:r.y+lift,launchX:r.launchX+offset,capY:r.capY+lift,switchX:r.switchX===undefined?undefined:r.switchX+offset,group:r.group===undefined?undefined:r.group+100}))];
  const climbs=[...a.climbs,...b.climbs.map(c=>({...c,a:c.a+offset,b:c.b+offset,base:c.base+lift,top:c.top+lift}))];
  // Every elevated recovery stretch gets a checkpoint before a distinct trial.
  for(const s of [285,offset+475,offset+620])add({t:'checkpoint',p:point(s,1.1,.04),grp:205,nm:'Temple recovery checkpoint before the next climb'});
  // Warm route punctuation uses the existing bounded six-light pool.
  for(let s=-8,i=0;s<end-6;s+=22,i++){
    if(gaps.some(g=>s>g.a-3&&s<g.b+3))continue;
    const inPipe=pipes.find(p=>s>p.a-1&&s<p.b+1),side=(i%2?-1:1)*(inPipe?8.9:4.65);
    const y=inPipe?inPipe.lipY:groundAt(s);
    add({t:'torch',p:toWorld(s,y,side),rise:1.7,w:1.1,grp:207,nm:'Warm temple trail torch'});
  }
  const tikiStations=[94,375,offset+160,offset+298,offset+578,offset+678];
  for(const [i,s]of tikiStations.entries()){
    const side=([-1,-1,-1,1,-1,1] as const)[i],f=frameAt(s),p=point(s,side*6.4),yaw=Math.atan2(side*f.fz,-side*f.fx)*180/Math.PI;
    add({t:'platform',p:[p[0],p[1]-.25,p[2]],s:[3.8,.5,3.8],color:'#a1a68c',tex:'stone',grp:208,nm:'Tiki brazier footing clear of the traversable lane'});
    add({t:'wall',p:[p[0],p[1],p[2]],s:[2.65,2.9,2.65],invisible:true,edgeGrinding:false,grp:208,nm:'Tiki head collision core outside the path'});
    add({t:'firetiki',p,yaw,range:7.1,cycle:7.8,phase:i*1.27,amp:28,w:1,grp:208,nm:'Turning flame tiki: amber windup, fire sweep, then safe cooling'});
  }
  // Replace the coarse original foliage with the accepted Treehouse library.
  // Preserve natural aspect ratios, roots and clearance from EVERY path arm.
  const treeRatios:Record<string,P>={trialsv2treea:[26,17.766,25.911],trialsv2treeb:[26,16.741,17.709],trialsv2crowna:[26,11.292,23.015],trialsv2crownb:[26,9.405,26],trialsv2ferna:[3,1.601,2.798],trialsv2fernb:[3,1.838,2.957],trialsv2groundcovera:[5,1.043,2.581],trialsv2groundcoverb:[5,1.826,4.516]};
  let plantIndex=0;
  for(let i=components.length-1;i>=0;i--){
    const c=components[i];if(c.t!=='decor'||!c.dkind||!['junglecanopy','junglebackdrop','junglepalmtree','jungleleaf','junglefern'].includes(c.dkind))continue;
    const index=plantIndex++,tree=['junglecanopy','junglebackdrop','junglepalmtree'].includes(c.dkind);
    const kind=tree?(index%2?'trialsv2treea':'trialsv2treeb'):c.dkind==='junglefern'?(index%2?'trialsv2ferna':'trialsv2fernb'):(index%2?'trialsv2groundcovera':'trialsv2groundcoverb');
    const ratio=treeRatios[kind],width=tree?Math.min(24,c.s![0]*.85):Math.min(6,c.s![0]);
    c.dkind=kind as CustomComponent['dkind'];c.s=ratio.map(n=>n*width/ratio[0]) as P;c.color='#ffffff';c.solid=false;c.cameraCutaway=true;
    if(samples.some(q=>q.p[1]+4>c.p[1]&&q.p[1]<c.p[1]+c.s![1]&&Math.hypot(q.p[0]-c.p[0],q.p[2]-c.p[2])<(tree?width*.36:width*.44)+4.6)){components.splice(i,1);continue;}
    c.nm=tree?'Treehouse ancient jungle tree, rooted outside every route':'Treehouse fern and groundcover planting';
  }
  // Additional crowns, ferns and banks punctuate the bridge and outer horizon.
  for(let s=-12,i=0;s<end;s+=34,i++)for(const side of [-1,1]){
    const p=point(s,side*21,-5),width=22+(i%3)*2,kind=i%2?'trialsv2crowna':'trialsv2crownb';
    if(samples.some(q=>q.p[1]+5>p[1]&&q.p[1]<p[1]+22&&Math.hypot(q.p[0]-p[0],q.p[2]-p[2])<width*.5+7))continue;
    add({t:'decor',dkind:i%2?'trialsv2treea':'trialsv2treeb',p,s:[width,width*.68,width*.85],yaw:(i*137)%360,solid:false,cameraCutaway:true,grp:209,nm:'Treehouse layered outer jungle tree'});
    add({t:'decor',dkind:kind,p:[p[0],p[1]+12,p[2]],s:[width,width*.41,width*.93],yaw:i*73%360,solid:false,cameraCutaway:true,grp:209,nm:'Separate Treehouse overlapping leaf crown'});
  }
  const tikiTrials=tikiStations.map((s,i)=>({s,side:([-1,-1,-1,1,-1,1] as const)[i]}));
  const groups=[...(a.data.groups??[]),...(b.data.groups??[]).map(g=>({...g,id:g.id+100})),
    {id:201,nm:'Torch causeway and refuge',editorOnly:true},{id:205,nm:'Merged course recovery and bonus',editorOnly:true},
    {id:206,nm:'Continuous camera spine',editorOnly:true},{id:207,nm:'Pooled warm torch lighting',editorOnly:true},
    {id:208,nm:'Turning fire tiki sentinels',editorOnly:true},{id:209,nm:'Treehouse forest canopy',editorOnly:true}];
  // Checkpoint order follows travel rather than the builder insertion order.
  const orderedCheckpoints=components.filter(c=>c.t==='checkpoint').sort((x,y)=>toLocal(x.p)[0]-toLocal(y.p)[0]);
  for(let i=components.length-1;i>=0;i--)if(components[i].t==='checkpoint')components.splice(i,1);
  components.push(...orderedCheckpoints);
  const data:CustomLevelData={...a.data,name:'Temple of Embers',spawn:a.data.spawn,sky:'night',keepPlayFog:true,
    jungleDepthFade:false,jungleStyle:'painterly',atmosphere:TEMPLE_NIGHT_ATMOSPHERE,relicTime:240,
    medalTimes:{gold:240,silver:330,bronze:460},components,groups};
  const sourceComponents=[...a.sourceComponents.filter(c=>prune(c,true)),...b.sourceComponents.filter(c=>prune(c,false)).map(c=>({...c,p:[c.p[0]+offset,c.p[1]+lift,c.p[2]] as P,grp:c.grp===undefined?undefined:c.grp+100}))];

  const route:TempleRoute={id:'jungle-terraces',data,sourceComponents,toWorld,toLocal,frameAt,groundAt,
    profile:[...a.profile,[a.end+link,lift],...b.profile.map(([s,y])=>[s+offset,y+lift] as const)],pipes,gaps,rooms,climbs,tikiTrials,peak:lift+b.peak,end};
  polishTempleEmbers(route);
  return route;
}
