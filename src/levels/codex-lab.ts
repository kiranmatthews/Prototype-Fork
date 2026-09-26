import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

// BLOCKWORKS — a 2.53 km greybox, built from metre-scale source-owned parts.
// 2.4 m cubes ask for a charged FOOT jump; 1.4 m shelves accept a charged
// BOARD ollie (measured apex 1.779 m). Flat skate gaps stop at 11.5 m against
// 13.8 m at 23 m/s. Long voids require the explicitly authored rail or switch.
// No movement tuning is overridden. The route never crosses itself.
type Point = [number, number, number];
const C: CustomComponent[] = [];
const groups: CustomGroup[] = [{ id: 1, nm: 'Ordered camera spine', editorOnly: true }];
const grey = ['#aeb4bb', '#89939e', '#c8cdd2', '#74808d'];
const ink = '#3d4855', amber = '#e2ad49', ice = '#a9e5ef';
const r = (n: number) => Math.round(n * 1000) / 1000;
const put = (c: CustomComponent) => C.push(c);
const route: Point[] = [];
export const BLOCKWORKS_SECTIONS: { name: string; start: Point; yaw: number; length: number; endY: number }[] = [];
let origin: Point = [0, 0, 20], sectionId = 10, puzzleId = 100;

class Section {
  readonly id = sectionId++;
  readonly yaw: number;
  readonly start: Point;
  readonly f: [number, number];
  readonly right: [number, number];
  constructor(readonly name: string, yaw: number, readonly length: number, readonly endY: number) {
    this.start = [...origin]; this.yaw = yaw;
    const a = yaw * Math.PI / 180;
    this.f = [-Math.sin(a), -Math.cos(a)]; this.right = [Math.cos(a), -Math.sin(a)];
    groups.push({ id: this.id, nm: name, editorOnly: true });
    BLOCKWORKS_SECTIONS.push({ name, start: [...origin], yaw, length, endY });
    this.camera(0, this.start[1]);
  }
  p(u: number, y: number, v: number): Point {
    return [r(this.start[0] + this.right[0] * u + this.f[0] * v), r(y), r(this.start[2] + this.right[1] * u + this.f[1] * v)];
  }
  box(u: number, top: number, v: number, width: number, depth: number, height = 1.2, color = grey[0], extra: Partial<CustomComponent> = {}) {
    put({ t: 'platform', p: this.p(u, top - height / 2, v), s: [width, height, depth], yaw: this.yaw,
      tex: 'solid', color, edgeGrinding: false, grp: this.id, ...extra });
  }
  deck(a: number, b: number, y: number, width = 14, u = 0, extra: Partial<CustomComponent> = {}) {
    this.box(u, y, (a+b)/2, width, b-a, 1.2, grey[0], extra);
  }
  ramp(a: number, b: number, low: number, high: number, width = 12, u = 0) {
    const ascending = high >= low;
    put({ t: 'ramp', p: this.p(u, Math.min(low,high), (a+b)/2), len: b-a, rise: Math.abs(high-low), w: width,
      yaw: (this.yaw + (ascending ? 0 : 180)) % 360, tex: 'solid', color: grey[1], grp: this.id, edgeGrinding: false });
  }
  cube(u: number, base: number, v: number, layers = 1, width = 1, depth = 1) {
    for (let h=0; h<layers; h++) for(let x=0;x<width;x++) for(let z=0;z<depth;z++)
      this.box(u+(x-(width-1)/2)*2.4, base+(h+1)*2.4, v+(z-(depth-1)/2)*2.4, 2.4, 2.4, 2.4, grey[(h+x+z)%grey.length]);
  }
  crate(u: number, y: number, v: number, kind: NonNullable<CustomComponent['kind']> = 'wood', grp = this.id, outline = false) {
    put({ t: 'crate', p: this.p(u,y,v), kind, grp, ...(outline ? {outline:true} : {}) });
  }
  fruit(u:number,y:number,v:number) { put({t:'wumpa',p:this.p(u,y,v),grp:this.id}); }
  line(a:number,b:number,y:number,u=0, spacing=9) { for(let v=a;v<=b;v+=spacing)this.fruit(u,y+1,v); }
  rail(points: [number,number,number,number?][], name: string) {
    const first=this.p(points[0][0],points[0][1],points[0][2]);
    put({t:'rail',p:first,pts:points.map(p=>{const q=this.p(p[0],p[1],p[2]);return [r(q[0]-first[0]),r(q[2]-first[2]),p[3]??0,r(q[1]-first[1])];}),grp:this.id,nm:name});
  }
  cp(v:number,y:number,u=0) { put({t:'checkpoint',p:this.p(u,y,v),grp:this.id,nm:this.name}); }
  enemy(u:number,y:number,v:number,foe:NonNullable<CustomComponent['foe']>,range=0,speed=0) {
    put({t:'enemy',p:this.p(u,y,v),foe,range,speed,yaw:this.yaw,grp:this.id});
  }
  pit(a:number,b:number,y:number,width=24,u=0) { put({t:'pit',p:this.p(u,y,(a+b)/2),s: this.yaw%180===0?[width,1,b-a]:[b-a,1,width],color:ink,grp:this.id}); }
  camera(v:number,y:number,u=0) { route.push(this.p(u,y,v)); }
  paint(u:number,y:number,v:number,width:number,depth:number,color=amber) {
    // Inlays are visual-only triangle meshes, never hidden collision bridges.
    const x=width/2,z=depth/2;
    put({t:'mesh',p:this.p(u,y+.028,v),yaw:this.yaw,vertices:[-x,0,-z,-x,0,z,x,0,z,x,0,-z],indices:[0,1,2,0,2,3],
      tex:'solid',color,solid:false,edgeGrinding:false,grp:this.id});
  }
  marks(v:number,y:number,width=12,color=amber) { this.paint(0,y,v,width,.22,color); }
  circuit(u:number,y:number,v:number,key:1|2,ghost=false) {
    const color=key===1?amber:'#b6a0de';
    this.paint(u,y,v,ghost?2.6:5,ghost?.14:.3,color);
    if(key===2)this.paint(u,y,v+.48,ghost?2.6:5,.14,color);
  }
  ice(a:number,b:number,y:number,width=14,u=0) {
    this.deck(a,b,y,width,u,{slip:true,iceGrip:.08,color:ice,nm:'Deep ice · retain momentum; use dry catch deck'});
    for(let v=a+5;v<b;v+=10)this.paint(u,y,v,width-.5,.1,'#e4faff');
  }
  view(a:number,b:number,y:number) {
    put({t:'camnode',cameraView:true,p:this.p(0,y+10,(a+b)/2),s:[50,60,b-a],yaw:this.yaw,radius:7,
      cameraPosition:this.p(0,y+13,a-13),cameraTarget:this.p(0,y+1.3,a),cameraFollowDistance:17,
      cameraFov:58,cameraAspect:16/9,grp:1,nm:'Read the next landing · elevated follow'});
  }
  finish() { this.camera(this.length,this.endY); origin=this.p(0,this.endY,this.length); }
}

// 01. Introduce the visual grammar without throwing the player into a void.
{
 const s=new Section('01 · Calibration court',0,170,0);
 s.deck(-16,32,0,22); s.line(4,27,0); s.crate(-5,0,14,'mask');
 put({t:'clock',p:s.p(5,0,7),grp:s.id}); put({t:'comboorb',p:s.p(-5,0,7),grp:s.id});
 // Board-sized staircase; the broad left cube wall offers a foot-climb line.
 for(let i=0;i<4;i++) { const v=38+i*10; s.box(i%2?1.8:-1.8,(i+1)*1.4,v,8,7); s.fruit(i%2?1.8:-1.8,(i+1)*1.4+1,v); }
 s.pit(32,74,-5); s.deck(72,91,5.6,18); s.cp(79,5.6);
 s.cube(-10,0,41,1,2,2); s.cube(-10,0,51,2,2,2); s.cube(-10,0,63,3,2,2);
 s.ramp(91,114,5.6,0); s.deck(114,131,0); s.marks(130,0);
 s.pit(131,142.5,-6); s.deck(142.5,170,0,20); s.marks(143,0);
 s.line(117,129,0); s.fruit(0,2.4,137); s.cp(158,0);
 s.camera(35,1.4);s.camera(72,5.6);s.camera(104,2.4);s.camera(147,0);s.finish();
}

// 02. Read A -> climb its scaffold -> hit B -> build the main bridge.
// Neither switch shares gameplay ancestry; yellow routes are distinct.
{
 const s=new Section('02 · Two-key foundry',0,170,4.8);
 s.view(8,119,2.4);
 const a=puzzleId++,b=puzzleId++;
 groups.push({id:a,nm:'A · access scaffold'},{id:b,nm:'B · crossing piers'});
 s.deck(0,42,0,22);s.cp(12,0);s.cube(-6,0,27,1,2,2);
 s.crate(-6,2.4,27,'bang',a);s.circuit(-6,2.4,27,1);s.line(6,21,0,-4);s.fruit(-6,3.5,27);
 // A's 3x3 metal pads rise .96 m at a time, visually building upward to B.
 for(let i=0;i<4;i++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)
   s.crate(-6+x*.96,i*.96,46+i*4.6+z*.96,'metal',a,true);
 s.box(-6,3.84,65,5.8,7,2.4,grey[2]);s.crate(-6,3.84,65,'bang',b);s.circuit(-6,3.84,65,2);
 for(let i=0;i<4;i++)s.circuit(-6,(i+1)*.96,46+i*4.6,1,true);
 for(let i=0;i<6;i++)s.circuit(-6+Math.min(i,3)*2,4.8,71+i*5.4,2,true);
 // The first B pier overlaps the small B island, then bends across to centre.
 for(let i=0;i<6;i++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)
   s.crate(-6+Math.min(i,3)*2+x*.96,3.84,71+i*5.4+z*.96,'metal',b,true);
 s.pit(42,105,-7,32);s.deck(102,134,4.8,20);s.cp(115,4.8);s.line(108,132,4.8);
 s.enemy(4,4.8,129,'turtle',2,1.2); // separate from the blind bridge landing
 s.deck(134,170,4.8,18);s.crate(-4,4.8,143,'mystery');
 s.camera(35,0);s.camera(61,3.5,-5);s.camera(91,4.8);s.camera(127,4.8);s.finish();
}

// 03. Two ice drifts, a generous dry brake island, then a visible gap.
{
 const s=new Section('03 · Ice brake laboratory',0,170,0);
 s.ramp(0,30,4.8,0,18);s.deck(30,44,0,20);s.cp(36,0);
 s.ice(44,94,0,18);s.line(48,87,0,-3);s.deck(94,132,0,24);s.marks(95,0,22);
 s.ice(132,145,0,16,3);s.line(135,141,0,3);s.pit(145,156.5,-7,28);
 s.deck(156.5,170,0,26);s.fruit(3,2.4,151);s.marks(144,0,14);s.cp(164,0);
 s.camera(32,0);s.camera(88,0);s.camera(125,0,3);s.camera(164,0);s.finish();
}

// 04. Sideways LEGO escarpment: several routes through a solid cube mass.
{
 const s=new Section('04 · Interlocking cube escarpment',270,170,0);
 s.view(12,115,7.2);
 s.deck(0,27,0,24);s.cp(12,0);
 for(let i=0;i<6;i++) {
   const v=35+i*9, y=(i+1)*2.4, u=i%2?3.6:-3.6;
   s.cube(u,0,v,i+1,3,3);s.fruit(u,y+1,v);

 }
 for(let i=0;i<12;i++)s.box(-10.5,(i+1)*1.2,29.5+i*4.5,4,3.8,1.2,grey[2]);
 s.pit(27,88,-6,31);s.deck(85,110,14.4,24);s.cp(99,14.4);
 s.ramp(110,157,14.4,0,16);s.deck(157,170,0,26);
 s.enemy(5,14.4,105,'spiker');for(let v=112;v<154;v+=10)s.fruit(-3,14.4*(157-v)/47+1,v);
 s.camera(27,0);s.camera(61,9.6);s.camera(98,14.4);s.camera(139,5.5);s.finish();
}

// 05. A real vert trough; either climb the coping or set up on the entry rail.
{
 const s=new Section('05 · Coping aqueduct',0,180,0);
 s.deck(0,27,0,26);s.cp(12,0);
 put({t:'vertramp',p:s.p(0,0,70),vkind:'half',len:86,rise:3.6,w:4,arc:90,deck:3,yaw:s.yaw,tex:'solid',color:grey[1],grp:s.id,nm:'Vert trough · climb walls for upper coping line'});
 s.rail([[-3,.72,18],[-3,.72,92,6],[-6,1.8,114,7],[-1,1.1,137,8],[0,.72,153]],'Low aqueduct · learn grind, then cross');
 s.rail([[7.6,3.72,81],[7.6,4.3,107,5],[12,6,122,7],[7,3.8,137,5],[2,1,157]],'Coping reward · high line to landing');
 s.pit(113,151,-9,30);s.deck(151,180,0,24);s.cp(169,0);
 s.line(36,100,0,0,11);s.fruit(-3,1.8,112);s.fruit(-2,1.8,130);s.fruit(0,1.8,147);
 s.camera(30,0);s.camera(78,0);s.camera(119,1);s.camera(159,0);s.finish();
}

// 06. Readable rail transfer: long first rail, a five-metre pop, wide catcher.
{
 const s=new Section('06 · Offset rail viaduct',0,180,0);
 s.deck(0,38,0,22);s.cp(22,0);s.enemy(0,0,13,'grunt',3,1);
 s.deck(38,51,0,12);s.rail([[0,.8,32],[-3,1.2,55,6],[-4,3,75,5],[0,2.8,96]],'Transfer launch');
 s.rail([[2,2.2,101],[6,2.6,113,4],[6,1.4,130,5],[0,.8,151]],'Transfer receiver · lower and offset two metres');
 s.pit(51,148,-10,34);s.deck(148,180,0,26);s.cp(163,0);s.marks(155,0,24);s.marks(159,0,24);s.marks(163,0,24);
 s.fruit(-.5,3.8,93);s.fruit(1,4.5,99);s.fruit(3,3.5,105);s.line(152,177,0);
 s.camera(40,0);s.camera(88,1.4);s.camera(123,1);s.camera(158,0);s.finish();
}

// 07. Foot climb with staggered voids. Tall blocks form terraces, not a wall.
{
 const s=new Section('07 · Sawtooth assembly',90,180,4.8);
 s.view(12,154,4.8);
 s.deck(0,29,0,26);s.cp(14,0);
 const heights=[2.4,4.8,7.2,9.6,7.2,4.8,7.2,4.8];
 heights.forEach((y,i)=>{const v=36+i*11,u=i%2?2.4:-2.4;s.cube(u,0,v,Math.round(y/2.4),3,3);s.fruit(u,y+1,v);});
 s.pit(29,121,-6,30);s.deck(121,140,4.8,22);s.cp(134,4.8);
 s.deck(140,153,4.8,7);s.box(-7,6,147,4,9);s.fruit(-7,7,147);
 s.enemy(0,4.8,146,'turtle',2,1.1);s.fruit(0,8,146);s.deck(151,180,4.8,24);s.crate(-5,4.8,160,'life');
 s.camera(25,0);s.camera(63,7.2);s.camera(99,6);s.camera(139,4.8);s.finish();
}

// 08. Ice carries you PAST the obvious centre; dry side bays allow correction.
{
 const s=new Section('08 · Frozen switchyard',0,180,0);
 const g=puzzleId++;groups.push({id:g,nm:'C · frozen crossing'});
 s.ramp(0,25,4.8,0,20);s.deck(25,39,0,22);s.cp(30,0);
 s.ice(39,95,0,20);s.deck(73,103,0,5,-12);s.deck(73,103,0,5,12);
 s.cube(12,0,90,1,2,2);s.crate(12,2.4,90,'bang',g);s.circuit(12,2.4,90,1);s.line(54,90,0,8,8);
 s.deck(95,113,0,25);s.marks(96,0,23);s.pit(113,149,-8,34);
 for(let i=0;i<6;i++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)
  s.crate(x*.96,0,117+i*5.55+z*.96,'metal',g,true);
 for(let i=0;i<6;i++)s.circuit(0,.96,117+i*5.55,1,true);
 s.deck(148,180,0,26);s.cp(164,0);s.crate(-5,0,173,'mask');
 s.camera(34,0);s.camera(77,0);s.camera(105,0);s.camera(137,.96);s.finish();
}

// 09. Alternating block shoulders around a hollow central spine.
{
 const s=new Section('09 · Split-level cube cathedral',0,180,9.6);
 s.view(12,153,4.8);
 s.deck(0,31,0,24);s.cp(17,0);
 for(let i=0;i<6;i++) {
  const v=39+i*12,y=Math.min(i+1,4)*2.4,u=i%2?3.6:-3.6;
  s.cube(u,0,v,Math.min(i+1,4),3,4);s.fruit(u,y+1,v);
  // Lower interlocking tongue makes the sideways change readable and catchable.
  s.box(0,y-1.2,v+4.5,7.2,5,1.2,grey[2]);
 }
 s.pit(31,111,-8,35);s.deck(109,135,9.6,26);s.cp(127,9.6);
 s.deck(135,152,9.6,6);s.enemy(0,9.6,145,'spiker');s.deck(152,180,9.6,24);s.rail([[5,10.4,131],[5,10.4,174]],'Cathedral parapet · bypass the spiker');s.line(134,173,10.4,5);
 s.camera(30,0);s.camera(61,4.8);s.camera(93,9.6);s.camera(136,9.6);s.finish();
}

// 10. Downhill eastbound bowl, then a measured kicker gap.
{
 const s=new Section('10 · Bank and launch',270,200,0);
 s.deck(0,24,9.6,26);s.cp(12,9.6);s.ramp(24,64,9.6,0,18);
 put({t:'vertramp',p:s.p(0,0,88),vkind:'half',len:48,rise:3.2,w:5,arc:70,deck:2,yaw:s.yaw,tex:'solid',color:grey[1],grp:s.id});
 s.deck(112,128,0,18);s.ramp(128,140,0,2,14);s.pit(140,151.5,-7,26);
 s.deck(151.5,173,1.4,18);s.ramp(173,184,1.4,0,18);s.deck(184,200,0,26);s.cp(191,0);
 for(let v=32;v<60;v+=10)s.fruit(0,9.6*(64-v)/40+1,v);s.fruit(0,4,146);s.camera(35,7);s.camera(74,0);s.camera(115,0);s.camera(157,1.4);s.finish();
}

// 11. Ice to dry cube roof, then an explicit grind across a longer void.
{
 const s=new Section('11 · Cold roof transfer',0,180,2.4);
 s.deck(0,30,0,26);s.cp(10,0);s.ice(30,85,0,18);s.marks(84,0,16);
 s.pit(85,96,-7,28);s.deck(96,114,0,20);s.marks(97,0,18);s.cp(105,0);
 s.cube(0,0,122,1,4,4);s.box(0,1.2,116,7,3.8,1.2,grey[2]);
 s.rail([[0,3.15,121],[-4,4,134,5],[1,5.6,147,5],[3,3.15,164]],'Roof rail · rising S-curve');
 s.pit(127,160,-8,30);s.deck(160,180,2.4,26);s.cp(171,2.4);
 s.fruit(0,2.4,91);s.fruit(0,4.2,137);s.fruit(2,4.2,151);
 s.camera(30,0);s.camera(88,0);s.camera(121,2.4);s.camera(157,2.4);s.finish();
}

// 12. Final switch sequence: first key creates a side stair to the second key.
{
 const s=new Section('12 · Counterweight gallery',90,190,7.2);
 s.view(12,135,4.8);
 const a=puzzleId++,b=puzzleId++;groups.push({id:a,nm:'D · gallery stair'},{id:b,nm:'E · upper crossing'});
 s.deck(0,43,2.4,26);s.cp(19,2.4);s.crate(6,2.4,29,'bang',a);s.circuit(6,2.4,29,1);
 for(let i=0;i<5;i++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)
   s.crate(6+x*.96,2.4+i*.96,47+i*4.6+z*.96,'metal',a,true);
 s.box(6,7.2,71,7,6,3.6,grey[2]);s.crate(6,7.2,71,'bang',b);s.circuit(6,7.2,71,2);
 for(let i=0;i<5;i++)s.circuit(6,3.36+i*.96,47+i*4.6,1,true);
 for(let i=0;i<7;i++)s.circuit(6-Math.min(i,3)*2,7.2,77+i*5.4,2,true);
 for(let i=0;i<7;i++)for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)
   s.crate(6-Math.min(i,3)*2+x*.96,6.24,77+i*5.4+z*.96,'metal',b,true);
 s.pit(43,114,-6,35);s.deck(113,145,7.2,24);s.cp(127,7.2);
 s.enemy(3,7.2,143,'grunt',2,1.2);s.deck(145,190,7.2,24);s.crate(-5,7.2,163,'mystery');
 s.camera(35,2.4);s.camera(66,7.2,6);s.camera(99,7.2);s.camera(146,7.2);s.finish();
}

// 13. Release: one broad downhill run, two gaps and a long optional rail.
{
 const s=new Section('13 · Momentum causeway',0,200,0);
 s.deck(0,20,7.2,24);s.cp(10,7.2);s.ramp(20,62,7.2,0,18);
 s.deck(62,82,0,18);s.marks(81,0,16);s.pit(82,93.5,-7,28);s.deck(93.5,123,0,20);
 s.enemy(5,0,118,'turtle',2,1);s.ramp(123,141,0,2.4,16);s.pit(141,153,-7,28);
 s.deck(153,178,0,20);s.deck(178,200,0,26);s.cp(186,0);
 s.rail([[-6,2.8,119],[-9,4,134,6],[-7,5.2,149,5],[-4,.9,174]],'High causeway bypass');
 s.fruit(0,2.4,87.5);s.fruit(0,4.5,147);for(let v=23;v<57;v+=10)s.fruit(-2,7.2*(62-v)/42+1,v);
 s.camera(31,5.3);s.camera(70,0);s.camera(110,0);s.camera(142,2.4);s.camera(181,0);s.finish();
}

// 14. Crown: remix block jumps, short ice, coping, then a generous finish court.
{
 const s=new Section('14 · Blockworks crown',0,180,7.2);
 s.view(14,85,3.6);
 s.deck(0,28.2,0,26);s.cp(13,0);
 for(let i=0;i<3;i++){s.cube(i%2?2.4:-2.4,0,34+i*11,i+1,3,3);s.fruit(i%2?2.4:-2.4,(i+1)*2.4+1,34+i*11);}
 s.pit(25,65,-7,30);s.deck(64,86,7.2,22);s.cp(76,7.2);
 s.ice(86,113,7.2,18);s.deck(113,131,7.2,22);s.marks(114,7.2,20);
 s.rail([[0,8,123],[-3,9.6,137,5],[0,8,154]],'Crown finish grind');s.pit(131,149,-4,30);
 s.deck(149,190,7.2,30);s.line(151,166,7.2);s.cp(157,7.2);
 put({t:'crystal',p:s.p(0,8.5,164),grp:s.id});put({t:'gate',p:s.p(0,7.2,174),yaw:s.yaw,grp:s.id});
 s.cube(-11,7.2,177,3,2,2);s.cube(11,7.2,177,3,2,2);
 s.camera(26,0);s.camera(56,7.2);s.camera(95,7.2);s.camera(139,7.2);s.finish();
}

// Dense, height-matched ordered camera samples keep turns predictable. Long
// vectors between section ends/starts are never inferred from component order.
// Round the eight course turns inside their broad dry courts before sampling.
const unique=route.filter((p,i)=>i===0||Math.hypot(...p.map((v,k)=>v-route[i-1][k]))>.01);
const cameraRoute:Point[]=[];
for(let i=0;i<unique.length;i++) {
 const a=unique[i-1],b=unique[i],c=unique[i+1];
 if(!a||!c){cameraRoute.push(b);continue;}
 const da=Math.hypot(b[0]-a[0],b[2]-a[2]),dc=Math.hypot(c[0]-b[0],c[2]-b[2]);
 const dot=((b[0]-a[0])*(c[0]-b[0])+(b[2]-a[2])*(c[2]-b[2]))/(da*dc);
 if(dot>.5){cameraRoute.push(b);continue;}
 const reach=Math.min(10,da*.4,dc*.4),before=b.map((v,k)=>v+(a[k]-v)*reach/da),after=b.map((v,k)=>v+(c[k]-v)*reach/dc);
 for(let j=0;j<=8;j++){const t=j/8;cameraRoute.push(b.map((v,k)=>r((1-t)**2*before[k]+2*(1-t)*t*v+t*t*after[k])) as Point);}
}
export const BLOCKWORKS_CAMERA_ROUTE = cameraRoute;
for(let i=0;i<cameraRoute.length-1;i++) {
 const a=cameraRoute[i],b=cameraRoute[i+1],d=Math.hypot(b[0]-a[0],b[2]-a[2]);
 if(d<.001)continue;
 const n=Math.max(1,Math.ceil(d/7));
 for(let j=0;j<n;j++)put({t:'camnode',p:a.map((v,k)=>r(v+(b[k]-v)*j/n)) as Point,grp:1});
}
put({t:'camnode',p:cameraRoute[cameraRoute.length-1],grp:1});

export const CODEX_LAB_LEVEL = {
 v:1, name:'Blockworks · Greybox',spawn:[0,.15,16],killY:-18,sky:'day',
 keepPlayFog:true,
 atmosphere:{fogEnabled:true,fogNear:100,fogFar:330,fogColor:'#c1c9d1',backdrop:'fog',
  ambientSky:'#e8f1ff',ambientGround:'#626d7d',ambientIntensity:1.1,sunColor:'#ffffff',sunIntensity:1.25,
  fillColor:'#c8d9f0',fillIntensity:.35,drawDistance:500,shadowStrength:.65},
 medalTimes:{gold:240,silver:310,bronze:390},components:C,groups,
} satisfies CustomLevelData;
