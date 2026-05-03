from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

try:
    from .publisher import DEFAULT_DB_PATH, PREMIUM_PLAN_REGISTRY_PATH, ensure_schema
except ImportError:
    from publisher import DEFAULT_DB_PATH, PREMIUM_PLAN_REGISTRY_PATH, ensure_schema


def _normalize_required_plan(required_plan: str | None) -> str:
    return "premium" if required_plan in {"standard", "premium"} else "free"


def connect(db_path: Path) -> sqlite3.Connection:
    ensure_schema(db_path)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def load_summary(connection: sqlite3.Connection) -> dict:
    question_sets = connection.execute("SELECT COUNT(*) FROM question_sets").fetchone()[0]
    published_questions = connection.execute("SELECT COUNT(*) FROM published_questions").fetchone()[0]
    publish_batches = connection.execute("SELECT COUNT(*) FROM publish_batches").fetchone()[0]
    public_sets = connection.execute(
        "SELECT COUNT(*) FROM question_sets WHERE visibility = 'public' AND is_active = 1"
    ).fetchone()[0]
    public_free_sets = connection.execute(
        """
        SELECT COUNT(*) FROM question_sets
        WHERE visibility = 'public' AND is_active = 1
          AND (required_plan = 'free' OR required_plan IS NULL OR required_plan = '')
        """
    ).fetchone()[0]
    public_premium_sets = connection.execute(
        """
        SELECT COUNT(*) FROM question_sets
        WHERE visibility = 'public' AND is_active = 1
          AND required_plan IN ('premium', 'standard')
        """
    ).fetchone()[0]
    private_sets = connection.execute(
        "SELECT COUNT(*) FROM question_sets WHERE visibility = 'private' AND is_active = 1"
    ).fetchone()[0]
    inactive_sets = connection.execute(
        "SELECT COUNT(*) FROM question_sets WHERE is_active = 0"
    ).fetchone()[0]
    users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    paid_orders = connection.execute(
        "SELECT COUNT(*) FROM orders WHERE order_status = 'paid'"
    ).fetchone()[0]
    pending_orders = connection.execute(
        "SELECT COUNT(*) FROM orders WHERE order_status = 'pending'"
    ).fetchone()[0]
    active_entitlements = connection.execute(
        "SELECT COUNT(*) FROM entitlements WHERE status = 'active'"
    ).fetchone()[0]
    contact_messages = connection.execute("SELECT COUNT(*) FROM contact_messages").fetchone()[0]
    new_contact_messages = connection.execute(
        "SELECT COUNT(*) FROM contact_messages WHERE status = 'new'"
    ).fetchone()[0]
    return {
        "question_sets": question_sets,
        "published_questions": published_questions,
        "publish_batches": publish_batches,
        "public_sets": public_sets,
        "public_free_sets": public_free_sets,
        "public_premium_sets": public_premium_sets,
        "private_sets": private_sets,
        "inactive_sets": inactive_sets,
        "users": users,
        "paid_orders": paid_orders,
        "pending_orders": pending_orders,
        "active_entitlements": active_entitlements,
        "contact_messages": contact_messages,
        "new_contact_messages": new_contact_messages,
    }


def load_sets(connection: sqlite3.Connection) -> list[dict]:
    rows = connection.execute(
        """
        SELECT
          qs.set_id,
          qs.label,
          qs.short_description,
          qs.audience_tag,
          qs.level,
          qs.visibility,
          qs.required_plan,
          qs.is_active,
          qs.source_dataset_key,
          qs.published_at,
          qs.updated_at,
          COUNT(qsi.question_id) AS question_count
        FROM question_sets qs
        LEFT JOIN question_set_items qsi ON qsi.set_id = qs.set_id
        GROUP BY
          qs.set_id,
          qs.label,
          qs.short_description,
          qs.audience_tag,
          qs.level,
          qs.visibility,
          qs.required_plan,
          qs.is_active,
          qs.source_dataset_key,
          qs.published_at,
          qs.updated_at
        ORDER BY qs.updated_at DESC, qs.set_id
        """
    ).fetchall()
    items = [dict(row) for row in rows]
    for item in items:
        item["required_plan"] = _normalize_required_plan(item.get("required_plan"))
    return items


def load_batches(connection: sqlite3.Connection, limit: int) -> list[dict]:
    rows = connection.execute(
        """
        SELECT
          publish_id,
          dataset_key,
          set_id,
          published_by,
          question_count,
          published_at,
          notes
        FROM publish_batches
        ORDER BY published_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def load_license_snapshot(connection: sqlite3.Connection, limit: int) -> dict:
    users = [
        dict(row)
        for row in connection.execute(
            """
            SELECT auth_user_id, display_name, status, last_login_at
            FROM users
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    ]
    orders = [
        dict(row)
        for row in connection.execute(
            """
            SELECT user_id, product_code, order_status, purchased_at, updated_at
            FROM orders
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    ]
    entitlements = [
        dict(row)
        for row in connection.execute(
            """
            SELECT user_id, plan_code, product_code, scope_type, scope_id, status, granted_at
            FROM entitlements
            ORDER BY updated_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    ]
    return {
        "users": users,
        "orders": orders,
        "entitlements": entitlements,
    }


def load_contact_messages(connection: sqlite3.Connection, limit: int) -> list[dict]:
    rows = connection.execute(
        """
        SELECT
          id,
          name,
          reply_email,
          message,
          status,
          source_page,
          user_agent,
          created_at,
          updated_at
        FROM contact_messages
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def load_contact_message_detail(connection: sqlite3.Connection, message_id: str) -> dict:
    row = connection.execute(
        """
        SELECT
          id,
          name,
          reply_email,
          message,
          status,
          source_page,
          user_agent,
          created_at,
          updated_at
        FROM contact_messages
        WHERE id = ?
        """,
        (message_id,),
    ).fetchone()
    if row is None:
        raise SystemExit(f"Contact message not found: {message_id}")
    return dict(row)


def load_set_detail(connection: sqlite3.Connection, set_id: str) -> dict:
    set_row = connection.execute(
        """
        SELECT
          set_id,
          label,
          short_description,
          audience_tag,
          level,
          visibility,
          required_plan,
          is_active,
          source_dataset_key,
          published_at,
          updated_at
        FROM question_sets
        WHERE set_id = ?
        """,
        (set_id,),
    ).fetchone()
    if set_row is None:
        raise SystemExit(f"Set not found: {set_id}")

    question_rows = connection.execute(
        """
        SELECT
          qsi.sort_order,
          pq.question_id,
          pq.category,
          pq.subtopic,
          pq.prompt,
          pq.options_json,
          pq.answer_index,
          pq.explanation,
          pq.option_explanations_json,
          pq.memory_tip,
          pq.required_plan,
          pq.status,
          pq.approved_by,
          pq.approved_on,
          pq.published_at,
          substr(pq.prompt, 1, 60) AS prompt_preview
        FROM question_set_items qsi
        JOIN published_questions pq ON pq.question_id = qsi.question_id
        WHERE qsi.set_id = ?
        ORDER BY qsi.sort_order ASC
        """,
        (set_id,),
    ).fetchall()

    set_item = dict(set_row)
    set_item["required_plan"] = _normalize_required_plan(set_item.get("required_plan"))
    question_items = [dict(row) for row in question_rows]
    for item in question_items:
        item["required_plan"] = _normalize_required_plan(item.get("required_plan"))
        item["options"] = json.loads(item["options_json"])
        item["option_explanations"] = json.loads(item["option_explanations_json"])
    return {
        "set": set_item,
        "questions": question_items,
    }


def update_set_settings(
    connection: sqlite3.Connection,
    *,
    set_id: str,
    label: str,
    short_description: str,
    audience_tag: str,
    visibility: str,
    required_plan: str,
    is_active: bool,
) -> None:
    connection.execute(
        """
        UPDATE question_sets
        SET
          label = ?,
          short_description = ?,
          audience_tag = ?,
          visibility = ?,
          required_plan = ?,
          is_active = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE set_id = ?
        """,
        (
            label,
            short_description,
            audience_tag,
            visibility,
            _normalize_required_plan(required_plan),
            1 if is_active else 0,
            set_id,
        ),
    )


def delete_set(connection: sqlite3.Connection, set_id: str) -> dict:
    question_ids = [
        row[0]
        for row in connection.execute(
            "SELECT question_id FROM question_set_items WHERE set_id = ?",
            (set_id,),
        ).fetchall()
    ]
    publish_batch_count = connection.execute(
        "SELECT COUNT(*) FROM publish_batches WHERE set_id = ?",
        (set_id,),
    ).fetchone()[0]

    connection.execute("DELETE FROM question_set_items WHERE set_id = ?", (set_id,))
    connection.execute("DELETE FROM publish_batches WHERE set_id = ?", (set_id,))
    connection.execute("DELETE FROM question_sets WHERE set_id = ?", (set_id,))

    orphan_deleted = 0
    for question_id in question_ids:
        still_used = connection.execute(
            "SELECT 1 FROM question_set_items WHERE question_id = ? LIMIT 1",
            (question_id,),
        ).fetchone()
        if still_used is None:
            connection.execute(
                "DELETE FROM published_questions WHERE question_id = ?",
                (question_id,),
            )
            orphan_deleted += 1

    return {
        "question_links_deleted": len(question_ids),
        "publish_batches_deleted": publish_batch_count,
        "orphan_questions_deleted": orphan_deleted,
    }


def load_premium_plan_registry(registry_path: Path = PREMIUM_PLAN_REGISTRY_PATH) -> dict:
    if not registry_path.exists():
        return {"plans": {}}
    try:
        return json.loads(registry_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"plans": {}}


def save_premium_plan_registry(registry: dict, registry_path: Path = PREMIUM_PLAN_REGISTRY_PATH) -> None:
    registry_path.write_text(
        json.dumps(registry, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def get_premium_plan_membership(
    set_id: str,
    *,
    plan_code: str = "grade3_premium",
    registry_path: Path = PREMIUM_PLAN_REGISTRY_PATH,
) -> dict:
    registry = load_premium_plan_registry(registry_path)
    plan = registry.get("plans", {}).get(plan_code, {})
    question_sets = plan.get("question_sets", [])
    if not isinstance(question_sets, list):
        question_sets = []
    for item in question_sets:
        if isinstance(item, dict) and item.get("set_id") == set_id:
            return {
                "included": True,
                "delivery_mode": item.get("delivery_mode", "append_non_duplicate"),
                "plan_code": plan_code,
            }
    return {
        "included": False,
        "delivery_mode": "append_non_duplicate",
        "plan_code": plan_code,
    }


def update_premium_plan_membership(
    set_id: str,
    *,
    include: bool,
    delivery_mode: str = "append_non_duplicate",
    plan_code: str = "grade3_premium",
    registry_path: Path = PREMIUM_PLAN_REGISTRY_PATH,
) -> dict:
    registry = load_premium_plan_registry(registry_path)
    plans = registry.setdefault("plans", {})
    plan = plans.setdefault(plan_code, {})
    question_sets = plan.get("question_sets", [])
    if not isinstance(question_sets, list):
        question_sets = []

    filtered = []
    for item in question_sets:
        if not isinstance(item, dict):
            continue
        if item.get("set_id") == set_id:
            continue
        filtered.append(item)

    if include:
        filtered.append(
            {
                "set_id": set_id,
                "delivery_mode": delivery_mode or "append_non_duplicate",
            }
        )

    plan["question_sets"] = filtered
    save_premium_plan_registry(registry, registry_path)
    return get_premium_plan_membership(
        set_id,
        plan_code=plan_code,
        registry_path=registry_path,
    )


def print_text_summary(summary: dict, sets: list[dict], batches: list[dict], license_snapshot: dict) -> None:
    print("== Summary ==")
    print(f"question_sets      : {summary['question_sets']}")
    print(f"published_questions: {summary['published_questions']}")
    print(f"publish_batches    : {summary['publish_batches']}")
    print(f"public_sets        : {summary['public_sets']}")
    print(f"public_free_sets   : {summary['public_free_sets']}")
    print(f"public_premium_sets: {summary['public_premium_sets']}")
    print(f"private_sets       : {summary['private_sets']}")
    print(f"inactive_sets      : {summary['inactive_sets']}")
    print(f"users              : {summary['users']}")
    print(f"paid_orders        : {summary['paid_orders']}")
    print(f"pending_orders     : {summary['pending_orders']}")
    print(f"active_entitlements: {summary['active_entitlements']}")
    print()

    print("== Question Sets ==")
    if not sets:
        print("(none)")
    for item in sets:
        print(
            f"- {item['set_id']} | {item['label']} | {item['audience_tag']} | "
            f"{item['visibility']} | {item['required_plan']} | {item['question_count']}問"
        )
        if item["short_description"]:
            print(f"  {item['short_description']}")
    print()

    print("== Recent Publish Batches ==")
    if not batches:
        print("(none)")
    for batch in batches:
        print(
            f"- {batch['published_at']} | {batch['dataset_key']} -> {batch['set_id']} | "
            f"{batch['question_count']}問 | by {batch['published_by']}"
        )
        if batch["notes"]:
            print(f"  {batch['notes']}")
    print()

    print("== License Snapshot ==")
    if not license_snapshot["users"]:
        print("(none)")
        return
    print("Users:")
    for item in license_snapshot["users"]:
        print(f"- {item['auth_user_id']} | {item['display_name']} | {item['status']}")
    print("Orders:")
    for item in license_snapshot["orders"]:
        print(f"- {item['user_id']} | {item['product_code']} | {item['order_status']} | {item['updated_at']}")
    print("Entitlements:")
    for item in license_snapshot["entitlements"]:
        print(f"- {item['user_id']} | {item['plan_code']} | {item['scope_id']} | {item['status']}")


def print_text_set_detail(detail: dict) -> None:
    set_info = detail["set"]
    print("== Set ==")
    print(f"set_id          : {set_info['set_id']}")
    print(f"label           : {set_info['label']}")
    print(f"audience_tag    : {set_info['audience_tag']}")
    print(f"description     : {set_info['short_description']}")
    print(f"level           : {set_info['level']}")
    print(f"visibility      : {set_info['visibility']}")
    print(f"required_plan   : {set_info['required_plan']}")
    print(f"source_dataset  : {set_info['source_dataset_key']}")
    print(f"published_at    : {set_info['published_at']}")
    print()

    print("== Questions ==")
    if not detail["questions"]:
        print("(none)")
    for item in detail["questions"]:
        print(
            f"{item['sort_order']:>3}. {item['question_id']} | {item['category']} / {item['subtopic']} | "
            f"{item['status']} | {item['prompt_preview']}"
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect the local content.db for debugging.")
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--json", action="store_true", dest="as_json")
    parser.add_argument("--set-id", help="Show only one question set and its questions.")
    parser.add_argument("--batch-limit", type=int, default=10)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    db_path = args.db_path.resolve()
    with connect(db_path) as connection:
        if args.set_id:
            detail = load_set_detail(connection, args.set_id)
            if args.as_json:
                print(json.dumps(detail, ensure_ascii=False, indent=2))
            else:
                print_text_set_detail(detail)
            return 0

        summary = load_summary(connection)
        sets = load_sets(connection)
        batches = load_batches(connection, args.batch_limit)
        license_snapshot = load_license_snapshot(connection, args.batch_limit)
        if args.as_json:
            print(
                json.dumps(
                    {
                        "summary": summary,
                        "question_sets": sets,
                        "recent_batches": batches,
                        "license_snapshot": license_snapshot,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
        else:
            print_text_summary(summary, sets, batches, license_snapshot)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
