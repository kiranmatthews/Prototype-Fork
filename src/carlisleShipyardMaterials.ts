import * as THREE from 'three';

/** Shared metric paint, rather than stretched one-texture-per-platform UVs. */
export function harbourSurface(kind: 'wood' | 'steel' | 'wet', local = false) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  let seed = 78423;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  ctx.fillStyle = kind === 'wood' ? '#706c67' : kind === 'wet' ? '#57768e' : '#45586c';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let row = 0; row < 8; row++) {
    const y = row * 128;
    ctx.fillStyle = kind === 'wood' ? `hsl(${24+random()*8},${8+random()*7}%,${38+random()*15}%)` : `hsl(213,22%,${30+random()*10}%)`;
    ctx.fillRect(0, y+3, 1024, 121);
    ctx.fillStyle = '#182b3a'; ctx.fillRect(0,y,1024,3);
    ctx.fillStyle = '#8b969a'; ctx.fillRect(0,y+4,1024,1.5);
    for (let n=0;n<160;n++) {
      const x=random()*1024, yy=y+7+random()*110;
      ctx.strokeStyle=`rgba(${kind==='wood'?'24,23,22':'9,23,34'},${.03+random()*.16})`;
      ctx.lineWidth=.5+random()*2; ctx.beginPath();ctx.moveTo(x,yy);
      ctx.bezierCurveTo(x+20,yy-3,x+60,yy+2,x+25+random()*180,yy);ctx.stroke();
    }
    for(let x=45;x<1024;x+=256) {
      ctx.fillStyle='#1d2932';ctx.beginPath();ctx.arc(x,y+19,4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#b6bdc0';ctx.fillRect(x-2,y+16,3,1);
    }
    if(kind!=='wood') {
      ctx.fillStyle='#1b303f';ctx.fillRect((row%2)*512,y,3,128);
      ctx.strokeStyle='#9ba6ae';ctx.lineWidth=1;ctx.strokeRect((row%2)*512+5,y+7,504,111);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
  const mat=new THREE.MeshStandardMaterial({map:texture,roughness:kind==='wet'?.24:kind==='wood'?.86:.53,metalness:kind==='wood'?0:.35});
  mat.name=`Harbour ${kind}`;
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 harbourPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
      vec4 harbourVertex=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        harbourVertex=instanceMatrix*harbourVertex;
      #endif
      harbourPosition=${local?'harbourVertex.xyz':'(modelMatrix*harbourVertex).xyz'};
    `);
    shader.fragmentShader='varying vec3 harbourPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 hp=harbourPosition;
      vec3 hn=abs(cross(dFdx(hp),dFdy(hp)));
      vec2 huv=hn.y>max(hn.x,hn.z)?hp.xz:hn.x>hn.z?hp.zy:hp.xy;
      vec4 texelColor=texture2D(map,huv/${kind==='wood'?'vec2(7.5,2.8)':'vec2(12.0)'});
      diffuseColor *= texelColor;
    `);
  };
  mat.customProgramCacheKey=()=>`harbour-metric-${kind}-${local}`;
  return mat;
}

const noise=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.27+noise(p*4.01)*.12+noise(p*8.03)*.06;}
`;

export function harbourOcean(geometry: THREE.BufferGeometry) {
  const uniforms=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0},lamps:{value:Array.from({length:24},()=>new THREE.Vector3(1e6,0,1e6))}}]);
  const material=new THREE.ShaderMaterial({uniforms,fog:true,side:THREE.DoubleSide,
    vertexShader:`varying vec3 seaPoint;
      #include <fog_pars_vertex>
      void main(){seaPoint=(modelMatrix*vec4(position,1.)).xyz;vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader:`uniform float time;uniform vec3 lamps[24];varying vec3 seaPoint;
      #include <fog_pars_fragment>
      ${noise}
      float wave(vec2 p){return sin(p.x*.61+sin(p.y*.34+time*.7))* .55+sin(p.y*1.3+p.x*.21-time*1.3)*.25+sin(p.x*3.7+p.y*2.1+time*.85)*.07;}
      void main(){
        vec2 p=seaPoint.xz;float h=wave(p);float e=.13;
        vec3 n=normalize(vec3((h-wave(p+vec2(e,0)))/e,2.1,(h-wave(p+vec2(0,e)))/e));
        vec3 view=normalize(cameraPosition-seaPoint);float fres=pow(1.-max(dot(n,view),0.),3.);
        float ripple=fbm(p*.6+vec2(time*.06,0.));
        vec3 color=mix(vec3(.002,.008,.027),vec3(.012,.038,.10),.25+fres*.75+ripple*.25);
        float sky=pow(max(dot(reflect(-normalize(vec3(-.4,1.,-.2)),n),view),0.),55.);
        color+=vec3(.035,.09,.22)*sky*(.4+.6*fbm(p*.04));
        float foam=pow(smoothstep(.68,.91,ripple)*max(0.,h+.28),3.);
        color+=vec3(.045,.10,.17)*foam;
        for(int i=0;i<24;i++){
          vec2 delta=p-lamps[i].xz;float streak=exp(-abs(delta.x+sin(p.y*1.5+time)*.55)*.85)*exp(-abs(delta.y)*.065);
          float flicker=.25+.75*pow(max(0.,sin(p.y*4.+h*4.+time)),3.);
          color+=vec3(1.,.19,.025)*streak*flicker*.56;
        }
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Blue-hour tidal water';mesh.userData.visualOnly=true;
  return {mesh,uniforms};
}

export function harbourSky() {
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    vertexShader:'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 skyDirection;${noise}
      void main(){vec3 d=normalize(skyDirection);float y=max(d.y,0.);
        vec3 sky=mix(vec3(.075,.11,.22),vec3(.009,.019,.065),pow(y,.5));
        float sunset=exp(-pow((d.y-.018)*15.,2.))*pow(max(0.,dot(normalize(d.xz),normalize(vec2(-.5,-1.)))),3.);
        sky=mix(sky,vec3(.36,.095,.07),sunset*.65);
        float clouds=fbm(d.xz/(max(d.y,.05)+.2)*3.);
        sky=mix(sky,vec3(.018,.035,.088),smoothstep(.46,.66,clouds)*smoothstep(0.,.12,d.y)*.7);
        gl_FragColor=vec4(sky,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(4500,40,20),material);mesh.name='Outer Banks blue hour';mesh.renderOrder=-10;
  return mesh;
}
