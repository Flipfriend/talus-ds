# Talus Design System — Semantic Color Tokens

Follow-on to [`core-design-system.md`](./core-design-system.md).  
Semantic tokens **alias** Core scales (`core.color.<source>.scaleN`). They never store hex values.

**Status:** Scaffold — Core ramps must be approved in Tokens Studio before mappings are locked.

---

## 1. Purpose

- Give UI stable, intent-based names (`layer1`, `success`, …).
- Keep brand flexibility: themes swap Core seed hexes; Semantic paths stay the same.
- Enforce one-way dependency: **Semantic → Core** only.

---

## 2. Path format

```
semantic.color.<role>
```

Each role’s `value` is a reference, e.g. `{core.color.neutral.scale12}`.

Token set: `Semantic` (enabled after `Core` in Tokens Studio).

---

## 3. Roles

| Role | Token | Maps to Core (TBD) | Notes |
| --- | --- | --- | --- |
| layer1 | `semantic.color.layer1` | | |
| layer2 | `semantic.color.layer2` | | |
| layer3 | `semantic.color.layer3` | | |
| interactive | `semantic.color.interactive` | | |
| callout | `semantic.color.callout` | | |
| success | `semantic.color.success` | | |
| warning | `semantic.color.warning` | | |
| layer inverse | `semantic.color.layer-inverse` | | |
| accent1 | `semantic.color.accent1` | | Likely from `core.color.accent1.*` |
| accent2 | `semantic.color.accent2` | | Likely from `core.color.accent2.*` |
| accent3 | `semantic.color.accent3` | | Likely from `core.color.accent3.*` |
| accent4 | `semantic.color.accent4` | | Likely from `core.color.accent4.*` |

Fill **Maps to Core** with a full reference (e.g. `{core.color.neutral.scale8}`) after visual QA of Core swatches.

---

## 4. Guardrails

1. No hex on Semantic color tokens — aliases only.
2. Do not reference other Semantic tokens until a clear alias chain is documented.
3. Components / Figma styles for product UI use Semantic, not Core.
4. When Core seed hexes change for a theme, Semantic paths stay; only resolved colors change (unless a mapping intentionally points at a different scale step).

---

## 5. Next steps

1. Load regenerated `tokens.json` Core set into Tokens Studio; QA each source ramp.
2. Pick Core scale steps for each Semantic role; record them in §3.
3. Emit Semantic entries into `tokens.json` (or a follow-on generator) and sync to Figma.
