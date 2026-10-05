<p align="center">
  <img src="assets/mascot/pip_flight_loop.gif" alt="Pip, the courier bird" width="160">
</p>

# AI Job Search (fork)

A clone of **[MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search)**, the AI job-application framework built on Claude Code: build your profile once, then scrape and rank postings, draft tailored LaTeX CVs and cover letters with a reviewer pass, prepare for interviews and track outcomes. The core workflows and their full documentation come from the original; see its [README](https://github.com/MadsLorentzen/ai-job-search#readme). This fork tracks it as `upstream` and adds the changes below.

> Not affiliated with or endorsed by Anthropic.

## What this fork adds

- **Claude Cowork support.** An installable plugin (`cowork/ai-job-search.plugin`) lets non-developers run every workflow from plain-English requests in the Claude desktop app. It creates the job-search folder for you; see **[COWORK.md](COWORK.md)**. The plugin's skills only point to the existing `.claude/` workflows, and [`cowork/RUNTIME.md`](cowork/RUNTIME.md) maps Claude Code tools to Cowork.
- **Application autofill (`/autofill`).** Fills a tracked application's web form through the final review screen with Playwright CLI (Claude in Chrome when run in Cowork). It **never submits**. See [AUTOFILL.md](AUTOFILL.md).
- **Job-tracker dashboard.** A dependency-free board view of `job_search_tracker.csv` (`index.html`) with filters, status edits and CSV export. See [DASHBOARD.md](DASHBOARD.md).
- **Per-company folders.** `/apply` writes to `cv/<company>/` and `cover_letters/<company>/` instead of one flat folder.
- **One-page CV rule.** CVs must fit exactly one page; overflow is cut by relevance, never by squeezing fonts or margins.
- **Built In NYC portal.** A new job-board search skill (`.agents/skills/builtinny-search`).
- **Pi harness prompts.** `.pi/` mirrors the commands for the Pi coding agent.

Personal data (profile, CVs, cover letters, tracker, research) stays out of git: it lives only in your local copy.

## Quick start

**No terminal?** Follow [COWORK.md](COWORK.md): download the plugin, install it in Cowork, and say *"Set up my job search."*

**Claude Code:** requirements and the full walkthrough are in [SETUP.md](SETUP.md) (Python 3.10+, Bun, a LaTeX install with `lualatex`/`xelatex`).

### 1. Fork and clone

```bash
gh repo fork Lysodium/ai-job-search --clone
cd ai-job-search
```

> [!IMPORTANT]
> A fork of a public repository is always **public**, and `/setup` writes your personal data into tracked files. For your own job search, use a **private** repository with this repo as `upstream` instead; the recipe is in [SETUP.md section 8](SETUP.md#8-pulling-upstream-updates-into-your-fork).

### 2. Run it

```text
/setup                 build your profile
/scrape  then  /rank   find and shortlist jobs
/apply <url or text>   tailored CV + cover letter
/autofill <company>    fill the form, you press Submit
/interview <company>   prep pack and mock interview
```

## Credits and license

Original framework by [Mads Lorentzen](https://github.com/MadsLorentzen) and contributors; job-portal CLI skills by [Mikkel Krogholm](https://github.com/mikkelkrogsholm/skills). MIT licensed, same as the original; see [LICENSE](LICENSE).
