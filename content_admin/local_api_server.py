from __future__ import annotations

import argparse
import base64
import json
import os
import time
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

try:
    from .publisher import (
        DEFAULT_DB_PATH,
        LOCAL_FREE_AUTH_USER_ID,
        LOCAL_PREMIUM_AUTH_USER_ID,
        complete_checkout,
        fetch_license_status,
        get_premium_plan_config,
        fetch_premium_catalog,
        fetch_premium_question_payload,
        fetch_public_catalog,
        fetch_question_payload,
        start_checkout,
    )
except ImportError:
    from publisher import (
        DEFAULT_DB_PATH,
        LOCAL_FREE_AUTH_USER_ID,
        LOCAL_PREMIUM_AUTH_USER_ID,
        complete_checkout,
        fetch_license_status,
        get_premium_plan_config,
        fetch_premium_catalog,
        fetch_premium_question_payload,
        fetch_public_catalog,
        fetch_question_payload,
        start_checkout,
    )


class QuizApiHandler(SimpleHTTPRequestHandler):
    db_path: Path
    supabase_project_url: str | None = None
    expected_audience: str = "authenticated"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/public/catalog":
            self._handle_public_catalog()
            return
        if parsed.path == "/api/public/questions":
            self._handle_public_questions(parsed.query)
            return
        if parsed.path == "/api/secure/license/status":
            self._handle_secure_license_status()
            return
        if parsed.path == "/api/secure/premium/catalog":
            self._handle_secure_premium_catalog()
            return
        if parsed.path == "/api/secure/premium/manifest":
            self._handle_secure_premium_manifest(parsed.query)
            return
        if parsed.path == "/api/secure/premium/questions":
            self._handle_secure_premium_questions(parsed.query)
            return
        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/secure/billing/checkout/start":
            self._handle_checkout_start()
            return
        if parsed.path == "/api/secure/billing/checkout/complete":
            self._handle_checkout_complete()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")

    def _handle_public_catalog(self) -> None:
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        active_plan = query.get("plan", ["free"])[0]
        payload = {"sets": fetch_public_catalog(self.db_path, active_plan)}
        self._write_json(HTTPStatus.OK, payload)

    def _handle_public_questions(self, raw_query: str) -> None:
        query = parse_qs(raw_query)
        set_id = query.get("set_id", [None])[0]
        active_plan = query.get("plan", ["free"])[0]
        try:
            payload = fetch_question_payload(self.db_path, set_id, active_plan)
        except LookupError as error:
            self._write_json(HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        self._write_json(HTTPStatus.OK, payload)

    def _handle_secure_license_status(self) -> None:
        auth_context = self._resolve_auth_context(self._extract_bearer_token())
        if auth_context.get("error"):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": auth_context["error"]})
            return
        payload = fetch_license_status(
            self.db_path,
            auth_context.get("auth_user_id"),
            auth_provider=auth_context.get("auth_provider", "supabase"),
            email=auth_context.get("email", ""),
            display_name=auth_context.get("display_name", ""),
        )
        self._write_json(HTTPStatus.OK, payload)

    def _handle_secure_premium_manifest(self, raw_query: str) -> None:
        auth_context = self._resolve_auth_context(self._extract_bearer_token())
        if auth_context.get("error"):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": auth_context["error"]})
            return
        status = fetch_license_status(
            self.db_path,
            auth_context.get("auth_user_id"),
            auth_provider=auth_context.get("auth_provider", "supabase"),
            email=auth_context.get("email", ""),
            display_name=auth_context.get("display_name", ""),
        )
        if not status["signed_in"] or status["active_plan"] != "premium":
            self._write_json(
                HTTPStatus.FORBIDDEN,
                {
                    "error": "premium access required",
                    "signed_in": status["signed_in"],
                    "active_plan": status["active_plan"],
                },
            )
            return

        query = parse_qs(raw_query)
        plan_code = query.get("plan_code", ["grade3_premium"])[0]
        premium_sets = fetch_premium_catalog(self.db_path, status["active_plan"], plan_code)
        premium_config = get_premium_plan_config(plan_code)
        self._write_json(
            HTTPStatus.OK,
            {
                "plan_code": plan_code,
                "active_plan": status["active_plan"],
                "label": premium_config["label"],
                "recommended_entry_path": premium_config["recommended_entry_path"],
                "base_public_set_id": premium_config["base_public_set_id"],
                "merge_strategy": premium_config["merge_strategy"],
                "question_sets": premium_sets,
                "unlocked_features": premium_config["unlocked_features"],
            },
        )

    def _handle_secure_premium_catalog(self) -> None:
        auth_context = self._resolve_auth_context(self._extract_bearer_token())
        if auth_context.get("error"):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": auth_context["error"]})
            return
        status = fetch_license_status(
            self.db_path,
            auth_context.get("auth_user_id"),
            auth_provider=auth_context.get("auth_provider", "supabase"),
            email=auth_context.get("email", ""),
            display_name=auth_context.get("display_name", ""),
        )
        if not status["signed_in"] or status["active_plan"] != "premium":
            self._write_json(HTTPStatus.FORBIDDEN, {"error": "premium access required"})
            return
        self._write_json(HTTPStatus.OK, {"sets": fetch_premium_catalog(self.db_path, status["active_plan"])})

    def _handle_secure_premium_questions(self, raw_query: str) -> None:
        auth_context = self._resolve_auth_context(self._extract_bearer_token())
        if auth_context.get("error"):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": auth_context["error"]})
            return
        status = fetch_license_status(
            self.db_path,
            auth_context.get("auth_user_id"),
            auth_provider=auth_context.get("auth_provider", "supabase"),
            email=auth_context.get("email", ""),
            display_name=auth_context.get("display_name", ""),
        )
        if not status["signed_in"] or status["active_plan"] != "premium":
            self._write_json(HTTPStatus.FORBIDDEN, {"error": "premium access required"})
            return

        query = parse_qs(raw_query)
        set_id = query.get("set_id", [None])[0]
        plan_code = query.get("plan_code", ["grade3_premium"])[0]
        try:
            payload = fetch_premium_question_payload(self.db_path, set_id, status["active_plan"], plan_code)
        except LookupError as error:
            self._write_json(HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        self._write_json(HTTPStatus.OK, payload)

    def _handle_checkout_start(self) -> None:
        auth_context = self._resolve_auth_context(self._extract_bearer_token())
        if auth_context.get("error"):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": auth_context["error"]})
            return
        auth_user_id = auth_context.get("auth_user_id")
        if not auth_user_id:
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": "sign in required"})
            return
        payload = start_checkout(
            self.db_path,
            auth_user_id=auth_user_id,
            auth_provider=auth_context.get("auth_provider", "supabase"),
            email=auth_context.get("email", ""),
            display_name=auth_context.get("display_name", ""),
        )
        self._write_json(HTTPStatus.OK, payload)

    def _handle_checkout_complete(self) -> None:
        auth_context = self._resolve_auth_context(self._extract_bearer_token())
        if auth_context.get("error"):
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": auth_context["error"]})
            return
        auth_user_id = auth_context.get("auth_user_id")
        if not auth_user_id:
            self._write_json(HTTPStatus.UNAUTHORIZED, {"error": "sign in required"})
            return
        payload = complete_checkout(
            self.db_path,
            auth_user_id=auth_user_id,
            auth_provider=auth_context.get("auth_provider", "supabase"),
            email=auth_context.get("email", ""),
            display_name=auth_context.get("display_name", ""),
        )
        self._write_json(HTTPStatus.OK, payload)

    def _extract_bearer_token(self) -> str | None:
        header = self.headers.get("Authorization", "")
        if not header.lower().startswith("bearer "):
            return None
        token = header[7:].strip()
        return token or None

    def _resolve_auth_context(self, token: str | None) -> dict[str, str]:
        if token == "local-premium-session":
            return {
                "auth_user_id": LOCAL_PREMIUM_AUTH_USER_ID,
                "auth_provider": "local_stub",
                "email": "premium@example.local",
                "display_name": "プレミアム版ユーザー",
            }
        if token == "local-free-session":
            return {
                "auth_user_id": LOCAL_FREE_AUTH_USER_ID,
                "auth_provider": "local_stub",
                "email": "free@example.local",
                "display_name": "無料版ユーザー",
            }
        if token and token.count(".") == 2:
            payload = self._decode_jwt_payload(token)
            validation_error = self._validate_supabase_claims(payload)
            if validation_error:
                return {"error": validation_error}
            auth_user_id = payload.get("sub")
            if isinstance(auth_user_id, str) and auth_user_id:
                email = payload.get("email")
                display_name = (
                    payload.get("user_metadata", {}).get("display_name")
                    if isinstance(payload.get("user_metadata"), dict)
                    else None
                )
                if not isinstance(display_name, str) or not display_name:
                    display_name = payload.get("name")
                return {
                    "auth_user_id": auth_user_id,
                    "auth_provider": "supabase",
                    "email": email if isinstance(email, str) else "",
                    "display_name": display_name if isinstance(display_name, str) else "",
                }
        return {}

    def _validate_supabase_claims(self, payload: dict) -> str | None:
        if not payload:
            return "invalid_token_payload"

        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            return "missing_subject"

        expires_at = payload.get("exp")
        if isinstance(expires_at, (int, float)) and expires_at < time.time():
            return "token_expired"

        expected_issuer = None
        if self.supabase_project_url:
            expected_issuer = f"{self.supabase_project_url.rstrip('/')}/auth/v1"
        issuer = payload.get("iss")
        if expected_issuer and issuer != expected_issuer:
            return "invalid_issuer"

        audience = payload.get("aud")
        if isinstance(audience, str):
            if audience != self.expected_audience:
                return "invalid_audience"
        elif isinstance(audience, list):
            if self.expected_audience not in audience:
                return "invalid_audience"

        return None

    def _decode_jwt_payload(self, token: str) -> dict:
        try:
            payload_part = token.split(".")[1]
            padding = "=" * (-len(payload_part) % 4)
            decoded = base64.urlsafe_b64decode(payload_part + padding)
            payload = json.loads(decoded.decode("utf-8"))
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _write_json(self, status: HTTPStatus, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Serve quiz_app static files and a local content API.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--static-root", type=Path, default=Path("..") / "quiz_app")
    parser.add_argument("--supabase-project-url", type=str, default=os.environ.get("SUPABASE_PROJECT_URL", ""))
    parser.add_argument("--supabase-expected-audience", type=str, default=os.environ.get("SUPABASE_EXPECTED_AUDIENCE", "authenticated"))
    return parser


def main() -> int:
    args = build_parser().parse_args()
    static_root = args.static_root.resolve()
    db_path = args.db_path.resolve()

    QuizApiHandler.db_path = db_path
    QuizApiHandler.supabase_project_url = args.supabase_project_url or None
    QuizApiHandler.expected_audience = args.supabase_expected_audience
    handler = partial(QuizApiHandler, directory=str(static_root))
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Serving quiz app on http://127.0.0.1:{args.port} using {db_path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
