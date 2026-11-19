#!/usr/bin/env python3
"""Menukar kode otorisasi (dari user) menjadi token Google, lalu menuliskannya
ke configstore firebase-tools agar CLI terautentikasi penuh.

Replika persis loginRemotelyComplete() + recordCredentials() di firebase-tools 15.x:
  POST https://accounts.google.com/o/oauth2/token
    code=<KODE> & client_id=<FBC> & client_secret=<FBC>
    & redirect_uri=https://auth.firebase.tools/complete
    & grant_type=authorization_code & code_verifier=<VERIFIER>
  -> { access_token, refresh_token, id_token, expires_in, ... }
  configstore: user = payload(id_token), tokens = response(+expires_at), loginScopes = SCOPES

Pemakaian:
  python3 scripts/fb_login_complete.py <KODE>
  python3 scripts/fb_login_complete.py            # baca dari /tmp/fb-code.txt
"""
import base64
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "fb-login-state.json")
CONFIGSTORE = os.path.expanduser("~/.config/configstore/firebase-tools.json")

CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"
REDIRECT_URI = "https://auth.firebase.tools/complete"
SCOPES = [
    "email",
    "openid",
    "https://www.googleapis.com/auth/cloudplatformprojects.readonly",
    "https://www.googleapis.com/auth/firebase",
    "https://www.googleapis.com/auth/cloud-platform",
]


def jwt_payload(token: str) -> dict:
    part = token.split(".")[1]
    part += "=" * (-len(part) % 4)
    return json.loads(base64.urlsafe_b64decode(part))


def main() -> None:
    code = ""
    if len(sys.argv) > 1:
        code = sys.argv[1].strip()
    elif os.path.exists("/tmp/fb-code.txt"):
        code = open("/tmp/fb-code.txt").read().strip()
    if not code:
        print("ERROR: kode otorisasi tidak ditemukan (argv atau /tmp/fb-code.txt)")
        sys.exit(1)

    state = json.load(open(STATE))
    verifier = state["code_verifier"]

    data = urllib.parse.urlencode({
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
        "code_verifier": verifier,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://accounts.google.com/o/oauth2/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded",
                 "User-Agent": "FirebaseCLI/15.37.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            tokens = json.load(r)
    except urllib.error.HTTPError as e:
        print("ERROR exchange:", e.code, e.read().decode()[:500])
        sys.exit(2)

    if not tokens.get("access_token") and not tokens.get("refresh_token"):
        print("ERROR: respons token tidak lengkap:", str(tokens)[:500])
        sys.exit(2)

    tokens["expires_at"] = int(time.time() * 1000) + int(tokens.get("expires_in", 3600)) * 1000
    user = jwt_payload(tokens["id_token"]) if tokens.get("id_token") else {}

    os.makedirs(os.path.dirname(CONFIGSTORE), exist_ok=True)
    cfg = {}
    if os.path.exists(CONFIGSTORE):
        try:
            cfg = json.load(open(CONFIGSTORE))
        except Exception:
            cfg = {}
    cfg["user"] = user
    cfg["tokens"] = tokens
    cfg["loginScopes"] = SCOPES
    cfg.pop("session", None)
    with open(CONFIGSTORE, "w") as f:
        json.dump(cfg, f)
    os.chmod(CONFIGSTORE, 0o600)

    print("LOGIN_OK")
    print("EMAIL=" + str(user.get("email", "(tidak diketahui)")))
    print("REFRESH_TOKEN_PRESENT=" + ("yes" if tokens.get("refresh_token") else "NO"))


if __name__ == "__main__":
    main()
