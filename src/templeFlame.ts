import * as THREE from 'three';

export const TEMPLE_FLAME_STEP=.016, TEMPLE_FLAME_TRAVEL=.26;
const SIDES=8,FANS=2,FAN_VERTS=2+SIDES*2;
export const TEMPLE_FLAME_VERTICES=FANS*FAN_VERTS;
export const TEMPLE_FLAME_INDICES=FANS*(SIDES*9+6);
const hash=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const smooth=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);
const hot=new THREE.Color('#fff348'),gold=new THREE.Color('#ffbd1f'),orange=new THREE.Color('#f36509'),red=new THREE.Color('#b92d03');
const color=new THREE.Color(),vertex=new THREE.Vector3();
export interface TempleFlameSample {age:number;seed:number;distance:number;travel:number;heat:number;radius:number;length:number;wave:number;x:number;y:number;z:number;yellow:number}
export const createTempleFlameSample=():TempleFlameSample=>({age:0,seed:0,distance:0,travel:0,heat:0,radius:0,length:0,wave:0,x:0,y:0,z:0,yellow:0});

/** The accepted Temple of Embers flame surface, shared by tiki breath and kart jets.
 * Two overlapping fans retain the original heat centres, ragged rims and cooling. */
export function createTempleFlameGeometry(capacity:number){
  const geometry=new THREE.BufferGeometry(),indices:number[]=[];
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(capacity*FANS*FAN_VERTS*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(capacity*FANS*FAN_VERTS*4),4).setUsage(THREE.DynamicDrawUsage));
  for(let n=0;n<capacity*FANS;n++){
    const base=n*FAN_VERTS;
    for(let s=0;s<SIDES;s++){
      const next=(s+1)%SIDES,owner=s<4?0:1,nextOwner=next<4?0:1;
      indices.push(base+owner,base+2+s,base+2+next);
      if(owner!==nextOwner)indices.push(base+owner,base+nextOwner,base+2+next);
      indices.push(base+2+s,base+2+SIDES+s,base+2+SIDES+next,base+2+s,base+2+SIDES+next,base+2+next);
    }
  }
  geometry.setIndex(indices);
  return geometry;
}
export function createTempleFlameMaterial(){
  const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
  material.name='Temple of Embers · Gouraud flame lobes';material.userData.gouraud=true;return material;
}
export function sampleTempleFlame(age:number,seed:number,range:number,out:TempleFlameSample):boolean {
  const life=.27+hash(seed+3)*.055;if(age<0||age>=life)return false;
  const distance=age*range/TEMPLE_FLAME_TRAVEL*(.94+hash(seed+4)*.12),travel=distance/range;
  const heat=smooth(0,.009,age)*(1-smooth(.72,1.06,travel))*(.91+.09*Math.sin(age*38+seed*.7));
  if(heat<=.006)return false;
  const wave=age*22+seed*2.4;
  const radius=(.43+.28*smooth(0,.055,age)-.15*smooth(.6,1,travel))*(.9+hash(seed+6)*.2);
  const length=Math.min(.88+hash(seed+7)*.34,Math.max(.08,(range-distance)*.8));
  const x=Math.sin(wave*.67)*age*.32,y=1.03+age*age*1.1+Math.sin(wave)*age*.2,z=1.08+distance;
  Object.assign(out,{age,seed,distance,travel,heat,radius,length,wave,x,y,z,yellow:1-smooth(.12,.38,travel)});return true;
}
export function writeTempleFlame(sample:TempleFlameSample,viewPoint:THREE.Vector3,positions:THREE.BufferAttribute,colors:THREE.BufferAttribute,slot:number,yaw=0,transform?:THREE.Matrix4,opacity=1){
  const {age,seed,travel,heat,radius,length,wave,x,y,z,yellow}=sample,sn=Math.sin(yaw),cs=Math.cos(yaw);
  for(let fan=0;fan<FANS;fan++){
    const viewX=viewPoint.x*cs-viewPoint.z*sn-x,viewY=viewPoint.y-y;
    const phi=Math.atan2(viewX,-viewY)+(fan-.5)*.22+(hash(seed+20)-.5)*.18;
    const rx=Math.cos(phi),ry=Math.sin(phi),layer=fan===0?1:.88,base=(slot*FANS+fan)*FAN_VERTS;
    const density=(1-.58*smooth(.14,.72,travel))*(fan===0?1:.52);
    for(let v=0;v<FAN_VERTS;v++){
      let along:number,radial:number,alpha:number;
      if(v<2){along=(v===0?-.12:.18)*length;radial=(v===0?.09:-.075)*radius;
        color.copy(orange).lerp(v===0?hot:gold,yellow).lerp(red,Math.max(0,travel-.35)*.45);alpha=heat*density*(v===0?.86:.7);
      }else{
        const ring=v>=2+SIDES?1:0,j=(v-2)%SIDES,angle=j/SIDES*Math.PI*2+(hash(seed+j+90)-.5)*.21;
        const ragged=1+.17*Math.sin(wave+j*2.6)+.1*Math.sin(wave*1.7-j);
        const fraction=ring?1:.45;
        along=Math.cos(angle)*length*fraction*(Math.cos(angle)>0?1:.65);
        radial=Math.sin(angle)*radius*fraction*ragged;
        color.copy(ring?red:orange).lerp(hot,ring?0:yellow*.85).lerp(red,travel*.3);
        alpha=ring?0:heat*density*.58;
      }
      const curl=smooth(.03,.2,age)*(.12+hash(seed+30)*.2);
      const px=x+radial*rx*layer,py=y+radial*ry*layer+Math.max(0,along)/length*curl+fan*age*.3,pz=z+along*layer;
      if(transform){vertex.set(px*cs+pz*sn,py,pz*cs-px*sn).applyMatrix4(transform);positions.setXYZ(base+v,vertex.x,vertex.y,vertex.z);}
      else positions.setXYZ(base+v,px*cs+pz*sn,py,pz*cs-px*sn);
      colors.setXYZW(base+v,color.r,color.g,color.b,alpha*opacity);
    }
  }
}
