# Built In NYC URL Reference

Public, unauthenticated job-board pages on `builtinnyc.com` (New York City tech market
only). Server-rendered HTML — there is no separate JSON API.

> ⚠️ **robots.txt conflict.** `builtinnyc.com/robots.txt` disallows the search query path
> for the generic `User-agent: *` group:
> ```
> Disallow: /jobs*?search=
> Disallow: /jobs*?f*
> Disallow: /jobs*?page=      (except page=1, page=2, page=3, which are explicitly Allowed)
> Disallow: /search/
> Disallow: /search
> ```
> No JSON API, path-based category browsing, or other search mechanism was found as an
> alternative (checked the `/jobs` listing page's markup for one before scaffolding this
> skill). This skill's `search` command therefore deliberately uses a path robots.txt asks
> generic bots not to use. The user was told this plainly and chose to proceed for personal
> use — see the warning in `SKILL.md`.

## Search

```
GET https://www.builtinnyc.com/jobs?search=<query>&daysSinceUpdated=<days>&page=<n>
```

Query params:

| Param | Meaning | Example |
|-------|---------|---------|
| `search` | Free-text query | `machine learning engineer` |
| `daysSinceUpdated` | Posted/updated within N days | `7`, `30` — confirmed live: changes both the result set and result order vs. an unfiltered search |
| `page` | 1-indexed page | `1`, `2`, `3`, … — confirmed live: `page=2` returns a different result set than `page=1` |

No location parameter is used: the portal itself covers only the NYC market, so every
result is already NYC-scoped. (A `location` text-input filter exists in the page's client-side
JS but drives a Google Places autocomplete widget with no plain query-string equivalent
found; not implemented.)

### Response structure

The response is a full HTML page. Two independent sources of job data are embedded in it:

1. **A JSON-LD block** (`<script type="application/ld&#x2B;json">` — note the site
   HTML-entity-encodes the `+` in the script's own `type` attribute as `&#x2B;`, so a plain
   `application/ld+json` string match never finds it) containing an `ItemList` with one
   `ListItem` per result: `position`, `name` (title), `url`, `description`. **No company,
   location, or date** — those three fields are not in this block.
2. **Visible HTML job cards**, each wrapped in `<div id="job-card-<id>" ...>`. Per card:
   - Title + detail URL: `<a ... data-id="job-card-title" data-alias="/job/<slug>/<id>">Title</a>`
   - Company: `<a ... data-id="company-title"><span>Company Name</span></a>`
   - Location: the `<span>` following a `fa-location-dot` icon
   - Relative post date: the text following a `fa-clock` icon (`"Reposted N Days Ago"`,
     `"Posted N Hours Ago"`, etc. — relative text only, no absolute date at the list level)

The CLI parses company/location/date/id/title/url entirely from the HTML job cards (split
on `id="job-card-<id>"` and parsed per chunk, so one malformed card cannot break the rest),
since the JSON-LD block is missing three of the six required fields.

## Detail

```
GET https://www.builtinnyc.com/job/<slug>/<id>
```

**The slug is required and must match exactly** — `/job/<wrong-slug>/<id>` 404s even when
`<id>` is correct (confirmed live). There is no bare-id lookup route. The `detail` command
therefore requires the full URL or `/job/<slug>/<id>` path exactly as returned in a search
result's `url` field; a bare numeric id alone is rejected with an explanatory error rather
than guessed at.

The detail page's JSON-LD block (same encoded-`+` script type as above) is a complete
`JobPosting` node — either at the top level or inside a `@graph` array — with:

| Field | Maps to |
|-------|---------|
| `title` | title |
| `description` | description (HTML; converted to plain text, tags stripped) |
| `hiringOrganization.name` | company |
| `jobLocation.address.addressLocality` / `.addressRegion` | location |
| `baseSalary.value.{minValue,maxValue,unitText}` + `.currency` | salary |
| `datePosted` | datePosted (ISO date, absolute — unlike the relative text on the search list) |
| `validThrough` | deadline |
| `employmentType` | employmentType |

No separate "apply" link/URL was found in the static HTML (the detail page is an
Alpine.js-enhanced Drupal page; if an apply button exists it renders client-side after JS
runs, which this CLI does not execute). The job's own detail-page URL is returned as `url`,
matching the convention other shipped portal skills use when no distinct ATS redirect link
is discoverable from a plain fetch.

## Notes

- No authentication required.
- Zero runtime dependencies — plain `fetch` + regex parsing, same as `linkedin-search`.
- Respect rate limits — the CLI backs off on 429/5xx, same backoff schedule as the other
  shipped skills.
- `robots.txt` explicitly disallows this skill's search path for generic bots (see the
  warning at the top of this file and in `SKILL.md`) — personal use only, low volume.
