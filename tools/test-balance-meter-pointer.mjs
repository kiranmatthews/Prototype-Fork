import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function moduleAt(file,require){
  const source=readFileSync(new URL(file,import.meta.url),'utf8').replaceAll('import.meta.env.BASE_URL',"''");
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,require);return module.exports;
}
const {BALANCE_METER_ASSETS:assets}=moduleAt('../src/balanceMeterAssets.ts');
globalThis.Image=class {
  set src(file){this.file=file;const bytes=readFileSync(new URL('../public/'+file,import.meta.url));this.width=bytes.readUInt32BE(16);this.height=bytes.readUInt32BE(20);queueMicrotask(()=>this.onload());}
};
const meter=moduleAt('../src/balanceMeter.ts',name=>name==='./balanceMeterAssets'?{BALANCE_METER_ASSETS:assets}:{trackPresentationImage(){}});
await meter.loadBalanceMeterAssets();
const apply=(m,x,y)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
function context(){
 let matrix=[1,0,0,1,0,0];const stack=[],draws=[];
 return {draws,save(){stack.push([...matrix]);},restore(){matrix=stack.pop();},
  translate(x,y){[matrix[4],matrix[5]]=apply(matrix,x,y);},
  scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;},
  rotate(a){const [x,y,z,w]=matrix,c=Math.cos(a),s=Math.sin(a);matrix[0]=x*c+z*s;matrix[1]=y*c+w*s;matrix[2]=z*c-x*s;matrix[3]=w*c-y*s;},
  drawImage(image,...args){draws.push({image,args,matrix:[...matrix]});}};
}
let samples=0;
for(const mode of ['grind','manual'])for(const nowMs of [0,141,236,526]){
 const frame=meter.balanceMeterFrame(nowMs).frame;
 assert.equal(meter.balanceMeterPointerPose(0,frame).angle,0,'centred hand should point straight in');
 let previous;
 for(let i=-100;i<=100;i++){
  const value=i/100,axisValue=mode==='grind'?-value:value;
  const pose=meter.balanceMeterPointerPose(axisValue,frame),point=meter.balanceMeterPoint(axisValue,frame);
  assert.deepEqual({x:pose.x,y:pose.y},point,'tilt changed the value position');
  assert.ok(axisValue*pose.angle<=1e-8,'hand points away from the arc centre');
  assert.ok(Math.abs(pose.angle)<Math.PI/4,'excessive off-centre lean');
  if(previous!==undefined)assert.ok(Math.abs(pose.angle-previous)<Math.PI/120,'painted notch jerks the hand');
  previous=pose.angle;
  const ctx=context();
  assert.equal(meter.drawBalanceMeter(ctx,{x:17,y:23,width:mode==='grind'?400:202,height:mode==='grind'?202:400},{mode,value,nowMs}),true);
  assert.equal(ctx.draws.length,2,'meter must draw one gauge and one hand');
  const [gauge,hand]=ctx.draws,[x,y,w,h]=hand.args.slice(-4),tip=assets.glove.tip;
  const actual=apply(hand.matrix,x+w*tip[0],y+h*tip[1]);
  const expected=apply(gauge.matrix,300+point.x*360,119+point.y*1152);
  assert.ok(Math.hypot(actual[0]-expected[0],actual[1]-expected[1])<1e-8,'rotating around the wrist displaced the fingertip');
  samples++;
 }
}
for(const invalid of [NaN,Infinity,-Infinity])assert.deepEqual(meter.balanceMeterPointerPose(invalid),meter.balanceMeterPointerPose(0));
assert.deepEqual(meter.balanceMeterFrame(999,true),{frame:0,angle:0,beat:0});
console.log(`PASS ${samples} meter poses: fingertip stays on the measured curve, hand leans toward centre in both orientations/all four cels, smooth bounded tilt and centred/reduced-motion handling.`);
