# Kart Gouraud fire review

The three bounded batches render untextured tongues and embers. Two hot vertices, an orange inner ring and transparent outer vertices provide Gouraud gradients. Vertex deformation faces the active render camera; emitted particles retain birth positions and velocity after the source moves or stops. Yellow is confined near the nozzle, and wreck fire settles into the existing burnt husk.

The native and normal-resolution production captures were inspected. The browser check covers side/end-on views, animated fire, cutoff and complete burnout with no WebGL or console errors. The native 1280×720 eight-wreck sample averages 16.67 ms; fire presentation averages 0.44 ms. The existing two-seed mass-burnout regression finishes all eight racers in both runs, with zero falls.

Reproduce with `node tools/test-cart-fire.mjs`, `node tools/test-cart-drivers.mjs`, `node tools/test-cart-polish.mjs`, `CART_FULL=1 node tools/cart-fire-browser.mjs <server>` and `node tools/cart-polish-browser.mjs <server>`. Browser scripts accept `PLAYWRIGHT_MODULE` when Playwright is installed in the bundled runtime.
