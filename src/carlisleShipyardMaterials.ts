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

/** Visual water only: the authored reset-water mesh stays at its exact height. */
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
      vec3 waterNoise(vec2 p){
        vec2 cell=floor(p),f=fract(p),u=f*f*(3.-2.*f),du=6.*f*(1.-f);
        float a=hash(cell),b=hash(cell+vec2(1,0)),c=hash(cell+vec2(0,1)),d=hash(cell+vec2(1,1));
        float crossTerm=a-b-c+d;
        return vec3(du*vec2(b-a+crossTerm*u.y,c-a+crossTerm*u.x),a+(b-a)*u.x+(c-a)*u.y+crossTerm*u.x*u.y);
      }
      // Incommensurate directions and warped phase break up the old ruled stripes.
      // Pixel-footprint filtering suppresses subpixel shimmer, without mesh swaps.
      vec3 swell(vec2 p,vec2 d,float k,float speed,float amplitude,float phase,vec2 warp,float footprint){
        float resolved=1.-smoothstep(.35,2.4,k*footprint);
        float angle=dot(p,d)*k-time*speed+phase+dot(warp,d)*k;
        return vec3(d*cos(angle)*amplitude*k,sin(angle)*amplitude)*resolved;
      }
      void main(){
        vec2 p=seaPoint.xz;
        float footprint=max(length(dFdx(p)),length(dFdy(p)));
        vec2 tide=vec2(time*.045,-time*.028);
        vec2 warp=vec2(fbm(p*.018+tide*.1),fbm(p.yx*.023+17.-tide*.13))*13.;
        vec3 waves=swell(p,vec2(.93,.37),.24,.49,.38,.2,warp,footprint)
          +swell(p,vec2(-.34,.94),.43,.63,.19,2.7,warp*.83,footprint);
        mat2 wind=mat2(.8,-.6,.6,.8),crossWind=mat2(.34,.94,-.94,.34);
        vec2 slope=waves.xy*.32;
        slope+=waterNoise(p*.15+warp*.11-tide*.3).xy*.14*(1.-smoothstep(.35,2.4,footprint*.15));
        slope+=(waterNoise(wind*p*.41+warp*.17+tide*.7).xy*wind)*.10*(1.-smoothstep(.35,2.4,footprint*.41));
        slope+=(waterNoise(crossWind*p*1.19+warp*.2-tide*1.3).xy*crossWind)*.046*(1.-smoothstep(.35,2.4,footprint*1.19));
        slope+=waterNoise(p*3.1+warp*.24+tide*1.7).xy*.021*(1.-smoothstep(.35,2.4,footprint*3.1));
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y));
        vec3 view=normalize(cameraPosition-seaPoint),reflected=reflect(-view,n);
        float fres=.025+.975*pow(1.-max(dot(n,view),0.),5.);
        float current=fbm(p*.031+tide*.19);
        vec3 depth=mix(vec3(.002,.008,.025),vec3(.004,.017,.043),current);
        vec3 sky=mix(vec3(.041,.075,.16),vec3(.006,.022,.066),sqrt(max(reflected.y,0.)));
        float cloud=fbm(reflected.xz/(max(reflected.y,.08)+.3)*4.);
        sky*=.76+cloud*.32;
        vec3 color=mix(depth,sky,.22+fres*.68);
        // Broad cool sky glints sit beneath the warm, view-dependent lantern paths.
        vec3 skyHalf=normalize(view+normalize(vec3(-.42,.78,-.46)));
        float glint=pow(max(dot(n,skyHalf),0.),85.);
        color+=vec3(.018,.046,.09)*glint*(.3+.7*current);
        for(int i=0;i<24;i++){
          vec3 toLamp=lamps[i]-seaPoint;float distance2=dot(toLamp.xz,toLamp.xz);
          if(distance2<22500.){
            vec3 light=normalize(vec3(toLamp.x,clamp(toLamp.y,1.8,32.),toLamp.z));
            float halfDot=max(dot(n,normalize(view+light)),0.);
            float spec=pow(halfDot,180.)+pow(halfDot,24.)*.025;
            float attenuation=1./(1.+distance2*.012);
            color+=vec3(1.,.19,.028)*spec*attenuation*.7;
          }
        }
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  material.name='Irregular blue-hour tidal water';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Blue-hour tidal water';mesh.userData.visualOnly=true;
  return {mesh,uniforms};
}

/** Broken, spreading wash on the waterline; no solid torus or collision. */
export function harbourContactFoam() {
  const material=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),
    transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,
    vertexShader:`varying vec2 washPoint;varying vec2 washOrigin;
      #include <fog_pars_vertex>
      void main(){
        washPoint=position.xz*2.;vec4 p=vec4(position,1.);vec4 origin=vec4(0.,0.,0.,1.);
        #ifdef USE_INSTANCING
          p=instanceMatrix*p;origin=instanceMatrix*origin;
          washOrigin=(modelMatrix*origin).xz;
        #else
          // A moving hull's phase travels with it, rather than reseeding each frame.
          washOrigin=vec2(5.1,12.3);
        #endif
        vec4 mvPosition=modelViewMatrix*p;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform float time;varying vec2 washPoint;varying vec2 washOrigin;
      #include <fog_pars_fragment>
      ${noise}
      void main(){
        float seed=hash(washOrigin*.13),angle=atan(washPoint.y,washPoint.x);
        float irregular=noise(washPoint*4.1+seed*37.+time*vec2(.09,-.06));
        float radius=length(washPoint)+.09*(irregular-.5);
        float pulse=0.;
        for(int i=0;i<2;i++){
          float age=fract(time*.19+seed+float(i)*.5);
          float ring=exp(-pow((radius-(.39+age*.55))/.055,2.));
          pulse+=ring*sin(age*3.14159);
        }
        float edge=exp(-pow((radius-.42)/.12,2.))*.36;
        float flecks=smoothstep(.28,.74,fbm(washPoint*13.+seed*19.+vec2(time*.12,0.)));
        float broken=.22+.78*smoothstep(.25,.7,noise(vec2(angle*2.4+seed*13.,time*.12)));
        float alpha=(pulse*.26+edge)*flecks*broken*(1.-smoothstep(.89,1.,radius));
        gl_FragColor=vec4(vec3(.19,.34,.41),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  material.name='Tidal waterline foam';return material;
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
