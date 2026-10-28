import * as THREE from 'three';

/** A static inverse-coordinate cache, not a density/geometry LOD. All camera
 * rays still sample the original cloud field at its authored spacing. */
export function bakeCloudCoordinates(frames:Float32Array,spacing:number,bounds:THREE.Box3,range:THREE.Vector2,start:THREE.Vector3,chord:THREE.Vector3,worldFromMap:THREE.Matrix4,flatHalf:number|undefined,gutterRadius:number){
  const count=frames.length/8,total=(count-1)*spacing,origin=(range.x+range.y)/2;
  const size=bounds.getSize(new THREE.Vector3()),resolution=size.toArray().map(v=>Math.max(2,Math.ceil(v)+1));
  const [nx,ny,nz]=resolution,data=new Uint16Array(nx*ny*nz*4),m=worldFromMap.elements;
  const frame={px:0,py:0,pz:0,xx:0,xy:0,xz:0,yx:0,yy:0,yz:0,zx:0,zy:0,zz:0,w:0};
  const sample=(s:number)=>{
    const index=THREE.MathUtils.clamp(s/spacing,0,count-1.001),i=Math.floor(index)*8,t=index-Math.floor(index),u=1-t;
    let qx=frames[i+4]*u+frames[i+12]*t,qy=frames[i+5]*u+frames[i+13]*t,qz=frames[i+6]*u+frames[i+14]*t,qw=frames[i+7]*u+frames[i+15]*t;
    const length=Math.hypot(qx,qy,qz,qw);qx/=length;qy/=length;qz/=length;qw/=length;
    const width=frames[i+3]*u+frames[i+11]*t,sign=Math.sign(width);
    frame.xx=1-2*(qy*qy+qz*qz);frame.xy=2*(qx*qy+qz*qw);frame.xz=2*(qx*qz-qy*qw);
    frame.yx=2*(qx*qy-qz*qw);frame.yy=1-2*(qx*qx+qz*qz);frame.yz=2*(qy*qz+qx*qw);
    frame.zx=(frame.xy*frame.yz-frame.xz*frame.yy)*sign;
    frame.zy=(frame.xz*frame.yx-frame.xx*frame.yz)*sign;
    frame.zz=(frame.xx*frame.yy-frame.xy*frame.yx)*sign;
    const extra=s-THREE.MathUtils.clamp(s,0,total);
    frame.px=frames[i]*u+frames[i+8]*t+frame.zx*extra;
    frame.py=frames[i+1]*u+frames[i+9]*t+frame.zy*extra;
    frame.pz=frames[i+2]*u+frames[i+10]*t+frame.zz*extra;frame.w=Math.abs(width);
  };
  for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const mx=bounds.min.x+x/(nx-1)*size.x,my=bounds.min.y+y/(ny-1)*size.y,mz=bounds.min.z+z/(nz-1)*size.z;
    const px=m[0]*mx+m[4]*my+m[8]*mz+m[12],py=m[1]*mx+m[5]*my+m[9]*mz+m[13],pz=m[2]*mx+m[6]*my+m[10]*mz+m[14];
    let s=range.x+(px-start.x)*chord.x+(py-start.y)*chord.y+(pz-start.z)*chord.z;
    sample(s);
    for(let j=0;j<10;j++){
      const delta=(px-frame.px)*frame.zx+(py-frame.py)*frame.zy+(pz-frame.pz)*frame.zz;
      s+=delta;sample(s);if(Math.abs(delta)<.00001)break;
    }
    const dx=px-frame.px,dy=py-frame.py,dz=pz-frame.pz,i=(x+nx*(y+ny*z))*4;
    data[i]=THREE.DataUtils.toHalfFloat((dx*frame.xx+dy*frame.xy+dz*frame.xz)*7/frame.w);
    data[i+1]=THREE.DataUtils.toHalfFloat(dx*frame.yx+dy*frame.yy+dz*frame.yz);
    data[i+2]=THREE.DataUtils.toHalfFloat(s-origin);data[i+3]=THREE.DataUtils.toHalfFloat(frame.w);
  }
  // Bound each partial derivative over all trilinear cells. The Frobenius
  // norm bounds the coordinate map's stretch for every ray direction. Include
  // the exact gutter derivative so empty-space advances remain conservative.
  const values=Float32Array.from(data,n=>THREE.DataUtils.fromHalfFloat(n));
  let maximumWidth=0,maximumX=0;
  for(let i=0;i<values.length;i+=4){maximumWidth=Math.max(maximumWidth,values[i+3]);maximumX=Math.max(maximumX,Math.abs(values[i]));}
  const edge=flatHalf===undefined?0:Math.max(0,maximumWidth-flatHalf),slope=edge/Math.sqrt(Math.max(.01,gutterRadius*gutterRadius-edge*edge));
  let normSquared=0;
  for(let axis=0;axis<3;axis++){
    const stride=[1,nx,nx*ny][axis],n=resolution[axis],step=size.getComponent(axis)/(n-1);let maxSquared=0;
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      if([x,y,z][axis]===n-1)continue;
      const a=(x+nx*(y+ny*z))*4,b=a+stride*4;
      const dx=Math.abs(values[b]-values[a])/step,dy=Math.abs(values[b+1]-values[a+1])/step,dz=Math.abs(values[b+2]-values[a+2])/step,dw=Math.abs(values[b+3]-values[a+3])/step;
      const curvedY=dy+slope*(maximumWidth*dx+maximumX*dw)/7;
      maxSquared=Math.max(maxSquared,dx*dx+curvedY*curvedY+dz*dz);
    }
    normSquared+=maxSquared;
  }
  const texture=new THREE.Data3DTexture(data,nx,ny,nz);texture.format=THREE.RGBAFormat;texture.type=THREE.HalfFloatType;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return {texture,min:bounds.min.clone(),size,resolution:new THREE.Vector3(...resolution),origin,transform:worldFromMap.clone().invert(),stretch:Math.sqrt(normSquared)*1.05};
}
