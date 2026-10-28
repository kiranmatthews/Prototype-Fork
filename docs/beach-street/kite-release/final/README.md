# Beach release after concurrent level updates

Main advanced again to `c9636bc1345c9c2009a701396070ec16f858700a` (Coconut Cart
Rally). Merge `0d5189bb42f404880e1494e7c416c269c90f818d` preserves it together
with the Sky Bridge bonus and Beach changes. This supersedes the earlier local
candidate under `combined/`. No code conflict occurred. The five Beach source
blobs still exactly match validated source `5ddbc499`.

The cart update changes only `coconut-cart-rally` in the published pack; this
branch preserves its whole pack unchanged. Its shared `level.ts` change skips
dynamic crate rails only for golf-cart races. Beach uses the same pre-existing
crate loop and no stadium/race runtime. The cart owner's successful level,
build and browser checks remain in `docs/cart-live-grid/`. No level-check result
was invalidated by integration. Native Beach controls, including crate
collision, grind and bonus behavior, were repeated and pass.

The final production build, release size and fresh full-render Chrome opening
pass succeed. Chrome tests the delivered level without a built-in restore;
there are no crashes, console/asset errors or clipped canopies. Both native
1600×1000 captures were reviewed. The earlier full-course, slow gust,
one-second brake, manual, bonus retry and extreme-framing evidence remains
applicable to the unchanged Beach source.

- Build: `Codex/sol fork · build 10-28 08:58 UTC`
- Offline version: `606ebb98fcdacbd8d73b`
- Entry: `assets/index-DmyNbHPx.js`
- Output: 1,847 files, 997,048,707 bytes (limit 1,000,000,000)
- Build completed 08:59:01 UTC; browser completed 08:59:50 UTC.

`verification.json` records the exact source and evidence. Public verification
will use a fresh browser against the actual Pages URL after its matching run
succeeds, and is recorded separately in `../public/`.
