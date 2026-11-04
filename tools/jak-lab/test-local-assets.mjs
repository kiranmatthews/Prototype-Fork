import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {localJakLab} from './local-assets.mjs';

const root=await mkdtemp(path.join(tmpdir(),'jak-allowlist-'));
try {
  for(const packed of [false,true]) {
    const directory=path.join(root,packed?'packed':'raw');
    const assets=path.join(directory,packed?'assets':'opengoal/decompiler_out/jak1');
    const emission={model:'fixture',path:`death/${'a'.repeat(64)}.json.gz`,sha256:'fixture'};
    const model={path:'model.glb',sha256:'model'},escape={path:'death/escape.json.gz',sha256:'escape'};
    await mkdir(path.join(assets,'death'),{recursive:true});
    await writeFile(path.join(assets,emission.path),'emission fixture');
    await writeFile(path.join(assets,model.path),'model fixture');
    await writeFile(path.join(assets,'private.iso'),'not in the manifest');
    await writeFile(path.join(directory,'outside.json.gz'),'outside the asset root');
    await symlink(path.join(directory,'outside.json.gz'),path.join(assets,escape.path));
    await writeFile(path.join(directory,'catalogue.json'),JSON.stringify({models:[model],textures:[],
      meshDeaths:{models:[emission,escape]},...(packed?{assetDirectory:'assets',assets:[model,emission,escape]}:{})}));
    let middleware;
    localJakLab(directory).configureServer({middlewares:{use(prefix,handler){assert.equal(prefix,'/__jak-lab');middleware=handler;}}});
    const request=async url=>{
      const response={statusCode:200,headers:{},setHeader(name,value){this.headers[name]=value;},end(){this.ended=true;}};
      await middleware({method:'HEAD',url},response);assert.ok(response.ended);return response;
    };
    const emissionResponse=await request('/asset/'+emission.path);
    assert.equal(emissionResponse.statusCode,200);assert.equal(emissionResponse.headers['Content-Type'],'application/gzip');
    assert.equal(emissionResponse.headers['Content-Length'],16);
    assert.equal((await request('/asset/model.glb')).statusCode,200);
    assert.equal((await request('/asset/private.iso')).statusCode,404,'the source archive must remain outside the allowlist');
    assert.equal((await request('/asset/'+escape.path)).statusCode,404,'declared symlinks cannot escape the asset root');
  }
  console.log('PASS raw and packed emission allowlists, existing model access, undeclared archive and symlink containment');
} finally {await rm(root,{recursive:true,force:true});}
