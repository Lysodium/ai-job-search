# Cowork Runtime Adapter

**Audience: Claude running in Claude Cowork.** (People: read [../COWORK.md](../COWORK.md) instead.)

The workflow files in this workspace (`.claude/commands/*.md`, `.claude/skills/**`) were written for Claude Code, where Claude runs *inside* the repository. In Cowork, Claude reaches this folder through a connected-folder bridge and has a different tool set. Apply the rules below for the whole task. They change **how** a step is carried out, never **what** the step requires: every gate, approval, verification checklist, privacy rule and "never submit" boundary in the workflow files still applies in full.

## 1. Where the workspace is

- The workspace is the connected folder (or subfolder of one) containing `AGENTS.md` and `.claude/commands/apply.md`. Call its root `<ws>`.
- In the device shell (`device_bash`) it is mounted at `$HOME/mnt/<folder>/...`. Each `device_bash` call is a fresh shell, so start every call with `cd "<ws>"` before using the relative paths the workflow files use (`cv/...`, `job_search_tracker.csv`, `tools/...`).
- The file tools that take device paths (`device_list_dir`, `device_stage_files`, `device_commit_files`) use the folder's real path on the user's computer, not the `$HOME/mnt` spelling.
- Work on files **in place** with the device shell: read with `cat`/`grep`, edit with a short `python3` read-modify-write or `sed -i`. Never retype a whole file from earlier tool output.
- If no folder is connected at all, the job-search skills cannot work: say so in plain words and offer the `setup` skill, which can create the workspace in a folder the user picks.

## 2. Translating Claude Code conventions

| In the workflow file | In Cowork |
|---|---|
| `$ARGUMENTS` | The user's request text, minus the trigger words (e.g. "apply to this: <url>" → `<url>`). Empty if they gave nothing. |
| "run `/apply`", "`/rank` first", any `/<command>` | The plugin skill of the same name. When telling the user, phrase it as something to say ("say *rank my jobs*") rather than a slash command. |
| `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash` on repo paths | `device_bash` in `<ws>` (see section 1). |
| `Agent` / "spawn a reviewer agent" / parallel agents | The `Agent` tool. Pass any draft content inline in the prompt, as the workflow already requires; the sub-agent does not share your connected-folder context unless you tell it the paths. |
| `AskUserQuestion`, `WebSearch`, `WebFetch` | Same tools. Load deferred ones with `ToolSearch` first. |
| `.claude/settings.json` permission list | Not enforced by Cowork. Treat it as policy anyway: only run the shipped portal CLIs, `salary_lookup.py`, `tools/verify_pdf.py`, `pdftotext` and the LaTeX compilers against workspace files. |
| `.mcp.json`, `claude mcp add`, `/mcp`, `/mcp-auth` | Ignore. Use the user's Cowork **connectors** instead (section 5). |
| `gemini-research-expert` agent / `gemini -p` | Not available. Use `WebSearch` + `WebFetch` directly. |
| "schedule", `/loop`, cron | Cowork scheduled tasks (`create_trigger`), only when the user asks for a recurring run. |
| `rm` / deleting files (e.g. `/reset`) | Deleting is off by default in connected folders. After the user confirms per the workflow, call `device_request_delete_permission` once for the connected folder root. If declined, move the files into `<ws>/_to_delete/` and tell the user. |
| `git commit` / `git push` | Optional. Never commit personal files (CVs, cover letters, tracker, profile, `documents/**`); the `.gitignore` already blocks them. Do not push unless the user asks. |

## 3. Tools the workflows need

Check with `which` in the device shell before the step that needs it. Install there first; fall back as listed.

- **Python 3** - `python3` (use it wherever a file says `python`). `pypdf` helps PDF checks: `python3 -m pip install --user pypdf` (falls back to `pdftotext`).
- **bun** (portal search CLIs in `.agents/skills/*/cli`, zero runtime deps): if `which bun` fails, try `npm install -g bun`, then `curl -fsSL https://bun.sh/install | bash` and use `$HOME/.bun/bin/bun`. If both fail, the scraper's documented WebSearch fallback applies - say so in the run summary.
- **LaTeX** - `lualatex` (CV) and `xelatex` (cover letter). If missing on the device and a cloud workspace (`Bash`) is available: stage the `.tex` file plus `cv/` or `cover_letters/` support files (`cover.cls`, `OpenFonts/**`) with `device_stage_files`, install TeX Live there (`apt-get install -y texlive-luatex texlive-xetex texlive-latex-extra texlive-fonts-extra`), compile, then write the PDF back next to its `.tex` with `device_commit_files`. If neither works, stop at the `.tex` stage and tell the user plainly that PDFs could not be built on this computer.
- **Looking at a PDF** (mandatory in `/apply` Step 5): use `Read` on the PDF. If `Read` cannot reach the connected folder (cloud sessions), stage that one PDF with `device_stage_files` and `Read` the staged copy.

## 4. Browser work (`/autofill`)

Playwright CLI (`tools/playwright-jobfill`) drives a browser inside the device shell's sandbox, which the user cannot see. In Cowork, replace it with the user-visible browser:

- Prefer **Claude in Chrome** (`mcp__claude-in-chrome__*`, load with one `ToolSearch`) so the user's existing logins work; otherwise the Cowork **built-in browser** (`mcp__remote-devices__Claude_Browser__*`).
- Map the wrapper commands: `open`/`goto` → navigate (new tab), `snapshot`/`find` → read_page / find, `fill`/`select`/`check` → form_input or computer clicks, `upload` → the browser's file-upload tool with the PDF path from the tracker row. If uploading is not possible, leave the field for the user and name the exact file in their folder to choose.
- The hard boundary is unchanged: **never click Submit / Apply / Send / Confirm or any irreversible final control**, never solve CAPTCHA/MFA/verification, never enter passwords, IDs, financial or demographic answers. Stop on the review screen and hand over.

## 5. Connectors (Gmail, Notion)

- `/gmail-sync`: find Gmail tools with `ToolSearch` (query `gmail`); the workflow's `mcp__claude_ai_Gmail__*` names may differ in Cowork - use whatever Gmail connector tools exist. If none, search the connector registry and suggest the Gmail connector, then stop as the workflow says.
- `/notion-sync`: same with `ToolSearch` query `notion`. Replace the workflow's `claude mcp add ...` instructions with "connect Notion in Cowork's connectors" - never start an OAuth flow yourself.

## 6. Talking to the user

Cowork users are often non-technical. Keep the workflow's substance, but:

- Say "your job-search folder", "your CV file `cv/acme/main_acme_ml_engineer.pdf`" - not `$HOME/mnt/...` paths or tool names.
- Turn slash-command hints into plain phrases ("say *prepare me for my interview at Acme*").
- When a file is produced in the folder, it is already saved on their computer: tell them the folder and file name. Offer to show a PDF or the dashboard when useful.
- Ask only the questions the workflow asks, with `AskUserQuestion` where it fits.
