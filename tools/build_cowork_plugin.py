#!/usr/bin/env python3
"""Build the Claude Cowork plugin (cowork/ai-job-search.plugin).

Run from anywhere:  python3 tools/build_cowork_plugin.py

The plugin is a thin layer over this repository:

- One Cowork skill per workflow (setup, apply, scrape, ...). Each generated
  SKILL.md only locates the user's job-search folder, loads
  cowork/RUNTIME.md, and then follows the canonical workflow file in
  .claude/ - the single source of truth (see AGENTS.md). No workflow rules
  are copied into the plugin, so they cannot drift.
- The `setup` skill bundles a clean copy of this workspace
  (assets/workspace-template.zip) so a non-technical user can install one file
  and have Claude create the folder for them.

Privacy guard: the bundle is built from git-tracked files minus every
personal-data location, and the build refuses to run if the profile files
look personalized (a fork that has run /setup), unless --allow-personal.
"""

from __future__ import annotations

import argparse
import fnmatch
import io
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "cowork" / "ai-job-search.plugin"
PLUGIN_NAME = "ai-job-search"
PLUGIN_VERSION = "0.1.0"

# Git-tracked paths that never go into the workspace template.
EXCLUDE = [
    ".github/*", "tests/*", "cowork/*.plugin",
    "CHANGELOG.md", "CONTRIBUTING.md", "SECURITY.md",
    ".mcp.json", "SETUP-*.md",
    # personal-data locations (mirrors .gitignore; belt and braces)
    "job_search_tracker.csv", "dashboard-data.js",
    "company_research/*.json",
    "job_scraper/*.json", "job_scraper/*.md",
    "reports/*", "gmail_sync/*", "upskill/*.md",
    ".pi/credentials/*",
]
# Inside cv/ and cover_letters/ only the stock templates ship.
KEEP_UNDER = {
    "cv/": ["cv/main_example.tex"],
    "cover_letters/": ["cover_letters/cover.cls", "cover_letters/cover_example.tex",
                       "cover_letters/OpenFonts/*"],
    "documents/": ["documents/README.md", "documents/*/.gitkeep"],
}

# (skill name, workflow file in the workspace, Cowork description)
SKILLS = [
    ("setup", ".claude/commands/setup.md",
     "Sets up the AI job search workspace and the candidate profile. Use when the user says "
     "\"set up my job search\", \"get started\", \"build my profile\", \"import my CV/LinkedIn\", "
     "or when no job-search folder is connected yet."),
    ("apply", ".claude/commands/apply.md",
     "Evaluates a job posting and drafts a tailored CV and cover letter (LaTeX to PDF) with a "
     "reviewer pass. Use for \"apply to this job\", \"tailor my CV for <url>\", \"write a cover "
     "letter for this posting\", or a pasted job ad the user wants to apply to."),
    ("scrape", ".claude/skills/job-scraper/SKILL.md",
     "Finds new job postings that match the profile across job boards and saves them. Use for "
     "\"find me jobs\", \"search for new jobs\", \"what's new this week\", \"scrape jobs\"."),
    ("rank", ".claude/commands/rank.md",
     "Scores and ranks the jobs found by the scraper into a shortlist. Use for \"rank my jobs\", "
     "\"which jobs should I apply to\", \"shortlist the new postings\"."),
    ("autofill", ".claude/commands/autofill.md",
     "Fills in an online job application form in the browser up to the final review screen, "
     "never submitting. Use for \"fill out the application for <company>\", \"autofill this "
     "application\", \"upload my CV to the form\"."),
    ("interview", ".claude/commands/interview.md",
     "Prepares a stage-specific interview prep pack and optional mock interview for a tracked "
     "application. Use for \"prepare me for my interview at <company>\", \"mock interview\"."),
    ("outcome", ".claude/commands/outcome.md",
     "Records what happened with an application (interview invite, rejection, offer). Use for "
     "\"I got an interview with <company>\", \"<company> rejected me\", \"update my application status\"."),
    ("expand", ".claude/commands/expand.md",
     "Enriches the candidate profile with skills found in documents and public online presence. "
     "Use for \"find skills I'm missing from my profile\", \"expand my profile\"."),
    ("gmail-sync", ".claude/commands/gmail-sync.md",
     "Checks Gmail for replies about tracked applications and proposes status updates. Use for "
     "\"check my email for application updates\", \"sync my applications from Gmail\"."),
    ("notion-sync", ".claude/commands/notion-sync.md",
     "Publishes ranked jobs and applications to a Notion database. Use for \"push my jobs to "
     "Notion\", \"sync my job search to Notion\"."),
    ("dashboard", "DASHBOARD.md",
     "Shows the job-application tracker as a dashboard. Use for \"show my job dashboard\", "
     "\"how is my job search going\", \"application tracker\", \"make an HTML report\"."),
    ("upskill", ".claude/skills/upskill/SKILL.md",
     "Analyzes skill gaps across target postings and builds a learning plan. Use for \"what "
     "should I learn\", \"skill gaps\", \"upskill plan\"."),
    ("add-portal", ".claude/commands/add-portal.md",
     "Builds a search skill for a new job board. Use for \"add <job board> to my job search\", "
     "\"search jobs on <site> too\"."),
    ("add-template", ".claude/commands/add-template.md",
     "Registers the user's own CV or cover-letter template. Use for \"use my own CV template\", "
     "\"add a resume template\"."),
    ("reset", ".claude/commands/reset.md",
     "Resets parts of the candidate profile to start over (asks before deleting anything). Use "
     "for \"reset my profile\", \"start my job search setup over\"."),
    ("job-application-assistant", ".claude/skills/job-application-assistant/SKILL.md",
     "Career advisor for the job search: judges job fit, edits CVs and cover letters, answers "
     "application-form questions and gives career advice using the saved profile. Use for job "
     "or career questions that no more specific job-search skill covers."),
]

EXTRA = {
    "dashboard": (
        "\n**Dashboard specifics.** For the interactive dashboard, run "
        "`python3 tools/generate_dashboard_data.py` in `<ws>`, then tell the user to open "
        "`index.html` in their job-search folder (double-click it; it runs offline in their "
        "browser). If they want a single shareable file instead, follow "
        "`<ws>/.claude/commands/html-report.md`. Both contain personal data - do not publish "
        "them anywhere unless the user explicitly asks.\n"),
    "autofill": (
        "\n**Browser.** Use the user-visible browser described in section 4 of "
        "`cowork/RUNTIME.md` instead of `tools/playwright-jobfill`. Never submit.\n"),
}

BOOTSTRAP = """\
## Step 0 - Open the job-search workspace

1. **Find it.** The workspace is a connected folder, or a subfolder of one, that contains
   `AGENTS.md` and `.claude/commands/apply.md`. In the device shell run
   `find "$HOME/mnt" -maxdepth 6 -path '*/.claude/commands/apply.md' -not -path '*/node_modules/*' 2>/dev/null`
   and strip the trailing `/.claude/commands/apply.md` from each hit. Call the result `<ws>`.
   - Several hits: ask the user which job-search folder to use.
   - No hit: {nohit}
2. **Load the Cowork rules.** Read `<ws>/cowork/RUNTIME.md` and follow it for the rest of the
   task. It maps the Claude Code instructions in the workspace onto Cowork tools.
3. **Load the profile.** Read `<ws>/CLAUDE.md`. If it still contains `[YOUR_NAME]`, the profile
   is not set up yet: unless this *is* the setup skill, offer to run setup first.
4. **Run the workflow.** Read `<ws>/{target}` and follow it exactly, step by step, treating the
   user's request (minus the trigger words) as `$ARGUMENTS`.
"""

NOHIT_DEFAULT = ("tell the user in plain words that their job-search folder is not connected, "
                 "and offer to set one up (the `setup` skill can create it).")
NOHIT_SETUP = "create the workspace as described in \"First-time setup\" below, then continue."

FIRST_TIME = """
## First-time setup (no workspace yet)

1. Ask where to keep the job search (AskUserQuestion). Offer the connected folder(s); if none is
   connected, ask for access to a folder such as `~/Documents` with
   `device_request_folder_access`, or ask the user to click **Add folder** in Cowork.
2. A clean copy of the workspace ships with this skill at `assets/workspace-template.zip`
   (relative to this skill's base directory). Unzip it into a **new** subfolder named
   `ai-job-search` (never over an existing folder; pick `ai-job-search-2` etc. if taken):
   - If the device shell can read the zip path, run
     `unzip -q "<zip>" -d "$HOME/mnt/<folder>/ai-job-search"` (no `unzip`? use
     `python3 -m zipfile -e "<zip>" "$HOME/mnt/<folder>/ai-job-search"`).
   - Otherwise copy the zip to `/mnt/user-data/outputs/`, write it into the chosen folder with
     `device_commit_files`, run the same `unzip` there in the device shell, and leave the zip in
     place (or remove it only if the user allows deletion).
3. Tell the user, in one sentence, that their job-search folder is ready and where it is. Then
   continue with Step 0.2 using the new folder as `<ws>`.
"""


def tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True,
                         capture_output=True).stdout.decode()
    return [p for p in out.split("\0") if p]


def keep(path: str) -> bool:
    if any(fnmatch.fnmatch(path, pat) for pat in EXCLUDE):
        return False
    for prefix, allowed in KEEP_UNDER.items():
        if path.startswith(prefix):
            return any(fnmatch.fnmatch(path, pat) for pat in allowed)
    return (ROOT / path).is_file()


def privacy_guard() -> list[str]:
    problems = []
    if "[YOUR_NAME]" not in (ROOT / "CLAUDE.md").read_text(encoding="utf-8"):
        problems.append("CLAUDE.md has no [YOUR_NAME] placeholder (looks personalized)")
    prof = ROOT / ".claude/skills/job-application-assistant/01-candidate-profile.md"
    if not re.search(r"\[[A-Z_]{4,}\]", prof.read_text(encoding="utf-8")):
        problems.append(f"{prof.relative_to(ROOT)} has no [PLACEHOLDER] tokens (looks personalized)")
    return problems


def workspace_zip(files: list[str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            info = zipfile.ZipInfo(path, date_time=(2026, 1, 1, 0, 0, 0))
            mode = (ROOT / path).stat().st_mode & 0o777
            info.external_attr = (0o100000 | mode) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, (ROOT / path).read_bytes())
    return buf.getvalue()


def skill_md(name: str, target: str, description: str) -> str:
    front = f"---\nname: {name}\ndescription: {json.dumps(description)}\n---\n\n"
    body = (f"# {name}\n\n"
            "Thin Cowork entry point for the AI Job Search workspace. The real instructions live "
            f"in the user's job-search folder at `{target}`; this skill only opens the folder and "
            "hands over to them.\n\n")
    body += BOOTSTRAP.format(nohit=NOHIT_SETUP if name == "setup" else NOHIT_DEFAULT,
                             target=target)
    body += EXTRA.get(name, "")
    if name == "setup":
        body += FIRST_TIME
    return front + body


def build(allow_personal: bool) -> int:
    problems = privacy_guard()
    if problems and not allow_personal:
        print("Refusing to build - the workspace template would carry personal data:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print("Build from a clean (un-personalized) branch, or pass --allow-personal.", file=sys.stderr)
        return 1

    missing = [t for _, t, _ in SKILLS if not (ROOT / t).is_file()]
    missing += [] if (ROOT / "cowork/RUNTIME.md").is_file() else ["cowork/RUNTIME.md"]
    if missing:
        print("Missing workflow files: " + ", ".join(missing), file=sys.stderr)
        return 1

    files = sorted(p for p in tracked_files() if keep(p))
    plugin_json = {
        "name": PLUGIN_NAME,
        "version": PLUGIN_VERSION,
        "description": "AI job search for Claude Cowork: profile setup, job scraping and ranking, "
                       "tailored CVs and cover letters, application autofill (never submits), "
                       "interview prep and an application tracker.",
        "author": {"name": "AI Job Search contributors"},
        "homepage": "https://github.com/MadsLorentzen/ai-job-search",
        "license": "MIT",
        "keywords": ["jobs", "career", "cv", "resume", "cover-letter", "interview"],
    }
    readme = (ROOT / "cowork" / "PLUGIN_README.md").read_text(encoding="utf-8")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        def add(path: str, data: bytes | str) -> None:
            info = zipfile.ZipInfo(path, date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)
        add(".claude-plugin/plugin.json", json.dumps(plugin_json, indent=2) + "\n")
        add("README.md", readme)
        for name, target, desc in SKILLS:
            add(f"skills/{name}/SKILL.md", skill_md(name, target, desc))
        add("skills/setup/assets/workspace-template.zip", workspace_zip(files))
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(SKILLS)} skills, "
          f"workspace template with {len(files)} files")
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--allow-personal", action="store_true",
                    help="build even if the profile looks personalized (private use only)")
    sys.exit(build(ap.parse_args().allow_personal))
