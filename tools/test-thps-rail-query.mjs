import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {nativeLinePair,nativeSquareRoot,nativeRailCandidate} from './thps-rail-query.mjs';
const base=process.env.THPS_SOURCE_CACHE||'/private/tmp/mall-recreation/research';
const source=await readFile(`${base}/decomp/game_src_m3dutils.cpp`,'utf8');
const maths=await readFile(`${base}/actor/m3dmaths.c`,'utf8');
const data=await readFile(`${base}/decomp/game_data_m3dasm.cpp`,'utf8');
const block=data.split('int SquareRootTable[1536] = {')[1].split('};')[0];
const packed=[...block.matchAll(/0x[0-9a-fA-F]+/g)].map(m=>Number(m[0]));assert.equal(packed.length,1536);
const table=packed.flatMap(n=>[n&65535,n>>>16]);
for(let i=0;i<3072;i++)assert.equal(table[i],Math.floor(Math.sqrt((i+1024+.5)*1048576)));
const sqrt=maths.slice(maths.indexOf('int M3dMaths_SquareRoot0__Fi(int n)'),maths.indexOf('/* M3dMaths_MulDiv64__Fiii'));
const geometry=source.slice(source.indexOf('static int Dot0('),source.indexOf('/* M3dUtils_NormaliseVector'));
assert.ok(sqrt.length>100&&geometry.length>3000);
const dir='/private/tmp/mall-recreation/catch-oracle25';await mkdir(dir,{recursive:true});
const cpp=`#include <iostream>\n#include <cstdint>\n#include "${base}/decomp/platform_pc_include_pc_geom.h"
struct CVector{int vx,vy,vz;CVector operator-(const CVector&b)const{return{vx-b.vx,vy-b.vy,vz-b.vz};}CVector operator>>(int n)const{return{vx>>n,vy>>n,vz>>n};}void operator>>=(int n){vx>>=n;vy>>=n;vz>>=n;}void operator<<=(int n){vx<<=n;vy<<=n;vz<<=n;}};
struct SVECTOR{int16_t vx,vy,vz,pad;};
unsigned short SquareRootTable[3072]={${table.join(',')}};
${sqrt}
#define M3dMaths_SquareRoot0 M3dMaths_SquareRoot0__Fi
${geometry}
int main(){CVector a,b,c,d,p,q;int t,u;while(std::cin>>a.vx>>a.vy>>a.vz>>b.vx>>b.vy>>b.vz>>c.vx>>c.vy>>c.vz>>d.vx>>d.vy>>d.vz){int r=M3dUtils_LineLineClosestPoints(&a,&b,&c,&d,&p,&t,&q,&u);std::cout<<r<<' '<<t<<' '<<u<<' '<<p.vx<<' '<<p.vy<<' '<<p.vz<<' '<<q.vx<<' '<<q.vy<<' '<<q.vz<<'\\n';}}`;
await writeFile(`${dir}/oracle.cpp`,cpp);execFileSync('c++',['-std=c++17','-O2','-fwrapv',`${dir}/oracle.cpp`,'-o',`${dir}/oracle`]);
const q=p=>p.map(n=>Math.round(n*4096));
const cases=[
 [[-150,0,0],[150,0,0],[0,0,-600],[0,0,600]],
 [[30,0,0],[30,0,-100],[0,0,0],[0,0,-600]],
 [[30,0,-100],[30,0,-100],[0,0,0],[0,0,-600]],
 [[-150,99,0],[150,99,0],[0,0,-600],[0,0,600]],
 [[-150,100,0],[150,100,0],[0,0,-600],[0,0,600]],
 [[-150,101,0],[150,101,0],[0,0,-600],[0,0,600]],
].map(c=>c.map(q));
let seed=0x18ac33;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let i=0;i<10000;i++){
 const a=[0,1,2].map(()=>Math.floor((rng()-.5)*800000000)),b=a.map(v=>(v+Math.floor((rng()-.5)*900000))|0);
 const c=a.map(v=>(v+Math.floor((rng()-.5)*3000000))|0),d=c.map(v=>(v+Math.floor((rng()-.5)*60000000))|0);
 if(i%23===0)b.splice(0,3,...a);if(i%29===0)d.splice(0,3,...c);
 cases.push([a,b,c,d]);
}
const output=execFileSync(`${dir}/oracle`,[],{input:cases.map(c=>c.flat().join(' ')).join('\n')+'\n',encoding:'utf8',maxBuffer:20*1024*1024}).trim().split('\n');assert.equal(output.length,cases.length);
for(let i=0;i<cases.length;i++){
 const got=nativeLinePair(...cases[i]),expected=output[i].split(' ').map(Number);
 assert.deepEqual([got.distance,got.t1,got.t2,...got.point1,...got.point2],expected,`source line pair ${i}`);
}
const rail={id:61,points:[q([0,0,-600]),q([0,0,600])]};
assert.ok(nativeRailCandidate([rail],q([-150,99,0]),q([150,99,0]),[1,0,0]));
assert.equal(nativeRailCandidate([rail],q([-150,100,0]),q([150,100,0]),[1,0,0]),null);
assert.equal(nativeRailCandidate([rail],q([-150,0,650]),q([150,0,650]),[0,0,1]),null);
assert.ok(nativeRailCandidate([rail],q([-150,0,650]),q([150,0,650]),[0,0,-1]));
assert.equal(nativeRailCandidate([rail],q([-150,10,0]),q([150,10,0]),[1,0,0],{grounded:true}),null);
const report={sourceRevision:'d9319c8d5b42c431de02bec0f02f0cf955f2fbae',sourceSHA256:createHash('sha256').update(source).digest('hex'),cppOracle:'Unmodified source Dot0/Lerp/LineLineClosestPoints, original pc_geom.h and SquareRoot0 implementation/table; only CVector storage/operators and IO are harness stubs.',linePairCases:cases.length,squareRootTableEntries:3072,fixtureResults:cases.slice(0,6).map(c=>nativeLinePair(...c)),strict100UnitLimit:true,outwardEndpointRejected:true,groundCannotReachUpward:true,productionModule:'src/referenceRailCapture.ts',integration:'Opt-in source coordinate frame; line-pair oracle does not prove full state-machine equivalence.'};
await writeFile('/private/tmp/mall-recreation/measured/catch-math.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
