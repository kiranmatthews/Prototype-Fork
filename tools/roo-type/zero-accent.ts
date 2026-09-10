import * as THREE from 'three';
import { rooGlyphGeometry, type RooVectorGlyph } from '../../src/roo-type/geometry';
import { PALETTE_GLSL } from './palette-profile';
import type { RooColorProjector } from './color-projection';

/** A short rising stroke from the inner left wall, stopping before the right.
 * Authored in the existing zero's Roo coordinates; it does not change metrics.
 */
export const ZERO_INNER_ACCENT = {
  kind:'rising-inner-stroke',
  commands:[
    {type:'M',x:.184,y:.404},
    {type:'C',x1:.232,y1:.488,x2:.286,y2:.565,x:.410,y:.594},
    {type:'C',x1:.339,y1:.612,x2:.274,y2:.589,x:.230,y:.541},
    {type:'C',x1:.204,y1:.514,x2:.191,y2:.499,x:.181,y:.480},
    {type:'Z'},
  ] satisfies RooVectorGlyph['commands'],
};

type RenderedGlyph=ReturnType<RooColorProjector['render']>;

/** Sample the zero's existing left face, so the new stroke inherits its color. */
function zeroFaceProfile(neutral:RenderedGlyph,vertical:{scale:number;offset:number}){
  const c=neutral.canvas,pixels=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  const rows=new Float32Array(256*4);
  for(let i=0;i<256;i++){
    const h=i/255,py=Math.round((1-h*vertical.scale-vertical.offset-neutral.top)*neutral.capPixels);let count=0;
    for(const gx of [.165,.18,.195])for(let dy=-1;dy<=1;dy++){
      const x=Math.round((gx*neutral.widthScale-neutral.left)*neutral.capPixels),y=py+dy;
      if(x<0||x>=c.width||y<0||y>=c.height)continue;
      const p=(y*c.width+x)*4;if(pixels[p+3]<240)continue;
      for(let k=0;k<3;k++)rows[i*4+k]+=pixels[p+k]/255;count++;
    }
    for(let k=0;k<3;k++)rows[i*4+k]=count?rows[i*4+k]/count:(i?rows[(i-1)*4+k]:.5);
    rows[i*4+3]=1;
  }
  const smooth=new Float32Array(rows);
  for(let i=0;i<256;i++)for(let k=0;k<3;k++){
    let sum=0,weight=0;for(let d=-4;d<=4;d++){const w=Math.exp(-d*d/8);sum+=rows[Math.max(0,Math.min(255,i+d))*4+k]*w;weight+=w;}
    smooth[i*4+k]=sum/weight;
  }
  const texture=new THREE.DataTexture(smooth,256,1,THREE.RGBAFormat,THREE.FloatType);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;return texture;
}

export function addZeroInnerAccent(projector:RooColorProjector,zero:RooVectorGlyph,
  rendered:RenderedGlyph,neutral:RenderedGlyph,palette:'bonus'|'counter',
  vertical:{scale:number;offset:number},keyShift:number){
  const glyph:RooVectorGlyph={...zero,commands:ZERO_INNER_ACCENT.commands};
  const geometry=rooGlyphGeometry(glyph,.0075),profile=zeroFaceProfile(neutral,vertical);
  const material=new THREE.ShaderMaterial({toneMapped:false,uniforms:{uProfile:{value:profile},uBonus:{value:palette==='bonus'?1:0},uKeyShift:{value:keyShift}},
    vertexShader:`varying vec3 vNormal;varying float vHeight;void main(){vNormal=normalize(normalMatrix*normal);vHeight=position.y+.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform sampler2D uProfile;uniform float uBonus;uniform float uKeyShift;varying vec3 vNormal;varying float vHeight;
      ${PALETTE_GLSL}
      void main(){vec3 n=normalize(vNormal),base=texture2D(uProfile,vec2(clamp(vHeight,0.,1.),.5)).rgb;
        float edge=smoothstep(.08,.6,length(n.xy)),neutral=max(0.,dot(n,normalize(vec3(-.35,.85,1.))));
        vec3 high=highlightColor(vHeight,uBonus);
        vec3 c=mix(base*(1.-.25*edge*(1.-neutral)),high,pow(neutral,3.)*edge*.42);
        float delta=(max(0.,dot(n,normalize(vec3(-.35+uKeyShift,.85,1.))))-neutral)*edge;
        c=mix(c,high,max(0.,delta)*.48);c*=1.+min(0.,delta)*.32;gl_FragColor=vec4(c,1.);
      }`,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(rendered.widthScale,vertical.scale,.3);mesh.position.y=vertical.offset+(vertical.scale-1)*.5;
  const underlayGeometry=new THREE.PlaneGeometry(1.2,1.4);underlayGeometry.translate(.35,0,-.12);
  const underlay=new THREE.Mesh(underlayGeometry,material);underlay.scale.copy(mesh.scale);underlay.position.copy(mesh.position);
  projector.scene.add(mesh,underlay);
  const {width,height}=rendered.canvas,cap=rendered.capPixels;
  projector.renderer.setSize(width*2,height*2,false);projector.renderer.render(projector.scene,projector.camera);
  const high=document.createElement('canvas');high.width=width*2;high.height=height*2;
  const ctx=high.getContext('2d')!,path=new Path2D();
  for(const c of ZERO_INNER_ACCENT.commands){
    if(c.type==='M')path.moveTo(c.x!,c.y!);
    else if(c.type==='C')path.bezierCurveTo(c.x1!,c.y1!,c.x2!,c.y2!,c.x!,c.y!);
    else if(c.type==='Z')path.closePath();
  }
  ctx.setTransform(rendered.widthScale*cap*2,0,0,-vertical.scale*cap*2,-rendered.left*cap*2,(1-vertical.offset-rendered.top)*cap*2);
  ctx.clip(path);ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(projector.renderer.domElement,0,0);
  const target=rendered.canvas.getContext('2d')!;target.save();target.globalCompositeOperation='destination-over';target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';target.drawImage(high,0,0,width,height);target.restore();
  high.width=high.height=1;projector.scene.remove(mesh,underlay);geometry.dispose();underlayGeometry.dispose();material.dispose();profile.dispose();
}
