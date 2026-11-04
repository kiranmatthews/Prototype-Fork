# Shared sky restoration — 4 November 2026

Restored `src/skyProjection.ts` byte for byte from the parent of Banana Bay's
`f441f4c6` sky change. Its Git blob is
`0a55a2534205b99b9797736c15cf56067dfbb84d` in both versions. This restores the
original shader source, uniforms, cache key and Skystream sun path.

Banana Bay retains its exact cloud painting, western mainland, lighting and
shoreline. Its HDR sun is now a separate shader extension enabled only for
`beachfront` with the `tropical-clouds` preset. Its flare has a separate direction
and visibility state from Skystream. Leaving Banana Bay returns the original
shader program, with no Banana Bay sun uniform or branch.

The history comparison found no replacements to the other sky artwork files
in the Banana Bay change. Those files and all level data remain untouched by
this rollback; existing painted, procedural and fog backdrops retain their
authored settings.

Validation:

- Focused shader isolation check: repeated ocean, land and Skystream switches
  restore identical original source, uniforms and program key.
- Existing atmosphere runtime/history/security checks: 428/428 pass. Their
  headless asset stubs emit the existing bonus-platform 404 warnings.
- Real browser review: Sunset Safari, Banana Bay, Beach Street, Tribal Run,
  Treehouse Trails, Sky Bridge and Skystream, including returning from Banana
  Bay and Skystream. No browser warnings/errors after the final changes.
- MAX/native framebuffer and normal 480-line presentation checked. Banana Bay's
  original sun review camera still produces the same clouds and bloom sun.
- Production build/type-check passes; release output is 810,285,333 bytes.
  No level data changed, and no full suite was run.

Evidence: [browser states](browser-checks.json), [restored sunset](sunset-native.png),
and [preserved Banana Bay sun](banana-cloud-sun-native.png). Local reproduction:
`/tools/sky-restoration-review.html?playtest&level=custard-creek`.

Approximately 12 minutes from the sky request to the first browser-reviewed
rollback; the broader browser and release checks followed.
