"""ベンチマーク対象 (target) と検索ツール (search) のアダプタ。

target.type:
  - "openrouter": モデル + システムプロンプト + 検索ツールを直接組み合わせて回答させる
                  (アプリが出来る前の比較・モデル/検索ツールの差し替え実験用)
  - "http":       デプロイ済み/ローカルの G ボット API を叩く (本番と同じパイプラインを測る)

search.type (openrouter target のときのみ):
  - "none":            検索なし
  - "openrouter_web":  OpenRouter の web プラグイン (engine: "exa" | "native" など)
  - "tavily":          Tavily で検索し、結果をプロンプトに埋め込む (要 TAVILY_API_KEY)
新しい検索ツールは SEARCHERS に関数を足すだけで増やせる。
"""
from __future__ import annotations

import os
import time
from typing import Callable, Dict, List

from common import BENCH_DIR, http_json, openrouter_chat


# ---------- 検索ツール (取得して埋め込む型) ----------

def search_tavily(query: str, cfg: dict) -> List[dict]:
    key = os.environ.get("TAVILY_API_KEY")
    if not key:
        raise RuntimeError("TAVILY_API_KEY が未設定です")
    res = http_json("https://api.tavily.com/search", {
        "query": query,
        "max_results": cfg.get("max_results", 5),
        "search_depth": cfg.get("search_depth", "basic"),
        "include_domains": cfg.get("include_domains") or [],
    }, {"Authorization": f"Bearer {key}"})
    return [{"url": r.get("url"), "title": r.get("title"), "content": r.get("content", "")}
            for r in res.get("results", [])]


SEARCHERS: Dict[str, Callable[[str, dict], List[dict]]] = {
    "tavily": search_tavily,
}


def _format_docs(docs: List[dict]) -> str:
    parts = []
    for i, d in enumerate(docs, 1):
        parts.append(f"[{i}] {d.get('title') or ''}\nURL: {d.get('url')}\n{(d.get('content') or '')[:2000]}")
    return "\n\n".join(parts)


# ---------- target 実装 ----------

def _load_prompt(cfg: dict) -> str:
    if cfg.get("system_prompt"):
        return cfg["system_prompt"]
    if cfg.get("system_prompt_file"):
        return (BENCH_DIR / cfg["system_prompt_file"]).read_text(encoding="utf-8")
    return ""


def answer_openrouter(question: str, target: dict) -> dict:
    search = target.get("search") or {"type": "none"}
    stype = search.get("type", "none")
    system = _load_prompt(target)
    messages = []
    if system:
        messages.append({"role": "system", "content": system})

    plugins = None
    retrieved: List[dict] = []
    user_content = question
    if stype == "openrouter_web":
        p = {"id": "web", "max_results": search.get("max_results", 5)}
        if search.get("engine"):
            p["engine"] = search["engine"]
        plugins = [p]
    elif stype in SEARCHERS:
        retrieved = SEARCHERS[stype](question, search)
        user_content = (f"以下は検索結果です。必要に応じて参照し、出典 URL を示して回答してください。\n\n"
                        f"{_format_docs(retrieved)}\n\n---\n質問: {question}")
    elif stype != "none":
        raise RuntimeError(f"未知の search.type: {stype}")
    messages.append({"role": "user", "content": user_content})

    r = openrouter_chat(target["model"], messages, temperature=target.get("temperature"),
                        max_tokens=target.get("max_tokens"), plugins=plugins,
                        extra=target.get("extra"))
    cites = r["citations"] or [{"url": d["url"], "title": d["title"]} for d in retrieved]
    return {"answer": r["text"], "citations": cites, "cost": r["cost"], "usage": r["usage"]}


def _dig(obj, path: str):
    for k in path.split("."):
        if k == "":
            continue
        obj = obj[int(k)] if isinstance(obj, list) else obj[k]
    return obj


def answer_http(question: str, target: dict) -> dict:
    """G ボット API を呼ぶ。リクエスト形は body_template の "{{question}}" を置換して作る。
    例: {"url": "http://localhost:3000/api/chat",
         "body_template": {"messages": [{"role": "user", "content": "{{question}}"}]},
         "answer_path": "answer", "citations_path": "citations"}"""
    import json as _json
    tmpl = target.get("body_template") or {"messages": [{"role": "user", "content": "{{question}}"}]}
    body = _json.loads(_json.dumps(tmpl).replace("{{question}}", _json.dumps(question)[1:-1]))
    headers = dict(target.get("headers") or {})
    for k, envname in (target.get("headers_from_env") or {}).items():
        headers[k] = os.environ.get(envname, "")
    res = http_json(target["url"], body, headers, timeout=target.get("timeout", 300))
    if isinstance(res, str):  # ストリーミング/プレーンテキスト応答
        return {"answer": res, "citations": [], "cost": 0.0, "usage": {}}
    answer = _dig(res, target.get("answer_path", "answer"))
    cites = []
    if target.get("citations_path"):
        try:
            cites = _dig(res, target["citations_path"]) or []
        except (KeyError, IndexError, TypeError):
            cites = []
    cost = 0.0
    if target.get("cost_path"):
        try:
            cost = float(_dig(res, target["cost_path"]) or 0)
        except (KeyError, IndexError, TypeError, ValueError):
            pass
    return {"answer": answer, "citations": cites, "cost": cost, "usage": {}}


TARGETS = {"openrouter": answer_openrouter, "http": answer_http}


def run_target(question: str, target: dict) -> dict:
    fn = TARGETS.get(target.get("type", "openrouter"))
    if not fn:
        raise RuntimeError(f"未知の target.type: {target.get('type')}")
    t0 = time.time()
    out = fn(question, target)
    out["latency_s"] = round(time.time() - t0, 2)
    return out
