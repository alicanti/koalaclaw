#!/usr/bin/env python3
"""
Wiro AI API client.
Based on real API docs from https://wiro.ai/models/{owner}/{project}/llms-full.txt

Endpoints (all under /v1):
  POST /v1/Run/{owner}/{project}  — submit a generation task
  POST /v1/Task/Detail            — poll task status (field: taskid or tasktoken)
  POST /v1/Task/Kill              — cancel a running task
  POST /v1/Task/Cancel            — cancel a queued task

Auth headers:
  x-api-key: API key
  x-nonce: unix timestamp (or any random integer)
  x-signature: HMAC-SHA256 of (secret + nonce) with key = api_key

Content-Type: multipart/form-data (Wiro expects this header even for JSON payloads)

Task statuses:
  Terminal (done):  task_postprocess_end (success), task_cancel (cancelled)
  Running (poll):   task_queue, task_accept, task_assign, task_preprocess_start,
                    task_preprocess_end, task_start, task_output
"""

import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "https://api.wiro.ai"

TERMINAL_STATUSES = {"task_postprocess_end", "task_cancel"}
SUCCESS_STATUSES = {"task_postprocess_end"}
FAILURE_STATUSES = {"task_cancel"}

CURATED_MODELS: List[Dict[str, Any]] = [
    {"owner": "google", "project": "nano-banana-pro", "name": "Nano Banana Pro (Gemini 3 Pro)", "description": "Google Gemini 3 Pro — text-to-image and image-to-image generation", "category": "Image"},
    {"owner": "black-forest-labs", "project": "flux-1-1-pro-ultra", "name": "FLUX 1.1 Pro Ultra", "description": "High-quality text-to-image generation by Black Forest Labs", "category": "Image"},
    {"owner": "black-forest-labs", "project": "flux-1-1-pro", "name": "FLUX 1.1 Pro", "description": "Fast text-to-image generation by Black Forest Labs", "category": "Image"},
    {"owner": "stability-ai", "project": "stable-diffusion-3-5-large", "name": "Stable Diffusion 3.5 Large", "description": "Stability AI text-to-image model", "category": "Image"},
    {"owner": "ideogram", "project": "ideogram-v3", "name": "Ideogram V3", "description": "Advanced text-to-image with excellent typography", "category": "Image"},
    {"owner": "recraft-ai", "project": "recraft-v3", "name": "Recraft V3", "description": "Design-focused image generation", "category": "Image"},
    {"owner": "seedance", "project": "seedance-2-0", "name": "Seedance 2.0", "description": "AI video generation from text or image", "category": "Video"},
    {"owner": "kling-ai", "project": "kling-v2-master", "name": "Kling V2 Master", "description": "High-quality AI video generation", "category": "Video"},
    {"owner": "minimax", "project": "minimax-video-01", "name": "MiniMax Video 01", "description": "Text-to-video generation", "category": "Video"},
    {"owner": "hailuo-ai", "project": "hailuo-video", "name": "Hailuo Video", "description": "AI video generation", "category": "Video"},
    {"owner": "eleven-labs", "project": "eleven-turbo-v2-5", "name": "ElevenLabs Turbo v2.5", "description": "Text-to-speech with natural voices", "category": "Audio"},
    {"owner": "fish-audio", "project": "fish-speech-1-5", "name": "Fish Speech 1.5", "description": "Multilingual text-to-speech", "category": "Audio"},
]


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
        url = f"{self.base_url}/v1{path}"
        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(url, data=body, method=method, headers=self._headers())
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
            import sys
            print(f"[WIRO] HTTP {e.code} {e.reason} for {method} {url}: {err_body}", file=sys.stderr, flush=True)
            raise Exception(f"Wiro API error {e.code}: {err_body or e.reason}") from e

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_secret)

    def list_models(self, category: Optional[str] = None) -> Dict[str, Any]:
        """Return curated model catalog (Wiro has no list endpoint)."""
        models = CURATED_MODELS
        if category:
            models = [m for m in models if m.get("category", "").lower() == category.lower()]
        categories = {}
        for m in CURATED_MODELS:
            cat = m.get("category", "Other")
            categories.setdefault(cat, []).append(m)
        return {"models": models, "categories": categories}

    def run(self, owner: str, project: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """POST /v1/Run/{owner}/{project} — submit a generation task."""
        path = f"/Run/{owner}/{project}"
        return self._request("POST", path, data=params, timeout=60)

    def poll_task(self, task_id: str, timeout: int = 120) -> Dict[str, Any]:
        """POST /v1/Task/Detail — poll until terminal status or timeout.

        Returns the first task from tasklist with extracted output_url.
        """
        path = "/Task/Detail"
        deadline = time.time() + timeout
        while time.time() < deadline:
            result = self._request("POST", path, data={"taskid": task_id}, timeout=15)
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
                    "raw": task,
                }
            time.sleep(3)
        return {"status": "timeout", "success": False, "taskid": task_id, "message": "Polling timed out"}

    def generate(
        self, owner: str, project: str, params: Dict[str, Any], poll_timeout: int = 120
    ) -> Dict[str, Any]:
        """Submit run then poll until done. Returns dict with output_url."""
        run_result = self.run(owner, project, params)
        errors = run_result.get("errors") or []
        if errors:
            return {"status": "error", "success": False, "message": "; ".join(str(e) for e in errors), "raw": run_result}
        task_id = run_result.get("taskid")
        if not task_id:
            return {"status": "error", "success": False, "message": "No taskid in run response", "raw": run_result}
        return self.poll_task(str(task_id), timeout=poll_timeout)
