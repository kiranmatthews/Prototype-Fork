import { defineConfig } from 'vite';
import { offlineBuild } from './tools/offline-build.mjs';

// Relative base so the build works both at a domain root and on a subpath
// like GitHub Pages (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [offlineBuild()],
  build: {
    rollupOptions: {
      input: {
        // The offline manifest includes the game and these companion tools.
        index: 'index.html',
        crtReview: 'crt-review.html',
        skateboardLab: 'skateboard-lab.html',
        skatePoseReview: 'skate-pose-review.html',
        spinLab: 'spin-lab.html',
        milkReview: 'milk-review.html',
        resetLocalData: 'reset-local-data.html',
        rooTypeLab: 'roo-type-lab.html',
      },
    },
  },
  resolve: {
    // Postprocessing add-ons and the app must share one core singleton; two
    // Three instances split instanceof checks and emit a runtime warning.
    dedupe: ['three'],
  },
  define: {
    // Baked at build time and shown in the HUD corner, so a playtest can
    // always tell WHICH build it's actually running (cache-confusion killer).
    __BUILD_TAG__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ') + ' UTC'),
    __BUILD_CHANNEL__: JSON.stringify('Codex/sol fork'),
  },
});
