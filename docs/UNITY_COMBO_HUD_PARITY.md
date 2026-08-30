# Unity combo HUD math and text parity

The web combo plate keeps Unity's purse/bank math without changing
authoritative scoring. Its text layout, bail exit, and live timed-accrual
ticker intentionally follow the browser playtest direction rather than exact
Unity presentation. Unity commit
`3da0720580085f802880a5771b011921edf6e193` is the correction authority;
`ba7cd9c` contains the retired live-total behavior.

## Purse versus bank product

While a combo is active or previewing a started deck trick, the plate displays
the unmultiplied pending purse and a separate multiplier:

```text
180  ×2
```

Only banking multiplies:

```text
180 × max(1, 2) = 360
```

The cash-in plate starts at `360` with no multiplier suffix, holds the completed
combo clearly for two additional seconds, with the displayed bank score held
at its pre-transfer value. The existing matched animation then begins: the
combo drains toward zero while the score ticker rises by the same award.
World-only pending points bank at face value because a zero gameplay multiplier
is floored to one for banking.

Fixed action contributions snap atomically to the new purse. Gameplay still
awards timed grind/grab/manual/lip/wall points in authoritative quarter-second
packets. The live plate buffers each packet across the same 0.25-second window
at a constant points-per-second rate, so a held grind counts continuously at
30, 60, or 120 Hz without changing the score or replay.

The older 9%-of-gap ticker remains the cash-in drain:

```text
step = min(abs(target-current), max(1, ceil(abs(target-current) × .09)))
```

## Started deck-trick preview

A board trick opens a non-authoritative preview as soon as it starts, before
its 0.42-second animation completes. The projection applies the current
repeat-decay and Tiki/Uber adjustment, adds one projected multiplier, and
projects the label without mutating gameplay state. A first Kickflip over a
30-point Slide therefore previews:

```text
SLIDE + KICKFLIP
140  ×2
```

Completing the trick replaces the projection with the identical authoritative
value. A fizzled trick simply removes the preview.

## Exact copy

- Active/preview: `{pending purse}  ×{multiplier}` using U+00D7.
- Cash-in: multiplied product alone.
- Bail: the exact currently displayed labels and ticker value turn red and
  fall away for 0.7 seconds. No replacement `BAILED!` / `NO` copy is shown.
  An authoritative snapshot is used only if a trick starts and fails between
  HUD frames, before any visible copy exists.
- Deck labels: `Kickflip`, `Heelflip`, `Pop Shove-It`, `Impossible`,
  `Varial Flip` (the presentation uppercases them).
- Chains use ` + `; adjacent repeats compact to ` xN`; more than six visible
  entries use the `… + ` prefix. The pre-CRT renderer keeps complete trick
  entries together across centred lines; the direct DOM fallback uses normal
  browser text wrapping.
- Tiki/Uber tricks retain the `Tiki ` prefix.
- Combo Run has no persistent `CHAIN LIVE`, `LINK`, or duplicate balance text;
  its existing one-shot banners remain the only copy.
- Generic landings do not invent a `LANDED` card.

Same-tick banks carry a frozen copy of the exact projected/active title so the
cash-in can never inherit a stale label after gameplay clears its combo array.

## Text treatment and authored tracking

Persistent counters retain Roo SVG and the accepted source tracking roles:

- large numeric counters, clock, and score: `-6.5`
- word/small labels: `0`

Canvas tracking converts the source units from the Roo face's 200-unit
reference size to pixels at the current rendered font size.

The combo labels and total use the Roo typeface through ordinary DOM/Canvas
text rather than Roo's per-glyph SVG gradient renderer. This preserves the
game's lettering while enabling natural multiline layout, makes the red bail
state literal rather than a coloured glow around orange glyphs, and lets the
CRT treatment provide the final texture.

`RooRegular.ttf` does not contain `×`, `°`, or `…`. The normal font stack
therefore keeps the exact gameplay copy and falls through to Impact for only
those punctuation glyphs; combo letters and numerals remain Roo.

## Verification

`npm run check:combo-hud` gates purse-versus-product math, projected labels,
token-aware wrapping, 30/60/120 Hz constant ticker motion, the two-second hold,
the frozen red bail copy, authoritative quarter-second grind scoring, and both
DOM and pre-CRT HUD integration. The normal full build and browser smoke pass
verify native/lite fallback plus fixed-resolution CRT composition.
