import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

const destination=process.argv[2]??'/private/tmp/crate-layout.json';
const result=[];
const baseline=process.env.CRATE_BASELINE?JSON.parse(await readFile(process.env.CRATE_BASELINE,'utf8')):[];
await withSkateRuntime(async({server,THREE,Level})=>{
  const {CRATE_SIZE,RACE_CRATE_SIZE}=await server.ssrLoadModule("/src/crateDimensions.ts");
  const {BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
  const published=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8')).levels;
  const entries=[...BUILTIN_LEVELS.map(entry=>({entry,source:'builtin'})),...published.map(entry=>({entry,source:'published'}))];
  for(const {entry,source} of entries){
    if(process.env.CRATE_LEVELS&&!process.env.CRATE_LEVELS.split(",").includes(entry.id))continue;
    const level=new Level(new THREE.Scene(),entry);
    try{
      level.root.updateMatrixWorld(true);
      const boxes=[...level.crates.map(c=>({c,kind:'crate',box:c.box,mesh:c.mesh})),...level.checkpoints.map(c=>({c,kind:'checkpoint',box:c.box,mesh:c.mesh}))];
      const row={id:entry.id,source,crates:boxes.map(({c,kind,box,mesh})=>({kind,p:mesh.position.toArray(),min:box.min.toArray(),max:box.max.toArray(),ground:mesh.userData.groundBaseY,concealed:!!c.concealed,pending:!!c.pending,metal:!!c.metal,bouncy:!!c.bouncy||!!c.metalBounce,race:!!level.skateRace&&!!c.mystery,idx:mesh.userData.editorIdx})),overlaps:[],walls:[]};
      for(let i=0;i<boxes.length;i++){
        const a=boxes[i].box;
        for(let j=i+1;j<boxes.length;j++){
          const b=boxes[j].box,depth=['x','y','z'].map(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]));
          if(Math.min(...depth)>.025&&!boxes[i].c.concealed&&!boxes[j].c.concealed)row.overlaps.push({i,j,depth});
        }
        for(let j=0;j<level.walls.length;j++){
          const b=level.walls[j],depth=['x','y','z'].map(k=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]));
          if(Math.min(...depth)>.025&&!boxes[i].c.concealed)row.walls.push({i,j,depth,min:b.min.toArray(),max:b.max.toArray()});
        }
      }
      const before=baseline.find(b=>b.id===entry.id&&b.source===source);
      row.supportLoss=[];
      row.stackLoss=[];
      const groundAt=(p,base)=>{
        const ray=new THREE.Raycaster(new THREE.Vector3(p[0],base+.08,p[2]),new THREE.Vector3(0,-1,0),0,.18);
        return ray.intersectObjects(level.groundMeshes,false).find(hit=>Math.abs(hit.point.y-base)<.07)?.point.y??null;
      };
      if(before)for(let i=0;i<boxes.length;i++){
        const old=before.crates[i],c=row.crates[i];
        if(!old||old.concealed||old.race||old.pending)continue;
        if(groundAt(old.p,old.min[1])!==null&&groundAt(c.p,c.min[1])===null&&
          !row.crates.some((b,j)=>j!==i&&Math.abs(b.max[1]-c.min[1])<.03&&Math.abs(b.p[0]-c.p[0])<.72&&Math.abs(b.p[2]-c.p[2])<.72))
          row.supportLoss.push({i,before:old.p,after:c.p,base:c.min[1],idx:c.idx});
      }
      if(before&&before.crates.length===row.crates.length)for(let i=0;i<before.crates.length;i++)for(let j=0;j<before.crates.length;j++){
        const a=before.crates[i],b=before.crates[j],na=row.crates[i],nb=row.crates[j];
        if(i===j||a.concealed||b.concealed||a.race||b.race)continue;
        if(Math.abs(a.max[1]-b.min[1])<.02&&Math.abs(a.p[0]-b.p[0])<.6&&Math.abs(a.p[2]-b.p[2])<.6&&
          (Math.abs(na.max[1]-nb.min[1])>.025||Math.abs(na.p[0]-nb.p[0])>.73||Math.abs(na.p[2]-nb.p[2])>.73))
          row.stackLoss.push({i,j,oldGap:b.min[1]-a.max[1],newGap:nb.min[1]-na.max[1]});
      }
      const label=`${source}/${entry.id}`;
      for(const c of row.crates)for(let axis=0;axis<3;axis++)
        assert.ok(Math.abs(c.max[axis]-c.min[axis]-(c.race?RACE_CRATE_SIZE:CRATE_SIZE))<1e-6,`${label}: incorrect crate dimensions`);
      assert.deepEqual(row.overlaps,[],`${label}: overlapping boxes`);
      // Race item pickups are non-solid and may sit in authored scenery;
      // all physical crate and checkpoint bodies must clear world walls.
      assert.deepEqual(row.walls.filter(w=>!row.crates[w.i].race),[],`${label}: crate intersects a wall`);
      assert.deepEqual(row.supportLoss,[],`${label}: lost ground support`);
      assert.deepEqual(row.stackLoss,[],`${label}: changed stack support`);
      if(before){
        assert.equal(row.crates.length,before.crates.length,`${label}: crate/checkpoint count changed`);
        const priorWalls=new Set(before.walls.map(w=>`${w.i}:${w.j}`));
        assert.deepEqual(row.walls.filter(w=>!priorWalls.has(`${w.i}:${w.j}`)),[],`${label}: new wall intersections`);
      }
      result.push(row);console.log(`${source}/${entry.id}: ${boxes.length} crates, ${row.overlaps.length} overlaps, ${row.walls.length} wall contacts, ${row.supportLoss.length} lost supports, ${row.stackLoss.length} changed stack contacts`);
    }finally{level.dispose();}
  }
},{levelEntry:{id:'__crate_audit',name:'Crate audit',data:{v:1,name:'Crate audit',spawn:[0,1,0],killY:-20,components:[]}}});
await writeFile(destination,JSON.stringify(result,null,2)+'\n');
console.log(`Saved ${result.length} level layouts to ${destination}`);
