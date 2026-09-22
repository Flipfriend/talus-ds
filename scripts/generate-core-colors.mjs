// Generates tokens.json for Tokens Studio from docs/core-design-system.md §3 / §7.
//
// - scale0 … scale40 (max index STEPS)
// - Each scale aliases {core.color.<source>.source} + lighten/darken modify
// - neutral: anchor 0, lighten only
// - accents: anchor from L* lightness on 0–40; darken toward 0, lighten toward 40
//
// Usage: node scripts/generate-core-colors.mjs

import { writeFileSync } from "node:fs";

const STEPS = 40; // max scale index → scale0 … scale40
const STEP_AMOUNT = 0.025;
const COLOR_SPACE = "lch";

/** Seed hexes — only editable color values (see §7). */
const SOURCES = {
  neutral: "#212121",
  accent1: "#9575CD",
  accent2: "#EDD3C4",
  accent3: "#558B6E",
  accent4: "#16BAC5",
};

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** CIE L* from relative luminance (D65) — used to plot accents on 0–STEPS. */
function lightnessL(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return Y <= 0.008856 ? Y * 903.3 : 116 * Math.pow(Y, 1 / 3) - 16;
}

function accentAnchorIndex(hex) {
  const L = lightnessL(hex);
  return Math.max(0, Math.min(STEPS, Math.round((L / 100) * STEPS)));
}

function modifyExtension(type, amount) {
  return {
    "studio.tokens": {
      modify: {
        type,
        value: String(Number(amount.toFixed(3))),
        space: COLOR_SPACE,
      },
    },
  };
}

function buildScale(name, seedHex, anchorIndex, { lightenOnly }) {
  const tokens = {
    source: { value: seedHex, type: "color" },
  };

  for (let n = 0; n <= STEPS; n++) {
    const token = {
      value: `{core.color.${name}.source}`,
      type: "color",
    };

    if (n !== anchorIndex) {
      if (lightenOnly) {
        // neutral: only indices above 0; always lighten
        if (n > anchorIndex) {
          token.$extensions = modifyExtension(
            "lighten",
            Math.min(1, (n - anchorIndex) * STEP_AMOUNT)
          );
        }
      } else if (n < anchorIndex) {
        token.$extensions = modifyExtension(
          "darken",
          Math.min(1, (anchorIndex - n) * STEP_AMOUNT)
        );
      } else {
        token.$extensions = modifyExtension(
          "lighten",
          Math.min(1, (n - anchorIndex) * STEP_AMOUNT)
        );
      }
    }

    tokens[`scale${n}`] = token;
  }

  return { tokens, anchorIndex, L: lightnessL(seedHex) };
}

const color = {};
const report = [];

for (const [name, seedHex] of Object.entries(SOURCES)) {
  const lightenOnly = name === "neutral";
  const anchorIndex = lightenOnly ? 0 : accentAnchorIndex(seedHex);
  const { tokens, L } = buildScale(name, seedHex, anchorIndex, { lightenOnly });
  color[name] = tokens;
  report.push(
    `${name}: seed ${seedHex} → anchor scale${anchorIndex}` +
      (lightenOnly ? " (lighten-only)" : ` (L*≈${L.toFixed(1)})`)
  );
}

const output = {
  Core: { core: { color } },
  Semantic: {},
  $themes: [],
  $metadata: { tokenSetOrder: ["Core", "Semantic"] },
};

writeFileSync("tokens.json", JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote tokens.json (${Object.keys(SOURCES).length} sources × scale0…scale${STEPS})`);
for (const line of report) console.log(`  ${line}`);
