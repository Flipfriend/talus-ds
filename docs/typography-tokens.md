# Talus Design System — Typography Tokens

Typography lives in the `typography` token set. Styles are composites of type `typography` that alias primitives only. Core stays color-only.

## Primitives

Paths are lowercase, with hyphens inside a segment. Tokens Studio type fields stay the official names (`fontFamilies`, `fontWeights`, `lineHeights`, `fontSizes`, and so on).

| Path | Value | Type |
| --- | --- | --- |
| `font-family.nata-sans` | `Nata Sans` | `fontFamilies` |
| `font-weight.regular` | `Regular` | `fontWeights` |
| `font-weight.bold` | `Bold` | `fontWeights` |
| `line-height.auto` | `AUTO` | `lineHeights` |
| `font-size.0` … `font-size.11` | `12px`, `14px`, `16px`, `18px`, `20px`, `28px`, `36px`, `48px`, `64px`, `80px`, `96px`, `120px` | `fontSizes` |
| `letter-spacing.0` | `0px` | `letterSpacing` |
| `paragraph-spacing.0` | `0px` | `paragraphSpacing` |
| `paragraph-indent.0` | `0px` | `dimension` |
| `text-case.none` | `none` | `textCase` |
| `text-decoration.none` | `none` | `textDecoration` |
| `text-decoration.underline` | `underline` | `textDecoration` |

Every length primitive uses `px`. Do not store bare numbers or `%` on these tokens.

## Composites

Each style aliases primitives only. Example refs: `{font-family.nata-sans}`, `{font-weight.bold}`, `{line-height.auto}`, `{font-size.11}`.

| Style | Weight | Size index |
| --- | --- | --- |
| `headings.exa` … `headings.pico` | Bold | Exa `11` … Pico `1` (Pico skips `font-size.2`) |
| `headings.inline.*` | Bold | Same indexes as the matching heading |
| `body.p1` … `body.p6` | Regular | `0` … `5` |
| `body.variations.p1` … `body.variations.p6` | Regular | Same as body, with `text-decoration.underline` |

Shared composite fields: `letterSpacing` → `{letter-spacing.0}`, `paragraphSpacing` → `{paragraph-spacing.0}`, `paragraphIndent` → `{paragraph-indent.0}`, `textCase` → `{text-case.none}`, `lineHeight` → `{line-height.auto}`.

## Guardrails

1. Do not put typography back into `Core.json`.
2. Composites always point at primitives — never hardcode font size or weight on a style.
3. Keep one `line-height.auto` token. Do not recreate unused identical AUTO steps.
4. Enable order in Tokens Studio: `Core`, `Semantic`, `talusSpacer`, then `typography`.

## Tokens Studio

`typography.json` is its own set. Bind text styles to `{headings.exa}`, `{body.p3}`, and so on — not to raw Figma type styles that bypass the set.
