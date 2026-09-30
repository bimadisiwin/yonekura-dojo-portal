#!/usr/bin/env python3
"""Fetch latest judo-class attendance from Sposuru and optionally push absolute
counts into bimadisiwin/yonekura-dojo-data (data/jleague.json).

Env:
  SPOSURU_EMAIL      (required) e.g. info@yonekura-dojo.com
  SPOSURU_PASSWORD   (required)
  DOJO_DATA_TOKEN    (optional) GitHub PAT with Contents: Read/Write on yonekura-dojo-data
  DOJO_DATA_OWNER    (default bimadisiwin)
  DOJO_DATA_REPO     (default yonekura-dojo-data)
  DOJO_DATA_PATH     (default data/jleague.json)
  DOJO_DATA_BRANCH   (default main)
  OUTPUT_DIR         (default ./sposuru-export)

Does not print passwords. Does not commit credentials.
"""
from __future__ import annotations

import csv
import html as htmlmod
import http.cookiejar
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from pathlib import Path

BASE = "https://app-team.sposuru.com"
ATT_GROUPS = {"小学生", "未就学"}
TITLE_OK = "柔道クラス"


def require_env(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if not val:
        raise SystemExit(f"Missing env {name}")
    return val


def opener_with_cookies(path: Path) -> urllib.request.OpenerDirector:
    cj = http.cookiejar.MozillaCookieJar(str(path))
    if path.exists():
        try:
            cj.load(ignore_discard=True, ignore_expires=True)
        except Exception:
            pass
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)), cj


def login(opener, cj, cookie_path: Path, email: str, password: str) -> None:
    with opener.open(BASE + "/login") as resp:
        page = resp.read().decode("utf-8", errors="replace")
    token = re.search(r'name="_token" value="([^"]+)"', page).group(1)
    data = urllib.parse.urlencode(
        {"_token": token, "email": email, "password": password, "checkbox": "on"}
    ).encode()
    req = urllib.request.Request(
        BASE + "/login",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": BASE,
            "Referer": BASE + "/login",
        },
    )
    with opener.open(req) as resp:
        if resp.geturl().rstrip("/").endswith("login") and b"password" in resp.read()[:2000]:
            raise SystemExit("Sposuru login failed")
    cj.save(str(cookie_path), ignore_discard=True, ignore_expires=True)


def advanced_search(opener, start: str, finish: str) -> None:
    with opener.open(BASE + "/schedule-top/attendance") as resp:
        page = resp.read().decode("utf-8", errors="replace")
    token = re.search(r'name="_token" value="([^"]+)"', page).group(1)
    fields = [
        ("_token", token),
        ("target_route", "schedule_top.attendance.index"),
        ("session_key", "attendance_advanced_search"),
        ("is_search", "1"),
        ("start_date", start),
        ("finish_date", finish),
        ("is_display_all", "1"),
        ("title", "柔道クラス"),
        ("team_groups[]", "8063"),  # 未就学
        ("team_groups[]", "8054"),  # 小学生
        ("status[]", "1"),  # 出席
    ]
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        BASE + "/common/advanced-search",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": BASE,
            "Referer": BASE + "/schedule-top/attendance",
        },
    )
    try:
        with opener.open(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        if e.code not in (302, 303):
            raise


def collect_ids(opener) -> list[str]:
    ids: list[str] = []
    for page in range(1, 50):
        url = f"{BASE}/schedule-top/attendance?is_search_advance=1&limit=100&page={page}"
        with opener.open(url) as resp:
            html = resp.read().decode("utf-8", errors="replace")
        page_ids = re.findall(r'data-type="attandance"\s+value="(\d+)"', html)
        if not page_ids:
            break
        ids.extend(page_ids)
        if len(page_ids) < 100:
            break
    # unique preserve order
    return list(dict.fromkeys(ids))


def export_csv(opener, ids: list[str], out_csv: Path) -> Path:
    with opener.open(BASE + "/schedule-top/attendance?is_search_advance=1&limit=100") as resp:
        page = resp.read().decode("utf-8", errors="replace")
    token = re.search(r'name="_token" value="([^"]+)"', page).group(1)
    m = re.search(r'name="searchs" value="([^"]*)"', page)
    searchs = htmlmod.unescape(m.group(1)) if m else ""
    fields = [("_token", token), ("export_id", ",".join(ids)), ("searchs", searchs)]
    for f in [
        "approve_status",
        "attendance",
        "group_name",
        "title",
        "member_name",
        "status",
        "created_at",
        "note",
    ]:
        fields.append(("ex_field[]", f))
    data = urllib.parse.urlencode(fields).encode()
    req = urllib.request.Request(
        BASE + "/schedule-top/attendance/export",
        data=data,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": BASE,
            "Referer": BASE + "/schedule-top/attendance?is_search_advance=1",
        },
    )
    with opener.open(req) as resp:
        content = resp.read()
    out_csv.write_bytes(content)
    return out_csv


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", "", (name or "").strip())


def session_key(name: str, group: str, scheduled: str, title: str) -> str:
    return f"{normalize_name(name)}|{group}|{scheduled}|{title}"


def counts_from_csv(path: Path) -> dict[str, int]:
    text = path.read_bytes().decode("utf-8-sig")
    rows = list(csv.DictReader(text.splitlines()))
    seen: set[str] = set()
    counts: Counter[str] = Counter()
    for r in rows:
        group = (r.get("グループ") or "").strip()
        title = (r.get("タイトル") or "").strip()
        status = (r.get("出欠状況") or "").strip()
        name = (r.get("会員名") or "").strip()
        sched = (r.get("出欠予定日時") or "").strip()
        if group not in ATT_GROUPS or title != TITLE_OK or status != "出席" or not name:
            continue
        key = session_key(name, group, sched, title)
        if key in seen:
            continue
        seen.add(key)
        counts[name] += 1
    return dict(counts)


def gh_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "yonekura-dojo-sposuru-sync",
    }


def update_dojo_data(token: str, counts: dict[str, int], summary: str) -> None:
    import base64
    import time

    owner = os.environ.get("DOJO_DATA_OWNER", "bimadisiwin")
    repo = os.environ.get("DOJO_DATA_REPO", "yonekura-dojo-data")
    path = os.environ.get("DOJO_DATA_PATH", "data/jleague.json")
    branch = os.environ.get("DOJO_DATA_BRANCH", "main")
    api = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
    req = urllib.request.Request(
        api + "?ref=" + urllib.parse.quote(branch) + "&t=" + str(int(time.time())),
        headers=gh_headers(token),
    )
    with urllib.request.urlopen(req) as resp:
        meta = json.load(resp)
    sha = meta["sha"]
    raw = base64.b64decode(meta["content"])
    state = json.loads(raw.decode("utf-8"))
    roster = state.get("roster") or []
    by_norm = {}
    for m in roster:
        for key in (m.get("sposuruName") or "", m.get("name") or ""):
            n = normalize_name(key)
            if n:
                by_norm.setdefault(n, m)
    now = int(time.time() * 1000)
    updated = 0
    for sposuru_name, count in counts.items():
        m = by_norm.get(normalize_name(sposuru_name))
        if not m:
            continue
        if int(m.get("attendanceCount") or 0) != count:
            m["attendanceCount"] = count
            m["attendanceUpdatedAt"] = now
            updated += 1
        else:
            m["attendanceUpdatedAt"] = now
    sposuru = state.get("sposuru") or {}
    sposuru["lastSyncAt"] = now
    sposuru["lastSyncSummary"] = summary
    sposuru["lastImportCutoffDate"] = time.strftime("%Y-%m-%d")
    state["sposuru"] = sposuru
    state["updatedAt"] = now
    body = json.dumps(
        {
            "message": "chore: sync attendance from Sposuru",
            "content": base64.b64encode(
                json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
            ).decode("ascii"),
            "sha": sha,
            "branch": branch,
        }
    ).encode("utf-8")
    put = urllib.request.Request(
        api,
        data=body,
        method="PUT",
        headers={**gh_headers(token), "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(put) as resp:
        result = json.load(resp)
    print(
        f"Updated {owner}/{repo}/{path} members_changed={updated} commit={result.get('commit', {}).get('sha', '')[:7]}"
    )


def main() -> int:
    email = require_env("SPOSURU_EMAIL")
    password = require_env("SPOSURU_PASSWORD")
    out_dir = Path(os.environ.get("OUTPUT_DIR", "sposuru-export"))
    out_dir.mkdir(parents=True, exist_ok=True)
    cookie_path = out_dir / "sposuru-cookies.txt"
    opener, cj = opener_with_cookies(cookie_path)

    print("Logging into Sposuru…")
    login(opener, cj, cookie_path, email, password)
    start = os.environ.get("SPOSURU_START_DATE", "2024-01-01")
    finish = os.environ.get("SPOSURU_FINISH_DATE", time_ymd())
    print(f"Searching attendance {start} → {finish}…")
    advanced_search(opener, start, finish)
    ids = collect_ids(opener)
    print(f"Found {len(ids)} attendance rows")
    if not ids:
        raise SystemExit("No attendance rows to export")
    csv_path = out_dir / "sposuru-attendance.csv"
    export_csv(opener, ids, csv_path)
    counts = counts_from_csv(csv_path)
    counts_path = out_dir / "attendance-counts.json"
    counts_path.write_text(
        json.dumps(
            {
                "uniqueSessions": sum(counts.values()),
                "members": [
                    {"sposuruName": n, "attendanceCount": c}
                    for n, c in sorted(counts.items(), key=lambda x: -x[1])
                ],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {csv_path} and {counts_path} ({len(counts)} members, {sum(counts.values())} sessions)")
    for n, c in sorted(counts.items(), key=lambda x: -x[1])[:10]:
        print(f"  {c:3d}  {n}")

    token = os.environ.get("DOJO_DATA_TOKEN", "").strip()
    summary = f"Sposuru全置換 {len(counts)}名 / {sum(counts.values())}回 / 基準日 {finish}"
    if token:
        print("Pushing absolute attendance into yonekura-dojo-data…")
        update_dojo_data(token, counts, summary)
    else:
        print("DOJO_DATA_TOKEN not set — skipped cloud update.")
        print("Import the CSV in 📋マスター with「出席数をCSVで全置換」checked, then sync.")
    return 0


def time_ymd() -> str:
    import time

    return time.strftime("%Y-%m-%d")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except urllib.error.HTTPError as e:
        print("HTTPError", e.code, e.reason, file=sys.stderr)
        try:
            print(e.read()[:500], file=sys.stderr)
        except Exception:
            pass
        raise SystemExit(1)
