# Talus Design System — Core Foundations

Living specification for the core token architecture of **talus-ds** (A Hill Design portfolio).  
This document is the source of truth for structure, naming, and generation rules. Scripts and `tokens.json` must follow it — not the other way around.

---

## 1. Purpose

Build a small, intentional design system that:

1. Sets the visual tone of the portfolio site.
2. Makes theming cheap: change a few **source** colors and derived scales update automatically.
3. Separates **raw values** (core) from **meaning** (semantic) so UI can stay stable while brand color shifts.

Primary authoring tool: **Tokens Studio for Figma** (Pro), synced to this repo.

---

## 2. Token architecture

### Layers

| Layer | Token set | Role | May contain raw hex? |
| --- | --- | --- | --- |
| **Core** | `Core` | Primitives: color scales, spacing, type sizes, radii, etc. | Yes (sources only) |
| **Semantic** | `Semantic` | Intent-based aliases used by components and UI | No — aliases only |

### Rules

- **Core is never applied directly in UI.** Components and styles reference Semantic tokens.
- **Semantic never invents values.** Every Semantic color points at a Core token (or another Semantic alias).
- **One-way dependency:** Semantic → Core. Never Core → Semantic.
- Token sets stay enabled in Tokens Studio in order: `Core`, then `Semantic`.

### Out of scope for Core (for now)

Themes beyond a single light baseline, component-level tokens, and motion tokens can come later. Do not expand Core until the color model below is locked and verified in Figma.

---

## 3. Color model (Core)

### Families

Each family is a self-contained ramp under `core.color.<family>`:

| Family | Role | Notes |
| --- | --- | --- |
| `neutral` | Surfaces, text, borders, chrome | Usually a near-black / near-white axis |
| `accent1` | Primary brand accent | Mid-chroma brand color |
| `accent2` | Secondary / destructive-adjacent accent | Distinct hue from accent1 |
| `accent3` | Positive / success-adjacent accent | Distinct hue |
| `accent4` | Info / highlight accent | Distinct hue |

Adding or removing a family requires an update to this doc first.

### Anatomy of a family

```
core.color.<family>.source     ← only token that stores a concrete color value
core.color.<family>.scale1
core.color.<family>.scale2
…
core.color.<family>.scaleN
```

- **`source`** — the single editable seed for the family.
- **`scaleN`** — always references `{core.color.<family>.source}` and applies a Tokens Studio **color modifier** (`lighten` / `darken`). Scale tokens must not store independent hex values.

### Scale generation rules

| Parameter | Spec | Rationale |
| --- | --- | --- |
| Step size | **2.5%** (`0.025`) per index | Matches Tokens Studio modify amounts used in the reference system |
| Direction | Steps **below** the source index → `darken`; steps **above** → `lighten` | Source sits on the ramp; neighbors move toward black or white |
| Color space | **`lch`** (default) | Perceptually even lightness; avoid washed midtones from sRGB mixes |
| Scale length | **TBD — decide before regenerating** (candidate: 40) | Must be fixed and documented; do not change casually |
| Source index | Per family — see §3.1 | Where the unmodified source sits on the ramp |

**Invariant:** Changing `source` must recompute the entire family ramp without editing any `scaleN` token by hand.

### 3.1 Source placement

| Family | Source index policy | Typical placement |
| --- | --- | --- |
| `neutral` | Near the dark end of the ramp | Often `scale1` (or near it) when source is near-black |
| Accents | Near mid-ramp so both darken and lighten have room | Often mid-index (e.g. half of scale length) |

Exact indices and hex values are **decisions**, not defaults. Record them in §7 before running any generator.

### Guardrails — color

1. Never hardcode hex on a `scaleN` token.
2. Never use a different step size or color space on one family than another without documenting an intentional exception.
3. Cap modify amounts at `1.0` (100%). If the ramp still does not reach usable near-black / near-white ends, adjust **scale length**, **step size**, or **source index** — do not invent one-off end tokens.
4. Do not add intermediate “named” core steps (`50`, `100`, Material-style) until Semantic needs them; Core stays `source` + `scaleN`.
5. Validate ramps visually in Tokens Studio (swatch grid) before syncing Semantic or Figma styles.

---

## 4. Naming conventions

### Path format

```
{domain}.{category}.{family}.{role}
```

Examples:

- `core.color.neutral.source`
- `core.color.accent1.scale12`
- `semantic.color.bg.default` *(future)*

### Rules

| Rule | Do | Don’t |
| --- | --- | --- |
| Case | lowercase | `Neutral`, `Accent1` |
| Separators | dots between path segments | spaces, camelCase paths |
| Scale indices | `scale1` … `scaleN` (no zero-padding unless we adopt it globally) | `scale01`, `s1`, `neutral-100` |
| Families | `accent1` … `accent4` | `blue`, `red`, `brand` as Core family names |
| Types | Tokens Studio `type: "color"` for all color tokens | Mixing type fields inconsistently |

Semantic names should describe **intent** (`bg`, `fg`, `border`, `focus`, `success`), not hue.

---

## 5. Tooling & workflow

### Authoring

1. Spec changes land in this file first.
2. Token structure is authored / verified in **Tokens Studio**.
3. Repo sync: GitHub provider → this repo → `tokens.json` (path TBD if relocated).
4. Optional generator scripts may **only** emit structures that match this spec. Scripts are helpers, not the design.

### Sync expectations

- Push Core (and later Semantic) from Figma after visual QA.
- Prefer one active `tokens.json` as the sync artifact.
- Do not hand-edit large generated scale blocks in git unless fixing a known bug; regenerate from agreed parameters instead.

### Figma file hygiene (from reference layout)

Suggested page / frame organization for documentation artboards:

- Brand / Colors / **Core** — source + full scale columns per family
- Later: Semantic layers, themes

Artboards are documentation, not the token source of truth. Tokens Studio is.

---

## 6. Process guardrails (before any generator run)

Use this checklist whenever Core color tokens are created or regenerated:

- [ ] §7 decisions are filled in (families, hex sources, scale length, source indices, color space).
- [ ] This document’s §3 rules still match what we intend to generate.
- [ ] Generator / manual setup uses **only** source hex + reference + modify; no baked scale hex.
- [ ] Step amount is exactly **0.025** unless this doc is updated first.
- [ ] After load in Tokens Studio: spot-check each family swatch grid (dark → light, source position correct).
- [ ] Semantic set remains empty or alias-only until Core is approved.
- [ ] No Figma color styles / variables published from Core alone for product UI until Semantic exists.

**Stop condition:** If any family ramp looks muddy, clips early, or places the brand color in the wrong part of the ramp — stop and revise §7. Do not patch individual scale tokens.

---

## 7. Decisions log (fill before generating)

Record locked choices here. Anything blank is not ready to automate.

| Decision | Value | Status |
| --- | --- | --- |
| Scale length (`STEPS`) | _e.g. 40_ | Open |
| Step amount | `0.025` (2.5%) | Proposed |
| Color space | `lch` | Proposed |
| `neutral.source` hex | | Open |
| `neutral` source index | | Open |
| `accent1.source` hex | | Open |
| `accent1` source index | | Open |
| `accent2.source` hex | | Open |
| `accent2` source index | | Open |
| `accent3.source` hex | | Open |
| `accent3` source index | | Open |
| `accent4.source` hex | | Open |
| `accent4` source index | | Open |
| `tokens.json` path | repo root (current) | Provisional |
| Sync provider | Tokens Studio ↔ GitHub | Planned |

### Working reference (from exploration — not locked)

These came from earlier exploration against a reference Tokens Studio setup. Treat as examples only until copied into the table above:

- Neutral source example: near `#111129`
- Accents: mid-chroma brand hues; mid-ramp source index as a starting hypothesis
- Existing `scripts/generate-core-colors.mjs` + root `tokens.json` are **provisional** and should be regenerated or discarded once this table is complete

---

## 8. Next steps (ordered)

1. Complete §7 decisions (especially source hexes, scale length, source indices).
2. Confirm Tokens Studio Pro modify behavior (lighten/darken + LCH + 0.025) on a single family manually.
3. Only then regenerate Core color tokens (script or bulk JSON) to match this spec.
4. Document Semantic mapping rules in a follow-up doc (`docs/semantic-tokens.md`).
5. Wire GitHub sync and Figma documentation artboards.

---

## 9. Related files

| Path | Role |
| --- | --- |
| `docs/core-design-system.md` | This spec (authority) |
| `scripts/generate-core-colors.mjs` | Provisional generator — align to §7 before trusting |
| `tokens.json` | Provisional Tokens Studio export — not approved Core |

When the decisions log is locked, update the generator constants to match §7 exactly, regenerate, and replace the provisional artifacts.
