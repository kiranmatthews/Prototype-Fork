import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const server=await createServer({appType:'custom',logLevel:'silent',cacheDir:join(tmpdir(),`enemy-catalog-test-${process.pid}`),server:{middlewareMode:true}});
try{
 const {ENEMY_KINDS}=await server.ssrLoadModule('/src/enemies/types.ts');
 const {ENEMY_NAMES,enemyThumbnail}=await server.ssrLoadModule('/src/enemies/catalog.ts');
 const models=JSON.parse(await readFile(new URL('../public/enemies/manifest.json',import.meta.url),'utf8'));
 const thumbs=JSON.parse(await readFile(new URL('../public/enemies/icons/manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(ENEMY_NAMES),[...ENEMY_KINDS]);
 assert.deepEqual(thumbs.icons.map(row=>row.kind),[...ENEMY_KINDS]);
 for(const kind of ENEMY_KINDS){
  const model=models.enemies.find(row=>row.kind===kind),thumb=thumbs.icons.find(row=>row.kind===kind);
  const png=await readFile(new URL(`../public/enemies/icons/${kind}.png`,import.meta.url));
  assert.equal(ENEMY_NAMES[kind],model.name);assert.ok(enemyThumbnail(kind).endsWith(`/enemies/icons/${kind}.png`));
  assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);
  assert.equal(thumb.modelSha256,model.sha256,'thumbnail source model changed; regenerate icons');
  assert.equal(thumb.pngSha256,createHash('sha256').update(png).digest('hex'));
 }
 console.log('PASS all eight editor/review names and rendered thumbnails match the shipped model manifest.');
}finally{await server.close();}
