from __future__ import annotations

import hashlib
import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
SHARED_DIR = PROJECT_ROOT / "shared_content"
DEFAULT_DB_PATH = BASE_DIR / "data" / "content.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"
PREMIUM_PLAN_REGISTRY_PATH = BASE_DIR / "premium_plan_registry.json"
LOCAL_FREE_AUTH_USER_ID = "local-free-user"
LOCAL_PREMIUM_AUTH_USER_ID = "local-premium-user"
LOCAL_PREMIUM_PRODUCT_CODE = "grade3_premium"
DEFAULT_PREMIUM_UNLOCKED_FEATURES = [
    "category_mode",
    "retry_wrong",
    "weak_category_analysis",
    "flagged_queue",
    "today_recommendation",
    "final14_mode",
    "study_plan",
    "detailed_history",
]


@dataclass(frozen=True)
class DatasetSpec:
    key: str
    questions_path: Path
    set_id: str
    label: str
    short_description: str
    audience_tag: str
    level: str
    visibility: str
    required_plan: str


@dataclass(frozen=True)
class PublishResult:
    dataset_key: str
    set_id: str
    question_count: int
    publish_id: str
    db_path: Path
    published_at: str


MANUAL_DATASET_SPECS: dict[str, DatasetSpec] = {
    "first_release_5": DatasetSpec(
        key="first_release_5",
        questions_path=SHARED_DIR / "first_release_question_packets_enriched.json",
        set_id="first_release_5",
        label="3級無料スターター5問",
        short_description="3級の基本論点を短時間で確認する無料スターター5問セット。",
        audience_tag="無料体験",
        level="3級",
        visibility="public",
        required_plan="free",
    ),
    "grade3_mixed_priority_50": DatasetSpec(
        key="grade3_mixed_priority_50",
        questions_path=SHARED_DIR / "grade3_mixed_priority_50_question_packets_enriched.json",
        set_id="grade3_mixed_priority_50",
        label="3級無料公開50問",
        short_description="3級の主要論点を広く確認できる無料公開50問セット。",
        audience_tag="無料公開",
        level="3級",
        visibility="public",
        required_plan="free",
    ),
    "grade3_premium_combined_160": DatasetSpec(
        key="grade3_premium_combined_160",
        questions_path=SHARED_DIR / "grade3_premium_combined_160_question_packets_enriched.json",
        set_id="grade3_premium_combined_160",
        label="3級プレミアム統合160問",
        short_description="3級の標準問題と誤答選択問題をまとめたプレミアム版向け160問セット。",
        audience_tag="プレミアム公開",
        level="3級",
        visibility="public",
        required_plan="premium",
    ),
    "grade3_premium_unapproved_94": DatasetSpec(
        key="grade3_premium_unapproved_94",
        questions_path=SHARED_DIR / "grade3_premium_unapproved_94_question_packets_enriched.json",
        set_id="grade3_premium_unapproved_94",
        label="3級プレミアム候補94問",
        short_description="承認済みを除いた3級の標準問題と誤答選択問題をまとめたレビュー用セット。",
        audience_tag="プレミアム候補",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
    "grade3_premium_unapproved_150": DatasetSpec(
        key="grade3_premium_unapproved_150",
        questions_path=SHARED_DIR / "grade3_premium_unapproved_150_question_packets_enriched.json",
        set_id="grade3_premium_unapproved_150",
        label="3級プレミアム候補150問",
        short_description="未承認の3級標準問題と誤答選択問題をまとめたプレミアム候補150問セット。",
        audience_tag="プレミアム候補",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
    "grade3_official_style_100": DatasetSpec(
        key="grade3_official_style_100",
        questions_path=SHARED_DIR / "grade3_official_style_100_question_packets_enriched.json",
        set_id="grade3_official_style_100",
        label="3級公式寄せ100問",
        short_description="公式問題に寄せた文言で整えた3級向け100問セット。穴埋め問題を一部含む。",
        audience_tag="公式寄せ候補",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
    "draft_100": DatasetSpec(
        key="draft_100",
        questions_path=SHARED_DIR / "draft_100_question_packets_enriched.json",
        set_id="draft_100",
        label="100問ドラフト",
        short_description="3級の広い論点をまとめて確認する拡張ドラフトセット。",
        audience_tag="3級本編候補",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
    "draft_additional_200": DatasetSpec(
        key="draft_additional_200",
        questions_path=SHARED_DIR / "draft_additional_200_question_packets_enriched.json",
        set_id="draft_additional_200",
        label="追加200問ドラフト",
        short_description="3級向けの追加問題を広くためるための内部ドラフトセット。",
        audience_tag="追加ドラフト",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
    "grade2_draft_200": DatasetSpec(
        key="grade2_draft_200",
        questions_path=SHARED_DIR / "grade2_draft_200_question_packets_enriched.json",
        set_id="grade2_draft_200",
        label="2級向け200問ドラフト",
        short_description="2級対策向けの発展問題を集めた内部ドラフトセット。",
        audience_tag="2級候補",
        level="2級",
        visibility="private",
        required_plan="premium",
    ),
    "grade3_priority_80": DatasetSpec(
        key="grade3_priority_80",
        questions_path=SHARED_DIR / "grade3_priority_80_question_packets_enriched.json",
        set_id="grade3_priority_80",
        label="3級優先80問レビューセット",
        short_description="公開優先度の高い3級問題を先に磨くためのレビューセット。",
        audience_tag="優先レビュー",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
    "grade3_incorrect_200": DatasetSpec(
        key="grade3_incorrect_200",
        questions_path=SHARED_DIR / "grade3_incorrect_200_question_packets_enriched.json",
        set_id="grade3_incorrect_200",
        label="3級 誤答選択型200問セット",
        short_description="3級の試験範囲を広く確認する『誤っているものはどれか』形式の内部レビューセット。",
        audience_tag="3級誤答選択型",
        level="3級",
        visibility="private",
        required_plan="premium",
    ),
}


QUESTIONS_SUFFIX = "_question_packets_enriched.json"


def _derive_label_from_key(key: str) -> str:
    return key.replace("_", " ")


def _derive_short_description(key: str, level: str) -> str:
    return f"{level}向けのレビュー・公開候補セット（{key}）。"


def _derive_audience_tag(level: str) -> str:
    return f"{level}自動認識"


def _derive_visibility(key: str) -> str:
    return "public" if "public" in key or "release" in key else "private"


def _derive_required_plan(level: str, visibility: str) -> str:
    if visibility == "public":
        return "free"
    return "premium"


def normalize_required_plan(required_plan: str | None) -> str:
    return "premium" if required_plan in {"standard", "premium"} else "free"


def _plan_rank(plan_key: str | None) -> int:
    return 1 if normalize_required_plan(plan_key) == "premium" else 0


def _can_access_plan(required_plan: str | None, active_plan: str | None) -> bool:
    return _plan_rank(active_plan) >= _plan_rank(required_plan)


def _read_level_from_questions(path: Path) -> str:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list) and payload:
            return payload[0].get("level", "3級")
    except Exception:
        pass
    return "3級"


def discover_dataset_specs() -> dict[str, DatasetSpec]:
    specs = dict(MANUAL_DATASET_SPECS)
    manual_paths = {spec.questions_path.resolve() for spec in MANUAL_DATASET_SPECS.values()}

    for path in SHARED_DIR.glob(f"*{QUESTIONS_SUFFIX}"):
        resolved = path.resolve()
        if resolved in manual_paths:
            continue

        key = path.name[: -len(QUESTIONS_SUFFIX)]
        level = _read_level_from_questions(path)
        visibility = _derive_visibility(key)
        specs[key] = DatasetSpec(
            key=key,
            questions_path=path,
            set_id=key,
            label=_derive_label_from_key(key),
            short_description=_derive_short_description(key, level),
            audience_tag=_derive_audience_tag(level),
            level=level,
            visibility=visibility,
            required_plan=_derive_required_plan(level, visibility),
        )
    return specs


def list_dataset_keys() -> list[str]:
    return list(discover_dataset_specs().keys())


def get_dataset_spec(dataset_key: str) -> DatasetSpec:
    specs = discover_dataset_specs()
    if dataset_key not in specs:
        raise KeyError(f"Unknown dataset key: {dataset_key}")
    return specs[dataset_key]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _load_json(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _load_schema() -> str:
    return SCHEMA_PATH.read_text(encoding="utf-8")


def _load_premium_plan_registry() -> dict:
    if not PREMIUM_PLAN_REGISTRY_PATH.exists():
        return {"plans": {}}
    try:
        return json.loads(PREMIUM_PLAN_REGISTRY_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"plans": {}}


def get_premium_plan_config(plan_code: str = LOCAL_PREMIUM_PRODUCT_CODE) -> dict:
    registry = _load_premium_plan_registry()
    raw = registry.get("plans", {}).get(plan_code, {})
    configured_sets = raw.get("question_sets")
    if not isinstance(configured_sets, list):
        configured_sets = []
    return {
        "plan_code": plan_code,
        "label": raw.get("label", "3級プレミアム版"),
        "recommended_entry_path": raw.get("recommended_entry_path", "/app/"),
        "base_public_set_id": raw.get("base_public_set_id", "grade3_mixed_priority_50"),
        "merge_strategy": raw.get("merge_strategy", "append_non_duplicate"),
        "checkout_product_code": raw.get("checkout_product_code", LOCAL_PREMIUM_PRODUCT_CODE),
        "price_jpy": int(raw.get("price_jpy", 1200)),
        "question_sets": configured_sets,
        "unlocked_features": raw.get("unlocked_features", DEFAULT_PREMIUM_UNLOCKED_FEATURES),
    }


def _order_premium_sets(catalog_items: list[dict], configured_sets: list[dict]) -> list[dict]:
    if not configured_sets:
        return catalog_items
    by_set_id = {item.get("set_id"): item for item in catalog_items}
    ordered_items: list[dict] = []
    for index, configured in enumerate(configured_sets):
        set_id = configured.get("set_id")
        if not set_id or set_id not in by_set_id:
            continue
        merged = dict(by_set_id[set_id])
        merged["delivery_mode"] = configured.get("delivery_mode", "append_non_duplicate")
        merged["sort_order"] = index
        ordered_items.append(merged)
    return ordered_items


def ensure_schema(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as connection:
        connection.executescript(_load_schema())
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(question_sets)").fetchall()
        }
        if "short_description" not in columns:
            connection.execute(
                "ALTER TABLE question_sets ADD COLUMN short_description TEXT NOT NULL DEFAULT ''"
            )
        if "audience_tag" not in columns:
            connection.execute(
                "ALTER TABLE question_sets ADD COLUMN audience_tag TEXT NOT NULL DEFAULT ''"
            )
        _ensure_local_identity_seed(connection)
        connection.commit()


def _upsert_user(
    connection: sqlite3.Connection,
    *,
    user_id: str,
    auth_provider: str = "local_stub",
    auth_user_id: str,
    email: str,
    display_name: str,
) -> None:
    now = _utc_now_iso()
    connection.execute(
        """
        INSERT INTO users (
          id, auth_provider, auth_user_id, email, display_name,
          status, created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          auth_provider = excluded.auth_provider,
          auth_user_id = excluded.auth_user_id,
          email = excluded.email,
          display_name = excluded.display_name,
          status = excluded.status,
          updated_at = excluded.updated_at,
          last_login_at = excluded.last_login_at
        """,
        (user_id, auth_provider, auth_user_id, email, display_name, now, now, now),
    )


def _derive_display_name(
    auth_user_id: str,
    *,
    email: str = "",
    display_name: str = "",
) -> str:
    if display_name.strip():
        return display_name.strip()
    if email.strip():
        return email.split("@", 1)[0]
    if auth_user_id == LOCAL_FREE_AUTH_USER_ID:
        return "無料版ユーザー"
    if auth_user_id == LOCAL_PREMIUM_AUTH_USER_ID:
        return "プレミアム版ユーザー"
    return "利用者"


def _ensure_authenticated_user(
    connection: sqlite3.Connection,
    *,
    auth_user_id: str,
    auth_provider: str = "supabase",
    email: str = "",
    display_name: str = "",
) -> sqlite3.Row:
    connection.row_factory = sqlite3.Row
    existing = connection.execute(
        """
        SELECT id, auth_provider, auth_user_id, email, display_name, status
        FROM users
        WHERE auth_user_id = ?
        LIMIT 1
        """,
        (auth_user_id,),
    ).fetchone()

    normalized_email = email.strip()
    normalized_display_name = _derive_display_name(
        auth_user_id,
        email=normalized_email,
        display_name=display_name,
    )

    user_id = existing["id"] if existing else auth_user_id
    _upsert_user(
        connection,
        user_id=user_id,
        auth_provider=existing["auth_provider"] if existing else auth_provider,
        auth_user_id=auth_user_id,
        email=normalized_email or (existing["email"] if existing else f"{auth_user_id}@example.local"),
        display_name=normalized_display_name,
    )
    return connection.execute(
        """
        SELECT id, auth_provider, auth_user_id, email, display_name, status
        FROM users
        WHERE id = ?
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()


def _ensure_active_entitlement(
    connection: sqlite3.Connection,
    *,
    user_id: str,
    order_id: str,
    plan_code: str = "premium",
    product_code: str = LOCAL_PREMIUM_PRODUCT_CODE,
    scope_type: str = "plan",
    scope_id: str = LOCAL_PREMIUM_PRODUCT_CODE,
) -> None:
    now = _utc_now_iso()
    existing = connection.execute(
        """
        SELECT id
        FROM entitlements
        WHERE user_id = ? AND product_code = ? AND scope_type = ? AND scope_id = ?
        LIMIT 1
        """,
        (user_id, product_code, scope_type, scope_id),
    ).fetchone()
    entitlement_id = existing[0] if existing else uuid.uuid4().hex
    connection.execute(
        """
        INSERT INTO entitlements (
          id, user_id, plan_code, product_code, scope_type,
          scope_id, status, granted_at, expires_at, source_order_id, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          plan_code = excluded.plan_code,
          product_code = excluded.product_code,
          scope_type = excluded.scope_type,
          scope_id = excluded.scope_id,
          status = excluded.status,
          granted_at = excluded.granted_at,
          expires_at = excluded.expires_at,
          source_order_id = excluded.source_order_id,
          updated_at = excluded.updated_at
        """,
        (entitlement_id, user_id, plan_code, product_code, scope_type, scope_id, now, order_id, now),
    )


def _ensure_local_identity_seed(connection: sqlite3.Connection) -> None:
    _upsert_user(
        connection,
        user_id=LOCAL_FREE_AUTH_USER_ID,
        auth_user_id=LOCAL_FREE_AUTH_USER_ID,
        email="free@example.local",
        display_name="無料版ユーザー",
    )
    _upsert_user(
        connection,
        user_id=LOCAL_PREMIUM_AUTH_USER_ID,
        auth_user_id=LOCAL_PREMIUM_AUTH_USER_ID,
        email="premium@example.local",
        display_name="プレミアム版ユーザー",
    )

    existing_paid = connection.execute(
        """
        SELECT id
        FROM orders
        WHERE user_id = ? AND product_code = ? AND order_status = 'paid'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (LOCAL_PREMIUM_AUTH_USER_ID, LOCAL_PREMIUM_PRODUCT_CODE),
    ).fetchone()
    if existing_paid:
        _ensure_active_entitlement(
            connection,
            user_id=LOCAL_PREMIUM_AUTH_USER_ID,
            order_id=existing_paid[0],
        )
        return

    now = _utc_now_iso()
    order_id = uuid.uuid4().hex
    connection.execute(
        """
        INSERT INTO orders (
          id, user_id, product_code, price_jpy, currency,
          payment_provider, provider_checkout_id, provider_payment_id,
          order_status, purchased_at, created_at, updated_at
        ) VALUES (?, ?, ?, 1200, 'JPY', 'local_stub', ?, ?, 'paid', ?, ?, ?)
        """,
        (order_id, LOCAL_PREMIUM_AUTH_USER_ID, LOCAL_PREMIUM_PRODUCT_CODE, order_id, order_id, now, now, now),
    )
    _ensure_active_entitlement(
        connection,
        user_id=LOCAL_PREMIUM_AUTH_USER_ID,
        order_id=order_id,
    )


def _approved_questions(raw_questions: list[dict]) -> list[dict]:
    return [
        question
        for question in raw_questions
        if question.get("human_review", {}).get("checked_by_human")
        and question.get("human_review", {}).get("decision") == "approved"
    ]


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
    normalized = json.dumps(public_payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _source_snapshot(question: dict) -> str:
    snapshot = {
        "sources": question.get("sources", []),
        "claims": question.get("claims", []),
        "ai_first_pass": question.get("ai_first_pass", {}),
        "assistant_review": question.get("assistant_review", {}),
    }
    return json.dumps(snapshot, ensure_ascii=False, separators=(",", ":"))


def _extract_reference_links(source_snapshot_json: str | None) -> list[dict]:
    if not source_snapshot_json:
        return []

    try:
        snapshot = json.loads(source_snapshot_json)
    except (TypeError, json.JSONDecodeError):
        return []

    raw_sources = snapshot.get("sources", [])
    if not isinstance(raw_sources, list):
        return []

    reference_links: list[dict] = []
    seen_urls: set[str] = set()
    for source in raw_sources:
        if not isinstance(source, dict):
            continue
        url = str(source.get("url_or_location") or "").strip()
        if not url.startswith(("http://", "https://")):
            continue
        if url in seen_urls:
            continue
        seen_urls.add(url)
        reference_links.append(
            {
                "title": str(source.get("title") or source.get("publisher") or "参考資料").strip(),
                "publisher": str(source.get("publisher") or "").strip(),
                "section": str(source.get("section") or "").strip(),
                "url": url,
            }
        )
    return reference_links


def _upsert_question_set(
    connection: sqlite3.Connection,
    *,
    set_id: str,
    label: str,
    short_description: str,
    audience_tag: str,
    level: str,
    visibility: str,
    required_plan: str,
    dataset_key: str,
    published_at: str,
) -> None:
    connection.execute(
        """
        INSERT INTO question_sets (
          set_id, label, short_description, audience_tag, level, visibility, required_plan, is_active,
          source_dataset_key, published_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(set_id) DO UPDATE SET
          label = excluded.label,
          short_description = excluded.short_description,
          audience_tag = excluded.audience_tag,
          level = excluded.level,
          visibility = excluded.visibility,
          required_plan = excluded.required_plan,
          is_active = 1,
          source_dataset_key = excluded.source_dataset_key,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at
        """,
        (
            set_id,
            label,
            short_description,
            audience_tag,
            level,
            visibility,
            required_plan,
            dataset_key,
            published_at,
            published_at,
        ),
    )


def _upsert_question(
    connection: sqlite3.Connection,
    *,
    question: dict,
    required_plan: str,
    is_free: int,
    dataset_key: str,
    published_at: str,
) -> None:
    human_review = question.get("human_review", {})
    connection.execute(
        """
        INSERT INTO published_questions (
          question_id, level, category, subtopic, prompt, options_json, answer_index,
          explanation, option_explanations_json, memory_tip, is_free, required_plan,
          status, source_snapshot_json, editorial_source_id, content_hash,
          approved_by, approved_on, published_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(question_id) DO UPDATE SET
          level = excluded.level,
          category = excluded.category,
          subtopic = excluded.subtopic,
          prompt = excluded.prompt,
          options_json = excluded.options_json,
          answer_index = excluded.answer_index,
          explanation = excluded.explanation,
          option_explanations_json = excluded.option_explanations_json,
          memory_tip = excluded.memory_tip,
          is_free = excluded.is_free,
          required_plan = excluded.required_plan,
          status = excluded.status,
          source_snapshot_json = excluded.source_snapshot_json,
          editorial_source_id = excluded.editorial_source_id,
          content_hash = excluded.content_hash,
          approved_by = excluded.approved_by,
          approved_on = excluded.approved_on,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at
        """,
        (
            question["id"],
            question["level"],
            question["category"],
            question["subtopic"],
            question["question"],
            json.dumps(question["choices"], ensure_ascii=False),
            question["correct_index"],
            question["answer_reason"],
            json.dumps(question["wrong_reasons"], ensure_ascii=False),
            question["memory_tip"],
            is_free,
            required_plan,
            "published",
            _source_snapshot(question),
            dataset_key,
            _content_hash(question),
            human_review.get("reviewer", ""),
            human_review.get("reviewed_on", ""),
            published_at,
            published_at,
        ),
    )


def publish_dataset(
    *,
    dataset_key: str,
    db_path: Path = DEFAULT_DB_PATH,
    published_by: str = "system",
    notes: str = "",
    set_id: str | None = None,
    set_label: str | None = None,
    short_description: str | None = None,
    audience_tag: str | None = None,
    visibility: str | None = None,
    required_plan: str | None = None,
) -> PublishResult:
    spec = get_dataset_spec(dataset_key)
    raw_questions = _load_json(spec.questions_path)
    approved_questions = _approved_questions(raw_questions)
    if not approved_questions:
        raise ValueError(f"No approved questions found in dataset: {dataset_key}")

    db_path = db_path.resolve()
    ensure_schema(db_path)

    resolved_set_id = set_id or spec.set_id
    resolved_label = set_label or spec.label
    resolved_short_description = short_description or spec.short_description
    resolved_audience_tag = audience_tag or spec.audience_tag
    resolved_visibility = visibility or spec.visibility
    resolved_required_plan = normalize_required_plan(required_plan or spec.required_plan)
    published_at = _utc_now_iso()
    publish_id = uuid.uuid4().hex
    is_free = 1 if resolved_required_plan == "free" else 0

    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("BEGIN")
        _upsert_question_set(
            connection,
            set_id=resolved_set_id,
            label=resolved_label,
            short_description=resolved_short_description,
            audience_tag=resolved_audience_tag,
            level=spec.level,
            visibility=resolved_visibility,
            required_plan=resolved_required_plan,
            dataset_key=dataset_key,
            published_at=published_at,
        )
        connection.execute("DELETE FROM question_set_items WHERE set_id = ?", (resolved_set_id,))
        for sort_order, question in enumerate(approved_questions, start=1):
            _upsert_question(
                connection,
                question=question,
                required_plan=resolved_required_plan,
                is_free=is_free,
                dataset_key=dataset_key,
                published_at=published_at,
            )
            connection.execute(
                """
                INSERT INTO question_set_items (set_id, question_id, sort_order)
                VALUES (?, ?, ?)
                """,
                (resolved_set_id, question["id"], sort_order),
            )
        connection.execute(
            """
            INSERT INTO publish_batches (
              publish_id, dataset_key, set_id, published_by,
              question_count, published_at, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                publish_id,
                dataset_key,
                resolved_set_id,
                published_by,
                len(approved_questions),
                published_at,
                notes,
            ),
        )
        connection.commit()

    return PublishResult(
        dataset_key=dataset_key,
        set_id=resolved_set_id,
        question_count=len(approved_questions),
        publish_id=publish_id,
        db_path=db_path,
        published_at=published_at,
    )


def fetch_public_catalog(db_path: Path = DEFAULT_DB_PATH, active_plan: str = "free") -> list[dict]:
    ensure_schema(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
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
              qs.published_at,
              COUNT(qsi.question_id) AS question_count
            FROM question_sets qs
            LEFT JOIN question_set_items qsi ON qsi.set_id = qs.set_id
            WHERE qs.visibility = 'public' AND qs.is_active = 1
            GROUP BY
              qs.set_id,
              qs.label,
              qs.short_description,
              qs.audience_tag,
              qs.level,
              qs.visibility,
              qs.required_plan,
              qs.published_at
            ORDER BY qs.published_at DESC, qs.set_id
            """
        ).fetchall()
    items = [dict(row) for row in rows]
    visible_items = []
    for item in items:
        item["required_plan"] = normalize_required_plan(item.get("required_plan"))
        if _can_access_plan(item["required_plan"], active_plan):
            visible_items.append(item)
    return visible_items


def fetch_premium_catalog(
    db_path: Path = DEFAULT_DB_PATH,
    active_plan: str = "premium",
    plan_code: str = LOCAL_PREMIUM_PRODUCT_CODE,
) -> list[dict]:
    ensure_schema(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
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
              qs.published_at,
              COUNT(qsi.question_id) AS question_count
            FROM question_sets qs
            LEFT JOIN question_set_items qsi ON qsi.set_id = qs.set_id
            WHERE qs.is_active = 1
              AND qs.required_plan = 'premium'
            GROUP BY
              qs.set_id,
              qs.label,
              qs.short_description,
              qs.audience_tag,
              qs.level,
              qs.visibility,
              qs.required_plan,
              qs.published_at
            ORDER BY qs.published_at DESC, qs.set_id
            """
        ).fetchall()
    items = [dict(row) for row in rows]
    visible_items = [item for item in items if _can_access_plan(item.get("required_plan"), active_plan)]
    config = get_premium_plan_config(plan_code)
    return _order_premium_sets(visible_items, config.get("question_sets", []))


def _build_question_payload(
    connection: sqlite3.Connection,
    *,
    set_row: sqlite3.Row,
    rows: list[sqlite3.Row],
) -> dict:
    questions = []
    for row in rows:
        questions.append(
            {
                "id": row["question_id"],
                "level": row["level"],
                "category": row["category"],
                "subtopic": row["subtopic"],
                "prompt": row["prompt"],
                "options": json.loads(row["options_json"]),
                "answer_index": row["answer_index"],
                "explanation": row["explanation"],
                "option_explanations": json.loads(row["option_explanations_json"]),
                "memory_tip": row["memory_tip"],
                "reference_links": _extract_reference_links(row["source_snapshot_json"]),
            }
        )

    return {
        "version": set_row["published_at"] or "",
        "set_id": set_row["set_id"],
        "set_name": set_row["label"],
        "set_description": set_row["short_description"] or "",
        "set_tag": set_row["audience_tag"] or "",
        "required_plan": normalize_required_plan(set_row["required_plan"]),
        "question_count": len(questions),
        "questions": questions,
    }


def fetch_question_payload(
    db_path: Path = DEFAULT_DB_PATH,
    set_id: str | None = None,
    active_plan: str = "free",
) -> dict:
    ensure_schema(db_path)
    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        if set_id is None:
            row = connection.execute(
                """
                SELECT set_id
                FROM question_sets
                WHERE visibility = 'public' AND is_active = 1
                  AND (required_plan = 'free' OR ? = 'premium')
                ORDER BY published_at DESC, set_id
                LIMIT 1
                """
                ,
                (normalize_required_plan(active_plan),),
            ).fetchone()
            if row is None:
                raise LookupError("No public question set found.")
            set_id = str(row["set_id"])

        set_row = connection.execute(
            """
            SELECT set_id, label, short_description, audience_tag, level, published_at, required_plan
            FROM question_sets
            WHERE set_id = ?
              AND visibility = 'public'
              AND is_active = 1
              AND (required_plan = 'free' OR ? = 'premium')
            """,
            (set_id, normalize_required_plan(active_plan)),
        ).fetchone()
        if set_row is None:
            raise LookupError(f"Public question set not found: {set_id}")

        rows = connection.execute(
            """
            SELECT
              pq.question_id,
              pq.level,
              pq.category,
              pq.subtopic,
              pq.prompt,
              pq.options_json,
              pq.answer_index,
              pq.explanation,
              pq.option_explanations_json,
              pq.memory_tip,
              pq.source_snapshot_json
            FROM question_set_items qsi
            JOIN published_questions pq ON pq.question_id = qsi.question_id
            WHERE qsi.set_id = ?
            ORDER BY qsi.sort_order ASC
            """,
            (set_id,),
        ).fetchall()
    return _build_question_payload(connection, set_row=set_row, rows=rows)


def fetch_premium_question_payload(
    db_path: Path = DEFAULT_DB_PATH,
    set_id: str | None = None,
    active_plan: str = "premium",
    plan_code: str = LOCAL_PREMIUM_PRODUCT_CODE,
) -> dict:
    ensure_schema(db_path)
    if normalize_required_plan(active_plan) != "premium":
        raise LookupError("Premium plan is required.")

    config = get_premium_plan_config(plan_code)
    configured_set_ids = [item.get("set_id") for item in config.get("question_sets", []) if item.get("set_id")]
    if set_id and configured_set_ids and set_id not in configured_set_ids:
        raise LookupError(f"Premium question set not allowed: {set_id}")

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        if set_id is None:
            if configured_set_ids:
                set_id = configured_set_ids[0]
            else:
                row = connection.execute(
                    """
                    SELECT set_id
                    FROM question_sets
                    WHERE is_active = 1
                      AND required_plan = 'premium'
                    ORDER BY published_at DESC, set_id
                    LIMIT 1
                    """,
                ).fetchone()
                if row is None:
                    raise LookupError("No premium question set found.")
                set_id = str(row["set_id"])

        set_row = connection.execute(
            """
            SELECT set_id, label, short_description, audience_tag, level, published_at, required_plan
            FROM question_sets
            WHERE set_id = ?
              AND is_active = 1
              AND required_plan = 'premium'
            """,
            (set_id,),
        ).fetchone()
        if set_row is None:
            raise LookupError(f"Premium question set not found: {set_id}")

        rows = connection.execute(
            """
            SELECT
              pq.question_id,
              pq.level,
              pq.category,
              pq.subtopic,
              pq.prompt,
              pq.options_json,
              pq.answer_index,
              pq.explanation,
              pq.option_explanations_json,
              pq.memory_tip,
              pq.source_snapshot_json
            FROM question_set_items qsi
            JOIN published_questions pq ON pq.question_id = qsi.question_id
            WHERE qsi.set_id = ?
            ORDER BY qsi.sort_order ASC
            """,
            (set_id,),
        ).fetchall()

    return _build_question_payload(connection, set_row=set_row, rows=rows)


def fetch_license_status(
    db_path: Path = DEFAULT_DB_PATH,
    auth_user_id: str | None = None,
    *,
    auth_provider: str = "supabase",
    email: str = "",
    display_name: str = "",
) -> dict:
    ensure_schema(db_path)
    if not auth_user_id:
        return {
            "signed_in": False,
            "purchase_state": "not_started",
            "active_plan": "free",
            "user": None,
            "entitlements": [],
            "source": "guest_local",
        }

    with sqlite3.connect(db_path) as connection:
        connection.row_factory = sqlite3.Row
        user = _ensure_authenticated_user(
            connection,
            auth_user_id=auth_user_id,
            auth_provider=auth_provider,
            email=email,
            display_name=display_name,
        )

        entitlement_rows = connection.execute(
            """
            SELECT plan_code, product_code, scope_type, scope_id, status, granted_at, expires_at
            FROM entitlements
            WHERE user_id = ? AND status = 'active'
            ORDER BY updated_at DESC
            """,
            (user["id"],),
        ).fetchall()
        order_row = connection.execute(
            """
            SELECT order_status
            FROM orders
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user["id"],),
        ).fetchone()

    entitlements = [
        {
            "plan_code": normalize_required_plan(row["plan_code"]),
            "product_code": row["product_code"],
            "scope_type": row["scope_type"],
            "scope_id": row["scope_id"],
            "status": row["status"],
            "granted_at": row["granted_at"],
            "expires_at": row["expires_at"],
        }
        for row in entitlement_rows
    ]
    has_premium = any(item["plan_code"] == "premium" for item in entitlements)
    order_status = order_row["order_status"] if order_row else None
    if has_premium:
        purchase_state = "entitled"
    elif order_status == "pending":
        purchase_state = "in_checkout"
    elif order_status == "paid":
        purchase_state = "paid_pending_entitlement"
    else:
        purchase_state = "not_started"

    return {
        "signed_in": True,
        "purchase_state": purchase_state,
        "active_plan": "premium" if has_premium else "free",
        "user": {
            "user_id": user["auth_user_id"],
            "display_name": user["display_name"] or "利用者",
        },
        "entitlements": entitlements,
        "source": "local_db",
    }


def start_checkout(
    db_path: Path = DEFAULT_DB_PATH,
    *,
    auth_user_id: str,
    auth_provider: str = "supabase",
    email: str = "",
    display_name: str = "",
    product_code: str = LOCAL_PREMIUM_PRODUCT_CODE,
    price_jpy: int = 1200,
) -> dict:
    ensure_schema(db_path)
    now = _utc_now_iso()
    order_id = uuid.uuid4().hex
    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        user = _ensure_authenticated_user(
            connection,
            auth_user_id=auth_user_id,
            auth_provider=auth_provider,
            email=email,
            display_name=display_name,
        )
        connection.execute(
            """
            INSERT INTO orders (
              id, user_id, product_code, price_jpy, currency,
              payment_provider, provider_checkout_id, provider_payment_id,
              order_status, purchased_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'JPY', 'local_stub', ?, NULL, 'pending', NULL, ?, ?)
            """,
            (order_id, user["id"], product_code, price_jpy, order_id, now, now),
        )
        connection.commit()

    return {
        "checkout_id": order_id,
        "purchase_state": "in_checkout",
        "product_code": product_code,
        "price_jpy": price_jpy,
        "checkout_url": "/premium/ready/",
    }


def complete_checkout(
    db_path: Path = DEFAULT_DB_PATH,
    *,
    auth_user_id: str,
    auth_provider: str = "supabase",
    email: str = "",
    display_name: str = "",
    product_code: str = LOCAL_PREMIUM_PRODUCT_CODE,
    price_jpy: int = 1200,
) -> dict:
    ensure_schema(db_path)
    now = _utc_now_iso()
    with sqlite3.connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        user = _ensure_authenticated_user(
            connection,
            auth_user_id=auth_user_id,
            auth_provider=auth_provider,
            email=email,
            display_name=display_name,
        )
        pending = connection.execute(
            """
            SELECT id
            FROM orders
            WHERE user_id = ? AND product_code = ? AND order_status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (user["id"], product_code),
        ).fetchone()
        order_id = pending[0] if pending else uuid.uuid4().hex
        if pending:
            connection.execute(
                """
                UPDATE orders
                SET order_status = 'paid',
                    provider_payment_id = ?,
                    purchased_at = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (order_id, now, now, order_id),
            )
        else:
            connection.execute(
                """
                INSERT INTO orders (
                  id, user_id, product_code, price_jpy, currency,
                  payment_provider, provider_checkout_id, provider_payment_id,
                  order_status, purchased_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, 'JPY', 'local_stub', ?, ?, 'paid', ?, ?, ?)
                """,
                (order_id, user["id"], product_code, price_jpy, order_id, order_id, now, now, now),
            )
        _ensure_active_entitlement(
            connection,
            user_id=user["id"],
            order_id=order_id,
            product_code=product_code,
            scope_id=product_code,
        )
        connection.commit()

    status = fetch_license_status(db_path, auth_user_id)
    status["checkout_id"] = order_id
    return status
