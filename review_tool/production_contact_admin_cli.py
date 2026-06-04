from __future__ import annotations

import argparse
import json
import os
import textwrap
from pathlib import Path
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "contact_viewer_config.local.json"
DEFAULT_API_BASE = "https://chizai-kentei-secure-api.henohenomoheji1202apps.workers.dev"
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)
ALLOWED_STATUSES = {"new", "in_progress", "done"}


def load_config() -> dict[str, str]:
    api_base_url = os.environ.get("CONTACT_VIEWER_API_BASE", "").strip()
    admin_token = os.environ.get("CONTACT_VIEWER_ADMIN_TOKEN", "").strip()

    if CONFIG_PATH.exists():
        payload = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        api_base_url = str(payload.get("api_base_url") or api_base_url).strip()
        admin_token = str(payload.get("admin_token") or admin_token).strip()

    return {
        "api_base_url": api_base_url or DEFAULT_API_BASE,
        "admin_token": admin_token,
    }


def build_headers(*, admin_token: str, content_type: str | None = None) -> dict[str, str]:
    headers = {
        "x-admin-token": admin_token,
        "accept": "application/json",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "referer": "https://shiken-junbishitsu-chizai3.pages.dev/",
        "user-agent": DEFAULT_USER_AGENT,
    }
    if content_type:
        headers["content-type"] = content_type
    return headers


def fetch_contact_messages(
    base_url: str,
    admin_token: str,
    limit: int,
    *,
    status: str = "",
    contains: str = "",
    message_id: str = "",
) -> list[dict]:
    query_params = {"limit": str(limit)}
    if status:
        query_params["status"] = status
    if contains:
        query_params["q"] = contains
    if message_id:
        query_params["id"] = message_id

    endpoint = f"{base_url.rstrip('/')}/api/secure/admin/contact-messages?{urllib_parse.urlencode(query_params)}"
    req = urllib_request.Request(endpoint, headers=build_headers(admin_token=admin_token), method="GET")
    try:
        with urllib_request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"本番問い合わせAPIの呼び出しに失敗しました: HTTP {error.code} {detail}") from error
    except urllib_error.URLError as error:
        raise RuntimeError(f"本番問い合わせAPIへ接続できませんでした: {error.reason}") from error

    messages = payload.get("messages")
    if not isinstance(messages, list):
        raise RuntimeError("本番問い合わせAPIのレスポンスが想定と異なります。")
    return [item for item in messages if isinstance(item, dict)]


def update_contact_status(base_url: str, admin_token: str, message_id: str, status: str) -> dict:
    endpoint = f"{base_url.rstrip('/')}/api/secure/admin/contact-messages/status"
    body = json.dumps({"id": message_id, "status": status}, ensure_ascii=False).encode("utf-8")
    req = urllib_request.Request(
        endpoint,
        data=body,
        headers=build_headers(admin_token=admin_token, content_type="application/json"),
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"状態更新に失敗しました: HTTP {error.code} {detail}") from error
    except urllib_error.URLError as error:
        raise RuntimeError(f"状態更新APIへ接続できませんでした: {error.reason}") from error

    message = payload.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("状態更新APIのレスポンスが想定と異なります。")
    return message


def require_contact(messages: list[dict], message_id: str) -> dict:
    for item in messages:
        if str(item.get("id", "")) == message_id:
            return item
    raise RuntimeError(f"id={message_id} の問い合わせが見つかりませんでした。")


def format_contact_summary(item: dict) -> str:
    return " | ".join(
        [
            str(item.get("created_at", "")),
            str(item.get("status", "")),
            str(item.get("name", "")),
            str(item.get("reply_email", "")),
            str(item.get("id", "")),
        ]
    )


def format_contact_detail(item: dict) -> str:
    lines = [
        f"id: {item.get('id', '')}",
        f"受信日時: {item.get('created_at', '')}",
        f"更新日時: {item.get('updated_at', '')}",
        f"状態: {item.get('status', '')}",
        f"名前: {item.get('name', '')}",
        f"返信先: {item.get('reply_email', '')}",
        f"送信元ページ: {item.get('source_page', '') or '-'}",
        f"User-Agent: {item.get('user_agent', '') or '-'}",
        "",
        "本文:",
        str(item.get("message", "")),
    ]
    return "\n".join(lines)


def build_reply_draft(item: dict) -> str:
    recipient_name = str(item.get("name", "")).strip() or "ご利用者さま"
    reply_email = str(item.get("reply_email", "")).strip()
    message_body = str(item.get("message", "")).strip()
    return textwrap.dedent(
        f"""\
        返信先: {reply_email}
        件名案: お問い合わせありがとうございます | しけん準備室

        {recipient_name} 様

        しけん準備室 知財3級対策へのお問い合わせありがとうございます。
        内容を確認しました。

        受信内容:
        {message_body}

        返信メモ:
        - ここに回答内容を追記
        - 返金やキャンセルの場合は refund_operation_steps.md を確認
        - 対応開始時は in_progress、完了後は done へ更新
        """
    ).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="本番問い合わせの確認・状態更新・返信メモ作成を行うCLIです。")
    subparsers = parser.add_subparsers(dest="command", required=True)

    list_parser = subparsers.add_parser("list", help="最近の問い合わせ一覧を表示")
    list_parser.add_argument("--limit", type=int, default=20, help="表示件数")
    list_parser.add_argument("--status", choices=sorted(ALLOWED_STATUSES), default="", help="状態で絞り込む")
    list_parser.add_argument("--contains", default="", help="本文・名前・返信先・送信元ページで部分一致検索")

    show_parser = subparsers.add_parser("show", help="問い合わせ詳細を表示")
    show_parser.add_argument("id", help="問い合わせID")
    show_parser.add_argument("--limit", type=int, default=100, help="取得件数")

    update_parser = subparsers.add_parser("status", help="問い合わせ状態を更新")
    update_parser.add_argument("id", help="問い合わせID")
    update_parser.add_argument("status", choices=sorted(ALLOWED_STATUSES), help="更新先の状態")

    draft_parser = subparsers.add_parser("reply-draft", help="返信メモのたたき台を出力")
    draft_parser.add_argument("id", help="問い合わせID")
    draft_parser.add_argument("--limit", type=int, default=100, help="取得件数")

    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config()
    admin_token = config["admin_token"]
    if not admin_token:
        raise SystemExit("contact_viewer_config.local.json または CONTACT_VIEWER_ADMIN_TOKEN を設定してください。")

    base_url = config["api_base_url"].rstrip("/")

    if args.command == "list":
        messages = fetch_contact_messages(
            base_url,
            admin_token,
            max(1, args.limit),
            status=args.status,
            contains=args.contains,
        )
        print("created_at | status | name | reply_email | id")
        for item in messages:
            print(format_contact_summary(item))
        return

    if args.command == "show":
        messages = fetch_contact_messages(base_url, admin_token, max(1, args.limit), message_id=args.id)
        item = require_contact(messages, args.id)
        print(format_contact_detail(item))
        return

    if args.command == "status":
        updated = update_contact_status(base_url, admin_token, args.id, args.status)
        print("状態を更新しました。")
        print(format_contact_detail(updated))
        return

    if args.command == "reply-draft":
        messages = fetch_contact_messages(base_url, admin_token, max(1, args.limit), message_id=args.id)
        item = require_contact(messages, args.id)
        print(build_reply_draft(item))
        return

    raise SystemExit(f"unsupported command: {args.command}")


if __name__ == "__main__":
    main()
