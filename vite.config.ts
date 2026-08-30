import { defineConfig } from 'vite';

// Relative base so the build works both at a domain root and on a subpath
// like GitHub Pages (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        // Keep the entry chunk named index-*; main.ts's Pages cache-buster
        // intentionally detects that stable stem in both import.meta.url and
        // the freshly fetched HTML.
        index: 'index.html',
        crtReview: 'crt-review.html',
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
