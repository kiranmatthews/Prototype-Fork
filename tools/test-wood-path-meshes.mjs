import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import * as THREE from 'three';

const server = await createServer({appType:'custom', logLevel:'silent', server:{middlewareMode:true}});
try {
  const kit = await server.ssrLoadModule('/src/woodPathKit.ts');
  const art = await server.ssrLoadModule('/src/woodPathMeshes.ts');
  const {BOARDWALK_MESH_DATA:data} = await server.ssrLoadModule('/src/boardwalkMeshes.generated.ts');
  const manifest = JSON.parse(await readFile(new URL('./boardwalk/asset-manifest.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(data).length,9,'three actual meshes per member family');
  const signatures = new Set();
  for(const [name,model] of Object.entries(data)) {
    assert.equal(model.positions.length%3,0);
    assert.equal(model.uvs.length,model.positions.length/3*2);
    assert.equal(model.colors.length,model.positions.length);
    assert.ok(model.positions.every(Number.isFinite),name);
    assert.ok(model.indices.every(i=>Number.isInteger(i)&&i>=0&&i<model.positions.length/3));
    assert.ok(model.indices.length/3>=100 && model.indices.length/3<=500,`${name} low-poly budget`);
    assert.equal(manifest[name].triangles,model.indices.length/3);
    assert.equal(manifest[name].provider,'Meshy');
    signatures.add(createHash('sha256').update(JSON.stringify(model.positions)).digest('hex'));
    const bounds = new THREE.Box3().setFromArray(model.positions), size=bounds.getSize(new THREE.Vector3());
    assert.ok(bounds.getCenter(new THREE.Vector3()).length()<1e-5,`${name} centred pivot`);
    if(model.family==='plank') assert.ok(size.distanceTo(new THREE.Vector3(1,1,1))<1e-5,`${name} fitted XYZ envelope`);
    else {
      assert.ok(Math.abs(size.y-1)<1e-5,`${name} length along Y`);
      assert.ok(Math.max(size.x,size.z)<=2.00001,`${name} radial envelope`);
    }
    assert.ok(model.uvs.every(value=>value>=0&&value<=1),`${name} local atlas UVs`);
  }
  assert.equal(signatures.size,9,'variants must differ in geometry, not just tint');
  const atlas=await readFile(new URL('../public/boardwalk/rustic-atlas.webp',import.meta.url));
  assert.equal(createHash('sha256').update(atlas).digest('hex'),manifest.atlas.sha256);
  assert.ok(atlas.length<350000,'single compact shared paint atlas');

  const sampler={length:110,sampleAtDistance(d){
    const a=d*.006, forward=[Math.sin(a),0,Math.cos(a)], right=[Math.cos(a),0,-Math.sin(a)];
    const bank=.09*Math.sin(d*.04);
    return {center:[(1-Math.cos(a))/.006,2+d*.012,Math.sin(a)/.006],forward,
      right:[right[0]*Math.cos(bank),Math.sin(bank),right[2]*Math.cos(bank)],
      up:[-right[0]*Math.sin(bank),Math.cos(bank),-right[2]*Math.sin(bank)],width:5+Math.sin(d*.03)};
  }};
  const options={plankSeed:7391,poleSeed:7391^0x6f2b,profile:kit.UNITY_BEACH_BOARDWALK_PROFILE,
    plankVariantWeights:art.WOOD_PATH_PLANK_WEIGHTS,poleVariantWeights:art.WOOD_PATH_POLE_WEIGHTS};
  const layout=kit.buildWoodPathLayout(sampler,options);
  const plain=kit.buildWoodPathLayout(sampler,{...options,plankVariantWeights:[1],poleVariantWeights:[1]});
  for(const key of ['rails','balustradeBarriers','bents']) assert.deepEqual(layout[key],plain[key],`${key} collision/layout independent of models`);
  const groups=art.buildWoodPathMeshes(layout,7391,'placeholder-board','placeholder-pole');
  assert.equal(groups[0].userData.woodPathPalette,art.RUSTIC_PLANK_PALETTE,'old beach snapshots upgrade');
  assert.equal(groups[1].userData.woodPathPalette,art.RUSTIC_POLE_PALETTE);
  const members=[layout.planks,layout.poles];
  const used=new Set();
  for(let g=0;g<groups.length;g++) {
    const seen=new Set();
    for(const mesh of groups[g].children) {
      assert.ok(mesh.isInstancedMesh && mesh.geometry.type==='BufferGeometry');
      assert.ok(mesh.geometry.userData.shared && mesh.material.userData.shared);
      assert.ok(mesh.boundingSphere.radius>0 && mesh.frustumCulled,'chunks have valid culling bounds');
      used.add(mesh.userData.woodPathModel);
      for(let i=0;i<mesh.count;i++) {
        const index=mesh.userData.woodPathMemberIndices[i], member=members[g][index];
        assert.ok(!seen.has(index),'every member rendered exactly once');seen.add(index);
        const matrix=new THREE.Matrix4();mesh.getMatrixAt(i,matrix);
        assert.ok(matrix.determinant()>0,'no reflected winding from randomized fitting');
        assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(...member.center))<1e-4);
        if(g===1) {
          assert.ok(new THREE.Vector3(0,-.5,0).applyMatrix4(matrix).distanceTo(new THREE.Vector3(...member.start))<1e-4);
          assert.ok(new THREE.Vector3(0,.5,0).applyMatrix4(matrix).distanceTo(new THREE.Vector3(...member.end))<1e-4);
          assert.equal(mesh.userData.woodPathMeshFamily,member.role==='top-rail'?'rope':'timber');
        } else {
          const up=new THREE.Vector3(...member.basis.up), centre=new THREE.Vector3(...member.center);
          const pos=mesh.geometry.attributes.position;let top=-Infinity;
          for(let v=0;v<pos.count;v++) top=Math.max(top,new THREE.Vector3().fromBufferAttribute(pos,v).applyMatrix4(matrix).sub(centre).dot(up));
          assert.ok(Math.abs(top-member.size[1]/2)<2e-5,'plank top stays at the supported authored height on banks');
        }
      }
    }
    assert.equal(seen.size,members[g].length);
  }
  assert.equal(used.size,9,'seeded sample uses all nine meshes');
  const repeat=art.buildWoodPathMeshes(kit.buildWoodPathLayout(sampler,options),7391);
  for(let g=0;g<2;g++)for(let i=0;i<groups[g].children.length;i++){
    const a=groups[g].children[i],b=repeat[g].children[i];
    assert.equal(a.geometry,b.geometry,'templates shared across rebuilt paths');
    assert.equal(a.material,b.material,'one shared atlas material');
    assert.deepEqual(a.instanceMatrix.array,b.instanceMatrix.array,'reload keeps deterministic assignments and poses');
  }
  const changed=kit.buildWoodPathLayout(sampler,{...options,plankSeed:2026,poleSeed:2026^0x6f2b});
  assert.notDeepEqual(changed.planks.map(p=>p.variantIndex),layout.planks.map(p=>p.variantIndex),'different path seeds vary the model mix');
  console.log(`PASS rustic boardwalk: nine distinct original Meshy members, compact atlas, banked fitting, ${layout.planks.length+layout.poles.length} seeded instances, shared templates, independent collision and chunk culling.`);
} finally {await server.close();}
