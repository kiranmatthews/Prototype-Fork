import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const fixture=await build({stdin:{contents:`export * from './src/golf-cart/model';export * from './src/golf-cart/driver';export {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',write:false});
const {GolfCartKit,GolfDriverKit,DRIVER_STYLES,GLTFExporter}=await import('data:text/javascript;base64,'+Buffer.from(fixture.outputFiles[0].text).toString('base64'));
globalThis.FileReader=class {result=null;onloadend=null;readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();});}};
const output='public/golf-cart';await mkdir(output,{recursive:true});
const kit=new GolfCartKit(),drivers=new GolfDriverKit(),cart=kit.create(),exporter=new GLTFExporter(),manifest=[];
async function save(root,name){root.updateMatrixWorld(true);const bytes=Buffer.from(await exporter.parseAsync(root,{binary:true,onlyVisible:true}));const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  if(!json.nodes?.length||!json.meshes?.length)throw Error('Empty export');
  await writeFile(`${output}/${name}.glb`,bytes);manifest.push({file:`${name}.glb`,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),nodes:json.nodes.length,meshes:json.meshes.length});
}
await save(cart.root,'golf-cart-modular');
for(const style of DRIVER_STYLES){const driver=drivers.create(style);driver.update({time:0,steer:0,roll:0,pitch:0,impact:0,speed:0});await save(driver.root,`driver-${style}`);if(style==='captain'){cart.setDriver(driver);await save(cart.root,'golf-cart-with-driver');cart.setDriver(null);}driver.dispose();}
await writeFile(`${output}/manifest.json`,JSON.stringify({version:1,units:'metres',forward:'-Z',driverOrigin:'seated hip; attach to DriverSocket',source:'src/golf-cart',generation:'Original procedural geometry; imagegen concept art; no Meshy credits used',files:manifest},null,2));
cart.dispose();kit.dispose();drivers.dispose();console.log(JSON.stringify(manifest,null,2));
