import * as THREE from 'three';
import { AssetCache } from './assetLifetime';
import { isGraphicsReset } from './lostGraphicsResources';

type BeaconKind = 'arrival' | 'finish';
const TOP = 2.2 / 3;
const SEGMENTS = 144;
const vertex = `
  varying vec3 local;
  void main() {
    local = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function lightMaterial(fragment: string, color: number, strength: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: vertex,
    fragmentShader: `uniform float time; uniform vec3 tint; uniform float strength; varying vec3 local;
      ${fragment}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false,
  });
}

/** Smooth surfaces of revolution: rounded profiles, no texture or model downloads. */
export function createBeaconArtwork(kind: BeaconKind): THREE.Group {
  const group = new THREE.Group();
  group.name = `Procedural ${kind} beacon platform`;
  const green = kind === 'arrival' ? 0x42ee69 : 0x66ff7a;
  const shell = new THREE.MeshPhysicalMaterial({ color: 0x243c3e, metalness: .48, roughness: .28,
    clearcoat: .48, clearcoatRoughness: .22 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xe9fff3, emissive: 0xd9ffe5,
    emissiveIntensity: .38, metalness: .08, roughness: .2, clearcoat: .7, clearcoatRoughness: .17 });
  const seal = new THREE.MeshStandardMaterial({ color: 0x102c24, metalness: .35, roughness: .32 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x607c76, metalness: .8, roughness: .24 });
  const deck = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true,
    emissive: green, emissiveIntensity: .28, metalness: .08, roughness: .22,
    clearcoat: .65, clearcoatRoughness: .15 });
  const led = new THREE.MeshBasicMaterial({ color: green, toneMapped: false });
  const surface = (name: string, profile: [number, number][], material: THREE.Material) => {
    const geometry = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), SEGMENTS);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.beaconSurface = true;
    group.add(mesh);
    return mesh;
  };
  // Closed profiles trace the underside outward, the outer wall upward, and
  // the top inward. Closely spaced bevel samples preserve the round silhouette.
  surface('rounded graphite foundation', [
    [0,0],[1.36,0],[1.42,.008],[1.465,.025],[1.49,.05],[1.5,.085],
    [1.5,.13],[1.49,.16],[1.47,.178],[1.46,.19],[1.46,.215],
    [1.48,.23],[1.49,.25],[1.49,.44],[1.485,.47],[1.47,.495],
    [1.44,.51],[0,.51],[0,0],
  ], shell);
  surface('lower machined reveal', [
    [1.455,.166],[1.476,.166],[1.484,.172],[1.484,.181],[1.476,.188],[1.455,.188],[1.455,.166],
  ], trim);
  surface('continuous green light seam', [
    [1.45,.19],[1.469,.19],[1.476,.196],[1.476,.208],[1.469,.215],[1.45,.215],[1.45,.19],
  ], led);
  surface('recess beneath the ceramic crown', [
    [0,.475],[1.46,.475],[1.515,.49],[1.545,.515],[1.55,.55],[1.54,.58],[0,.58],[0,.475],
  ], seal);
  surface('smooth white ceramic halo', [
    [1.245,.565],[1.54,.565],[1.566,.57],[1.589,.585],[1.607,.609],
    [1.616,.638],[1.616,.672],[1.61,.696],[1.596,.716],[1.576,.728],
    [1.55,TOP],[1.29,TOP],[1.27,.731],[1.254,.723],[1.244,.708],[1.24,.685],
    [1.24,.59],[1.245,.565],
  ], ceramic);
  surface('fine dark inner gasket', [
    [1.219,.68],[1.247,.68],[1.247,.72],[1.239,.728],[1.219,.728],[1.219,.68],
  ], seal);
  const disk = surface('flat luminous jade deck', [
    [0,.665],[1.18,.665],[1.209,.67],[1.225,.688],[1.23,.714],
    [1.224,.729],[1.21,TOP],[1.16,TOP],[.9,TOP],[.55,TOP],[0,TOP],[0,.665],
  ], deck);
  const positions = disk.geometry.getAttribute('position'), colors = [];
  const center = new THREE.Color(kind === 'arrival' ? 0x4aef68 : 0x68fa72), edge = new THREE.Color(0x13bd4b);
  for (let i=0;i<positions.count;i++) {
    const r = Math.hypot(positions.getX(i), positions.getZ(i));
    const c = center.clone().lerp(edge, Math.pow(Math.min(r/1.23,1), 2.2)*.68);
    colors.push(c.r,c.g,c.b);
  }
  disk.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));

  const plane = (name: string, radius: number, height: number, material: THREE.ShaderMaterial) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius*2,radius*2),material);
    mesh.rotation.x = -Math.PI/2; mesh.position.y = height; mesh.name = name;
    mesh.renderOrder = 2; group.add(mesh); return mesh;
  };
  // Analytic, feathered light works with bloom disabled and never needs a
  // canvas sprite. Depth testing keeps the spill behind the opaque platform.
  plane('soft green ground spill',2.12,.012,lightMaterial(`
    void main() {
      float r=length(local.xy);
      float halo=exp(-pow((r-1.48)/.27,2.0))*smoothstep(1.25,1.48,r);
      float pulse=0.93+0.07*sin(time*1.7);
      gl_FragColor=vec4(tint,halo*strength*pulse);
    }`,green,.24));
  plane('feathered white rim radiance',1.92,TOP+.009,lightMaterial(`
    void main() {
      float r=length(local.xy);
      float halo=exp(-pow((r-1.43)/.145,2.0));
      float core=exp(-pow((r-1.432)/.035,2.0));
      gl_FragColor=vec4(mix(tint,vec3(1.0),core),strength*(halo*.24+core*.16)*(0.96+0.04*sin(time*1.7)));
    }`,0xc4ffd4,.7));
  plane('slow inner light orbit',1.25,TOP+.006,lightMaterial(`
    void main() {
      float r=length(local.xy),a=atan(local.y,local.x);
      float ring=exp(-pow((r-1.175)/.009,2.0));
      float sweep=pow(max(0.0,cos(a-time*.38)),22.0);
      float glow=exp(-pow((r-1.175)/.04,2.0));
      gl_FragColor=vec4(tint,strength*(ring*(.14+.65*sweep)+glow*sweep*.12));
    }`,0xc9ffd1,kind==='arrival'?.6:.85));
  const veil = new THREE.Mesh(new THREE.CylinderGeometry(.87,1.19,.95,72,1,true),lightMaterial(`
    void main() {
      float h=clamp((local.y+.475)/.95,0.0,1.0);
      float falloff=pow(1.0-h,2.7)*smoothstep(0.0,.09,h);
      float flow=.92+.08*sin(time*1.7+h*4.0);
      gl_FragColor=vec4(tint,strength*falloff*flow);
    }`,green,kind==='arrival'?.035:.055));
  veil.name='faint rising beacon light';veil.position.y=TOP+.475;veil.renderOrder=1;group.add(veil);

  const moteGeometry = new THREE.BufferGeometry();
  const motePositions = [], phases = [];
  for (let i=0;i<10;i++) {
    const a=i*Math.PI*2/10;
    motePositions.push(Math.cos(a)*1.16,TOP,Math.sin(a)*1.16);phases.push(i/10);
  }
  moteGeometry.setAttribute('position',new THREE.Float32BufferAttribute(motePositions,3));
  moteGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));
  moteGeometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,TOP+.4,0),1.5);
  const motes = new THREE.Points(moteGeometry,new THREE.ShaderMaterial({
    uniforms:{time:{value:0},tint:{value:new THREE.Color(green)}},
    vertexShader:`attribute float phase; uniform float time; varying float fade;
      void main(){
        float p=fract(phase+time*.16),a=phase*6.283185+time*.12;
        vec3 pos=position+vec3(sin(a)*.035,p*.85,cos(a)*.035);
        fade=sin(p*3.141593);fade*=fade;
        vec4 view=modelViewMatrix*vec4(pos,1.0);
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(46.0/max(1.0,-view.z),1.0,7.0);
      }`,
    fragmentShader:`uniform vec3 tint; varying float fade;
      void main(){float r=length(gl_PointCoord-vec2(.5));
        float a=exp(-r*r*21.0)*smoothstep(.5,.27,r)*fade*.6;
        gl_FragColor=vec4(mix(tint,vec3(1.0),exp(-r*r*80.0)),a);}`,
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
  }));
  motes.name='quiet green light motes';motes.renderOrder=3;group.add(motes);
  group.traverse(object=>{
    object.userData.visualOnly=true;
    const renderable=object as THREE.Mesh;
    if (!renderable.geometry) return;
    renderable.geometry.userData.shared=true;
    for(const material of Array.isArray(renderable.material)?renderable.material:[renderable.material]) {
      material.userData.shared=true;material.userData.levelDepthFade=false;
    }
  });
  return group;
}

function releaseModel(root: THREE.Group): void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.geometry)return;
    geometries.add(mesh.geometry);
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
  });
  for(const geometry of geometries)geometry.dispose();
  for(const material of materials)material.dispose();
}
const models=new AssetCache<BeaconKind,THREE.Group>(async kind=>createBeaconArtwork(kind),releaseModel);

/** Original flat colliders retain all spawn, grind and finish ownership. */
export function attachBeaconPlatform(group: THREE.Group, solids: THREE.Mesh[], arrival: boolean): {ready:Promise<void>;update:(dt:number)=>void} {
  const kind:BeaconKind=arrival?'arrival':'finish',assets=models.scope();
  let disposed=false,elapsed=0;
  const animated=new Set<THREE.ShaderMaterial>();
  group.userData.beaconPlatform=kind;group.userData.beaconPlatformState='loading';
  const owner=solids[0].geometry;
  const dispose=(event:{type:string;graphicsReset?:boolean}):void=>{
    if(isGraphicsReset(event)||disposed)return;
    disposed=true;owner.removeEventListener('dispose',dispose);
    group.userData.beaconPlatformState='disposed';animated.clear();assets.dispose();
  };
  owner.addEventListener('dispose',dispose);
  const ready=assets.load(kind).then(template=>{
    if(disposed)return;
    const artwork=template.clone(true);
    artwork.traverse(object=>{
      object.userData.editorIdx=group.userData.editorIdx;
      const mesh=object as THREE.Mesh;
      if(mesh.material instanceof THREE.ShaderMaterial)animated.add(mesh.material);
    });
    group.add(artwork);
    for(const solid of solids)
      for(const material of Array.isArray(solid.material)?solid.material:[solid.material])material.visible=false;
    group.userData.beaconPlatformState='ready';
  });
  return {ready,update:(dt:number)=>{
    if(disposed||!Number.isFinite(dt))return;
    elapsed+=Math.max(0,Math.min(dt,.1));
    for(const material of animated)material.uniforms.time.value=elapsed;
  }};
}
