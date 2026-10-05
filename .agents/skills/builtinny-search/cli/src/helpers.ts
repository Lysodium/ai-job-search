// Data source: Built In NYC's public job-board pages (builtinnyc.com). No
// authentication required. Both the search-results page and a single job's
// detail page are server-rendered HTML with a per-page JSON-LD block embedded
// in a <script type="application/ld+json"> tag — except this site HTML-entity
// encodes the "+" in that type attribute as "&#x2B;", so a literal string match
// on `application/ld+json` never matches; see `extractLdJson` below.
//
// The search-results JSON-LD (`@type: "ItemList"`) only carries position/name/
// url/description per item — no company, location, or date — so those three
// fields are parsed from the visible HTML job cards instead (each wrapped in
// `<div id="job-card-<id>" ...>`), independently per card so one malformed
// card cannot break the rest. The detail page's JSON-LD (`@type: "JobPosting"`)
// is complete: title, full HTML description, company, location, salary,
// datePosted, validThrough, employmentType.

export const BASE_URL = "https://www.builtinnyc.com"
export const SEARCH_PATH = "/jobs"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; builtinny-search-cli/1.0)"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
}

export interface JobDetail extends JobCard {
  description: string | null
  employmentType: string | null
  datePosted: string | null
  deadline: string | null
  salary: string | null
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2B;/gi, "+")
    // Numeric character references: decimal (&#233;) and hexadecimal (&#xE9;).
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html))
}

/**
 * Extract and parse the page's JSON-LD payload. The script tag's own `type`
 * attribute is itself HTML-entity-encoded (`application/ld&#x2B;json`), which
 * is why a plain `application/ld+json` match fails on this site.
 */
export function extractLdJson(html: string): any | null {
  const m = html.match(/<script type="application\/ld&#x2B;json">\s*([\s\S]*?)<\/script>/i)
  if (!m) return null
  try {
    return JSON.parse(decodeHtmlEntities(m[1]))
  } catch {
    return null
  }
}

/**
 * Parse the search-results page: split on each job card's container
 * (`id="job-card-<id>"`) and parse fields independently per chunk so one
 * malformed card cannot break the rest. Company/location/date live only in
 * this visible HTML, not in the page's JSON-LD (which omits them for list
 * items).
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/id="job-card-(\d+)"/).slice(1)

  // String.split with a capturing group interleaves the captured id and the
  // text that follows it: [id, chunkText, id, chunkText, ...].
  for (let i = 0; i < chunks.length; i += 2) {
    const id = chunks[i]
    const chunk = chunks[i + 1] ?? ""
    if (!id || !chunk) continue

    const titleMatch = chunk.match(
      /data-id="job-card-title"[^>]*data-alias="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i,
    )
    if (!titleMatch) continue
    const title = clean(titleMatch[2])
    if (!title) continue
    const url = `${BASE_URL}${decodeHtmlEntities(titleMatch[1])}`

    const companyMatch = chunk.match(/data-id="company-title"[^>]*>([\s\S]*?)<\/a>/i)
    const company = companyMatch ? clean(companyMatch[1]) || null : null

    const locMatch = chunk.match(/fa-location-dot[^"]*"[^>]*><\/i>\s*(?:<\/div>)?\s*<div>\s*<span[^>]*>([\s\S]*?)<\/span>/i)
    const location = locMatch ? clean(locMatch[1]) || null : null

    // The relative-date text varies: "Reposted N Days Ago", "N Hours Ago",
    // "Yesterday", "Reposted Yesterday", "Today" — no fixed suffix, so this
    // captures whatever text follows the clock icon up to the next tag.
    const dateMatch = chunk.match(/fa-clock[^"]*"[^>]*><\/i>\s*([^<]+)/i)
    const date = dateMatch ? clean(dateMatch[1]) || null : null

    results.push({ id, title, company, location, date, url })
  }

  return results
}

/** Convert a JobPosting's HTML description to plain text, keeping paragraph/line breaks. */
function descriptionToPlain(html: string): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(stripTags(withBreaks)).replace(/\n{3,}/g, "\n\n").trim()
  return text || null
}

function formatSalary(baseSalary: any): string | null {
  if (!baseSalary?.value) return null
  const { minValue, maxValue, unitText } = baseSalary.value
  const currency = baseSalary.currency || ""
  const unit = unitText ? `/${String(unitText).toLowerCase()}` : ""
  if (minValue && maxValue) return `${currency} ${minValue}-${maxValue}${unit}`
  if (minValue) return `${currency} ${minValue}+${unit}`
  return null
}

/** Parse a single job's detail page from its embedded JobPosting JSON-LD. */
export function parseJobDetail(html: string, id: string, url: string): JobDetail | null {
  const data = extractLdJson(html)
  if (!data) return null
  const node = Array.isArray(data["@graph"])
    ? data["@graph"].find((n: any) => n["@type"] === "JobPosting")
    : data["@type"] === "JobPosting"
      ? data
      : null
  if (!node) return null

  const address = node.jobLocation?.address
  const location = address
    ? [address.addressLocality, address.addressRegion].filter(Boolean).join(", ") || null
    : null

  return {
    id,
    title: node.title ? clean(node.title) : "(untitled)",
    company: node.hiringOrganization?.name ?? null,
    location,
    date: node.datePosted ?? null,
    url,
    description: node.description ? descriptionToPlain(node.description) : null,
    employmentType: node.employmentType ?? null,
    datePosted: node.datePosted ?? null,
    deadline: node.validThrough ?? null,
    salary: formatSalary(node.baseSalary),
  }
}
