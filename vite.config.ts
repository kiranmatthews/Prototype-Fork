import { defineConfig } from 'vite';

// Relative base so the build works both at a domain root and on a subpath
// like GitHub Pages (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  define: {
    // Baked at build time and shown in the HUD corner, so a playtest can
    // always tell WHICH build it's actually running (cache-confusion killer).
    __BUILD_TAG__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ') + ' UTC'),
  },
});
