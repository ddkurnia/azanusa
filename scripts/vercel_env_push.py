#!/usr/bin/env python3
"""Upsert server env vars ke Vercel project azanusa (team kedai-media).

- Token dibaca dari env VERCEL_TOKEN (tidak pernah di-hardcode/cetak).
- Nilai variabel dibaca dari .env lokal (satu baris KEY=VALUE, kutip luar
  dilepas; FIREBASE_PRIVATE_KEY mempertahankan literal \\n — server.ts sudah
  menangani bentuk itu).
- Tidak pernah mencetak nilai variabel, hanya nama + panjangnya.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

TOKEN = os.environ["VERCEL_TOKEN"]
TEAM = "team_KwyOps1J4B61xwGgMZVZKuA2"
PROJECT = "azanusa"
BASE = "https://api.vercel.com"

KEYS = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "CRON_SECRET"]
TARGETS = ["production", "preview", "development"]


def parse_env(path: str = ".env") -> dict:
    out = {}
    for line in Path(path).read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k] = v
    return out


def req(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        BASE + path,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode() or "{}")


def main() -> None:
    env = parse_env()
    missing = [k for k in KEYS if not env.get(k)]
    if missing:
        sys.exit(f"ERROR: .env tidak berisi kunci: {missing}")

    existing = req("GET", f"/v9/projects/{PROJECT}/env?teamId={TEAM}").get("envs", [])
    bykey = {e["key"]: e for e in existing}

    failed = False
    for k in KEYS:
        if k in bykey:
            try:
                req("DELETE", f"/v9/projects/{PROJECT}/env/{bykey[k]['id']}?teamId={TEAM}")
                print(f"hapus lama : {k}")
            except urllib.error.HTTPError as e:
                print(f"WARN hapus {k}: HTTP {e.code}")
        v = env[k]
        body = {"key": k, "value": v, "type": "encrypted", "target": TARGETS}
        try:
            req("POST", f"/v10/projects/{PROJECT}/env?teamId={TEAM}", body)
            print(f"set ok     : {k} (len={len(v)}, targets={','.join(TARGETS)})")
        except urllib.error.HTTPError as e:
            print(f"ERROR set {k}: HTTP {e.code} {e.read().decode()[:200]}")
            failed = True

    if failed:
        sys.exit(1)
    print("DONE: 4 env var produksi terpasang di Vercel")


if __name__ == "__main__":
    main()
