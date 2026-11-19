#!/usr/bin/env python3
"""Driver `firebase login --no-localhost` untuk AZANUSA (headless, firebase-tools >=15).

Alur CLI 15.x (PKCE via auth.firebase.tools):
  1. CLI mencetak Session ID (mis. FD83E) -> /tmp/fb-session.txt
  2. CLI mencetak URL https://auth.firebase.tools/login?... -> /tmp/fb-url.txt
  3. User membuka URL, login Google, mendapat kode -> letakkan kode di /tmp/fb-code.txt
  4. Driver mengetikkan kode ke prompt CLI -> token tersimpan di configstore

File status:
  /tmp/fb-login.log        log mentah
  /tmp/fb-url.txt          URL otorisasi (juga scripts/fb-login-url.txt)
  /tmp/fb-session.txt      Session ID (juga scripts/fb-login-session.txt)
  /tmp/fb-code.txt         KODE DARI USER (TIDAK dihapus saat driver mulai)
  /tmp/fb-alive.txt        heartbeat
  /tmp/fb-driver.pid       PID driver
  /tmp/fb-login-done.txt   status akhir
"""
import os
import re
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG = "/tmp/fb-login.log"
URLF = "/tmp/fb-url.txt"
SESSF = "/tmp/fb-session.txt"
URL_COPY = os.path.join(BASE, "scripts", "fb-login-url.txt")
SESS_COPY = os.path.join(BASE, "scripts", "fb-login-session.txt")
CODEF = "/tmp/fb-code.txt"
ALIVEF = "/tmp/fb-alive.txt"
DONF = "/tmp/fb-login-done.txt"

for f in (LOG, URLF, SESSF, DONF):
    try:
        os.remove(f)
    except FileNotFoundError:
        pass

with open("/tmp/fb-driver.pid", "w") as f:
    f.write(str(os.getpid()))

import pexpect  # noqa: E402

BIN = os.path.join(BASE, "node_modules", ".bin", "firebase")
if not os.path.exists(BIN):
    BIN = "firebase"

child = pexpect.spawn(BIN, ["login", "--no-localhost"], encoding="utf-8",
                      timeout=None, echo=False, cwd=BASE)
logfile = open(LOG, "w", encoding="utf-8", buffering=1)
child.logfile_read = logfile

URL_RE = re.compile(r"https://auth\.firebase\.tools/login\?[^\s\x1b]+")
SESS_RE = re.compile(r"session ID:\s*\n?\s*([A-Za-z0-9-]{3,12})")
CODE_RE = re.compile(r"enter authorization code", re.I)
YESNO_RE = re.compile(r"\(Y/n\)|\(y/n\)")

url_found = False
sess_found = False
code_sent = False
answered = 0  # hanya 2 prompt konfigurasi awal (Gemini + usage) yang dijawab "n"
STATUS = "running"
start = time.time()


def touch():
    try:
        with open(ALIVEF, "w") as f:
            f.write(str(time.time()))
    except OSError:
        pass


while child.isalive() and time.time() - start < 7200:
    touch()
    idx = child.expect([URL_RE, SESS_RE, CODE_RE, YESNO_RE, pexpect.TIMEOUT, pexpect.EOF], timeout=5)
    if idx == 0 and not url_found:
        url = child.after.strip().rstrip(".,;)")
        with open(URLF, "w") as f:
            f.write(url)
        with open(URL_COPY, "w") as f:
            f.write(url)
        url_found = True
        if sess_found:
            STATUS = "waiting_for_auth"
        logfile.write("\n[INFO] URL otorisasi tersimpan\n")
    elif idx == 1 and not sess_found:
        sid = child.match.group(1)
        with open(SESSF, "w") as f:
            f.write(sid)
        with open(SESS_COPY, "w") as f:
            f.write(sid)
        sess_found = True
        if url_found:
            STATUS = "waiting_for_auth"
        logfile.write("\n[INFO] Session ID %s tersimpan\n" % sid)
    elif idx == 2 and not code_sent:
        logfile.write("\n[INFO] prompt kode terdeteksi; menunggu %s\n" % CODEF)
        deadline = time.time() + 7200
        got = None
        while time.time() < deadline and child.isalive():
            touch()
            if os.path.exists(CODEF):
                got = open(CODEF).read().strip()
                if got:
                    break
            try:
                child.expect([pexpect.EOF], timeout=2)
            except pexpect.TIMEOUT:
                pass
        if got:
            logfile.write("\n[INFO] kode (%d chars) dikirim ke CLI\n" % len(got))
            child.sendline(got)
            code_sent = True
            STATUS = "code_submitted"
        else:
            STATUS = "timeout_waiting_code"
            break
    elif idx == 3 and answered < 2:
        logfile.write("\n[INFO] prompt konfigurasi #%d dijawab n\n" % (answered + 1))
        child.sendline("n")
        answered += 1
    elif idx == 5:
        break

try:
    if child.isalive():
        child.expect(pexpect.EOF, timeout=60)
except pexpect.TIMEOUT:
    child.terminate(force=True)

with open(DONF, "w") as f:
    f.write("exit=%s url=%s code_sent=%s status=%s\n" % (child.exitstatus, url_found, code_sent, STATUS))
print("DONE", STATUS)
