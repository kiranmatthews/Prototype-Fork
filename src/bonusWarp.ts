import * as THREE from 'three';

/** Lightweight additive ribbons: no textures, lights or collision bodies. */
export class BonusWarpEffect {
  readonly group=new THREE.Group();
  private rings:THREE.Mesh[]=[];
  private ringMaterials:THREE.ShaderMaterial[]=[];
  private glow:THREE.Mesh;
  private column:THREE.Mesh;
  private ringGeo=new THREE.CylinderGeometry(1,1,.25,48,1,true,0,Math.PI*1.72);
  private pointGeo=new THREE.BufferGeometry();
  private pointMaterial:THREE.PointsMaterial;
  private glowMaterial:THREE.ShaderMaterial;
  private columnMaterial:THREE.ShaderMaterial;
  private positions=new Float32Array(72);
  private readonly warmth:boolean;
  constructor(scene:THREE.Scene,origin:THREE.Vector3,exit=false,private readonly skyContrast=false){
    this.warmth=exit;
    this.group.name='Bonus travel light';this.group.position.copy(origin);
    // The horizon mist draws at order 6 without writing depth. Travel light
    // must follow it, while retaining depth testing against solid scenery.
    this.group.renderOrder=7;scene.add(this.group);
    const color=new THREE.Color(exit?0xffbd72:0x60ffe2);
    const vertex='varying vec2 uv0; void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
    const options={transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false};
    // Open arcs, softly tapered along their ends and across their width.
    // A small pitch makes them flowing ribbons rather than a stack of hoops.
    const pos=this.ringGeo.attributes.position,uv=this.ringGeo.attributes.uv;
    for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+(uv.getX(i)-.5)*.22);
    pos.needsUpdate=true;this.ringGeo.computeBoundingSphere();
    for(let i=0;i<5;i++){
      // Exposed course exits can sit against a nearly white sky. A softly
      // tinted core remains readable there; the floor glow/sparks stay additive.
      const material=new THREE.ShaderMaterial({...options,blending:skyContrast?THREE.NormalBlending:THREE.AdditiveBlending,
        uniforms:{tint:{value:color.clone()},strength:{value:0}},vertexShader:vertex,
        fragmentShader:`varying vec2 uv0;uniform vec3 tint;uniform float strength;void main(){float edge=pow(max(0.,sin(uv0.y*3.14159)),1.5);float tip=pow(max(0.,sin(uv0.x*3.14159)),.45);float core=pow(edge,7.);gl_FragColor=vec4(mix(tint,vec3(.88,1.,.98),core*${skyContrast?'.12':'.65'}),edge*tip*strength);}` });
      const ring=new THREE.Mesh(this.ringGeo,material);ring.name=`Bonus orbit ribbon ${i}`;ring.renderOrder=4;
      this.ringMaterials.push(material);this.rings.push(ring);this.group.add(ring);
    }
    this.glowMaterial=new THREE.ShaderMaterial({...options,uniforms:{tint:{value:color},strength:{value:0}},vertexShader:vertex,
      fragmentShader:'varying vec2 uv0;uniform vec3 tint;uniform float strength;void main(){float d=length(uv0-.5)*2.;float a=pow(max(0.,1.-d),2.5);gl_FragColor=vec4(tint,a*strength);}' });
    this.glow=new THREE.Mesh(new THREE.PlaneGeometry(3.1,3.1),this.glowMaterial);this.glow.rotation.x=-Math.PI/2;this.glow.position.y=.025;this.group.add(this.glow);
    this.columnMaterial=new THREE.ShaderMaterial({...options,uniforms:{tint:{value:color},strength:{value:0},time:{value:0}},vertexShader:vertex,
      fragmentShader:'varying vec2 uv0;uniform vec3 tint;uniform float strength;uniform float time;void main(){float fade=sin(uv0.y*3.14159);float w=.7+.3*sin(uv0.x*31.+uv0.y*23.-time*2.);gl_FragColor=vec4(tint,pow(max(0.,fade),1.5)*w*strength);}' });
    this.column=new THREE.Mesh(new THREE.CylinderGeometry(.68,.95,2.9,24,1,true),this.columnMaterial);
    this.column.position.y=1.45;this.column.visible=!exit;this.group.add(this.column);
    this.pointGeo.setAttribute('position',new THREE.BufferAttribute(this.positions,3));
    this.pointMaterial=new THREE.PointsMaterial({color,size:.085,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
    const points=new THREE.Points(this.pointGeo,this.pointMaterial);points.frustumCulled=false;this.group.add(points);
  }
  update(elapsed:number,charge:number,reduced=false){
    const strength=Math.min(1,elapsed*5)*(.5+.5*charge);
    this.pointMaterial.opacity=reduced?0:strength*.62;
    this.glowMaterial.uniforms.strength.value=strength*.85;
    this.columnMaterial.uniforms.strength.value=reduced?.045:strength*.12;
    this.columnMaterial.uniforms.time.value=reduced?0:elapsed;
    for(let i=0;i<this.rings.length;i++){
      const phase=(elapsed*(.42+charge*.7)+i/5+.04*Math.sin(i*2.4))%1;
      const y=reduced?.12+i*.08:.12+phase*(2.5+charge*1.1);
      const r=reduced?1.02:.98+Math.sin(phase*Math.PI)*.2-charge*.14;
      const ring=this.rings[i];ring.position.y=y;ring.scale.set(r,1,r);
      ring.rotation.y=reduced?i*1.7:elapsed*(.8+i*.13)+i*1.7;
      ring.rotation.z=reduced?0:Math.sin(i*1.9)*.075;
      this.ringMaterials[i].uniforms.strength.value=(reduced?.24:strength*Math.pow(Math.sin(phase*Math.PI),.5))*(this.warmth?.42:.9)*(this.skyContrast?2.2:1);
    }
    for(let i=0;i<24;i++){
      const t=(elapsed*.65+i/24)%1,a=i*2.399+elapsed*.8,r=.7+.36*Math.sin(i*1.9);
      this.positions[i*3]=Math.cos(a)*r;this.positions[i*3+1]=t*3.4;this.positions[i*3+2]=Math.sin(a)*r;
    }
    this.pointGeo.attributes.position.needsUpdate=true;
  }
  dispose(){
    this.group.removeFromParent();this.ringGeo.dispose();this.glow.geometry.dispose();this.column.geometry.dispose();this.pointGeo.dispose();
    for(const material of this.ringMaterials)material.dispose();
    this.pointMaterial.dispose();this.glowMaterial.dispose();this.columnMaterial.dispose();
  }
}
