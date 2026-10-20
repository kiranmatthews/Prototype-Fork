import assert from 'node:assert/strict';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({server,THREE,Level})=>{
 const {Rail}=await server.ssrLoadModule('/src/rails.ts');
 const vector=p=>new THREE.Vector3(...p);
 const rail=points=>new Rail(points.map(vector),false);
 const straight=rail([[-8,0,0],[8,0,0]]);
 const almostStraight=rail([[-4,0,0],[0,.19,0],[4,0,0]]);
 const detour=rail([[-4,0,0],[-2,0,0],[0,2,0],[2,0,0],[4,0,0]]);
 const crossing=rail([[0,0,-8],[0,0,8]]);
 const pointRail=rail([[0,0,0],[0,0,0]]);
 const covered=(authored,surface,start,end)=>Level.prototype.systemicEdgeAlreadyAuthored.call(
  {rails:authored,surfaceEdgeRails:surface},vector(start),vector(end));
 const cases=[
  ['empty',[],[],[-3,0,0],[3,0,0],false],
  ['authored straight',[straight],[],[-3,0,0],[3,0,0],true],
  ['reversed edge',[straight],[],[3,0,0],[-3,0,0],true],
  ['existing surface',[],[straight],[-3,0,0],[3,0,0],true],
  ['included 20 cm boundary',[straight],[],[-3,.2,0],[3,.2,0],true],
  ['outside 20 cm boundary',[straight],[],[-3,.200000001,0],[3,.200000001,0],false],
  ['only start covered',[straight],[],[-3,0,0],[9,0,0],false],
  ['only end covered',[straight],[],[-9,0,0],[3,0,0],false],
  ['wrong tangent',[crossing],[],[-.1,0,0],[.1,0,0],false],
  ['curve within tolerance',[almostStraight],[],[-4,0,0],[4,0,0],true],
  ['endpoints conceal curve gap',[detour],[],[-4,0,0],[4,0,0],false],
  ['later rail covers gap',[detour],[straight],[-4,0,0],[4,0,0],true],
  ['degenerate rail',[pointRail],[],[-.1,0,0],[.1,0,0],false],
  ['degenerate edge',[straight],[],[0,0,0],[0,0,0],false],
 ];
 for(const [name,authored,surface,start,end,expected] of cases)
  assert.equal(covered(authored,surface,start,end),expected,name);
 // Keep the helper's exact distance at thresholds, not just approximately
 // equal, through both legal translations and non-rigid rebakes.
 let distances=0;
 for(const target of [straight,almostStraight,detour,crossing,pointRail]){
  for(let phase=0;phase<3;phase++){
   if(phase===1)for(const point of target.points)point.add(new THREE.Vector3(-17,3,29));
   if(phase===2){target.points[Math.floor(target.points.length/2)].y+=1.3;target.rebake();}
   for(const node of target.points)for(const offset of [0,.199999999,.2,.200000001,-.2,8]){
    const p=node.clone().add(new THREE.Vector3(0,offset,0));
    assert.equal(target.closestDistance(p),target.closest(p).distance);distances++;
   }
  }
 }
 console.log('PASS '+cases.length+' surface-edge overlap cases and '+distances+' exact translated/rebaked threshold distances');
},{levelEntry:{id:'__edge_dedup',name:'Edge overlap fixture',data:{v:1,name:'Edge overlap fixture',spawn:[0,.1,0],killY:-20,
 components:[{t:'platform',p:[0,-.5,0],s:[8,1,12]},{t:'gate',p:[0,0,-5]}]}}});
