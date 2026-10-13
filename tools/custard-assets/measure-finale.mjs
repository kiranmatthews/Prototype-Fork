/** Measure the authored Meshy triangles, not a proxy box. Re-run after changing
 * the gorge assembly: node tools/custard-assets/measure-finale.mjs */
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import * as T from 'three';import {createServer} from 'vite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const round=n=>Math.round(n*4096)/4096,down=new T.Vector3(0,-1,0),ray=new T.Raycaster();
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
 const {CUSTARD_CREEK_LEVEL:data,custardPoint,custardTangent}=await server.ssrLoadModule('/src/levels/custard-creek.ts');
 const {custardPoolSection}=await server.ssrLoadModule('/src/levels/custard-finale.ts');
 const origin=new T.Vector3(...custardPoint(2445,0)),forward=new T.Vector3(...custardTangent(2445)),right=new T.Vector3(-forward.z,0,forward.x);
 const point=(u,y,d)=>new T.Vector3(...custardPoint(2445+d*.78,y,u));
 const supports=[],templates={custardgorgecliff:template('gorge-cliff'),custarderodedcliff:template('eroded-cliff'),custardshoreboulder:template('shore-rocks')};
 function instance(kind,u,y,d,w,h,depth,turn){const g=templates[kind].clone();g.position.copy(point(u,y,d));g.rotation.y=Math.atan2(-forward.x,-forward.z)+turn*Math.PI/180;g.scale.set(w,h,depth);g.updateMatrixWorld(true);return g;}
 for(const c of data.components.filter(c=>c.grp===95||c.nm==='Custard rounded foreground waterfall shoulder')){
  if(['custardgorgecliff','custarderodedcliff'].includes(c.dkind)){const g=templates[c.dkind].clone();g.position.fromArray(c.p);g.rotation.y=(c.yaw??0)*Math.PI/180;g.scale.fromArray(c.s);g.updateMatrixWorld(true);supports.push(g);}
  else if(c.t==='mesh'&&c.nm.includes('foundation')){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(c.vertices,3));g.setIndex(c.indices);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.position.fromArray(c.p);m.updateMatrixWorld(true);supports.push(m);}
 }
 function edge(d,side,y=-27.93){const section=custardPoolSection(d);ray.set(point(section.centre,y,d),right.clone().multiplyScalar(side));const h=ray.intersectObjects(supports,true)[0];return h?round(h.point.clone().sub(origin).dot(right)):section.centre+side*section.halfWidth;}
 function top(u,d,ceiling=60){ray.set(point(u,ceiling,d),down);return ray.intersectObjects(supports,true).find(h=>h.face&&h.face.normal.y>.15)?.point.y;}
 const edges=Array.from({length:49},(_,i)=>{const d=8+i*128/48,section=custardPoolSection(d);return [round(d),Math.min(section.centre-1,edge(d,-1)),Math.max(section.centre+1,edge(d,1))];});
 const props=[],roots=[],shoreModels=[];
 const put=(kind,u,d,y,w,h,depth,turn,name)=>props.push([kind,...[u,d,y,w,h,depth,turn].map(round),name]);
 const stoneRows=[[-1,18,8],[-1,33,8.5],[-1,52,7],[-1,73,8],[-1,98,6.5],[1,20,7],[1,39,8.5],[1,58,7],[1,81,7.5],[1,104,6.5]];
 for(const [side,d,w] of stoneRows){const h=w*.32428,u=edge(d,side)-side*w*.25,y=-28-h*.17,turn=d*11;put('custardshoreboulder',u,d,y,w,h,w*1.08818,turn,'Custard pool shoreline sandstone cluster');const model=instance('custardshoreboulder',u,y,d,w,h,w*1.08818,turn);supports.push(model);shoreModels.push(model);}
 for(const [side,d,w] of [[-1,22,7],[-1,42,6.5],[1,27,7.5],[1,50,6.5],[-1,64,5.5],[1,82,5]]){const h=w*.32428,u=edge(d,side)-side*(w*.7+2);put('custardshoreboulder',u,d,-28-h-.28,w,h,w*1.08818,d*19,'Custard submerged sandstone cluster');}
 function rooted(kind,u,d,w,ratios,turn,name){let y=top(u,d);
  if(!name.includes('shoreline')&&!name.includes('river bend')){const side=u<custardPoolSection(d).centre?-1:1,start=u;for(const step of [3,6,9,12]){const candidate=top(start+side*step,d);if(candidate!==undefined&&(y===undefined||candidate>y+1)){u=start+side*step;y=candidate;}}}
  if(y===undefined||y<-27.5)return;put(kind,u,d,y-.16,w,w*ratios[0],w*ratios[1],turn,name);roots.push({kind,u:round(u),d:round(d),surface:round(y),base:round(y-.16)});}
 for(const side of [-1,1])for(const [d,w] of [[19,18],[46,21],[79,21],[114,23],[137,22]])rooted('custardwillow',edge(d,side)+side*7,d,w,[.979357,.973089],d*13+side*47,'Custard rooted gorge willow');
 const shrub=JSON.parse(fs.readFileSync('public/custard-creek/bank-shrub-manifest.json')).sourceSizeXYZ,ratios=[shrub[1]/shrub[0],shrub[2]/shrub[0]];
 for(const side of [-1,1])for(let i=0;i<10;i++)for(const row of [0,1,2]){const d=12+i*12.4+row*5.2,u=edge(d,side)+side*([3.8,12,36][row]),w=([12.5,18,24][row])+((i*7+row*3)%5)*1.1;rooted('custardbankshrub',u,d,w,ratios,i*137+side*29,'Custard leafy sandstone bank garden');}
 for(const d of [101,129])rooted('custardwillow',edge(d,-1)-9,d,d>120?32:25,[.979357,.973089],d*17,'Custard river bend willow');
 for(const side of [-1,1])for(const [d,w] of [[17,10],[35,14],[58,12],[79,14],[102,12],[125,10]]){
  const h=w*.747569,heights=[4,8,12,16,20].map(offset=>top(edge(d,side)+side*offset,d)).filter(y=>y!==undefined);
  const y=Math.max(...heights);if(!Number.isFinite(y)||y<-23)continue;
  const u=edge(d,side,y-h*.42)-side*w*.12;
  put('custardclifffoliage',u,d,y-h*.82,w,h,w,side<0?75:-85,'Custard hanging willow curtain');
 }
 for(const side of [-1,1])for(const d of [96,108,122])rooted('custardbankshrub',edge(d,side)+side*5,d,15,ratios,d*23,'Custard low shoreline thicket');
 for(const side of [-1,1])for(const d of [135,146])rooted('custardbankshrub',edge(d,side)+side*12,d,23,ratios,d*7,'Custard closing bend canopy');
 for(const [side,d,w] of [[-1,121,54],[1,124,56]])rooted('custardgrove',edge(d,side)+side*23,d,w,[.209406,.299221],90,'Custard enclosed bend woodland');
 for(const [side,d,w] of [[-1,19,5],[1,21,5],[-1,73,5.5],[1,81,5]]){const u=edge(d,side)-side*1.4;rooted('custardbankshrub',u,d,w,ratios,d*37,'Custard low shoreline planting');}
 const foam={vertices:[],indices:[],uvs:[]},nodes=new Map(),segments=[];
 const vertex=(p,n)=>{const key=round(p.x)+','+round(p.z);let v=nodes.get(key);if(!v){v={p:p.clone(),n:new T.Vector3(),index:0,id:nodes.size};nodes.set(key,v);}v.n.add(n);return v;};
 for(const model of shoreModels)model.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry,p=g.attributes.position,index=g.index;
  for(let i=0;i<(index?.count??p.count);i+=3){const tri=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld)),hits=[];
   for(let k=0;k<3;k++){const a=tri[k],b=tri[(k+1)%3];if((a.y+28)*(b.y+28)<0)hits.push(a.clone().lerp(b,(-28-a.y)/(b.y-a.y)));}
   if(hits.length!==2||hits[0].distanceToSquared(hits[1])<1e-8)continue;
   const n=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));n.y=0;if(n.lengthSq()<1e-10)continue;n.normalize();
   segments.push([vertex(hits[0],n),vertex(hits[1],n)]);
  }
 });
 // Triangle-plane intersections oversample a smooth waterline. Simplify
 // connected contours to centimetric error, retaining junctions and loops.
 const unique=[],edgeKeys=new Set(),links=new Map();
 for(const pair of segments){const [a,b]=pair;if(a===b)continue;const key=[a.id,b.id].sort((x,y)=>x-y).join(',');if(edgeKeys.has(key))continue;edgeKeys.add(key);const i=unique.length;unique.push(pair);for(const n of pair){if(!links.has(n))links.set(n,[]);links.get(n).push(i);}}
 const visited=new Set(),paths=[];
 function walk(start,edge){const path=[start];let at=start;
  while(edge!==undefined&&!visited.has(edge)){visited.add(edge);const pair=unique[edge],next=pair[0]===at?pair[1]:pair[0];path.push(next);if(next===start||links.get(next).length!==2)break;at=next;edge=links.get(next).find(i=>!visited.has(i));}return path;
 }
 for(const [node,edges] of links)if(edges.length!==2)for(const e of edges)if(!visited.has(e))paths.push(walk(node,e));
 for(let i=0;i<unique.length;i++)if(!visited.has(i))paths.push(walk(unique[i][0],i));
 function simplify(path,error){const keep=new Set([0,path.length-1]),stack=[[0,path.length-1]];
  while(stack.length){const [a,b]=stack.pop();if(b-a<2)continue;const p=path[a].p,q=path[b].p,dx=q.x-p.x,dz=q.z-p.z,length=dx*dx+dz*dz;let worst=error*error,at=-1;
   for(let i=a+1;i<b;i++){const v=path[i].p,t=length?Math.max(0,Math.min(1,((v.x-p.x)*dx+(v.z-p.z)*dz)/length)):0,d=(v.x-p.x-t*dx)**2+(v.z-p.z-t*dz)**2;if(d>worst){worst=d;at=i;}}
   if(at>=0){keep.add(at);stack.push([a,at],[at,b]);}
  }
  return [...keep].sort((a,b)=>a-b).map(i=>path[i]);
 }
 let reduced=[],contourError=.02;
 for(;contourError<=.151;contourError+=.01){reduced=[];for(const path of paths){const points=simplify(path,contourError);for(let i=1;i<points.length;i++)if(points[i-1]!==points[i])reduced.push([points[i-1],points[i]]);}if(reduced.length<=1000)break;}
 if(reduced.length>1000)throw Error('Foam contours exceed the authored geometry budget');
 const addPair=(p,n,width)=>{const index=foam.vertices.length/3;for(const [offset,v] of [[.015,0],[width,1]]){const q=p.clone().addScaledVector(n,offset);foam.vertices.push(round(q.x-origin.x),-27.96,round(q.z-origin.z));foam.uvs.push(0,v);}return index;};
 for(const node of new Set(reduced.flat()))node.index=addPair(node.p,node.n.normalize(),.28);
 for(const [a,b] of reduced)foam.indices.push(a.index,b.index,a.index+1,b.index,b.index+1,a.index+1);
 for(const side of [-1,1]){let previous;for(const [d,left,rightU] of edges){const at=addPair(point(side<0?left:rightU,-28,d),right.clone().multiplyScalar(-side),.24);if(previous!==undefined)foam.indices.push(previous,at,previous+1,at,at+1,previous+1);previous=at;}}
 const rows=a=>'[\n '+a.map(row=>JSON.stringify(row)).join(',\n ')+'\n]';
 const text="// Generated by tools/custard-assets/measure-finale.mjs from actual cliff triangles.\nimport type {CustomComponent} from '../level';\nexport const CUSTARD_POOL_EDGES:readonly [number,number,number][]="+rows(edges)+";\nexport const CUSTARD_FINALE_DRESSING:readonly [NonNullable<CustomComponent['dkind']>,number,number,number,number,number,number,number,string][]="+rows(props)+";\n";
 fs.writeFileSync('src/levels/custard-finale-measured.ts',text+'export const CUSTARD_FINALE_FOAM='+JSON.stringify(foam)+';\n');fs.writeFileSync('docs/custard-finale-parity/foam.json',JSON.stringify({triangles:foam.indices.length/3,contourErrorMetres:contourError,originalSegments:segments.length,simplifiedSegments:reduced.length},null,2)+'\n');fs.writeFileSync('docs/custard-finale-parity/roots.json',JSON.stringify(roots,null,2)+'\n');console.log(JSON.stringify({shorelineSamples:edges.length,props:props.length,rooted:roots.length,minimumWidth:Math.min(...edges.map(e=>e[2]-e[1])),foamTriangles:foam.indices.length/3,foamContourErrorMetres:contourError}));
}finally{await server.close();}
