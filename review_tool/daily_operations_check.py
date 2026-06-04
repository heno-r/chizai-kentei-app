from __future__ import annotations

import json
import os
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request


BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "contact_viewer_config.local.json"
DEFAULT_SITE_URL = "https://shiken-junbishitsu-chizai3.pages.dev"
DEFAULT_API_BASE = "https://chizai-kentei-secure-api.henohenomoheji1202apps.workers.dev"
REPORT_PATH = BASE_DIR / "daily_operations_report.local.txt"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/136.0.0.0 Safari/537.36"
)


def load_contact_viewer_config() -> dict[str, str]:
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


def http_get_json(url: str, *, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = urllib_request.Request(
        url,
        headers={
            "accept": "application/json",
            "accept-language": "ja,en-US;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "user-agent": USER_AGENT,
            **(headers or {}),
        },
        method="GET",
    )
    with urllib_request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def http_get_status(url: str) -> tuple[int | None, str]:
    request = urllib_request.Request(
        url,
        headers={
            "accept-language": "ja,en-US;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "user-agent": USER_AGENT,
        },
        method="GET",
    )
    try:
        with urllib_request.urlopen(request, timeout=20) as response:
            return response.status, "ok"
    except urllib_error.HTTPError as error:
        return error.code, f"http error: {error.reason}"
    except urllib_error.URLError as error:
        return None, f"url error: {error.reason}"


def fetch_contact_messages() -> tuple[list[dict[str, Any]], str | None]:
    config = load_contact_viewer_config()
    admin_token = config["admin_token"]
    if not admin_token:
        return [], "admin_token is empty"

    base_url = config["api_base_url"].rstrip("/")
    endpoint = f"{base_url}/api/secure/admin/contact-messages?{urllib_parse.urlencode({'limit': '50'})}"
    try:
        payload = http_get_json(
            endpoint,
            headers={
                "referer": f"{DEFAULT_SITE_URL}/",
                "x-admin-token": admin_token,
            },
        )
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        return [], f"HTTP {error.code}: {detail}"
    except urllib_error.URLError as error:
        return [], f"URL error: {error.reason}"
    except Exception as error:  # pragma: no cover - defensive
        return [], str(error)

    messages = payload.get("messages")
    if not isinstance(messages, list):
        return [], "response does not contain messages"
    return [item for item in messages if isinstance(item, dict)], None


def render_contact_summary(messages: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    counter = Counter(str(item.get("status", "unknown")) for item in messages)
    lines.append(
        "問い合わせ: "
        + ", ".join(
            [
                f"total={len(messages)}",
                f"new={counter.get('new', 0)}",
                f"in_progress={counter.get('in_progress', 0)}",
                f"done={counter.get('done', 0)}",
            ]
        )
    )

    if not messages:
        lines.append("  - 問い合わせはまだありません")
        return lines

    lines.append("未対応・対応中の最新:")
    visible = 0
    for item in messages:
        status = str(item.get("status", ""))
        if status not in {"new", "in_progress"}:
            continue
        lines.append(
            f"  - [{status}] {item.get('created_at', '')} | "
            f"{item.get('name', '')} | {item.get('reply_email', '')} | "
            f"{str(item.get('message', '')).strip()[:50]}"
        )
        visible += 1
        if visible >= 5:
            break

    if visible == 0:
        lines.append("  - 未対応または対応中の問い合わせはありません")
    return lines


def render_site_health() -> list[str]:
    urls = [
        DEFAULT_SITE_URL,
        f"{DEFAULT_SITE_URL}/app/",
        f"{DEFAULT_SITE_URL}/premium/ready/",
        f"{DEFAULT_SITE_URL}/contact/",
    ]
    lines = ["公開サイト疎通:"]
    for url in urls:
        status, detail = http_get_status(url)
        lines.append(f"  - {url} -> {status or '-'} ({detail})")
    return lines


def render_secure_api_health() -> list[str]:
    config = load_contact_viewer_config()
    base_url = config["api_base_url"].rstrip("/")
    endpoint = f"{base_url}/api/secure/health"
    try:
        payload = http_get_json(endpoint)
        return [f"secure API: ok ({payload.get('service', '-')}, {payload.get('timestamp', '-')})"]
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        return [f"secure API: HTTP {error.code} {detail}"]
    except urllib_error.URLError as error:
        return [f"secure API: URL error {error.reason}"]


def main() -> None:
    report_lines = [
        f"daily operations check",
        f"generated_at={datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]

    messages, contact_error = fetch_contact_messages()
    if contact_error:
        report_lines.append(f"問い合わせ: error ({contact_error})")
    else:
        report_lines.extend(render_contact_summary(messages))
    report_lines.append("")
    report_lines.extend(render_site_health())
    report_lines.append("")
    report_lines.extend(render_secure_api_health())
    report_lines.append("")
    report_lines.append("手動確認:")
    report_lines.append("  - Stripe Dashboard で失敗決済や返金対応がないか")
    report_lines.append("  - 重要な問い合わせに返信漏れがないか")

    report_text = "\n".join(report_lines) + "\n"
    print(report_text, end="")
    REPORT_PATH.write_text(report_text, encoding="utf-8")
    print(f"report_path={REPORT_PATH}")


if __name__ == "__main__":
    main()
