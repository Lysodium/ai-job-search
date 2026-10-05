---
name: application-autofill
version: 1.0.0
description: >
  Automates job application forms with Playwright CLI through the final review
  screen, but never submits. Use when the user asks to apply, autofill an
  application, upload a resume, fill an ATS form, or prepare an application for
  review on Greenhouse, Lever, Ashby, Workday, or another careers site.
---

# Application Autofill

Use the canonical workflow in `.claude/commands/autofill.md`. It is shared by Claude and Pi.

## Browser interface

Run all browser actions through:

```bash
bash tools/playwright-jobfill <command> [arguments]
```

This wrapper uses the named `job-application` session, a dedicated persistent profile under `~/.pi/browser-profiles/job-applications`, headed Chromium, and file-backed browser output.

## Hard boundary

Never click a button whose accessible name or effect is Submit, Submit application, Apply, Send application, Confirm application, or another irreversible final action. Stop on the final review screen and ask the user to inspect and submit manually.
