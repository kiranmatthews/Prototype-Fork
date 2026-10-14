import * as THREE from 'three';
import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { COASTAL_TOWN_ASSETS, type CoastalTownAssetKind } from '../coastalTownAssets';
import { COASTAL_TOWN_ATMOSPHERE } from '../coastalTownPalette';

type P = [number, number, number];
type Shape = Pick<CustomComponent, 'vertices' | 'normals' | 'uvs' | 'indices'>;
interface RoadSegment { start: number; end: number; startY: number; endY: number }
interface Gap { start: number; end: number }
const CREAM = '#fff3d8', TEAL = '#32aab6', SAFFRON = '#f2c468';
const FACADES = ['#f59376', '#f1cc73', '#94cbb2', '#efad91', '#b4d8cf'];
const round = (n: number) => Math.round(n * 100000) / 100000;
function geometryData(g: THREE.BufferGeometry): Shape {
  const shape: Shape = { vertices: Array.from(g.attributes.position.array, round),
    normals: Array.from(g.attributes.normal.array, round), uvs: Array.from(g.attributes.uv.array, round),
    ...(g.index ? {indices: Array.from(g.index.array)} : {}) };
  g.dispose(); return shape;
}
/** Authoring helpers emit ordinary editable components, never a merged shop. */
class TownArt {
  components: CustomComponent[] = [];
  groups: CustomGroup[] = [];
  put(c: CustomComponent) { this.components.push({...c, solid: false, edgeGrinding: false}); }
  asset(kind: CoastalTownAssetKind, p: P, scale = 1, yaw = 0, grp = 100, name?: string) {
    const s = COASTAL_TOWN_ASSETS[kind].size.map(v => round(v * scale)) as P;
    const attached=['baywindow','baydoor','baydisplay','baybox','bayvine','baypost'].includes(kind);
    this.put({t: 'decor', dkind: kind, p, s, yaw, grp, ...(attached?{castShadow:false}:{}),nm: name ?? COASTAL_TOWN_ASSETS[kind].label});
  }
  box(name: string, base: P, size: P, color: string, grp = 100, yaw = 0, _tex = 'bay-stucco', _radius = .12) {
    this.put({t: 'decor', dkind:'baybody', p:base, s:size, yaw, color, grp, nm:name});
  }
  gradedBox(name: string, center: P, size: P, grade: number, color: string, grp: number, topOnly=false) {
    const g=new THREE.BoxGeometry(...size),p=g.attributes.position,uv=g.attributes.uv;
    for(let i=0;i<p.count;i++)if(!topOnly||p.getY(i)>0)p.setY(i,p.getY(i)-p.getZ(i)*grade);
    g.computeVertexNormals();const n=g.attributes.normal;
    for(let i=0;i<p.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.7?p.getZ(i):p.getX(i))/4,
      (Math.abs(n.getY(i))>.7?p.getZ(i):p.getY(i))/4);
    this.put({t:'mesh',p:center,...geometryData(g),tex:'bay-paving',color,grp,nm:name});
  }
  beam(name: string, a: P, b: P, radius: number, color: string, grp = 100) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(radius, radius, direction.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize()));
    this.put({t: 'mesh', p: start.add(end).multiplyScalar(.5).toArray() as P,
      ...geometryData(g), tex: 'solid', color, grp, nm: name});
  }
  building(origin: P, yaw: number, index: number, grp: number, {height = 7.6, flat = false, scale = 1, simple = false, width = 8} = {}) {
    const c = Math.cos(yaw*Math.PI/180), s = Math.sin(yaw*Math.PI/180);
    const stretch=width/8;
    const point = (x: number, y: number, z: number): P => [round(origin[0]+(x*stretch*c+z*s)*scale),
      round(origin[1]+y*scale), round(origin[2]+(-x*stretch*s+z*c)*scale)];
    const localBox = (name: string, p: P, size: P, color: string) =>
      this.box(name, point(...p), size.map((v,i)=>v*scale*(i===0?stretch:1)) as P, color, grp, yaw);
    const mount = (kind: CoastalTownAssetKind, x: number, y: number, k = 1) =>
      this.asset(kind, point(x,y,4+COASTAL_TOWN_ASSETS[kind].size[2]*k/2-.05), k*scale, yaw, grp);
    localBox('Separate tintable stucco building body', [0,-.9,0], [8,height+.9,8], FACADES[index%FACADES.length]);
    this.put({t:'decor',dkind:'baytrim',p:point(0,-.45,0),s:[(width+.35)*scale,(height+.55)*scale,8.35*scale],
      yaw,color:CREAM,grp,nm:'Separate cream moulding courses'});
    if (!flat) {
      // Tiles are a separate Meshy component. A recessed solid roof bed closes
      // their gaps while keeping the raised tile silhouettes and original UVs.
      const roof = new THREE.ConeGeometry(6.15,2.8,4).rotateY(Math.PI/4).translate(0,1.36,0);
      roof.scale(scale*stretch,scale,scale);
      this.put({t:'mesh',p:point(0,height,0),...geometryData(roof),yaw,tex:'bay-terracotta',color:'#edb693',grp,nm:'Separate solid roof bed'});
      this.put({t:'decor',dkind:'bayroof',p:point(0,height,0),
        s:COASTAL_TOWN_ASSETS.bayroof.size.map((v,i)=>v*scale*(i===0?stretch:1)) as P,yaw,grp,nm:'Separate terracotta roof'});
    }
    if (simple) {
      mount('baywindow', -2, 2.7); mount('baywindow', 2, 2.7);
      return;
    }
    for (const x of [-3.7,3.7])
      this.put({t:'decor',dkind:'baycorner',p:point(x,0,3.7),s:[.76*scale,height*scale,.82*scale],
        yaw:yaw+(x<0?0:90),grp,nm:'Separate fitted cream corner trim'});
    mount('baydoor', -2.15, 0); mount('baydisplay', 1.75, .38, .9);
    mount('bayawning', 1.5, 2.9, .95);
    for (const x of [-2.05,2.05]) {
      mount('baywindow', x, height-3.0, .92);
      mount('baybox', x, height-3.25, .82);
    }
    if (index%4===1) mount('baybalcony', 0, 3.7, .9);
    if (index%3===0) mount('bayvine', 3.45, 1.0, .82);
    if(index%2===0)mount('baypot', -3.7, .1, .72);
    // Deliberately no sign mesh, plaque, lettering, logo or advertising insert.
  }
  palm(p: P, yaw: number, scale = 1, grp = 101) {
    this.asset('baytrunk', p, scale, yaw, grp);
    // Meshy's measured bent trunk has its crown socket offset toward local +X.
    const r = yaw*Math.PI/180;
    this.asset('baycrown', [p[0]+Math.cos(r)*.65*scale,p[1]+7.0*scale,p[2]-Math.sin(r)*.65*scale], scale, yaw, grp);
  }
  bunting(z: number, y: number, grp = 102) {
    this.beam('Festival bunting cord', [-8.7,y+1.8,z], [7.4,y+1.8,z], .028, '#aa7950', grp);
    for (let i=0;i<13;i++) {
      const x=-8.1+i*1.2, dip=Math.sin(i/12*Math.PI)*.85;
      this.put({t:'mesh',p:[x,y+1.8-dip,z],vertices:[-.42,0,0,.42,0,0,0,-.85,0],
        indices:[0,2,1],tex:'solid',color:[TEAL,SAFFRON,'#ee8c75','#aaca79'][i%4],doubleSided:true,grp,nm:'Separate plain festival pennant'});
    }
  }
  surfboard(p: P, yaw: number, color: string, grp: number) {
    const shape=new THREE.Shape();shape.moveTo(0,0);
    shape.bezierCurveTo(-.42,.22,-.55,1.95,0,3.15);
    shape.bezierCurveTo(.55,1.95,.42,.22,0,0);
    const g=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.045,bevelThickness:.035,curveSegments:8});
    this.put({t:'mesh',p,...geometryData(g),yaw,tex:'solid',color,grp,nm:'Plain surfboard display / no logo or signage'});
    const stripe=new THREE.PlaneGeometry(.055,2.5).translate(0,1.58,.158);
    this.put({t:'mesh',p,...geometryData(stripe),yaw,tex:'solid',color:CREAM,grp,nm:'Simple surfboard centre stripe'});
  }
  clock(p: P, grp=103) {
    this.put({t:'mesh',p,...geometryData(new THREE.CircleGeometry(1.55,32)),tex:'solid',color:CREAM,grp,nm:'Public clock dial'});
    this.put({t:'mesh',p,...geometryData(new THREE.RingGeometry(1.55,1.72,32)),tex:'solid',color:TEAL,grp,nm:'Public clock rim'});
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      this.beam('Clock hour marker',[p[0]+Math.sin(a)*1.18,p[1]+Math.cos(a)*1.18,p[2]+.025],
        [p[0]+Math.sin(a)*1.38,p[1]+Math.cos(a)*1.38,p[2]+.025],.04,'#245a65',grp);
    }
    this.beam('Clock hour hand',p,[p[0]-.6,p[1]+.45,p[2]+.05],.055,'#245a65',grp);
    this.beam('Clock minute hand',p,[p[0]+.45,p[1]+1.05,p[2]+.05],.04,'#245a65',grp);
  }
  lighthouse(p: P, scale = 1, grp = 103) {
    for (let i=0;i<5;i++) {
      const g = new THREE.CylinderGeometry((2.1-i*.17)*scale,(2.27-i*.17)*scale,4*scale,24);
      this.put({t:'mesh',p:[p[0],p[1]+(i*4+2)*scale,p[2]],...geometryData(g),
        tex:'bay-stucco',color:i%2? '#f19c89':CREAM,grp,nm:`Lighthouse separate tower course ${i+1}`});
    }
    this.asset('baylantern',[p[0],p[1]+20*scale,p[2]],scale,0,grp);
    this.asset('baydoor',[p[0],p[1]+.1,p[2]+2.1*scale],.65*scale,0,grp);
  }
}

function finish(data: CustomLevelData, art: TownArt) {
  data.components.push(...art.components);
  data.groups = [...(data.groups??[]), ...art.groups];
  data.sky = 'coastal-town'; data.keepPlayFog = true;
  data.jungleStyle = 'painterly';
  data.atmosphere = {...COASTAL_TOWN_ATMOSPHERE};
}

export function decorateCoastalTown(data: CustomLevelData, road: readonly RoadSegment[], heightAt: (z:number)=>number, gaps: readonly Gap[]) {
  // All original physics, enemies, rails, collectibles and route cameras stay authoritative.
  data.components = data.components.filter(c=>!(c.t==='decor'&&c.dkind==='coastalhouse')).map(c=>{
    if (c.t==='platform'||c.t==='ramp'||c.t==='wallpath') return {...c,
      tex:c.grp===2?'bay-terracotta':'bay-paving',color:'#ffffff'};
    return c;
  });
  const art = new TownArt();
  art.groups.push({id:100,nm:'Coastal modular town',editorOnly:true},{id:101,nm:'Separate palms and flowers',editorOnly:true},
    {id:102,nm:'Festival dressing',editorOnly:true},{id:103,nm:'Landmark components',editorOnly:true},
    {id:104,nm:'Distant painted town and headland',editorOnly:true});
  const safe = (z:number, margin=0) => !gaps.some(g=>z>g.start-margin&&z<g.end+margin);
  let building=0;
  for (let z=-38;z<3060;z+=14.5) {
    if (!safe(z,7)) continue;
    const grp=1000+building;
    art.groups.push({id:grp,parent:100,nm:`Store ${String(building+1).padStart(3,'0')} / separate editable parts`,editorOnly:true});
    art.building([-12.85,heightAt(z)+1.04,-z],90,building,grp,{height:7.6+(building%4===2?1.2:0),width:10.8});
    if (building%3===0) art.palm([-9.2,heightAt(z)+1.0,-z-5.1],building*57,.85);
    if (building%4===0) art.asset('baylamp',[-7.9,heightAt(z)+1.03,-z-5],.95,0,101);
    if(z>1370&&z<1810&&building%3===0) {
      art.surfboard([-8.15,heightAt(z)+1.05,-z+3.8],90,TEAL,grp);
      art.surfboard([-8.12,heightAt(z)+1.05,-z+4.6],90,'#ed9b75',grp);
    }
    building++;
  }
  // A second, sparse layer breaks the skyline without becoming near-camera clutter.
  for (let z=5;z<3030;z+=94) {
    art.building([-27,heightAt(z)+3,-z],90,Math.floor(z/94)+2,100,{height:8.4,scale:1.3,simple:true});
    if(z>900&&z<1370||z>2300)art.asset('bayrock',[-25,heightAt(z)-8,-z-15],1.25,Math.floor(z)*17,100);
  }
  for (const segment of road) {
    const length=segment.end-segment.start,mid=(segment.start+segment.end)/2;
    const grade=(segment.endY-segment.startY)/length,foundationHeight=heightAt(mid)+9.03;
    art.gradedBox('Town terrace foundation / follows the road grade',[-33.8,-8+foundationHeight/2,-mid],
      [52.38,foundationHeight,length],grade,CREAM,100,true);
    for (let z=segment.start+2;z<segment.end-1;z+=6) {
      if (!safe(z,.8)) continue;
      const y=heightAt(z);
      art.asset('baypost',[7.2,y-.02,-z],1,90,101);
      if (Math.floor(z/6)%4===0) art.asset('baylamp',[7.8,y-.05,-z],1,0,101);
      if (Math.floor(z/6)%7===0) art.asset('baypot',[-7.95,y+1.06,-z],.7,0,101);
    }
    for (let z=segment.start;z<segment.end;z+=9) {
      const end=Math.min(z+9,segment.end), middle=(z+end)/2;
      for (const side of [-1,1]) art.gradedBox('Teal and saffron paving edge', [side*6.72,heightAt(middle)-.0125,-middle],
        [.42,.065,end-z],grade,Math.floor(z/9)%2?TEAL:SAFFRON,101);
    }
  }
  // Teal sleeves track the authored boundary rails exactly, including their grades.
  for (const c of data.components.filter(c=>c.t==='rail'&&c.nm?.includes('boundary'))) {
    const points=c.pts??[];
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      art.beam('Boundary rail teal finish',[c.p[0]+a[0],c.p[1]+(a[3]??0),c.p[2]+a[1]],
        [c.p[0]+b[0],c.p[1]+(b[3]??0),c.p[2]+b[1]],.085,TEAL,101);
    }
  }
  for(let z=-80;z<3210;z+=210) {
    art.asset(Math.floor((z+80)/210)%3===2?'bayheadlandmatte':'baytownmatte',
      [165,-20.5,-z],1.3,-30,104);
  }
  for(let z=1850;z<2250;z+=38)art.bunting(-z,heightAt(z)+9);
  for(let z=2910;z<3020;z+=32)art.bunting(-z,heightAt(z)+9);
  art.lighthouse([55,.5,-2850],1);
  art.asset('bayrock',[55,-COASTAL_TOWN_ASSETS.bayrock.size[1]*1.65*.65,-2850],1.65,30,103);
  art.lighthouse([95,.5,-3170],.8);
  art.asset('bayrock',[95,-COASTAL_TOWN_ASSETS.bayrock.size[1]*1.35*.65,-3170],1.35,-20,103);
  art.box('Festival clock quay foundation',[17,-7,-2290],[17,10,19],CREAM,103);
  art.building([17,3,-2290],0,1,103,{height:16});
  art.clock([17,14.7,-2285.85]);
  finish(data,art);
  // The imported offshore slab was only 2 cm below sea level. Give the bay
  // real depth so the current shoreline shader does not cover it in foam.
  data.unitySand = data.unitySand?.map(s=>({...s,p:[s.p[0],-3.4,s.p[2]]}));
  // This level-only shot shows the assembled roofs and bay while keeping the
  // same ordered route cameras, controls and unchanged movement model.
  data.cameraRig = {camDist:7.2,camHeight:4.8,camPitch:18,camFov:49};
}

export function decorateCoastalBonus(data: CustomLevelData, end: number) {
  data.components = data.components.map(c=>{
    if (['mover','phasepad','crumble','spinbridge'].includes(c.t)) return {...c,tex:'bay-paving',color:TEAL};
    if (c.t!=='mesh'||c.solid===false) return c;
    const uv:number[]=[];
    for(let i=0;i<(c.vertices?.length??0);i+=3)uv.push((c.vertices![i]+.5)*(c.s?.[0]??1)/4,(c.vertices![i+2]+.5)*(c.s?.[2]??1)/4);
    return {...c,tex:'bay-paving',color:'#ffffff',uvs:uv};
  });
  const art = new TownArt();
  art.groups.push({id:100,nm:'Rooftop modular architecture',editorOnly:true},{id:101,nm:'Rooftop flowers and palms',editorOnly:true},
    {id:103,nm:'Distant lighthouse components',editorOnly:true},{id:104,nm:'Painted bay beyond the rooftops',editorOnly:true});
  let index=0;
  art.box('Town land beneath the rear rooftop buildings',[end/2,-21,-23],[end+60,13,31],CREAM,100);
  // Keep the coastal facades, but seat them beneath each permanent terrace.
  // No decorative rooftop may disguise a relay, lift or phase-pad gap.
  for(const deck of data.components.filter(c=>c.t==='mesh'&&c.s&&c.s[1]>3&&!c.outline&&c.solid!==false)) {
    const [width,height]=deck.s!,top=deck.p[1]+height/2,left=deck.p[0]-width/2;
    const count=Math.ceil(width/8),bay=width/count;
    for(let i=0;i<count;i++){
      const x=left+(i+.5)*bay,grp=1000+index;
      art.groups.push({id:grp,parent:100,nm:`Rooftop support ${index+1} / separate parts`,editorOnly:true});
      art.building([x,top-8.75,-.7],0,index,grp,{height:8,flat:true,width:Math.max(1,bay-.6)});
      art.asset('baypost',[x,top-.04,-3.25],.8,0,101);
      if(i>0)art.beam('Rear rooftop rail',[x-bay,top+.72,-3.25],[x,top+.72,-3.25],.065,TEAL,101);
      if(index%2===0)art.asset('baylamp',[x+.5,top-1,-5.4],1.1,0,101);
      index++;
    }
  }
  for(let x=-18,i=0;x<end+25;x+=13,i++) {
    art.building([x,-8,-15-(i%3)*4],0,i+1,100,{height:8.5+(i%3)*1.2,scale:1.05});
    if(i%2===0)art.palm([x+5,-8,-12],i*48,1.2);
  }
  art.asset('baytownmatte',[end*.45,-33.7,-120],1.4,0,104);
  art.asset('bayheadlandmatte',[end+135,-37,-170],1.6,0,104);
  art.lighthouse([end+28,-12,-70],.8);
  finish(data,art);
  data.atmosphere = {...COASTAL_TOWN_ATMOSPHERE,fogNear:75,fogFar:260,drawDistance:300};
}
