from __future__ import annotations

import hashlib
import json
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from publisher import DEFAULT_DB_PATH, SHARED_DIR


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _content_hash(question: dict) -> str:
    public_payload = {
        "id": question["id"],
        "level": question["level"],
        "category": question["category"],
        "subtopic": question["subtopic"],
        "question": question["question"],
        "choices": question["choices"],
        "correct_index": question["correct_index"],
        "answer_reason": question["answer_reason"],
        "wrong_reasons": question["wrong_reasons"],
        "memory_tip": question["memory_tip"],
    }
    normalized = json.dumps(
        public_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def load_question_map() -> dict[str, dict]:
    question_map: dict[str, dict] = {}
    for path in SHARED_DIR.glob("*_question_packets_enriched.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(payload, list):
            continue
        for question in payload:
            question_id = question.get("id")
            if question_id:
                question_map[question_id] = question
    return question_map


def backup_db(db_path: Path) -> Path:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.with_name(f"{db_path.stem}_before_wording_refresh_{timestamp}{db_path.suffix}")
    shutil.copy2(db_path, backup_path)
    return backup_path


def refresh_published_wording(db_path: Path = DEFAULT_DB_PATH) -> tuple[int, int, Path]:
    db_path = db_path.resolve()
    backup_path = backup_db(db_path)
    question_map = load_question_map()
    updated_at = _utc_now_iso()

    with sqlite3.connect(db_path) as connection:
        rows = connection.execute(
            "SELECT question_id FROM published_questions ORDER BY question_id"
        ).fetchall()
        updated = 0
        missing = 0
        for (question_id,) in rows:
            question = question_map.get(question_id)
            if not question:
                missing += 1
                continue
            connection.execute(
                """
                UPDATE published_questions
                SET
                  level = ?,
                  category = ?,
                  subtopic = ?,
                  prompt = ?,
                  options_json = ?,
                  answer_index = ?,
                  explanation = ?,
                  option_explanations_json = ?,
                  memory_tip = ?,
                  content_hash = ?,
                  updated_at = ?
                WHERE question_id = ?
                """,
                (
                    question["level"],
                    question["category"],
                    question["subtopic"],
                    question["question"],
                    json.dumps(question["choices"], ensure_ascii=False),
                    question["correct_index"],
                    question["answer_reason"],
                    json.dumps(question["wrong_reasons"], ensure_ascii=False),
                    question["memory_tip"],
                    _content_hash(question),
                    updated_at,
                    question_id,
                ),
            )
            updated += 1
        connection.commit()
    return updated, missing, backup_path


if __name__ == "__main__":
    updated, missing, backup_path = refresh_published_wording()
    print(
        json.dumps(
            {
                "updated_questions": updated,
                "missing_questions": missing,
                "backup_path": str(backup_path),
            },
            ensure_ascii=False,
        )
    )
