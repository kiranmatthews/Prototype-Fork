import type { CustomComponent } from '../level';
import type { TempleRoute } from './jungle-sequels';

type P = [number, number, number];

/** Level-owned repairs and encounters. All contact, switches and attacks use
 * ordinary editor primitives; the movement model remains the shared one. */
export function polishTempleEmbers(route: TempleRoute): void {
  const {components, groups} = route.data;
  const point = (s: number, side = 0, up = 0): P => route.toWorld(s, route.groundAt(s) + up, side);
  const add = (c: CustomComponent, sourcePoint?: P) => {
    components.push(c);
    if (c.t === 'crate') route.sourceComponents.push({...c, p: sourcePoint??route.toLocal(c.p)});
  };
  const decor = (dkind: NonNullable<CustomComponent['dkind']>, s: number, side: number, up: number,
    size: P, nm: string, color = '#d9d1b4') => add({t:'decor',dkind,p:point(s,side,up),s:size,
      yaw:route.frameAt(s).yaw,
      amp:dkind==='stonepaver'?Math.atan2(route.groundAt(s+.2)-route.groundAt(s-.2),.4*route.frameAt(s).scale)*180/Math.PI:0,
      solid:false,scenerySolid:false,color,grp:215,nm});
  const crate = (s: number, side: number, up: number, kind: CustomComponent['kind'], nm: string,
    grp = 213, outline = false) => add({t:'crate',p:point(s,side,up),kind,nm,grp,...(outline?{outline:true}:{})},
      [s,route.groundAt(s)+up,side]);
  groups!.push(
    {id:210,nm:'Lantern stair: restore the metal steps',editorOnly:false},
    {id:211,nm:'Lower fuse court reward circuit',editorOnly:false},
    {id:212,nm:'Upper fuse court reward circuit',editorOnly:false},
    {id:213,nm:'Pilgrim offerings and stair rewards',editorOnly:true},
    {id:214,nm:'Temple patrols on supported ground',editorOnly:true},
    {id:215,nm:'Lantern courts and fitted stonework',editorOnly:true},
    {id:216,nm:'Continuous temple shoulders and parapets',editorOnly:true},
  );

  // The old cosmetic banks extended beyond the 8 m floor. Their invisible
  // barriers could let feet leave that floor before stopping the body. Give
  // the whole ordinary trail a real shoulder, with exactly the same chasms
  // and switch ownership as the central route. Bowls already own 16 m floors.
  const breaks = [...new Set([-20,route.end,...route.gaps.flatMap(g=>[g.a,g.b]),
    ...route.pipes.flatMap(p=>[p.a,p.b])])].sort((a,b)=>a-b);
  for(let k=1;k<breaks.length;k++) {
    const a=breaks[k-1],b=breaks[k],mid=(a+b)/2;
    if(route.pipes.some(p=>mid>p.a&&mid<p.b))continue;
    const gap=route.gaps.find(g=>mid>g.a&&mid<g.b);
    if(gap&&gap.switchX===undefined)continue;
    for(let start=a;start<b;start+=16)for(const side of [-1,1]) {
      const end=Math.min(b,start+16),count=Math.ceil(end-start),vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=count;i++) {
        const s=start+(end-start)*i/count,y=route.groundAt(s)+.035;
        for(const [u,h] of [[3.96,0],[5.55,0],[3.96,-.85],[5.55,-.85]])
          vertices.push(...route.toWorld(s,y+h,side*u));
      }
      // Keep top faces first so ordinary boundary grinds follow the pavement.
      for(let i=0;i<count;i++){const n=i*4;indices.push(...(side>0?[n,n+1,n+5,n,n+5,n+4]:[n,n+5,n+1,n,n+4,n+5]));}
      const topTriangles=indices.length/3;
      for(let i=0;i<count;i++){const n=i*4;indices.push(n+1,n+3,n+7,n+1,n+7,n+5,n,n+4,n+6,n,n+6,n+2);}
      add({t:'mesh',p:[0,0,0],vertices,indices,doubleSided:true,solidSides:true,grindTopTriangles:topTriangles,depthBias:2,
        tex:'stone',color:'#aaa991',grp:gap?.group??216,outline:!!gap,
        nm:gap?'Switch-bound jade bridge shoulder':'Supported temple shoulder: seal the planted-bank gap'});
    }
  }

  // The causeway has two proper courts: the existing bonus on the left and
  // a new optional crate staircase on the right, both with safe return space.
  const bonusCourt=components.find(c=>c.nm?.startsWith('Ember Reliquary bonus landing'))!;
  bonusCourt.p=point(522,-7.5,-.615);bonusCourt.s=[30,1.3,5];
  add({t:'platform',p:point(520,9.15,-.615),s:[36,1.3,8.3],tex:'stone',color:'#b8b59c',grp:215,
    nm:'Lantern stair court: broad supported approach and return'});
  // The old crossing's planters occupied the new court entrances. The new
  // corner planting below replaces them, keeping both approaches unobstructed.
  for(let i=components.length-1;i>=0;i--){
    const c=components[i];
    if(c.nm!=='Causeway fern planter base'&&c.nm!=='Treehouse fern spilling over the causeway parapet')continue;
    const [s,,side]=route.toLocal(c.p);
    if(side>0&&s>=502&&s<=538||side<0&&s>=507&&s<=537)components.splice(i,1);
  }

  // Replace the patchy cosmetic-bank barriers with visible continuous low
  // parapets. Collision rises above their coping to keep ordinary skating
  // slips in the course. Stair forks and both courts remain open and usable.
  for(let i=components.length-1;i>=0;i--)
    if(components[i].nm==='Planted bank boundary'||components[i].nm==='Causeway parapet with open bonus courtyard access')components.splice(i,1);
  const boundary=(a:number,b:number,side:number,offset=5.25,heightAt=route.groundAt) => {
    const origin=route.toWorld(a,heightAt(a)-.12,side*offset),pts:NonNullable<CustomComponent['pts']>=[];
    const count=Math.ceil((b-a)/1.5);
    for(let i=0;i<=count;i++){
      const s=a+(b-a)*i/count,p=route.toWorld(s,heightAt(s)-.12,side*offset);
      pts.push([p[0]-origin[0],p[2]-origin[2],0,p[1]-origin[1]]);
    }
    add({t:'wallpath',p:origin,pts,w:.55,rise:1.05,collisionHeight:4.8,containment:true,
      tex:'stone',color:'#9ca894',grp:216,nm:'Continuous carved temple parapet'});
  };
  const edgeBreaks=[...new Set([...breaks,502,507,537,538,
    ...route.climbs.flatMap(c=>[c.a-10,c.b+8])])].sort((a,b)=>a-b);
  for(let k=1;k<edgeBreaks.length;k++){
    const a=edgeBreaks[k-1],b=edgeBreaks[k],mid=(a+b)/2;
    if(route.gaps.some(g=>mid>g.a&&mid<g.b)||route.pipes.some(p=>mid>p.a&&mid<p.b))continue;
    for(const side of [-1,1]){
      if(side<0&&route.climbs.some(c=>mid>c.a-10&&mid<c.b+8))continue;
      if(side<0&&mid>507&&mid<537||side>0&&mid>502&&mid<538)continue;
      for(let s=a;s<b;s+=24)boundary(s,Math.min(b,s+24),side);
    }
  }
  for(const climb of route.climbs){
    const {a,b,base,top,steps}=climb,span=(b-a)/steps;
    boundary(a-10,a,-1,9.8,()=>base);
    for(let i=0;i<steps;i++)boundary(a+i*span,a+(i+1)*span,-1,9.8,()=>base+(top-base)*(i+1)/steps);
    boundary(b,b+8,-1,9.8,()=>top);
  }
  for(const [side,a,b,outer]of [[-1,507,537,9.65],[1,502,538,12.95]]){
    boundary(a,b,side,outer);
    for(const s of [a,b]){
      const p=point(s,side*5.25,-.12),q=point(s,side*outer,-.12);
      add({t:'wallpath',p,pts:[[0,0],[q[0]-p[0],q[2]-p[2]]],w:.55,rise:1.05,collisionHeight:4.8,
        containment:true,tex:'stone',color:'#9ca894',grp:216,nm:'Courtyard end parapet: safe return to the causeway'});
    }
  }
  // Close the back of spawn and the space beyond the finish, without placing
  // any barrier across a deliberate jump or a materialising bridge.
  for(const s of [-20,route.end]){
    const p=point(s,-5.25,-.12),q=point(s,5.25,-.12);
    add({t:'wallpath',p,pts:[[0,0],[q[0]-p[0],q[2]-p[2]]],w:.55,rise:1.05,collisionHeight:4.8,
      containment:true,tex:'stone',color:'#9ca894',grp:216,nm:'Temple terminal parapet'});
  }
  // Authored solid road/step sides must block a lateral body sweep as well
  // as support a downward floor ray. Keep cosmetic banks visual-only.
  for(const c of components)if(c.t==='mesh'&&[1,20,101,131].includes(c.grp??-1)&&c.solid!==false)c.solidSides=true;

  crate(508,8,0,'bang','Lantern stair: restore the three outlined metal towers',210);
  for(const [s,side]of [[504,3.3],[505.5,5],[507,6.5]])
    add({t:'wumpa',p:point(s,side,1.1),grp:213,nm:'Branching fruit leads to the lantern stair switch'});
  for(const [s,rows]of [[513,2],[516,4],[519,6]])for(const ds of [-.48,.48])for(const side of [7.52,8.48])for(let row=0;row<rows;row++)
    crate(s+ds,side,row*.96,'metal','Lantern stair: permanent footing after the switch',210,true);
  add({t:'platform',p:point(524,8,7.15),s:[5,1.3,4.8],tex:'stone',color:'#b6bf9e',grp:215,
    nm:'Lantern stair upper offering shelf'});
  for(const [s,side,kind]of [[523,7.2,'life'],[525,7.2,'mystery'],[525,9,'wood']] as const)
    crate(s,side,7.8,kind,'Lantern stair: reward for restoring and climbing the steps');
  for(const [s,y]of [[511,1.1],[514.5,3],[517.5,4.9],[521,6.8]])add({t:'wumpa',p:point(s,8,y),grp:213,nm:'Lantern stair ascending fruit clue'});

  // The fuse now has a purpose: its blast hits a neighbouring ! and restores
  // the cache in the clear refuge. The switch is also reachable directly so
  // a missed stomp never soft-locks completion or the all-crate reward.
  for(const [s,grp]of [[366,211],[813,212]]){
    const reward=components.find(c=>c.t==='crate'&&c.nm?.endsWith('safe recovery reward')&&Math.abs(route.toLocal(c.p)[0]-(s+5.5))<.2)!;
    reward.grp=grp;reward.outline=true;reward.nm='Fuse court: restored cache beyond the blast radius';
    crate(s+1.55,-2.3,0,'bang','Fuse court: prime the capped TNT, retreat, and let the blast restore the cache',grp);
    crate(s+6.8,-2.3,0,'mystery','Fuse court: second restored refuge offering',grp,true);
    for(const u of [-1,1])decor('stonepaver',s+5.5,u*1.1,-.14,[2.5,.2,2.5],'Pale safe-refuge paving','#c7d3b6');
  }

  // Small combat pockets live on long supported stretches, outside fire
  // sweeps, checkpoint arrivals, takeoffs and blind landings. Native patrols
  // are axis-bound, so choose the nearest world cross-axis explicitly.
  const patrols:[number,number,NonNullable<CustomComponent['foe']>][]=[
    [56,0,'grunt'],[198,-2,'turtle'],[319,-.2,'grunt'],[666,-2,'turtle'],
    [848,.2,'hopper'],[1058,0,'grunt'],[1290,-2,'turtle'],[1362,.4,'grunt'],
  ];
  for(const [s,side,foe]of patrols){
    const f=route.frameAt(s);
    add({t:'enemy',foe,p:point(s,side,.04),yaw:Math.abs(f.fx)>Math.abs(f.fz)?90:0,
      // A defeated turtle leaves a solid shell. Its entire patrol and shell
      // stay in the offering lane, leaving the main approach clear.
      range:foe==='turtle'?.75:1.45,speed:foe==='hopper'?1.15:1.35,terrainSupports:true,grp:214,
      nm:`Temple ${foe} patrol: visible approach, wide escape lane`});
  }
  for(const [s,side]of [[64,-2.25],[207,3],[328,-2.25],[677,-2.25],[858,3],[1068,-2.25],[1302,-2.25],[1370,-2.25]]){
    crate(s,side,0,'wood','Offering after the patrol: supported optional spin line');
    crate(s,side,.96,'wood','Offering stack cap: jump or spin after reading the patrol');
    for(const ds of [-3,0,3])add({t:'wumpa',p:point(s+ds,side,2.4),grp:213,nm:'Fruit trail toward the patrol offering'});
  }
  for(const c of route.climbs)for(let i=1;i<c.steps;i+=2){
    const s=c.a+(i+.62)*(c.b-c.a)/c.steps,y=c.base+(c.top-c.base)*(i+1)/c.steps;
    add({t:'crate',p:route.toWorld(s,y+.035,c.side-1.3),kind:i+2>=c.steps?'life':'mystery',grp:213,
      nm:'Pilgrim stair offering: reward the deliberate climbing route'});
  }

  // Fitted paving makes the long banks read as constructed processional
  // routes. Warm paired lamps and mossy coping mark encounters and courts.
  for(const [a,b]of [[38,78],[174,232],[300,352],[632,710],[832,912],[1044,1080],[1174,1212],[1276,1336]]){
    for(let s=a;s<b;s+=3.8){
      const before=route.frameAt(s-2),after=route.frameAt(s+2);
      // A rigid slab cannot follow a curved, rising ribbon. Leave those
      // short bends as earth; straight runs have deliberate mortar gaps.
      if(before.fx*after.fx+before.fz*after.fz<.998)continue;
      for(const side of [-2.35,0,2.35])
        decor('stonepaver',s,side,-.12,[2.8,.23,2.2],'Worn processional ascent paving','#c5c6aa');
    }
    for(const side of [-1,1]){
      decor('stonebase',a,side*4.75,.035,[1.0,.45,1.0],'Mossy lantern pedestal','#98a88c');
      add({t:'torch',p:point(a,side*4.75,.45),rise:1.45,w:.85,grp:215,nm:'Paired lamps announce a temple patrol court'});
    }
  }
  for(let s=504;s<=536;s+=2.7)for(const side of [6,8.6,11.2])
    decor('stonepaver',s,side,-.15,[2.55,.23,2.55],'Lantern stair court fitted paving','#c7c8ad');
  for(const [s,side]of [[505,11.6],[535,11.6],[509,-8.8],[535,-8.8]]){
    decor('stonebase',s,side,.04,[1.6,.55,1.6],'Court corner planter base','#a9ae91');
    decor('trialsv2ferna',s,side,.58,[2.4,1.28,2.24],'Fern planted inside the sheltered court','#ffffff');
    add({t:'torch',p:point(s,side,.55),rise:1.7,w:.9,grp:215,nm:'Sheltered courtyard lantern'});
  }
  for(const side of [5.95,10.05])decor('stoneshaft',524,side,0,[.8,7.8,.8],'Stone piers support the offering shelf');
  decor('stonecornice',524,8,6.95,[5.4,.4,5.2],'Carved offering shelf cornice');
  add({t:'torch',p:point(524,10,7.8),rise:1.5,w:1,grp:215,nm:'High lantern identifies the staircase reward'});
}
