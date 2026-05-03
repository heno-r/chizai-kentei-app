from __future__ import annotations

import csv
import json
import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path
import sys
import tkinter as tk
import tkinter.font as tkfont
from tkinter import messagebox, ttk
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from content_admin.debug_content_db import (
    connect as connect_content_db,
    delete_set as delete_db_set,
    get_premium_plan_membership as get_db_premium_plan_membership,
    load_batches as load_db_batches,
    load_contact_message_detail as load_db_contact_message_detail,
    load_contact_messages as load_db_contact_messages,
    load_set_detail as load_db_set_detail,
    load_sets as load_db_sets,
    load_summary as load_db_summary,
    update_premium_plan_membership as update_db_premium_plan_membership,
    update_set_settings as update_db_set_settings,
)
from content_admin.publisher import (
    DEFAULT_DB_PATH,
    get_dataset_spec,
    list_dataset_keys,
    publish_dataset,
)


SHARED_DIR = BASE_DIR.parent / "shared_content"
QUESTION_PATH = SHARED_DIR / "first_release_question_packets_enriched.json"
TRACKER_PATH = SHARED_DIR / "first_release_review_tracker.csv"
FILL_TEMPLATE_PATH = SHARED_DIR / "human_review_fill_template.csv"
CONTACT_VIEWER_CONFIG_PATH = BASE_DIR / "contact_viewer_config.local.json"
DEFAULT_CONTACT_VIEWER_API_BASE = "https://chizai-kentei-secure-api.henohenomoheji1202apps.workers.dev"
CONTACT_VIEWER_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)

DECISION_LABELS = {
    "approve": "承認",
    "hold": "保留",
}
DECISION_TO_STORED = {
    "承認": "approved",
    "保留": "hold",
}
STORED_TO_DECISION = {
    "approved": "承認",
    "hold": "保留",
    "draft": "承認",
}
STATUS_LABELS = {
    "approved": "承認済み",
    "hold": "保留",
    "draft": "未確認",
}

FILTER_OPTIONS = {
    "all": "すべて",
    "pending_only": "未レビューのみ",
    "approved_only": "承認のみ",
    "hold_only": "保留のみ",
}


@dataclass
class ReviewFiles:
    questions_path: Path = QUESTION_PATH
    tracker_path: Path = TRACKER_PATH
    fill_template_path: Path = FILL_TEMPLATE_PATH


def _build_review_files(dataset_key: str) -> ReviewFiles:
    spec = get_dataset_spec(dataset_key)
    filename = spec.questions_path.name
    if filename == "first_release_question_packets_enriched.json":
        return ReviewFiles(
            questions_path=spec.questions_path,
            tracker_path=SHARED_DIR / "first_release_review_tracker.csv",
            fill_template_path=SHARED_DIR / "human_review_fill_template.csv",
        )

    prefix = filename.removesuffix("_question_packets_enriched.json")
    return ReviewFiles(
        questions_path=spec.questions_path,
        tracker_path=SHARED_DIR / f"{prefix}_review_tracker.csv",
        fill_template_path=SHARED_DIR / f"{prefix}_human_review_fill_template.csv",
    )


def _dataset_options() -> dict[str, ReviewFiles]:
    return {key: _build_review_files(key) for key in list_dataset_keys()}


def _dataset_label(dataset_key: str) -> str:
    return get_dataset_spec(dataset_key).label


def _load_contact_viewer_config() -> dict:
    api_base_url = os.environ.get("CONTACT_VIEWER_API_BASE", "").strip()
    admin_token = os.environ.get("CONTACT_VIEWER_ADMIN_TOKEN", "").strip()

    if CONTACT_VIEWER_CONFIG_PATH.exists():
        try:
            payload = json.loads(CONTACT_VIEWER_CONFIG_PATH.read_text(encoding="utf-8"))
            api_base_url = str(payload.get("api_base_url") or api_base_url).strip()
            admin_token = str(payload.get("admin_token") or admin_token).strip()
        except json.JSONDecodeError:
            pass

    return {
        "api_base_url": api_base_url or DEFAULT_CONTACT_VIEWER_API_BASE,
        "admin_token": admin_token,
    }


class ReviewApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("知財検定レビューアプリ")
        self.root.geometry("1360x860")
        self.dataset_options = _dataset_options()
        self.dataset_var = tk.StringVar(value=self._default_dataset_key())
        self.files = self.dataset_options[self.dataset_var.get()]
        self.questions = self._load_questions()
        self.tracker_rows = self._load_tracker_rows()
        self.fill_rows = self._load_fill_rows()
        self.current_index = 0

        self.reviewer_var = tk.StringVar()
        self.reviewed_on_var = tk.StringVar(value=str(date.today()))
        self.decision_var = tk.StringVar(value="承認")
        self.source_ok_var = tk.BooleanVar(value=True)
        self.answer_ok_var = tk.BooleanVar(value=True)
        self.wrong_ok_var = tk.BooleanVar(value=True)
        self.wording_ok_var = tk.BooleanVar(value=True)
        self.filter_var = tk.StringVar(value="all")
        self.filter_label_var = tk.StringVar(value=FILTER_OPTIONS["all"])
        self.group_var = tk.StringVar(value="none")
        default_publish_spec = get_dataset_spec(self.dataset_var.get())
        self.publish_set_id_var = tk.StringVar(value=default_publish_spec.set_id)
        self.publish_label_var = tk.StringVar(value=default_publish_spec.label)
        self.publish_description_var = tk.StringVar(value=default_publish_spec.short_description)
        self.publish_tag_var = tk.StringVar(value=default_publish_spec.audience_tag)
        self.publish_visibility_var = tk.StringVar(value=default_publish_spec.visibility)
        self.publish_plan_var = tk.StringVar(value=default_publish_spec.required_plan)
        self.publish_include_in_premium_var = tk.BooleanVar(value=default_publish_spec.required_plan == "premium")
        self.publish_delivery_mode_var = tk.StringVar(value="append_non_duplicate")
        self.status_var = tk.StringVar(value="準備完了")
        self.progress_var = tk.StringVar(value="")
        self.detail_font = tkfont.Font(family="Yu Gothic UI", size=11)
        self.notes_font = tkfont.Font(family="Yu Gothic UI", size=11)

        self.question_listbox: tk.Listbox | None = None
        self.detail_text: tk.Text | None = None
        self.notes_text: tk.Text | None = None
        self.db_viewer_window: tk.Toplevel | None = None
        self.db_summary_var = tk.StringVar(value="")
        self.db_sets_tree: ttk.Treeview | None = None
        self.db_batches_tree: ttk.Treeview | None = None
        self.db_contacts_tree: ttk.Treeview | None = None
        self.db_detail_text: tk.Text | None = None
        self.production_contact_window: tk.Toplevel | None = None
        self.production_contact_summary_var = tk.StringVar(value="")
        self.production_contacts_tree: ttk.Treeview | None = None
        self.production_contact_detail_text: tk.Text | None = None
        self.db_edit_set_id_var = tk.StringVar(value="")
        self.db_edit_label_var = tk.StringVar(value="")
        self.db_edit_tag_var = tk.StringVar(value="")
        self.db_edit_description_var = tk.StringVar(value="")
        self.db_edit_visibility_var = tk.StringVar(value="private")
        self.db_edit_plan_var = tk.StringVar(value="premium")
        self.db_edit_active_var = tk.BooleanVar(value=True)
        self.db_edit_include_in_premium_var = tk.BooleanVar(value=False)
        self.db_edit_delivery_mode_var = tk.StringVar(value="append_non_duplicate")

        self._build_ui()
        self._bind_shortcuts()
        self._refresh_question_list()
        initial_index = self._first_pending_filtered_index() or 0
        self._load_question(initial_index)

    def _load_questions(self) -> list[dict]:
        with self.files.questions_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    def _save_questions(self) -> None:
        with self.files.questions_path.open("w", encoding="utf-8") as fh:
            json.dump(self.questions, fh, ensure_ascii=False, indent=2)

    @staticmethod
    def _load_csv(path: Path) -> list[dict]:
        if not path.exists():
            return []
        with path.open("r", encoding="utf-8-sig", newline="") as fh:
            return list(csv.DictReader(fh))

    @staticmethod
    def _save_csv(path: Path, rows: list[dict]) -> None:
        if not rows:
            return
        with path.open("w", encoding="utf-8-sig", newline="") as fh:
            writer = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)

    def _default_dataset_key(self) -> str:
        if (
            "grade3_mixed_priority_50" in self.dataset_options
            and self.dataset_options["grade3_mixed_priority_50"].questions_path.exists()
        ):
            return "grade3_mixed_priority_50"
        if "draft_100" in self.dataset_options and self.dataset_options["draft_100"].questions_path.exists():
            return "draft_100"
        if "first_release_5" in self.dataset_options:
            return "first_release_5"
        return next(iter(self.dataset_options))

    def _load_fill_rows(self) -> list[dict]:
        rows = self._load_csv(self.files.fill_template_path)
        if rows:
            return rows
        generated_rows = []
        for question in self.questions:
            recommended = (
                question.get("assistant_review", {}).get("recommended_decision", "hold")
            )
            generated_rows.append(
                {
                    "id": question["id"],
                    "recommended_decision": recommended,
                    "human_decision": question.get("human_review", {}).get("decision", ""),
                    "reviewed_by": question.get("human_review", {}).get("reviewer", ""),
                    "reviewed_on": question.get("human_review", {}).get("reviewed_on", ""),
                    "human_notes": question.get("human_review", {}).get("notes", ""),
                }
            )
        return generated_rows

    def _load_tracker_rows(self) -> list[dict]:
        rows = self._load_csv(self.files.tracker_path)
        if rows:
            return rows
        generated_rows = []
        for question in self.questions:
            generated_rows.append(
                {
                    "id": question["id"],
                    "category": question["category"],
                    "subtopic": question["subtopic"],
                    "source_confirmed": "false",
                    "answer_checked": "true",
                    "wrong_reasons_checked": "true",
                    "wording_checked": "true",
                    "ai_first_pass_verdict": question.get("ai_first_pass", {}).get("overall_verdict", "hold"),
                    "reviewed_by": question.get("human_review", {}).get("reviewer", ""),
                    "reviewed_on": question.get("human_review", {}).get("reviewed_on", ""),
                    "status": question.get("human_review", {}).get("decision", "pending"),
                    "notes": question.get("human_review", {}).get("notes", ""),
                }
            )
        return generated_rows

    def _reset_publish_targets(self) -> None:
        spec = get_dataset_spec(self.dataset_var.get())
        self.publish_set_id_var.set(spec.set_id)
        self.publish_label_var.set(spec.label)
        self.publish_description_var.set(spec.short_description)
        self.publish_tag_var.set(spec.audience_tag)
        self.publish_visibility_var.set(spec.visibility)
        self.publish_plan_var.set(spec.required_plan)
        self.publish_include_in_premium_var.set(spec.required_plan == "premium")
        self.publish_delivery_mode_var.set("append_non_duplicate")

    def _build_ui(self) -> None:
        self.root.columnconfigure(0, weight=0)
        self.root.columnconfigure(1, weight=1)
        self.root.rowconfigure(1, weight=1)

        top = ttk.Frame(self.root, padding=12)
        top.grid(row=0, column=0, columnspan=2, sticky="ew")
        for col in range(13):
            top.columnconfigure(col, weight=1 if col in (1, 3, 5, 7) else 0)

        ttk.Label(top, text="データ").grid(row=0, column=0, sticky="w")
        dataset_box = ttk.Combobox(
            top,
            textvariable=self.dataset_var,
            values=list(self.dataset_options.keys()),
            state="readonly",
            width=18,
        )
        dataset_box.grid(row=0, column=1, sticky="ew", padx=(6, 12))
        dataset_box.bind("<<ComboboxSelected>>", self._on_dataset_changed)

        ttk.Label(top, text="レビュアー").grid(row=0, column=2, sticky="w")
        ttk.Entry(top, textvariable=self.reviewer_var, width=20).grid(row=0, column=3, sticky="ew", padx=(6, 12))
        ttk.Label(top, text="レビュー日").grid(row=0, column=4, sticky="w")
        ttk.Entry(top, textvariable=self.reviewed_on_var, width=14).grid(row=0, column=5, sticky="ew", padx=(6, 12))
        ttk.Label(top, text="表示").grid(row=0, column=6, sticky="w")
        filter_box = ttk.Combobox(
            top,
            textvariable=self.filter_label_var,
            values=list(FILTER_OPTIONS.values()),
            state="readonly",
            width=16,
        )
        filter_box.grid(row=0, column=7, sticky="w", padx=(6, 12))
        filter_box.bind("<<ComboboxSelected>>", self._on_filter_changed)
        ttk.Label(top, text="並び").grid(row=1, column=6, sticky="w", pady=(8, 0))
        group_box = ttk.Combobox(
            top,
            textvariable=self.group_var,
            values=("none", "subtopic"),
            state="readonly",
            width=16,
        )
        group_box.grid(row=1, column=7, sticky="w", padx=(6, 12), pady=(8, 0))
        group_box.bind("<<ComboboxSelected>>", lambda _event: self._refresh_question_list())
        ttk.Label(top, text="set_id").grid(row=1, column=0, sticky="w", pady=(8, 0))
        ttk.Entry(top, textvariable=self.publish_set_id_var, width=18).grid(
            row=1, column=1, sticky="ew", padx=(6, 12), pady=(8, 0)
        )
        ttk.Label(top, text="公開名").grid(row=1, column=2, sticky="w", pady=(8, 0))
        ttk.Entry(top, textvariable=self.publish_label_var, width=20).grid(
            row=1, column=3, sticky="ew", padx=(6, 12), pady=(8, 0)
        )
        ttk.Label(top, text="公開").grid(row=1, column=4, sticky="w", pady=(8, 0))
        ttk.Combobox(
            top,
            textvariable=self.publish_visibility_var,
            values=("public", "private"),
            state="readonly",
            width=12,
        ).grid(row=1, column=5, sticky="w", padx=(6, 12), pady=(8, 0))
        ttk.Label(top, text="必要プラン").grid(row=1, column=9, sticky="e", pady=(8, 0))
        ttk.Combobox(
            top,
            textvariable=self.publish_plan_var,
            values=("free", "premium"),
            state="readonly",
            width=14,
        ).grid(row=1, column=10, sticky="w", padx=(6, 12), pady=(8, 0))
        ttk.Label(top, text="用途タグ").grid(row=2, column=0, sticky="w", pady=(8, 0))
        ttk.Entry(top, textvariable=self.publish_tag_var, width=18).grid(
            row=2, column=1, sticky="ew", padx=(6, 12), pady=(8, 0)
        )
        ttk.Label(top, text="紹介文").grid(row=2, column=2, sticky="w", pady=(8, 0))
        ttk.Entry(top, textvariable=self.publish_description_var, width=48).grid(
            row=2, column=3, columnspan=5, sticky="ew", padx=(6, 12), pady=(8, 0)
        )
        ttk.Checkbutton(
            top,
            text="プレミアム版に含める",
            variable=self.publish_include_in_premium_var,
        ).grid(row=2, column=8, columnspan=2, sticky="w", pady=(8, 0))
        ttk.Label(top, text="配信方式").grid(row=2, column=10, sticky="e", pady=(8, 0))
        ttk.Combobox(
            top,
            textvariable=self.publish_delivery_mode_var,
            values=("append_non_duplicate",),
            state="readonly",
            width=18,
        ).grid(row=2, column=11, sticky="w", padx=(6, 0), pady=(8, 0))
        ttk.Button(top, text="未レビューへ", command=self._jump_to_pending).grid(row=0, column=8, sticky="e", padx=(0, 8))
        ttk.Button(top, text="同サブトピックへ", command=self._jump_to_same_subtopic_pending).grid(row=1, column=8, sticky="e", padx=(0, 8), pady=(8, 0))
        ttk.Button(top, text="承認分をDBへ反映", command=self._publish_approved_to_db).grid(row=0, column=9, sticky="e", padx=(0, 8))
        ttk.Button(top, text="保存", command=self._save_current_review).grid(row=0, column=10, sticky="e", padx=(0, 8))
        ttk.Button(top, text="再読み込み", command=self._reload_all).grid(row=0, column=11, sticky="e")
        ttk.Button(top, text="本番問い合わせ", command=self._open_production_contact_viewer).grid(
            row=0, column=12, sticky="e", padx=(8, 0)
        )

        left = ttk.Frame(self.root, padding=(12, 0, 8, 12))
        left.grid(row=1, column=0, sticky="ns")
        left.rowconfigure(1, weight=1)
        left.columnconfigure(0, weight=1)
        ttk.Label(left, text="問題一覧").pack(anchor="w", pady=(0, 6))
        list_frame = ttk.Frame(left)
        list_frame.pack(fill="y", expand=True)
        list_frame.pack_propagate(False)
        list_frame.rowconfigure(0, weight=1)
        list_frame.columnconfigure(0, weight=1)

        self.question_listbox = tk.Listbox(list_frame, width=34, height=38, exportselection=False)
        self.question_listbox.grid(row=0, column=0, sticky="ns")
        question_scroll = ttk.Scrollbar(list_frame, orient="vertical", command=self.question_listbox.yview)
        question_scroll.grid(row=0, column=1, sticky="ns")
        self.question_listbox.configure(yscrollcommand=question_scroll.set)
        self.question_listbox.bind("<<ListboxSelect>>", self._on_select_question)

        right = ttk.Frame(self.root, padding=(8, 0, 12, 12))
        right.grid(row=1, column=1, sticky="nsew")
        right.rowconfigure(0, weight=3)
        right.rowconfigure(1, weight=2)
        right.columnconfigure(0, weight=1)

        detail_frame = ttk.LabelFrame(right, text="問題詳細", padding=10)
        detail_frame.grid(row=0, column=0, sticky="nsew")
        detail_frame.grid_propagate(False)
        detail_frame.rowconfigure(0, weight=1)
        detail_frame.columnconfigure(0, weight=1)
        self.detail_text = tk.Text(detail_frame, wrap="word", font=self.detail_font)
        self.detail_text.grid(row=0, column=0, sticky="nsew")
        detail_scroll = ttk.Scrollbar(detail_frame, orient="vertical", command=self.detail_text.yview)
        detail_scroll.grid(row=0, column=1, sticky="ns")
        self.detail_text.configure(yscrollcommand=detail_scroll.set, state="disabled")
        self._bind_zoomable_text(self.detail_text, self.detail_font)

        review_frame = ttk.LabelFrame(right, text="レビュー入力", padding=10)
        review_frame.grid(row=1, column=0, sticky="nsew", pady=(10, 0))
        review_frame.grid_propagate(False)
        for col in range(5):
            review_frame.columnconfigure(col, weight=1)
        review_frame.rowconfigure(4, weight=1)

        ttk.Label(review_frame, text="判定").grid(row=0, column=0, sticky="w")
        decision_box = ttk.Combobox(
            review_frame,
            textvariable=self.decision_var,
            values=("承認", "保留"),
            state="readonly",
            width=18,
        )
        decision_box.grid(row=0, column=1, sticky="w", padx=(6, 12))

        ttk.Checkbutton(review_frame, text="source確認", variable=self.source_ok_var).grid(row=0, column=2, sticky="w")
        ttk.Checkbutton(review_frame, text="answer確認", variable=self.answer_ok_var).grid(row=0, column=3, sticky="w")
        ttk.Checkbutton(review_frame, text="wrong理由確認", variable=self.wrong_ok_var).grid(row=1, column=2, sticky="w")
        ttk.Checkbutton(review_frame, text="文言確認", variable=self.wording_ok_var).grid(row=1, column=3, sticky="w")

        ttk.Label(review_frame, text="レビューコメント").grid(row=1, column=0, sticky="w", pady=(8, 4))
        ttk.Label(review_frame, text="保存すると JSON / CSV を更新").grid(row=1, column=1, sticky="w", pady=(8, 4))
        ttk.Label(review_frame, textvariable=self.progress_var).grid(row=1, column=4, sticky="e", pady=(8, 4))

        ttk.Button(review_frame, text="承認して次へ", command=self._approve_and_next).grid(
            row=2, column=0, sticky="ew", padx=(0, 8), pady=(4, 0)
        )
        ttk.Button(review_frame, text="保留して次へ", command=self._hold_and_next).grid(
            row=2, column=1, sticky="ew", padx=(0, 8), pady=(4, 0)
        )
        ttk.Button(review_frame, text="保存のみ", command=self._save_current_review).grid(
            row=2, column=2, sticky="ew", padx=(0, 8), pady=(4, 0)
        )
        ttk.Label(
            review_frame,
            text="Ctrl+Enter: 承認して次へ / Ctrl+H: 保留して次へ",
        ).grid(row=2, column=3, columnspan=2, sticky="w", pady=(4, 0))

        self.notes_text = tk.Text(review_frame, wrap="word", height=10, font=self.notes_font, undo=True)
        self.notes_text.grid(row=4, column=0, columnspan=5, sticky="nsew", pady=(8, 0))
        self._bind_zoomable_text(self.notes_text, self.notes_font)
        self.notes_text.bind("<Control-z>", self._undo_notes)
        self.notes_text.bind("<Control-y>", self._redo_notes)

        bottom = ttk.Frame(self.root, padding=(12, 0, 12, 12))
        bottom.grid(row=2, column=0, columnspan=2, sticky="ew")
        bottom.columnconfigure(0, weight=1)
        ttk.Label(bottom, textvariable=self.status_var).grid(row=0, column=0, sticky="w")
        ttk.Button(bottom, text="DBビューア", command=self._open_db_viewer).grid(row=0, column=1, padx=(0, 6))
        ttk.Button(bottom, text="本番問い合わせ", command=self._open_production_contact_viewer).grid(row=0, column=2, padx=(0, 6))
        ttk.Button(bottom, text="前へ", command=self._move_previous).grid(row=0, column=2, padx=(0, 6))
        ttk.Button(bottom, text="次へ", command=self._move_next).grid(row=0, column=3)

    def _filtered_questions(self) -> list[dict]:
        mode = self.filter_var.get()
        if mode == "pending_only":
            filtered = [q for q in self.questions if not q["human_review"]["checked_by_human"]]
        elif mode == "approved_only":
            filtered = [q for q in self.questions if q["human_review"]["decision"] == "approved"]
        elif mode == "hold_only":
            filtered = [q for q in self.questions if q["human_review"]["decision"] == "hold"]
        else:
            filtered = list(self.questions)

        if self.group_var.get() == "subtopic":
            filtered.sort(key=lambda q: (q["category"], q["subtopic"], q["id"]))
        return filtered

    def _on_filter_changed(self, _event: object) -> None:
        selected_label = self.filter_label_var.get()
        for key, label in FILTER_OPTIONS.items():
            if label == selected_label:
                self.filter_var.set(key)
                break
        self._refresh_question_list()

    def _refresh_question_list(self) -> None:
        assert self.question_listbox is not None
        self.question_listbox.delete(0, tk.END)
        for question in self._filtered_questions():
            decision = question["human_review"]["decision"]
            checked = "済" if question["human_review"]["checked_by_human"] else "未"
            decision_label = STATUS_LABELS.get(decision, decision)
            self.question_listbox.insert(tk.END, f"{question['id']} [{checked}/{decision_label}]")
        if self.question_listbox.size() > 0:
            pending_index = self._first_pending_filtered_index()
            initial_index = pending_index if pending_index is not None else 0
            self.question_listbox.selection_set(initial_index)
            self.question_listbox.see(initial_index)
        self._update_progress()

    def _update_progress(self) -> None:
        approved = sum(
            1
            for question in self.questions
            if question["human_review"]["checked_by_human"]
            and question["human_review"]["decision"] == "approved"
        )
        hold = sum(
            1
            for question in self.questions
            if question["human_review"]["checked_by_human"]
            and question["human_review"]["decision"] == "hold"
        )
        pending = sum(
            1 for question in self.questions if not question["human_review"]["checked_by_human"]
        )
        self.progress_var.set(f"承認 {approved} / 保留 {hold} / 未レビュー {pending}")

    def _first_pending_filtered_index(self) -> int | None:
        filtered = self._filtered_questions()
        for idx, question in enumerate(filtered):
            if not question["human_review"]["checked_by_human"]:
                return idx
        return None

    def _question_from_filtered_index(self, filtered_index: int) -> tuple[int, dict] | None:
        filtered = self._filtered_questions()
        if not filtered or filtered_index < 0 or filtered_index >= len(filtered):
            return None
        question = filtered[filtered_index]
        actual_index = next(i for i, item in enumerate(self.questions) if item["id"] == question["id"])
        return actual_index, question

    def _filtered_index_by_question_id(self, question_id: str) -> int | None:
        filtered = self._filtered_questions()
        for idx, question in enumerate(filtered):
            if question["id"] == question_id:
                return idx
        return None

    def _select_filtered_index(self, filtered_index: int) -> None:
        assert self.question_listbox is not None
        if self.question_listbox.size() == 0:
            return
        safe_index = max(0, min(self.question_listbox.size() - 1, filtered_index))
        self.question_listbox.selection_clear(0, tk.END)
        self.question_listbox.selection_set(safe_index)
        self.question_listbox.see(safe_index)
        self._load_question(safe_index)

    def _on_select_question(self, _event: object) -> None:
        assert self.question_listbox is not None
        selection = self.question_listbox.curselection()
        if not selection:
            return
        self._load_question(selection[0])

    def _load_question(self, filtered_index: int) -> None:
        resolved = self._question_from_filtered_index(filtered_index)
        if resolved is None:
            return
        self.current_index, question = resolved
        self._render_question(question)
        self._load_review_fields(question)
        dataset_label = _dataset_label(self.dataset_var.get())
        self.status_var.set(f"{dataset_label}: {question['id']} を表示中")

    def _render_question(self, question: dict) -> None:
        assert self.detail_text is not None
        lines = [
            f"ID: {question['id']}",
            f"カテゴリ: {question['category']} / {question['subtopic']}",
            "",
            "問題文:",
            question["question"],
            "",
            "選択肢:",
        ]
        for idx, choice in enumerate(question["choices"], start=1):
            marker = "  ← 正答" if idx - 1 == question["correct_index"] else ""
            lines.append(f"{idx}. {choice}{marker}")

        lines.extend(
            [
                "",
                "正答解説:",
                question["answer_reason"],
                "",
                "誤答解説:",
            ]
        )
        for idx, reason in enumerate(question["wrong_reasons"], start=1):
            if reason:
                lines.append(f"{idx}. {reason}")

        lines.extend(["", "覚え方:", question["memory_tip"], "", "根拠ソース:"])
        for source in question.get("sources", []):
            lines.append(f"- {source['title']} / {source['section']}")
            lines.append(f"  {source['url_or_location']}")

        assistant_review = question.get("assistant_review", {})
        if assistant_review:
            lines.extend(["", "アシスタント確認メモ:"])
            lines.append(f"- 推奨: {assistant_review.get('recommended_decision', '')}")
            for note in assistant_review.get("notes", []):
                lines.append(f"- {note}")

        self.detail_text.configure(state="normal")
        self.detail_text.delete("1.0", tk.END)
        self.detail_text.insert("1.0", "\n".join(lines))
        self.detail_text.configure(state="disabled")

    def _load_review_fields(self, question: dict) -> None:
        human_review = question["human_review"]
        tracker = self._find_row(self.tracker_rows, question["id"])

        self.decision_var.set(STORED_TO_DECISION.get(human_review["decision"], "承認"))
        self.source_ok_var.set((tracker or {}).get("source_confirmed", "true") == "true")
        self.answer_ok_var.set((tracker or {}).get("answer_checked", "true") == "true")
        self.wrong_ok_var.set((tracker or {}).get("wrong_reasons_checked", "true") == "true")
        self.wording_ok_var.set((tracker or {}).get("wording_checked", "true") == "true")

        note_lines = []
        if human_review.get("notes"):
            note_lines.append(human_review["notes"])
        if tracker and tracker.get("notes"):
            note_lines.append(f"既存メモ: {tracker['notes']}")

        assert self.notes_text is not None
        self.notes_text.delete("1.0", tk.END)
        self.notes_text.insert("1.0", "\n\n".join(note_lines))

    @staticmethod
    def _find_row(rows: list[dict], question_id: str) -> dict | None:
        return next((row for row in rows if row["id"] == question_id), None)

    def _save_current_review(self, *, move_next: bool = False, suppress_message: bool = False) -> bool:
        reviewer = self.reviewer_var.get().strip()
        reviewed_on = self.reviewed_on_var.get().strip()
        if not reviewer:
            messagebox.showwarning("入力不足", "レビュアー名を入力してください。")
            return False
        if not reviewed_on:
            messagebox.showwarning("入力不足", "レビュー日を入力してください。")
            return False

        question = self.questions[self.current_index]
        current_question_id = question["id"]
        next_question_id = (
            self._find_next_pending_or_next_id(current_question_id) if move_next else None
        )
        decision = DECISION_TO_STORED[self.decision_var.get()]

        assert self.notes_text is not None
        notes = self.notes_text.get("1.0", tk.END).strip()

        question["human_review"] = {
            "checked_by_human": True,
            "reviewer": reviewer,
            "reviewed_on": reviewed_on,
            "decision": decision,
            "notes": notes,
        }

        tracker = self._find_row(self.tracker_rows, question["id"])
        if tracker:
            tracker["source_confirmed"] = str(self.source_ok_var.get()).lower()
            tracker["answer_checked"] = str(self.answer_ok_var.get()).lower()
            tracker["wrong_reasons_checked"] = str(self.wrong_ok_var.get()).lower()
            tracker["wording_checked"] = str(self.wording_ok_var.get()).lower()
            tracker["reviewed_by"] = reviewer
            tracker["reviewed_on"] = reviewed_on
            tracker["status"] = decision
            tracker["notes"] = notes

        fill_row = self._find_row(self.fill_rows, question["id"])
        if fill_row:
            fill_row["human_decision"] = decision
            fill_row["reviewed_by"] = reviewer
            fill_row["reviewed_on"] = reviewed_on
            fill_row["human_notes"] = notes

        self._save_questions()
        self._save_csv(self.files.tracker_path, self.tracker_rows)
        self._save_csv(self.files.fill_template_path, self.fill_rows)
        self._refresh_question_list()
        self.status_var.set(f"{question['id']} を保存しました")
        if move_next:
            self._move_to_question_id_or_fallback(next_question_id, current_question_id)
        elif not suppress_message:
            messagebox.showinfo("保存完了", f"{question['id']} のレビュー結果を保存しました。")
        return True

    def _reload_all(self) -> None:
        self.questions = self._load_questions()
        self.tracker_rows = self._load_tracker_rows()
        self.fill_rows = self._load_fill_rows()
        self._refresh_question_list()
        initial_index = self._first_pending_filtered_index() or 0
        self._load_question(initial_index)
        dataset_label = _dataset_label(self.dataset_var.get())
        self.status_var.set(f"{dataset_label} を再読み込みしました")

    def _on_dataset_changed(self, _event: object) -> None:
        self.dataset_options = _dataset_options()
        self.files = self.dataset_options[self.dataset_var.get()]
        self._reset_publish_targets()
        self._reload_all()

    def _jump_to_pending(self) -> None:
        assert self.question_listbox is not None
        pending_index = self._first_pending_filtered_index()
        if pending_index is None:
            messagebox.showinfo("確認", "未レビュー問題は見つかりませんでした。")
            return
        self.question_listbox.selection_clear(0, tk.END)
        self.question_listbox.selection_set(pending_index)
        self.question_listbox.see(pending_index)
        self._load_question(pending_index)

    def _jump_to_same_subtopic_pending(self) -> None:
        assert self.question_listbox is not None
        current_question = self.questions[self.current_index]
        filtered = self._filtered_questions()
        for idx, question in enumerate(filtered):
            if (
                question["category"] == current_question["category"]
                and question["subtopic"] == current_question["subtopic"]
                and not question["human_review"]["checked_by_human"]
            ):
                self.question_listbox.selection_clear(0, tk.END)
                self.question_listbox.selection_set(idx)
                self.question_listbox.see(idx)
                self._load_question(idx)
                return
        messagebox.showinfo("確認", "同じサブトピックの未レビュー問題は見つかりませんでした。")

    def _find_next_pending_or_next_id(self, current_question_id: str) -> str | None:
        filtered = self._filtered_questions()
        current_index = next(
            (idx for idx, question in enumerate(filtered) if question["id"] == current_question_id),
            None,
        )
        if current_index is None:
            return None

        for question in filtered[current_index + 1 :]:
            if not question["human_review"]["checked_by_human"]:
                return question["id"]

        if current_index + 1 < len(filtered):
            return filtered[current_index + 1]["id"]
        return None

    def _move_to_question_id_or_fallback(
        self, target_question_id: str | None, previous_question_id: str
    ) -> None:
        if target_question_id is not None:
            target_index = self._filtered_index_by_question_id(target_question_id)
            if target_index is not None:
                self._select_filtered_index(target_index)
                return

        pending_index = self._first_pending_filtered_index()
        if pending_index is not None:
            self._select_filtered_index(pending_index)
            return

        previous_index = self._filtered_index_by_question_id(previous_question_id)
        if previous_index is not None:
            self._select_filtered_index(previous_index)
            return

        if self.question_listbox is not None and self.question_listbox.size() > 0:
            self._select_filtered_index(0)

    def _move_previous(self) -> None:
        assert self.question_listbox is not None
        selection = self.question_listbox.curselection()
        current = selection[0] if selection else 0
        next_index = max(0, current - 1)
        self.question_listbox.selection_clear(0, tk.END)
        self.question_listbox.selection_set(next_index)
        self.question_listbox.see(next_index)
        self._load_question(next_index)

    def _move_next(self) -> None:
        assert self.question_listbox is not None
        selection = self.question_listbox.curselection()
        current = selection[0] if selection else 0
        next_index = min(self.question_listbox.size() - 1, current + 1)
        self.question_listbox.selection_clear(0, tk.END)
        self.question_listbox.selection_set(next_index)
        self.question_listbox.see(next_index)
        self._load_question(next_index)

    def _approve_and_next(self) -> None:
        self.decision_var.set("承認")
        self._save_current_review(move_next=True, suppress_message=True)

    def _hold_and_next(self) -> None:
        self.decision_var.set("保留")
        self._save_current_review(move_next=True, suppress_message=True)

    def _bind_shortcuts(self) -> None:
        self.root.bind("<Control-Return>", lambda _event: self._approve_and_next())
        self.root.bind("<Control-h>", lambda _event: self._hold_and_next())

    def _bind_zoomable_text(self, widget: tk.Text, font_obj: tkfont.Font) -> None:
        widget.bind("<Control-MouseWheel>", lambda event: self._handle_text_zoom(event, font_obj))

    @staticmethod
    def _handle_text_zoom(event: tk.Event, font_obj: tkfont.Font) -> str:
        current_size = int(font_obj.cget("size"))
        if event.delta > 0:
            new_size = min(24, current_size + 1)
        else:
            new_size = max(8, current_size - 1)
        font_obj.configure(size=new_size)
        return "break"

    def _undo_notes(self, _event: tk.Event) -> str:
        assert self.notes_text is not None
        try:
            self.notes_text.edit_undo()
        except tk.TclError:
            pass
        return "break"

    def _redo_notes(self, _event: tk.Event) -> str:
        assert self.notes_text is not None
        try:
            self.notes_text.edit_redo()
        except tk.TclError:
            pass
        return "break"

    def _fetch_production_contact_messages(self, limit: int = 100) -> list[dict]:
        config = _load_contact_viewer_config()
        admin_token = config["admin_token"]
        if not admin_token:
            raise RuntimeError(
                "review_tool/contact_viewer_config.local.json に admin_token を設定してください。"
            )

        base_url = config["api_base_url"].rstrip("/")
        query = urllib_parse.urlencode({"limit": str(limit)})
        endpoint = f"{base_url}/api/secure/admin/contact-messages?{query}"
        request = urllib_request.Request(
            endpoint,
            headers={
                "x-admin-token": admin_token,
                "accept": "application/json",
                "accept-language": "ja,en-US;q=0.9,en;q=0.8",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "referer": "https://shiken-junbishitsu-chizai3.pages.dev/",
                "user-agent": CONTACT_VIEWER_USER_AGENT,
            },
            method="GET",
        )

        try:
            with urllib_request.urlopen(request, timeout=15) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib_error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            try:
                parsed = json.loads(detail)
            except json.JSONDecodeError:
                parsed = None

            if error.code == 403:
                message = "本番問い合わせAPIの呼び出しに失敗しました: HTTP 403。ADMIN_API_TOKEN が Worker 側と一致していません。"
                if isinstance(parsed, dict) and parsed.get("error"):
                    message += f"\n詳細: {parsed['error']}"
                raise RuntimeError(message) from error

            raise RuntimeError(f"本番問い合わせAPIの呼び出しに失敗しました: HTTP {error.code} {detail}") from error
        except urllib_error.URLError as error:
            raise RuntimeError(f"本番問い合わせAPIへ接続できませんでした: {error.reason}") from error

        messages = payload.get("messages")
        if not isinstance(messages, list):
            raise RuntimeError("本番問い合わせAPIのレスポンスが想定と異なります。")
        return [item for item in messages if isinstance(item, dict)]

    def _update_production_contact_status(self, message_id: str, status: str) -> dict:
        config = _load_contact_viewer_config()
        admin_token = config["admin_token"]
        if not admin_token:
            raise RuntimeError(
                "review_tool/contact_viewer_config.local.json に admin_token を設定してください。"
            )

        base_url = config["api_base_url"].rstrip("/")
        endpoint = f"{base_url}/api/secure/admin/contact-messages/status"
        payload = json.dumps({"id": message_id, "status": status}, ensure_ascii=False).encode("utf-8")
        request = urllib_request.Request(
            endpoint,
            data=payload,
            headers={
                "x-admin-token": admin_token,
                "accept": "application/json",
                "accept-language": "ja,en-US;q=0.9,en;q=0.8",
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "referer": "https://shiken-junbishitsu-chizai3.pages.dev/",
                "user-agent": CONTACT_VIEWER_USER_AGENT,
                "content-type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib_request.urlopen(request, timeout=15) as response:
                result = json.loads(response.read().decode("utf-8"))
        except urllib_error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"状態更新に失敗しました: HTTP {error.code} {detail}") from error
        except urllib_error.URLError as error:
            raise RuntimeError(f"状態更新APIへ接続できませんでした: {error.reason}") from error

        message = result.get("message")
        if not isinstance(message, dict):
            raise RuntimeError("状態更新APIのレスポンスが想定と異なります。")
        return message

    def _open_production_contact_viewer(self) -> None:
        if self.production_contact_window is not None and self.production_contact_window.winfo_exists():
            self.production_contact_window.deiconify()
            self.production_contact_window.lift()
            self._refresh_production_contact_viewer()
            return

        window = tk.Toplevel(self.root)
        window.title("本番問い合わせビューア")
        window.geometry("1040x700")
        window.minsize(900, 560)
        window.columnconfigure(0, weight=1)
        window.rowconfigure(1, weight=1)
        window.rowconfigure(2, weight=1)
        window.protocol("WM_DELETE_WINDOW", self._close_production_contact_viewer)
        self.production_contact_window = window

        top = ttk.Frame(window, padding=12)
        top.grid(row=0, column=0, sticky="ew")
        top.columnconfigure(0, weight=1)
        ttk.Label(top, text="本番問い合わせ概要").grid(row=0, column=0, sticky="w")
        ttk.Label(top, textvariable=self.production_contact_summary_var).grid(
            row=1, column=0, sticky="w", pady=(6, 0)
        )
        action_frame = ttk.Frame(top)
        action_frame.grid(row=0, column=1, rowspan=2, sticky="e")
        ttk.Button(action_frame, text="再読み込み", command=self._refresh_production_contact_viewer).grid(
            row=0, column=0, padx=(0, 6)
        )
        ttk.Button(action_frame, text="未対応へ戻す", command=lambda: self._set_selected_production_contact_status("new")).grid(
            row=0, column=1, padx=(0, 6)
        )
        ttk.Button(action_frame, text="対応中", command=lambda: self._set_selected_production_contact_status("in_progress")).grid(
            row=0, column=2, padx=(0, 6)
        )
        ttk.Button(action_frame, text="対応済み", command=lambda: self._set_selected_production_contact_status("done")).grid(
            row=0, column=3
        )

        list_frame = ttk.LabelFrame(window, text="本番問い合わせ", padding=8)
        list_frame.grid(row=1, column=0, sticky="nsew", padx=12)
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)
        contacts_tree = ttk.Treeview(
            list_frame,
            columns=("created_at", "name", "reply_email", "status"),
            show="headings",
            height=14,
        )
        contacts_tree.heading("created_at", text="受信日時")
        contacts_tree.heading("name", text="名前")
        contacts_tree.heading("reply_email", text="返信先")
        contacts_tree.heading("status", text="状態")
        contacts_tree.column("created_at", width=170, anchor="w")
        contacts_tree.column("name", width=120, anchor="w")
        contacts_tree.column("reply_email", width=220, anchor="w")
        contacts_tree.column("status", width=80, anchor="center")
        contacts_tree.grid(row=0, column=0, sticky="nsew")
        contact_scroll = ttk.Scrollbar(list_frame, orient="vertical", command=contacts_tree.yview)
        contact_scroll.grid(row=0, column=1, sticky="ns")
        contacts_tree.configure(yscrollcommand=contact_scroll.set)
        contacts_tree.bind("<<TreeviewSelect>>", self._on_production_contact_selected)
        self.production_contacts_tree = contacts_tree

        detail_frame = ttk.LabelFrame(window, text="問い合わせ詳細", padding=10)
        detail_frame.grid(row=2, column=0, sticky="nsew", padx=12, pady=(10, 12))
        detail_frame.columnconfigure(0, weight=1)
        detail_frame.rowconfigure(0, weight=1)
        detail_text = tk.Text(detail_frame, wrap="word", font=self.detail_font)
        detail_text.grid(row=0, column=0, sticky="nsew")
        detail_scroll = ttk.Scrollbar(detail_frame, orient="vertical", command=detail_text.yview)
        detail_scroll.grid(row=0, column=1, sticky="ns")
        detail_text.configure(yscrollcommand=detail_scroll.set, state="disabled")
        self._bind_zoomable_text(detail_text, self.detail_font)
        self.production_contact_detail_text = detail_text

        self._set_production_contact_detail_text("本番問い合わせを選ぶと、ここに詳細を表示します。")
        self._refresh_production_contact_viewer()

    def _close_production_contact_viewer(self) -> None:
        if self.production_contact_window is not None and self.production_contact_window.winfo_exists():
            self.production_contact_window.destroy()
        self.production_contact_window = None
        self.production_contacts_tree = None
        self.production_contact_detail_text = None

    def _refresh_production_contact_viewer(self) -> None:
        if self.production_contact_window is None or not self.production_contact_window.winfo_exists():
            return
        assert self.production_contacts_tree is not None

        try:
            messages = self._fetch_production_contact_messages(100)
        except Exception as error:
            self.production_contact_summary_var.set(str(error))
            self.production_contacts_tree.delete(*self.production_contacts_tree.get_children())
            self._set_production_contact_detail_text(
                "本番問い合わせの読み込みに失敗しました。\n\n"
                "contact_viewer_config.local.json と Worker 側の ADMIN_API_TOKEN を確認してください。"
            )
            return

        current_selection = self.production_contacts_tree.selection()
        selected_message_id = current_selection[0] if current_selection else None
        self.production_contact_summary_var.set(f"本番問い合わせ {len(messages)}件")

        self.production_contacts_tree.delete(*self.production_contacts_tree.get_children())
        for item in messages:
            message_id = str(item.get("id", ""))
            if not message_id:
                continue
            self.production_contacts_tree.insert(
                "",
                "end",
                iid=message_id,
                values=(
                    item.get("created_at", ""),
                    item.get("name", ""),
                    item.get("reply_email", ""),
                    item.get("status", ""),
                ),
            )

        if selected_message_id and self.production_contacts_tree.exists(selected_message_id):
            self.production_contacts_tree.selection_set(selected_message_id)
            self._render_production_contact_detail()
        else:
            self._set_production_contact_detail_text("本番問い合わせを選ぶと、ここに詳細を表示します。")

    def _on_production_contact_selected(self, _event: object) -> None:
        self._render_production_contact_detail()

    def _set_selected_production_contact_status(self, status: str) -> None:
        if self.production_contacts_tree is None:
            return
        selection = self.production_contacts_tree.selection()
        if not selection:
            messagebox.showwarning("対象なし", "状態を変更する問い合わせを選択してください。")
            return

        message_id = selection[0]
        try:
            updated_message = self._update_production_contact_status(message_id, status)
        except Exception as error:
            messagebox.showerror("更新失敗", str(error))
            return

        self.production_contact_summary_var.set(f"本番問い合わせの状態を更新しました: {updated_message.get('status', status)}")
        self._refresh_production_contact_viewer()
        if self.production_contacts_tree.exists(message_id):
            self.production_contacts_tree.selection_set(message_id)
            self._render_production_contact_detail()

    def _render_production_contact_detail(self) -> None:
        if self.production_contacts_tree is None or self.production_contact_detail_text is None:
            return
        selection = self.production_contacts_tree.selection()
        if not selection:
            return

        selected_id = selection[0]
        try:
            messages = self._fetch_production_contact_messages(100)
        except Exception as error:
            self._set_production_contact_detail_text(f"本番問い合わせの読み込みに失敗しました: {error}")
            return

        detail = next((item for item in messages if str(item.get("id", "")) == selected_id), None)
        if detail is None:
            self._set_production_contact_detail_text("選択した問い合わせが見つかりませんでした。")
            return

        lines = [
            f"id: {detail.get('id', '')}",
            f"受信日時: {detail.get('created_at', '')}",
            f"更新日時: {detail.get('updated_at', '')}",
            f"状態: {detail.get('status', '')}",
            f"名前: {detail.get('name', '')}",
            f"返信先: {detail.get('reply_email', '')}",
            f"送信元ページ: {detail.get('source_page', '') or '-'}",
            f"User-Agent: {detail.get('user_agent', '') or '-'}",
            "",
            "本文:",
            str(detail.get("message", "")),
        ]
        self._set_production_contact_detail_text("\n".join(lines))

    def _open_db_viewer(self) -> None:
        if self.db_viewer_window is not None and self.db_viewer_window.winfo_exists():
            self.db_viewer_window.deiconify()
            self.db_viewer_window.lift()
            self._refresh_db_viewer()
            return

        window = tk.Toplevel(self.root)
        window.title("配信用DBビューア")
        window.geometry("1180x760")
        window.minsize(1000, 640)
        window.columnconfigure(0, weight=1)
        window.rowconfigure(1, weight=1)
        window.rowconfigure(2, weight=1)
        window.protocol("WM_DELETE_WINDOW", self._close_db_viewer)
        self.db_viewer_window = window

        top = ttk.Frame(window, padding=12)
        top.grid(row=0, column=0, sticky="ew")
        top.columnconfigure(0, weight=1)
        ttk.Label(top, text="DB概要").grid(row=0, column=0, sticky="w")
        ttk.Label(top, textvariable=self.db_summary_var).grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Button(top, text="再読み込み", command=self._refresh_db_viewer).grid(row=0, column=1, rowspan=2, sticky="e")

        middle = ttk.Panedwindow(window, orient="horizontal")
        middle.grid(row=1, column=0, sticky="nsew", padx=12)

        set_frame = ttk.LabelFrame(middle, text="公開セット", padding=8)
        set_frame.columnconfigure(0, weight=1)
        set_frame.rowconfigure(0, weight=1)
        sets_tree = ttk.Treeview(
            set_frame,
            columns=("label", "tag", "visibility", "plan", "count"),
            show="headings",
            height=12,
        )
        sets_tree.heading("label", text="公開名")
        sets_tree.heading("tag", text="用途タグ")
        sets_tree.heading("visibility", text="公開")
        sets_tree.heading("plan", text="必要プラン")
        sets_tree.heading("count", text="問題数")
        sets_tree.column("label", width=280, anchor="w")
        sets_tree.column("tag", width=120, anchor="w")
        sets_tree.column("visibility", width=90, anchor="center")
        sets_tree.column("plan", width=110, anchor="center")
        sets_tree.column("count", width=70, anchor="e")
        sets_tree.grid(row=0, column=0, sticky="nsew")
        set_scroll = ttk.Scrollbar(set_frame, orient="vertical", command=sets_tree.yview)
        set_scroll.grid(row=0, column=1, sticky="ns")
        sets_tree.configure(yscrollcommand=set_scroll.set)
        sets_tree.bind("<<TreeviewSelect>>", self._on_db_set_selected)
        self.db_sets_tree = sets_tree
        middle.add(set_frame, weight=3)

        batch_frame = ttk.LabelFrame(middle, text="公開履歴", padding=8)
        batch_frame.columnconfigure(0, weight=1)
        batch_frame.rowconfigure(0, weight=1)
        batches_tree = ttk.Treeview(
            batch_frame,
            columns=("published_at", "dataset_key", "set_id", "count", "published_by"),
            show="headings",
            height=12,
        )
        batches_tree.heading("published_at", text="公開日時")
        batches_tree.heading("dataset_key", text="dataset")
        batches_tree.heading("set_id", text="set_id")
        batches_tree.heading("count", text="問題数")
        batches_tree.heading("published_by", text="公開者")
        batches_tree.column("published_at", width=180, anchor="w")
        batches_tree.column("dataset_key", width=140, anchor="w")
        batches_tree.column("set_id", width=160, anchor="w")
        batches_tree.column("count", width=70, anchor="e")
        batches_tree.column("published_by", width=100, anchor="w")
        batches_tree.grid(row=0, column=0, sticky="nsew")
        batch_scroll = ttk.Scrollbar(batch_frame, orient="vertical", command=batches_tree.yview)
        batch_scroll.grid(row=0, column=1, sticky="ns")
        batches_tree.configure(yscrollcommand=batch_scroll.set)
        self.db_batches_tree = batches_tree
        middle.add(batch_frame, weight=2)

        contact_frame = ttk.LabelFrame(middle, text="ローカル問い合わせ", padding=8)
        contact_frame.columnconfigure(0, weight=1)
        contact_frame.rowconfigure(0, weight=1)
        contacts_tree = ttk.Treeview(
            contact_frame,
            columns=("created_at", "name", "reply_email", "status"),
            show="headings",
            height=12,
        )
        contacts_tree.heading("created_at", text="受信日時")
        contacts_tree.heading("name", text="名前")
        contacts_tree.heading("reply_email", text="返信先")
        contacts_tree.heading("status", text="状態")
        contacts_tree.column("created_at", width=150, anchor="w")
        contacts_tree.column("name", width=120, anchor="w")
        contacts_tree.column("reply_email", width=180, anchor="w")
        contacts_tree.column("status", width=70, anchor="center")
        contacts_tree.grid(row=0, column=0, sticky="nsew")
        contact_scroll = ttk.Scrollbar(contact_frame, orient="vertical", command=contacts_tree.yview)
        contact_scroll.grid(row=0, column=1, sticky="ns")
        contacts_tree.configure(yscrollcommand=contact_scroll.set)
        contacts_tree.bind("<<TreeviewSelect>>", self._on_db_contact_selected)
        self.db_contacts_tree = contacts_tree
        middle.add(contact_frame, weight=2)

        detail_frame = ttk.LabelFrame(window, text="選択中項目の詳細", padding=10)
        detail_frame.grid(row=2, column=0, sticky="nsew", padx=12, pady=(10, 12))
        detail_frame.columnconfigure(0, weight=1)
        detail_frame.rowconfigure(1, weight=1)
        edit_frame = ttk.Frame(detail_frame)
        edit_frame.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        for col in range(9):
            edit_frame.columnconfigure(col, weight=1 if col in (1, 3, 5) else 0)

        ttk.Label(edit_frame, text="set_id").grid(row=0, column=0, sticky="w")
        ttk.Entry(
            edit_frame,
            textvariable=self.db_edit_set_id_var,
            state="readonly",
            width=22,
        ).grid(row=0, column=1, sticky="ew", padx=(6, 12))
        ttk.Label(edit_frame, text="公開名").grid(row=0, column=2, sticky="w")
        ttk.Entry(edit_frame, textvariable=self.db_edit_label_var, width=24).grid(
            row=0, column=3, sticky="ew", padx=(6, 12)
        )
        ttk.Label(edit_frame, text="用途タグ").grid(row=0, column=4, sticky="w")
        ttk.Entry(edit_frame, textvariable=self.db_edit_tag_var, width=18).grid(
            row=0, column=5, sticky="ew", padx=(6, 12)
        )
        ttk.Checkbutton(edit_frame, text="有効", variable=self.db_edit_active_var).grid(
            row=0, column=6, sticky="w"
        )
        ttk.Button(edit_frame, text="設定保存", command=self._save_db_set_settings).grid(
            row=0, column=7, sticky="e", padx=(8, 8)
        )
        ttk.Button(edit_frame, text="セット削除", command=self._delete_db_set).grid(
            row=0, column=8, sticky="e"
        )

        ttk.Label(edit_frame, text="紹介文").grid(row=1, column=0, sticky="w", pady=(8, 0))
        ttk.Entry(edit_frame, textvariable=self.db_edit_description_var, width=48).grid(
            row=1, column=1, columnspan=3, sticky="ew", padx=(6, 12), pady=(8, 0)
        )
        ttk.Label(edit_frame, text="公開").grid(row=1, column=4, sticky="w", pady=(8, 0))
        ttk.Combobox(
            edit_frame,
            textvariable=self.db_edit_visibility_var,
            values=("public", "private"),
            state="readonly",
            width=12,
        ).grid(row=1, column=5, sticky="w", padx=(6, 12), pady=(8, 0))
        ttk.Label(edit_frame, text="必要プラン").grid(row=1, column=6, sticky="w", pady=(8, 0))
        ttk.Combobox(
            edit_frame,
            textvariable=self.db_edit_plan_var,
            values=("free", "premium"),
            state="readonly",
            width=12,
        ).grid(row=1, column=7, sticky="w", pady=(8, 0))
        ttk.Checkbutton(
            edit_frame,
            text="プレミアム版に含める",
            variable=self.db_edit_include_in_premium_var,
        ).grid(row=2, column=0, columnspan=2, sticky="w", pady=(8, 0))
        ttk.Label(edit_frame, text="配信方式").grid(row=2, column=2, sticky="w", pady=(8, 0))
        ttk.Combobox(
            edit_frame,
            textvariable=self.db_edit_delivery_mode_var,
            values=("append_non_duplicate",),
            state="readonly",
            width=18,
        ).grid(row=2, column=3, sticky="w", padx=(6, 12), pady=(8, 0))

        detail_text = tk.Text(detail_frame, wrap="word", font=self.detail_font)
        detail_text.grid(row=1, column=0, sticky="nsew")
        detail_scroll = ttk.Scrollbar(detail_frame, orient="vertical", command=detail_text.yview)
        detail_scroll.grid(row=1, column=1, sticky="ns")
        detail_text.configure(yscrollcommand=detail_scroll.set, state="disabled")
        self._bind_zoomable_text(detail_text, self.detail_font)
        self.db_detail_text = detail_text

        self._set_db_detail_text("セットまたは問い合わせを選ぶと、ここに詳細を表示します。")
        self._refresh_db_viewer()

    def _close_db_viewer(self) -> None:
        if self.db_viewer_window is not None and self.db_viewer_window.winfo_exists():
            self.db_viewer_window.destroy()
        self.db_viewer_window = None
        self.db_sets_tree = None
        self.db_batches_tree = None
        self.db_contacts_tree = None
        self.db_detail_text = None

    def _refresh_db_viewer(self) -> None:
        if self.db_viewer_window is None or not self.db_viewer_window.winfo_exists():
            return
        assert self.db_sets_tree is not None
        assert self.db_batches_tree is not None
        assert self.db_contacts_tree is not None

        try:
            with connect_content_db(DEFAULT_DB_PATH) as connection:
                summary = load_db_summary(connection)
                sets = load_db_sets(connection)
                batches = load_db_batches(connection, 20)
                contacts = load_db_contact_messages(connection, 50)
        except Exception as error:
            self.db_summary_var.set(f"DBの読み込みに失敗しました: {error}")
            return

        self.db_summary_var.set(
            " / ".join(
                [
                    f"セット {summary['question_sets']}",
                    f"公開中 {summary['public_sets']}",
                    f"無料公開 {summary.get('public_free_sets', 0)}",
                    f"プレミアム公開 {summary.get('public_premium_sets', 0)}",
                    f"非公開 {summary.get('private_sets', 0)}",
                    f"問題 {summary['published_questions']}",
                    f"公開履歴 {summary['publish_batches']}",
                    f"ユーザー {summary.get('users', 0)}",
                    f"有効権利 {summary.get('active_entitlements', 0)}",
                    f"問い合わせ {summary.get('contact_messages', 0)}",
                    f"未対応 {summary.get('new_contact_messages', 0)}",
                    f"DB: {DEFAULT_DB_PATH.name}",
                ]
            )
        )

        current_selection = self.db_sets_tree.selection()
        selected_set_id = current_selection[0] if current_selection else None
        current_contact_selection = self.db_contacts_tree.selection()
        selected_contact_id = current_contact_selection[0] if current_contact_selection else None

        self.db_sets_tree.delete(*self.db_sets_tree.get_children())
        for item in sets:
            self.db_sets_tree.insert(
                "",
                "end",
                iid=item["set_id"],
                values=(
                    item["label"],
                    item["audience_tag"],
                    item["visibility"],
                    item["required_plan"],
                    item["question_count"],
                ),
            )

        self.db_batches_tree.delete(*self.db_batches_tree.get_children())
        for batch in batches:
            self.db_batches_tree.insert(
                "",
                "end",
                iid=batch["publish_id"],
                values=(
                    batch["published_at"],
                    batch["dataset_key"],
                    batch["set_id"],
                    batch["question_count"],
                    batch["published_by"],
                ),
            )

        self.db_contacts_tree.delete(*self.db_contacts_tree.get_children())
        for item in contacts:
            self.db_contacts_tree.insert(
                "",
                "end",
                iid=item["id"],
                values=(
                    item["created_at"],
                    item["name"],
                    item["reply_email"],
                    item["status"],
                ),
            )

        if selected_contact_id and self.db_contacts_tree.exists(selected_contact_id):
            self.db_contacts_tree.selection_set(selected_contact_id)
            self._render_db_contact_detail()
        elif selected_set_id and self.db_sets_tree.exists(selected_set_id):
            self.db_sets_tree.selection_set(selected_set_id)
            self._render_db_set_detail()
        else:
            self._clear_db_set_edit_fields()
            self._set_db_detail_text("セットまたは問い合わせを選ぶと、ここに詳細を表示します。")

    def _on_db_set_selected(self, _event: object) -> None:
        if self.db_contacts_tree is not None:
            self.db_contacts_tree.selection_remove(self.db_contacts_tree.selection())
        self._render_db_set_detail()

    def _on_db_contact_selected(self, _event: object) -> None:
        if self.db_sets_tree is not None:
            self.db_sets_tree.selection_remove(self.db_sets_tree.selection())
        self._render_db_contact_detail()

    def _render_db_set_detail(self) -> None:
        if self.db_sets_tree is None or self.db_detail_text is None:
            return
        selection = self.db_sets_tree.selection()
        if not selection:
            return
        set_id = selection[0]
        try:
            with connect_content_db(DEFAULT_DB_PATH) as connection:
                detail = load_db_set_detail(connection, set_id)
        except Exception as error:
            self._set_db_detail_text(f"詳細の読み込みに失敗しました: {error}")
            return

        set_info = detail["set"]
        premium_membership = get_db_premium_plan_membership(set_info["set_id"])
        self.db_edit_set_id_var.set(set_info["set_id"])
        self.db_edit_label_var.set(set_info["label"])
        self.db_edit_tag_var.set(set_info["audience_tag"])
        self.db_edit_description_var.set(set_info["short_description"])
        self.db_edit_visibility_var.set(set_info["visibility"])
        self.db_edit_plan_var.set(set_info["required_plan"])
        self.db_edit_active_var.set(bool(set_info["is_active"]))
        self.db_edit_include_in_premium_var.set(bool(premium_membership["included"]))
        self.db_edit_delivery_mode_var.set(premium_membership["delivery_mode"])
        lines = [
            f"set_id: {set_info['set_id']}",
            f"公開名: {set_info['label']}",
            f"用途タグ: {set_info['audience_tag']}",
            f"紹介文: {set_info['short_description']}",
            f"級: {set_info['level']}",
            f"公開: {set_info['visibility']}",
            f"必要プラン: {set_info['required_plan']}",
            f"プレミアム版に含める: {'yes' if premium_membership['included'] else 'no'}",
            f"配信方式: {premium_membership['delivery_mode']}",
            f"source_dataset: {set_info['source_dataset_key']}",
            f"published_at: {set_info['published_at']}",
            "",
            "問題一覧:",
        ]
        for item in detail["questions"]:
            lines.append(
                f"{item['sort_order']:>3}. {item['question_id']} | {item['category']} / {item['subtopic']} | "
                f"{item['status']} | {item['prompt_preview']}"
            )
        lines.append("")
        lines.append("登録済み内容:")
        for item in detail["questions"]:
            lines.append("")
            lines.append(f"[{item['sort_order']:>3}] {item['question_id']}")
            lines.append(f"分類: {item['category']} / {item['subtopic']}")
            lines.append(f"問題文: {item['prompt']}")
            for idx, option in enumerate(item["options"], start=1):
                marker = "  正答" if idx - 1 == item["answer_index"] else "  選択肢"
                lines.append(f"{marker}{idx}: {option}")
                option_reason = item["option_explanations"][idx - 1]
                if option_reason:
                    lines.append(f"    理由: {option_reason}")
            lines.append(f"解説: {item['explanation']}")
            lines.append(f"記憶メモ: {item['memory_tip']}")
        self._set_db_detail_text("\n".join(lines))

    def _render_db_contact_detail(self) -> None:
        if self.db_contacts_tree is None or self.db_detail_text is None:
            return
        selection = self.db_contacts_tree.selection()
        if not selection:
            return
        message_id = selection[0]
        try:
            with connect_content_db(DEFAULT_DB_PATH) as connection:
                detail = load_db_contact_message_detail(connection, message_id)
        except Exception as error:
            self._set_db_detail_text(f"お問い合わせの読み込みに失敗しました: {error}")
            return

        self._clear_db_set_edit_fields()
        lines = [
            f"id: {detail['id']}",
            f"受信日時: {detail['created_at']}",
            f"更新日時: {detail['updated_at']}",
            f"状態: {detail['status']}",
            f"名前: {detail['name']}",
            f"返信先: {detail['reply_email']}",
            f"送信元ページ: {detail['source_page'] or '-'}",
            f"User-Agent: {detail['user_agent'] or '-'}",
            "",
            "本文:",
            detail["message"],
        ]
        self._set_db_detail_text("\n".join(lines))

    def _save_db_set_settings(self) -> None:
        set_id = self.db_edit_set_id_var.get().strip()
        if not set_id:
            messagebox.showwarning("対象なし", "編集対象のセットが選択されていません。")
            return
        try:
            with connect_content_db(DEFAULT_DB_PATH) as connection:
                update_db_set_settings(
                    connection,
                    set_id=set_id,
                    label=self.db_edit_label_var.get().strip(),
                    short_description=self.db_edit_description_var.get().strip(),
                    audience_tag=self.db_edit_tag_var.get().strip(),
                    visibility=self.db_edit_visibility_var.get().strip() or "private",
                    required_plan=self.db_edit_plan_var.get().strip() or "premium",
                    is_active=self.db_edit_active_var.get(),
                )
                connection.commit()
            update_db_premium_plan_membership(
                set_id,
                include=self.db_edit_include_in_premium_var.get(),
                delivery_mode=self.db_edit_delivery_mode_var.get().strip() or "append_non_duplicate",
            )
        except Exception as error:
            messagebox.showerror("保存失敗", f"DBセット設定の保存に失敗しました。\n{error}")
            return

        self.status_var.set(f"{set_id} のDB設定を更新しました")
        self._refresh_db_viewer()
        messagebox.showinfo("保存完了", f"{set_id} のDB設定を更新しました。")

    def _delete_db_set(self) -> None:
        set_id = self.db_edit_set_id_var.get().strip()
        if not set_id:
            messagebox.showwarning("対象なし", "削除対象のセットが選択されていません。")
            return
        if not messagebox.askyesno(
            "削除確認",
            f"{set_id} をDBから削除します。\n"
            "セット情報・公開履歴・セット内リンクを削除し、他セットで使っていない問題は公開問題テーブルからも削除します。\n"
            "続けますか。",
        ):
            return
        try:
            with connect_content_db(DEFAULT_DB_PATH) as connection:
                result = delete_db_set(connection, set_id)
                connection.commit()
            update_db_premium_plan_membership(set_id, include=False)
        except Exception as error:
            messagebox.showerror("削除失敗", f"DBセット削除に失敗しました。\n{error}")
            return

        self.status_var.set(f"{set_id} をDBから削除しました")
        self._refresh_db_viewer()
        self._set_db_detail_text(f"{set_id} を削除しました。")
        self._clear_db_set_edit_fields()
        messagebox.showinfo(
            "削除完了",
            f"{set_id} を削除しました。\n"
            f"問題リンク削除: {result['question_links_deleted']}\n"
            f"公開履歴削除: {result['publish_batches_deleted']}\n"
            f"孤立問題削除: {result['orphan_questions_deleted']}",
        )

    def _clear_db_set_edit_fields(self) -> None:
        self.db_edit_set_id_var.set("")
        self.db_edit_label_var.set("")
        self.db_edit_tag_var.set("")
        self.db_edit_description_var.set("")
        self.db_edit_visibility_var.set("private")
        self.db_edit_plan_var.set("premium")
        self.db_edit_active_var.set(True)
        self.db_edit_include_in_premium_var.set(False)
        self.db_edit_delivery_mode_var.set("append_non_duplicate")

    def _set_db_detail_text(self, text: str) -> None:
        if self.db_detail_text is None:
            return
        self.db_detail_text.configure(state="normal")
        self.db_detail_text.delete("1.0", tk.END)
        self.db_detail_text.insert("1.0", text)
        self.db_detail_text.configure(state="disabled")

    def _set_production_contact_detail_text(self, text: str) -> None:
        if self.production_contact_detail_text is None:
            return
        self.production_contact_detail_text.configure(state="normal")
        self.production_contact_detail_text.delete("1.0", tk.END)
        self.production_contact_detail_text.insert("1.0", text)
        self.production_contact_detail_text.configure(state="disabled")

    @staticmethod
    def _to_quiz_question(question: dict) -> dict:
        return {
            "id": question["id"],
            "level": question["level"],
            "category": question["category"],
            "subtopic": question["subtopic"],
            "prompt": question["question"],
            "options": question["choices"],
            "answer_index": question["correct_index"],
            "explanation": question["answer_reason"],
            "option_explanations": question["wrong_reasons"],
            "memory_tip": question["memory_tip"],
            "review_state": {
                "ai_first_pass": question.get("ai_first_pass", {}).get("overall_verdict", "pending"),
                "human_review": question.get("human_review", {}).get("decision", "draft"),
            },
        }

    def _publish_approved_to_db(self) -> None:
        dataset_key = self.dataset_var.get()
        dataset_label = _dataset_label(dataset_key)
        publish_set_id = self.publish_set_id_var.get().strip()
        publish_label = self.publish_label_var.get().strip()
        publish_description = self.publish_description_var.get().strip()
        publish_tag = self.publish_tag_var.get().strip()
        publish_visibility = self.publish_visibility_var.get().strip() or "private"
        publish_plan = self.publish_plan_var.get().strip() or "premium"
        publish_include_in_premium = self.publish_include_in_premium_var.get()
        publish_delivery_mode = self.publish_delivery_mode_var.get().strip() or "append_non_duplicate"

        if not publish_set_id:
            messagebox.showwarning("入力不足", "publish 用の set_id を入力してください。")
            return
        if not publish_label:
            messagebox.showwarning("入力不足", "publish 用の公開名を入力してください。")
            return
        if not publish_description:
            messagebox.showwarning("入力不足", "publish 用の紹介文を入力してください。")
            return
        if not publish_tag:
            messagebox.showwarning("入力不足", "publish 用の用途タグを入力してください。")
            return

        try:
            result = publish_dataset(
                dataset_key=dataset_key,
                db_path=DEFAULT_DB_PATH,
                published_by=self.reviewer_var.get().strip() or "review_tool",
                notes=(
                    f"{dataset_label} を review_tool から publish "
                    f"(visibility={publish_visibility}, required_plan={publish_plan})"
                ),
                set_id=publish_set_id,
                set_label=publish_label,
                short_description=publish_description,
                audience_tag=publish_tag,
                visibility=publish_visibility,
                required_plan=publish_plan,
            )
        except ValueError as error:
            messagebox.showwarning("反映不可", str(error))
            return
        except Exception as error:
            messagebox.showerror("反映失敗", f"DB反映に失敗しました。\n{error}")
            return

        if publish_plan == "premium":
            try:
                update_db_premium_plan_membership(
                    result.set_id,
                    include=publish_include_in_premium,
                    delivery_mode=publish_delivery_mode,
                )
            except Exception as error:
                messagebox.showerror(
                    "プレミアム設定失敗",
                    f"DB反映は完了しましたが、プレミアム版設定の更新に失敗しました。\n{error}",
                )
                return

        self.status_var.set(
            f"{dataset_label} の承認済み {result.question_count}問を DB に反映しました"
        )
        messagebox.showinfo(
            "反映完了",
            f"{dataset_label} の承認済み {result.question_count}問を\n"
            f"{result.db_path.name} に反映しました。\n"
            f"set_id: {result.set_id}\n"
            f"tag: {publish_tag}\n"
            f"visibility: {publish_visibility}\n"
            f"required_plan: {publish_plan}\n"
            f"premium_include: {'yes' if publish_include_in_premium else 'no'}\n"
            f"delivery_mode: {publish_delivery_mode}",
        )


def main() -> None:
    root = tk.Tk()
    style = ttk.Style()
    if "vista" in style.theme_names():
        style.theme_use("vista")
    app = ReviewApp(root)
    root.minsize(1200, 720)
    root.mainloop()


if __name__ == "__main__":
    main()
