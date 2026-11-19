#!/usr/bin/env python3
"""Setup admin Firebase untuk AZANUSA (sekali jalan, memakai OAuth CLI):

 1. Token akses dari refresh_token configstore (client OAuth publik firebase-tools)
 2. Aktifkan provider Anonymous di Firebase Authentication (identitytoolkit admin)
 3. Buat service account azanusa-dispatch (IAM) + beri peran:
      - roles/cloudmessaging.admin  (kirim FCM v1)
      - roles/datastore.user        (Firestore: users/{uid} + cache jadwal)
 4. Buat kunci service account -> tulis FIREBASE_* ke .env (tidak pernah dicetak)

Aman dijalankan ulang: 409 (sudah ada) diperlakukan sukses.
"""
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ENV_PATH = os.path.join(os.path.dirname(HERE), ".env")
CONFIGSTORE = os.path.expanduser("~/.config/configstore/firebase-tools.json")

CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"
PROJECT = "azanusa"
SA_ID = "azanusa-dispatch"
ROLES = ["roles/firebase.admin", "roles/datastore.user"]
UA = "FirebaseCLI/15.37.0"

step_ok = []


def call(method: str, url: str, token: str, body: dict | None = None,
         form: dict | None = None) -> tuple[int, dict | str]:
    headers = {"User-Agent": UA, "Accept": "application/json"}
    data = None
    if form is not None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        data = urllib.parse.urlencode(form).encode()
    elif body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    if token:
        headers["Authorization"] = "Bearer " + token
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:300]


def mint_access_token(refresh_token: str) -> str:
    st, res = call("POST", "https://accounts.google.com/o/oauth2/token", "",
                   form={"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
                         "refresh_token": refresh_token, "grant_type": "refresh_token"})
    if st != 200 or not isinstance(res, dict) or "access_token" not in res:
        print("GAGAL mint access token:", st, str(res)[:200])
        sys.exit(1)
    return res["access_token"]


def main() -> None:
    cfg = json.load(open(CONFIGSTORE))
    refresh = cfg.get("tokens", {}).get("refresh_token")
    if not refresh:
        print("ERROR: refresh_token tidak ada di configstore — jalankan login dulu")
        sys.exit(1)
    token = mint_access_token(refresh)
    step_ok.append("access token OK")

    # ---------- 2. Anonymous auth ----------
    cfg_url = f"https://identitytoolkit.googleapis.com/admin/v2/projects/{PROJECT}/config"
    st, cur = call("GET", cfg_url, token)
    anon_on = False
    if st == 200 and isinstance(cur, dict):
        anon_on = cur.get("signIn", {}).get("anonymous", {}).get("enabled") is True
    if anon_on:
        step_ok.append("Anonymous auth: sudah AKTIF")
    else:
        st2, _ = call("PATCH", cfg_url + "?updateMask=signIn.anonymous.enabled", token,
                      body={"signIn": {"anonymous": {"enabled": True}}})
        step_ok.append(f"Anonymous auth: {'AKTIF (baru diaktifkan)' if st2 in (200, 201) else f'GAGAL ({st2})'}")
        if st2 not in (200, 201):
            sys.exit(2)

    # ---------- 3. Service account ----------
    sa_name = f"projects/{PROJECT}/serviceAccounts/{SA_ID}@{PROJECT}.iam.gserviceaccount.com"
    sa_email = f"{SA_ID}@{PROJECT}.iam.gserviceaccount.com"
    st, res = call("POST", f"https://iam.googleapis.com/v1/projects/{PROJECT}/serviceAccounts", token,
                   body={"accountId": SA_ID,
                         "serviceAccount": {"displayName": "AZANUSA dispatch",
                                            "description": "Pengirim push pengingat salat AZANUSA (FCM + Firestore)"}})
    if st in (200, 201):
        step_ok.append("Service account: dibuat")
    elif st == 409:
        step_ok.append("Service account: sudah ada")
    else:
        print("GAGAL buat service account:", st, str(res)[:300])
        sys.exit(3)

    # ---------- peran IAM ----------
    st, pol = call("POST", f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}:getIamPolicy", token,
                   body={})
    if st == 200 and isinstance(pol, dict) and "bindings" in pol.get("policy", pol) or (
            st == 200 and isinstance(pol, dict) and "bindings" in pol):
        policy = pol.get("policy", pol)
        member = "serviceAccount:" + sa_email
        changed = False
        bindings = policy.setdefault("bindings", [])
        for role in ROLES:
            b = next((x for x in bindings if x.get("role") == role), None)
            if b is None:
                bindings.append({"role": role, "members": [member]})
                changed = True
            elif member not in b.get("members", []):
                b.setdefault("members", []).append(member)
                changed = True
        if changed:
            st2, _ = call("POST", f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}:setIamPolicy",
                          token, body={"policy": policy})
            step_ok.append(f"Peran {', '.join(ROLES)}: {'terpasang' if st2 == 200 else f'GAGAL ({st2})'}")
        else:
            step_ok.append("Peran: sudah terpasang sebelumnya")
    else:
        print("GAGAL baca IAM policy:", st, str(pol)[:300])
        sys.exit(4)

    # ---------- 4. Kunci + .env ----------
    env_lines = open(ENV_PATH).read().splitlines() if os.path.exists(ENV_PATH) else []
    already = any(l.startswith("FIREBASE_PRIVATE_KEY=") and l.split("=", 1)[1] for l in env_lines)
    if already:
        step_ok.append("Kunci: sudah ada di .env (dilewati)")
    else:
        st, key = call("POST", f"https://iam.googleapis.com/v1/{sa_name}/keys", token, body={})
        if st not in (200, 201) or not isinstance(key, dict):
            print("GAGAL buat kunci:", st, str(key)[:300])
            sys.exit(5)
        raw = base64.b64decode(key["privateKeyData"])
        client_email, private_key = None, None
        if raw.lstrip().startswith(b"{"):
            k = json.loads(raw)
            client_email = k.get("client_email")
            private_key = k.get("private_key")
        elif b"BEGIN PRIVATE KEY" in raw:
            private_key = raw.decode()
            client_email = sa_email
        if not client_email or not private_key:
            print("GAGAL: format kunci tak dikenal")
            sys.exit(6)
        pk_escaped = private_key.replace("\n", "\\n")
        # hapus baris FIREBASE_* lama (kosong) lalu tulis yang baru
        env_lines = [l for l in env_lines if not l.startswith(("FIREBASE_PROJECT_ID=", "FIREBASE_CLIENT_EMAIL=", "FIREBASE_PRIVATE_KEY="))]
        env_lines += [
            "",
            "# ---------- Firebase Admin (service account azanusa-dispatch) ----------",
            f"FIREBASE_PROJECT_ID={PROJECT}",
            f"FIREBASE_CLIENT_EMAIL={client_email}",
            f"FIREBASE_PRIVATE_KEY={pk_escaped}",
        ]
        with open(ENV_PATH, "w") as f:
            f.write("\n".join(env_lines) + "\n")
        os.chmod(ENV_PATH, 0o600)
        step_ok.append(f"Kunci baru -> .env (email {client_email}, kunci tidak dicetak)")

    print("=== HASIL SETUP ===")
    for s in step_ok:
        print(" -", s)


if __name__ == "__main__":
    main()
