import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Local study files never enter public/, Rollup inputs or release assets. */
export function localJakAudio(directory = process.env.JAK_REFERENCE_AUDIO_DIR) {
  return {
    name: 'local-jak-audio',
    apply: 'serve',
    configureServer(server) {
      if (!directory) return;
      const root = path.resolve(directory);
      const motionRoot = path.resolve(process.env.JAK_REFERENCE_MOTION_DIR ?? path.dirname(root));
      server.middlewares.use('/__jak-reference-motion', async (req, res) => {
        const file = (req.url ?? '').split('?')[0].slice(1);
        if (!['GET','HEAD'].includes(req.method ?? '') || !['motion.json','eichar-lod0.glb'].includes(file)) {
          res.statusCode = 404; res.end(); return;
        }
        try {
          const bytes = await readFile(path.join(motionRoot, file));
          res.setHeader('Content-Type', file.endsWith('.glb') ? 'model/gltf-binary' : 'application/json'); res.setHeader('Cache-Control','no-store');
          res.end(req.method === 'HEAD' ? undefined : bytes);
        } catch { res.statusCode = 404; res.end(); }
      });
      server.middlewares.use('/__jak-reference-audio', async (req, res) => {
        const file = (req.url ?? '').split('?')[0].slice(1);
        if (!['GET', 'HEAD'].includes(req.method ?? '') ||
            !/^(?:manifest\.json|jump(?:-double)?-[1-3]\.wav)$/.test(file)) {
          res.statusCode = 404; res.end(); return;
        }
        try {
          const bytes = await readFile(path.join(root, file));
          res.setHeader('Content-Type', file.endsWith('.wav') ? 'audio/wav' : 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Length', bytes.length);
          res.end(req.method === 'HEAD' ? undefined : bytes);
        } catch { res.statusCode = 404; res.end(); }
      });
    },
  };
}
