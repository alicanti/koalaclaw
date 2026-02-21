#!/usr/bin/env python3
"""
Wiro AI API client.
Authentication: x-api-key, x-nonce (unix timestamp), x-signature (HMAC-SHA256 of secret+nonce, key=api_key).
"""

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

# Default base URL for Wiro API (override via env if needed)
DEFAULT_BASE_URL = "https://api.wiro.ai"
MODELS_CACHE_TTL = 300  # 5 minutes


class WiroClient:
    def __init__(self, api_key: str, api_secret: str, base_url: Optional[str] = None):
        self.api_key = (api_key or "").strip()
        self.api_secret = (api_secret or "").strip()
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")
        self._models_cache: Optional[Dict[str, Any]] = None
        self._models_cache_time: float = 0

    def _sign(self, nonce: str) -> str:
        """HMAC-SHA256 of {secret}{nonce} with key as API key."""
        message = f"{self.api_secret}{nonce}"
        sig = hmac.new(
            self.api_key.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return sig

    def _headers(self) -> dict:
        nonce = str(int(time.time()))
        return {
            "x-api-key": self.api_key,
            "x-nonce": nonce,
            "x-signature": self._sign(nonce),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(url, data=body, method=method, headers=self._headers())
        if body:
            req.add_header("Content-Length", str(len(body)))
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_secret)

    def list_models(self, category: Optional[str] = None) -> Dict[str, Any]:
        """GET models; optional category filter. Cached 5 minutes."""
        now = time.time()
        if self._models_cache is not None and (now - self._models_cache_time) < MODELS_CACHE_TTL:
            raw = self._models_cache
        else:
            raw = self._request("GET", "/models")
            self._models_cache = raw
            self._models_cache_time = now

        if not category:
            return raw

        # Filter by category if response has categories/list structure
        if isinstance(raw, dict) and "categories" in raw:
            cats = raw.get("categories", {})
            if category in cats:
                return {"category": category, "models": cats[category]}
            return {"category": category, "models": []}
        if isinstance(raw, list):
            filtered = [m for m in raw if (m.get("category") or m.get("type")) == category]
            return {"category": category, "models": filtered}
        return raw

    def run(self, owner: str, project: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """POST /Run/{owner}/{project} — submit a run job."""
        path = f"/Run/{owner}/{project}"
        return self._request("POST", path, data=params, timeout=60)

    def poll_task(self, token: str, timeout: int = 120) -> Dict[str, Any]:
        """POST /Task/Detail — poll until task completes or timeout."""
        path = "/Task/Detail"
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self._request("POST", path, data={"token": token}, timeout=15)
            status = (result or {}).get("status", "").lower()
            if status in ("completed", "success", "done", "finished"):
                return result
            if status in ("failed", "error", "cancelled"):
                return result
            time.sleep(2)
        return {"status": "timeout", "token": token, "message": "Polling timed out"}

    def generate(
        self, owner: str, project: str, params: Dict[str, Any], poll_timeout: int = 120
    ) -> Dict[str, Any]:
        """Submit run and poll until done; return final result."""
        run_result = self.run(owner, project, params)
        token = (run_result or {}).get("token") or (run_result or {}).get("task_id") or (run_result or {}).get("id")
        if not token:
            return run_result or {"status": "error", "message": "No task token in run response"}
        return self.poll_task(str(token), timeout=poll_timeout)
