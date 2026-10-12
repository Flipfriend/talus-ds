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

Token sets: `Core`, then `Semantic`. Both stay enabled. Light and dark themes are deferred; there is one Core ramp and one Semantic map.

---

## 3. Roles

| Role | Background | Text |
| --- | --- | --- |
| layer1, layer2, layer3, callout | `neutral` surface step | `neutral`, opposite end of the ramp |
| layer-inverse | `neutral.scale4` | `neutral`, opposite end |
| interactive, accent1 | `accent1` seed step | `accent1`, else `neutral` if that ramp cannot pass |
| accent2 | `accent2` seed step | `accent2`, else `neutral` |
| success, accent3 | `accent3` seed step | `accent3`, else `neutral` |
| warning, accent4 | `accent4` seed step | `accent4`, else `neutral` |

### 3.1 Surface steps

| Token | Core alias |
| --- | --- |
| `layer1.bg` | `neutral.scale38` |
| `layer2.bg` | `neutral.scale34` |
| `layer3.bg` | `neutral.scale30` |
| `callout.bg` | `neutral.scale28` |
| `layer-inverse.bg` | `neutral.scale4` |

Accent, interactive, success, and warning backgrounds stay on that family’s unmodified seed step.

### 3.2 Foreground rule

`fg` is not a fixed index. The generator:

1. Resolves every Core step to sRGB (LCH `lighten` for neutral, LCH `mix` toward `#000000` / `#FFFFFF` for accents).
2. Measures WCAG contrast of the resolved `bg` against every step on the text ramp.
3. Keeps steps at **≥ 4.5:1**.
4. On a light background, walks toward darker steps and takes the nearest one that passes. On a dark background, walks toward lighter steps the same way.
5. If that ramp has no passing step, repeats the search on `neutral`.
6. Stops with an error if `neutral` also fails.

Re-run `node scripts/generate-core-colors.mjs` after a seed change so `fg` can move when the old step drops under 4.5:1.

---

## 4. Modes

Light, dark, and extra brand themes are not in the token file yet. When they are added, they should keep these same `semantic.color.<role>.bg` and `.fg` names and switch sets around them. Until then, Tokens Studio should show only `Core` and `Semantic`.

---

## 5. Guardrails

1. No hex on Semantic color tokens — aliases only.
2. Do not reference other Semantic tokens. `bg` and `fg` point at Core.
3. Components and Figma styles for product UI use Semantic, not Core.
4. Semantic paths stay stable. Scale indexes inside an alias may change when contrast is regenerated.
5. Do not ship a pair whose resolved contrast is under 4.5:1.

---

## 6. Tokens Studio

Pull `talus-ds/src/tokens.json`. Enable `Core` and `Semantic`. Bind a button’s fill to `{semantic.color.layer2.bg}` and its label to `{semantic.color.layer2.fg}` (or the `interactive` pair for a colored button).
