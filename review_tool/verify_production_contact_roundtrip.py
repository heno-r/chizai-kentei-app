from __future__ import annotations

import argparse
import json
import os
import time
from datetime import datetime, timezone
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


def build_headers(*, admin_token: str | None = None, content_type: str | None = None) -> dict[str, str]:
    headers = {
        "accept": "application/json",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "referer": "https://shiken-junbishitsu-chizai3.pages.dev/",
        "user-agent": DEFAULT_USER_AGENT,
    }
    if admin_token:
        headers["x-admin-token"] = admin_token
    if content_type:
        headers["content-type"] = content_type
    return headers


def post_public_contact(base_url: str, *, name: str, reply_email: str, message: str, source_page: str) -> dict:
    endpoint = f"{base_url.rstrip('/')}/api/public/contact"
    payload = json.dumps(
        {
            "name": name,
            "reply_email": reply_email,
            "message": message,
            "source_page": source_page,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib_request.Request(
        endpoint,
        data=payload,
        headers=build_headers(content_type="application/json"),
        method="POST",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_contact_messages(base_url: str, admin_token: str, limit: int) -> list[dict]:
    endpoint = f"{base_url.rstrip('/')}/api/secure/admin/contact-messages?{urllib_parse.urlencode({'limit': str(limit)})}"
    request = urllib_request.Request(
        endpoint,
        headers=build_headers(admin_token=admin_token),
        method="GET",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    messages = payload.get("messages")
    if not isinstance(messages, list):
        raise RuntimeError("contact messages response format was unexpected")
    return [item for item in messages if isinstance(item, dict)]


def update_contact_status(base_url: str, admin_token: str, message_id: str, status: str) -> dict:
    endpoint = f"{base_url.rstrip('/')}/api/secure/admin/contact-messages/status"
    payload = json.dumps({"id": message_id, "status": status}, ensure_ascii=False).encode("utf-8")
    request = urllib_request.Request(
        endpoint,
        data=payload,
        headers=build_headers(admin_token=admin_token, content_type="application/json"),
        method="POST",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        payload_json = json.loads(response.read().decode("utf-8"))
    message = payload_json.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("contact status update response format was unexpected")
    return message


def find_message(messages: list[dict], marker: str) -> dict | None:
    for item in messages:
        body = str(item.get("message", ""))
        if marker in body:
            return item
    return None


def build_marker() -> str:
    return datetime.now(timezone.utc).strftime("roundtrip-%Y%m%dT%H%M%SZ")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Send a test contact message and verify it appears in the admin contact API.")
    parser.add_argument("--name", default="確認テスト", help="Name to send in the contact form")
    parser.add_argument("--reply-email", default="", help="Reply email to send. Default is generated automatically.")
    parser.add_argument("--source-page", default="/contact/?roundtrip_test=1", help="source_page value to store")
    parser.add_argument("--poll-seconds", type=int, default=20, help="How long to wait for the message to appear")
    parser.add_argument("--poll-interval", type=float, default=2.0, help="Polling interval in seconds")
    parser.add_argument("--limit", type=int, default=20, help="How many recent messages to fetch when checking")
    parser.add_argument(
        "--mark-status",
        choices=sorted(ALLOWED_STATUSES),
        default="",
        help="Optional status to set after the message is found",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    config = load_config()
    base_url = config["api_base_url"].rstrip("/")
    admin_token = config["admin_token"]

    if not admin_token:
        raise SystemExit("contact_viewer_config.local.json or CONTACT_VIEWER_ADMIN_TOKEN is required")

    marker = build_marker()
    reply_email = args.reply_email or f"{marker}@example.invalid"
    message = (
        "お問い合わせ送信と管理側確認の往復テストです。\n"
        f"marker: {marker}\n"
        "このメッセージは確認後に done へ更新して構いません。"
    )

    print(f"api_base_url={base_url}")
    print(f"marker={marker}")
    print(f"reply_email={reply_email}")

    try:
        submit_result = post_public_contact(
            base_url,
            name=args.name,
            reply_email=reply_email,
            message=message,
            source_page=args.source_page,
        )
        print("submit_result=" + json.dumps(submit_result, ensure_ascii=False))
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"contact submit failed: HTTP {error.code} {detail}") from error
    except urllib_error.URLError as error:
        raise SystemExit(f"contact submit failed: {error.reason}") from error

    deadline = time.time() + max(1, args.poll_seconds)
    found_message: dict | None = None
    last_seen_count = 0

    while time.time() <= deadline:
        try:
            messages = fetch_contact_messages(base_url, admin_token, args.limit)
        except urllib_error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise SystemExit(f"contact fetch failed: HTTP {error.code} {detail}") from error
        except urllib_error.URLError as error:
            raise SystemExit(f"contact fetch failed: {error.reason}") from error

        last_seen_count = len(messages)
        found_message = find_message(messages, marker)
        if found_message:
            break
        time.sleep(max(0.2, args.poll_interval))

    if not found_message:
        raise SystemExit(
            f"roundtrip check failed: marker was not found in the latest {last_seen_count} messages "
            f"within {args.poll_seconds} seconds"
        )

    print("found_message=" + json.dumps(found_message, ensure_ascii=False))

    if args.mark_status:
        updated = update_contact_status(base_url, admin_token, str(found_message.get("id", "")), args.mark_status)
        print("updated_message=" + json.dumps(updated, ensure_ascii=False))

    print("roundtrip check passed")


if __name__ == "__main__":
    main()
