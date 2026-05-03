from __future__ import annotations

import argparse
import json
from pathlib import Path

try:
    from .publisher import DEFAULT_DB_PATH, fetch_premium_question_payload
except ImportError:
    from publisher import DEFAULT_DB_PATH, fetch_premium_question_payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export a premium question payload JSON for R2 upload.",
    )
    parser.add_argument("--set-id", required=True)
    parser.add_argument("--plan-code", default="grade3_premium")
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--output", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    payload = fetch_premium_question_payload(
        db_path=args.db_path,
        set_id=args.set_id,
        active_plan="premium",
        plan_code=args.plan_code,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Exported premium payload for {args.set_id} to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
