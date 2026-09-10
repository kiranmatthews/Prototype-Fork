# V3 glyph and renderer review

All 51 nonempty Roo glyphs were inspected in green/cobalt and gold/vermilion at native HUD sizes and at a 384 px cap band. Each has neutral, left and right highlight frames. This record supersedes the earlier provisional v2 source statuses.

| Glyphs | Finding and correction |
| --- | --- |
| A C D E F G H I J K L M P Q R T V W X Y Z | The small screenshot crops left cloudy gradients, soft bevel joins and isolated dark patches when enlarged. Each received a separate new image-model cleanup pass. The final bake uses its cleaned material on the original Roo silhouette. |
| B O N U S | Retained the larger reference material and optical BONUS layout; checked edges and the new light frames. |
| 0 2 3 / | Retained the available numeral reference field; checked the equal-sized denominator and continuous counter scale. |
| 1 4 5 6 7 8 9 and remaining punctuation | Replaced the row-dependent 8-bit color normalization with a smooth floating-point material profile. Removed abrupt bands, hue excursions and unpadded matte seams. |
| P | A bright matte speck enlarged its source crop. Saturation-based registration restores the correct complete letter bounds. |
| Narrow punctuation, especially double quote | Mesh coverage differed from the actual font. Final alpha now comes from analytic source curves over a padded color field, independent of triangulation. |
| All glyphs | Original contours, holes, cap scale and bearings retained. Matte colors are excluded before edge padding. Lighting changes never move the glyph. |

Final automated results:

- 51 selected model sources and all saved prompts/input hashes verified.
- Worst overlap with an independent Roo font raster: 98.812% (slash).
- 66,946 fractional-alpha pixels per palette.
- Zero alpha differences between lighting frames or palettes.
- Zero detected pink, gray or neutral matte contamination.
- Every glyph has distinct edge highlights between left and right frames.
- Maximum crossfade alpha error: 1/255 in both Canvas and actual Chrome SVG screenshots, including overlapping letters.
- Reference cap sizes (107 px counter, 165 px BONUS), changing digit counts and full-size `/total` baseline pass.
- PNG export and the ten-file font ZIP pass.
- 50 menu layout cases pass across lite/full at 1280×720, 1920×1080, 1024×768, 390×844 and 844×390. World-map and Jungle Cup screens were also inspected.
- Saved spacing, updates across tabs and reduced-motion transitions pass.
- Actual full HUD paint sampled about 0.5 ms in the local review; this is a local sample, not a general hardware guarantee.

Raw model outputs are preserved unchanged. Some contain a painted matte or imperfect generated alpha; final font alpha is produced from Roo vectors. The built-in tool exposed neither a selectable model ID nor a quality setting. These passes are not represented as verified GPT Image 2.5/max output.

Reproduce with the tools listed in `docs/ROO_HUD_TREATMENT.md`. Browser captures and machine reports were written to `/private/tmp/roo-type-v3-review/`. The full suite was not requested or run.
