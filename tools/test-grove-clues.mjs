import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(s=>s.startsWith('http'))??'http://127.0.0.1:5259';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage();
let artwork;
try{
 // Decode the shipped bitmaps independently of the level's safe-region data.
 // Crops isolate symbols from the canvas border, stains and torn edges.
 await page.goto(`${base}/grove/clue-2.webp`);
 artwork=await page.evaluate(async()=>{
  const get=async id=>{const image=new Image();image.src=`/grove/clue-${id}.webp`;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return{w:c.width,h:c.height,data:ctx.getImageData(0,0,c.width,c.height).data};};
  const black=(r,g,b,a)=>a>200&&r<65&&g<60&&b<50&&r<g*1.35+2;
  const red=(r,g,b,a)=>a>200&&r>70&&r>g*1.7&&r>b*1.5;
  const ink=(im,box,colour)=>{
   const pts=[];for(let y=Math.round(box[1]);y<box[3];y++)for(let x=Math.round(box[0]);x<box[2];x++){
    const i=(y*im.w+x)*4;if(colour(...im.data.slice(i,i+4)))pts.push([x,y]);
   }
   return pts;
  };
  const symbol=(im,box)=>{const r=ink(im,box,red).length,b=ink(im,box,black).length;return{mark:r>100?'X':'O',red:r,black:b};};
  const out={circles:{},crosses:{},railBanks:[],grid:[],columns:[]};
  const circles={2:[[85,565,185,665],[209,470,310,568],[331,390,435,491],[328,197,432,299],[222,82,325,184]],4:[[341,211,447,316],[341,72,447,181]]};
  const crosses={2:[[91,111,183,216],[90,330,183,432],[333,555,425,659]],4:[[82,68,184,173],[193,185,315,290]]};
  for(const [id,boxes]of Object.entries(circles)){
   const im=await get(id);out.circles[id]=boxes.map(box=>{
    const pts=ink(im,box,black),x=(Math.min(...pts.map(p=>p[0]))+Math.max(...pts.map(p=>p[0])))/2,y=(Math.min(...pts.map(p=>p[1]))+Math.max(...pts.map(p=>p[1])))/2;
    return{pixel:[x,y],normalised:[x/im.w,1-y/im.h],inkPixels:pts.length};
   });
   out.crosses[id]=crosses[id].map(box=>({...symbol(im,box),normalised:[(box[0]+box[2])/2/im.w,1-(box[1]+box[3])/2/im.h]}));
  }
  const first=await get(1);
  for(const y of [520,237])out.railBanks.push([143,256,370].map(x=>symbol(first,[x-46,y-55,x+46,y+55])));
  const grid=await get(5);
  for(let row=9;row>=0;row--)out.grid.push(Array.from({length:4},(_,col)=>symbol(grid,[96+(col+.15)*82,61+(row+.15)*65.4,96+(col+.85)*82,61+(row+.85)*65.4])));
  const straight=await get(6);out.columns=[102,204,306,411].map(x=>symbol(straight,[x-47,331,x+47,431]));
  return out;
 });
}finally{await browser.close();}
let contacts=0,summary;
await withBlockworksRuntime(async r=>{
 const {minefieldSafe}=await r.server.ssrLoadModule('/src/minefields.ts');
 const {puffs}=await r.server.ssrLoadModule('/src/puffs.ts'),burst=puffs.burst;
 const m=r.sourceModule,l=r.l,fields=m.GROVE_FIELDS;
 const probe=(f,x,z,safe)=>{
  assert.equal(minefieldSafe(f.data,x,z),safe,`field ${f.id}: safe map at ${x}, ${z}`);
  l.minefields.reset();const p=new r.THREE.Vector3(x,0,z);
  assert.equal(l.minefields.contact(p,p,true,null),!safe,`field ${f.id}: actual pressure contact at ${x}, ${z}`);contacts++;
 };
 const world=(f,[u,v])=>[(u-.5)*m.GROVE_WIDTH,-(f.start+v*(f.end-f.start))];
 puffs.burst=()=>{};
 try{
  for(const [id,marks]of Object.entries(artwork.circles)){
   const f=fields[Number(id)-1],spots=Number(id)===4?f.data.spots.slice(-2):f.data.spots;
   assert.equal(marks.length,spots.length);
   for(const [i,mark]of marks.entries()){
    assert.ok(mark.inkPixels>500,'readable black circle');const [x,z]=world(f,mark.normalised),[sx,sz,radius]=spots[i];
    assert.ok(Math.hypot(x-sx,z-sz)<.05,`field ${id} circle ${i+1} must match the artwork centre`);
    probe(f,x,z,true);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
     probe(f,x+Math.cos(a)*(radius-.15),z+Math.sin(a)*(radius-.15),true);
     probe(f,x+Math.cos(a)*(radius+.15),z+Math.sin(a)*(radius+.15),false);
    }
   }
   for(const mark of artwork.crosses[id]){assert.equal(mark.mark,'X');probe(f,...world(f,mark.normalised),false);}
  }
  const first=fields[0],rails=m.JUNGLE_MINEFIELD_LEVEL.components.filter(c=>c.t==='rail'&&c.grp===101);
  for(const [row,marks]of artwork.railBanks.entries())for(const [col,mark]of marks.entries()){
   const rail=rails[row*3+col];assert.ok(mark.black>500,'visible rail line');
   assert.equal(rail.minefieldTrap===1,mark.mark==='X',`field 1 rail bank ${row+1}, column ${col+1}`);
   probe(first,rail.p[0],-(first.start+(row+.5)*(first.end-first.start)/2),false);
  }
  const f5=fields[4],depth=(f5.end-f5.start)/artwork.grid.length;
  for(const [row,marks]of artwork.grid.entries())for(const [col,mark]of marks.entries()){
   assert.ok(Math.max(mark.red,mark.black)>500,'readable grid symbol');
   // Check interiors near every corner too, so correct centres cannot mask
   // shifted or over-sized safe cells. Floor cells carry no painted solution.
   for(const u of [.08,.5,.92])for(const v of [.08,.5,.92])probe(f5,-6+(col+u)*3,-f5.start-(row+v)*depth,mark.mark==='O');
   const tile=m.JUNGLE_MINEFIELD_LEVEL.components.find(c=>c.grp===105&&c.nm==='Blank cardboard grid cell'&&Math.abs(c.p[0]-(-4.5+col*3))<.01&&Math.abs(c.p[2]-(-f5.start-(row+.5)*depth))<.01);
   assert.ok(tile&&tile.solid===false,'blank cardboard matches the clue grid');
  }
  const tnts=m.JUNGLE_MINEFIELD_LEVEL.components.filter(c=>c.t==='crate'&&c.kind==='tnt'&&c.grp===105);
  assert.equal(tnts.length,3);for(const c of tnts)assert.ok(minefieldSafe(f5.data,c.p[0],c.p[2]),'TNT remains on a painted safe square');
  const f6=fields[5];assert.equal(f6.end-f6.start,3*m.GROVE_FIELD_LENGTH);
  for(const [col,mark]of artwork.columns.entries()){
   assert.ok(Math.max(mark.red,mark.black)>500,'readable straight-column symbol');
   for(const v of [.001,.1,.5,.9,.999])probe(f6,-4.5+col*3,-f6.start-v*(f6.end-f6.start),mark.mark==='O');
  }
  for(const f of l.minefields.fields)assert.ok(f.mines.every(p=>p.y<0&&!minefieldSafe(f.data,p.x,p.z)),'no buried charge in a safe region');
  summary={contacts,mines:l.minefields.mineCount,routeLength:m.MINEFIELD_END-m.GROVE_SPAWN_S,fieldLengths:fields.map(f=>f.end-f.start),circleCount:7,gridCells:40,railMarks:6,straightColumns:4};
 }finally{puffs.burst=burst;l.minefields.reset();}
},{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield'});
const hashes={};for(const path of ['src/levels/jungle-minefield.ts',...[1,2,4,5,6].map(id=>`public/grove/clue-${id}.webp`)])hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await mkdir('/private/tmp/grove-clues',{recursive:true});
await writeFile('/private/tmp/grove-clues/review.json',JSON.stringify({pass:true,...summary,hashes,artwork},null,2));
console.log(`PASS bitmap-to-pressure audit: ${summary.circleCount} circles, ${summary.gridCells} cells, ${summary.railMarks} rails, ${summary.straightColumns} columns, ${contacts} native ground contacts; ${summary.mines} correctly buried charges.`);
