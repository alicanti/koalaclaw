#!/usr/bin/env python3
"""
Wiro AI API client.

Model discovery:
  POST /v1/Tool/List  — search models (only x-api-key, no HMAC needed)
  GET  https://wiro.ai/models/{owner}/{project}/llms-full.txt — model docs

Generation:
  POST /v1/Run/{owner}/{project}  — submit task (HMAC auth)
  POST /v1/Task/Detail            — poll status (HMAC auth)

Auth for Run/Task:
  x-api-key, x-nonce (unix ts), x-signature (HMAC-SHA256 of secret+nonce keyed by api_key)

Task statuses:
  Done:    task_postprocess_end (success), task_cancel (cancelled)
  Running: task_queue, task_accept, task_assign, task_preprocess_start/end, task_start, task_output
"""

import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "https://api.wiro.ai"
WIRO_SITE = "https://wiro.ai"

TERMINAL_STATUSES = {"task_postprocess_end", "task_cancel"}
SUCCESS_STATUSES = {"task_postprocess_end"}


class WiroClient:
    def __init__(self, api_key: str, api_secret: str, base_url: Optional[str] = None):
        self.api_key = (api_key or "").strip()
        self.api_secret = (api_secret or "").strip()
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")

    def _sign(self, nonce: str) -> str:
        message = f"{self.api_secret}{nonce}"
        return hmac.new(
            self.api_key.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def _signed_headers(self) -> dict:
        nonce = str(int(time.time()))
        return {
            "x-api-key": self.api_key,
            "x-nonce": nonce,
            "x-signature": self._sign(nonce),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _simple_headers(self) -> dict:
        return {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _http(self, method: str, url: str, data: Optional[Dict] = None,
              headers: Optional[dict] = None, timeout: int = 30) -> Dict[str, Any]:
        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
        if body:
            req.add_header("Content-Length", str(len(body)))
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", errors="replace")[:500]
            except Exception:
                pass
            print(f"[WIRO] HTTP {e.code} {e.reason} for {method} {url}: {err_body}", file=sys.stderr, flush=True)
            raise Exception(f"Wiro API error {e.code}: {err_body or e.reason}") from e

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_secret)

    # ── Model Discovery ──────────────────────────────────────

    def search_models(self, query: str = "text-to-image", limit: int = 10) -> List[Dict[str, Any]]:
        """POST /v1/Tool/List — search Wiro models. Response key is 'tool' (singular)."""
        url = f"{self.base_url}/v1/Tool/List"
        data = {
            "start": "0",
            "limit": str(limit),
            "sort": "relevance",
            "order": "DESC",
            "ischat": 0,
            "onlyfavorites": False,
            "hideworkflows": True,
            "search": query,
            "summary": True,
        }
        result = self._http("POST", url, data=data, headers=self._simple_headers(), timeout=15)
        return (result or {}).get("tool") or []

    def list_models(self, category: Optional[str] = None) -> Dict[str, Any]:
        """Search models by category and return grouped results."""
        search_map = {
            "image": "text-to-image",
            "video": "text-to-video",
            "audio": "text-to-speech",
        }
        query = search_map.get((category or "").lower(), category or "text-to-image")
        try:
            raw = self.search_models(query=query, limit=12)
        except Exception as e:
            print(f"[WIRO] search_models error: {e}", file=sys.stderr, flush=True)
            raw = []

        models = []
        for t in raw:
            owner = t.get("cleanslugowner") or ""
            project = t.get("cleanslugproject") or ""
            if not owner or not project:
                continue
            models.append({
                "owner": owner,
                "project": project,
                "name": t.get("title") or f"{owner}/{project}",
                "description": (t.get("description") or "")[:120],
                "category": category or "Image",
                "id": t.get("id"),
                "cover": t.get("cover") or "",
            })

        categories = {}
        for m in models:
            cat = m.get("category", "Other")
            categories.setdefault(cat, []).append(m)
        return {"models": models, "categories": categories}

    def fetch_model_docs(self, owner: str, project: str) -> str:
        """Fetch llms-full.txt for a model to get input params and examples."""
        url = f"{WIRO_SITE}/models/{owner}/{project}/llms-full.txt"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"[WIRO] fetch_model_docs error for {owner}/{project}: {e}", file=sys.stderr, flush=True)
            return ""

    def find_best_model(self, task_type: str = "text-to-image") -> Optional[Dict[str, Any]]:
        """Search and return the top model for a task type."""
        results = self.search_models(query=task_type, limit=3)
        if not results:
            return None
        t = results[0]
        return {
            "owner": t.get("cleanslugowner") or "",
            "project": t.get("cleanslugproject") or "",
            "name": t.get("title") or "",
            "id": t.get("id"),
        }

    # ── Generation ────────────────────────────────────────────

    def run(self, owner: str, project: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """POST /v1/Run/{owner}/{project} — submit a generation task."""
        url = f"{self.base_url}/v1/Run/{owner}/{project}"
        return self._http("POST", url, data=params, headers=self._signed_headers(), timeout=60)

    def poll_task(self, task_id: str, timeout: int = 120) -> Dict[str, Any]:
        """POST /v1/Task/Detail — poll until terminal status or timeout."""
        url = f"{self.base_url}/v1/Task/Detail"
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self._http("POST", url, data={"taskid": task_id}, headers=self._signed_headers(), timeout=15)
            tasklist = (result or {}).get("tasklist") or []
            if not tasklist:
                time.sleep(3)
                continue
            task = tasklist[0]
            status = (task.get("status") or "").strip()
            if status in TERMINAL_STATUSES:
                outputs = task.get("outputs") or []
                output_url = outputs[0].get("url") if outputs else None
                return {
                    "status": status,
                    "success": status in SUCCESS_STATUSES,
                    "taskid": task.get("id"),
                    "output_url": output_url,
                    "outputs": outputs,
                    "elapsed": task.get("elapsedseconds"),
                }
            time.sleep(3)
        return {"status": "timeout", "success": False, "taskid": task_id, "message": "Polling timed out"}

    def generate(self, owner: str, project: str, params: Dict[str, Any], poll_timeout: int = 120) -> Dict[str, Any]:
        """Submit run then poll until done. Returns dict with output_url."""
        run_result = self.run(owner, project, params)
        errors = run_result.get("errors") or []
        if errors:
            return {"status": "error", "success": False, "message": "; ".join(str(e) for e in errors)}
        task_id = run_result.get("taskid")
        if not task_id:
            return {"status": "error", "success": False, "message": "No taskid in run response"}
        return self.poll_task(str(task_id), timeout=poll_timeout)

    def smart_generate(self, prompt: str, task_type: str = "text-to-image") -> Dict[str, Any]:
        """Find best model, generate, return result with output_url."""
        model = self.find_best_model(task_type)
        if not model or not model.get("owner"):
            return {"status": "error", "success": False, "message": f"No model found for '{task_type}'"}
        owner, project = model["owner"], model["project"]
        print(f"[WIRO] smart_generate: using {owner}/{project} for '{prompt[:80]}'", file=sys.stderr, flush=True)
        return self.generate(owner, project, {"prompt": prompt, "resolution": "1K", "safetySetting": "OFF"})
