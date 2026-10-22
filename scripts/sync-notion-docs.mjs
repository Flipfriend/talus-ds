// Syncs Token Sets Notion pages from docs/*.md + talus-ds/src summaries.
// Updates properties and replaces only the <!-- talus-sync:start/end --> section.
//
// Required env:
//   NOTION_TOKEN                 Notion internal integration secret
// Optional env:
//   NOTION_TOKEN_SETS_DB_ID      overrides docs/notion-sync.json
//   GITHUB_SHA                   commit SHA written to Last commit
//   GITHUB_REPOSITORY            owner/repo for blob links (default Flipfriend/talus-ds)
//
// Usage: node scripts/sync-notion-docs.mjs

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const NOTION_VERSION = "2022-06-28";
const REPO = process.env.GITHUB_REPOSITORY || "Flipfriend/talus-ds";
const BRANCH = process.env.GITHUB_REF_NAME || "main";

const token = process.env.NOTION_TOKEN;
if (!token) {
  console.error("NOTION_TOKEN is required");
  process.exit(1);
}

const mapping = JSON.parse(
  readFileSync(resolve(ROOT, "docs/notion-sync.json"), "utf8")
);
const databaseId =
  process.env.NOTION_TOKEN_SETS_DB_ID || mapping.tokenSetsDatabaseId;

const sha =
  process.env.GITHUB_SHA?.slice(0, 7) ||
  execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
const syncedDate = new Date().toISOString().slice(0, 10);

function githubBlob(path) {
  return `https://github.com/${REPO}/blob/${BRANCH}/${path}`;
}

async function notion(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Notion ${method} ${path} → ${res.status}: ${JSON.stringify(data)}`
    );
  }
  return data;
}

function richText(content) {
  const chunks = [];
  const text = String(content);
  for (let i = 0; i < text.length; i += 2000) {
    chunks.push({
      type: "text",
      text: { content: text.slice(i, i + 2000) },
    });
  }
  return chunks.length ? chunks : [{ type: "text", text: { content: "" } }];
}

function paragraph(text) {
  return {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: richText(text) },
  };
}

function heading2(text) {
  return {
    object: "block",
    type: "heading_2",
    heading_2: { rich_text: richText(text) },
  };
}

function heading3(text) {
  return {
    object: "block",
    type: "heading_3",
    heading_3: { rich_text: richText(text) },
  };
}

function bulleted(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: richText(text) },
  };
}

function extractSection(markdown, heading) {
  const pattern = new RegExp(
    `^## ${heading}\\s*\\n([\\s\\S]*?)(?=^## |\\Z)`,
    "m"
  );
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

function firstParagraph(markdown) {
  const lines = markdown.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    if (line.startsWith("|") || line.startsWith("```") || line.startsWith("-")) {
      continue;
    }
    return line.replace(/\*\*/g, "").trim();
  }
  return "";
}

function summarizeTypography(json) {
  const sizes = Object.keys(json["font-size"] || {}).length;
  const headings = Object.keys(json.headings || {}).filter((k) => k !== "inline");
  return [
    heading3("Primitives (from JSON)"),
    bulleted(
      `font-family.nata-sans, font-weight.regular/bold, line-height.auto, ${sizes} font-size steps`
    ),
    bulleted(
      "letter/paragraph spacing and indent at 0px; text-case.none; text-decoration none/underline"
    ),
    heading3("Styles (from JSON)"),
    bulleted(`headings: ${headings.join(", ")} (+ headings.inline.*)`),
    bulleted("body.p1–p6 and body.variations.p1–p6"),
  ];
}

function summarizeCore(json) {
  const sources = Object.keys(json.core?.color || {});
  return [
    heading3("Sources (from JSON)"),
    bulleted(sources.length ? sources.join(", ") : "(none found)"),
  ];
}

function summarizeSemantic(json) {
  const top =
    json.semantic?.color != null
      ? Object.keys(json.semantic.color)
      : Object.keys(json).filter((k) => !k.startsWith("$"));
  return [
    heading3("Families (from JSON)"),
    bulleted(top.length ? top.join(", ") : "(none found)"),
  ];
}

function summarizeSpacer(json) {
  const keys = Object.keys(json).filter((k) => k !== "base");
  return [
    heading3("Scale (from JSON)"),
    bulleted(`base = ${json.base?.value ?? "?"}`),
    bulleted(`${keys.length} step tokens (including full)`),
  ];
}

function buildSyncedBlocks(setKey, meta) {
  const specPath = resolve(ROOT, meta.specDoc);
  const sourcePath = resolve(ROOT, meta.sourceFile);
  const spec = readFileSync(specPath, "utf8");
  const purpose =
    firstParagraph(spec) ||
    extractSection(spec, "Purpose").split("\n")[0] ||
    meta.role;

  let jsonSummary = [];
  try {
    const json = JSON.parse(readFileSync(sourcePath, "utf8"));
    if (setKey === "Core") jsonSummary = summarizeCore(json);
    else if (setKey === "Semantic") jsonSummary = summarizeSemantic(json);
    else if (setKey === "talusSpacer") jsonSummary = summarizeSpacer(json);
    else if (setKey === "typography") jsonSummary = summarizeTypography(json);
  } catch (err) {
    jsonSummary = [paragraph(`Could not summarize JSON: ${err.message}`)];
  }

  const guardrails = extractSection(spec, "Guardrails");
  const doDont = [];
  if (guardrails) {
    for (const line of guardrails.split("\n")) {
      const item = line.replace(/^\d+\.\s*/, "").trim();
      if (item) doDont.push(bulleted(item));
    }
  }

  return [
    heading2("Synced from GitHub"),
    paragraph("<!-- talus-sync:start -->"),
    paragraph(`Set key: ${setKey}`),
    paragraph(`Source: ${githubBlob(meta.sourceFile)}`),
    paragraph(`Spec: ${githubBlob(meta.specDoc)}`),
    paragraph(`Last commit: ${sha}`),
    heading3("Purpose"),
    paragraph(purpose),
    ...jsonSummary,
    ...(doDont.length ? [heading3("Do / Don’t"), ...doDont] : []),
    paragraph("<!-- talus-sync:end -->"),
  ];
}

function blockPlainText(block) {
  const type = block.type;
  const payload = block[type];
  if (!payload?.rich_text) return "";
  return payload.rich_text.map((t) => t.plain_text || "").join("");
}

function isNotesHeading(block) {
  return (
    blockPlainText(block) === "Notes" &&
    String(block.type).startsWith("heading")
  );
}

async function listChildren(blockId) {
  const blocks = [];
  let cursor;
  do {
    const qs = cursor
      ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100`
      : "?page_size=100";
    const page = await notion(`/blocks/${blockId}/children${qs}`);
    blocks.push(...page.results);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return blocks;
}

async function deleteBlock(blockId) {
  await notion(`/blocks/${blockId}`, { method: "DELETE" });
}

async function appendBlocks(pageId, children, after) {
  for (let i = 0; i < children.length; i += 100) {
    const body = { children: children.slice(i, i + 100) };
    if (after && i === 0) body.after = after;
    await notion(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body,
    });
  }
}

async function replaceSyncedSection(pageId, newBlocks) {
  const children = await listChildren(pageId);
  let start = -1;
  let end = -1;
  let notesIndex = -1;

  for (let i = 0; i < children.length; i++) {
    const text = blockPlainText(children[i]);
    if (isNotesHeading(children[i])) notesIndex = i;

    if (
      start < 0 &&
      (text === "Synced from GitHub" || text.includes("talus-sync:start"))
    ) {
      start =
        text.includes("talus-sync:start") &&
        i > 0 &&
        blockPlainText(children[i - 1]) === "Synced from GitHub"
          ? i - 1
          : i;
    }

    if (start >= 0 && end < 0 && text.includes("talus-sync:end")) end = i;
  }

  if (start >= 0 && end < 0 && notesIndex > start) end = notesIndex - 1;

  if (start >= 0) {
    const last =
      end >= start
        ? end
        : notesIndex > start
          ? notesIndex - 1
          : children.length - 1;
    for (let i = last; i >= start; i--) await deleteBlock(children[i].id);
  }

  const remaining = await listChildren(pageId);
  const notesAt = remaining.findIndex(isNotesHeading);

  if (notesAt > 0) {
    await appendBlocks(pageId, newBlocks, remaining[notesAt - 1].id);
    return;
  }

  if (notesAt === 0) {
    const restored = [
      heading2("Notes"),
      ...remaining.slice(1).map((b) => paragraph(blockPlainText(b) || "")),
    ];
    for (const b of remaining) await deleteBlock(b.id);
    await appendBlocks(pageId, [...newBlocks, ...restored]);
    return;
  }

  await appendBlocks(pageId, newBlocks);
}

async function updateProperties(pageId, setKey, meta) {
  await notion(`/pages/${pageId}`, {
    method: "PATCH",
    body: {
      properties: {
        Name: { title: [{ type: "text", text: { content: meta.name } }] },
        "Set key": { select: { name: setKey } },
        Role: { rich_text: richText(meta.role) },
        "Source file": { url: githubBlob(meta.sourceFile) },
        "Spec doc": { url: githubBlob(meta.specDoc) },
        "May contain raw values": {
          select: { name: meta.mayContainRawValues },
        },
        Status: { status: { name: "Active" } },
        "Last commit": { rich_text: richText(sha) },
        "Last synced": { date: { start: syncedDate } },
      },
    },
  });
}

async function main() {
  console.log(`Syncing Token Sets → Notion (db ${databaseId}), commit ${sha}`);
  for (const [setKey, meta] of Object.entries(mapping.sets)) {
    console.log(`• ${setKey} (${meta.pageId})`);
    await updateProperties(meta.pageId, setKey, meta);
    await replaceSyncedSection(meta.pageId, buildSyncedBlocks(setKey, meta));
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
