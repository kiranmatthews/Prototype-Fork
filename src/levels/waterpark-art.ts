import * as THREE from 'three';
import type { CustomComponent, CustomGroup } from '../level';

export type ArtPoint = [number, number, number];
export const WATERPARK_ART_GROUPS: CustomGroup[] = [{ id: 80, nm: 'Waterpark buildings, rides and coaster steel', editorOnly: true }];
const PALETTE = {
  stone: '#c6ba9e', cream: '#f6e4b4', steel: '#426974', rust: '#915d46',
  orange: '#e99051', coral: '#d86146', aqua: '#63c4c2', blue: '#377eae',
  roof: '#317d78', dark: '#263f46', yellow: '#edc962', green: '#527b55',
};
const rounded = (n: number) => Math.round(n * 10000) / 10000;

function mesh(geometry: THREE.BufferGeometry, p: ArtPoint, color: string, name: string): CustomComponent {
  const c: CustomComponent = { t: 'mesh', p: [...p],
    vertices: Array.from(geometry.getAttribute('position').array, rounded),
    ...(geometry.index ? { indices: Array.from(geometry.index.array) } : {}),
    normals: Array.from(geometry.getAttribute('normal').array, rounded),
    tex: 'solid', color, solid: false, edgeGrinding: false, grp: 80, nm: name };
  geometry.dispose(); return c;
}

/** Ordinary mesh components deliberately survive the lite renderer. */
export function artBox(center: ArtPoint, size: ArtPoint, color: string, name: string): CustomComponent {
  return mesh(new THREE.BoxGeometry(...size), center, color, name);
}

export function artBeam(a: ArtPoint, b: ArtPoint, width: number, color: string, name: string): CustomComponent {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
  const geometry = new THREE.BoxGeometry(width, Math.max(.01, delta.length()), width);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
  return mesh(geometry, av.add(bv).multiplyScalar(.5).toArray() as ArtPoint, color, name);
}

export function artPipe(points: readonly ArtPoint[], radius: number, color: string, name: string): CustomComponent {
  const origin = new THREE.Vector3(...points[0]);
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p).sub(origin)), false, 'centripetal');
  return mesh(new THREE.TubeGeometry(curve, Math.min(180, Math.max(8, points.length * 3)), radius, 8, false), points[0], color, name);
}

// Original five-by-seven sign lettering. Each horizontal ink run is a quad;
// even the entrance title is one mesh, not dozens of text objects or textures.
const GLYPHS: Record<string, string> = {
  A:'01110/10001/10001/11111/10001/10001/10001', B:'11110/10001/10001/11110/10001/10001/11110',
  C:'01111/10000/10000/10000/10000/10000/01111', D:'11110/10001/10001/10001/10001/10001/11110',
  E:'11111/10000/10000/11110/10000/10000/11111', F:'11111/10000/10000/11110/10000/10000/10000',
  G:'01111/10000/10000/10111/10001/10001/01111', H:'10001/10001/10001/11111/10001/10001/10001',
  I:'11111/00100/00100/00100/00100/00100/11111', J:'00111/00010/00010/00010/10010/10010/01100',
  K:'10001/10010/10100/11000/10100/10010/10001', L:'10000/10000/10000/10000/10000/10000/11111',
  M:'10001/11011/10101/10101/10001/10001/10001', N:'10001/11001/11001/10101/10011/10011/10001',
  O:'01110/10001/10001/10001/10001/10001/01110', P:'11110/10001/10001/11110/10000/10000/10000',
  Q:'01110/10001/10001/10001/10101/10010/01101', R:'11110/10001/10001/11110/10100/10010/10001',
  S:'01111/10000/10000/01110/00001/00001/11110', T:'11111/00100/00100/00100/00100/00100/00100',
  U:'10001/10001/10001/10001/10001/10001/01110', V:'10001/10001/10001/10001/10001/01010/00100',
  W:'10001/10001/10001/10101/10101/11011/10001', X:'10001/10001/01010/00100/01010/10001/10001',
  Y:'10001/10001/01010/00100/00100/00100/00100', Z:'11111/00001/00010/00100/01000/10000/11111',
  '0':'01110/10001/10011/10101/11001/10001/01110', '1':'00100/01100/00100/00100/00100/00100/01110',
  '2':'01110/10001/00001/00010/00100/01000/11111', '3':'11110/00001/00001/01110/00001/00001/11110',
  '-':'00000/00000/00000/11111/00000/00000/00000', ' ':'00000/00000/00000/00000/00000/00000/00000',
};

export function artSign(text: string, p: ArtPoint, width: number, ink: string, background: string, yaw = 0): CustomComponent[] {
  const label = text.toUpperCase(), unit = width / (label.length * 6 + 1), height = unit * 9;
  const vertices: number[] = [], indices: number[] = [];
  for (let letter = 0; letter < label.length; letter++) {
    const rows = (GLYPHS[label[letter]] ?? GLYPHS[' ']).split('/');
    for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      if (rows[row][col] !== '1') continue;
      const start = col; while (col + 1 < 5 && rows[row][col + 1] === '1') col++;
      const x0 = -width / 2 + (letter * 6 + start + 1) * unit;
      const x1 = -width / 2 + (letter * 6 + col + 2) * unit;
      const y0 = height / 2 - (row + 2) * unit, y1 = y0 + unit;
      const n = vertices.length / 3;
      vertices.push(x0,y0,.19, x1,y0,.19, x1,y1,.19, x0,y1,.19);
      indices.push(n,n+1,n+2,n,n+2,n+3);
    }
  }
  return [
    { ...artBox(p, [width + .42, height + .42, .28], PALETTE.cream, `${label} sign frame`), yaw },
    { ...artBox(p, [width, height, .34], background, `${label} sign face`), yaw },
    { t: 'mesh', p: [...p], vertices, indices, yaw, tex: 'solid', color: ink,
      solid: false, edgeGrinding: false, grp: 80, nm: `${label} raised sign lettering` },
  ];
}

function standingSign(text:string,p:ArtPoint,width:number,ink:string,background:string,baseY:number,yaw=0):CustomComponent[]{
  const C=artSign(text,p,width,ink,background,yaw),a=yaw*Math.PI/180;
  for(const side of [-1,1]){
    const x=p[0]+Math.cos(a)*width*.38*side,z=p[2]-Math.sin(a)*width*.38*side;
    C.push(artBox([x,baseY+.2,z],[1.2,.4,1.2],PALETTE.stone,`${text} sign footing`));
    C.push(artBeam([x,baseY+.4,z],[x,p[1]+.8,z],.18,PALETTE.steel,`${text} sign post`));
  }
  return C;
}

function roof(p: ArtPoint, width: number, depth: number, rise: number, color: string, name: string): CustomComponent {
  const w = width / 2, d = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-w,0,-d, w,0,-d, w,0,d, -w,0,d, 0,rise,0], 3));
  geometry.setIndex([0,4,1, 1,4,2, 2,4,3, 3,4,0, 0,1,2, 0,2,3]);
  geometry.computeVertexNormals(); return mesh(geometry, p, color, name);
}

function openFlume(points: ArtPoint[], width: number, depth: number, color: string, name: string): CustomComponent[] {
  const p = points[0], curve = new THREE.CatmullRomCurve3(points.map(q => new THREE.Vector3(...q)), false, 'centripetal');
  const steps = Math.max(20, Math.min(120, points.length * 4)), across = 10;
  const vertices: number[] = [], indices: number[] = [], edges: ArtPoint[][] = [[], []];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, c = curve.getPoint(t), tangent = curve.getTangent(t), right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    for (let j = 0; j <= across; j++) {
      const angle = (j / across - .5) * Math.PI, q = c.clone().addScaledVector(right, Math.sin(angle) * width / 2);
      q.y += (1 - Math.cos(angle)) * depth;
      vertices.push(q.x-p[0],q.y-p[1],q.z-p[2]);
      if (j === 0 || j === across) edges[j === 0 ? 0 : 1].push(q.toArray() as ArtPoint);
      if (i < steps && j < across) { const a = i * (across + 1) + j; indices.push(a,a+1,a+across+1,a+1,a+across+2,a+across+1); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  return [{ ...mesh(geometry,p,color,name),doubleSided:true }, ...edges.map((edge,i) => artPipe(edge,.1,PALETTE.cream,`${name} rolled white rim ${i+1}`))];
}

function tubeSeams(points: ArtPoint[], radius: number, name: string): CustomComponent[] {
  const curves = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  const rings: CustomComponent[] = [], count = Math.ceil(curves.getLength() / 7);
  for (let i = 0; i <= count; i++) {
    const t = i / count, p = curves.getPoint(t), tangent = curves.getTangent(t);
    const geometry = new THREE.TorusGeometry(radius + .035,.055,4,10);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),tangent));
    rings.push(mesh(geometry,p.toArray() as ArtPoint,PALETTE.cream,`${name} bolted panel seam`));
  }
  return rings;
}

/** Fiberglass quarter-round shoulders outside the existing flat ride lane.
 * Sample the exact piecewise floor, preserving its authored ramps and gaps. */
function flumeShoulders(points:ArtPoint[],name:string):CustomComponent[]{
  const C:CustomComponent[]=[],stations:ArtPoint[]=[];
  for(let segment=0;segment<points.length-1;segment++){
    const a=new THREE.Vector3(...points[segment]),b=new THREE.Vector3(...points[segment+1]);
    const steps=Math.ceil(a.distanceTo(b)/3);
    for(let i=segment===0?0:1;i<=steps;i++)stations.push(a.clone().lerp(b,i/steps).toArray() as ArtPoint);
  }
  const origin=points[0],across=6;
  for(const side of [-1,1]){
    const vertices:number[]=[],indices:number[]=[],rim:ArtPoint[]=[];
    for(const [i,p]of stations.entries())for(let j=0;j<=across;j++){
      const a=j/across*Math.PI/2,x=p[0]+side*(9.05+2.7*Math.sin(a)),y=p[1]+2.7*(1-Math.cos(a));
      vertices.push(x-origin[0],y-origin[1],p[2]-origin[2]);
      if(j===across)rim.push([x,y,p[2]]);
      if(i<stations.length-1&&j<across){const n=i*(across+1)+j;indices.push(n,n+1,n+across+1,n+1,n+across+2,n+across+1);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    C.push({...mesh(geometry,origin,side<0?'#428db5':'#529ebc',`${name} curved fiberglass shoulder`),doubleSided:true});
    C.push(artPipe(rim,.12,PALETTE.cream,`${name} rolled white shoulder rim`));
    for(let i=0;i<stations.length;i+=4){
      const p=stations[i],seam:ArtPoint[]=Array.from({length:7},(_,j)=>{const a=j/6*Math.PI/2;return[p[0]+side*(9.05+2.7*Math.sin(a)),p[1]+2.7*(1-Math.cos(a)),p[2]];});
      C.push(artPipe(seam,.045,PALETTE.cream,`${name} fiberglass panel joint`));
    }
  }
  return C;
}

function tower(center: ArtPoint, height: number, title: string, color: string): CustomComponent[] {
  const [x,y,z] = center, top = y + height, C: CustomComponent[] = [];
  for (const dx of [-4,4]) for (const dz of [-4,4]) {
    C.push(artBox([x+dx,y+.3,z+dz],[1.6,.6,1.6],PALETTE.stone,`${title} concrete foundation`));
    C.push(artBeam([x+dx,y+.5,z+dz],[x+dx,top+5,z+dz],.42,PALETTE.steel,`${title} tower upright`));
  }
  const floors = Math.ceil(height / 5), rise = height / floors;
  for (let floor = 0; floor < floors; floor++) {
    const bottom = y + floor * rise, landing = bottom + rise;
    C.push(artBox([x,landing-.18,z],[9,.36,9],floor===floors-1?color:PALETTE.stone,`${title} supported stair landing`));
    for (const side of [-1,1]) {
      C.push(artBeam([x+side*4,bottom,z-4],[x+side*4,landing,z+4],.18,PALETTE.rust,`${title} diagonal cross brace`));
      C.push(artBeam([x+side*4,bottom,z+4],[x+side*4,landing,z-4],.18,PALETTE.rust,`${title} diagonal cross brace`));
      C.push(artBeam([x-4,landing+1.1,z+side*4],[x+4,landing+1.1,z+side*4],.1,PALETTE.cream,`${title} landing guard rail`));
    }
    // Alternating stair flights remain inside the four anchored tower legs.
    const direction = floor%2 ? -1 : 1, sx = x + (floor%2 ? 2 : -2);
    for (let step = 0; step < 11; step++) {
      const sz = z + direction * (-3.8 + step * .76), sy = bottom + (step+1) * rise/11;
      C.push(artBox([sx,sy-.09,sz],[2,.18,.83],PALETTE.cream,`${title} stair tread`));
    }
    C.push(artBeam([sx-1,bottom+1.1,z-direction*4],[sx-1,landing+1.1,z+direction*4],.1,color,`${title} stair handrail`));
    C.push(artBeam([sx+1,bottom+1.1,z-direction*4],[sx+1,landing+1.1,z+direction*4],.1,color,`${title} stair handrail`));
  }
  C.push(roof([x,top+5,z],12,12,3.8,PALETTE.roof,`${title} pyramidal shelter roof`));
  for (const corner of [[-6,-6],[6,-6],[6,6],[-6,6]]) C.push(artBeam([x+corner[0],top+5,z+corner[1]],[x,top+8.8,z],.14,PALETTE.cream,`${title} roof seam`));
  C.push(...artSign(title,[x,top+2.7,z+4.7],10,PALETTE.cream,color));
  C.push(...artSign('CLOSED',[x,y+2.1,z+4.8],4.8,PALETTE.dark,PALETTE.yellow));
  C.push(artBeam([x-3.7,y+.8,z+4.8],[x+3.7,y+3.3,z+4.8],.22,PALETTE.rust,`${title} boarded entrance`));
  return C;
}

function kiosk(center: ArtPoint, title: string, color: string): CustomComponent[] {
  const [x,y,z] = center, C: CustomComponent[] = [];
  C.push(artBox([x,y+.22,z],[12,.44,9],PALETTE.stone,`${title} concrete base`));
  C.push(artBox([x,y+2.3,z],[10,4.2,7],color,`${title} kiosk walls`));
  C.push(roof([x,y+4.4,z],12,9,2,PALETTE.roof,`${title} folded canopy`));
  C.push(artBox([x,y+2.6,z+3.56],[7.7,2.3,.14],PALETTE.dark,`${title} shutter opening`));
  for (let row=0;row<7;row++) C.push(artBox([x,y+1.65+row*.3,z+3.67],[7.5,.09,.08],PALETTE.steel,`${title} closed shutter slat`));
  C.push(artBox([x,y+1.4,z+3.9],[9,.25,1.1],PALETTE.cream,`${title} service counter`));
  C.push(...artSign(title,[x,y+4.05,z+4.65],9,PALETTE.cream,PALETTE.coral));
  return C;
}

function palm(p: ArtPoint, height: number, lean: number): CustomComponent[] {
  const C: CustomComponent[] = [], points: ArtPoint[] = [];
  for(let i=0;i<=8;i++)points.push([p[0]+lean*(i/8)**2,p[1]+height*i/8,p[2]+Math.sin(i/8*2)*.3]);
  C.push(artPipe(points,.25,PALETTE.rust,'Palm trunk rooted in concrete planter'));
  const top=points[8];
  for(let leaf=0;leaf<8;leaf++){
    const angle=leaf*Math.PI/4+.15,vertices:number[]=[],indices:number[]=[];
    for(let i=0;i<=6;i++){
      const t=i/6,len=5.5*t,width=Math.sin(Math.PI*t)*.75;
      const cx=Math.cos(angle)*len,cz=Math.sin(angle)*len,cy=1.8*Math.sin(Math.PI*t)-2*t*t;
      for(const side of [-1,1])vertices.push(cx-Math.sin(angle)*width*side,cy,cz+Math.cos(angle)*width*side);
      if(i<6){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    C.push({t:'mesh',p:[...top],vertices,indices,tex:'solid',color:leaf%2?PALETTE.green:'#739559',solid:false,doubleSided:true,edgeGrinding:false,grp:80,nm:'Palm frond'});
  }
  C.push(artBox([p[0],p[1]-.2,p[2]],[3,.4,3],PALETTE.stone,'Palm planter footing'));
  return C;
}

/** Original waterpark architecture; no gameplay colliders or camera volumes. */
export function buildWaterparkArt(): CustomComponent[] {
  const C: CustomComponent[] = [], P=PALETTE;
  // Entrance courtyard: a real pair of gatehouses around the clear arrival lane.
  for(const x of [-68,-28]){
    C.push(artBox([x,12.4,57],[4,.8,4],P.stone,'Entrance pylon footing'));
    C.push(artBox([x,18,57],[2.4,12,2.4],P.aqua,'Entrance tiled pylon'));
    C.push(roof([x,24.2,57],5,5,2.2,P.roof,'Gatehouse pointed cap'));
  }
  C.push(artBeam([-68,23.1,57],[-28,23.1,57],.7,P.steel,'Entrance sign truss lower chord'));
  C.push(artBeam([-68,27.2,57],[-28,27.2,57],.4,P.rust,'Entrance sign truss upper chord'));
  for(let x=-68;x<-28;x+=5)C.push(artBeam([x,23.1,57],[x+5,27.2,57],.18,P.rust,'Entrance sign truss diagonal'));
  C.push(...artSign('DEADWATER',[-48,25.2,57.5],34,P.cream,P.coral));
  C.push(...artSign('LAST SUMMER',[-48,25.2,56.5],22,P.cream,P.steel,180));
  C.push(...kiosk([-68,12,45],'TICKETS',P.aqua),...kiosk([-28,12,45],'RENTALS',P.orange));
  for(let i=0;i<8;i++){
    C.push(artBox([-80.5+i*1.45,14.2,34],[1.3,4.4,1.1],i%2?P.aqua:P.blue,'Faded changing-room locker'));
    C.push(artBox([-80.16+i*1.45,14.2,34.59],[.09,.38,.08],P.cream,'Locker handle'));
  }
  C.push(...standingSign('WAVE COURT',[-78,17,23],15,P.dark,P.yellow,12,20));
  C.push(...standingSign('KEEP YOUR SPEED',[156,5,-10],17,P.cream,P.blue,-6,-90));

  // The first experience has a waterpark silhouette at normal close-camera
  // eye height. This retired small slide starts on the west promenade and
  // crosses the low first basin, away from the transfer lip at z=0.
  C.push(...standingSign('WAVE POOLS',[-31,14.5,19],10,P.cream,P.blue,12,-15));
  C.push(...tower([-75,12,9],7,'OLD RAPIDS',P.orange));
  const entryFlume:ArtPoint[]=[[-71,19,9],[-64,18,6],[-55,16.6,7],[-45,15.2,10],[-35,14.4,10],[-28,13.5,14]];
  C.push(artPipe(entryFlume,1.25,P.orange,'OLD RAPIDS closed flume over the first wave pool'));
  C.push(...tubeSeams(entryFlume,1.25,'OLD RAPIDS'));
  C.push(artPipe(entryFlume.slice(1,-1).map(p=>[p[0],p[1]-1.45,p[2]] as ArtPoint),.14,P.steel,'OLD RAPIDS underslung steel spine'));
  for(const [x,top,z] of [[-64,16.55,6],[-35,12.95,10]]){
    C.push(artBox([x,12.2,z],[1.4,.4,1.4],P.stone,'OLD RAPIDS bank footing'));
    C.push(artBeam([x,12.4,z],[x,top,z],.3,P.steel,'OLD RAPIDS bank support'));
  }
  C.push(...artSign('CLOSED',[-28,13.6,15.3],3.3,P.cream,P.coral));
  C.push(artBeam([-29,12.6,15],[-27,14.6,15],.18,P.rust,'OLD RAPIDS boarded slide outlet'));

  // CYCLONE: orange descending helix wraps its own braced stair tower.
  C.push(...tower([16,12,-20],24,'CYCLONE',P.coral));
  const spiral: ArtPoint[]=[[20,36,-20],[26,35.6,-20]];
  for(let i=0;i<=36;i++){
    const t=i/36,a=t*Math.PI*1.8;
    spiral.push([16+15*Math.cos(a),35.5-18.5*t,-20+15*Math.sin(a)]);
  }
  C.push(artPipe(spiral,1.75,P.orange,'CYCLONE orange spiral flume'));
  C.push(...tubeSeams(spiral,1.75,'CYCLONE'));
  const end=spiral[spiral.length-1];
  C.push(...openFlume([end,[16,15,-38],[3,12,-40],[-9,8,-40]],4.2,1.5,P.coral,'CYCLONE spillway into the river'));
  for(const t of [.1,.35,.65,.85]){
    const a=t*Math.PI*1.8,x=16+15*Math.cos(a),z=-20+15*Math.sin(a),y=35.5-18.5*t;
    C.push(artBox([x,12.3,z],[1.6,.6,1.6],P.stone,'CYCLONE flume footing'));
    C.push(artBeam([x,12.6,z],[x,y-1.5,z],.45,P.steel,'CYCLONE flume support'));
  }

  // RIPTIDE: a second silhouette, with a broad funnel and a blue exit chute.
  C.push(...tower([51,12,-64],20,'RIPTIDE',P.blue));
  const feed: ArtPoint[]=[[46.5,32,-64],[42,31,-64],[39,28,-68],[38,26,-70]];
  C.push(artPipe(feed,1.45,P.yellow,'RIPTIDE yellow enclosed feed'),...tubeSeams(feed,1.45,'RIPTIDE feed'));
  const funnelVertices:number[]=[],funnelIndices:number[]=[],rings=8,segments=40;
  for(let ring=0;ring<=rings;ring++)for(let i=0;i<=segments;i++){
    const t=ring/rings,r=2.1+7.4*t,a=i/segments*Math.PI*2;
    funnelVertices.push(Math.cos(a)*r,4.5*t*t,Math.sin(a)*r);
    if(ring<rings&&i<segments){const n=ring*(segments+1)+i;funnelIndices.push(n,n+1,n+segments+1,n+1,n+segments+2,n+segments+1);}
  }
  C.push({t:'mesh',p:[31,22,-76],vertices:funnelVertices,indices:funnelIndices,tex:'solid',color:P.aqua,solid:false,doubleSided:true,edgeGrinding:false,grp:80,nm:'RIPTIDE broad drain funnel'});
  const lip=Array.from({length:41},(_,i)=>[31+9.5*Math.cos(i/40*Math.PI*2),26.5,-76+9.5*Math.sin(i/40*Math.PI*2)] as ArtPoint);
  C.push(artPipe(lip,.13,P.cream,'RIPTIDE white funnel rim'));
  const outlet: ArtPoint[]=[[31,22,-76],[36,20,-84],[45,17,-94],[50,11,-101],[52,8,-105]];
  C.push(...openFlume(outlet,4.2,1.7,P.blue,'RIPTIDE river return chute'));
  for(const x of [24,38])for(const z of [-80,-72]){
    C.push(artBox([x,12.25,z],[1.6,.5,1.6],P.stone,'RIPTIDE bowl footing'));
    C.push(artBeam([x,12.5,z],[x,25,z],.38,P.steel,'RIPTIDE bowl pedestal'));
  }
  C.push(artBeam([24,13,-80],[38,24,-80],.2,P.rust,'RIPTIDE pedestal cross brace'));

  // Back-of-park mega ride marquee, visible across the central courtyard.
  for(const x of [10,91]){
    C.push(artBox([x,-5,-186],[3,2,3],P.stone,'Boomerang marquee foundation'));
    C.push(artBeam([x,-4,-186],[x,32,-186],.6,P.steel,'Boomerang marquee mast'));
  }
  C.push(artBeam([10,30,-186],[91,30,-186],.5,P.steel,'Boomerang spanning marquee beam'));
  C.push(...artSign('DUAL BOOMERANG',[51,30,-185.6],52,P.cream,P.coral));
  C.push(...artSign('01',[10,24,-185.5],4,P.dark,P.yellow),...artSign('02',[91,24,-185.5],4,P.dark,P.yellow));

  // The playable blue chute keeps its original centre and jump. Curved side
  // shoulders, white panel joints and braced piers supply the slide identity.
  // Nothing spans the open launch gap from z=-78 to z=-58.
  C.push(...flumeShoulders([[138,18,-128],[138,4,-101],[138,4,-96],[138,16,-78]],'Blue splash launch flume'));
  C.push(...flumeShoulders([[138,14,-58],[138,14,-44],[138,0,-18]],'Blue splash catch and runout'));
  const flumeSupports:[number,number][]=[[-150,18],[-132,18],[-117,12.3],[-102,4.52],[-96,4],[-79,15.33],[-57,14],[-45,14],[-32,7.54],[-19,.54]];
  for(const side of [-1,1]){
    for(const [z,top]of flumeSupports){
      const x=138+side*13.5,base=z<=-140?5:-6;
      C.push(artBox([x,base+.25,z],[2,.5,2],P.stone,'Blue flume concrete pier footing'));
      C.push(artBeam([x,base+.5,z],[138+side*11.7,top+2.1,z],.42,P.steel,'Blue flume splayed outboard pier'));
      C.push(artBeam([x,base+1,z-2],[138+side*11.7,top+1.8,z+1],.19,P.rust,'Blue flume pier kicker brace'));
    }
    for(const section of [[[-128,18],[-101,4],[-96,4],[-78,16]],[[-58,14],[-44,14],[-18,0]]]){
      const rail=section.map(([z,y])=>[138+side*12.3,y-.4,z] as ArtPoint);
      C.push(artPipe(rail,.16,P.steel,'Blue flume outboard chassis rail'));
    }
  }

  // Coaster rim and trusses sit OUTSIDE the fourteen-metre riding ribbon.
  // Entry, exit and blue-flume ground corridors are kept entirely clear.
  const loopPoint=(angle:number,side:number,drop=.7):ArtPoint=>[
    138-20*angle/(Math.PI*2)+side,
    26*(1-Math.cos(angle))-Math.cos(angle)*drop,
    26*Math.sin(angle)+Math.sin(angle)*drop,
  ];
  for(const side of [-1,1]){
    for(const lateral of [8.3,10.3])C.push(artPipe(Array.from({length:65},(_,i)=>loopPoint(i/64*Math.PI*2,side*lateral)),.19,lateral===8.3?P.cream:P.steel,'Death loop outboard lattice chord'));
    for(let i=0;i<32;i++)C.push(artBeam(loopPoint(i/32*Math.PI*2,side*8.3),loopPoint((i+1)/32*Math.PI*2,side*10.3),.14,P.rust,'Death loop outboard lattice diagonal'));
  }
  for(const [angle,side,footX,footZ] of [[Math.PI/3,1,161,26],[Math.PI*2/3,1,158,28],[Math.PI*4/3,-1,99,-31],[Math.PI*5/3,-1,103,-30]]){
    const high=loopPoint(angle,side*10.3),foot:ArtPoint=[footX,-5.1,footZ];
    C.push(artBox([footX,-5.55,footZ],[4,.9,4],P.stone,'Death loop concrete anchor block'));
    C.push(artBeam(foot,high,.8,P.steel,'Death loop splayed support leg'));
    C.push(artBeam([footX+side*4,-6,footZ+4],high,.42,P.rust,'Death loop support kicker brace'));
  }
  C.push(...artSign('LOOP OF DEATH',[164,18,12],27,P.cream,P.coral,-90));
  C.push(artBeam([164,-6,0],[164,20,0],.45,P.steel,'Death loop warning sign mast'));
  C.push(artBeam([164,-6,24],[164,20,24],.45,P.steel,'Death loop warning sign mast'));

  // Purposeful service details follow paths and foundations, never the line.
  for(const [x,y,z] of [[-84,12,34],[-22,12,34],[5,12,3],[55,12,2],[17,12,-75],[74,12,-137],[160,-6,57],[101,-6,57]])C.push(...palm([x,y,z],9+(x%3),x%2?1.3:-1));
  for(const [x,y,z] of [[7,12,5],[53,12,5],[26,12,-81],[71,12,-138],[-76,12,8]]){
    C.push(artBox([x,y+.01,z],[3,.03,1],P.dark,'Recessed deck drain'));
    for(let bar=0;bar<8;bar++)C.push(artBox([x-1.3+bar*.37,y+.035,z],[.1,.035,.9],P.steel,'Deck drain grate bar'));
  }
  C.push(artPipe([[-78,12,17],[-78,13,9],[-77,13,1],[-75,9,-3]],.34,P.yellow,'Visible entrance service pipe'));
  C.push(artPipe([[55,12,-65],[64,12,-66],[72,9,-72],[78,7,-78]],.46,P.aqua,'RIPTIDE drained return plumbing'));
  for(const [x,z] of [[-80,27],[8,-1],[63,-136]]){
    C.push(artBox([x,13.3,z],[4,.2,1.1],P.rust,'Abandoned concourse bench seat'));
    for(const dx of [-1.5,1.5])C.push(artBox([x+dx,12.7,z],[.16,1.2,.65],P.steel,'Bench leg fixed to deck'));
  }
  return C;
}
