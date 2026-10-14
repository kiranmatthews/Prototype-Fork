// Offline grounding for the Rumblewater headwaters; never adds runtime work.
import fs from 'node:fs';
import * as T from 'three';import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
function template(file){
 const bytes=fs.readFileSync('public/custard-creek/'+file+'.glb'),n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);
 const counts={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},types={5121:Uint8Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array};
 function attribute(id){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],Type=types[a.componentType],size=counts[a.type],offset=(v.byteOffset??0)+(a.byteOffset??0),view=new DataView(bin.buffer,bin.byteOffset+offset),result=new Type(a.count*size),get={5121:'getUint8',5123:'getUint16',5125:'getUint32',5126:'getFloat32'}[a.componentType];
  for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)result[i*size+j]=view[get](i*(v.byteStride??size*Type.BYTES_PER_ELEMENT)+j*Type.BYTES_PER_ELEMENT,true);return new T.BufferAttribute(result,size);}
 const out=new T.Group();
 function visit(index,parent,high){const node=doc.nodes[index];if(node.name?.endsWith('LOD1'))return;
  const matrix=node.matrix?new T.Matrix4().fromArray(node.matrix):new T.Matrix4().compose(new T.Vector3(...(node.translation??[0,0,0])),new T.Quaternion(...(node.rotation??[0,0,0,1])),new T.Vector3(...(node.scale??[1,1,1])));
  matrix.premultiply(parent);high||=node.name?.endsWith('LOD0');
  if(node.mesh!==undefined&&high)for(const primitive of doc.meshes[node.mesh].primitives){const g=new T.BufferGeometry();g.setAttribute('position',attribute(primitive.attributes.POSITION));if(primitive.indices!==undefined)g.setIndex(attribute(primitive.indices));g.applyMatrix4(matrix);out.add(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));}
  for(const child of node.children??[])visit(child,matrix,high);
 }
 for(const id of doc.scenes[doc.scene??0].nodes)visit(id,new T.Matrix4(),false);
 if(!out.children.length)throw Error('No LOD0 triangles: '+file);
 const box=new T.Box3().setFromObject(out),size=box.getSize(new T.Vector3()),centre=box.getCenter(new T.Vector3());
 for(const m of out.children){m.geometry.translate(-centre.x,-box.min.y,-centre.z);m.geometry.scale(1/size.x,1/size.y,1/size.z);}return out;
}
try{
 const {RUMBLEWATER_RUN_LEVEL:data,rumblePoint}=await server.ssrLoadModule('/src/levels/rumblewater-run.ts');
 const templates={custardgorgecliff:template('gorge-cliff'),custarderodedcliff:template('eroded-cliff'),custardboulder:template('moss-boulder'),custardshoreboulder:template('shore-rocks')};
 const supports=[];
 for(const c of data.components.filter(c=>c.grp===94&&templates[c.dkind])){
  const g=templates[c.dkind].clone();g.position.fromArray(c.p);g.rotation.y=(c.yaw??0)*Math.PI/180;g.scale.fromArray(c.s);g.updateMatrixWorld(true);supports.push(g);
 }
 const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),rows=[],roots=[];
 function plant(kind,s,u,w,turn,name,hanging=false){
  ray.set(new T.Vector3(...rumblePoint(s,180,u)),down);
  const hit=ray.intersectObjects(supports,true).find(h=>h.face&&h.face.normal.y>.12);
  if(!hit||hit.point.y<15)throw Error('No planting support: '+[s,u]);
  const y=hit.point.y-(hanging?w*.747569*.8:.18);
  rows.push([kind,s,u,w,Math.round(y*4096)/4096,turn,name]);roots.push({kind,s,u,rockY:hit.point.y,baseY:y,hanging});
 }
 for(const [s,u,w]of [[-119,-60,24],[-113,-38,20],[-118,55,23],[-111,66,21],[-110,-50,20],[-107,51,19],[-87,-50,17],[-87,48,16]])
  plant('custardwillow',s,u,w,s*7,'Headwaters rooted willow canopy');
 for(const side of [-1,1])for(const [s,u,w]of [[-140,29,15],[-126,30,14],[-126,49,18],[-128,72,19],[-111,31,13],[-109,45,17],[-99,56,15],[-88,38,11]])
  plant('custardbankshrub',s,side*u,w,s*19+side*33,'Headwaters rooted cliff garden');
 for(const [s,u,w]of [[-118,-27,14],[-117,28,13],[-108,-33,16],[-107,34,14],[-91,-34,13],[-90,35,12],[-122,-53,15],[-122,53,14]])
  plant('custardclifffoliage',s,u,w,u<0?72:-85,'Headwaters hanging willow curtain',true);
 const text="// Cliff foliage rooted with tools/measure-rumblewater-waterfall.mjs.\nimport type {CUSTARD_ASSETS} from '../custardAssets';\nexport const RUMBLEWATER_WATERFALL_PLANTS:readonly [keyof typeof CUSTARD_ASSETS,number,number,number,number,number,string][]=[\n "+rows.map(r=>JSON.stringify(r)).join(',\n ')+'\n];\n';
 fs.writeFileSync('src/levels/rumblewater-waterfall-plants.ts',text);
 fs.mkdirSync('docs/art-reviews/rumblewater-waterfall',{recursive:true});
 fs.writeFileSync('docs/art-reviews/rumblewater-waterfall/roots.json',JSON.stringify(roots,null,2)+'\n');
 console.log(JSON.stringify({plants:rows.length,supportMeshes:supports.length,lowestRoot:Math.min(...roots.filter(r=>!r.hanging).map(r=>r.baseY))}));
}finally{await server.close();}
