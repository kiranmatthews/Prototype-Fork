import {defineConfig} from 'vite';
import {createReadStream, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {localJakAudio} from './tools/local-jak-audio.mjs';
import {ktxFormatPreferences} from './tools/ktx-format-preferences.mjs';
import {toolDirectory} from './tools/tool-directory.mjs';

// Opt-in local entry. Disc-derived motion is kept outside public/ and dist/.
export default defineConfig({
  base: './',
  plugins: [ktxFormatPreferences(), localJakAudio(), toolDirectory(), {
    name: 'local-skate-reference',
    configureServer(server) {
      const file = resolve(process.env.SKATE_REFERENCE_DATA_ROOT || '.skate-reference-data', 'motion.json');
      server.middlewares.use('/__skate_reference/motion.json', (_request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'application/json');
        if (!existsSync(file)) {
          response.statusCode = 404;
          response.end(JSON.stringify({error: 'Local motion.json is missing. See docs/SKATE_PLAYTEST.md.'}));
          return;
        }
        const stream = createReadStream(file);
        stream.on('error', () => { response.destroy(); });
        stream.pipe(response);
      });
    },
  }],
  resolve: {dedupe: ['three']},
  server: {host: '127.0.0.1', port: 5199, strictPort: true,
    watch: {ignored: ['**/dist/**', '**/.skate-playtest-build/**']}},
  build: {
    outDir: '.skate-playtest-build', copyPublicDir: false,
    rollupOptions: {input: 'skate-playtest.html'},
  },
  define: {
    __BUILD_TAG__: JSON.stringify(new Date().toISOString().slice(0, 16)),
    __BUILD_CHANNEL__: JSON.stringify('Codex/sol fork · local motion study'),
  },
});
