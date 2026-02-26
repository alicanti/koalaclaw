#!/usr/bin/env python3
"""
Wiro AI API client with automatic model discovery and parameter resolution.

Flow:
  1. POST /v1/Tool/List — search models (x-api-key only)
  2. GET  wiro.ai/models/{owner}/{project}/llms-full.txt — parse input params
  3. POST /v1/Run/{owner}/{project} — submit task (HMAC auth)
  4. POST /v1/Task/Detail — poll result (HMAC auth)
"""

import hashlib
import hmac
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

DEFAULT_BASE_URL = "https://api.wiro.ai"
WIRO_SITE = "https://wiro.ai"

TERMINAL_STATUSES = {"task_postprocess_end", "task_cancel"}
SUCCESS_STATUSES = {"task_postprocess_end"}

_model_docs_cache: Dict[str, Dict[str, Any]] = {}


def parse_model_inputs(llms_text: str) -> List[Dict[str, Any]]:
    """Parse the '## Model Inputs:' section of llms-full.txt.

    Returns list of dicts with keys: name, label, help, type, default, options.
    """
    inputs: List[Dict[str, Any]] = []
    section = ""
    m = re.search(r"## Model Inputs:\s*\n(.*?)(?=\n## |\Z)", llms_text, re.DOTALL)
    if not m:
        return inputs
    section = m.group(1)

    current: Optional[Dict[str, Any]] = None
    collecting_options = False

    for line in section.split("\n"):
        stripped = line.strip()

        if stripped.startswith("- name:"):
            if current:
                inputs.append(current)
            current = {
                "name": stripped.split(":", 1)[1].strip(),
                "label": "",
                "help": "",
                "type": "text",
                "default": "",
                "options": [],
                "required": False,
            }
            collecting_options = False
            continue

        if current is None:
            continue

        if stripped.startswith("label:"):
            current["label"] = stripped.split(":", 1)[1].strip()
            collecting_options = False
        elif stripped.startswith("help:"):
            current["help"] = stripped.split(":", 1)[1].strip()
            collecting_options = False
        elif stripped.startswith("type:"):
            current["type"] = stripped.split(":", 1)[1].strip()
            collecting_options = False
        elif stripped.startswith("default:"):
            current["default"] = stripped.split(":", 1)[1].strip()
            collecting_options = False
        elif stripped == "options:":
            collecting_options = True
        elif collecting_options and stripped.startswith("- value:"):
            val = stripped.split(":", 1)[1].strip().strip('"')
            current["options"].append({"value": val, "label": ""})
        elif collecting_options and stripped.startswith("label:") and current["options"]:
            current["options"][-1]["label"] = stripped.split(":", 1)[1].strip()

    if current:
        inputs.append(current)

    return inputs


def build_params_from_docs(inputs: List[Dict[str, Any]], prompt: str, input_image: str = "") -> Dict[str, Any]:
    """Build a Run request body using parsed model inputs.

    Strategy:
    - Find the prompt/text field and set it to the user's prompt
    - If input_image provided, fill the first file-upload field with it
    - For other fields, use sensible defaults from the docs
    """
    params: Dict[str, Any] = {}
    prompt_field_found = False
    image_field_found = False

    prompt_field_names = {"prompt", "text", "input_text", "message", "query"}
    image_field_types = {"combinefileinput", "fileinput", "imageinput"}

    for inp in inputs:
        name = inp["name"]
        field_type = inp["type"]

        if field_type in image_field_types:
            if input_image and not image_field_found:
                params[name] = [input_image]
                image_field_found = True
            continue

        if name.lower() in prompt_field_names or (field_type == "textarea" and not prompt_field_found):
            params[name] = prompt
            prompt_field_found = True
            continue

        if inp["default"]:
            params[name] = inp["default"]
        elif inp["options"]:
            first_non_empty = next((o["value"] for o in inp["options"] if o["value"]), None)
            if first_non_empty:
                params[name] = first_non_empty

    if not prompt_field_found:
        params["prompt"] = prompt

    return params


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
        """HMAC-signed headers for Run/Task endpoints."""
        nonce = str(int(time.time()))
        return {
            "x-api-key": self.api_key,
            "x-nonce": nonce,
            "x-signature": self._sign(nonce),
            "Accept": "application/json",
        }

    def _simple_headers(self) -> dict:
        """Headers for Tool/List (no HMAC)."""
        return {
            "x-api-key": self.api_key,
            "Accept": "application/json",
        }

    def _http(self, method: str, url: str, data: Optional[Dict] = None,
              headers: Optional[dict] = None, timeout: int = 30) -> Dict[str, Any]:
        """Execute HTTP request via curl with multipart/form-data fields.

        Wiro API expects real form fields (-F key=value), not a JSON body.
        Cloudflare WAF also blocks Python urllib's User-Agent.
        """
        cmd = ["curl", "-s", "-S", "-X", method, url, "--max-time", str(timeout)]
        for k, v in (headers or {}).items():
            if k.lower() == "content-type":
                continue
            cmd += ["-H", f"{k}: {v}"]
        if data:
            for k, v in data.items():
                if isinstance(v, (list, dict)):
                    cmd += ["-F", f"{k}={json.dumps(v)}"]
                elif isinstance(v, bool):
                    cmd += ["-F", f"{k}={'true' if v else 'false'}"]
                else:
                    cmd += ["-F", f"{k}={v}"]
        print(f"[WIRO] curl cmd: {' '.join(cmd[:8])}... ({len(cmd)} args)", file=sys.stderr, flush=True)
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
            if result.returncode != 0:
                err = result.stderr.strip()[:300]
                print(f"[WIRO] curl error for {method} {url}: {err}", file=sys.stderr, flush=True)
                raise Exception(f"Wiro request failed: {err}")
            body = result.stdout.strip()
            if not body:
                raise Exception("Empty response from Wiro API")
            parsed = json.loads(body)
            if "/Tool/List" in url:
                tool_count = len(parsed.get("tool") or [])
                print(f"[WIRO] Tool/List response: {tool_count} tools, errors={parsed.get('errors')}, body[:200]={body[:200]}", file=sys.stderr, flush=True)
            return parsed
        except json.JSONDecodeError:
            snippet = result.stdout[:300] if result.stdout else "(empty)"
            print(f"[WIRO] Non-JSON response for {method} {url}: {snippet}", file=sys.stderr, flush=True)
            raise Exception(f"Wiro API returned non-JSON: {snippet[:100]}")
        except subprocess.TimeoutExpired:
            raise Exception(f"Wiro API timeout after {timeout}s")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_secret)

    # ── Model Discovery ──────────────────────────────────────

    def search_models(self, query: str = "text-to-image", limit: int = 10) -> List[Dict[str, Any]]:
        """POST /v1/Tool/List — search Wiro models."""
        url = f"{self.base_url}/v1/Tool/List"
        data = {
            "start": "0",
            "limit": str(limit),
            "search": query,
            "summary": "true",
        }
        result = self._http("POST", url, data=data, headers=self._simple_headers(), timeout=15)
        return (result or {}).get("tool") or []

    def list_models(self, category: Optional[str] = None) -> Dict[str, Any]:
        """Search models by category and return grouped results."""
        search_map = {
            "image": "text-to-image",
            "video": "text-to-video,video-generation,image-to-video",
            "audio": "text-to-speech,text-to-audio",
        }
        queries = search_map.get((category or "").lower(), category or "text-to-image").split(",")
        raw = []
        seen_ids = set()
        for query in queries:
            try:
                batch = self.search_models(query=query.strip(), limit=15)
                for m in batch:
                    mid = m.get("id")
                    if mid and mid not in seen_ids:
                        seen_ids.add(mid)
                        raw.append(m)
            except Exception as e:
                print(f"[WIRO] list_models search '{query}' error: {e}", file=sys.stderr, flush=True)
        if not raw:
            print(f"[WIRO] list_models: no results for {queries}", file=sys.stderr, flush=True)

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
        """Fetch llms-full.txt for a model via curl."""
        url = f"{WIRO_SITE}/models/{owner}/{project}/llms-full.txt"
        try:
            result = subprocess.run(
                ["curl", "-s", "-S", "--max-time", "10", url],
                capture_output=True, text=True, timeout=15,
            )
            return result.stdout if result.returncode == 0 else ""
        except Exception as e:
            print(f"[WIRO] fetch_model_docs error for {owner}/{project}: {e}", file=sys.stderr, flush=True)
            return ""

    def get_model_inputs(self, owner: str, project: str) -> List[Dict[str, Any]]:
        """Fetch and parse model inputs. Results are cached per owner/project."""
        cache_key = f"{owner}/{project}"
        if cache_key in _model_docs_cache:
            return _model_docs_cache[cache_key]

        docs = self.fetch_model_docs(owner, project)
        if not docs or docs.startswith("{"):
            print(f"[WIRO] No valid docs for {cache_key}, using fallback params", file=sys.stderr, flush=True)
            _model_docs_cache[cache_key] = []
            return []

        inputs = parse_model_inputs(docs)
        print(f"[WIRO] Parsed {len(inputs)} inputs for {cache_key}: {[i['name'] for i in inputs]}", file=sys.stderr, flush=True)
        _model_docs_cache[cache_key] = inputs
        return inputs

    def find_best_model(self, task_type: str = "text-to-image") -> Optional[Dict[str, Any]]:
        """Search and return the best fast model for a task type."""
        queries = [task_type]
        if "video" in task_type:
            queries = [task_type, "video-generation", "image-to-video", "video"]

        results = []
        seen_ids = set()
        for q in queries:
            try:
                batch = self.search_models(query=q, limit=15)
                for m in batch:
                    mid = m.get("id")
                    if mid and mid not in seen_ids:
                        seen_ids.add(mid)
                        results.append(m)
            except Exception as e:
                print(f"[WIRO] find_best_model search '{q}' failed: {e}", file=sys.stderr, flush=True)
        print(f"[WIRO] find_best_model: got {len(results)} results for '{task_type}'", file=sys.stderr, flush=True)
        if not results:
            return None

        FAST_OWNERS = {"google", "black-forest-labs", "bytedance", "ideogram", "recraft-ai",
                       "stability-ai", "klingai", "minimax", "runway", "openai",
                       "wan-ai", "pixverse", "elevenlabs", "qwen"}

        def _score(t):
            cats = t.get("categories") or []
            owner = (t.get("cleanslugowner") or "").lower()
            score = 0
            if "fast-inference" in cats:
                score += 10
            if "partner" in cats:
                score += 5
            if owner in FAST_OWNERS:
                score += 8
            stat = t.get("taskstat") or {}
            runs = int(stat.get("runcount") or 0)
            if runs > 10000:
                score += 3
            elif runs > 1000:
                score += 1
            return score

        ranked = sorted(results, key=_score, reverse=True)
        t = ranked[0]
        owner = t.get("cleanslugowner") or ""
        project = t.get("cleanslugproject") or ""
        name = t.get("title") or t.get("seotitle") or f"{owner}/{project}"
        print(f"[WIRO] find_best_model: selected {owner}/{project} ({name}) [score={_score(t)}]", file=sys.stderr, flush=True)
        return {"owner": owner, "project": project, "name": name, "id": t.get("id")}

    def suggest_models(self, task_type: str = "text-to-image", count: int = 3) -> List[Dict[str, Any]]:
        """Return top N models with cost info for user selection."""
        # Use multiple search queries for video to catch all providers
        queries = [task_type]
        if "video" in task_type:
            queries = [task_type, "video-generation", "image-to-video", "video"]
        elif "audio" in task_type or "speech" in task_type:
            queries = [task_type, "text-to-speech", "text-to-audio", "audio"]

        results = []
        seen_ids = set()
        for q in queries:
            try:
                batch = self.search_models(query=q, limit=15)
                for m in batch:
                    mid = m.get("id")
                    if mid and mid not in seen_ids:
                        seen_ids.add(mid)
                        results.append(m)
            except Exception as e:
                print(f"[WIRO] suggest_models search '{q}' failed: {e}", file=sys.stderr, flush=True)
        if not results:
            return []

        FAST_OWNERS = {"google", "black-forest-labs", "bytedance", "ideogram", "recraft-ai",
                       "stability-ai", "klingai", "minimax", "runway", "openai",
                       "wan-ai", "pixverse", "elevenlabs", "qwen"}

        def _score(t):
            cats = t.get("categories") or []
            owner = (t.get("cleanslugowner") or "").lower()
            score = 0
            if "fast-inference" in cats:
                score += 10
            if "partner" in cats:
                score += 5
            if owner in FAST_OWNERS:
                score += 8
            stat = t.get("taskstat") or {}
            runs = int(stat.get("runcount") or 0)
            if runs > 10000:
                score += 3
            elif runs > 1000:
                score += 1
            return score

        def _parse_cost(t):
            dp = t.get("dynamicprice") or ""
            if isinstance(dp, str):
                try:
                    dp = json.loads(dp)
                except Exception:
                    dp = []
            if isinstance(dp, list) and dp:
                price = dp[0].get("price", 0)
                method = dp[0].get("priceMethod", "")
                return price, method
            ac = t.get("approximatelycost")
            if ac:
                return float(ac), "approx"
            return 0, "unknown"

        ranked = sorted(results, key=_score, reverse=True)
        suggestions = []
        seen = set()
        for t in ranked:
            owner = t.get("cleanslugowner") or ""
            project = t.get("cleanslugproject") or ""
            if not owner or not project:
                continue
            key = f"{owner}/{project}"
            if key in seen:
                continue
            seen.add(key)
            price, price_method = _parse_cost(t)
            stat = t.get("taskstat") or {}
            avg_time = ""
            runs = int(stat.get("runcount") or 0)
            success = int(stat.get("successcount") or 0)
            if runs > 0 and float(stat.get("elapsedseconds") or 0) > 0:
                avg_time = f"~{float(stat['elapsedseconds']) / max(success, 1):.0f}s"
            suggestions.append({
                "owner": owner,
                "project": project,
                "name": t.get("title") or t.get("seotitle") or key,
                "description": (t.get("description") or "")[:100],
                "cost": f"${price:.3f}" if price else "free/unknown",
                "cost_raw": price,
                "cost_method": price_method,
                "avg_time": avg_time or t.get("computingtime", ""),
                "runs": runs,
                "cover": t.get("image") or "",
            })
            if len(suggestions) >= count:
                break

        return suggestions

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

    def generate(self, owner: str, project: str, params: Dict[str, Any], poll_timeout: int = 300) -> Dict[str, Any]:
        """Submit run then poll until done. Returns dict with output_url."""
        run_result = self.run(owner, project, params)
        errors = run_result.get("errors") or []
        if errors:
            return {"status": "error", "success": False, "message": "; ".join(str(e) for e in errors)}
        task_id = run_result.get("taskid")
        if not task_id:
            return {"status": "error", "success": False, "message": "No taskid in run response"}
        return self.poll_task(str(task_id), timeout=poll_timeout)

    def smart_generate(self, prompt: str, task_type: str = "text-to-image", input_image: str = "") -> Dict[str, Any]:
        """Full pipeline: find model -> fetch docs -> build params -> generate -> poll.

        1. Search Tool/List for best model matching task_type
        2. Fetch llms-full.txt and parse input parameters
        3. Build request body with correct field names and defaults
        4. If input_image provided, pass it to the image input field
        5. Submit Run and poll Task/Detail until done
        """
        model = self.find_best_model(task_type)
        if not model or not model.get("owner"):
            return {"status": "error", "success": False, "message": f"No model found for '{task_type}'"}

        owner, project = model["owner"], model["project"]
        model_name = model.get("name", f"{owner}/{project}")
        print(f"[WIRO] smart_generate: selected '{model_name}' ({owner}/{project}), input_image={'yes' if input_image else 'no'}", file=sys.stderr, flush=True)

        inputs = self.get_model_inputs(owner, project)
        if inputs:
            params = build_params_from_docs(inputs, prompt, input_image=input_image)
            print(f"[WIRO] smart_generate: built params from docs: {list(params.keys())}", file=sys.stderr, flush=True)
        else:
            params = {"prompt": prompt}
            if input_image:
                params["inputImage"] = input_image
            print(f"[WIRO] smart_generate: no docs, fallback params: {list(params.keys())}", file=sys.stderr, flush=True)

        result = self.generate(owner, project, params)
        result["model_used"] = model_name
        result["model_owner"] = owner
        result["model_project"] = project
        return result
