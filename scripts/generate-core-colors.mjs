// Generates talus-ds/src/tokens.json for Tokens Studio.
//
// Core: scale0 … scale40 from seed hexes (docs/core-design-system.md §3).
// Semantic: bg/fg aliases chosen so resolved contrast is at least 4.5:1
// (docs/semantic-tokens.md). One Core set and one Semantic set per mode.
//
// Usage: node scripts/generate-core-colors.mjs

import { writeFileSync } from "node:fs";
import { formatHex, interpolate, wcagContrast, wcagLuminance } from "culori";

const STEPS = 40;
const STEP_AMOUNT = 0.025;
const COLOR_SPACE = "lch";
const MIN_CONTRAST = 4.5;
const OUT_PATH = "talus-ds/src/tokens.json";

/** Default seed hexes — only editable color values (see §7). */
const SOURCES = {
  neutral: "#212121",
  accent1: "#9575CD",
  accent2: "#EDD3C4",
  accent3: "#558B6E",
  accent4: "#16BAC5",
};

/** Surface background indexes. Accent roles use the family seed step instead. */
const SURFACE_BG = {
  light: {
    layer1: 38,
    layer2: 34,
    layer3: 30,
    callout: 28,
    "layer-inverse": 4,
  },
  dark: {
    layer1: 2,
    layer2: 6,
    layer3: 10,
    callout: 12,
    "layer-inverse": 36,
  },
};

const ROLES = [
  { name: "layer1", ramp: "neutral", textRamp: "neutral" },
  { name: "layer2", ramp: "neutral", textRamp: "neutral" },
  { name: "layer3", ramp: "neutral", textRamp: "neutral" },
  { name: "callout", ramp: "neutral", textRamp: "neutral" },
  { name: "layer-inverse", ramp: "neutral", textRamp: "neutral" },
  { name: "interactive", ramp: "accent1", textRamp: "accent1" },
  { name: "accent1", ramp: "accent1", textRamp: "accent1" },
  { name: "accent2", ramp: "accent2", textRamp: "accent2" },
  { name: "success", ramp: "accent3", textRamp: "accent3" },
  { name: "accent3", ramp: "accent3", textRamp: "accent3" },
  { name: "warning", ramp: "accent4", textRamp: "accent4" },
  { name: "accent4", ramp: "accent4", textRamp: "accent4" },
];

/** First themes. Add a mode with seed overrides for another brand. */
const MODES = [
  { name: "light", appearance: "light", seeds: SOURCES },
  { name: "dark", appearance: "dark", seeds: SOURCES },
];

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

function mixHex(from, to, amount) {
  if (amount <= 0) return formatHex(from);
  if (amount >= 1) return formatHex(to);
  const mixed = formatHex(interpolate([from, to], "lch")(amount));
  if (!mixed) {
    throw new Error(`LCH mix failed for ${from} → ${to} at ${amount}`);
  }
  return mixed;
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
  const resolved = [];

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
    resolved.push(
      n === 0 ? formatHex(seedHex) : mixHex(seedHex, "#ffffff", n * STEP_AMOUNT)
    );
  }

  return { tokens, resolved, anchorIndex: 0 };
}

function buildAccent(name, seedHex, anchorIndex) {
  const tokens = {
    source: { value: seedHex, type: "color" },
  };
  const resolved = [];
  const ref = `{core.color.${name}.source}`;

  for (let n = 0; n <= STEPS; n++) {
    if (n === 0) {
      tokens.scale0 = { value: "#000000", type: "color" };
      resolved.push("#000000");
      continue;
    }
    if (n === STEPS) {
      tokens[`scale${STEPS}`] = { value: "#FFFFFF", type: "color" };
      resolved.push("#ffffff");
      continue;
    }
    if (n === anchorIndex) {
      tokens[`scale${n}`] = { value: ref, type: "color" };
      resolved.push(formatHex(seedHex));
      continue;
    }

    const token = { value: ref, type: "color" };
    if (anchorIndex > 0 && n < anchorIndex) {
      const amount = (anchorIndex - n) / anchorIndex;
      token.$extensions = modifyExtension("mix", amount, "#000000");
      resolved.push(mixHex(seedHex, "#000000", amount));
    } else if (anchorIndex < STEPS && n > anchorIndex) {
      const amount = (n - anchorIndex) / (STEPS - anchorIndex);
      token.$extensions = modifyExtension("mix", amount, "#FFFFFF");
      resolved.push(mixHex(seedHex, "#ffffff", amount));
    } else {
      resolved.push(formatHex(seedHex));
    }
    tokens[`scale${n}`] = token;
  }

  return { tokens, resolved, anchorIndex };
}

function buildCore(seeds) {
  const color = {};
  const resolved = {};
  const anchors = {};
  const lines = [];

  for (const [name, seedHex] of Object.entries(seeds)) {
    if (name === "neutral") {
      const built = buildNeutral(name, seedHex);
      color[name] = built.tokens;
      resolved[name] = built.resolved;
      anchors[name] = 0;
      lines.push(`${name}: seed ${seedHex} → anchor scale0 (lighten-only)`);
      continue;
    }
    const anchorIndex = accentAnchorIndex(seedHex);
    const built = buildAccent(name, seedHex, anchorIndex);
    color[name] = built.tokens;
    resolved[name] = built.resolved;
    anchors[name] = anchorIndex;
    lines.push(
      `${name}: seed ${seedHex} → anchor scale${anchorIndex} (L*≈${lightnessL(seedHex).toFixed(1)}, bookends #000000/#FFFFFF)`
    );
  }

  return { color, resolved, anchors, lines };
}

function alias(ramp, index) {
  return {
    value: `{core.color.${ramp}.scale${index}}`,
    type: "color",
  };
}

/**
 * Walk away from bgIndex toward the opposite end of the ramp.
 * The first step at or above MIN_CONTRAST is the nearest compliant color.
 * If that direction fails, try the other direction.
 */
function pickOnRamp(bgHex, palette, bgIndex) {
  const towardDark = bgIndex > STEPS / 2;
  const primary = towardDark ? -1 : 1;

  for (const direction of [primary, -primary]) {
    for (let step = 1; step <= STEPS; step++) {
      const index = bgIndex + direction * step;
      if (index < 0 || index > STEPS) break;
      const ratio = wcagContrast(bgHex, palette[index]);
      if (ratio >= MIN_CONTRAST) return { index, ratio };
    }
  }
  return null;
}

/** Nearest opposite-luminance neutral step that still clears MIN_CONTRAST. */
function pickNeutralFallback(bgHex, neutralPalette) {
  const bgLum = wcagLuminance(bgHex);
  const bgIsLight = bgLum >= 0.5;
  const ranked = [];

  for (let index = 0; index <= STEPS; index++) {
    const hex = neutralPalette[index];
    const ratio = wcagContrast(bgHex, hex);
    if (ratio < MIN_CONTRAST) continue;
    const lum = wcagLuminance(hex);
    const opposite = bgIsLight ? lum < bgLum : lum > bgLum;
    ranked.push({ index, ratio, distance: Math.abs(lum - bgLum), opposite });
  }

  ranked.sort((a, b) => {
    if (a.opposite !== b.opposite) return a.opposite ? -1 : 1;
    return a.distance - b.distance;
  });

  return ranked[0] ?? null;
}

function buildSemantic(appearance, core) {
  const surfaces = SURFACE_BG[appearance];
  const color = {};
  const lines = [];

  for (const role of ROLES) {
    const bgIndex =
      role.ramp === "neutral" && surfaces[role.name] !== undefined
        ? surfaces[role.name]
        : core.anchors[role.ramp];
    const bgHex = core.resolved[role.ramp][bgIndex];

    let textRamp = role.textRamp;
    let picked = pickOnRamp(bgHex, core.resolved[textRamp], bgIndex);

    if (!picked && textRamp !== "neutral") {
      textRamp = "neutral";
      picked = pickNeutralFallback(bgHex, core.resolved.neutral);
    }

    if (!picked) {
      const best = core.resolved[role.textRamp].reduce((max, hex) => {
        const ratio = wcagContrast(bgHex, hex);
        return ratio > max ? ratio : max;
      }, 0);
      throw new Error(
        `${appearance} ${role.name}: no foreground reaches ${MIN_CONTRAST}:1 (best ${best.toFixed(2)}:1 on ${role.textRamp})`
      );
    }

    color[role.name] = {
      bg: alias(role.ramp, bgIndex),
      fg: alias(textRamp, picked.index),
    };
    lines.push(
      `${role.name} bg ${role.ramp}.scale${bgIndex} fg ${textRamp}.scale${picked.index} ${picked.ratio.toFixed(2)}:1`
    );
  }

  return { color, lines };
}

const output = {
  $themes: [],
  $metadata: { tokenSetOrder: [] },
};
const report = [];

for (const mode of MODES) {
  const coreSet = `core-${mode.name}`;
  const semanticSet = `semantic-${mode.name}`;
  const seeds = mode.seeds ?? SOURCES;
  const core = buildCore(seeds);
  const semantic = buildSemantic(mode.appearance, core);

  output[coreSet] = { core: { color: core.color } };
  output[semanticSet] = { semantic: { color: semantic.color } };
  output.$metadata.tokenSetOrder.push(coreSet, semanticSet);

  const selectedTokenSets = {};
  for (const other of MODES) {
    const on = other.name === mode.name;
    selectedTokenSets[`core-${other.name}`] = on ? "enabled" : "disabled";
    selectedTokenSets[`semantic-${other.name}`] = on ? "enabled" : "disabled";
  }
  output.$themes.push({
    id: mode.name,
    name: mode.name,
    selectedTokenSets,
  });

  report.push(`${mode.name}`);
  for (const line of core.lines) report.push(`  ${line}`);
  for (const line of semantic.lines) report.push(`  ${line}`);
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + "\n");
console.log(`Wrote ${OUT_PATH}`);
for (const line of report) console.log(line);
