import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';

// Reference bytes captured at 8128b0a7, before shoreline neighborhood caching.
// These guard the whole half-float field, including nearest-edge ties, plus
// CPU interpolation outside and inside the raster. No copy of the algorithm.
const reference = {
 "empty":{"width":1,"height":1,"segments":0,"hasBed":false,"bounds":[-20,-20,40,40],"texture":"a186e43820acd0870d62be47eb9bed604fee4cb221fd2c2e9c4d1ced3e87f2ca","samples":"b96b9a27a1e0330e9565432513926f8f634b891e0d369cc3c9b4dc1df9a18319"},
 "bed-only":{"width":130,"height":98,"segments":0,"hasBed":true,"bounds":[-97,-73,194,146],"texture":"e3ecd6f5a66585e33663e51f3dd34e9a0e0b0b564795f27e4383470a627e7382","samples":"45a9c58ae8185728c6eb2087c167cff032eafe452d400e6e219ea981fdef7fc4"},
 "long-edges-negative-cells":{"width":161,"height":140,"segments":4,"hasBed":true,"bounds":[-113,-99,241,209],"texture":"4bbbd0b8adbcf053e43f675413d5dddd2a66ce1907907bbd859960aa4ab805c9","samples":"861b4350b98d62a6df335ac4f22892cb817edabbf0aa9a34ef3fffef58572d79"},
 "transformed-coast":{"width":192,"height":171,"segments":48,"hasBed":true,"bounds":[-160,-112,288,256],"texture":"0a6d23822e73dad62b88eb90fc825a81e2e8f7fa95d410267b8346026b0e8316","samples":"11a8b16328170979097486dd38f98f758faf90b6b823a84101283c2857822278"},
 "equal-distance-east-first":{"width":65,"height":129,"segments":4,"hasBed":true,"bounds":[-48.75,-96.75,97.5,193.5],"texture":"5005fc0aa41bf06bc572403d3ac183f49c6fe5fd5fe861d124a4355b4f4815fb","samples":"6644697d73379352b7d252fbf3f1393c587ce1ecd4e7b4c79ffea8b772cf2f54"},
 "equal-distance-west-first":{"width":65,"height":129,"segments":4,"hasBed":true,"bounds":[-48.75,-96.75,97.5,193.5],"texture":"e12d6a17a39145f0aa7e30e9a10f983cc736d28a1f384e9a534fe5d9cc3c14ee","samples":"d19cfab85c9637638aebb1a9cd0f190b6a88515eaf6ba239a94c5f79bc270bc3"},
 "ignored-meshes":{"width":161,"height":140,"segments":4,"hasBed":true,"bounds":[-113,-99,241,209],"texture":"4bbbd0b8adbcf053e43f675413d5dddd2a66ce1907907bbd859960aa4ab805c9","samples":"861b4350b98d62a6df335ac4f22892cb817edabbf0aa9a34ef3fffef58572d79"},
 "sparse-kilometre":{"width":667,"height":667,"segments":132,"hasBed":true,"bounds":[-300,-862,1000,1000],"texture":"7ecb32d34570d574c5061918ef2c911b4f2d9bad1bb70d5f5f4c212f0f82cc42","samples":"b96b9a27a1e0330e9565432513926f8f634b891e0d369cc3c9b4dc1df9a18319"},
 "narrow-bounds":{"width":2,"height":2,"segments":4,"hasBed":true,"bounds":[-0.01,-16,1,1],"texture":"16fe959c37dc266fbc0056536e2b96733ac937f7d2a1ffad08254c67e3ceacc4","samples":"ab0bcbf8ecc4b239a054f675e833dc81e8bf36cce991c485c1b0443542a064bb"},
};
const output = process.argv.find(a=>a.startsWith('--out='))?.slice(6);
const report = {};
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const resources=[];
const bounds=(x,z,w,h)=>new THREE.Box3(new THREE.Vector3(x,-20,z),new THREE.Vector3(x+w,20,z+h));
function surface(width,depth,columns,rows,height){
 const geometry=new THREE.PlaneGeometry(width,depth,columns,rows).rotateX(-Math.PI/2);
 const pos=geometry.getAttribute('position');
 for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));
 geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(geometry,material);
 mesh.updateMatrixWorld(true);resources.push(geometry,material);return mesh;
}
const hash=data=>createHash('sha256').update(data).digest('hex');
try{
 const {createShoreField}=await server.ssrLoadModule('/src/coastalSurf.ts');
 const long=surface(128,160,2,2,x=>-x*.18);
 const transformed=surface(94,134,12,18,(x,z)=>-x*.2+Math.sin(z*.11)*1.8);
 transformed.position.set(-33,-1,29);transformed.rotation.y=.38;transformed.scale.set(1.4,.8,.7);transformed.updateMatrixWorld(true);
 const east=surface(96,160,2,2,x=>-x*.25),west=surface(96,160,2,2,x=>x*.25);
 const bed=surface(96,144,2,2,()=>-3.5);
 const sparse=surface(128,360,30,60,(x,z)=>-x*.18+Math.sin(z*.03)*2);
 const hidden=surface(96,160,2,2,x=>-x*.4);hidden.visible=false;
 const ignored=surface(96,160,2,2,x=>-x*.5);ignored.userData.noWaterShore=true;
 const glass=surface(96,160,2,2,x=>-x*.6);glass.material.transparent=true;
 const cases=[
  ['empty',[],0,bounds(-20,-20,40,40)],
  ['bed-only',[bed],0,bounds(-97,-73,194,146)],
  ['long-edges-negative-cells',[long],0,bounds(-113,-99,241,209)],
  ['transformed-coast',[transformed],0,bounds(-160,-112,288,256)],
  ['equal-distance-east-first',[east,west],-.025,bounds(-48.75,-96.75,97.5,193.5)],
  ['equal-distance-west-first',[west,east],-.025,bounds(-48.75,-96.75,97.5,193.5)],
  ['ignored-meshes',[long,hidden,ignored,glass],0,bounds(-113,-99,241,209)],
  ['sparse-kilometre',[sparse],0,bounds(-300,-862,1000,1000)],
  ['narrow-bounds',[long],0,bounds(-.01,-16,0,1)],
 ];
 for(const [name,meshes,sea,box] of cases){
  const times=[];let result;
  for(let run=0;run<3;run++){
   const start=performance.now(),field=createShoreField(meshes,sea,box);times.push(performance.now()-start);
   const image=field.texture.image,samples=[];
   for(const u of [-.1,0,.19,.5,.79,1,1.1])for(const v of [-.1,0,.31,.5,.87,1,1.1]){
    samples.push(field.sample(box.min.x+u*(box.max.x-box.min.x),box.min.z+v*(box.max.z-box.min.z)));
   }
   result={width:image.width,height:image.height,segments:field.segments,hasBed:field.hasBed,bounds:field.bounds.toArray(),
    texture:hash(new Uint8Array(image.data.buffer,image.data.byteOffset,image.data.byteLength)),samples:hash(JSON.stringify(samples))};
   assert.deepEqual(result,reference[name],name+' must preserve every texture byte and CPU sample');
   field.texture.dispose();
  }
  report[name]={...result,milliseconds:times};
 }
 assert.equal(report['ignored-meshes'].texture,report['long-edges-negative-cells'].texture);
 assert.notEqual(report['equal-distance-east-first'].texture,report['equal-distance-west-first'].texture,'fixture must exercise edge-order ties');
 if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
 for(const [name,result] of Object.entries(report))console.log(name+': '+result.segments+' contours, '+result.milliseconds.map(ms=>ms.toFixed(1)).join('/')+' ms; exact bytes and samples');
 console.log('PASS exact shoreline texture bytes and CPU samples across '+cases.length+' coastline fixtures');
}finally{for(const resource of resources)resource.dispose();await server.close();}
