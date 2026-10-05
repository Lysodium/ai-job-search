import { BASE_URL, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  input: string
  format: "json" | "plain"
}

/**
 * Resolve a detail URL. Unlike some portals, Built In NYC's detail page 404s
 * if the slug in the path doesn't match the numeric id exactly — there is no
 * bare-id lookup, so a full URL or `/job/<slug>/<id>` path is required (the
 * `url` field returned by `search` is exactly this). A bare numeric id alone
 * cannot be resolved to a URL and is rejected with a clear error rather than
 * guessed at.
 */
function resolveUrl(input: string): { url: string; id: string } | null {
  const full = input.match(/^https?:\/\/[^/]+(\/job\/[^/?#]+\/(\d+))/i)
  if (full) return { url: `${BASE_URL}${full[1]}`, id: full[2] }

  const path = input.match(/^(\/job\/[^/?#]+\/(\d+))/)
  if (path) return { url: `${BASE_URL}${path[1]}`, id: path[2] }

  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const resolved = resolveUrl(opts.input)
  if (!resolved) {
    writeError(
      `Could not resolve a detail URL from "${opts.input}" — Built In NYC requires the full "/job/<slug>/<id>" path or URL (as returned in a search result's "url" field); a bare numeric id is not enough on this portal`,
      "BAD_ID",
    )
    return 1
  }
  try {
    const html = await htmlFetch(resolved.url)
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, resolved.id, resolved.url)
    if (!job) {
      writeError("Could not parse job detail from the response", "PARSE_FAILED")
      return 1
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        "",
        job.employmentType ? `Employment: ${job.employmentType}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.datePosted ? `Posted: ${job.datePosted}` : "",
        job.deadline ? `Listing valid through: ${job.deadline}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
