import { describe, expect, test } from "bun:test"
import { runCLI } from "./helpers"

describe("builtinny CLI error contract", () => {
  test("detail without a url/path fails before making a request", async () => {
    const result = await runCLI(["detail"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    expect(JSON.parse(result.stderr)).toEqual({
      error: "detail requires a <url|path>",
      code: "NO_ID",
    })
  })

  test("detail with a bare numeric id (no slug) fails with a clear error", async () => {
    const result = await runCLI(["detail", "10070232"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_ID")
    expect(err.error).toContain("bare numeric id is not enough")
  })

  test("an unknown flag fails before making a request", async () => {
    const result = await runCLI(["search", "--query", "test", "--bogus", "1"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("UNKNOWN_FLAG")
  })

  test("a non-numeric --jobage fails before making a request", async () => {
    const result = await runCLI(["search", "--query", "test", "--jobage", "not-a-number"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_ARG")
  })

  test("an unknown command fails", async () => {
    const result = await runCLI(["bogus-command"])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe("")
    const err = JSON.parse(result.stderr)
    expect(err.code).toBe("BAD_CMD")
  })
})
