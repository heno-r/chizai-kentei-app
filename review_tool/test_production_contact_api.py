from __future__ import annotations

import json
import os
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


def load_config() -> dict:
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


def main() -> None:
    config = load_config()
    base_url = config["api_base_url"].rstrip("/")
    admin_token = config["admin_token"]

    print(f"config_path={CONFIG_PATH}")
    print(f"api_base_url={base_url}")
    print(f"admin_token_length={len(admin_token)}")

    if not admin_token:
        print("admin_token is empty")
        raise SystemExit(1)

    endpoint = f"{base_url}/api/secure/admin/contact-messages?{urllib_parse.urlencode({'limit': '3'})}"
    print(f"request_url={endpoint}")

    request = urllib_request.Request(
        endpoint,
        headers={
            "x-admin-token": admin_token,
            "accept": "application/json",
            "accept-language": "ja,en-US;q=0.9,en;q=0.8",
            "cache-control": "no-cache",
            "pragma": "no-cache",
            "referer": "https://shiken-junbishitsu-chizai3.pages.dev/",
            "user-agent": DEFAULT_USER_AGENT,
        },
        method="GET",
    )

    try:
        with urllib_request.urlopen(request, timeout=15) as response:
            body = response.read().decode("utf-8", errors="replace")
            print(f"http_status={response.status}")
            print(body)
    except urllib_error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        print(f"http_status={error.code}")
        print(body)
        raise SystemExit(1) from error
    except urllib_error.URLError as error:
        print(f"url_error={error.reason}")
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
