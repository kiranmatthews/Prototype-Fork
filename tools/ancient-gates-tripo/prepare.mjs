import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {measureGlb,surfaceAt} from './ancient-native-measure.mjs';
const models={trialsv2plank:'treehouse-trials-v2/plank',hazardironlink:'hazards/iron-link',ancienttikigate:'ancient-gates-tripo/tiki-gateway',ancientcanyonrock:'ancient-gates-tripo/canyon-buttress',ancienttikipier:'ancient-gates-tripo/tiki-support-pier',ancienttikishrine:'ancient-gates-tripo/tiered-shrine',ancienttropicalplant:'ancient-gates-tripo/rooted-tropical-cluster',trialsv2treea:'treehouse-trials-v2/tree-a',trialsv2treeb:'treehouse-trials-v2/tree-b',trialsv2beam:'treehouse-trials-v2/beam',treehousemossrock:'treehouse-trials/boulder',stonepaver:'jungle-kit/modular/paving-slab',stonecornice:'jungle-kit/modular/cornice'};
const bounds={},records=[];
for(const [kind,file] of Object.entries(models)){const path='public/'+file+'.glb',data=await measureGlb(path);bounds[kind]=data.size;records.push({kind,...data,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});if(data.materials!==1)throw Error(kind+' must have one atlas');}
const crown=await surfaceAt('public/ancient-gates-tripo/canyon-buttress.glb');
await writeFile('src/ancientGatesAssetBounds.ts','// Measured from shipped native GLBs by tools/ancient-gates-tripo/prepare.mjs.\nexport const ANCIENT_NATIVE_SIZE='+JSON.stringify(bounds,null,2)+' as const;\nexport const ANCIENT_CLIFF_CROWN='+crown+';\n');
const labels={ancienttikigate:'Tiki guardian gateway',ancientcanyonrock:'Sculpted sandstone canyon buttress',ancienttikipier:'Load-bearing tiki pier',ancienttikishrine:'Tiered tiki shrine',ancienttropicalplant:'Rooted tropical planting'};
const specs=Object.fromEntries(Object.keys(labels).map(kind=>[kind,{file:'../'+models[kind],label:'Ancient Gates · '+labels[kind],size:bounds[kind],wind:false,normalStrength:.12,roughness:.85,doubleSided:kind==='ancienttropicalplant',cellSize:32}]));
// Stable painting kinds support saved editor levels and the added distant mattes.
const old=JSON.parse(await readFile('tools/ancient-gates-tripo/legacy-mattes.json','utf8'));
await writeFile('src/ancientGatesAssets.ts','/** Native game meshes and painted far-background scenery. */\nexport const ANCIENT_GATES_ASSETS='+JSON.stringify({...old,...specs},null,2)+' as const;\n');
await writeFile('docs/ancient-gates/tripo/native-assets.json',JSON.stringify({geometryPolicy:'Original generated triangles and vertices; no simplification or distance LODs.',rockCrownNormalized:crown,assets:records},null,2)+'\n');
console.log(JSON.stringify(records.map(({kind,triangles,bytes,size})=>({kind,triangles,bytes,size})),null,2));
