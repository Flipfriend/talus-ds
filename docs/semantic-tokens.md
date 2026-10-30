# Talus Design System — Semantic Color Tokens

Follow-on to [`core-design-system.md`](./core-design-system.md).  
Semantic tokens **alias** Core scales (`core.color.<source>.scaleN`). They never store hex values.

Names are role-first: surfaces, text, interactive (`primary`–`quaternary`), and support. Core stays the only place a color is made. `accent1`–`accent4` are brand scales that interactive roles alias. Success, info, warning, and danger each have their own source.

---

## 1. Purpose

- Name colors by the job they do in the UI (`ui.bg`, `text.01`, `interactive.primary`).
- Keep one-way dependency: **Semantic → Core** only.
- Prove contrast against the surfaces a color is allowed to sit on.

---

## 2. Path format

```text
semantic.color.ui.bg
semantic.color.ui.01
semantic.color.ui.02
semantic.color.ui.border.subtle
semantic.color.ui.border.default
semantic.color.ui.border.strong
semantic.color.text.01
semantic.color.text.02
semantic.color.text.03
semantic.color.text.04
semantic.color.interactive.primary.default.bg
semantic.color.interactive.primary.default.fg
semantic.color.interactive.primary.hover.bg
semantic.color.interactive.primary.hover.fg
semantic.color.interactive.primary.pressed.bg
semantic.color.interactive.primary.pressed.fg
semantic.color.interactive.primary.on-surface.bg
semantic.color.interactive.secondary.…
semantic.color.interactive.tertiary.…
semantic.color.interactive.quaternary.…
semantic.color.interactive.link
semantic.color.interactive.disabled.bg
semantic.color.interactive.disabled.fg
semantic.color.support.success.default.bg
semantic.color.support.success.default.fg
semantic.color.support.success.default.contrast
semantic.color.support.success.on-surface.bg
semantic.color.support.success.hover.bg
semantic.color.support.success.hover.fg
semantic.color.support.success.pressed.bg
semantic.color.support.success.pressed.fg
semantic.color.support.info.…
semantic.color.support.warning.…
semantic.color.support.danger.…
```

Token sets: `Core`, `Semantic`, `talusSpacer`, `typography`. Light and dark themes are deferred.

Every interactive role and support family uses the same **group-only** shape (`default` / `hover` / `pressed` / `on-surface`) so Figma Variables export does not skip leaf tokens that sit next to nested state groups. Support `contrast` lives under `default` beside `bg` / `fg`.

`text.02` and `text.03` are omitted when the ramp does not have enough distinct steps between the darkest text and the lightest text that still meets 4.5:1.

### Breaking renames (from earlier paths)

| Old | New |
| --- | --- |
| `obj.01`–`obj.04` | `text.01`–`text.04` |
| `ui.03` / `ui.04` / `ui.05` | `ui.border.subtle` / `default` / `strong` |
| `interactive.01.*` + flat `interactive.hover` / `pressed` | `interactive.primary.*` (states nested) |
| `interactive.{role}.bg` / `.fg` | `interactive.{role}.default.bg` / `.fg` |
| `interactive.{role}.on-surface` | `interactive.{role}.on-surface.bg` |
| `support.{status}.bg` / `.fg` / `.contrast` | `support.{status}.default.bg` / `.fg` / `.contrast` |

---

## 3. Roles

| Token | Alias | Gate |
| --- | --- | --- |
| `ui.bg` | `neutral.scale38` | Page background |
| `ui.01` | `neutral.scale34` | First raised surface |
| `ui.02` | `neutral.scale30` | Second raised surface |
| `ui.border.subtle` | Neutral step between text and surfaces | **3:1** against `ui.bg`, `ui.01`, and `ui.02`. Most subtle border |
| `ui.border.default` | Same | Mid border |
| `ui.border.strong` | Same | Strongest border |
| `text.01` | Darkest passing neutral step | Highest contrast. **4.5:1** on `ui.bg`, `ui.01`, and `ui.02` |
| `text.02`, `text.03` | Even steps between `text.01` and `text.04` | Same |
| `text.04` | Lightest neutral step that still passes | Lowest contrast that is still **4.5:1** on those surfaces |
| `interactive.primary.default.bg` | `accent1.scale20` | Primary action fill (resting) |
| `interactive.primary.default.fg` | Accent1 step | **4.5:1** on that fill |
| `interactive.secondary.*` | `accent2` | Secondary action |
| `interactive.tertiary.*` | `accent3` | Tertiary action |
| `interactive.quaternary.*` | `accent4` | Quaternary action |
| `interactive.*.on-surface.bg` | Role seed (`scale20`) at **12% alpha** | Translucent wash for chrome/selection on `ui.*`. Not for body text |
| `interactive.link` | Accent1 step | **4.5:1** on `ui.02` |
| `interactive.disabled.bg` | `neutral.scale20` | Disabled control fill |
| `interactive.disabled.fg` | Nearest neutral step | **3:1** on `interactive.disabled.bg`. WCAG-exempt; Talus legibility standard |
| `support.success.default.bg` | `success.scale20` | Success fill (resting) |
| `support.success.default.fg` | Success step | **4.5:1** on that fill |
| `support.success.default.contrast` | Success step | **4.5:1** on `ui.02`. Status text/icons on a UI surface |
| `support.*.on-surface.bg` | Status seed (`scale20`) at **12% alpha** | Translucent wash for status chrome on `ui.*`. Not for body text |
| `support.info.*` | `info` ramp | Same pattern as success |
| `support.warning.*` | `warning` ramp | Same pattern as success |
| `support.danger.*` | `danger` ramp | Same pattern as success |

---

## 4. How steps are chosen

The generator resolves Core with the same LCH lighten and mix used in the token files, then:

1. Fixes `ui.bg`, `ui.01`, and `ui.02`.
2. Walks `neutral` from `scale0` toward `scale40`. Keeps a step only when contrast is at least 4.5:1 against all three surfaces. `text.01` is the darkest of those steps. `text.04` is the lightest. `text.02` and `text.03` are spaced evenly between them.
3. Looks between `text.01` and `ui.02` for steps at 3:1 or better against all three surfaces. The three closest to the surfaces become `ui.border.strong`, `ui.border.default`, and `ui.border.subtle`.
4. For each interactive role (`primary`→`accent1` … `quaternary`→`accent4`) and each support ramp, picks resting `default.fg` as the nearest opposite-side step on that fill at 4.5:1 or better.
5. Picks each support `default.contrast` (and `interactive.link`) as the lightest/nearest step that still clears 4.5:1 on `ui.02`.
6. Sets `interactive.disabled.bg` to `neutral.scale20`, then selects the nearest neutral step for `interactive.disabled.fg` that reaches 3:1.
7. Sets each interactive and support `on-surface.bg` to that family’s `scale20` with Tokens Studio `alpha` **0.12**.

The script exits if `text.01`, `text.04`, a border step, a required fill/text pair, a contrast step, or a hover/pressed pair cannot be found. Re-run `node scripts/generate-core-colors.mjs` after a seed change.

---

## 5. States

Resting, hover, and pressed are nested under each interactive role and each support family. Every child of a role/status is a **group** (`default`, `hover`, `pressed`, `on-surface`) so export to Figma Variables stays consistent.

| Token | Fill |
| --- | --- |
| `*.default` | Family `scale20` |
| `*.hover` | 4 steps darker (`scale16`), or the same distance lighter if that fill has no 4.5:1 text |
| `*.pressed` | 8 steps darker (`scale12`), or the same distance lighter if that fill has no 4.5:1 text |

Each `default` / `hover` / `pressed` group has `bg` and `fg`. Support `default` also has `contrast` (status text on `ui.*`). `interactive.link`, `interactive.disabled`, `*.on-surface.bg`, `support.*.default.contrast`, and the `ui` / `text` tokens do not have hover or pressed versions.

`interactive.disabled` is a static `bg` / `fg` pair: the background stays `neutral.scale20`, and the foreground clears the Talus 3:1 legibility target.

Bind a primary resting fill to `{semantic.color.interactive.primary.default.bg}` and `{semantic.color.interactive.primary.default.fg}`. Bind hover to `{semantic.color.interactive.primary.hover.bg}` / `.fg`.

---

## 6. Guardrails

1. No hex on Semantic color tokens — aliases only (except alpha modifiers on `on-surface.bg`).
2. Semantic tokens point at Core, not at other Semantic tokens.
3. Components use Semantic, not Core. Prefer role names (`interactive.primary.default`), never `accent1` in UI code.
4. Do not reintroduce `layer1`, `layer2`, `layer3`, `callout`, `obj`, flat `interactive.01` / `ui.03`–`ui.05`, or leaf `bg`/`fg` sitting next to state groups.
5. Do not map `danger`, `success`, `info`, or `warning` onto an accent ramp. Accents stay available for brand themes via interactive roles.
6. `on-surface.bg` washes are for selection/chrome on surfaces — not for body copy. Use `text.*` or `support.*.default.contrast` for readable status text on `ui.*`.

---

## 7. Tokens Studio

Point Tokens Studio’s GitHub sync at the folder `talus-ds/src`. Enable `Core`, `Semantic`, `talusSpacer`, and `typography`. Bind the page fill to `{semantic.color.ui.bg}`, a raised surface to `{semantic.color.ui.01}` or `{semantic.color.ui.02}`, body text to `{semantic.color.text.01}`, secondary text to `{semantic.color.text.02}`, borders to `{semantic.color.ui.border.default}`, and a primary button fill and label to `{semantic.color.interactive.primary.default.bg}` and `{semantic.color.interactive.primary.default.fg}`.

After pulling this tree, delete any leftover flat `interactive.*.bg` / `.fg` / `.on-surface` or sibling `support.*.contrast` tokens in the plugin, then re-export Variables so `default` / `on-surface` groups appear next to `hover` / `pressed`.
