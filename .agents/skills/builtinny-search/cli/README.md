# builtinny-cli

CLI for searching jobs on Built In NYC's public job-board pages, covering the **New York
City tech and startup market**.

**Data source**: `builtinnyc.com` server-rendered HTML pages (no JSON API exists).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch` + regex parsing). `bun install` is optional
and only pulls dev type defs.

> **Personal use only.** `builtinnyc.com/robots.txt` disallows the search query path
> (`/jobs*?search=`, `/jobs*?f*`) for generic bots, and this CLI uses it anyway since no
> alternative search mechanism exists on the site. Keep volume low, don't use it
> commercially or for bulk data collection, and run it on your own responsibility.

## Installation

```bash
cd .agents/skills/builtinny-search/cli
bun install   # optional — only installs TypeScript dev types
```

The CLI runs without any install because it has zero runtime dependencies.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search for NYC tech job listings by keyword |
| `detail` | Fetch full detail for a single job listing (needs the full URL/path from a search result) |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
# Machine learning roles in NYC
bun run src/cli.ts search -q "machine learning engineer" --format table

# Data engineer roles updated in the last 7 days
bun run src/cli.ts search -q "data engineer" --jobage 7 --format table

# Full detail for one job (url copied from a search result)
bun run src/cli.ts detail "https://www.builtinnyc.com/job/machine-learning-engineer-level-4/10070232" --format plain
```

See `../SKILL.md` for the full flag reference and the robots.txt/personal-use note, and
`../url-reference.md` for the markup anchors this CLI parses.

## Search flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--query` | `-q` | Keywords (title / skill / role). Recommended. |
| `--jobage` | | Posted/updated within N days. |
| `--page` | | 1-indexed page. |
| `--limit` | `-n` | Cap results emitted. |
| `--format` | | `json` \| `table` \| `plain`. |

No `--location` flag — the portal itself covers only the NYC market.
