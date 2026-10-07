# Talus Design System — Core Foundations

Living specification for the core token architecture of **talus-ds**.  
This document is the source of truth for structure, naming, and generation rules. Scripts and `tokens.json` must follow it — not the other way around.

---

## 1. Purpose

Build a small, intentional design system that:

1. Sets the visual tone.
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

Core color tokens generate the raw ramps under `core.color.*`. Those scales are the input for the **Semantic** layer (§3.4) — UI never consumes Core scales directly.

### Sources

Each **source** is a self-contained ramp under `core.color.<source>`:

| Source | Role |
| --- | --- |
| `neutral` | A neutral scale from dark to light |
| `accent1` | A primary color scale |
| `accent2` | A secondary color scale |
| `accent3` | A tertiary color scale |
| `accent4` | A quaternary color scale |

Adding or removing a source requires an update to this doc first.

### Anatomy of a source

```
core.color.<source>.source     ← only token that stores a concrete color value (the seed hex)
core.color.<source>.scale0
core.color.<source>.scale1
…
core.color.<source>.scale40    ← max index (inclusive); see §7
```

Example: `core.color.neutral.source`, `core.color.accent1.scale12`.

- **Seed token (`…source`)** — the single editable hex for that ramp. This is the only value you change to retheme that source.
- **`scaleN`** — references `{core.color.<source>.source}` and applies a Tokens Studio color modifier. The only scale tokens that store their own hex are accent bookends (`scale0` = `#000000`, `scale40` = `#FFFFFF`).
- **Indexing** — zero-based and inclusive. Axis: **`0` = dark (`#000000`)**, **`40` = light (`#FFFFFF`)**. Tokens are `scale0` … `scale40` (**41** total).

### Shared scale parameters

| Parameter | Spec |
| --- | --- |
| Neutral step size | **2.5%** (`0.025`) lighten per index from `scale0` |
| Accent spacing | Full span from `#000000` to the seed, and from the seed to `#FFFFFF`, divided evenly across the indices on each side |
| Color space | **`lch`** |
| Scale max index (`STEPS`) | **`40`** → `scale0` … `scale40` |
| Modify cap | Amounts capped at `1.0` (100%) |

### 3.1 Source-driven updates (required)

**Invariant:** Editing any of the five seed hexes (`core.color.<source>.source`) must update that source’s entire `scale0`…`scale40` ramp. No hand-editing of scale tokens.

How this works in **Tokens Studio for Figma**:

1. Interior `scaleN` tokens **alias** `{core.color.<source>.source}` (accent `scale0` / `scale40` are the fixed bookends).
2. Each modified step carries a Tokens Studio **modify** in `lch` — neutral uses `lighten`; accents use `mix` toward black or white.
3. Changing a seed recomputes resolved colors for that source’s scales when the plugin evaluates tokens.
4. For **accents**, if the new hex’s lightness shifts its plotted index (§3.3), the mix map must be **rebuilt** (generator or Tokens Studio) so the unmodified slot moves with the color. Hue-only tweaks at similar lightness keep the same index and update in place. The bookends stay `#000000` and `#FFFFFF`.

**Theming:** Duplicate this Core structure (new token set / theme in Tokens Studio) and change the five seed hexes. Same scale rules, new palette. Semantic tokens keep pointing at `core.color.*` so UI meaning stays stable across themes.

### 3.2 Neutral (one-direction ramp)

`neutral` is the only source with a fixed dark anchor:

| Rule | Spec |
| --- | --- |
| Anchor index | Always **`0`** |
| `scale0` | Unmodified `{core.color.neutral.source}` |
| `scale1` … `scale40` | **`lighten` only** — amount = `index × 0.025` |
| Darken? | **Never** — no steps toward darker than the seed |

Example with step `0.025`: `scale1` → lighten `0.025`, `scale2` → `0.05`, … `scale40` → `1.0`.

### 3.3 Accents (bookended ramp)

For `accent1` … `accent4`, the ramp is pinned to black and white. The seed sits on the axis by lightness, and every step between the bookends is an even **LCH mix** across that side’s span.

1. **Plot** the seed hex on the `0`–`40` axis by relative lightness (`L = 0` → index `0`, `L = 100` → index `40`, round to nearest integer, clamp to `0`–`40`). Call that index `S`.
2. **Bookends** (fixed hex, not aliases):
   - `scale0` = `#000000`
   - `scale40` = `#FFFFFF`
3. **Seed slot** `scaleS` (when `0 < S < 40`) = unmodified `{core.color.<source>.source}`.
4. **Dark side** (`0 < index < S`): alias the seed and **`mix`** toward `#000000` in `lch`. Amount = `(S - index) / S` (closer to `0` → more black).
5. **Light side** (`S < index < 40`): alias the seed and **`mix`** toward `#FFFFFF` in `lch`. Amount = `(index - S) / (40 - S)` (closer to `40` → more white).

The fixed 2.5% lighten/darken step does **not** apply to accents. Dividing each side’s full span is what lands the ends on `#000000` and `#FFFFFF` and spaces the in-between colors through the seed.

Accent anchor indices are **derived from the hex**, not hand-picked in §7. Record the computed index in §7 after calculation for transparency.

If a seed plots to `0` or `40`, that end stays the bookend hex and the unmodified seed is not duplicated onto the scale. Rebuild the mix amounts whenever `S` changes.

### 3.4 Next layer: Semantic (after Core scales)

Once `core.color.*` scales exist, they feed the **Semantic** token set. Semantic tokens **alias** into Core scales (e.g. `{core.color.neutral.scale12}`) — they do not store hex values.

**Pathing:** Semantic lives in its own token set as `semantic.color.<role>`, and **references** `core.color.<source>.scaleN`. Do not nest Semantic under `core.color` (avoid `core.color.semantic.*`) so Core stays primitive-only and the Core → Semantic dependency stays one-way.

Planned Semantic color roles:

| Role | Token path (planned) |
| --- | --- |
| layer1 | `semantic.color.layer1` |
| layer2 | `semantic.color.layer2` |
| layer3 | `semantic.color.layer3` |
| interactive | `semantic.color.interactive` |
| callout | `semantic.color.callout` |
| success | `semantic.color.success` |
| warning | `semantic.color.warning` |
| layer inverse | `semantic.color.layer-inverse` |
| accent1 | `semantic.color.accent1` |
| accent2 | `semantic.color.accent2` |
| accent3 | `semantic.color.accent3` |
| accent4 | `semantic.color.accent4` |

Exact Core scale mappings for each role are **out of scope until Core ramps are locked** — document them in `docs/semantic-tokens.md` as the next step after Core generation.

### Guardrails — color

1. Hardcoded scale hex is limited to accent bookends: `scale0` = `#000000`, `scale40` = `#FFFFFF`. Every other scale step aliases the seed.
2. Neutral uses `0.025` lighten steps. Accents use proportional LCH `mix` across each side of the seed (§3.3). Do not apply the neutral step size to accents.
3. Cap modify amounts at `1.0`. Accent ends are the bookends, not extra one-off tokens.
4. Do not add Material-style named steps (`50`, `100`, …) in Core; stay on seed `source` + `scaleN`.
5. Validate each source swatch grid in Tokens Studio before publishing styles/variables or expanding Semantic.
6. To retheme: change seed hexes (and rebuild accent modify maps if lightness/index shifted) — never patch individual scale hexes.
7. Do not build Semantic mappings until Core `scale0`…`scale40` ramps are approved.

---

## 4. Naming conventions

### Path format

```
{domain}.{category}.{source}.{role}     ← Core
{domain}.{category}.{role}              ← Semantic
```

Examples:

- `core.color.neutral.source`
- `core.color.accent1.scale12`
- `semantic.color.layer1` *(after Core; aliases a Core scale)*
- `semantic.color.layer-inverse` *(after Core)*

### Rules

| Rule | Do | Don’t |
| --- | --- | --- |
| Case | lowercase | `Neutral`, `Accent1` |
| Separators | dots between path segments; hyphens inside a segment when needed | spaces, camelCase paths |
| Scale indices | `scale0` … `scale40` (no zero-padding) | `scale01`, `scale1` as the dark end, `s0`, `neutral-100` |
| Core sources | `neutral`, `accent1` … `accent4` | `blue`, `red`, `brand` as Core source names |
| Semantic nesting | `semantic.color.<role>` referencing `core.color.*` | `core.color.semantic.*` |
| Types | Tokens Studio `type: "color"` for all color tokens | Mixing type fields inconsistently |

Semantic names describe **intent** (`layer1`, `interactive`, `success`, …), not raw scale indices.

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

- Brand / Colors / **Core** — seed + full scale columns per source
- Later: Semantic layers, themes

Artboards are documentation, not the token source of truth. Tokens Studio is.

---

## 6. Process guardrails (before any generator run)

Use this checklist whenever Core color tokens are created or regenerated:

- [x] §7 decisions are filled in (source hexes, scale max index, color space; accent indices derived per §3.3).
- [x] This document’s §3 rules still match what we intend to generate.
- [x] Generator / Tokens Studio setup uses seed hex + reference + modify. Accent `scale0` / `scale40` are the only baked scale hexes (`#000000` / `#FFFFFF`).
- [x] Neutral is seed-at-`0` + lighten-only. Accents are bookended and LCH-mixed from the plotted index.
- [x] Neutral step amount is exactly **0.025**. Accent spacing is the full span on each side of the seed (§3.3).
- [ ] After load in Tokens Studio: spot-check each source swatch grid (dark → light, anchor position correct).
- [ ] Semantic set remains empty or alias-only until Core is approved.
- [ ] No Figma color styles / variables published from Core alone for product UI until Semantic exists.

**Stop condition:** If any source ramp looks muddy, clips early, or places the brand color in the wrong part of the ramp — stop and revise §7. Do not patch individual scale tokens.

---

## 7. Decisions log (fill before generating)

Record locked choices here. Anything blank is not ready to automate.

### How to fill this table

**Hex syntax (Value column):** use a 6-digit hex with `#`, no alpha — e.g. `#212121`. Prefer uppercase. Do not put the hex in the Decision name.

**Scale max index (`STEPS`):** integer for the **last** scale token index. Example: `40` means tokens `scale0` … `scale40` (41 tokens). Not a count of 40.

**Source indices:**
- `neutral` — always `0` (fixed; not derived).
- Accents — **derived** from source hex lightness per §3.3; record the computed index here after plotting. Do not invent accent indices independently of the hex.

**Status meanings:**

| Status | When to use |
| --- | --- |
| `Open` | No value yet |
| `Proposed` | You’ve entered a value; still open to change |
| `Locked` | Approved — generator / Tokens Studio should use this |
| `Provisional` | Temporary working default (path, tooling) |
| `Planned` | Intent only; not configured yet |

Flow for each row: **Open → Proposed** (once a value is in) → **Locked** (once you’re ready to generate).

### Locked scale behavior (from §3)

| Behavior | Spec | Status |
| --- | --- | --- |
| Source-driven scales | Change a seed → that source’s interior `scaleN` steps recompute. Accent `scale0` / `scale40` stay `#000000` / `#FFFFFF` | Locked |
| Tokens Studio / Figma | Scales authored as references + modifiers; themes = duplicate Core + new seeds | Locked |
| Neutral ramp | Seed at `0`; lighten only to `40` at `0.025` per step | Locked |
| Accent ramps | Plot lightness → index `S`; `scale0` `#000000`, `scale40` `#FFFFFF`; LCH mix fills each side | Locked |

### Parameter & source decisions

| Decision | Value | Status |
| --- | --- | --- |
| Scale max index (`STEPS`) | `40` → `scale0`…`scale40` | Locked |
| Neutral step amount | `0.025` (2.5%) lighten per index | Locked |
| Accent bookends | `scale0` `#000000`, `scale40` `#FFFFFF`; LCH `mix` across each side | Locked |
| Color space | `lch` | Locked |
| `neutral.source` | `#212121` | Locked |
| `neutral` source index | `0` (fixed) | Locked |
| `accent1.source` | `#9575CD` | Locked |
| `accent1` source index | `22` (derived from L* ≈ 55.6 → round(`L/100×40`)) | Locked |
| `accent2.source` | `#EDD3C4` | Locked |
| `accent2` source index | `35` (derived from L* ≈ 86.3 → round(`L/100×40`)) | Locked |
| `accent3.source` | `#558B6E` | Locked |
| `accent3` source index | `21` (derived from L* ≈ 53.5 → round(`L/100×40`)) | Locked |
| `accent4.source` | `#16BAC5` | Locked |
| `accent4` source index | `28` (derived from L* ≈ 69.0 → round(`L/100×40`)) | Locked |
| `tokens.json` path | `talus-ds/src/tokens.json` | Provisional |
| Sync provider | Tokens Studio ↔ GitHub | Planned |

### Working notes

- Accent indices are recomputed by `scripts/generate-core-colors.mjs` from CIE L* whenever seed hexes change. Accent ramps are bookended (`#000000` / `#FFFFFF`) with an LCH mix across each side.
- `tokens.json` Core set matches §3 / §7. Spot-check in Tokens Studio before locking Semantic mappings.

## 8. Next steps (ordered)

1. ~~Flip §7 generation-critical rows to **Locked**.~~ **Done.**
2. Load `tokens.json` into Tokens Studio; QA each source ramp (neutral lighten-only; accent bookends `#000000` / `#FFFFFF` with the seed between them).
3. Fill Core → Semantic mappings in [`docs/semantic-tokens.md`](./semantic-tokens.md); emit Semantic aliases into `tokens.json`.
4. Wire GitHub sync; duplicate Core sets in Tokens Studio for additional themes.

---

## 9. Related files

| Path | Role |
| --- | --- |
| `docs/core-design-system.md` | Core spec (authority) |
| `docs/semantic-tokens.md` | Semantic roles + Core mappings (scaffold) |
| `scripts/generate-core-colors.mjs` | Generates Core color scales → `talus-ds/src/tokens.json` |
| `talus-ds/src/tokens.json` | Tokens Studio sync artifact (Core generated; Semantic empty) |
