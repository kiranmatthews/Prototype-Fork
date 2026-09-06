# Device-aware input prompts

`inputBindings.ts` owns action-to-key/button mappings. `inputPrompts.ts` resolves
those actions to one active device family. `inputPromptUI.ts` owns semantic DOM
glyphs, inline templates, image loading/fallbacks and their pre-CRT Canvas mirror.
Button shapes and original colours come from the supplied pack, never emoji.

## Device policy

- With a P1 controller exposed by the browser, use that controller's family,
  even when keyboard/mouse input occurs. P2 activity never changes P1 prompts.
- Without a controller, desktop uses Dark keyboard/mouse symbols. Touch keeps
  direct map actions without controller hints; inline prompts use action text.
- Known names and Sony product IDs distinguish Xbox, PS4, PS5, Switch and Deck.
  An unknown standard-mapped pad defaults to Xbox. Unknown raw mappings use
  numbered buttons instead of falsely naming a physical button.
- **Options → Prompt Style** overrides the connected controller's artwork.
  Auto restores detection. The choice is stored as `solProtoControllerPrompts.v1`
  and never forces controller glyphs into keyboard-only play.
- Browser APIs cannot always reveal a device hidden behind Steam Input/XInput,
  and may not expose any pad until its first interaction. A native console or
  Steam Input adapter can call `setHostFamily` and `setGlyphProvider` with its
  authoritative device/origin data. No native console runtime is claimed here.

Controls were not remapped. The browser's standard layout identifies physical
positions: south/east/west/north, not A/B/X/Y names. Therefore the existing
south-button confirm is B on Switch, and east-button back is A. Displaying A
for confirm without also changing the binding would be incorrect.

## Use anywhere

```ts
import { createInputGlyph, setPromptText } from './inputPromptUI';

button.prepend(createInputGlyph('mapEnter'));
setPromptText(subtitle, 'Hold {left} + {spin} while airborne');
```

Unknown template tokens remain literal text. Glyphs keep accessible names,
reserve their layout size, and fall back to labelled shapes if an image fails.
Live DOM nodes refresh together on device changes without retaining discarded
menu nodes. The same family and loaded image cache are used before CRT; no
sharp DOM duplicate is drawn. Asset-load events invalidate frozen menu frames.
Existing map hints and time-trial retry prompts use this system. Trick-gate
hint templates remain available to authored presentation, but no automatic
trick-gate popup is installed. Ordinary menu text and unrelated typography are
unchanged.

## Profiles and extension

PS4 uses Stylized colour symbols; PS5 uses Default monochrome symbols; Xbox
uses Default coloured ABXY; Switch uses Default monochrome ABXY; Deck uses
Default white ABXY with matching project SVG supplements for its labelled
shoulder/trigger buttons. See the [asset notice](../public/input-prompts/NOTICE.md).

Add actions centrally and bind their input consumer to the same definition.
Add a device profile or native glyph provider without rewriting each hint.
Keyboard/mouse controls can also be resolved directly with `keyboardGlyph`.

References: [W3C standard gamepad mapping](https://w3c.github.io/gamepad/#remapping),
[Steam Input emulation and glyph origins](https://partner.steamgames.com/doc/features/steam_controller/steam_input_gamepad_emulation_bestpractices),
[Linux Sony controller IDs](https://kernel.googlesource.com/pub/scm/linux/kernel/git/torvalds/linux/+/refs/heads/master/drivers/hid/hid-ids.h).

Validation: `node tools/test-input-prompts.mjs`, included in `npm run build`,
checks bindings, all profile asset paths, fallback policies and extension APIs.
Browser QA covers simulated hot-plugging, keyboard priority rules, overrides,
CRT prompts and the unchanged touch-map policy.
