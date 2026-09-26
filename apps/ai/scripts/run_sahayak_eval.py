"""Runs the Sahayak evaluation set (docs/06 task 4G.7) against the configured LLM.

Usage (from apps/ai, with the same env as the service: LLM_PROVIDER, LLM_API_KEY,
MONGODB_URI_READONLY):

    python scripts/run_sahayak_eval.py                 # writes eval/report-<date>.md and .csv
    LLM_PROVIDER=fake python scripts/run_sahayak_eval.py --out /tmp   # dry run, no key needed

Automatic checks: the reply intent is one of the expected ones, at least one expected scheme card
is shown (only when that scheme is published), and no forbidden text appears. The CSV has an
empty `human_ok` column: a teammate reads every answer and marks it (docs/02 §13 "team review").
Emergency detection before the LLM is tested separately in the API unit tests
(apps/api/test/unit/sahayak.test.js), where it must be 100%.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DJANGO_DEBUG", "true")

import django  # noqa: E402

django.setup()

from core.sahayak import service  # noqa: E402
from core.sahayak.llm import LLMUnavailable  # noqa: E402
from core.sahayak.schemes import get_scheme_source  # noqa: E402

CONTEXT = {"village": "महोदिया", "gp": "महोदिया", "block": "सीहोर", "district": "सीहोर"}
CONTEXT_EN = {"village": "Mahodiya", "gp": "Mahodiya", "block": "Sehore", "district": "Sehore"}


def run(items, published):
    by_slug = {s.get("slug"): s for s in published}
    rows = []
    for item in items:
        exp = item["expect"]
        payload = {
            "language": item["language"],
            "mode": item["mode"],
            "history": item.get("history", [])[-10:],
            "message": item["message"],
            "letterType": item.get("letterType"),
            "userContext": CONTEXT if item["language"] == "hi" else CONTEXT_EN,
        }
        if item.get("schemeSlug") in by_slug:
            payload["schemeIds"] = [str(by_slug[item["schemeSlug"]]["_id"])]
        try:
            out = service.reply(payload)
        except LLMUnavailable as err:
            out = {"intent": "ERROR", "text": str(err), "cards": []}
        llm = out.get("llm", {})
        checks = [out["intent"] in exp["intent"]]
        wanted = [s for s in exp.get("cards", []) if s in by_slug]
        if wanted and out["intent"] == "answer":
            checks.append(any(c in wanted for c in out.get("cards", [])))
        text = out.get("text", "") + json.dumps(out.get("letter") or {}, ensure_ascii=False)
        checks.append(not any(bad in text for bad in exp.get("mustNotContain", [])))
        rows.append(
            {
                "id": item["id"],
                "category": item["category"],
                "message": item["message"],
                "expected": "/".join(exp["intent"]),
                "intent": out["intent"],
                "cards": " ".join(out.get("cards", [])),
                "auto_pass": all(checks),
                "text": out.get("text", "").replace("\n", " "),
                "letter_subject": (out.get("letter") or {}).get("subject", ""),
                "tokens": f"{llm.get('tokensIn')}/{llm.get('tokensOut')}",
                "latency_ms": llm.get("latencyMs", ""),
                "note": item.get("note", ""),
                "human_ok": "",
            }
        )
        print(f"{item['id']}: {'PASS' if rows[-1]['auto_pass'] else 'FAIL'} ({out['intent']})")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", default=str(BASE / "eval" / "sahayak_eval_set.json"))
    parser.add_argument("--out", default=str(BASE / "eval"))
    args = parser.parse_args()

    items = json.loads(Path(args.set).read_text(encoding="utf-8"))["items"]
    published = get_scheme_source().published()
    rows = run(items, published)

    stamp = dt.date.today().isoformat()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with (out / f"report-{stamp}.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    def rate(cat=None):
        sel = [r for r in rows if cat is None or r["category"] == cat]
        return f"{sum(r['auto_pass'] for r in sel)}/{len(sel)}"

    lines = [
        f"# Sahayak evaluation — {stamp}",
        "",
        f"Provider: {os.environ.get('LLM_PROVIDER', 'gemini')} · model: "
        f"{os.environ.get('LLM_MODEL') or 'default'} · published schemes: {len(published)}",
        "",
        "| Category | Automatic checks passed |",
        "|---|---|",
        f"| Scheme questions | {rate('scheme')} |",
        f"| Letters | {rate('letter')} |",
        f"| Tricky / out of scope / emergency | {rate('tricky')} |",
        f"| **All** | **{rate()}** |",
        "",
        "Target: ≥ 90% acceptable after human review (fill `human_ok` in the CSV), 100% on",
        "emergency detection.",
    ]
    (out / f"report-{stamp}.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nwrote {out / f'report-{stamp}.md'} and .csv — automatic: {rate()}")


if __name__ == "__main__":
    main()
