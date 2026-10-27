import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/network-survey';
const sourceModule=process.env.SPAGHETTI_MODULE??'./src/levels/spaghetti-rails';
await mkdir(output,{recursive:true});
const built=await build({stdin:{contents:`export * from ${JSON.stringify(sourceModule)};export {Rail} from './src/rails';export {RailChoices} from './src/race/railChoices';export {RaceCourse} from './src/race/course';export {validSkateRace} from './src/race/schema';export {Vector3} from 'three';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {SPAGHETTI_RAILS_LEVEL:level,SPAGHETTI_PATHS:paths,spaghettiRail,spaghettiSamples,Rail,RailChoices,RaceCourse,validSkateRace,Vector3}=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const rails=paths.flatMap(path=>path.runs.map(run=>{
 const component=spaghettiRail(run),points=spaghettiSamples(component),native=new Rail(points.map(p=>new Vector3(...p)),false);native.object.userData.sourceName=component.nm;
 const arc=[0];for(let i=1;i<points.length;i++)arc.push(arc.at(-1)+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));
 let maxTurn=0;
 for(let i=1;i<points.length-1;i++){
  const a=new Vector3(...points[i]).sub(new Vector3(...points[i-1])).normalize(),b=new Vector3(...points[i+1]).sub(new Vector3(...points[i])).normalize();
  maxTurn=Math.max(maxTurn,Math.acos(Math.min(1,Math.max(-1,a.dot(b))))*180/Math.PI);
 }
 return {name:run.name,stage:path.stage,choice:path.choice,component,points,native,arc,length:native.totalLength,maxTurn};
}));
const platforms=level.components.filter(c=>c.t==='platform');
const support=(p)=>platforms.filter(c=>{
 const yaw=(c.yaw??0)*Math.PI/180,x=p[0]-c.p[0],z=p[2]-c.p[2],lx=Math.cos(yaw)*x-Math.sin(yaw)*z,lz=Math.sin(yaw)*x+Math.cos(yaw)*z;
 return Math.abs(lx)<c.s[0]/2-.25&&Math.abs(lz)<c.s[2]/2-.25&&Math.abs(p[1]-(c.p[1]+c.s[1]/2)-.9)<.02;
}).map(c=>c.nm);
const endpoints=rails.flatMap(rail=>[0,rail.points.length-1].map(i=>({rail:rail.name,end:i?'end':'start',point:rail.points[i],platforms:support(rail.points[i])})));
const platformContacts=[];
for(const [index,rail]of rails.entries())for(const platform of platforms){
 const yaw=(platform.yaw??0)*Math.PI/180,top=platform.p[1]+platform.s[1]/2,bottom=platform.p[1]-platform.s[1]/2;
 let hits=0,first=null,last=null;
 for(let at=0;at<rail.length;at+=1.5){const p=rail.native.pointAt(at),x=p.x-platform.p[0],z=p.z-platform.p[2],lx=Math.cos(yaw)*x-Math.sin(yaw)*z,lz=Math.sin(yaw)*x+Math.cos(yaw)*z;
  if(Math.abs(lx)>platform.s[0]/2+.5||Math.abs(lz)>platform.s[2]/2+.5||p.y>=top+.3||p.y+2.3<=bottom)continue;
  hits++;first??={at,point:p.toArray()};last={at,point:p.toArray()};
 }
 if(hits)platformContacts.push({rail:index,name:rail.name,platform:platform.nm,top,bottom,hits,first,last});
}
const crossings=[];
for(let a=0;a<rails.length;a++)for(let b=a;b<rails.length;b++){
 const A=rails[a],B=rails[b];
 for(let i=1;i<A.points.length;i++)for(let j=a===b?i+2:1;j<B.points.length;j++){
  if(a===b&&B.arc[j]-A.arc[i]<25)continue;
  const p=A.points[i-1],q=A.points[i],s=B.points[j-1],t=B.points[j],dx=q[0]-p[0],dz=q[2]-p[2],ux=t[0]-s[0],uz=t[2]-s[2],den=dx*uz-dz*ux;
  if(Math.abs(den)<1e-8)continue;
  const tx=s[0]-p[0],tz=s[2]-p[2],f=(tx*uz-tz*ux)/den,g=(tx*dz-tz*dx)/den;
  if(f<=0||f>=1||g<=0||g>=1)continue;
  const ya=p[1]+(q[1]-p[1])*f,yb=s[1]+(t[1]-s[1])*g;
  crossings.push({rails:[a,b],stages:[A.stage,B.stage],choices:[A.choice,B.choice],point:[p[0]+f*dx,(ya+yb)/2,p[2]+f*dz],height:Math.abs(ya-yb),fractions:[(A.arc[i-1]+f*(A.arc[i]-A.arc[i-1]))/A.length,(B.arc[j-1]+g*(B.arc[j]-B.arc[j-1]))/B.length],angle:Math.acos(Math.min(1,Math.max(-1,(dx*ux+dz*uz)/Math.hypot(dx,dz)/Math.hypot(ux,uz))))*180/Math.PI});
 }
}
crossings.sort((a,b)=>a.height-b.height);
const network=new RailChoices(new RaceCourse(level.skateRace.line),level.skateRace,rails.map(r=>r.native));
const navigation=[];
for(const path of network.paths){
 const cursor={s:path.start,route:path.index,along:0},camera={s:path.start,route:path.index,along:0};let minimumDot=1,maxBackstep=0,wrongCamera=0;
 for(const span of path.rails)for(let s=0;s<=span.rail.totalLength;s+=1.5){
  const position=span.rail.pointAt(s);position.y+=.12;
  const previous=cursor.s,at=network.update(position,cursor,span.rail,s),view=network.update(position,camera);
  maxBackstep=Math.max(maxBackstep,previous-at.s);
  minimumDot=Math.min(minimumDot,network.tangent(camera).dot(span.rail.tangentAt(s)));
  if(view.route!==path.index)wrongCamera++;
 }
 navigation.push({stage:path.section,choice:path.choice,length:path.course.length,minimumDot,maxBackstep,wrongCamera});
}
const reacquisition=[];
for(const crossing of crossings.filter(c=>c.stages[0]===c.stages[1]&&c.choices[0]!==c.choices[1]&&c.height<15))for(const [a,b]of [[0,1],[1,0]]){
 const from=rails[crossing.rails[a]].native,to=rails[crossing.rails[b]].native;
 const s1=from.totalLength*crossing.fractions[a],s2=to.totalLength*crossing.fractions[b],p1=from.pointAt(s1),p2=to.pointAt(s2);p1.y+=.12;p2.y+=.12;
 const cursor=network.project(p1,undefined,from,s1),expected=network.project(p2,undefined,to,s2),actual=network.update(p2,cursor);
 reacquisition.push({from:from.object.userData.sourceName,to:to.object.userData.sourceName,height:crossing.height,expected:expected.route,actual:actual.route,passed:expected.route===actual.route});
}
const report={at:new Date().toISOString(),fingerprint:createHash('sha256').update(JSON.stringify(level)).digest('hex'),rails:rails.length,paths:paths.length,junctions:level.skateRace.railChoices.length,platforms:platforms.length,unsupported:endpoints.filter(e=>!e.platforms.length),endpoints,
 height:[Math.min(...rails.flatMap(r=>r.points.map(p=>p[1]))),Math.max(...rails.flatMap(r=>r.points.map(p=>p[1])))],maxTurn:Math.max(...rails.map(r=>r.maxTurn)),platformContacts,crossings,navigation,reacquisition};
await writeFile(output+'/geometry.json',JSON.stringify(report,null,2));
await writeFile(output+'/source.json',JSON.stringify({level,rails:rails.map(({native,...rest})=>rest)}));
console.log(JSON.stringify({...report,endpoints:undefined,crossings:crossings.slice(0,16),reacquisition:{cases:reacquisition.length,failures:reacquisition.filter(r=>!r.passed)}},null,2));
assert.equal(validSkateRace(level.skateRace),true,'The branching metadata survives the editor/save contract');
assert.ok(navigation.every(path=>path.wrongCamera===0&&path.minimumDot>.9),'Every route keeps its own camera and input tangent through the entanglement');
assert.equal(report.platformContacts.length,0,'Platforms leave a rider-sized clear passage on every other rail');
assert.equal(report.unsupported.length,0,'Every rail endpoint must have a real platform beneath it');
assert.ok(crossings.every(c=>c.height>=4),'Over/under crossings leave full rider clearance');
assert.ok(report.maxTurn<45,'All editable rail curves preserve the native corner margin');
assert.equal(network.paths.length,paths.length,'Every distinct alternative resolves from native editor names');
assert.ok(navigation.every(p=>p.maxBackstep<1),'Rail progress remains ordered through each branch');
assert.ok(reacquisition.length>0&&reacquisition.every(r=>r.passed),'Catching a different thread at a crossing gives that actual rail ownership of the camera');
