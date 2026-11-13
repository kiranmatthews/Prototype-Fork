import * as THREE from 'three';
import type {CustomComponent} from '../level';

type Point=[number,number,number];
export const COURT_SPAWN:Point=[0,.02,13];
export const COURT_EXTRA_TORCHES:Point[]=[[5,0,7],[-16.65,0,-2],[16.65,0,-2],[-16.65,0,-10],[16.65,0,-10],[-2.6,1.15,-30],[2.6,1.15,-30]];
export const COURT_FIRES:{p:Point;scale:number;context:string}[]=[
  {p:[-5,2.1,7],scale:.43,context:'Gateway torch'},
  {p:[0,1.25,-5],scale:.88,context:'Temple basin'},
  {p:[0,2.05,-20],scale:1.15,context:'Altar fire channel'},
  {p:[-10,.28,-8],scale:.8,context:'Ritual circle'},
  {p:[10.5,.6,-8],scale:.85,context:'Fire trap'},
  {p:[-10,1.65,3],scale:.4,context:'Shrine lantern'},
  {p:[-9,2.4,-19],scale:.7,context:'Offering bowl'},
  {p:[9,.35,4],scale:.85,context:'Camp hearth'},
];
// Source-owned solids use the same platform/wall semantics as the level editor.
// This inspection scene owns its first-person controller; gameplay tuning is untouched.
export const COURT_SOLIDS:CustomComponent[]=[
  {t:'platform',p:[0,-.55,-4],s:[36,1,42],color:'#716f51'},
  {t:'platform',p:[0,.55,-20],s:[30,1.2,10],color:'#b3a47c'},
  {t:'platform',p:[0,.55,-29.5],s:[8,1.2,9],color:'#8f8e71'},
  {t:'wall',p:[-4,1.15,-29.5],s:[.6,5.5,9],color:'#657963'},
  {t:'wall',p:[4,1.15,-29.5],s:[.6,5.5,9],color:'#657963'},
  {t:'wall',p:[0,1.15,-34],s:[8,5.5,.6],color:'#657963'},
  ...Array.from({length:4},(_,i):CustomComponent=>({t:'platform',p:[0,(i+1)*.15-.05,-12.3-i*.8],s:[7,(i+1)*.3,.84],color:'#bead82'})),
  {t:'wall',p:[-18,-.05,-4],s:[.8,4.6,42],color:'#858465'},
  {t:'wall',p:[18,-.05,-4],s:[.8,4.6,42],color:'#858465'},
  {t:'wall',p:[-10.5,-.05,17],s:[15,4.6,.8],color:'#858465'},
  {t:'wall',p:[10.5,-.05,17],s:[15,4.6,.8],color:'#858465'},
  {t:'wall',p:[-10.5,1.15,-25],s:[15,4.6,.8],color:'#858465'},
  {t:'wall',p:[10.5,1.15,-25],s:[15,4.6,.8],color:'#858465'},
  ...[-14,14].flatMap(x=>[6,-4,-14].map((z):CustomComponent=>({t:'wall',p:[x,-.05,z],s:[1.15,4.6,1.15],color:'#bbad83'}))),
];

export class FireCourtyard extends THREE.Group {
  readonly colliders:THREE.Box3[]=[];
  readonly surfaces:THREE.Box3[]=[];
  readonly torchLights:THREE.PointLight[]=[];
  readonly spawn=new THREE.Vector3(...COURT_SPAWN);
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly materials=new Set<THREE.Material>();
  private readonly textures:THREE.Texture[]=[];
  constructor(){
    super();this.name='Temple fire courtyard';
    const stone=this.material('#b9a77d'),dark=this.material('#4a5143'),bronze=this.material('#87704b',.5),wood=this.material('#553d2e'),coal=this.material('#292d29'),moss=this.material('#537344');
    for(const c of COURT_SOLIDS){
      const s=c.s!,p=c.p,y=c.t==='wall'?p[1]+s[1]/2:p[1];
      this.box(s,p[0],y,p[2],this.material(c.color||'#a49370'));
      const bounds=new THREE.Box3(new THREE.Vector3(p[0]-s[0]/2,y-s[1]/2,p[2]-s[2]/2),new THREE.Vector3(p[0]+s[0]/2,y+s[1]/2,p[2]+s[2]/2));
      this.colliders.push(bounds);this.surfaces.push(bounds);
    }
    // Varied paving, broad borders and wall courses provide readable heat-haze detail.
    const paving=['#949577','#858b70','#a1a186','#b0a381'].map(c=>this.material(c));
    for(let x=-16;x<=16;x+=2)for(let z=-10;z<=14;z+=2){
      const i=Math.abs(x*19+z*7)%4;this.box([1.92,.05,1.92],x,0,z,paving[i]);
    }
    for(const x of [-16.5,16.5])this.box([.22,.065,37],x,.02,-4,bronze);
    for(const x of [-18,18])for(const y of [1.2,2.7,4.45])this.box([.95,.17,42],x,y,-4,stone);
    for(const x of [-17.54,17.54])for(let z=-23;z<=15;z+=3.3){
      this.box([.08,3.9,.12],x,2,z,bronze);
      const relief=this.box([.15,.65,.65],x,2.55,z+1.6,dark);relief.rotation.x=Math.PI/4;
      this.box([.12,.12,1.1],x,1.9,z+1.6,stone);
    }
    for(const x of [-11,11])for(const z of [-24.5,16.5]){
      this.box([9.5,.16,.1],x,2.55,z,bronze);this.box([9.5,.16,.1],x,3.8,z,stone);
      for(let i=-2;i<=2;i++){const r=this.box([.72,.72,.12],x+i*1.65,3.2,z,dark);r.rotation.z=Math.PI/4;}
    }
    for(const x of [-14,14])for(const z of [6,-4,-14]){
      this.box([1.65,.25,1.65],x,.12,z,stone);this.box([1.6,.26,1.6],x,4.45,z,stone);
      this.box([.1,2.8,.12],x+(x<0?.59:-.59),2.3,z,bronze);
    }
    this.arch(0,0,10,6.7,5.8,stone,bronze);
    this.arch(0,1.15,-24.4,5.8,5.8,stone,bronze);
    this.plaque('THE EMBER COURT',0,5.45,10.48,5.2);
    this.plaque('TEMPLE OF THE LIVING FLAME',0,6.7,-23.9,5.2);
    this.basin(0,0,-5,1.75,stone,bronze,coal);
    this.solid(0,.65,-5,3.3,1.3,3.3);
    this.torch(-5,0,7,wood,bronze);
    for(const [x,y,z] of COURT_EXTRA_TORCHES){
      this.torch(x,y,z,wood,bronze);
    }
    for(const z of [-2,-10])for(const x of [-16.65,16.65]){
      this.box([.9,.18,.23],x+(x<0?-.3:.3),1.15,z,bronze);
    }
    // A small inner sanctuary closes the arch view and leaves room to turn around.
    this.box([8.5,.4,9.5],0,6.6,-29.5,dark);
    this.box([2.8,.4,1.8],0,1.35,-32.5,stone);this.box([1.9,2.3,1.2],0,2.6,-32.5,stone);
    const seal=this.mesh(new THREE.OctahedronGeometry(.75),bronze,0,4.35,-32.5);seal.scale.set(.75,1.3,.75);
    this.plaque('THE LIVING FLAME',0,3.1,-31.86,1.7);this.solid(0,2.4,-32.5,2.8,2.5,1.8);
    for(const x of [-2.6,2.6]){const l=new THREE.PointLight('#ffbb61',10,7,2);l.position.set(x,3.85,-30);this.add(l);this.torchLights.push(l);}
    // Tall back altar: a broad connected bed in a recessed stone channel.
    this.box([8,.55,2.5],0,1.43,-20,stone);this.box([7.2,.12,1.6],0,1.76,-20,coal);
    for(const z of [-21,-19])this.box([8,.32,.28],0,1.84,z,bronze);
    this.solid(0,1.6,-20,8,.9,2.5);
    // Circle with individual socket cups; all source positions remain at floor level.
    this.cylinder(2.15,2.3,.15,24,-10,.1,-8,stone);
    this.ring(1.9,.07,-10,.21,-8,bronze);
    for(let i=0;i<10;i++){const a=i*Math.PI/5;this.cylinder(.21,.15,.12,8,-10+Math.cos(a)*1.2,.22,-8+Math.sin(a)*1.2,bronze);}
    // The trap has a carved mouth, and a shallow catch channel below its stream.
    this.box([1.3,2.8,1.8],8.35,1.35,-8,stone);this.box([.15,.55,.68],9.05,1.49,-8,coal);
    for(const z of [-8.4,-7.6])this.box([.3,.9,.18],9.12,1.5,z,bronze);
    this.box([5.6,.12,1.8],11.2,.06,-8,dark);this.solid(8.35,1.4,-8,1.4,2.8,1.8);
    for(const x of [9.2,13.8])this.box([.15,.18,1.95],x,.15,-8,bronze);
    this.basin(-9,1.15,-19,1.2,stone,bronze,coal);this.solid(-9,1.8,-19,2.3,1.3,2.3);
    // Open lantern lets the billboard remain visible from every side.
    this.cylinder(.7,.95,1.35,6,-10,.65,3,stone);this.cylinder(.82,.6,.2,8,-10,1.45,3,bronze);
    for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;this.cylinder(.055,.055,2,6,-10+Math.cos(a)*.68,2.35,3+Math.sin(a)*.68,bronze);}
    this.cylinder(0,.98,.6,6,-10,3.5,3,stone);this.solid(-10,1.6,3,1.8,3.2,1.8);
    // Camp hearth: ash, split logs and a loose octagonal ring of stones.
    this.cylinder(1.6,1.6,.12,32,9,.04,4,coal);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;const rock=this.mesh(new THREE.DodecahedronGeometry(.35,0),stone,9+Math.cos(a)*1.7,.23,4+Math.sin(a)*1.7);rock.scale.set(1.4,.75,1);rock.rotation.y=a;}
    for(let i=0;i<3;i++){const log=this.cylinder(.16,.22,2.5,7,9,.23+i*.08,4,wood);log.rotation.z=Math.PI/2;log.rotation.y=i*Math.PI/3;}
    // A seating nook and stacked supplies give scale without competing with the fire.
    for(const z of [6.7,1.2]){this.box([3.4,.24,.6],10,.55,z,wood);for(const x of [8.7,11.3])this.box([.35,.65,.5],x,.27,z,stone);}
    for(const x of [13.5,14.6]){this.box([.95,.95,.95],x,.45,9,wood);this.box([1.02,.12,1.02],x,.8,9,bronze);this.solid(x,.5,9,1,1,1);}
    // Native geometry foliage at the edges, not distance-swapped scenery.
    for(const [x,z] of [[-16,13],[16,13],[-16,-22],[16,-22],[-16,-7],[16,1]]){
      this.cylinder(.55,.7,.6,8,x,.25,z,dark);
      for(let i=0;i<7;i++){const a=i*2.399;const leaf=this.mesh(new THREE.ConeGeometry(.38,2.4,4),moss,x+Math.sin(a)*.35,1.3,z+Math.cos(a)*.35);leaf.rotation.set(Math.cos(a)*.6,0,Math.sin(a)*.6);}
    }
    for(let i=0;i<COURT_FIRES.length;i++){const p=COURT_FIRES[i].p;this.plaque(String(i+1).padStart(2,'0')+'  '+COURT_FIRES[i].context.toUpperCase(),p[0],p[2]<-15?1.8:.64,p[2]+2.4,2.9);}
    this.ring(.65,.035,0,.03,-11,bronze);
  }
  private material(color:string,metalness=0){const m=new THREE.MeshStandardMaterial({color,roughness:metalness?.58:.94,metalness});this.materials.add(m);return m;}
  private mesh(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;this.add(o);this.geometries.add(g);return o;}
  private box(s:Point,x:number,y:number,z:number,m:THREE.Material){return this.mesh(new THREE.BoxGeometry(...s),m,x,y,z);}
  private cylinder(a:number,b:number,h:number,n:number,x:number,y:number,z:number,m:THREE.Material){return this.mesh(new THREE.CylinderGeometry(a,b,h,n),m,x,y,z);}
  private ring(r:number,t:number,x:number,y:number,z:number,m:THREE.Material){const o=this.mesh(new THREE.TorusGeometry(r,t,6,40),m,x,y,z);o.rotation.x=-Math.PI/2;return o;}
  private solid(x:number,y:number,z:number,w:number,h:number,d:number){const b=new THREE.Box3(new THREE.Vector3(x-w/2,y-h/2,z-d/2),new THREE.Vector3(x+w/2,y+h/2,z+d/2));this.colliders.push(b);this.surfaces.push(b);}
  private basin(x:number,y:number,z:number,r:number,stone:THREE.Material,bronze:THREE.Material,coal:THREE.Material){
    this.cylinder(r*.7,r*.8,.25,8,x,y+.125,z,stone);
    const profile=[[0,.2],[r*.55,.2],[r*.62,.5],[r,1.2],[r,1.3],[r*.85,1.3],[r*.7,.8],[0,.8]].map(([a,b])=>new THREE.Vector2(a,b));
    this.mesh(new THREE.LatheGeometry(profile,10),stone,x,y,z);this.ring(r*.94,.055,x,y+1.3,z,bronze);this.cylinder(r*.75,r*.75,.05,16,x,y+1.08,z,coal);
  }
  private torch(x:number,y:number,z:number,wood:THREE.Material,bronze:THREE.Material){this.cylinder(.12,.18,1.65,7,x,y+.85,z,wood);this.cylinder(.36,.18,.35,8,x,y+1.85,z,bronze);this.ring(.34,.04,x,y+2.03,z,bronze);this.cylinder(.5,.62,.18,8,x,y+.04,z,bronze);this.solid(x,y+1,z,.5,2,.5);}
  private arch(x:number,y:number,z:number,w:number,h:number,stone:THREE.Material,bronze:THREE.Material){
    for(const sign of [-1,1]){this.box([1.35,h,1.8],x+sign*w/2,y+h/2,z,stone);this.box([1.8,.25,2.1],x+sign*w/2,y+.12,z,bronze);this.solid(x+sign*w/2,y+h/2,z,1.35,h,1.8);}
    this.box([w+2.2,.8,2],x,y+h-.2,z,stone);this.box([w+2.5,.18,2.15],x,y+h+.25,z,bronze);
    for(let i=-2;i<=2;i++){const glyph=this.box([.45,.45,.1],x+i*1.1,y+h-.18,z+1.06,bronze);glyph.rotation.z=Math.PI/4;}
  }
  private plaque(text:string,x:number,y:number,z:number,width:number){
    const c=document.createElement('canvas');c.width=1024;c.height=96;const ctx=c.getContext('2d')!;ctx.fillStyle='#253d37';ctx.fillRect(0,0,1024,96);ctx.fillStyle='#e5cc91';ctx.fillRect(0,0,1024,3);ctx.font='600 32px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,512,50);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;this.textures.push(t);const m=new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide});this.materials.add(m);this.mesh(new THREE.PlaneGeometry(width,width*96/1024),m,x,y,z);
  }
  groundAt(x:number,z:number,ceiling:number){let top=-Infinity;for(const b of this.surfaces)if(x>b.min.x&&x<b.max.x&&z>b.min.z&&z<b.max.z&&b.max.y<=ceiling)top=Math.max(top,b.max.y);return top;}
  blocked(x:number,y:number,z:number){const r=.27;return this.colliders.some(b=>y<b.max.y-.25&&y+1.6>b.min.y&&x+r>b.min.x&&x-r<b.max.x&&z+r>b.min.z&&z-r<b.max.z);}
  dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.removeFromParent();}
}
