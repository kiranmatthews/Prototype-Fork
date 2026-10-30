export async function installCarlisleRenderComparison(){
  const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  const root=g.scene.getObjectByName('Carlisle shipyard art'),sources=[],old=[],batches=new Map(),hashes=new Map(),netMaterials=[];let shaderChecks=0;
  root.traverse(n=>{if(n.isInstancedMesh&&n.name!=='Solid timber modules'&&!n.name.startsWith('Solid pier ')&&!n.material.transparent)sources.push(n);});
  const digest=async array=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(array.buffer,array.byteOffset,array.byteLength)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  for(const n of sources){
   let hash=hashes.get(n.geometry);if(!hash){const parts=[];for(const[key,a]of Object.entries(n.geometry.attributes))if(!a.isInstancedBufferAttribute)parts.push([key,a.itemSize,await digest(a.array)]);parts.push(['index',await digest(n.geometry.index.array)]);hash=JSON.stringify(parts);hashes.set(n.geometry,hash);}
   const key=[n.parent.uuid,n.name,n.material.uuid,hash].join(':');let b=batches.get(key);if(!b){b={n,matrices:[],attributes:{}};batches.set(key,b);}
   for(let i=0;i<n.count;i++)b.matrices.push(n.matrix.clone().fromArray(n.instanceMatrix.array,i*16));
   for(const[key,a]of Object.entries(n.geometry.attributes))if(a.isInstancedBufferAttribute)(b.attributes[key]??=[]).push(...a.array);
  }
  for(const b of batches.values()){
   const original=b.n,geometry=Object.keys(b.attributes).length?original.geometry.clone():original.geometry;
   for(const[key,array]of Object.entries(b.attributes)){const a=original.geometry.attributes[key];geometry.setAttribute(key,new a.constructor(new a.array.constructor(array),a.itemSize,a.normalized,a.meshPerAttribute));}
   const mesh=new original.constructor(geometry,original.material,b.matrices.length);mesh.name=original.name+' reference';mesh.castShadow=original.castShadow;mesh.receiveShadow=original.receiveShadow;
   b.matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.computeBoundingSphere();mesh.visible=false;original.parent.add(mesh);old.push(mesh);
  }
  g.scene.traverse(n=>{if(n.name!=='Woven ropes, knots and eight threaded lashings')return;
   for(const key of ['material','customDepthMaterial','customDistanceMaterial']){
    const current=n[key],prior=current.clone(),compile=current.onBeforeCompile;
    prior.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);const line='if(netAge>=2. && netPreview==0.)return 0.;';if(!shader.vertexShader.includes(line))throw Error('Expected settled-net branch missing');shader.vertexShader=shader.vertexShader.replace(line,'');shaderChecks++;};
    prior.customProgramCacheKey=()=>current.customProgramCacheKey()+'-pre-settle-reference';netMaterials.push({n,key,current,prior});
   }
  });
  const state=which=>{sources.forEach(n=>n.visible=which!=='prior'&&which!=='priorBatches');old.forEach(n=>n.visible=which==='prior'||which==='priorBatches');netMaterials.forEach(e=>e.n[e.key]=e[which==='prior'||which==='priorNets'?'prior':'current']);};
  window.__renderComparison={state,sources,old,netMaterials,shaderChecks:()=>shaderChecks};
  return{sourceBatches:sources.length,priorBatches:old.length,netMaterials:netMaterials.length};
}
