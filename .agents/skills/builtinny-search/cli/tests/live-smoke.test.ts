// Live smoke test against the real Built In NYC site, per the add-portal
// contract: a portal skill must not be registered without proof it returns
// real results. Keep this file's request volume minimal (one search, one
// detail fetch) — see the personal-use warning in SKILL.md.
import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers"

const TEST_QUERY = "machine learning engineer"

describe("live smoke test (network)", () => {
  test("search returns at least one real result", async () => {
    const result = await runCLI(["search", "-q", TEST_QUERY, "--limit", "5"])
    const body = parseJSON<{ meta: { count: number }; results: any[] }>(result)

    expect(result.exitCode).toBe(0)
    expect(body.results.length).toBeGreaterThan(0)
    const first = body.results[0]
    expect(first.id).toBeTruthy()
    expect(first.title).toBeTruthy()
    expect(first.url).toContain("builtinnyc.com/job/")
  }, 30000)

  test("detail resolves a real posting from a search result's url", async () => {
    const searchResult = await runCLI(["search", "-q", TEST_QUERY, "--limit", "1"])
    const body = parseJSON<{ results: any[] }>(searchResult)
    expect(body.results.length).toBeGreaterThan(0)
    const url = body.results[0].url as string

    const detailResult = await runCLI(["detail", url])
    const job = parseJSON<{ title: string; description: string | null }>(detailResult)

    expect(detailResult.exitCode).toBe(0)
    expect(job.title).toBeTruthy()
    expect(job.description).toBeTruthy()
  }, 30000)
})
