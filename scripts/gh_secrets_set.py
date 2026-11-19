#!/usr/bin/env python3
"""Set GitHub Actions repo secrets (PROD_URL, CRON_SECRET) untuk repo azanusa.

- Token dibaca dari env GITHUB_TOKEN (tidak di-hardcode/cetak).
- CRON_SECRET dibaca dari .env lokal.
- Enkripsi sealed box libsodium sesuai spesifikasi GitHub Actions secrets.
- Tidak pernah mencetak nilai secret, hanya nama + panjangnya.
"""
import base64
import json
import os
import sys
import urllib.request
from pathlib import Path

from nacl import encoding, public

REPO = "ddkurnia/azanusa"
TOKEN = os.environ["GITHUB_TOKEN"]
PROD_URL = "https://azanusa.vercel.app"


def api(method: str, path: str, body: dict | None = None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        f"https://api.github.com{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"token {TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode() or "{}"
        return json.loads(raw) if raw.strip() else {}


def main() -> None:
    cron = None
    for line in Path(".env").read_text().splitlines():
        if line.startswith("CRON_SECRET="):
            cron = line.split("=", 1)[1].strip()
    if not cron:
        sys.exit("ERROR: CRON_SECRET tidak ada di .env")

    pk = api("GET", f"/repos/{REPO}/actions/secrets/public-key")
    key = public.PublicKey(pk["key"].encode(), encoding.Base64Encoder())
    sealed = public.SealedBox(key)

    for name, value in [("PROD_URL", PROD_URL), ("CRON_SECRET", cron)]:
        enc = sealed.encrypt(value.encode())
        api(
            "PUT",
            f"/repos/{REPO}/actions/secrets/{name}",
            {
                "encrypted_value": base64.b64encode(enc).decode(),
                "key_id": pk["key_id"],
            },
        )
        print(f"set secret : {name} (len={len(value)})")

    print("--- verifikasi daftar secret ---")
    secrets = api("GET", f"/repos/{REPO}/actions/secrets")
    for s in secrets.get("secrets", []):
        print(f" - {s['name']} (updated {s['updated_at']})")


if __name__ == "__main__":
    main()
