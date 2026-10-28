// Published e3c203be tracer. The common uCloudDrop offset is the only
// adaptation, so A/B tests isolate coordinate/proxy/skip work at equal density.
precision highp sampler3D;
out vec4 cloudOutput;
#define gl_FragColor cloudOutput
uniform sampler3D uDensity,uEmpty;uniform sampler2D uFrames,uLight;uniform bool uLiveLighting,uSkipEmpty;
uniform float uSpacing,uCount,uLength,uFlat,uGutter,uCloudDrop;
uniform vec3 uMin,uMax,uSun,uChord,uStart,uEnd,uStartNormal,uEndNormal;uniform vec2 uRange;
uniform mat4 modelViewMatrix,projectionMatrix;
varying vec3 vOrigin,vDirection;
#include <fog_pars_fragment>
struct Frame{vec3 p;vec3 x;vec3 y;vec3 z;float w;};
Frame frameAt(float s){
  float index=clamp(s/uSpacing,0.0,uCount-1.001);int i=int(index);float f=fract(index);
  vec4 p=mix(texelFetch(uFrames,ivec2(0,i),0),texelFetch(uFrames,ivec2(0,i+1),0),f);
  vec4 q=normalize(mix(texelFetch(uFrames,ivec2(1,i),0),texelFetch(uFrames,ivec2(1,i+1),0),f));
  vec3 x=vec3(1.0-2.0*(q.y*q.y+q.z*q.z),2.0*(q.x*q.y+q.z*q.w),2.0*(q.x*q.z-q.y*q.w));
  vec3 y=vec3(2.0*(q.x*q.y-q.z*q.w),1.0-2.0*(q.x*q.x+q.z*q.z),2.0*(q.y*q.z+q.x*q.w));
  vec3 z=cross(x,y)*sign(p.w);
  p.xyz+=z*(s-clamp(s,0.0,uLength));return Frame(p.xyz,x,y,z,abs(p.w));
}
float densityAt(vec3 q){
  vec3 uv=vec3(q.x/22.0+.5,(q.y+6.7)/9.2,q.z/23.0);
  if(uv.x<=0.0||uv.x>=1.0||uv.y<=0.0||uv.y>=1.0)return 0.0;
  // XY samples include both boundary texels; Z is periodic without a duplicate.
  uv.xy=uv.xy*vec2(127.0/128.0,63.0/64.0)+vec2(.5/128.0,.5/64.0);uv.z+=.5/192.0;
  return texture(uDensity,uv).r;
}
void main(){
  vec3 ray=normalize(vDirection),inv=1.0/ray;
  vec3 a=(uMin-vOrigin)*inv,b=(uMax-vOrigin)*inv,near=min(a,b),far=max(a,b);
  float start=max(0.0,max(max(near.x,near.y),near.z)),end=min(min(far.x,far.y),far.z);
  if(end<=start)discard;
  // Integrate the same world-anchored ray samples on both sides of a chunk
  // boundary. The first visible density assigns the whole ray to one chunk;
  // cutting a translucent integral in half leaves visible rectangular seams.
  start=max(0.0,start-6.0);end+=6.0;
  float ds=.2;
  float jitter=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
  start=(ceil(start/ds)+jitter)*ds;
  vec4 sum=vec4(0.0);float first=end,owner=0.0;bool hit=false,assigned=false;
  float s=uRange.x+dot(vOrigin+ray*start-uStart,uChord);Frame frame=frameAt(s);
  for(int j=0;j<4;j++){s+=dot(vOrigin+ray*start-frame.p,frame.z);frame=frameAt(s);}
  for(int i=0;i<320;i++){
    float t=start+float(i)*ds;if(t>end)break;vec3 point=vOrigin+ray*t;
    s+=dot(point-frame.p,frame.z);frame=frameAt(s);
    s+=dot(point-frame.p,frame.z);frame=frameAt(s);
    vec3 delta=point-frame.p;float x=dot(delta,frame.x),y=dot(delta,frame.y);
    if(uFlat>=0.0){float edge=min(frame.w-uFlat,max(0.0,abs(x)-uFlat));y-=uGutter-sqrt(max(.01,uGutter*uGutter-edge*edge));}
    vec3 q=vec3(x*7.0/frame.w,y+uCloudDrop,s);
    float cloud=densityAt(q);
    float cap=max(-s,s-uLength);if(cap>0.0)cloud*=1.0-smoothstep(0.0,1.35,cap);
    if(cloud<.006){
      if(uSkipEmpty){
        vec2 uv=vec2(q.x/22.0+.5,(q.y+6.7)/9.2);
        vec2 outside=max(vec2(0.0),max(-uv,uv-1.0))*vec2(22.0,9.2);
        vec3 lookup=vec3(clamp(uv,0.0,1.0)*vec2(127.0/128.0,63.0/64.0)+vec2(.5/128.0,.5/64.0),q.z/23.0+.5/192.0);
        float clearance=max(length(outside),texture(uEmpty,lookup).r*255.0/32.0);
        // Allow for the curved/gutter frame's coordinate stretch. Skips end on
        // the same .2 m integration grid; occupied samples are never thinned.
        int skip=int(floor(min(1.6,clearance*.25)/ds));i+=max(0,skip-1);
      }
      continue;
    }
    float lightFrame=clamp(s/uSpacing,0.0,uCount-1.001),slice=floor(lightFrame),columns=min(32.0,uCount);
    vec2 lightUv=clamp(vec2(q.x/22.0+.5,(q.y+6.7)/9.2),0.0,1.0)*vec2(63.0,31.0)+.5;
    vec2 lightSize=vec2(textureSize(uLight,0));
    vec2 offsetA=vec2(mod(slice,columns)*64.0,floor(slice/columns)*32.0);
    vec2 offsetB=vec2(mod(slice+1.0,columns)*64.0,floor((slice+1.0)/columns)*32.0);
    vec2 lighting=mix(texture(uLight,(offsetA+lightUv)/lightSize).rg,texture(uLight,(offsetB+lightUv)/lightSize).rg,fract(lightFrame));
    if(uLiveLighting){
      vec3 sun=vec3(dot(uSun,frame.x)*7.0/frame.w,dot(uSun,frame.y),dot(uSun,frame.z));
      float depth=0.0;for(int j=0;j<8;j++)depth+=densityAt(q+sun*(.35+float(j)*.9))*.9;
      lighting=vec2(exp(-depth*.72),exp(-depth*.16));
    }
    float direct=lighting.x,broad=lighting.y;
    vec3 light=vec3(.30,.40,.56)*.65+vec3(1.0,.97,.91)*(direct*.49+broad*.27);
    light+=vec3(.09,.10,.12)*(1.0-cloud)*direct;
    float alpha=1.0-exp(-cloud*ds*2.5),weight=(1.0-sum.a)*alpha;
    sum.rgb+=weight*light;sum.a+=weight;
    if(!assigned&&sum.a>.015){owner=s;assigned=true;if(owner<uRange.x-.005||owner>uRange.y+.005)discard;}
    if(!hit&&sum.a>.08){first=t;hit=true;}if(sum.a>.995)break;
  }
  if(sum.a<.015||owner<uRange.x-.005||owner>uRange.y+.005)discard;
  vec4 view=modelViewMatrix*vec4(vOrigin+ray*first,1.0),clip=projectionMatrix*view;
  gl_FragDepth=clip.z/clip.w*.5+.5;gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
  #ifdef USE_FOG
    gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogNear,fogFar,-view.z));
  #endif
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
