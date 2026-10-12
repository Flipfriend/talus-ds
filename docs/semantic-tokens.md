# Talus Design System — Semantic Color Tokens

Follow-on to [`core-design-system.md`](./core-design-system.md).  
Semantic tokens **alias** Core scales (`core.color.<source>.scaleN`). They never store hex values.

Each UI role is a **background / text pair**. A control binds both. Example: a layer-2 button uses `{semantic.color.layer2.bg}` for the fill and `{semantic.color.layer2.fg}` for the label. The generator chooses `fg` so the resolved pair meets **WCAG 2.1 contrast 4.5:1** (normal text).

---

## 1. Purpose

- Give UI stable, intent-based names (`layer2.bg`, `layer2.fg`, `success.bg`, …).
- Keep brand flexibility: themes swap Core seed hexes; Semantic paths stay the same.
- Enforce one-way dependency: **Semantic → Core** only.
- Guarantee text on each semantic background stays at or above 4.5:1.

---

## 2. Path format

```
semantic.color.<role>.bg
semantic.color.<role>.fg
```

`bg` and `fg` are references, for example `{core.color.neutral.scale34}` and `{core.color.neutral.scale8}`.

Token sets are per mode: `core-light` + `semantic-light`, `core-dark` + `semantic-dark`. A Tokens Studio theme enables exactly one pair. Components always bind the semantic paths above. The scale step behind `fg` (and, for surfaces, `bg`) may differ by mode, because the step that passes 4.5:1 on a light surface is not the step that passes on a dark surface.

---

## 3. Roles

| Role | Background | Text |
| --- | --- | --- |
| layer1, layer2, layer3, callout | `neutral` surface step for the mode | `neutral`, opposite end of the ramp |
| layer-inverse | `neutral`, flipped surface | `neutral`, opposite end |
| interactive, accent1 | `accent1` seed step | `accent1`, else `neutral` if that ramp cannot pass |
| accent2 | `accent2` seed step | `accent2`, else `neutral` |
| success, accent3 | `accent3` seed step | `accent3`, else `neutral` |
| warning, accent4 | `accent4` seed step | `accent4`, else `neutral` |

### 3.1 Surface steps

Light mode keeps layer backgrounds on the light end. Dark mode moves them to the dark end. Inverse swaps that relationship.

| Token | Light | Dark |
| --- | --- | --- |
| `layer1.bg` | `neutral.scale38` | `neutral.scale2` |
| `layer2.bg` | `neutral.scale34` | `neutral.scale6` |
| `layer3.bg` | `neutral.scale30` | `neutral.scale10` |
| `callout.bg` | `neutral.scale28` | `neutral.scale12` |
| `layer-inverse.bg` | `neutral.scale4` | `neutral.scale36` |

Accent, interactive, success, and warning backgrounds stay on that family’s unmodified seed step in every mode.

### 3.2 Foreground rule

`fg` is not a fixed index. For each mode the generator:

1. Resolves every Core step to sRGB (LCH `lighten` for neutral, LCH `mix` toward `#000000` / `#FFFFFF` for accents).
2. Measures WCAG contrast of the resolved `bg` against every step on the text ramp.
3. Keeps steps at **≥ 4.5:1**.
4. On a light background, walks toward darker steps and takes the nearest one that passes. On a dark background, walks toward lighter steps the same way.
5. If that ramp has no passing step, repeats the search on `neutral`.
6. Stops with an error if `neutral` also fails.

Re-run `node scripts/generate-core-colors.mjs` after a seed change so `fg` can move when the old step drops under 4.5:1.

---

## 4. Modes

A mode is a name, an appearance (`light` or `dark`), and optional seed overrides. The first generated themes are `light` and `dark`, both using the Core seeds in the generator.

Another brand theme is another pair of sets (`core-<name>`, `semantic-<name>`) with different seeds and the same appearance. `$themes` lists every mode. Only one Core set and its Semantic set are enabled at a time, so `{core.color.neutral.scaleN}` resolves against the active Core set.

---

## 5. Guardrails

1. No hex on Semantic color tokens — aliases only.
2. Do not reference other Semantic tokens. `bg` and `fg` point at Core.
3. Components and Figma styles for product UI use Semantic, not Core.
4. Semantic paths stay stable across modes. Scale indexes inside the alias may change when contrast is regenerated.
5. Do not ship a pair whose resolved contrast is under 4.5:1.

---

## 6. Tokens Studio

Pull `talus-ds/src/tokens.json`. The theme dropdown lists `light` and `dark`. Bind a button’s fill to `{semantic.color.layer2.bg}` and its label to `{semantic.color.layer2.fg}` (or the `interactive` pair for a colored button). Switch the theme to check the other mode.
