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

/** One angular sky for the backdrop and the rough water's reflection. Colours
 * are linear; the horizon is finally blended into the authored fog colour. */
const atmosphere=`
vec3 harbourSkyRadiance(vec3 d,float time,float stars){
  float y=max(d.y,0.);
  vec3 sky=mix(vec3(.035,.066,.132),vec3(.0025,.007,.025),pow(y,.46));
  vec2 azimuth=d.xz/max(length(d.xz),.0001);
  float west=pow(max(dot(azimuth,normalize(vec2(-.7,-.72))),0.),3.);
  float afterglow=exp(-pow((d.y-.075)*7.5,2.))*west;
  sky=mix(sky,vec3(.235,.061,.031),afterglow*.58);
  // Sparse, filtered points stay steady when the native and CRT views move.
  // Keep derivatives outside any horizon-dependent branch: adjacent pixels
  // above/below the horizon must evaluate the same finite coordinate field.
  if(stars>.5){
    vec2 p=d.xz/(max(d.y,0.)+.36)*145.,cell=floor(p),f=fract(p)-.5;
    float seed=hash(cell),radius=.07+.08*hash(cell+51.);
    vec2 center=(vec2(hash(cell+4.),hash(cell+19.))-.5)*.65;
    float footprint=max(length(dFdx(p)),length(dFdy(p)));
    float point=exp(-dot(f-center,f-center)/max(radius*radius+footprint*footprint*.5,.0001));
    sky+=vec3(.14,.21,.32)*point*step(.9988,seed)*smoothstep(.14,.55,d.y)*radius*radius/(radius*radius+footprint*footprint*.5);
  }
  vec3 moonDirection=normalize(vec3(.34,.51,-.79));
  float moonDistance=length(d-moonDirection);
  float moon=1.-smoothstep(.008,.010,moonDistance);
  float lunarShade=.78+.22*noise(d.xz*900.);
  sky+=vec3(.32,.41,.56)*(moon*lunarShade+exp(-moonDistance*moonDistance*1700.)*.014);

  // Two unequal, slowly drifting layers: broad low cloud banks and high wisps.
  // Planar angular coordinates are continuous around the horizon and zenith.
  vec2 p=d.xz/(max(d.y,.045)+.24),wind=vec2(time*.0022,time*.0007);
  vec2 warped=p+vec2(noise(p*.63),noise(p.yx*.71+8.))*.5;
  float low=fbm(warped*vec2(1.65,4.8)+wind);
  float high=fbm(warped*vec2(4.3,1.7)-wind*.38+31.);
  float altitude=smoothstep(.015,.12,d.y);
  float lowCover=smoothstep(.46,.68,low)*altitude*(1.-smoothstep(.68,.97,d.y))*.90;
  float highCover=smoothstep(.53,.75,high)*altitude*.32;
  float rim=1.-smoothstep(.48,.65,low);
  vec3 cloud=mix(vec3(.008,.017,.038),vec3(.032,.054,.094),rim);
  cloud+=vec3(.10,.028,.012)*afterglow*(.35+rim*.65);
  sky=mix(sky,vec3(.043,.062,.105),highCover);
  sky=mix(sky,cloud,lowCover);
  return sky;
}
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
      ${atmosphere}
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
        // Rough water averages tiny stars, but shares the actual clouds,
        // copper afterglow and moon direction with the visible backdrop.
        vec3 sky=harbourSkyRadiance(reflected,time,0.);
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
  const cameraWorld={value:new THREE.Matrix4()};
  const material=new THREE.ShaderMaterial({depthWrite:false,fog:true,
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0}}]),
    vertexShader:`uniform mat4 harbourCameraWorld;varying vec3 skyDirection;
      #include <fog_pars_vertex>
      void main(){
        // Reconstruct from this pass's camera. A 4.5km dome was clipped by the
        // authored 850m draw distance; backdrop depth must not change that lens.
        // X/Y terms also retain off-centre and oblique reflection projections.
        vec3 ray=isOrthographic?vec3(0.,0.,-1.):vec3(
          (position.x+projectionMatrix[2][0])/projectionMatrix[0][0],
          (position.y+projectionMatrix[2][1])/projectionMatrix[1][1],-1.);
        skyDirection=mat3(harbourCameraWorld)*ray;
        gl_Position=vec4(position.xy,1.,1.);
        #ifdef USE_FOG
          vFogDepth=0.;
        #endif
      }`,
    fragmentShader:`varying vec3 skyDirection;uniform float time;
      #include <fog_pars_fragment>
      ${noise}${atmosphere}
      void main(){vec3 d=normalize(skyDirection);
        gl_FragColor=vec4(harbourSkyRadiance(d,time,1.),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #ifdef USE_FOG
          // Match the same output-space fog uniform used by distant scenery.
          gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,1.-smoothstep(-.035,.085,d.y));
        #endif
      }`});
  material.uniforms.harbourCameraWorld=cameraWorld;material.name='Carlisle drifting blue-hour sky';
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);mesh.name='Outer Banks blue hour';mesh.renderOrder=-100;
  mesh.frustumCulled=false;mesh.userData.visualOnly=true;mesh.userData.oceanOpaqueBackdrop=true;
  mesh.onBeforeRender=(_renderer,_scene,camera)=>{cameraWorld.value.copy(camera.matrixWorld);material.uniformsNeedUpdate=true;};
  return mesh;
}
