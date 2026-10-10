import * as THREE from 'three';
import {Level,findLevel,getUserLevels,setUserLevels,setEditorBuild} from '../src/level';
import {configureJungleAssetRenderer} from '../src/jungleAssets';
import {configureCityAssetRenderer} from '../src/cityAssets';
import {presentationAssets} from '../src/presentationLoading';
import {ENEMY_NAMES} from '../src/enemies/catalog';
const status=document.querySelector('#status')!;
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
configureJungleAssetRenderer(renderer);configureCityAssetRenderer(renderer);
document.querySelector('#preview')!.append(renderer.domElement);
const canvas=document.createElement('canvas'),context=canvas.getContext('2d')!;
const save=async(name:string,data:unknown)=>{const r=await fetch('/__atlas/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,data})});if(!r.ok)throw new Error(await r.text());};
const crateKind=(c:any)=>c.nitro?'nitro':c.tnt?'tnt':c.bang?'switch':c.nitroBang?'nitro-clear':c.metal?'metal':c.bouncy?'bounce':c.metalBounce?'metal-bounce':c.mask?'mask':c.life?'life':c.multiHit?'multihit':c.mystery?'mystery':'wood';
const portraitCache=new Set<string>();
const previewButton=document.createElement('button');previewButton.textContent='Save atlas preview';document.querySelector('#start')!.after(previewButton);
previewButton.onclick=async()=>{
 const svg=await(await fetch('/provenance/level-atlas/21-crate-primer.svg')).text(),image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try{await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=reject;image.src=url;});canvas.width=1600;canvas.height=Math.round(1600*image.height/image.width);context.drawImage(image,0,0,canvas.width,canvas.height);await save('atlas-preview.webp',canvas.toDataURL('image/webp',.95));status.textContent='Preview saved · Crate Primer, scenery and object markers';}finally{URL.revokeObjectURL(url);}
};
async function portrait(object:THREE.Object3D,key:string){
 const name=`icon-${key}.png`;if(portraitCache.has(name))return 'art/'+name;
 const parent=object.parent,scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x798872,2.5));const sun=new THREE.DirectionalLight(0xfff0d8,3);sun.position.set(-5,10,8);scene.add(sun);scene.add(object);object.updateMatrixWorld(true);
 const b=new THREE.Box3().setFromObject(object),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,1)*.83;
 const camera=new THREE.OrthographicCamera(-span,span,span,-span,.1,20000);camera.position.copy(center).add(new THREE.Vector3(.7,.55,1).normalize().multiplyScalar(Math.max(span*5,15)));camera.lookAt(center);camera.updateMatrixWorld(true);
 renderer.setClearColor(0x000000,0);renderer.setSize(112,112);renderer.render(scene,camera);canvas.width=112;canvas.height=112;context.clearRect(0,0,112,112);context.drawImage(renderer.domElement,0,0);await save(name,canvas.toDataURL('image/png'));if(parent)parent.add(object);portraitCache.add(name);return 'art/'+name;
}
document.querySelector<HTMLButtonElement>('#start')!.onclick=async()=>{
 const button=document.querySelector<HTMLButtonElement>('#start')!;button.disabled=true;
 const reports:any[]=[];
 try{
  const inventory=await(await fetch('/provenance/level-atlas/inventory.json')).json();
  const pack=await(await fetch('/levels.json')).json();setUserLevels(pack.levels);if(getUserLevels().length!==pack.levels.length)throw new Error('Invalid registry');setEditorBuild(true);
  for(const row of inventory.levels){
   const scene=new THREE.Scene();scene.background=new THREE.Color('#d9e8e1');
   scene.add(new THREE.HemisphereLight(0xfff9e6,0x738875,2.25));const sun=new THREE.DirectionalLight(0xffefcd,2.5);sun.position.set(-50,120,70);scene.add(sun);
   status.textContent=`${row.order}/26 · Loading ${row.name}`;
   const entry=findLevel(row.levelId);if(!entry)throw new Error('Missing '+row.levelId);
   const level=new Level(scene,entry);await level.prepareJungleAssets();await presentationAssets.waitUntilSettled();
   scene.fog=null;level.pickRoot.updateMatrixWorld(true);
   // Editor guides and collision-only meshes must not paint over scenery.
   level.pickRoot.traverse(o=>{if(o.userData.editorGhost)o.visible=false;});
   const p=row.projection,ppm=4,fullW=Math.round((p.maxX-p.minX)*ppm),fullH=Math.round((p.maxZ-p.minZ)*ppm);let tiles:any[]=[];
   const previousResponse=await fetch(`/provenance/level-atlas/art/${String(row.order).padStart(2,'0')}-${row.progressKey}.json`);const previous=previousResponse.ok?await previousResponse.json():null;if(previous?.snapshotId===row.snapshotId)tiles=previous.tiles;
   let high=150;for(const mesh of level.groundMeshes){const b=new THREE.Box3().setFromObject(mesh);if(Number.isFinite(b.max.y))high=Math.max(high,b.max.y+100);}
   const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,high+2000);camera.up.set(0,0,-1);
   if(!tiles.length)for(let y=0;y<fullH;y+=2048)for(let x=0;x<fullW;x+=2048){
    const w=Math.min(2048,fullW-x),h=Math.min(2048,fullH-y),cx=p.minX+(x+w/2)/ppm,cz=p.minZ+(y+h/2)/ppm;
    camera.left=-w/ppm/2;camera.right=w/ppm/2;camera.top=h/ppm/2;camera.bottom=-h/ppm/2;camera.position.set(cx,high,cz);camera.lookAt(cx,0,cz);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    renderer.setSize(w,h);renderer.render(scene,camera);
    const name=`${String(row.order).padStart(2,'0')}-${row.progressKey}-${x}-${y}.webp`;
    canvas.width=w;canvas.height=h;context.drawImage(renderer.domElement,0,0);await save(name,canvas.toDataURL('image/webp',.88));
    tiles.push({file:'art/'+name,x:p.offsetX+x*2,y:p.offsetY+y*2,width:w*2,height:h*2,worldX:p.minX+x/ppm,worldZ:p.minZ+y/ppm});
    status.textContent=`${row.order}/26 · ${row.name} · ${tiles.length} scenery tiles saved`;
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
   const icons:any[]=[];
   for(const [i,e] of level.enemies.entries()){
    const skin=e.group.userData.ghostSkin,key=skin||e.kind;
    icons.push({id:'E'+String(i+1).padStart(4,'0'),kind:'enemy',key,name:skin?e.group.name:ENEMY_NAMES[e.kind],file:await portrait(e.group,'enemy-'+key)});
   }
   for(const [i,c]of level.crates.entries()){
    const key=crateKind(c);icons.push({id:'K'+String(i+1).padStart(4,'0'),kind:'crate',key,name:key.replaceAll('-',' ')+' crate',file:await portrait(c.mesh,'crate-'+key)});
   }
   if(level.boss)icons.push({id:'BOSS',kind:'enemy',key:'crab-chief',name:'Crab Chief',point:level.boss.model.root.position.toArray(),file:await portrait(level.boss.model.root,'enemy-crab-chief')});
   const report={levelId:row.levelId,progressKey:row.progressKey,snapshotId:row.snapshotId,tiles,icons,pixelsPerMetre:ppm,groundMeshes:level.groundMeshes.length,sourceGroundMeshes:row.ground,assets:presentationAssets.diagnostics};
   await save(`${String(row.order).padStart(2,'0')}-${row.progressKey}.json`,report);reports.push(report);
   level.dispose();renderer.renderLists.dispose();
  }
  await save('capture-report.json',{levels:reports});status.textContent=`COMPLETE · ${reports.length} levels captured with full scenery.`;
 }catch(error){status.textContent='ERROR · '+String(error);console.error(error);}finally{button.disabled=false;}
};
