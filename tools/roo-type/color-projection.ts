// Authoring only. A generated RGB image is an unchanged color texture; the
// source Roo mesh owns the silhouette, holes, bearings and transparent alpha.
import * as THREE from 'three';
import { rooGlyphGeometry, type RooVectorGlyph } from '../../src/roo-type/geometry';
import { modelFrontTexture, PALETTE_GLSL } from './palette-profile';

export interface ColorLayer { image: HTMLImageElement; colorBounds: [number,number,number,number] }

function modelTexture(layer:ColorLayer){
  const canvas=document.createElement('canvas');canvas.width=layer.image.width;canvas.height=layer.image.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(layer.image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),d=pixels.data,w=canvas.width,h=canvas.height;
  const nearest=new Int32Array(w*h),queue=new Int32Array(w*h);nearest.fill(-1);let end=0;
  const [left,top,width,height]=layer.colorBounds;
  for(let y=Math.max(0,top);y<Math.min(h,top+height);y++)for(let x=Math.max(0,left);x<Math.min(w,left+width);x++){
    const p=y*w+x,q=p*4,r=d[q],g=d[q+1],b=d[q+2];
    if(Math.max(r,g,b)<64||(r>40&&b>65&&g<Math.min(r,b)*.85))continue;
    nearest[p]=p;queue[end++]=p;
  }
  if(!end)throw new Error('Model color texture has no valid foreground');
  // Pad the entire material field once. A bounded shader search left magenta
  // seams wherever the model contour differed from Roo by more than 24 pixels.
  for(let head=0;head<end;head++){
    const p=queue[head],x=p%w,y=Math.floor(p/w);
    for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&nearest[q]<0){nearest[q]=nearest[p];queue[end++]=q;}
  }
  const original=new Uint8ClampedArray(d);
  for(let p=0;p<w*h;p++){const q=nearest[p]*4;d[p*4]=original[q];d[p*4+1]=original[q+1];d[p*4+2]=original[q+2];d[p*4+3]=255;}
  ctx.putImageData(pixels,0,0);
  const smooth=document.createElement('canvas');smooth.width=w;smooth.height=h;
  const s=smooth.getContext('2d')!;s.filter='blur(3px)';s.drawImage(canvas,0,0);
  const blurred=s.getImageData(0,0,w,h).data;
  for(let p=0;p<w*h;p++)if(nearest[p]!==p)for(let k=0;k<3;k++)d[p*4+k]=blurred[p*4+k];
  ctx.putImageData(pixels,0,0);
  return new THREE.CanvasTexture(canvas);
}

// Reference crops can contain blue scenery in/around holes. A connected
// foreground mask keeps that scenery out of the material without discarding
// the genuine near-white specular pixels connected to the colored letter.
function referenceTexture(image:HTMLImageElement,cleaned=false){
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=pixels.data,w=canvas.width,h=canvas.height,eligible=new Uint8Array(w*h),seen=new Uint8Array(w*h);
  for(let i=0;i<eligible.length;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2],mx=Math.max(r,g,b),chroma=mx-Math.min(r,g,b);eligible[i]=data[i*4+3]>16&&mx>68&&(cleaned?chroma>Math.max(32,mx*.2):chroma>26||mx>180)?1:0;}
  // Close one-pixel gaps so a bright rim separated by a dark crease stays
  // attached to its letter, while distant scenery remains a separate island.
  const dilated=new Uint8Array(w*h),closed=new Uint8Array(w*h);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(eligible[(y+dy)*w+x+dx])dilated[y*w+x]=1;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let solid=1;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)solid&=dilated[(y+dy)*w+x+dx];closed[y*w+x]=solid;}
  let largest:number[]=[];
  for(let i=0;i<eligible.length;i++){
    if(!closed[i]||seen[i])continue;
    const stack=[i],component:number[]=[];seen[i]=1;
    while(stack.length){const p=stack.pop()!,x=p%w,y=Math.floor(p/w);component.push(p);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,q=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&closed[q]&&!seen[q]){seen[q]=1;stack.push(q);}}
    }
    if(component.length>largest.length)largest=component;
  }
  // Pad the color texture, not the silhouette. Alpha is supplied by Roo's
  // geometry. Opaque edge colors also avoid dark interpolation with zero-RGB
  // transparent pixels, which produced a visible dotted seam at large sizes.
  const nearest=new Int32Array(w*h);nearest.fill(-1);const queue:number[]=[],foreground=new Uint8Array(w*h),seeds=new Uint8Array(w*h);
  for(const i of largest)foreground[i]=1;
  for(const i of largest){
    const x=i%w,y=Math.floor(i/w),mx=Math.max(data[i*4],data[i*4+1],data[i*4+2]);
    const interior=x>0&&x<w-1&&y>0&&y<h-1&&foreground[i-1]&&foreground[i+1]&&foreground[i-w]&&foreground[i+w];
    if(!eligible[i])continue;
    if(cleaned&&(mx-Math.min(data[i*4],data[i*4+1],data[i*4+2]))/Math.max(1,mx)<.45)continue;
    let cleanInterior=interior;
    if(cleaned){
      cleanInterior=x>=3&&x<w-3&&y>=3&&y<h-3;
      if(cleanInterior)for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++)if(!foreground[(y+dy)*w+x+dx])cleanInterior=false;
    }
    // Dim boundary pixels contain the old black matte. Interior shadow colors
    // and genuinely bright edge glints remain authoritative reference samples.
    if(cleaned?cleanInterior:interior||mx>180){nearest[i]=i;seeds[i]=1;queue.push(i);}
  }
  if(!queue.length)for(const i of largest)if(eligible[i]){nearest[i]=i;seeds[i]=1;queue.push(i);}
  for(let head=0;head<queue.length;head++){const p=queue[head],x=p%w,y=Math.floor(p/w);
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,q=yy*w+xx;if(xx>=0&&xx<w&&yy>=0&&yy<h&&nearest[q]===-1){nearest[q]=nearest[p];queue.push(q);}}
  }
  const original=new Uint8ClampedArray(data);
  for(let i=0;i<nearest.length;i++){const p=nearest[i]>=0?nearest[i]:i;data[i*4]=original[p*4];data[i*4+1]=original[p*4+1];data[i*4+2]=original[p*4+2];data[i*4+3]=255;}
  const padded=new Uint8ClampedArray(data);
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(!seeds[y*w+x]){
    for(let channel=0;channel<3;channel++){
      let sum=0,weight=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const k=(dx===0?2:1)*(dy===0?2:1);sum+=padded[((y+dy)*w+x+dx)*4+channel]*k;weight+=k;}
      data[(y*w+x)*4+channel]=Math.round(sum/weight);
    }
  }
  ctx.putImageData(pixels,0,0);return new THREE.CanvasTexture(canvas);
}
export class RooColorProjector {
  readonly renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
  readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100);
  readonly scene=new THREE.Scene();
  private modelTextures=new Map<HTMLImageElement,THREE.Texture>();
  private referenceTextures=new Map<HTMLImageElement,THREE.Texture>();
  private profiles=new Map<HTMLImageElement,THREE.Texture>();
  private geometries=new Map<RooVectorGlyph,THREE.BufferGeometry>();
  constructor(){this.renderer.setClearColor(0,0);this.renderer.setPixelRatio(1);this.camera.position.z=10;}

  render(glyph:RooVectorGlyph,layer:ColorLayer,capPixels=512,widthScale=1.06,edgePadding=true,reference?:ColorLayer,palette?:{source:'bonus'|'counter';target:'bonus'|'counter'},vertical={scale:1,offset:0},keyShift=0){
    if(!this.geometries.has(glyph))this.geometries.set(glyph,rooGlyphGeometry(glyph));
    const geometry=this.geometries.get(glyph)!;
    if(!this.modelTextures.has(layer.image))this.modelTextures.set(layer.image,modelTexture(layer));
    const texture=this.modelTextures.get(layer.image)!;texture.needsUpdate=true;
    texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
    const [x,y,w,h]=layer.colorBounds,b=glyph.bounds;
    if(reference&&!this.referenceTextures.has(reference.image))this.referenceTextures.set(reference.image,referenceTexture(reference.image,reference.image===layer.image));
    const refTexture=reference?this.referenceTextures.get(reference.image)!:texture;refTexture.needsUpdate=true;refTexture.colorSpace=THREE.NoColorSpace;refTexture.generateMipmaps=false;refTexture.minFilter=THREE.LinearFilter;
    const [rx,ry,rw,rh]=reference?.colorBounds??layer.colorBounds,ri=reference?.image??layer.image;
    if(!this.profiles.has(layer.image))this.profiles.set(layer.image,modelFrontTexture(layer,glyph));
    const modelProfile=this.profiles.get(layer.image)!;
    const material=new THREE.ShaderMaterial({
      toneMapped:false,uniforms:{uImage:{value:texture},uRect:{value:new THREE.Vector4(x/layer.image.width,1-(y+h)/layer.image.height,w/layer.image.width,h/layer.image.height)},uBounds:{value:new THREE.Vector4(b[0],b[1],b[2]-b[0],b[3]-b[1])},uTexel:{value:new THREE.Vector2(1/layer.image.width,1/layer.image.height)},uPad:{value:edgePadding?1:0},uReference:{value:refTexture},uRefRect:{value:new THREE.Vector4(rx/ri.width,1-(ry+rh)/ri.height,rw/ri.width,rh/ri.height)},uRefTexel:{value:new THREE.Vector2(1/ri.width,1/ri.height)},uRefInk:{value:new THREE.Vector2(rw,rh)},uMatchReference:{value:reference?1:0}},
      vertexShader:`varying vec2 vGlyph;varying float vDepth;varying vec3 vNormal;void main(){vNormal=normalize(normalMatrix*normal);vGlyph=position.xy+vec2(0.,.5);vDepth=position.z;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`
        uniform sampler2D uImage;uniform vec4 uRect;uniform vec4 uBounds;uniform vec2 uTexel;uniform float uPad;varying vec2 vGlyph;varying float vDepth;
        uniform sampler2D uReference;uniform vec4 uRefRect;uniform vec2 uRefTexel;uniform vec2 uRefInk;uniform float uMatchReference;
        uniform sampler2D uModelProfile;uniform float uPaletteEnabled;uniform float uSourceBonus;uniform float uTargetBonus;
        uniform float uKeyShift;uniform float uModelDetail;varying vec3 vNormal;
        ${PALETTE_GLSL}
        bool matte(vec3 c){return (c.r>.05&&c.b>.2&&c.g<min(c.r,c.b)*.9)||max(c.r,max(c.g,c.b))<.22;}
        vec3 modelColor(vec2 uv){
          vec3 c=texture2D(uImage,uv).rgb;
          if(uPad>.5&&matte(c)){
            bool found=false;
            // Texture-edge padding stays on the mesh. Never paint outside Roo
            // or pretend the model generated alpha. Visible pink means failure.
            for(int radius=1;radius<=24;radius++){
              for(int dir=0;dir<16;dir++){
                float a=float(dir)*6.28318530718/16.;
                vec3 sampleColor=texture2D(uImage,uv+vec2(cos(a),sin(a))*float(radius)*uTexel).rgb;
                if(!found&&!matte(sampleColor)){c=sampleColor;found=true;}
              }
              if(found)break;
            }
          }
          return c;
        }
        vec3 referenceColor(vec2 uv){
          vec4 initial=texture2D(uReference,uv);vec3 c=initial.rgb;
          if(initial.a<.5){
            bool found=false;
            for(int radius=1;radius<=5;radius++){
              for(int dir=0;dir<16;dir++){
                float a=float(dir)*6.28318530718/16.;
                vec4 s=texture2D(uReference,uv+vec2(cos(a),sin(a))*float(radius)*uRefTexel);
                if(!found&&s.a>.5){c=s.rgb;found=true;}
              }
              if(found)break;
            }
          }
          return c;
        }
        void main(){
          vec2 glyphUV=(vGlyph-uBounds.xy)/uBounds.zw;
          vec2 uv=uRect.xy+glyphUV*uRect.zw;
          vec3 c=modelColor(uv);
          if(uMatchReference>.5){
            vec2 stepUV=uRect.zw/uRefInk;
            vec3 low=vec3(0.);float total=0.;float validDetail=matte(c)?0.:1.;
            for(int iy=-1;iy<=1;iy++)for(int ix=-1;ix<=1;ix++){
              float weight=(ix==0?2.:1.)*(iy==0?2.:1.);
              vec3 sampleColor=modelColor(uv+vec2(float(ix),float(iy))*stepUV);
              if(matte(sampleColor))validDetail=0.;
              low+=sampleColor*weight;total+=weight;
            }
            // The reference owns the material's visible lighting/color. The
            // model contributes detail above the source image's pixel scale.
            float faceDetail=smoothstep(.018,.026,vDepth);
            c=referenceColor(uRefRect.xy+glyphUV*uRefRect.zw)+(c-low/total)*uModelDetail*validDetail*faceDetail;
          }
          if(uPaletteEnabled>.5){
            vec3 modelBase=texture2D(uModelProfile,vec2(clamp(vGlyph.y,0.,1.),.5)).rgb;
            if(uMatchReference<.5){
              if(matte(c))c=modelBase;
              c=normalizeFront(c,modelBase,vGlyph.y,uTargetBonus);
            }
            else if(abs(uSourceBonus-uTargetBonus)>.5)c=alternatePalette(c,vGlyph.y,uSourceBonus,uTargetBonus);
          }
          // Three baked light positions share the exact camera, geometry and
          // alpha. Only the bevel's illumination changes; the face gradient
          // stays put during a crossfade.
          vec3 n=normalize(vNormal);
          float edge=smoothstep(.08,.6,length(n.xy));
          float neutral=max(0.,dot(n,normalize(vec3(-.35,.85,1.))));
          if(uMatchReference<.5||abs(uSourceBonus-uTargetBonus)>.5)c=mix(c,highlightColor(vGlyph.y,uTargetBonus),pow(neutral,4.)*edge*.18);
          float shifted=max(0.,dot(n,normalize(vec3(-.35+uKeyShift,.85,1.))));
          float lightDelta=(shifted-neutral)*edge;
          c=mix(c,highlightColor(vGlyph.y,uTargetBonus),max(0.,lightDelta)*.48);
          c*=1.+min(0.,lightDelta)*.32;
          gl_FragColor=vec4(c,1.);
        }
      `,
    });
    Object.assign(material.uniforms,{uModelProfile:{value:modelProfile},uPaletteEnabled:{value:palette?1:0},uSourceBonus:{value:palette?.source==='bonus'?1:0},uTargetBonus:{value:palette?.target==='bonus'?1:0},uKeyShift:{value:keyShift},uModelDetail:{value:reference?.image===layer.image?0:.5}});
    const mesh=new THREE.Mesh(geometry,material);mesh.scale.set(widthScale,vertical.scale,1);mesh.position.y=vertical.offset+(vertical.scale-1)*.5;this.scene.add(mesh);
    // Supply opaque padded color beneath the bevel mesh. The final silhouette
    // is clipped by Roo's original analytic curves, so triangulation cannot
    // nibble away narrow punctuation or introduce tiny holes at sharp tips.
    const underlayGeometry=new THREE.PlaneGeometry(b[2]-b[0]+.2,b[3]-b[1]+.2);
    underlayGeometry.translate((b[0]+b[2])/2,(b[1]+b[3])/2-.5,-.06);
    const underlay=new THREE.Mesh(underlayGeometry,material);underlay.scale.copy(mesh.scale);underlay.position.copy(mesh.position);this.scene.add(underlay);
    const margin=5/capPixels;
    this.camera.left=b[0]*widthScale-margin;this.camera.right=b[2]*widthScale+margin;
    const top=b[3]*vertical.scale+vertical.offset,bottom=b[1]*vertical.scale+vertical.offset;
    this.camera.top=top-.5+margin;this.camera.bottom=bottom-.5-margin;this.camera.updateProjectionMatrix();
    const width=Math.ceil((this.camera.right-this.camera.left)*capPixels),height=Math.ceil((this.camera.top-this.camera.bottom)*capPixels);
    // Keep exactly capPixels per world unit. Rounding only the image size
    // stretched narrow punctuation by a fraction of a pixel per glyph.
    this.camera.right=this.camera.left+width/capPixels;
    this.camera.bottom=this.camera.top-height/capPixels;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width*2,height*2,false);this.renderer.render(this.scene,this.camera);
    const clipped=document.createElement('canvas');clipped.width=width*2;clipped.height=height*2;
    const clip=clipped.getContext('2d')!,path=new Path2D();
    for(const c of glyph.commands){
      if(c.type==='M')path.moveTo(c.x!,c.y!);
      else if(c.type==='L')path.lineTo(c.x!,c.y!);
      else if(c.type==='Q')path.quadraticCurveTo(c.x1!,c.y1!,c.x!,c.y!);
      else if(c.type==='C')path.bezierCurveTo(c.x1!,c.y1!,c.x2!,c.y2!,c.x!,c.y!);
      else if(c.type==='Z')path.closePath();
    }
    clip.setTransform(widthScale*capPixels*2,0,0,-vertical.scale*capPixels*2,-this.camera.left*capPixels*2,(this.camera.top+.5-vertical.offset)*capPixels*2);
    clip.clip(path);clip.setTransform(1,0,0,1,0,0);clip.drawImage(this.renderer.domElement,0,0);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(clipped,0,0,width,height);clipped.width=clipped.height=1;
    this.scene.remove(mesh,underlay);material.dispose();underlayGeometry.dispose();
    const ink={x:width*margin/(this.camera.right-this.camera.left),y:height*margin/(this.camera.top-this.camera.bottom),
      width:width*(b[2]-b[0])*widthScale/(this.camera.right-this.camera.left),height:height*(top-bottom)/(this.camera.top-this.camera.bottom)};
    return{canvas,left:this.camera.left,top:.5-this.camera.top,capPixels,widthScale,advance:glyph.advance*widthScale,ink,inkTop:1-top,inkBottom:1-bottom};
  }
  dispose(){for(const map of [this.modelTextures,this.referenceTextures,this.profiles])for(const texture of map.values())texture.dispose();for(const g of this.geometries.values())g.dispose();this.renderer.dispose();}
}
