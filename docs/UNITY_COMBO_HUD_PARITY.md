# Unity combo HUD math and text parity

The web combo plate follows Unity's current source-shaped presentation without
changing authoritative scoring. Unity commit
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

The cash-in plate starts at `360` with no multiplier suffix and drains toward
zero while the score ticker rises. World-only pending points bank at face value
because a zero gameplay multiplier is floored to one for banking.

Fixed action contributions snap atomically to the new purse. Quarter-second
timed accrual is the only source that eases afterward, using Unity's ticker:

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
- Bail: `BAILED!` / `NO` for the existing 0.7-second red fall-away.
- Deck labels: `Kickflip`, `Heelflip`, `Pop Shove-It`, `Impossible`,
  `Varial Flip` (Roo presentation uppercases them).
- Chains use ` + `; adjacent repeats compact to ` xN`; more than six visible
  entries use the `… + ` prefix.
- Tiki/Uber tricks retain the `Tiki ` prefix.
- Combo Run has no persistent `CHAIN LIVE`, `LINK`, or duplicate balance text;
  its existing one-shot banners remain the only copy.
- Generic landings do not invent a `LANDED` card.

Same-tick banks carry a frozen copy of the exact projected/active title so the
cash-in can never inherit a stale label after gameplay clears its combo array.

## Authored tracking

Roo SVG and the Canvas2D pre-CRT copy both use the accepted source roles:

- large numeric counters, clock, and score: `-6.5`
- trick title: `2`
- trick value: `4`
- word/small labels: `0`

Canvas tracking converts the source units from the Roo face's 200-unit
reference size to pixels at the current rendered font size.

## Verification

`npm run check:combo-hud` gates purse-versus-product math, exact glyph/copy,
projection labels, ticker steps, tracking roles, and both DOM and pre-CRT HUD
integration. The normal full build and browser smoke pass verify native/lite
fallback plus fixed-resolution CRT composition.
