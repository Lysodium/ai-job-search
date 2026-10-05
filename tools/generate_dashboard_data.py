#!/usr/bin/env python3
"""Generate the static dashboard data file from job_search_tracker.csv."""

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRACKER = ROOT / "job_search_tracker.csv"
OUTPUT = ROOT / "dashboard-data.js"


def slug(value: str) -> str:
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def main() -> None:
    with TRACKER.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    jobs = []
    for index, row in enumerate(rows):
        company = row.get("company", "").strip()
        role = row.get("role", "").strip()
        jobs.append(
            {
                "id": f"{slug(company)}-{slug(role)}-{index + 1}",
                "date": row.get("date", ""),
                "company": company,
                "sector": row.get("sector", ""),
                "role": role,
                "roleType": row.get("role_type", ""),
                "channel": row.get("channel", ""),
                "status": row.get("status", "drafted").replace(" ", "_"),
                "contact": row.get("contact_person", ""),
                "fit": float(row["fit_rating"]) if row.get("fit_rating") else None,
                "notes": row.get("notes", ""),
                "cv": row.get("cv_file", ""),
                "coverLetter": row.get("cover_letter_file", ""),
                "source": row.get("source", ""),
                "deadline": row.get("deadline", ""),
                "nextDate": "",
                "nextAction": "",
                "updatedAt": row.get("date", ""),
            }
        )

    payload = json.dumps(jobs, ensure_ascii=False, indent=2)
    OUTPUT.write_text(
        "// Generated from job_search_tracker.csv by tools/generate_dashboard_data.py\n"
        f"window.JOB_TRACKER_DATA = {payload};\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(jobs)} jobs to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
