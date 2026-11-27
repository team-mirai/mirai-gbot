"""共通ユーティリティ: .env 読み込み、HTTP、OpenRouter 呼び出し。標準ライブラリのみ。"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

BENCH_DIR = Path(__file__).resolve().parent
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def load_env() -> None:
    """カレントから上位ディレクトリに向かって .env.local / .env を探し、未設定の変数だけ読み込む。
    (worktree の中から実行してもメインチェックアウトの .env.local が見つかる)"""
    seen = set()
    for d in [BENCH_DIR, *BENCH_DIR.parents]:
        for name in (".env.local", ".env"):
            p = d / name
            if p.is_file() and p not in seen:
                seen.add(p)
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    v = v.strip().strip('"').strip("'")
                    if v:
                        os.environ.setdefault(k.strip(), v)


def http_json(url: str, body: Optional[dict], headers: Dict[str, str], timeout: float = 180,
              retries: int = 3, method: str = "POST") -> Any:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    last_err: Optional[Exception] = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"Content-Type": "application/json", **headers})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode("utf-8")
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return raw
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:500]
            last_err = RuntimeError(f"HTTP {e.code} from {url}: {msg}")
            if e.code < 500 and e.code != 429:
                break
        except Exception as e:  # noqa: BLE001 (timeout / connection)
            last_err = e
        time.sleep(2 ** attempt * 2)
    raise last_err  # type: ignore[misc]


def openrouter_chat(model: str, messages: List[dict], *, temperature: Optional[float] = None,
                    max_tokens: Optional[int] = None, plugins: Optional[list] = None,
                    response_format: Optional[dict] = None, extra: Optional[dict] = None) -> dict:
    """OpenRouter を呼び、{text, citations, usage, cost, raw} を返す。"""
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY が未設定です (.env.local に書いてください)")
    body: dict = {"model": model, "messages": messages, "usage": {"include": True}}
    if temperature is not None:
        body["temperature"] = temperature
    if max_tokens is not None:
        body["max_tokens"] = max_tokens
    if plugins:
        body["plugins"] = plugins
    if response_format:
        body["response_format"] = response_format
    if extra:
        body.update(extra)
    res = http_json(OPENROUTER_URL, body, {"Authorization": f"Bearer {key}",
                                           "X-Title": "mirai-gbot-bench"})
    if not isinstance(res, dict) or "choices" not in res:
        raise RuntimeError(f"unexpected OpenRouter response: {str(res)[:500]}")
    msg = res["choices"][0]["message"]
    citations = []
    for a in msg.get("annotations") or []:
        if a.get("type") == "url_citation":
            c = a.get("url_citation", {})
            citations.append({"url": c.get("url"), "title": c.get("title")})
    usage = res.get("usage") or {}
    return {"text": msg.get("content") or "", "citations": citations, "usage": usage,
            "cost": usage.get("cost") or 0.0, "raw_model": res.get("model")}


def read_jsonl(path: Path) -> List[dict]:
    out = []
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if line and not line.startswith("//"):
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise SystemExit(f"{path}:{i}: JSON エラー: {e}")
    return out
