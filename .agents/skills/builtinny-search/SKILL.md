---
name: builtinny-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for tech jobs in New York
  City, find job listings on Built In NYC, or look up a specific Built In NYC
  job posting. Covers the NYC tech/startup market only. Trigger phrases:
  built in nyc, builtinnyc, NYC tech jobs, New York tech jobs, startup jobs
  NYC, find a job in NYC, job search NYC, job openings New York, tech
  vacancies NYC, hiring in NYC, look up this Built In job posting.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/builtinny-search/cli/src/cli.ts *)
---

# Built In NYC Search Skill

Search live tech-job listings from Built In NYC (`builtinnyc.com`), covering the New York
City tech and startup market. No authentication, no API key, and **zero runtime
dependencies** — it runs with just `bun`.

## ⚠️ Personal use only — robots.txt conflict

`builtinnyc.com/robots.txt` **disallows** the search query path (`/jobs*?search=`,
`/jobs*?f*`) for generic bots. No alternative search mechanism (JSON API, path-based
category browsing) exists on the site — this was checked before building the skill. The
user was told this plainly and chose to proceed anyway, for **personal use only**: keep
volume low, never use this commercially or for bulk data collection, and run it on your
own responsibility. Plain unfiltered listing pages (`/jobs`, `/jobs?page=1-3`,
`/jobs/remote`) are allowed by robots.txt, but this skill's `search` command uses the
disallowed query-parameter path in order to support keyword search at all.

## When to use this skill

- Search for NYC tech job openings by keyword/role
- Filter by how recently a posting was updated
- Get the full description, salary, and employment details of a specific listing

## Commands

### Search job listings

```bash
bun run .agents/skills/builtinny-search/cli/src/cli.ts search [flags]
```

Key flags:
- `--query <text>` / `-q <text>` — keyword search (title, skill, role). Recommended.
- `--jobage <days>` — posted/updated within N days. Omit for all postings.
- `--page <n>` — page number (1-indexed).
- `--limit <n>` / `-n <n>` — cap total results emitted (client-side).
- `--format json|table|plain` — default `json`.

There is no `--location` flag: Built In NYC covers only the NYC market, so every result is
already NYC-scoped.

### Fetch full job detail

```bash
bun run .agents/skills/builtinny-search/cli/src/cli.ts detail <url|path> [--format json|plain]
```

`<url|path>` must be the full job URL or `/job/<slug>/<id>` path **exactly as returned in a
search result's `url` field** — Built In NYC's detail page 404s if the slug doesn't match
the id exactly, so a bare numeric id alone is not enough on this portal (unlike some other
job boards). Returns the full description, salary, employment type, posted date, and
listing-valid-through date.

## Usage examples

```bash
# Machine learning roles in NYC
bun run .agents/skills/builtinny-search/cli/src/cli.ts search -q "machine learning engineer" --format table

# Data engineer roles updated in the last 7 days
bun run .agents/skills/builtinny-search/cli/src/cli.ts search -q "data engineer" --jobage 7 --format table

# Second page of results, capped at 5
bun run .agents/skills/builtinny-search/cli/src/cli.ts search -q "backend engineer" --page 2 --limit 5

# Full detail for a specific posting (url from a prior search result)
bun run .agents/skills/builtinny-search/cli/src/cli.ts detail "https://www.builtinnyc.com/job/machine-learning-engineer-level-4/10070232" --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default — programmatic use, passing URLs to `detail` |
| `table` | Quick human-readable scanning |
| `plain` | Reading a single job's full detail (`detail` command) |

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process
exits with code `1`.

## Notes

- Data is scraped from Built In NYC's server-rendered HTML pages — no credentials required,
  no JSON API exists.
- The site embeds a JSON-LD block per page, but its script tag's own `type` attribute is
  HTML-entity-encoded (`application/ld&#x2B;json`), so a literal `application/ld+json`
  string match never finds it — the CLI decodes the entity first.
- Search-result company/location/date come from the visible HTML job cards, not the
  page's JSON-LD `ItemList` (which omits those three fields for list items). Detail-page
  data comes entirely from a complete `JobPosting` JSON-LD node.
- The site may rate-limit; the CLI retries 429/5xx with exponential backoff. Keep volume
  low regardless (see the robots.txt warning above).
- Posted dates on search results are **relative text** ("Reposted 7 Days Ago"), not ISO
  dates — only the `detail` command returns an absolute `datePosted`.
