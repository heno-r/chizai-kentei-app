from __future__ import annotations

import argparse
from pathlib import Path

try:
    from .publisher import DEFAULT_DB_PATH, list_dataset_keys, publish_dataset
except ImportError:
    from publisher import DEFAULT_DB_PATH, list_dataset_keys, publish_dataset


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Publish approved questions into SQLite.")
    parser.add_argument("--dataset-key", required=True, choices=list_dataset_keys())
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--published-by", default="local-dev")
    parser.add_argument("--notes", default="")
    parser.add_argument("--set-id")
    parser.add_argument("--set-label")
    parser.add_argument("--short-description")
    parser.add_argument("--audience-tag")
    parser.add_argument("--visibility", choices=("public", "private"), default=None)
    parser.add_argument("--required-plan", choices=("free", "premium"), default=None)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    result = publish_dataset(
        dataset_key=args.dataset_key,
        db_path=args.db_path,
        published_by=args.published_by,
        notes=args.notes,
        set_id=args.set_id,
        set_label=args.set_label,
        short_description=args.short_description,
        audience_tag=args.audience_tag,
        visibility=args.visibility,
        required_plan=args.required_plan,
    )
    print(
        f"Published {result.question_count} questions "
        f"from {result.dataset_key} to {result.db_path} "
        f"(set_id={result.set_id}, publish_id={result.publish_id})."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
