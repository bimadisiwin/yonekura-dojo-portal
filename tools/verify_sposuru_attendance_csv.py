#!/usr/bin/env python3
import csv, json, re, sys
from pathlib import Path
CSV = Path(sys.argv[1] if len(sys.argv) > 1 else "/workspace/sposuru-export/sposuru-attendance.csv")
EXPECTED = Path("/workspace/sposuru-export/attendance-counts.json")

def normalize(name: str) -> str:
    return re.sub(r"\s+", "", (name or "").strip())

def main() -> int:
    rows = list(csv.DictReader(CSV.read_text(encoding="utf-8-sig").splitlines()))
    assert rows, "empty csv"
    for need in ("出欠予定日時", "グループ", "タイトル", "会員名", "出欠状況"):
        assert need in rows[0].keys(), f"missing column {need}"
    seen, counts = set(), {}
    for r in rows:
        group = (r.get("グループ") or "").strip()
        title = (r.get("タイトル") or "").strip()
        status = (r.get("出欠状況") or "").strip()
        name = (r.get("会員名") or "").strip()
        sched = (r.get("出欠予定日時") or "").strip()
        if group not in ("小学生", "未就学") or title != "柔道クラス" or status != "出席":
            continue
        key = f"{normalize(name)}|{group}|{sched}|{title}"
        if key in seen:
            continue
        seen.add(key)
        counts[name] = counts.get(name, 0) + 1
    exp = json.loads(EXPECTED.read_text(encoding="utf-8"))
    exp_map = {m["sposuruName"]: m["attendanceCount"] for m in exp["members"]}
    assert counts == exp_map, sorted(set(counts.items()) ^ set(exp_map.items()))
    assert sum(counts.values()) == exp["uniqueSessions"]
    html = Path("/workspace/index.html").read_text(encoding="utf-8")
    assert "source.sposuru || source.sposuruSettings" in html
    assert "sposuruReplaceAll" in html
    print("OK", len(counts), "members", sum(counts.values()), "sessions")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
