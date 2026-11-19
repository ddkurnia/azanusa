#!/usr/bin/env python3
"""Membuat URL login Firebase CLI (alur auth.firebase.tools/PKCE, replika persis
loginRemotelyStart() di firebase-tools 15.x) TANPA proses yang harus tetap hidup.

State disimpan di scripts/fb-login-state.json (persisten), sehingga kode
otorisasi dari user dapat ditukar kapan pun oleh scripts/fb_login_complete.py.
"""
import base64
import hashlib
import json
import os
import secrets
import sys
import urllib.request
import uuid

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "fb-login-state.json")

PROXY = "https://auth.firebase.tools"


def urlsafe(b64: str) -> str:
    # persis urlsafeBase64() di firebase-tools/lib/auth.js
    return b64.replace("+", "-").rstrip("=").replace("/", "_")


def main() -> None:
    session_id = str(uuid.uuid4())
    # randomBytes(32).toString("hex") -> 64 karakter hex
    verifier = secrets.token_hex(32)
    digest_b64 = base64.b64encode(hashlib.sha256(verifier.encode("utf-8")).digest()).decode("ascii")
    challenge = urlsafe(digest_b64)

    req = urllib.request.Request(
        PROXY + "/attest",
        data=json.dumps({"session_id": session_id}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "FirebaseCLI/15.37.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        attest = json.load(r).get("token")
    if not attest:
        print("ERROR: /attest tidak mengembalikan token", file=sys.stderr)
        sys.exit(1)

    url = f"{PROXY}/login?code_challenge={challenge}&session={session_id}&attest={attest}"
    state = {
        "session_id": session_id,
        "session_prefix": session_id[:5].upper(),
        "code_verifier": verifier,
        "code_challenge": challenge,
        "attest": attest,
        "login_url": url,
    }
    with open(STATE, "w") as f:
        json.dump(state, f, indent=2)
    os.chmod(STATE, 0o600)

    print("SESSION_PREFIX=" + state["session_prefix"])
    print("LOGIN_URL=" + url)


if __name__ == "__main__":
    main()
