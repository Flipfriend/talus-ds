// Generates tokens.json for Tokens Studio.
// Each color gets a `source` token plus a 40-step scale. Every scale step
// references the source with a lighten/darken modifier of 2.5% per step,
// so changing a source color regenerates its entire ramp.
//
// Usage: node scripts/generate-core-colors.mjs

import { writeFileSync } from "node:fs";

const STEPS = 40; // number of scale tokens per color
const STEP_AMOUNT = 0.025; // 2.5% per step
const COLOR_SPACE = "lch"; // perceptually uniform; "srgb" mixes toward black/white instead

// sourceIndex = the scale position where the source sits unmodified.
// Steps before it darken, steps after it lighten.
const COLORS = {
  neutral: { source: "#111129", sourceIndex: 1 },
  accent1: { source: "#4F46E5", sourceIndex: 20 },
  accent2: { source: "#E5484D", sourceIndex: 20 },
  accent3: { source: "#30A46C", sourceIndex: 20 },
  accent4: { source: "#0EA5E9", sourceIndex: 20 },
};

function buildScale(name, { source, sourceIndex }) {
  const tokens = {
    source: { value: source, type: "color" },
  };

  for (let n = 1; n <= STEPS; n++) {
    const token = {
      value: `{core.color.${name}.source}`,
      type: "color",
    };

    if (n !== sourceIndex) {
      const distance = Math.abs(n - sourceIndex);
      const amount = Math.min(1, distance * STEP_AMOUNT);
      token.$extensions = {
        "studio.tokens": {
          modify: {
            type: n < sourceIndex ? "darken" : "lighten",
            value: String(Number(amount.toFixed(3))),
            space: COLOR_SPACE,
          },
        },
      };
    }

    tokens[`scale${n}`] = token;
  }

  return tokens;
}

const color = {};
for (const [name, config] of Object.entries(COLORS)) {
  color[name] = buildScale(name, config);
}

const output = {
  Core: { core: { color } },
  Semantic: {},
  $themes: [],
  $metadata: { tokenSetOrder: ["Core", "Semantic"] },
};

writeFileSync("tokens.json", JSON.stringify(output, null, 2) + "\n");
console.log(
  `Wrote tokens.json: ${Object.keys(COLORS).length} colors x ${STEPS} steps`
);
