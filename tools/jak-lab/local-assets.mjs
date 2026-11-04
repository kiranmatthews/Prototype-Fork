import {createReadStream} from 'node:fs';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';

/** Explicit local catalogue allowlist. The game archive is never a public root. */
export function localJakLab(directory = process.env.JAK_LAB_DIR) {
  return {
    name: 'local-jak-whole-game-lab', apply: 'serve',
    configureServer(server) {
      if (!directory) return;
      const root = path.resolve(directory);
      let snapshot;
      const catalogue = async () => snapshot ??= readFile(path.join(root, 'catalogue.json'), 'utf8')
        .then(text => {
          const document = JSON.parse(text);
          const exported = path.join(root, document.assetDirectory === 'assets'
            ? 'assets' : 'opengoal/decompiler_out/jak1');
          return {text, exported, allowed: new Map((document.assets ?? [...document.models, ...document.textures])
            .map(asset => [asset.path, asset.sha256]))};
        });
      server.middlewares.use('/__jak-lab', async (req, res) => {
        if (!['GET', 'HEAD'].includes(req.method ?? '')) {res.statusCode = 405; res.end(); return;}
        try {
          const requested = decodeURIComponent((req.url ?? '').split('?')[0]);
          const {text, exported, allowed} = await catalogue();
          if (requested === '/catalogue.json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(req.method === 'HEAD' ? undefined : text); return;
          }
          const relative = requested.slice('/asset/'.length);
          if (!requested.startsWith('/asset/') || !allowed.has(relative)) {
            res.statusCode = 404; res.end(); return;
          }
          const file = await realpath(path.join(exported, relative));
          const base = await realpath(exported);
          if (!file.startsWith(base + path.sep)) {res.statusCode = 404; res.end(); return;}
          res.setHeader('Content-Type', file.endsWith('.gz') ? 'application/gzip' : file.endsWith('.glb') ? 'model/gltf-binary'
            : file.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
          res.setHeader('Content-Length', (await stat(file)).size);
          res.setHeader('ETag', '"' + allowed.get(relative) + '"');
          res.setHeader('Cache-Control', 'private, max-age=3600');
          if (req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
        } catch (error) {
          res.statusCode = error instanceof URIError ? 400 : 503;
          res.end('Local Jak catalogue unavailable. Run tools/jak-lab/catalogue.py and set JAK_LAB_DIR.');
        }
      });
    },
  };
}
