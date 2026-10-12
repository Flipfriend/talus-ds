# Talus Design System — Semantic Color Tokens

Follow-on to [`core-design-system.md`](./core-design-system.md).  
Semantic tokens **alias** Core scales (`core.color.<source>.scaleN`). They never store hex values.

Names follow the Paladin theme: surfaces, text, interactive, and support. Core stays the only place a color is made. `accent2` (`#EDD3C4`) is not a danger color. Danger is its own Core source.

---

## 1. Purpose

- Name colors by the job they do in the UI (`ui.bg`, `obj.01`, `interactive.01`).
- Keep one-way dependency: **Semantic → Core** only.
- Prove contrast against the surfaces a color is allowed to sit on.

---

## 2. Path format

```text
semantic.color.ui.bg
semantic.color.ui.01
semantic.color.ui.02
semantic.color.ui.03
semantic.color.ui.04
semantic.color.ui.05
semantic.color.obj.01
semantic.color.obj.02
semantic.color.obj.03
semantic.color.obj.04
semantic.color.interactive.01.bg
semantic.color.interactive.01.fg
semantic.color.interactive.link
semantic.color.interactive.disabled
semantic.color.support.success.bg
semantic.color.support.success.fg
semantic.color.support.info.bg
semantic.color.support.info.fg
semantic.color.support.danger.bg
semantic.color.support.danger.obj
semantic.color.support.danger.contrast
```

Token sets: `Core`, then `Semantic`. Both stay enabled. Light and dark themes are deferred.

`obj.02` and `obj.03` are omitted when the ramp does not have enough distinct steps between the darkest text and the lightest text that still meets 4.5:1.

---

## 3. Roles

| Token | Alias | Gate |
| --- | --- | --- |
| `ui.bg` | `neutral.scale38` | Page background |
| `ui.01` | `neutral.scale34` | First raised surface |
| `ui.02` | `neutral.scale30` | Second raised surface |
| `ui.03`, `ui.04`, `ui.05` | Neutral steps between the text and those surfaces | **3:1** against `ui.bg`, `ui.01`, and `ui.02`. `03` is the most subtle, `05` the strongest |
| `obj.01` | Darkest passing neutral step | Highest contrast. **4.5:1** on `ui.bg`, `ui.01`, and `ui.02` |
| `obj.02`, `obj.03` | Even steps between `obj.01` and `obj.04` | Same |
| `obj.04` | Lightest neutral step that still passes | Lowest contrast that is still **4.5:1** on those surfaces |
| `interactive.01.bg` | `accent1.scale20` | Primary button fill |
| `interactive.01.fg` | Accent1 step | **4.5:1** on that fill |
| `interactive.link` | Accent1 step | **4.5:1** on `ui.02` |
| `interactive.disabled` | `neutral.scale20` | Disabled control. No 4.5:1 requirement |
| `support.success.bg` | `accent3.scale20` | Success fill |
| `support.success.fg` | Accent3 step | **4.5:1** on that fill |
| `support.info.bg` | `accent4.scale20` | Info fill |
| `support.info.fg` | Accent4 step | **4.5:1** on that fill |
| `support.danger.bg` | `danger.scale20` | Danger fill |
| `support.danger.obj` | Danger step | **4.5:1** on that fill. Text and icons on the danger background |
| `support.danger.contrast` | Danger step | **4.5:1** on `ui.02`. Danger text and icons on a UI surface |

---

## 4. How steps are chosen

The generator resolves Core with the same LCH lighten and mix used in the token files, then:

1. Fixes `ui.bg`, `ui.01`, and `ui.02`.
2. Walks `neutral` from `scale0` toward `scale40`. Keeps a step only when contrast is at least 4.5:1 against all three surfaces. `obj.01` is the darkest of those steps. `obj.04` is the lightest. `obj.02` and `obj.03` are spaced evenly between them.
3. Looks between `obj.01` and `ui.02` for steps at 3:1 or better against all three surfaces. The three closest to the surfaces become `ui.03`, `ui.04`, and `ui.05`.
4. Picks `interactive.01.fg`, `support.success.fg`, `support.info.fg`, and `support.danger.obj` as the nearest opposite-side step on that fill’s own ramp at 4.5:1 or better.
5. Picks `interactive.link` as the accent1 step nearest `ui.02` that still clears 4.5:1. Picks `support.danger.contrast` the same way on the danger ramp.
6. Sets `interactive.disabled` to `neutral.scale20`.

The script exits if `obj.01`, `obj.02`, a border step, or a required fill/text pair cannot be found. Re-run `node scripts/generate-core-colors.mjs` after a seed change.

---

## 5. Guardrails

1. No hex on Semantic color tokens — aliases only.
2. Semantic tokens point at Core, not at other Semantic tokens.
3. Components use Semantic, not Core.
4. Do not reintroduce `layer1`, `layer2`, `layer3`, `callout`, or semantic accent roles beside these names.
5. Do not map `danger` onto `accent2`.

---

## 6. Tokens Studio

Point Tokens Studio’s GitHub sync at the folder `talus-ds/src`. Enable `Core` and `Semantic`. Bind the page fill to `{semantic.color.ui.bg}`, a raised surface to `{semantic.color.ui.01}` or `{semantic.color.ui.02}`, body text to `{semantic.color.obj.01}`, secondary text to `{semantic.color.obj.02}`, and a primary button fill and label to `{semantic.color.interactive.01.bg}` and `{semantic.color.interactive.01.fg}`.
