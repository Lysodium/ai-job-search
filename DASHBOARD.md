# Private Job Tracker Dashboard

A dependency-free dashboard for `job_search_tracker.csv`.

> **Cowork users:** just ask Claude to "show my job dashboard" — it regenerates the data and opens the page for you. See [COWORK.md](COWORK.md).

## Open locally

```bash
cd /path/to/ai-job-search
python3 -m http.server 8080
```

Open <http://localhost:8080>.

## What it does

- Shows pipeline totals, active applications, interviews, and average fit
- Filters and sorts applications
- Opens the stored CV, cover letter, and posting from each card
- Updates status, next action, dates, and notes by clicking a card
- Stores edits in browser `localStorage`; private notes are not sent anywhere
- Exports the current browser state as CSV

A static website cannot write directly to the repository. Use **Export CSV** to download the current state and replace `job_search_tracker.csv` when you want to keep browser changes.

## Refresh repository data

After editing `job_search_tracker.csv`, regenerate the dashboard seed:

```bash
python3 tools/generate_dashboard_data.py
```

Both `job_search_tracker.csv` and the generated `dashboard-data.js` hold personal data and are gitignored — never commit them. Without `dashboard-data.js` the dashboard simply starts empty.

## Privacy

The dashboard shows personal application data and links to application documents. That data stays in gitignored files on your machine; do not publish a GitHub Pages deployment that includes a generated `dashboard-data.js`.
