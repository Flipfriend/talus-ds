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
const DISABLED_MIN_CONTRAST = 3;
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
  warning: "#FFB300",
  danger: "#C3352B",
};

const SPACER_BASE = 4;
const SPACER_MAX_PX = 300;
const SPACER_FULL_PX = 1000;
const BORDER_MIN = 3;
const ON_SURFACE_ALPHA = 0.12;
const UI_SURFACES = { bg: 38, "01": 34, "02": 30 };
const TEXT_KEYS = ["01", "02", "03", "04"];
const REQUIRED_TEXT = ["01", "04"];
const INTERACTIVE_ROLES = [
  { role: "primary", ramp: "accent1" },
  { role: "secondary", ramp: "accent2" },
  { role: "tertiary", ramp: "accent3" },
  { role: "quaternary", ramp: "accent4" },
];
const SUPPORT_ROLES = ["success", "info", "warning", "danger"];

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
 * Translucent wash of scale20 for chrome/selection on ui surfaces.
 * Nested as on-surface.bg so every role/status child is a group (Figma Variables).
 */
function onSurfaceBg(ramp) {
  return {
    value: `{core.color.${ramp}.scale${ACCENT_ANCHOR}}`,
    type: "color",
    $extensions: modifyExtension("alpha", ON_SURFACE_ALPHA),
  };
}

/**
 * Walk away from bgIndex toward the opposite end of the ramp.
 * The first step at or above minContrast is the nearest compliant color.
 * If that direction fails, try the other direction.
 */
function pickOnRampAtContrast(bgHex, palette, bgIndex, minContrast) {
  const towardDark = bgIndex > STEPS / 2;
  const primary = towardDark ? -1 : 1;

  for (const direction of [primary, -primary]) {
    for (let step = 1; step <= STEPS; step++) {
      const index = bgIndex + direction * step;
      if (index < 0 || index > STEPS) break;
      const ratio = wcagContrast(bgHex, palette[index]);
      if (ratio >= minContrast) return { index, ratio };
    }
  }
  return null;
}

function pickOnRamp(bgHex, palette, bgIndex) {
  return pickOnRampAtContrast(bgHex, palette, bgIndex, MIN_CONTRAST);
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

function restingPair(core, ramp, label) {
  const bgIndex = core.anchors[ramp];
  const palette = core.resolved[ramp];
  const bgHex = palette[bgIndex];
  const picked = requirePair(
    `${label}.fg`,
    pickOnRamp(bgHex, palette, bgIndex),
    bgHex,
    palette
  );
  return {
    bg: alias(ramp, bgIndex),
    fg: alias(ramp, picked.index),
    bgIndex,
    fgIndex: picked.index,
    ratio: picked.ratio,
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
      `text.01 and text.04 need a high-contrast step and a distinct 4.5:1 step (found ${textPassing.length})`
    );
  }
  const hierarchySlots = TEXT_KEYS.length;
  const lastPassing = textPassing.length - 1;
  const chosen = [];
  const used = new Set();
  for (let slot = 0; slot < hierarchySlots; slot++) {
    const pos = Math.round((slot * lastPassing) / (hierarchySlots - 1));
    if (used.has(pos)) continue;
    used.add(pos);
    chosen.push(textPassing[pos]);
  }
  const text = {};
  const textSteps = {
    "01": chosen[0],
    "02": chosen.length > 2 ? chosen[1] : undefined,
    "03": chosen.length > 3 ? chosen[2] : undefined,
    "04": chosen[chosen.length - 1],
  };
  for (const key of TEXT_KEYS) {
    const step = textSteps[key];
    if (!step) {
      lines.push(`text.${key} omitted`);
      if (REQUIRED_TEXT.includes(key)) {
        throw new Error(
          `text.${key} cannot clear ${MIN_CONTRAST}:1 on every UI surface`
        );
      }
      continue;
    }
    text[key] = alias("neutral", step.index);
    lines.push(
      `text.${key} neutral.scale${step.index}  ${formatRatios(step.ratios)}`
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
      ? borderPassing
          .map((step) => `scale${step.index} ${formatRatios(step.ratios)}`)
          .join(" | ")
      : "none";
    throw new Error(
      `ui.border needs 3 steps at ${BORDER_MIN}:1 (found ${detail})`
    );
  }
  // slice(-3): [strong, default, subtle] — strong is closest to the surfaces
  const borderSteps = borderPassing.slice(-3);
  const borderKeys = ["strong", "default", "subtle"];
  const border = {};
  borderSteps.forEach((step, offset) => {
    const key = borderKeys[offset];
    border[key] = alias("neutral", step.index);
    lines.push(
      `ui.border.${key} neutral.scale${step.index}  ${formatRatios(step.ratios)}`
    );
  });
  const orderedUi = {
    bg: alias("neutral", UI_SURFACES.bg),
    "01": alias("neutral", UI_SURFACES["01"]),
    "02": alias("neutral", UI_SURFACES["02"]),
    border: {
      subtle: border.subtle,
      default: border.default,
      strong: border.strong,
    },
  };

  const interactive = {};
  for (const { role, ramp } of INTERACTIVE_ROLES) {
    const resting = restingPair(core, ramp, `interactive.${role}.default`);
    lines.push(
      `interactive.${role}.default.bg ${ramp}.scale${resting.bgIndex}  interactive.${role}.default.fg ${ramp}.scale${resting.fgIndex}  ${resting.ratio.toFixed(2)}:1`
    );

    // Every child of a role is a group so Figma Variables export does not
    // skip leaf tokens that sit next to nested hover/pressed groups.
    const roleTokens = {
      default: {
        bg: resting.bg,
        fg: resting.fg,
      },
    };
    for (const [mode, steps] of Object.entries(STATE_SHIFTS)) {
      const chosen = pickState(
        core,
        ramp,
        steps,
        `interactive.${role}.${mode}`
      );
      roleTokens[mode] = {
        bg: alias(ramp, chosen.bgIndex),
        fg: alias(ramp, chosen.textIndex),
      };
      const side = chosen.direction < 0 ? "darker" : "lighter";
      lines.push(
        `interactive.${role}.${mode}.bg ${ramp}.scale${chosen.bgIndex} (${side})  interactive.${role}.${mode}.fg ${ramp}.scale${chosen.textIndex}  ${chosen.ratio.toFixed(2)}:1`
      );
    }
    roleTokens["on-surface"] = { bg: onSurfaceBg(ramp) };
    lines.push(
      `interactive.${role}.on-surface.bg ${ramp}.scale${ACCENT_ANCHOR} alpha ${ON_SURFACE_ALPHA}`
    );
    interactive[role] = roleTokens;
  }

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
  interactive.link = alias("accent1", link.index);

  const disabledBgIndex = ACCENT_ANCHOR;
  const disabledBgHex = neutral[disabledBgIndex];
  const disabledFg = pickOnRampAtContrast(
    disabledBgHex,
    neutral,
    disabledBgIndex,
    DISABLED_MIN_CONTRAST
  );
  if (!disabledFg) {
    throw new Error(
      `interactive.disabled.fg: no neutral step reaches ${DISABLED_MIN_CONTRAST}:1 on neutral.scale${disabledBgIndex}`
    );
  }
  lines.push(
    `interactive.disabled.bg neutral.scale${disabledBgIndex}  interactive.disabled.fg neutral.scale${disabledFg.index}  ${disabledFg.ratio.toFixed(2)}:1`
  );
  interactive.disabled = {
    bg: alias("neutral", disabledBgIndex),
    fg: alias("neutral", disabledFg.index),
  };

  const support = {};
  for (const ramp of SUPPORT_ROLES) {
    const label = `support.${ramp}`;
    const resting = restingPair(core, ramp, `${label}.default`);
    lines.push(
      `${label}.default.bg ${ramp}.scale${resting.bgIndex}  ${label}.default.fg ${ramp}.scale${resting.fgIndex}  ${resting.ratio.toFixed(2)}:1`
    );

    const contrast = pickLink(surfaces["ui.02"], core.resolved[ramp]);
    if (!contrast) {
      throw new Error(
        `${label}.contrast: no step reaches ${MIN_CONTRAST}:1 on ui.02 (best ${bestRatio(surfaces["ui.02"], core.resolved[ramp]).toFixed(2)}:1)`
      );
    }
    const contrastRatios = ratiosAgainst(
      core.resolved[ramp][contrast.index],
      surfaces
    );
    lines.push(
      `${label}.contrast.fg ${ramp}.scale${contrast.index}  ${formatRatios(contrastRatios)}`
    );

    // Same group-only shape as interactive roles (default / contrast / on-surface / hover / pressed).
    const family = {
      default: {
        bg: resting.bg,
        fg: resting.fg,
      },
      contrast: {
        fg: alias(ramp, contrast.index),
      },
      "on-surface": {
        bg: onSurfaceBg(ramp),
      },
    };
    lines.push(
      `${label}.on-surface.bg ${ramp}.scale${ACCENT_ANCHOR} alpha ${ON_SURFACE_ALPHA}`
    );
    for (const [mode, steps] of Object.entries(STATE_SHIFTS)) {
      const chosen = pickState(core, ramp, steps, `${label}.${mode}`);
      family[mode] = {
        bg: alias(ramp, chosen.bgIndex),
        fg: alias(ramp, chosen.textIndex),
      };
      const side = chosen.direction < 0 ? "darker" : "lighter";
      lines.push(
        `${label}.${mode}.bg ${ramp}.scale${chosen.bgIndex} (${side})  ${label}.${mode}.fg ${ramp}.scale${chosen.textIndex}  ${chosen.ratio.toFixed(2)}:1`
      );
    }
    support[ramp] = family;
  }

  return {
    color: {
      ui: orderedUi,
      text,
      interactive,
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
