// Generates Tokens Studio files in talus-ds/src/ for a folder sync.
//
// Core.json, Semantic.json, talusSpacer.json, and typography.json are
// separate token sets. $metadata.json sets their order. Hover and pressed
// live inside Semantic. The generator does not write typography.json.
//
// Usage: node scripts/generate-core-colors.mjs

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { formatHex, interpolate, wcagContrast } from "culori";

const STEPS = 40;
const STEP_AMOUNT = 0.025;
const COLOR_SPACE = "lch";
const MIN_CONTRAST = 4.5;
const OUT_DIR = "talus-ds/src";
const ACCENT_ANCHOR = 20;

/** Default seed hexes — only editable color values (see §7). */
const SOURCES = {
  neutral: "#212121",
  accent1: "#9575CD",
  accent2: "#EDD3C4",
  accent3: "#558B6E",
  accent4: "#16BAC5",
  success: "#25C64B",
  info: "#FFEB3B",
  danger: "#C3352B",
};

const SPACER_BASE = 4;
const SPACER_MAX_PX = 300;
const SPACER_FULL_PX = 1000;
const BORDER_MIN = 3;
const UI_SURFACES = { bg: 38, "01": 34, "02": 30 };
const OBJ_KEYS = ["01", "02", "03", "04"];
const REQUIRED_OBJ = ["01", "04"];

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
    const built = buildAccent(name, seedHex, ACCENT_ANCHOR);
    color[name] = built.tokens;
    resolved[name] = built.resolved;
    anchors[name] = ACCENT_ANCHOR;
    lines.push(
      `${name}: seed ${seedHex} → anchor scale${ACCENT_ANCHOR} (bookends #000000/#FFFFFF)`
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

function ratiosAgainst(hex, surfaces) {
  const ratios = {};
  for (const [name, bgHex] of Object.entries(surfaces)) {
    ratios[name] = wcagContrast(bgHex, hex);
  }
  return ratios;
}

function formatRatios(ratios) {
  return Object.entries(ratios)
    .map(([name, ratio]) => `${name} ${ratio.toFixed(2)}:1`)
    .join("  ");
}

function bestRatio(bgHex, palette) {
  return palette.reduce((max, hex) => Math.max(max, wcagContrast(bgHex, hex)), 0);
}

/** Lightest accent step that still clears minRatio on a light surface. */
function pickLink(bgHex, palette) {
  for (let index = STEPS; index >= 0; index--) {
    const ratio = wcagContrast(bgHex, palette[index]);
    if (ratio >= MIN_CONTRAST) return { index, ratio };
  }
  return null;
}

function requirePair(name, picked, bgHex, palette) {
  if (picked) return picked;
  throw new Error(
    `${name}: no foreground reaches ${MIN_CONTRAST}:1 (best ${bestRatio(bgHex, palette).toFixed(2)}:1)`
  );
}

const STATE_SHIFTS = { hover: 4, pressed: 8 };
const STATE_PAIRS = [
  { group: "interactive", key: null, ramp: "accent1", text: "fg", label: "interactive" },
  { group: "support", key: "success", ramp: "success", text: "fg", label: "support.success" },
  { group: "support", key: "info", ramp: "info", text: "fg", label: "support.info" },
  { group: "support", key: "danger", ramp: "danger", text: "obj", label: "support.danger" },
];

function pickState(core, ramp, steps, label) {
  const anchor = core.anchors[ramp];
  const palette = core.resolved[ramp];

  for (const direction of [-1, 1]) {
    const bgIndex = anchor + direction * steps;
    if (bgIndex < 0 || bgIndex > STEPS) continue;
    const picked = pickOnRamp(palette[bgIndex], palette, bgIndex);
    if (!picked) continue;
    return { bgIndex, textIndex: picked.index, ratio: picked.ratio, direction };
  }

  throw new Error(
    `${label}: no foreground reaches ${MIN_CONTRAST}:1 at ${ramp}.scale${anchor} ± ${steps}`
  );
}

function statePair(ramp, textKey, chosen) {
  return {
    bg: alias(ramp, chosen.bgIndex),
    [textKey]: alias(ramp, chosen.textIndex),
  };
}

function buildSemantic(core) {
  const neutral = core.resolved.neutral;
  const surfaces = Object.fromEntries(
    Object.entries(UI_SURFACES).map(([key, index]) => [
      `ui.${key}`,
      neutral[index],
    ])
  );
  const lines = [];

  const ui = {
    bg: alias("neutral", UI_SURFACES.bg),
    "01": alias("neutral", UI_SURFACES["01"]),
    "02": alias("neutral", UI_SURFACES["02"]),
  };
  for (const [key, index] of Object.entries(UI_SURFACES)) {
    lines.push(`ui.${key} neutral.scale${index}`);
  }

  const textPassing = [];
  for (let index = 0; index <= STEPS; index++) {
    const ratios = ratiosAgainst(neutral[index], surfaces);
    const min = Math.min(...Object.values(ratios));
    if (min >= MIN_CONTRAST) textPassing.push({ index, ratios });
  }

  if (textPassing.length < 2) {
    throw new Error(
      `obj.01 and obj.04 need a high-contrast step and a distinct 4.5:1 step (found ${textPassing.length})`
    );
  }
  const hierarchySlots = OBJ_KEYS.length;
  const lastPassing = textPassing.length - 1;
  const chosen = [];
  const used = new Set();
  for (let slot = 0; slot < hierarchySlots; slot++) {
    const pos = Math.round((slot * lastPassing) / (hierarchySlots - 1));
    if (used.has(pos)) continue;
    used.add(pos);
    chosen.push(textPassing[pos]);
  }
  const obj = {};
  const objSteps = {
    "01": chosen[0],
    "02": chosen.length > 2 ? chosen[1] : undefined,
    "03": chosen.length > 3 ? chosen[2] : undefined,
    "04": chosen[chosen.length - 1],
  };
  for (const key of OBJ_KEYS) {
    const step = objSteps[key];
    if (!step) {
      lines.push(`obj.${key} omitted`);
      if (REQUIRED_OBJ.includes(key)) {
        throw new Error(`obj.${key} cannot clear ${MIN_CONTRAST}:1 on every UI surface`);
      }
      continue;
    }
    obj[key] = alias("neutral", step.index);
    lines.push(
      `obj.${key} neutral.scale${step.index}  ${formatRatios(step.ratios)}`
    );
  }

  const textIndex = textPassing[0].index;
  const borderCeiling = UI_SURFACES["02"];
  const borderPassing = [];
  for (let index = textIndex + 1; index < borderCeiling; index++) {
    const ratios = ratiosAgainst(neutral[index], surfaces);
    const min = Math.min(...Object.values(ratios));
    if (min >= BORDER_MIN) borderPassing.push({ index, ratios });
  }
  if (borderPassing.length < 3) {
    const detail = borderPassing.length
      ? borderPassing.map((step) => `scale${step.index} ${formatRatios(step.ratios)}`).join(" | ")
      : "none";
    throw new Error(`ui.03–ui.05 need 3 steps at ${BORDER_MIN}:1 (found ${detail})`);
  }
  const borders = borderPassing.slice(-3);
  const borderKeys = ["05", "04", "03"];
  borders.forEach((step, offset) => {
    const key = borderKeys[offset];
    ui[key] = alias("neutral", step.index);
    lines.push(`ui.${key} neutral.scale${step.index}  ${formatRatios(step.ratios)}`);
  });
  const orderedUi = {
    bg: ui.bg,
    "01": ui["01"],
    "02": ui["02"],
    "03": ui["03"],
    "04": ui["04"],
    "05": ui["05"],
  };

  const fills = [
    { name: "interactive.01", ramp: "accent1" },
    { name: "support.success", ramp: "success" },
    { name: "support.info", ramp: "info" },
  ];
  const pairs = {};
  for (const fill of fills) {
    const bgIndex = core.anchors[fill.ramp];
    const palette = core.resolved[fill.ramp];
    const bgHex = palette[bgIndex];
    const picked = requirePair(
      `${fill.name}.fg`,
      pickOnRamp(bgHex, palette, bgIndex),
      bgHex,
      palette
    );
    pairs[fill.name] = {
      bg: alias(fill.ramp, bgIndex),
      fg: alias(fill.ramp, picked.index),
    };
    lines.push(
      `${fill.name}.bg ${fill.ramp}.scale${bgIndex}  ${fill.name}.fg ${fill.ramp}.scale${picked.index}  ${picked.ratio.toFixed(2)}:1`
    );
  }

  const dangerRamp = "danger";
  const dangerPalette = core.resolved[dangerRamp];
  const dangerBgIndex = core.anchors[dangerRamp];
  const dangerBgHex = dangerPalette[dangerBgIndex];
  const dangerObj = requirePair(
    "support.danger.obj",
    pickOnRamp(dangerBgHex, dangerPalette, dangerBgIndex),
    dangerBgHex,
    dangerPalette
  );
  const dangerContrast = pickLink(surfaces["ui.02"], dangerPalette);
  if (!dangerContrast) {
    throw new Error(
      `support.danger.contrast: no step reaches ${MIN_CONTRAST}:1 on ui.02 (best ${bestRatio(surfaces["ui.02"], dangerPalette).toFixed(2)}:1)`
    );
  }
  const dangerContrastRatios = ratiosAgainst(
    dangerPalette[dangerContrast.index],
    surfaces
  );
  lines.push(
    `support.danger.bg ${dangerRamp}.scale${dangerBgIndex}  support.danger.obj ${dangerRamp}.scale${dangerObj.index}  ${dangerObj.ratio.toFixed(2)}:1`
  );
  lines.push(
    `support.danger.contrast ${dangerRamp}.scale${dangerContrast.index}  ${formatRatios(dangerContrastRatios)}`
  );

  const linkBg = surfaces["ui.02"];
  const link = requirePair(
    "interactive.link",
    pickLink(linkBg, core.resolved.accent1),
    linkBg,
    core.resolved.accent1
  );
  lines.push(
    `interactive.link accent1.scale${link.index}  ui.02 ${link.ratio.toFixed(2)}:1`
  );

  const disabledIndex = ACCENT_ANCHOR;
  lines.push(`interactive.disabled neutral.scale${disabledIndex}`);

  const interactive = {
    "01": pairs["interactive.01"],
    link: alias("accent1", link.index),
    disabled: alias("neutral", disabledIndex),
  };
  const support = {
    success: { ...pairs["support.success"] },
    info: { ...pairs["support.info"] },
    danger: {
      bg: alias(dangerRamp, dangerBgIndex),
      obj: alias(dangerRamp, dangerObj.index),
      contrast: alias(dangerRamp, dangerContrast.index),
    },
  };
  const stateTokens = {};

  for (const [mode, steps] of Object.entries(STATE_SHIFTS)) {
    for (const pair of STATE_PAIRS) {
      const chosen = pickState(core, pair.ramp, steps, `${mode} ${pair.label}`);
      const tokens = statePair(pair.ramp, pair.text, chosen);
      const slot = pair.key ?? pair.group;
      stateTokens[slot] = stateTokens[slot] ?? {};
      stateTokens[slot][mode] = tokens;
      const side = chosen.direction < 0 ? "darker" : "lighter";
      lines.push(
        `${pair.label}.${mode}.bg ${pair.ramp}.scale${chosen.bgIndex} (${side})  ${pair.label}.${mode}.${pair.text} ${pair.ramp}.scale${chosen.textIndex}  ${chosen.ratio.toFixed(2)}:1`
      );
    }
  }

  const orderedInteractive = {
    "01": interactive["01"],
    hover: stateTokens.interactive.hover,
    pressed: stateTokens.interactive.pressed,
    link: interactive.link,
    disabled: interactive.disabled,
  };
  for (const key of ["success", "info", "danger"]) {
    support[key] = {
      ...support[key],
      hover: stateTokens[key].hover,
      pressed: stateTokens[key].pressed,
    };
  }

  return {
    color: {
      ui: orderedUi,
      obj,
      interactive: orderedInteractive,
      support,
    },
    lines,
  };
}

function buildSpacer() {
  const tokens = {
    base: { value: String(SPACER_BASE), type: "spacing" },
  };
  const lines = [`talusSpacer.base ${SPACER_BASE}`];

  for (let px = 0; px <= SPACER_MAX_PX; px += SPACER_BASE) {
    const n = px / SPACER_BASE;
    tokens[String(n)] = {
      value: `{talusSpacer.base} * ${n}`,
      type: "spacing",
    };
    lines.push(`talusSpacer.${n} = ${px}`);
  }

  const fullSteps = SPACER_FULL_PX / SPACER_BASE;
  tokens.full = {
    value: `{talusSpacer.base} * ${fullSteps}`,
    type: "spacing",
  };
  lines.push(`talusSpacer.full = ${SPACER_FULL_PX}`);
  return { tokens, lines };
}

const core = buildCore(SOURCES);
const semantic = buildSemantic(core);
const spacer = buildSpacer();

mkdirSync(OUT_DIR, { recursive: true });
rmSync(`${OUT_DIR}/tokens.json`, { force: true });
rmSync(`${OUT_DIR}/Semantic-hover.json`, { force: true });
rmSync(`${OUT_DIR}/Semantic-pressed.json`, { force: true });

writeFileSync(
  `${OUT_DIR}/Core.json`,
  JSON.stringify({ core: { color: core.color } }, null, 2) + "\n"
);
writeFileSync(
  `${OUT_DIR}/Semantic.json`,
  JSON.stringify({ semantic: { color: semantic.color } }, null, 2) + "\n"
);
writeFileSync(
  `${OUT_DIR}/talusSpacer.json`,
  JSON.stringify(spacer.tokens, null, 2) + "\n"
);
writeFileSync(
  `${OUT_DIR}/$metadata.json`,
  JSON.stringify({ tokenSetOrder: ["Core", "Semantic", "talusSpacer", "typography"] }, null, 2) + "\n"
);
writeFileSync(`${OUT_DIR}/$themes.json`, "[]\n");

const report = [...core.lines, ...semantic.lines, ...spacer.lines];

console.log(`Wrote ${OUT_DIR}/Core.json`);
console.log(`Wrote ${OUT_DIR}/Semantic.json`);
console.log(`Wrote ${OUT_DIR}/talusSpacer.json`);
for (const line of report) console.log(line);
