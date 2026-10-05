# Application Autofill with Playwright

## Decision: Playwright CLI

This workspace uses **Playwright CLI + an Agent Skill**, not Playwright MCP, for application filling.

Microsoft's current guidance recommends the CLI for coding agents because its compact commands avoid loading large MCP tool schemas and verbose accessibility snapshots into the model context. That matches this workflow: job applications involve many repetitive `fill`, `select`, `check`, and `upload` actions, while snapshots can be written to files and inspected selectively.

Playwright MCP remains useful for exploratory, long-running browser reasoning where persistent rich introspection matters more than context cost. It adds little here because Playwright CLI already supports named sessions, persistent profiles, uploads, snapshots, screenshots, and existing-browser attachment.

Sources:

- https://github.com/microsoft/playwright-cli
- https://github.com/microsoft/playwright-mcp

## Installed components

- Global package: `@playwright/cli`
- Browser: Playwright-managed Chromium
- Project configuration: `.playwright/cli.config.json`
- Wrapper: `tools/playwright-jobfill`
- Skill: `.agents/skills/application-autofill/SKILL.md`
- Workflows: `.claude/commands/autofill.md` and `.pi/prompts/autofill.md`

## Usage

From the repository, ask Pi or Claude:

```text
/autofill Anthropic
```

Or use the browser wrapper directly:

```bash
bash tools/playwright-jobfill open 'https://company.example/apply'
bash tools/playwright-jobfill snapshot --filename=/tmp/ai-job-search-playwright/application.md --depth=8
bash tools/playwright-jobfill close
```

The dedicated profile is stored at:

```text
~/.pi/browser-profiles/job-applications
```

Logins may persist there. It is outside the repository and must never be committed.

## Safety boundary

Automation stops before the irreversible submission control. It never:

- clicks Submit, Submit application, Send application, or equivalent
- bypasses CAPTCHA, MFA, email verification, or anti-bot controls
- infers demographic, legal, salary, conflict-of-interest, or consent answers
- enters passwords, SSNs, government IDs, financial details, or secrets
- marks a tracker row `applied` before the user confirms submission

The final action is always a visible-browser handoff for human review and submission.
