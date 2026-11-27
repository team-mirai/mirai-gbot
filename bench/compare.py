#!/usr/bin/env python3
"""複数の実行結果を比較する。

  python3 bench/compare.py                       # results/ の全実行を一覧
  python3 bench/compare.py --last 3              # 直近 3 件
  python3 bench/compare.py results/A results/B   # A を基準に B を比較 (問題ごとの改善/悪化も表示)
  python3 bench/compare.py --filter gpt          # 名前やターゲットに "gpt" を含むものだけ
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import BENCH_DIR, read_jsonl  # noqa: E402


def load_run(d: Path) -> dict:
    s = json.loads((d / "summary.json").read_text(encoding="utf-8"))
    rows = read_jsonl(d / "results.jsonl") if (d / "results.jsonl").exists() else []
    per_q = defaultdict(list)
    for r in rows:
        if not r.get("error"):
            per_q[r["id"]].append(r["judge"])
    s["_per_q"] = {k: {"pass": sum(j["pass"] for j in v) / len(v),
                       "score": sum(j["score"] for j in v) / len(v)} for k, v in per_q.items()}
    s["_dir"] = d
    return s


def pct(x):
    return "-" if x is None else f"{x*100:.1f}%"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("runs", nargs="*", help="結果ディレクトリ (省略時は results/ の全て)")
    ap.add_argument("--last", type=int)
    ap.add_argument("--filter")
    ap.add_argument("--category", action="store_true", help="カテゴリ別の正答率も表示")
    args = ap.parse_args()

    if args.runs:
        dirs = [Path(r) if Path(r).exists() else BENCH_DIR / r for r in args.runs]
    else:
        dirs = sorted(p for p in (BENCH_DIR / "results").iterdir() if (p / "summary.json").exists())
    runs = [load_run(d) for d in dirs]
    if args.filter:
        runs = [r for r in runs if args.filter in r["name"] or args.filter in r["target_desc"]]
    if args.last:
        runs = runs[-args.last:]
    if not runs:
        sys.exit("比較する結果がありません")

    judges = {r["judge_model"] for r in runs}
    qfiles = {r["questions_file"] for r in runs}
    if len(judges) > 1:
        print(f"⚠ judge モデルが混在しています {judges}: スコアを直接比較できません\n")
    if len(qfiles) > 1:
        print(f"⚠ 質問セットが混在しています {qfiles}\n")

    base = runs[0]
    print("| 実行 | ターゲット | n | 正答率 | 95%CI | Δ正答率 | 平均スコア | 誤り率 | 出典 | 公的出典 | p50秒 | コスト$ |")
    print("|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|")
    for r in runs:
        o = r["overall"]
        if not o.get("n"):
            print(f"| {r['_dir'].name} | {r['target_desc']} | 0 | - | - | - | - | - | - | - | - | - |")
            continue
        delta = "" if r is base else f"{(o['pass_rate'] - base['overall'].get('pass_rate', 0))*100:+.1f}pt"
        ci = f"{o['pass_rate_ci95'][0]*100:.0f}–{o['pass_rate_ci95'][1]*100:.0f}"
        cost = r["cost_usd"]["answer"] + r["cost_usd"]["judge"]
        print(f"| {r['_dir'].name} | {r['target_desc']} | {o['n']} | {pct(o['pass_rate'])} | {ci} | {delta} | "
              f"{o['mean_score']} | {pct(o['error_rate'])} | {pct(o['grounded_rate'])} | {pct(o.get('official_source_rate'))} | {r['latency_s']['p50']} | {cost:.3f} |")

    if args.category:
        cats = sorted({c for r in runs for c in r["by_category"]})
        print("\n| カテゴリ | " + " | ".join(r["_dir"].name for r in runs) + " |")
        print("|---|" + "---:|" * len(runs))
        for c in cats:
            cells = [pct(r["by_category"].get(c, {}).get("pass_rate")) for r in runs]
            print(f"| {c} | " + " | ".join(cells) + " |")

    if len(runs) == 2:
        a, b = runs
        common_ids = sorted(set(a["_per_q"]) & set(b["_per_q"]))
        better = [(i, a["_per_q"][i], b["_per_q"][i]) for i in common_ids if b["_per_q"][i]["pass"] > a["_per_q"][i]["pass"]]
        worse = [(i, a["_per_q"][i], b["_per_q"][i]) for i in common_ids if b["_per_q"][i]["pass"] < a["_per_q"][i]["pass"]]
        print(f"\n## 問題ごとの変化 ({a['_dir'].name} → {b['_dir'].name})")
        print(f"改善 {len(better)} 問 / 悪化 {len(worse)} 問 / 共通 {len(common_ids)} 問")
        for label, xs in (("✅ 改善", better), ("❌ 悪化", worse)):
            for i, x, y in xs:
                print(f"  {label} {i}: 正答 {pct(x['pass'])}→{pct(y['pass'])}  スコア {x['score']:.0f}→{y['score']:.0f}")


if __name__ == "__main__":
    main()
