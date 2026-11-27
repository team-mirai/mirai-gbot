#!/usr/bin/env python3
"""ベンチマーク実行。

  python3 bench/run.py --config bench/configs/baseline.json
  python3 bench/run.py --config bench/configs/baseline.json --limit 5 --repeat 3
  python3 bench/run.py --config bench/configs/baseline.json --set target.model=openai/gpt-5.5

結果は bench/results/<日時>_<name>/ に保存される (config.json / results.jsonl / summary.json / summary.md)。
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import math
import subprocess
import sys
import threading
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BENCH_DIR, load_env, read_jsonl  # noqa: E402
from judge import judge  # noqa: E402
from targets import run_target  # noqa: E402

DEFAULT_JUDGE = {"model": "anthropic/claude-sonnet-5.5", "temperature": 0}


def set_path(cfg: dict, dotted: str, value: str) -> None:
    keys = dotted.split(".")
    d = cfg
    for k in keys[:-1]:
        d = d.setdefault(k, {})
    try:
        d[keys[-1]] = json.loads(value)
    except json.JSONDecodeError:
        d[keys[-1]] = value


def git_rev() -> str:
    try:
        rev = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=BENCH_DIR, text=True).strip()
        dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=BENCH_DIR, text=True).strip()
        return rev + ("-dirty" if dirty else "")
    except Exception:  # noqa: BLE001
        return "unknown"


def wilson(p: float, n: int, z: float = 1.96):
    if n == 0:
        return (0.0, 0.0)
    denom = 1 + z * z / n
    c = (p + z * z / (2 * n)) / denom
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
    return (max(0.0, c - h), min(1.0, c + h))


def summarize(rows: list, cfg: dict, meta: dict) -> dict:
    ok = [r for r in rows if not r.get("error")]
    n = len(ok)
    def agg(rs):
        m = len(rs)
        if m == 0:
            return {"n": 0}
        pr = sum(r["judge"]["pass"] for r in rs) / m
        lo, hi = wilson(pr, m)
        return {"n": m,
                "pass_rate": round(pr, 4), "pass_rate_ci95": [round(lo, 3), round(hi, 3)],
                "mean_score": round(sum(r["judge"]["score"] for r in rs) / m, 2),
                "error_rate": round(sum(r["judge"]["has_error"] for r in rs) / m, 4),
                "mean_coverage": round(sum(r["judge"]["coverage"] for r in rs) / m, 3),
                "grounded_rate": round(sum(r["judge"]["grounded"] >= 1 for r in rs) / m, 4)}
    by_cat = defaultdict(list)
    for r in ok:
        by_cat[r.get("category", "other")].append(r)
    lat = sorted(r["latency_s"] for r in ok)
    return {
        **meta,
        "overall": agg(ok),
        "by_category": {k: agg(v) for k, v in sorted(by_cat.items())},
        "failed_requests": len(rows) - n,
        "latency_s": {"mean": round(sum(lat) / n, 2) if n else None,
                      "p50": lat[n // 2] if n else None,
                      "p90": lat[min(n - 1, int(n * 0.9))] if n else None},
        "cost_usd": {"answer": round(sum(r.get("cost", 0) or 0 for r in rows), 4),
                     "judge": round(sum((r.get("judge") or {}).get("judge_cost", 0) or 0 for r in rows), 4)},
    }


def to_markdown(s: dict) -> str:
    o = s["overall"]
    lines = [f"# {s['name']}  ({s['started_at']})", "",
             f"- target: `{s['target_desc']}`", f"- judge: `{s['judge_model']}`",
             f"- questions: {s['questions_file']} × repeat {s['repeat']}  /  git: {s['git']}", ""]
    if o.get("n"):
        lines += [f"**正答率 {o['pass_rate']*100:.1f}%** (95%CI {o['pass_rate_ci95'][0]*100:.0f}–{o['pass_rate_ci95'][1]*100:.0f}%)"
                  f" / 平均スコア {o['mean_score']} / 誤り率 {o['error_rate']*100:.1f}% / 出典あり {o['grounded_rate']*100:.0f}%", "",
                  f"レイテンシ mean {s['latency_s']['mean']}s p90 {s['latency_s']['p90']}s / "
                  f"コスト 回答 ${s['cost_usd']['answer']} + 採点 ${s['cost_usd']['judge']} / 失敗リクエスト {s['failed_requests']}", "",
                  "| カテゴリ | n | 正答率 | 平均スコア | 誤り率 |", "|---|---:|---:|---:|---:|"]
        for k, v in s["by_category"].items():
            lines.append(f"| {k} | {v['n']} | {v['pass_rate']*100:.0f}% | {v['mean_score']} | {v['error_rate']*100:.0f}% |")
    return "\n".join(lines) + "\n"


def target_desc(t: dict) -> str:
    if t.get("type") == "http":
        return f"http {t.get('url')}"
    s = t.get("search") or {"type": "none"}
    sd = s.get("type") + (f":{s['engine']}" if s.get("engine") else "")
    return f"{t.get('model')} / search={sd} / prompt={t.get('system_prompt_file') or ('inline' if t.get('system_prompt') else 'none')}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--questions", help="質問ファイル (config の questions を上書き)")
    ap.add_argument("--name", help="実行名 (config の name を上書き)")
    ap.add_argument("--set", action="append", default=[], metavar="KEY=VALUE",
                    help="config の値を上書き。例: --set target.model=openai/gpt-5.5 --set target.search.type=none")
    ap.add_argument("--limit", type=int, help="先頭 N 問だけ (動作確認用)")
    ap.add_argument("--ids", help="カンマ区切りの質問 ID だけ実行")
    ap.add_argument("--category", help="このカテゴリだけ実行")
    ap.add_argument("--repeat", type=int, help="各質問を何回ずつ回すか (ばらつき確認)")
    ap.add_argument("--concurrency", type=int, default=4)
    args = ap.parse_args()

    load_env()
    cfg = json.loads(Path(args.config).read_text(encoding="utf-8"))
    for kv in args.set:
        k, v = kv.split("=", 1)
        set_path(cfg, k, v)
    if args.name:
        cfg["name"] = args.name
    name = cfg.get("name") or Path(args.config).stem
    judge_cfg = {**DEFAULT_JUDGE, **(cfg.get("judge") or {})}
    repeat = args.repeat or cfg.get("repeat", 1)
    qfile = Path(args.questions or cfg.get("questions", "questions/gov_basic.jsonl"))
    if not qfile.is_absolute() and not qfile.exists():
        qfile = BENCH_DIR / qfile
    questions = read_jsonl(qfile)
    if args.ids:
        want = set(args.ids.split(","))
        questions = [q for q in questions if q["id"] in want]
    if args.category:
        questions = [q for q in questions if q.get("category") == args.category]
    if args.limit:
        questions = questions[: args.limit]

    started = dt.datetime.now()
    out_dir = BENCH_DIR / "results" / f"{started:%Y%m%d-%H%M%S}_{name}"
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = {"name": name, "started_at": started.isoformat(timespec="seconds"), "git": git_rev(),
            "questions_file": str(qfile.relative_to(BENCH_DIR)) if qfile.is_relative_to(BENCH_DIR) else str(qfile),
            "repeat": repeat, "target_desc": target_desc(cfg["target"]), "judge_model": judge_cfg["model"]}
    saved_cfg = copy.deepcopy(cfg)
    saved_cfg["judge"] = judge_cfg
    (out_dir / "config.json").write_text(json.dumps(saved_cfg, ensure_ascii=False, indent=2), encoding="utf-8")

    jobs = [(q, k) for q in questions for k in range(repeat)]
    print(f"▶ {name}: {len(questions)} 問 × {repeat} 回 = {len(jobs)} 件  [{meta['target_desc']}]", flush=True)
    lock = threading.Lock()
    rows = []
    fout = (out_dir / "results.jsonl").open("w", encoding="utf-8")

    def work(q, k):
        row = {"id": q["id"], "trial": k, "category": q.get("category", "other"), "question": q["question"]}
        try:
            a = run_target(q["question"], cfg["target"])
            row.update({"answer": a["answer"], "citations": a["citations"], "latency_s": a["latency_s"],
                        "cost": a.get("cost", 0)})
            row["judge"] = judge(q, a["answer"], a["citations"], judge_cfg)
        except Exception as e:  # noqa: BLE001
            row["error"] = f"{type(e).__name__}: {e}"
        return row

    done = 0
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futs = [ex.submit(work, q, k) for q, k in jobs]
        for f in as_completed(futs):
            row = f.result()
            with lock:
                rows.append(row)
                fout.write(json.dumps(row, ensure_ascii=False) + "\n")
                fout.flush()
                done += 1
                mark = "ERR " if row.get("error") else ("PASS" if row["judge"]["pass"] else "FAIL")
                extra = row.get("error", "")[:120] if row.get("error") else f"score={row['judge']['score']}"
                print(f"  [{done}/{len(jobs)}] {mark} {row['id']}#{row['trial']} {extra}", flush=True)
    fout.close()

    summary = summarize(rows, cfg, meta)
    (out_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    md = to_markdown(summary)
    (out_dir / "summary.md").write_text(md, encoding="utf-8")
    print("\n" + md)
    print(f"保存先: {out_dir}")


if __name__ == "__main__":
    main()
