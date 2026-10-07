// Generates tokens.json for Tokens Studio from docs/core-design-system.md §3 / §7.
//
// - scale0 … scale40 (max index STEPS)
// - neutral: anchor 0, lighten only at 0.025 per index
// - accents: scale0 #000000, scale40 #FFFFFF; seed plotted by L*;
//   interior steps mix toward black or white in LCH across that side's span
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

function modifyExtension(type, amount, mixColor) {
  const modify = {
    type,
    value: String(Number(amount.toFixed(4))),
    space: COLOR_SPACE,
  };
  if (mixColor) modify.color = mixColor;
  return { "studio.tokens": { modify } };
}

function buildNeutral(name, seedHex) {
  const tokens = {
    source: { value: seedHex, type: "color" },
  };

  for (let n = 0; n <= STEPS; n++) {
    const token = {
      value: `{core.color.${name}.source}`,
      type: "color",
    };
    if (n > 0) {
      token.$extensions = modifyExtension(
        "lighten",
        Math.min(1, n * STEP_AMOUNT)
      );
    }
    tokens[`scale${n}`] = token;
  }

  return tokens;
}

function buildAccent(name, seedHex, anchorIndex) {
  const tokens = {
    source: { value: seedHex, type: "color" },
  };
  const ref = `{core.color.${name}.source}`;

  for (let n = 0; n <= STEPS; n++) {
    if (n === 0) {
      tokens.scale0 = { value: "#000000", type: "color" };
      continue;
    }
    if (n === STEPS) {
      tokens[`scale${STEPS}`] = { value: "#FFFFFF", type: "color" };
      continue;
    }
    if (n === anchorIndex) {
      tokens[`scale${n}`] = { value: ref, type: "color" };
      continue;
    }

    const token = { value: ref, type: "color" };
    if (anchorIndex > 0 && n < anchorIndex) {
      token.$extensions = modifyExtension(
        "mix",
        (anchorIndex - n) / anchorIndex,
        "#000000"
      );
    } else if (anchorIndex < STEPS && n > anchorIndex) {
      token.$extensions = modifyExtension(
        "mix",
        (n - anchorIndex) / (STEPS - anchorIndex),
        "#FFFFFF"
      );
    }
    tokens[`scale${n}`] = token;
  }

  return tokens;
}

const color = {};
const report = [];

for (const [name, seedHex] of Object.entries(SOURCES)) {
  if (name === "neutral") {
    color[name] = buildNeutral(name, seedHex);
    report.push(`${name}: seed ${seedHex} → anchor scale0 (lighten-only)`);
    continue;
  }
  const anchorIndex = accentAnchorIndex(seedHex);
  color[name] = buildAccent(name, seedHex, anchorIndex);
  report.push(
    `${name}: seed ${seedHex} → anchor scale${anchorIndex} (L*≈${lightnessL(seedHex).toFixed(1)}, bookends #000000/#FFFFFF)`
  );
}

const output = {
  Core: { core: { color } },
  Semantic: {},
  $themes: [],
  $metadata: { tokenSetOrder: ["Core", "Semantic"] },
};

writeFileSync("talus-ds/src/tokens.json", JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote talus-ds/src/tokens.json (${Object.keys(SOURCES).length} sources × scale0…scale${STEPS})`);
for (const line of report) console.log(`  ${line}`);
