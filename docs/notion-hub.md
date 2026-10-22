# Notion hub — setup and sync

Team-facing hub: [Talus Design System](https://app.notion.com/p/400a0094e2f38082a0ccf7fed2b360c0)

GitHub remains the technical source of truth (`docs/*.md` + `talus-ds/src`). Notion holds guidelines and published token-set overviews.

## What’s in Notion

| Piece | Role |
| --- | --- |
| Hub page | Purpose, layer model, links |
| **Token Sets** database | Core, Semantic, Spacing, Typography — properties + page bodies |
| **Guidelines** database | Architecture, contrast, process rules (`Required` view) |

Each Token Set page has:

1. **Synced from GitHub** — overwritten by CI after merges to `main`
2. **Notes** — human-owned; never overwritten

IDs and page mapping: [`docs/notion-sync.json`](./notion-sync.json).

## Lane A — content sync (GitHub Action)

Workflow: [`.github/workflows/sync-notion.yml`](../.github/workflows/sync-notion.yml)  
Script: [`scripts/sync-notion-docs.mjs`](../scripts/sync-notion-docs.mjs)

Runs on push to `main` when `docs/**`, `talus-ds/src/**`, or the sync script change. Also available via **Actions → Sync Notion docs → Run workflow**.

### One-time secrets setup

1. In Notion: **Settings → Connections → Develop or manage integrations** → create an **internal integration** with content read/update (and insert if required by your workspace).
2. Open the [Talus Design System](https://app.notion.com/p/400a0094e2f38082a0ccf7fed2b360c0) page → `…` → **Connections** → add that integration. Repeat for the Token Sets and Guidelines databases if they do not inherit access.
3. In GitHub (**Flipfriend/talus-ds** → Settings → Secrets and variables → Actions), add:

| Secret | Value |
| --- | --- |
| `NOTION_TOKEN` | Integration secret (`secret_…`) |
| `NOTION_HUB_PAGE_ID` | `400a0094e2f38082a0ccf7fed2b360c0` |
| `NOTION_TOKEN_SETS_DB_ID` | `25e0927ad1b4482d8e672fad659ff9f5` |

Local dry run (after exporting `NOTION_TOKEN`):

```bash
node scripts/sync-notion-docs.mjs
```

## Lane B — PR / issue context (native Notion GitHub connection)

This tracks **what’s changing**. It does **not** rewrite token documentation. Content still refreshes via Lane A after merge.

### Connect GitHub

1. In Notion: **Settings → Connections** → connect **GitHub** for the workspace.
2. Confirm access to `Flipfriend/talus-ds`.

### Add a GitHub Pull Requests property

1. Open the **Token Sets** database → add a property → choose **GitHub Pull Requests** (under connections).
2. Optionally add the same property on **Guidelines**.
3. When a PR touches a set, paste the PR into that row (or use magic keywords in the PR description that reference the Notion page ID — see [Notion’s GitHub guide](https://www.notion.com/help/guides/bring-your-codebase-into-context-with-notions-github-integration)).

### Optional: “Changes in flight” on the hub

1. On the hub page, type `/synced` (or **Synced database**) and pick **GitHub Pull Requests** / Issues for `Flipfriend/talus-ds`.
2. Filter to open PRs.
3. Place it under the **Changes in flight** heading already on the hub.

Convention for PR descriptions that touch tokens:

```text
Relates to https://www.notion.so/401a0094e2f381579851e2ba28bb12f4
```

(Use the Token Set page URL for Semantic, Core, Spacing, or Typography from `docs/notion-sync.json`.)

## Enable order (Tokens Studio)

`Core` → `Semantic` → `talusSpacer` → `typography`
