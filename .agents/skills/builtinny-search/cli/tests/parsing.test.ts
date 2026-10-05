import { describe, expect, test } from "bun:test"
import { parseJobCards, parseJobDetail, extractLdJson, decodeHtmlEntities } from "../src/helpers"

function jobCard(id: string, title: string, company: string, location: string, dateText: string): string {
  return `<div id="job-card-${id}" data-id="job-card" class="job-bounded-responsive">
    <div class="left-side-tile-item-2"><a href="/company/acme" data-id="company-title"><span>${company}</span></a></div>
    <div class="left-side-tile-item-3"><h2><a href="/job/${title.toLowerCase().replace(/\s+/g, "-")}/${id}" data-id="job-card-title" data-alias="/job/${title.toLowerCase().replace(/\s+/g, "-")}/${id}">${title}</a></h2></div>
    <div class="d-flex align-items-start gap-sm"><i class="fa-regular fa-clock"></i>${dateText}</div>
    <div class="d-flex align-items-start gap-sm"><div class="d-flex"><i class="fa-regular fa-location-dot"></i></div>
      <div><span class="font-barlow text-gray-04">${location}</span></div></div>
  </div>`
}

describe("parseJobCards", () => {
  test("extracts id, title, company, location, date, url from a card", () => {
    const html = jobCard("123456", "Machine Learning Engineer", "Acme Corp", "New York, NY, USA", "Reposted 7 Days Ago")
    const cards = parseJobCards(html)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toEqual({
      id: "123456",
      title: "Machine Learning Engineer",
      company: "Acme Corp",
      location: "New York, NY, USA",
      date: "Reposted 7 Days Ago",
      url: "https://www.builtinnyc.com/job/machine-learning-engineer/123456",
    })
  })

  test("one malformed card does not break parsing of the rest", () => {
    const good1 = jobCard("111", "Data Engineer", "Foo Inc", "New York, NY, USA", "Posted 1 Day Ago")
    const malformed = `<div id="job-card-222" data-id="job-card"></div>` // no title link
    const good2 = jobCard("333", "Backend Engineer", "Bar LLC", "Brooklyn, NY, USA", "Reposted 3 Days Ago")
    const cards = parseJobCards(good1 + malformed + good2)
    expect(cards.map((c) => c.id)).toEqual(["111", "333"])
  })

  test("returns an empty array for no matches", () => {
    expect(parseJobCards("<html><body>no jobs here</body></html>")).toEqual([])
  })
})

describe("extractLdJson", () => {
  test("decodes the site's HTML-entity-encoded script type before parsing", () => {
    const html = `<script type="application/ld&#x2B;json">{"@type":"JobPosting","title":"Engineer"}</script>`
    const data = extractLdJson(html)
    expect(data).toEqual({ "@type": "JobPosting", title: "Engineer" })
  })

  test("returns null when no JSON-LD block is present", () => {
    expect(extractLdJson("<html></html>")).toBeNull()
  })

  test("returns null on malformed JSON rather than throwing", () => {
    const html = `<script type="application/ld&#x2B;json">{not valid json</script>`
    expect(extractLdJson(html)).toBeNull()
  })
})

describe("parseJobDetail", () => {
  test("extracts full detail fields from a JobPosting @graph node", () => {
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "JobPosting",
          title: "Machine Learning Engineer, Level 4",
          description: "<p>Build things.</p><br><p>Ship them.</p>",
          hiringOrganization: { name: "Snap Inc." },
          jobLocation: { address: { addressLocality: "New York", addressRegion: "New York" } },
          baseSalary: { currency: "USD", value: { minValue: 147000, maxValue: 259000, unitText: "YEAR" } },
          datePosted: "2026-08-18",
          validThrough: "2026-09-17T00:17:56+00:00",
          employmentType: "FULL_TIME",
        },
      ],
    }
    const html = `<script type="application/ld&#x2B;json">${JSON.stringify(ld)}</script>`
    const job = parseJobDetail(html, "10070232", "https://www.builtinnyc.com/job/x/10070232")
    expect(job).not.toBeNull()
    expect(job!.title).toBe("Machine Learning Engineer, Level 4")
    expect(job!.company).toBe("Snap Inc.")
    expect(job!.location).toBe("New York, New York")
    expect(job!.salary).toBe("USD 147000-259000/year")
    expect(job!.datePosted).toBe("2026-08-18")
    expect(job!.deadline).toBe("2026-09-17T00:17:56+00:00")
    expect(job!.employmentType).toBe("FULL_TIME")
    expect(job!.description).toBe("Build things. Ship them.")
  })

  test("returns null when the page has no JSON-LD", () => {
    expect(parseJobDetail("<html></html>", "1", "https://x")).toBeNull()
  })
})

describe("decodeHtmlEntities", () => {
  test("decodes the site-specific &#x2B; entity as a literal +", () => {
    expect(decodeHtmlEntities("application/ld&#x2B;json")).toBe("application/ld+json")
  })
})
