import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundled=await build({entryPoints:['src/levels/mall-wall-proxies.ts'],bundle:true,format:'esm',write:false});
const {clipMallWallOpening:clip}=await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const quad=(x0,x1,y0,y1)=>{const a=[x0,y0,0],b=[x1,y0,0],c=[x1,y1,0],d=[x0,y1,0];return[[a,b,c],[a,c,d]];};
const frame=[...quad(-2,-.8,0,4),...quad(.8,2,0,4),...quad(-.8,.8,0,1),...quad(-.8,.8,3,4)];
const wall={a:[-2,0,0],b:[2,0,0],height:4,source:18};
const solid=(walls,p)=>walls.some(w=>{const d=w.b.map((x,i)=>x-w.a[i]),l=d[0]**2+d[2]**2,t=((p[0]-w.a[0])*d[0]+(p[2]-w.a[2])*d[2])/l,y=w.a[1]+t*d[1];return t>=0&&t<=1&&p[1]>=y-1e-7&&p[1]<=y+(w.heights?w.heights[0]+(w.heights[1]-w.heights[0])*t:w.height)+1e-7;});
const sliced=clip(wall,frame);assert.ok(sliced.length>=4);
for(const x of [-.75,0,.75])for(const y of [1.1,2,2.9])assert.equal(solid(sliced,[x,y,0]),false);
for(const p of [[-1,2,0],[1,2,0],[0,.5,0],[0,3.5,0]])assert.ok(solid(sliced,p));
const angle=.73,transform=p=>[p[0]*Math.cos(angle)+105,p[1]-11,p[0]*Math.sin(angle)-220];
const moved=clip({...wall,a:transform(wall.a),b:transform(wall.b)},frame.map(f=>f.map(transform)));
assert.equal(solid(moved,transform([0,2,0])),false);assert.ok(solid(moved,transform([0,.5,0])));
const plain=clip(wall,quad(-2,2,0,4));assert.deepEqual(plain,[wall]);
// A bevelled aperture tests changing wall thickness. Every generated wall
// sample must remain inside the original triangles, not just their bounds.
const bevel=[...quad(-2,-1,0,4),...quad(1,2,0,4),[[-1,0,0],[1,0,0],[.6,1,0]],[[-1,0,0],[.6,1,0],[-.6,1,0]],[[-1,4,0],[.6,3,0],[1,4,0]],[[-1,4,0],[-.6,3,0],[.6,3,0]]];
const inside=(p,f)=>{const [a,b,c]=f,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;return u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6;};
let samples=0;
for(const w of clip(wall,bevel))for(const t of [.05,.5,.95])for(const v of [.05,.5,.95]){const p=w.a.map((x,i)=>x+(w.b[i]-x)*t);p[1]+=v*(w.heights?w.heights[0]+(w.heights[1]-w.heights[0])*t:w.height);assert.ok(bevel.some(f=>inside(p,f)),`Proxy outside source: ${p}`);samples++;}
console.log(JSON.stringify({frameOpening:true,solidSillAndLintel:true,rotatedFrame:true,unchangedPlainWall:true,bevelInteriorSamples:samples}));
