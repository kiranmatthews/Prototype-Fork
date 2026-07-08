import { defineConfig } from 'vite';

// Relative base so the build works both at a domain root and on a subpath
// like GitHub Pages (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
});
