import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, extname } from 'node:path';
import {createHash} from 'node:crypto';

const root=resolve('public'),rows=[];
async function files(dir){
  const out=[];for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())out.push(...await files(path));else if(path.endsWith('.glb'))out.push(path);
  }return out;
}
function dimensions(bytes,mime){
  if(mime==='image/png')return [bytes.readUInt32BE(16),bytes.readUInt32BE(20),'RGBA8'];
  if(mime==='image/ktx2')return [bytes.readUInt32LE(20),bytes.readUInt32LE(24),'KTX2'];
  if(mime==='image/jpeg')for(let i=2;i+9<bytes.length;){
    if(bytes[i++]!==255)continue;let marker=bytes[i++];while(marker===255)marker=bytes[i++];
    if(marker===0xd9||marker===0xda)break;
    const n=bytes.readUInt16BE(i);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return [bytes.readUInt16BE(i+5),bytes.readUInt16BE(i+3),'RGBA8'];
    if(n<2)break;i+=n;
  }return [null,null,'unknown'];
}
for(const path of await files(root)){
  const data=await readFile(path);if(data.readUInt32LE(0)!==0x46546c67)continue;
  let json,bin;for(let p=12;p+8<=data.length;){const n=data.readUInt32LE(p),type=data.readUInt32LE(p+4);if(type===0x4e4f534a)json=JSON.parse(data.subarray(p+8,p+8+n).toString());if(type===0x004e4942)bin=data.subarray(p+8,p+8+n);p+=8+n;}
  const meshes=(json.meshes??[]).map(m=>({name:m.name??'',triangles:m.primitives.reduce((sum,p)=>{
    const count=json.accessors[p.indices??p.attributes.POSITION].count,mode=p.mode??4;
    return sum+(mode===4?count/3:mode===5||mode===6?Math.max(0,count-2):0);
  },0)}));
  const images=await Promise.all((json.images??[]).map(async img=>{
    const view=json.bufferViews?.[img.bufferView];
    const bytes=view&&bin?bin.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength):await readFile(resolve(dirname(path),img.uri));
    const mime=img.mimeType??({'.ktx2':'image/ktx2','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[extname(img.uri??'')]);
    const [width,height,format]=dimensions(bytes,mime);
    return {uri:img.uri,width,height,format,encodedBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),rgbaMipMiB:format==='RGBA8'?width*height*4*4/3/1048576:null};
  }));
  const sceneNodes=new Set();const visit=id=>{if(sceneNodes.has(id))return;sceneNodes.add(id);for(const child of json.nodes[id].children??[])visit(child);};
  for(const id of json.scenes?.[json.scene??0]?.nodes??[])visit(id);
  rows.push({path:relative(root,path),bytes:data.length,meshes,sceneTriangles:[...sceneNodes].reduce((sum,id)=>sum+(meshes[json.nodes[id].mesh]?.triangles??0),0),images,
    decodedRgbaMipMiB:images.reduce((sum,i)=>sum+(i.rgbaMipMiB??0),0)});
}
rows.sort((a,b)=>b.sceneTriangles-a.sceneTriangles);
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(rows,null,2)+'\n');
const summary=r=>({path:r.path,sceneTriangles:r.sceneTriangles,largestMesh:Math.max(...r.meshes.map(m=>m.triangles)),textures:r.images.length,maxTexture:Math.max(...r.images.flatMap(i=>[i.width??0,i.height??0])),rgbaMipMiB:+r.decodedRgbaMipMiB.toFixed(2)});
console.log(`${rows.length} GLBs audited. Scene totals include bundled LOD meshes, not simultaneous runtime draws.`);
console.table(rows.slice(0,10).map(summary));
console.table(rows.filter(r=>r.path.startsWith('treehouse-trail/')).map(summary));
for(const row of rows.filter(r=>r.path.startsWith('treehouse-trail/')))if(row.meshes.some(m=>m.triangles>15000))throw Error(`${row.path} exceeds the 15,000-triangle scenery budget`);
