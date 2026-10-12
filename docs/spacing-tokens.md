# Talus Design System — Spacing Tokens

Spacing, padding, and margins live in the `talusSpacer` token set. The set is a multiplier. Values are unitless so the same step can be used for any base-8 measurement. Figma treats the number as pixels when it is applied to spacing.

## Formula

```text
{talusSpacer.n} = {talusSpacer.base} × n
```

`base` is `4`. `{talusSpacer.4}` resolves to `16`.

The scale covers every 4px step from `0` through `300` in the 8px grid list, named by the multiplier rather than the pixel count. `full` is the list’s `1000` value, `{talusSpacer.base} × 250`.

| Token | Resolves to |
| --- | --- |
| `talusSpacer.0` | 0 |
| `talusSpacer.1` | 4 |
| `talusSpacer.2` | 8 |
| `talusSpacer.4` | 16 |
| `talusSpacer.75` | 300 |
| `talusSpacer.full` | 1000 |

Even indexes (`2`, `4`, `6`, …) land on the 8px grid. Odd indexes are the 4px half-steps from the same list.

## Tokens Studio

`talusSpacer.json` is its own set. Enable it with `Core` and `Semantic`. Bind padding, gap, and margin to `{talusSpacer.4}` (16), not to a raw pixel value. Change `talusSpacer.base` to rescale the whole set.
