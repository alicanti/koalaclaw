#!/usr/bin/env python3
"""
KoalaClaw Admin API Server
Provides REST + WebSocket endpoints for the KoalaClaw UI.
Runs on port 3099 by default.
"""

import asyncio
import json
import os
import re
import subprocess
import time
import hashlib
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from http import HTTPStatus
import threading
import urllib.parse
import urllib.request
import socket

try:
    from wiro_client import WiroClient
except ImportError:
    WiroClient = None

try:
    import vector_store
except ImportError:
    vector_store = None

# ─── Configuration ───────────────────────────────────────────────
API_PORT = int(os.environ.get("KOALACLAW_API_PORT", "3099"))
INSTALL_DIR = os.environ.get("KOALACLAW_INSTALL_DIR", "/opt/koalaclaw")
STATE_FILE = os.path.join(INSTALL_DIR, ".koalaclaw.state")
UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")
ROLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roles")
DATA_DIR = os.path.join(INSTALL_DIR, "data")
SETTINGS_FILE = os.path.join(INSTALL_DIR, ".settings.json")

# Allowed agent file paths (relative to agent dir): workspace root or mind/
AGENT_EDITABLE_FILES = [
    "workspace/IDENTITY.md",
    "workspace/SOUL.md",
    "workspace/AGENTS.md",
    "workspace/COGNITIVE_PROTOCOL.md",
    "mind/PROFILE.md",
    "mind/PROJECTS.md",
    "mind/DECISIONS.md",
    "mind/ERRORS.md",
    "mind/PROTOCOL.md",
]

# ─── State Management ────────────────────────────────────────────
def load_state():
    """Load state from .koalaclaw.state bash file."""
    state = {}
    if not os.path.exists(STATE_FILE):
        return state
    with open(STATE_FILE, "r") as f:
        for line in f:
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            # Remove surrounding quotes
            value = value.strip('"').strip("'")
            state[key.strip()] = value
    return state


def get_orchestrator_agent_id(state=None):
    """Return first agent ID whose role is orchestrator-koala, or 1 as fallback."""
    state = state or load_state()
    count = int(state.get("AGENT_COUNT", "0"))
    for i in range(1, count + 1):
        if state.get(f"ROLE_{i}") == "orchestrator-koala":
            return i
    return 1


def get_agents_from_state(state):
    """Extract agent info from state."""
    agents = []
    count = int(state.get("AGENT_COUNT", "0"))
    start_port = int(state.get("START_PORT", "3001"))
    server_ip = state.get("SERVER_IP", "127.0.0.1")
    model = state.get("MODEL", "unknown")

    for i in range(1, count + 1):
        token = state.get(f"TOKEN_{i}", "")
        role = state.get(f"ROLE_{i}", "coder-koala")
        port = start_port + i - 1

        # Get role info
        role_info = get_role_info(role)

        agents.append({
            "id": i,
            "name": role_info.get("name", f"Agent {i}"),
            "emoji": role_info.get("emoji", "🐨"),
            "role": role_info.get("role_title", role),
            "role_id": role,
            "port": port,
            "token": token,
            "url": f"http://{server_ip}:{port}",
            "canvas_url": f"http://{server_ip}:{port}/#token={token}",
            "model": model,
            "status": "unknown",
            "state": "idle",
        })
    return agents


def get_role_info(role_id):
    """Read role info from IDENTITY.md."""
    identity_path = os.path.join(ROLES_DIR, role_id, "IDENTITY.md")
    info = {"name": role_id, "emoji": "🐨", "role_title": role_id}

    if not os.path.exists(identity_path):
        return info

    with open(identity_path, "r") as f:
        for line in f:
            if line.startswith("**Name:**"):
                info["name"] = line.split("**Name:**")[1].strip()
            elif line.startswith("**Emoji:**"):
                info["emoji"] = line.split("**Emoji:**")[1].strip()
            elif line.startswith("**Role:**"):
                info["role_title"] = line.split("**Role:**")[1].strip()
    return info


def get_all_roles():
    """List all available roles."""
    roles = []
    if not os.path.isdir(ROLES_DIR):
        return roles
    for name in sorted(os.listdir(ROLES_DIR)):
        role_dir = os.path.join(ROLES_DIR, name)
        if os.path.isdir(role_dir) and os.path.exists(os.path.join(role_dir, "IDENTITY.md")):
            info = get_role_info(name)
            # Load gamification
            gam_path = os.path.join(role_dir, "gamification.json")
            gamification = {}
            if os.path.exists(gam_path):
                with open(gam_path) as f:
                    gamification = json.load(f)
            # Load skills
            skills_path = os.path.join(role_dir, "skills.json")
            skills = {}
            if os.path.exists(skills_path):
                with open(skills_path) as f:
                    skills = json.load(f)
            # Load desk
            desk_path = os.path.join(role_dir, "desk.json")
            desk = {}
            if os.path.exists(desk_path):
                with open(desk_path) as f:
                    desk = json.load(f)

            roles.append({
                "id": name,
                "name": info["name"],
                "emoji": info["emoji"],
                "role_title": info["role_title"],
                "skills": skills,
                "desk": desk,
                "gamification": gamification,
            })
    return roles


# ─── Settings ───────────────────────────────────────────────────
def load_settings():
    """Load settings from .settings.json (no plain-text secrets in response)."""
    default = {
        "wiro_api_key": "",
        "wiro_api_secret": "",
        "wiro_configured": False,
        "channels": {},
        "default_model": "",
        "agent_count": 0,
    }
    if not os.path.exists(SETTINGS_FILE):
        return default
    try:
        with open(SETTINGS_FILE, "r") as f:
            raw = json.load(f)
        # Mask secrets for GET
        raw["wiro_configured"] = bool(
            (raw.get("wiro_api_key") or "").strip()
            and (raw.get("wiro_api_secret") or "").strip()
        )
        raw["wiro_api_key"] = "***" if raw.get("wiro_api_key") else ""
        raw["wiro_api_secret"] = "***" if raw.get("wiro_api_secret") else ""
        return {**default, **raw}
    except Exception:
        return default


def save_settings(updates):
    """Update settings; only persist allowed keys, keep existing secrets if not provided."""
    current = {}
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                current = json.load(f)
        except Exception:
            pass
    allowed = ("wiro_api_key", "wiro_api_secret", "channels", "default_model", "agent_count")
    for k in allowed:
        if k in updates:
            current[k] = updates[k]
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(current, f, indent=2)
    return load_settings()


def get_wiro_client():
    """Build WiroClient from current settings (for server-side use)."""
    if not WiroClient:
        return None
    raw = {}
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                raw = json.load(f)
        except Exception:
            pass
    # Prefer integrations.wiro, then legacy root keys
    integ = raw.get("integrations", {}).get("wiro", {})
    key = (integ.get("key") or raw.get("wiro_api_key") or "").strip()
    secret = (integ.get("secret") or raw.get("wiro_api_secret") or "").strip()
    if not key or not secret:
        return None
    return WiroClient(api_key=key, api_secret=secret)


# ─── Chat History ────────────────────────────────────────────────
def get_history_path(agent_id):
    """Get the chat history file path for an agent."""
    return os.path.join(DATA_DIR, f"koala-agent-{agent_id}", "chat-history.jsonl")


def read_chat_history(agent_id, limit=100):
    """Read chat history from JSONL file."""
    path = get_history_path(agent_id)
    if not os.path.exists(path):
        return []
    
    entries = []
    try:
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        entries.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except Exception:
        return []
    
    # Return last N entries
    return entries[-limit:] if limit else entries


def append_chat_history(agent_id, role, content, image_base64=None):
    """Append a message to chat history JSONL file + Qdrant vector store."""
    path = get_history_path(agent_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    entry = {
        "role": role,
        "content": content,
        "timestamp": ts,
    }
    if image_base64 is not None:
        entry["image_base64"] = image_base64
    
    try:
        with open(path, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception:
        pass

    if vector_store and content and content.strip():
        try:
            vector_store.add_chat_message(int(agent_id), role, content, ts)
        except Exception:
            pass


# ─── Docker Helpers ──────────────────────────────────────────────
def docker_container_status(agent_id):
    """Get container status for an agent."""
    name = f"koala-agent-{agent_id}"
    try:
        result = subprocess.run(
            ["docker", "inspect", "--format",
             '{"status":"{{.State.Status}}","health":"{{.State.Health.Status}}"}',
             name],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            raw = result.stdout.strip()
            # Fix Go template output
            raw = raw.replace("<nil>", '"unknown"')
            return json.loads(raw)
    except Exception:
        pass
    return {"status": "not_found", "health": "unknown"}


def docker_logs(agent_id, tail=50):
    """Get recent logs from a container."""
    name = f"koala-agent-{agent_id}"
    try:
        result = subprocess.run(
            ["docker", "logs", "--tail", str(tail), "--timestamps", name],
            capture_output=True, text=True, timeout=10
        )
        lines = []
        for line in (result.stdout + result.stderr).strip().split("\n"):
            if line.strip():
                lines.append(line.strip())
        return lines
    except Exception:
        return []


def docker_stats():
    """Get docker stats for all koala containers."""
    try:
        result = subprocess.run(
            ["docker", "stats", "--no-stream", "--format",
             '{"name":"{{.Name}}","cpu":"{{.CPUPerc}}","mem":"{{.MemUsage}}","mem_perc":"{{.MemPerc}}"}'],
            capture_output=True, text=True, timeout=10
        )
        stats = []
        for line in result.stdout.strip().split("\n"):
            if line.strip() and "koala-agent" in line:
                try:
                    stats.append(json.loads(line.strip()))
                except json.JSONDecodeError:
                    pass
        return stats
    except Exception:
        return []


def get_agent_data_dir(agent_id):
    """Return absolute path to agent data directory."""
    return os.path.join(DATA_DIR, f"koala-agent-{agent_id}")


def list_agent_files(agent_id):
    """List editable files for an agent (path relative to agent dir, exists flag)."""
    base = get_agent_data_dir(agent_id)
    out = []
    for rel in AGENT_EDITABLE_FILES:
        full = os.path.join(base, rel)
        out.append({"path": rel, "exists": os.path.isfile(full)})
    return out


def read_agent_file(agent_id, filename):
    """Read content of an agent file. filename is e.g. workspace/IDENTITY.md or mind/PROFILE.md."""
    if filename not in AGENT_EDITABLE_FILES:
        return None
    base = get_agent_data_dir(agent_id)
    full = os.path.join(base, filename)
    if not os.path.isfile(full):
        return ""
    try:
        with open(full, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def write_agent_file(agent_id, filename, content):
    """Write content to agent file and sync to container (workspace and mind)."""
    if filename not in AGENT_EDITABLE_FILES:
        return False
    base = get_agent_data_dir(agent_id)
    full = os.path.join(base, filename)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    try:
        with open(full, "w", encoding="utf-8") as f:
            f.write(content)
    except Exception:
        return False
    # Sync to container: workspace/* -> /home/node/.openclaw/workspace/, mind/* -> .../workspace/mind/
    container = f"koala-agent-{agent_id}"
    try:
        subprocess.run(["docker", "exec", container, "mkdir", "-p", "/home/node/.openclaw/workspace", "/home/node/.openclaw/workspace/mind"], check=True, capture_output=True, timeout=5)
    except subprocess.CalledProcessError:
        pass  # container may be stopped
    if filename.startswith("workspace/"):
        dest_name = os.path.basename(filename)
        try:
            subprocess.run(["docker", "cp", full, f"{container}:/home/node/.openclaw/workspace/{dest_name}"], check=True, capture_output=True, timeout=5)
        except subprocess.CalledProcessError:
            pass
    elif filename.startswith("mind/"):
        dest_name = os.path.basename(filename)
        try:
            subprocess.run(["docker", "cp", full, f"{container}:/home/node/.openclaw/workspace/mind/{dest_name}"], check=True, capture_output=True, timeout=5)
        except subprocess.CalledProcessError:
            pass
    return True


def load_integrations():
    """Load integrations from .settings.json (keys masked)."""
    default_providers = ["openai", "anthropic", "wiro", "google", "groq", "mistral"]
    out = {p: {"configured": False, "key_masked": "", "last_tested": None} for p in default_providers}
    if not os.path.exists(SETTINGS_FILE):
        return out
    try:
        with open(SETTINGS_FILE, "r") as f:
            raw = json.load(f)
        integ = raw.get("integrations", {})
        for p in default_providers:
            cfg = integ.get(p, {})
            has_key = bool((cfg.get("key") or "").strip())
            out[p] = {
                "configured": has_key,
                "key_masked": "***" if has_key else "",
                "last_tested": cfg.get("last_tested"),
            }
    except Exception:
        pass
    return out


def save_integration(provider, key, extra=None):
    """Save API key for a provider. extra can include secret (e.g. wiro)."""
    current = {}
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                current = json.load(f)
        except Exception:
            pass
    integrations = current.get("integrations", {})
    integrations[provider] = {"key": (key or "").strip(), "last_tested": None}
    if extra:
        integrations[provider].update(extra)
    current["integrations"] = integrations
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(current, f, indent=2)
    return load_integrations()


def delete_integration(provider):
    """Remove stored key for a provider."""
    current = {}
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                current = json.load(f)
        except Exception:
            pass
    integrations = current.get("integrations", {})
    integrations.pop(provider, None)
    current["integrations"] = integrations
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump(current, f, indent=2)
    return load_integrations()


def get_integration_key(provider):
    """Get raw key for a provider (server-side only)."""
    if not os.path.exists(SETTINGS_FILE):
        return None
    try:
        with open(SETTINGS_FILE, "r") as f:
            raw = json.load(f)
        return (raw.get("integrations", {}).get(provider, {}).get("key") or "").strip()
    except Exception:
        return None


def test_integration(provider):
    """Test provider connection. Returns {ok: bool, message: str}."""
    if provider == "wiro":
        client = get_wiro_client()
        if not client or not client.is_configured:
            return {"ok": False, "message": "Wiro not configured"}
        try:
            client.list_models()
            return {"ok": True, "message": "OK"}
        except Exception as e:
            return {"ok": False, "message": str(e)}
    if provider in ("openai", "anthropic", "google", "groq", "mistral"):
        # Simple ping: we don't have a generic test; report configured
        key = get_integration_key(provider)
        return {"ok": bool(key), "message": "Configured" if key else "No key set"}
    return {"ok": False, "message": f"Unknown provider: {provider}"}


def docker_restart_agent(agent_id):
    """Restart a single agent container."""
    name = f"koala-agent-{agent_id}"
    try:
        subprocess.run(["docker", "restart", name], check=True, capture_output=True, timeout=30)
        return True
    except Exception:
        return False


def docker_restart_all():
    """Restart all koala agent containers."""
    state = load_state()
    count = int(state.get("AGENT_COUNT", "0"))
    ok = 0
    for i in range(1, count + 1):
        if docker_restart_agent(i):
            ok += 1
    return ok, count


def get_system_info():
    """Return uptime, disk, memory, docker version."""
    info = {"uptime_seconds": None, "docker_version": None, "disk": None, "memory": None}
    try:
        with open("/proc/uptime") as f:
            info["uptime_seconds"] = float(f.read().split()[0])
    except Exception:
        pass
    try:
        r = subprocess.run(["docker", "--version"], capture_output=True, text=True, timeout=2)
        if r.returncode == 0:
            info["docker_version"] = r.stdout.strip()
    except Exception:
        pass
    try:
        r = subprocess.run(["df", "-k", "."], capture_output=True, text=True, timeout=2)
        if r.returncode == 0:
            parts = r.stdout.strip().split("\n")[-1].split()
            if len(parts) >= 3:
                info["disk"] = {"total_kb": int(parts[1]), "used_kb": int(parts[2])}
    except Exception:
        pass
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    info["memory"] = {"total_kb": int(line.split()[1])}
                    break
                if line.startswith("MemAvailable:"):
                    if "memory" in info and info["memory"]:
                        info["memory"]["available_kb"] = int(line.split()[1])
                    break
    except Exception:
        pass
    return info


# ─── Agent Execution Helper ──────────────────────────────────────
def _exec_agent_message(agent_id, message, timeout=120):
    """Send a message to an agent via docker exec and return the cleaned response."""
    result = subprocess.run(
        ["docker", "exec", f"koala-agent-{agent_id}",
         "node", "openclaw.mjs", "agent",
         "--agent", "main",
         "-m", message],
        capture_output=True, text=True, timeout=timeout
    )
    stdout = result.stdout.strip()
    lines = [l for l in stdout.split("\n")
             if l.strip() and not l.startswith("🦞") and not l.startswith("Usage:")]
    response = "\n".join(lines).strip()
    if not response and result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "No response from agent")
    return response or stdout or "(empty response)"


def _parse_json_from_response(text):
    """Try to extract a JSON object from an LLM response (handles markdown fences)."""
    # Try direct parse
    try:
        return json.loads(text.strip())
    except (json.JSONDecodeError, ValueError):
        pass
    # Try extracting from ```json ... ``` or { ... }
    patterns = [
        r'```(?:json)?\s*(\{[\s\S]*?\})\s*```',
        r'(\{[\s\S]*"(?:plan|delegations|direct_answer)"[\s\S]*\})',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            try:
                return json.loads(m.group(1))
            except (json.JSONDecodeError, ValueError):
                continue
    return None


# ─── HTTP API Handler ────────────────────────────────────────────
class AdminAPIHandler(SimpleHTTPRequestHandler):
    """Handles both static file serving (UI) and API endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=UI_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Agent proxy: /agent/{id}/... → container:18789/...
        if path.startswith("/agent/"):
            self._proxy_to_agent("GET")
            return

        # API routes
        if path.startswith("/api/"):
            self._handle_api(path, parsed.query)
            return

        # Serve static files from UI directory
        super().do_GET()

    def do_HEAD(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path.startswith("/agent/"):
            self._proxy_to_agent("HEAD")
            return
        super().do_HEAD()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Agent proxy
        if path.startswith("/agent/"):
            self._proxy_to_agent("POST")
            return

        if path.startswith("/api/"):
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b""
            self._handle_api_post(path, body)
            return

        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/integrations/"):
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 4 and parts[2] == "integrations":
                provider = parts[3]
                if provider != "test":
                    self._json_response(delete_integration(provider))
                    return
        elif path.startswith("/api/agents/") and "/documents/" in path:
            self._handle_document_delete(path)
            return
        self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)

    def _proxy_to_agent(self, method):
        """Reverse proxy /agent/{id}/path → agent container."""
        try:
            parsed = urllib.parse.urlparse(self.path)
            parts = parsed.path.split("/", 3)  # ['', 'agent', '{id}', 'rest...']

            if len(parts) < 3:
                self.send_error(HTTPStatus.BAD_REQUEST, "Invalid agent path")
                return

            agent_id = int(parts[2])
            rest_path = "/" + parts[3] if len(parts) > 3 else "/"

            # Get agent IP from Docker network
            state = load_state()
            subnet = state.get("SUBNET", "172.30.0.0/24")
            prefix = subnet.rsplit(".", 2)[0]  # e.g. "172.30.0"
            agent_ip = f"{prefix}.1{agent_id}"  # e.g. 172.30.0.11
            agent_port = 18789

            # Build target URL
            query = f"?{parsed.query}" if parsed.query else ""
            target_url = f"http://{agent_ip}:{agent_port}{rest_path}{query}"

            # Read request body if POST
            body = None
            if method == "POST":
                content_length = int(self.headers.get("Content-Length", 0))
                if content_length > 0:
                    body = self.rfile.read(content_length)

            # Forward request
            req = urllib.request.Request(target_url, data=body, method=method)

            # Copy relevant headers
            for header in ("Content-Type", "Authorization", "Accept"):
                val = self.headers.get(header)
                if val:
                    req.add_header(header, val)

            # Add auth token
            token = state.get(f"TOKEN_{agent_id}", "")
            if token:
                req.add_header("Authorization", f"Bearer {token}")

            with urllib.request.urlopen(req, timeout=30) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                # Forward response headers, stripping iframe-blocking ones
                blocked_headers = (
                    "transfer-encoding", "connection",
                    "x-frame-options",       # Blocks iframe embedding
                    "content-security-policy", # frame-ancestors 'none' blocks iframe
                )
                for key, val in resp.getheaders():
                    if key.lower() not in blocked_headers:
                        self.send_header(key, val)
                # Replace with permissive CSP for iframe embedding
                self.send_header("X-Frame-Options", "SAMEORIGIN")
                self.send_header("Content-Security-Policy",
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                    "connect-src 'self' ws: wss: http: https:; "
                    "img-src 'self' data: https:; "
                    "font-src 'self' data:; "
                    "frame-ancestors 'self'")
                self.end_headers()
                self.wfile.write(resp_body)

        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f"Proxy error: {e.reason}".encode())
        except Exception as e:
            self.send_response(502)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(f"Proxy error: {e}".encode())

    def _handle_api(self, path, query):
        """Route GET API requests."""
        try:
            if path == "/api/status":
                self._json_response(self._get_status())
            elif path == "/api/agents":
                self._json_response(self._get_agents())
            elif path.startswith("/api/agents/") and path.endswith("/logs"):
                agent_id = int(path.split("/")[3])
                tail = 50
                if query:
                    params = urllib.parse.parse_qs(query)
                    tail = int(params.get("tail", [50])[0])
                self._json_response({"logs": docker_logs(agent_id, tail)})
            elif path.startswith("/api/agents/") and "/history/search" in path:
                agent_id = int(path.split("/")[3])
                q = ""
                limit = 10
                if query:
                    params = urllib.parse.parse_qs(query)
                    q = params.get("q", [""])[0]
                    limit = int(params.get("limit", [10])[0])
                if not q:
                    self._json_response({"results": [], "error": "q parameter required"})
                elif not vector_store or not vector_store.is_available():
                    self._json_response({"results": [], "error": "Vector store not available"})
                else:
                    results = vector_store.search_chat(agent_id, q, limit)
                    self._json_response({"results": results})
            elif path.startswith("/api/agents/") and path.endswith("/history"):
                agent_id = int(path.split("/")[3])
                limit = 100
                if query:
                    params = urllib.parse.parse_qs(query)
                    limit = int(params.get("limit", [100])[0])
                self._json_response({"history": read_chat_history(agent_id, limit)})
            elif path.startswith("/api/agents/") and "/documents" in path and "/search" not in path:
                agent_id = int(path.split("/")[3])
                docs_dir = os.path.join(DATA_DIR, f"koala-agent-{agent_id}", "docs")
                docs = []
                if os.path.isdir(docs_dir):
                    for fname in sorted(os.listdir(docs_dir)):
                        fpath = os.path.join(docs_dir, fname)
                        if os.path.isfile(fpath):
                            stat = os.stat(fpath)
                            docs.append({"filename": fname, "size": stat.st_size, "modified": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(stat.st_mtime))})
                self._json_response({"documents": docs})
            elif path.startswith("/api/agents/") and "/files" in path:
                # GET /api/agents/{id}/files or GET /api/agents/{id}/files/{path}
                parts = [p for p in path.split("/") if p]
                if len(parts) < 4:
                    self._json_response({"error": "Invalid path"}, HTTPStatus.BAD_REQUEST)
                    return
                agent_id = int(parts[2])
                if parts[3] != "files":
                    self._json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
                    return
                if len(parts) == 4:
                    self._json_response({"files": list_agent_files(agent_id)})
                    return
                filename = "/".join(parts[4:])
                content = read_agent_file(agent_id, filename)
                if content is None:
                    self._json_response({"error": "File not found or not allowed"}, HTTPStatus.NOT_FOUND)
                    return
                self._json_response({"path": filename, "content": content})
            elif path == "/api/integrations":
                self._json_response(load_integrations())
            elif path == "/api/system/info":
                self._json_response(get_system_info())
            elif path == "/api/agents/roster":
                self._json_response(self._get_roster())
            elif path == "/api/roles":
                self._json_response({"roles": get_all_roles()})
            elif path == "/api/stats":
                self._json_response({"stats": docker_stats()})
            elif path == "/api/config":
                state = load_state()
                safe_state = {k: v for k, v in state.items()
                              if k not in ("API_KEY",) and not k.startswith("TOKEN_")}
                self._json_response(safe_state)
            elif path == "/api/wiro/models":
                self._json_response(self._wiro_list_models(query))
            elif path == "/api/wiro/status":
                self._json_response(self._wiro_status())
            elif path.startswith("/api/wiro/task/"):
                token = path.split("/api/wiro/task/", 1)[-1].strip("/")
                self._json_response(self._wiro_task_status(token))
            elif path == "/api/settings":
                self._json_response(self._get_settings())
            elif path.startswith("/api/settings/channel/") and path.endswith("/status"):
                # GET /api/settings/channel/{name}/status (legacy, orchestrator only)
                name = path.split("/api/settings/channel/")[1].replace("/status", "").strip("/")
                self._json_response(self._channel_status(name))
            elif path.startswith("/api/agents/") and "/channels" in path:
                parts = [p for p in path.split("/") if p]
                agent_id = int(parts[2])
                if len(parts) >= 5 and parts[4] == "status":
                    # GET /api/agents/{id}/channels/{name}/status
                    ch_name = parts[3].replace("channels", "").strip("/") if parts[3] != "channels" else ""
                    if not ch_name and len(parts) >= 5:
                        ch_name = parts[4] if parts[4] != "status" else ""
                    # Re-parse: /api/agents/6/channels/telegram/status
                    ch_parts = path.split("/channels/")[1].split("/") if "/channels/" in path else []
                    ch_name = ch_parts[0] if ch_parts else ""
                    self._json_response(self._channel_status_for_agent(agent_id, ch_name))
                elif "/channels/" not in path or path.endswith("/channels"):
                    # GET /api/agents/{id}/channels — list all channel statuses
                    self._json_response(self._all_channel_statuses(agent_id))
                else:
                    self._json_response({"error": "Invalid channel path"}, HTTPStatus.BAD_REQUEST)
            else:
                self._json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except Exception as e:
            self._json_response({"error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _handle_api_post(self, path, body):
        """Route POST API requests."""
        try:
            data = json.loads(body) if body else {}

            if path == "/api/agents/chat":
                self._json_response(self._send_chat(data))
            elif path.startswith("/api/agents/") and "/documents/search" in path:
                agent_id = int(path.split("/")[3])
                q = (data.get("query") or data.get("q") or "").strip()
                limit = int(data.get("limit", 5))
                if not q:
                    self._json_response({"results": [], "error": "query required"})
                elif not vector_store or not vector_store.is_available():
                    self._json_response({"results": [], "error": "Vector store not available"})
                else:
                    results = vector_store.search_docs(agent_id, q, limit)
                    self._json_response({"results": results})
            elif path.startswith("/api/agents/") and "/documents" in path and "/search" not in path:
                self._handle_document_upload(path, data)
            elif path == "/api/agents/delegate":
                self._json_response(self._delegate(data))
            elif path == "/api/agents/orchestrate":
                self._orchestrate_stream(data)
                return
            elif path == "/api/agents/broadcast":
                self._json_response(self._broadcast(data))
            elif path == "/api/wiro/generate":
                self._json_response(self._wiro_generate(data))
            elif path == "/api/wiro/smart-generate":
                self._json_response(self._wiro_smart_generate(data))
            elif path == "/api/settings":
                self._json_response(self._post_settings(data))
            elif path.startswith("/api/settings/channel/"):
                # POST /api/settings/channel/{name} (legacy, orchestrator only)
                name = path.split("/api/settings/channel/")[1].strip("/").split("/")[0]
                self._json_response(self._channel_configure(name, data))
            elif path.startswith("/api/agents/") and "/channels/" in path:
                # POST /api/agents/{id}/channels/{name}
                parts = [p for p in path.split("/") if p]
                agent_id = int(parts[2])
                ch_name = path.split("/channels/")[1].split("/")[0] if "/channels/" in path else ""
                if ch_name:
                    self._json_response(self._channel_configure_for_agent(agent_id, ch_name, data))
                else:
                    self._json_response({"error": "Channel name required"}, HTTPStatus.BAD_REQUEST)
            elif path.startswith("/api/agents/") and "/files/" in path:
                # POST /api/agents/{id}/files/{path}
                parts = [p for p in path.split("/") if p]
                if len(parts) < 5:
                    self._json_response({"error": "Invalid path"}, HTTPStatus.BAD_REQUEST)
                    return
                agent_id = int(parts[2])
                if parts[3] != "files":
                    self._json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
                    return
                filename = "/".join(parts[4:])
                content = data.get("content", "")
                if write_agent_file(agent_id, filename, content):
                    self._json_response({"success": True, "path": filename})
                else:
                    self._json_response({"error": "Write failed or path not allowed"}, HTTPStatus.BAD_REQUEST)
            elif path.startswith("/api/integrations/") and path.endswith("/test"):
                provider = path.split("/api/integrations/")[1].replace("/test", "").strip("/")
                self._json_response(test_integration(provider))
            elif path.startswith("/api/integrations/"):
                # POST /api/integrations/{provider}
                provider = path.split("/api/integrations/")[1].strip("/").split("/")[0]
                key = (data.get("key") or "").strip()
                extra = {}
                if provider == "wiro" and "secret" in data:
                    extra["secret"] = (data.get("secret") or "").strip()
                save_integration(provider, key, extra if extra else None)
                self._json_response(load_integrations())
            elif path.startswith("/api/system/restart-agent/"):
                try:
                    agent_id = int(path.rstrip("/").split("/")[-1])
                    ok = docker_restart_agent(agent_id)
                    self._json_response({"success": ok, "agent_id": agent_id})
                except (ValueError, IndexError):
                    self._json_response({"error": "Invalid agent id"}, HTTPStatus.BAD_REQUEST)
            elif path == "/api/system/restart-all":
                ok, total = docker_restart_all()
                self._json_response({"success": True, "restarted": ok, "total": total})
            else:
                self._json_response({"error": "Not found"}, HTTPStatus.NOT_FOUND)
        except Exception as e:
            self._json_response({"error": str(e)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def _get_status(self):
        """Get overall system status."""
        state = load_state()
        agents = get_agents_from_state(state)

        # Check each agent's container status
        online = 0
        for agent in agents:
            cs = docker_container_status(agent["id"])
            agent["status"] = "online" if cs["status"] == "running" else "offline"
            agent["health"] = cs["health"]
            if agent["status"] == "online":
                online += 1

        return {
            "status": "online" if online > 0 else "offline",
            "agents_total": len(agents),
            "agents_online": online,
            "server_ip": state.get("SERVER_IP", "unknown"),
            "model": state.get("MODEL", "unknown"),
            "provider": state.get("PROVIDER", "unknown"),
            "version": state.get("KOALACLAW_VERSION", "unknown"),
            "install_dir": state.get("INSTALL_DIR", INSTALL_DIR),
        }

    def _get_agents(self):
        """Get all agents with live status."""
        state = load_state()
        agents = get_agents_from_state(state)

        for agent in agents:
            cs = docker_container_status(agent["id"])
            agent["status"] = "online" if cs["status"] == "running" else "offline"
            agent["health"] = cs["health"]

            # Try to detect agent state from recent logs
            if agent["status"] == "online":
                recent = docker_logs(agent["id"], 5)
                agent["state"] = self._detect_state(recent)

        return {"agents": agents}

    def _detect_state(self, log_lines):
        """Detect agent state from recent log lines."""
        text = " ".join(log_lines).lower()
        if "error" in text or "failed" in text:
            return "error"
        if "thinking" in text or "processing" in text:
            return "thinking"
        if "typing" in text or "generating" in text:
            return "typing"
        if "browsing" in text or "navigating" in text:
            return "browsing"
        if "talking" in text or "responding" in text:
            return "talking"
        return "idle"

    def _handle_document_upload(self, path, data):
        """POST /api/agents/{id}/documents — upload a document for RAG."""
        agent_id = int(path.split("/")[3])
        content = data.get("content", "")
        filename = data.get("filename", "document.txt")

        if not content:
            self._json_response({"error": "content required"}, HTTPStatus.BAD_REQUEST)
            return

        docs_dir = os.path.join(DATA_DIR, f"koala-agent-{agent_id}", "docs")
        os.makedirs(docs_dir, exist_ok=True)
        filepath = os.path.join(docs_dir, os.path.basename(filename))
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
        except Exception as e:
            self._json_response({"error": f"Failed to save: {e}"})
            return

        chunks_added = 0
        if vector_store and vector_store.is_available():
            chunks_added = vector_store.add_document(agent_id, filename, content)

        self._json_response({"success": True, "filename": filename, "chunks": chunks_added, "size": len(content)})

    def _handle_document_delete(self, path):
        """DELETE /api/agents/{id}/documents/{filename}"""
        parts = [p for p in path.split("/") if p]
        agent_id = int(parts[2])
        filename = "/".join(parts[4:])
        if not filename:
            self._json_response({"error": "filename required"}, HTTPStatus.BAD_REQUEST)
            return

        docs_dir = os.path.join(DATA_DIR, f"koala-agent-{agent_id}", "docs")
        filepath = os.path.join(docs_dir, os.path.basename(filename))
        deleted_file = False
        if os.path.isfile(filepath):
            os.remove(filepath)
            deleted_file = True

        deleted_vectors = False
        if vector_store and vector_store.is_available():
            deleted_vectors = vector_store.delete_document(agent_id, filename)

        self._json_response({"success": deleted_file or deleted_vectors, "filename": filename})

    def _send_chat(self, data):
        """Send a chat message to an agent via OpenClaw CLI (docker exec)."""
        agent_id = data.get("agent_id")
        message = data.get("message", "")
        image_base64 = data.get("image_base64")

        if not agent_id or not message:
            return {"error": "agent_id and message required"}

        state = load_state()
        token = state.get(f"TOKEN_{agent_id}", "")
        if not token:
            return {"error": f"No token found for agent {agent_id}"}

        append_chat_history(agent_id, "user", message, image_base64=image_base64)

        try:
            msg = message + (" [Image attached]" if image_base64 else "")
            response = _exec_agent_message(agent_id, msg)
            append_chat_history(agent_id, "assistant", response)
            return {"success": True, "response": response}
        except subprocess.TimeoutExpired:
            return {"error": "Request timed out"}
        except Exception as e:
            return {"error": str(e)}

    def _wiro_list_models(self, query):
        """GET /api/wiro/models — search Wiro models via Tool/List API."""
        client = get_wiro_client()
        if not client or not client.is_configured:
            return {"error": "Wiro not configured", "models": [], "categories": {}}
        try:
            params = urllib.parse.parse_qs(query) if query else {}
            category = (params.get("category") or [None])[0]
            return client.list_models(category=category)
        except Exception as e:
            return {"error": str(e), "models": [], "categories": {}}

    def _wiro_task_status(self, token):
        """GET /api/wiro/task/{token} — check task status."""
        client = get_wiro_client()
        if not client or not client.is_configured:
            return {"error": "Wiro not configured"}
        try:
            return client.poll_task(token, timeout=5)
        except Exception as e:
            return {"error": str(e), "status": "error"}

    def _wiro_generate(self, data):
        """POST /api/wiro/generate — generate with specific or auto-selected model.

        With owner/project: fetches model docs, builds params, generates.
        Without: falls back to smart_generate.
        """
        client = get_wiro_client()
        if not client or not client.is_configured:
            return {"error": "Wiro not configured"}
        model = data.get("model") or ""
        owner = data.get("owner") or ""
        project = data.get("project") or ""
        if not owner or not project:
            if "/" in model:
                owner, _, project = model.partition("/")
            else:
                prompt = (data.get("params") or {}).get("prompt", "")
                if prompt:
                    return client.smart_generate(prompt)
                return {"error": "Provide model (owner/project) or owner+project, or params.prompt for auto-select"}
        prompt = (data.get("params") or {}).get("prompt", "")
        try:
            inputs = client.get_model_inputs(owner.strip(), project.strip())
            if inputs and prompt:
                from wiro_client import build_params_from_docs
                params = build_params_from_docs(inputs, prompt)
            else:
                params = data.get("params") or {}
            return client.generate(owner.strip(), project.strip(), params)
        except Exception as e:
            return {"error": str(e)}

    def _wiro_status(self):
        """GET /api/wiro/status — check if Wiro is configured and which agents have the skill."""
        client = get_wiro_client()
        configured = bool(client and client.is_configured)
        skill_agents = []
        try:
            state = load_state()
            agent_count = int(state.get("AGENT_COUNT", "0"))
            for i in range(1, agent_count + 1):
                role_id = state.get(f"ROLE_{i}", "")
                info = get_role_info(role_id)
                name = info.get("name", f"Agent {i}") if info else f"Agent {i}"
                skills_file = os.path.join(INSTALL_DIR, "roles", role_id, "skills.json") if role_id else ""
                if not skills_file or not os.path.isfile(skills_file):
                    skills_file = os.path.join(REPO_DIR, "roles", role_id, "skills.json") if role_id else ""
                if skills_file and os.path.isfile(skills_file):
                    with open(skills_file) as f:
                        skills = json.load(f)
                    enabled = skills.get("enabled", [])
                    if "wiro" in enabled or "wiro-ai" in enabled:
                        skill_agents.append(name)
        except Exception:
            pass
        return {"configured": configured, "skill_agents": skill_agents}

    def _wiro_smart_generate(self, data):
        """POST /api/wiro/smart-generate — {prompt, task_type} -> auto-find model + generate."""
        client = get_wiro_client()
        if not client or not client.is_configured:
            return {"error": "Wiro not configured", "success": False}
        prompt = (data.get("prompt") or "").strip()
        task_type = (data.get("task_type") or "text-to-image").strip()
        if not prompt:
            return {"error": "No prompt provided", "success": False}
        try:
            return client.smart_generate(prompt, task_type=task_type)
        except Exception as e:
            return {"error": str(e), "success": False}

    def _get_settings(self):
        """GET /api/settings — current config (keys masked, channel statuses)."""
        s = load_settings()
        state = load_state()
        s["agent_count"] = int(state.get("AGENT_COUNT", "0"))
        return s

    def _delegate(self, data):
        """POST /api/agents/delegate — delegate task from one agent to another."""
        from_agent = data.get("from_agent")
        to_agent = data.get("to_agent")
        task = data.get("task", "")
        context = data.get("context", "")

        if not from_agent or not to_agent:
            return {"error": "from_agent and to_agent required"}
        from_id = int(from_agent)
        to_id = int(to_agent)
        if from_id == to_id:
            return {"error": "from_agent and to_agent must differ"}

        state = load_state()
        count = int(state.get("AGENT_COUNT", "0"))
        if to_id < 1 or to_id > count:
            return {"error": f"to_agent {to_id} out of range (1..{count})"}

        from_info = get_role_info(state.get(f"ROLE_{from_id}", ""))
        to_info = get_role_info(state.get(f"ROLE_{to_id}", ""))

        message = task if not context else f"{task}\n\nContext:\n{context}"
        try:
            response = _exec_agent_message(to_id, message)

            append_chat_history(from_id, "delegation", json.dumps({
                "direction": "out", "to_agent": to_id, "to_name": to_info["name"],
                "task": task, "response": response[:500],
            }))
            append_chat_history(to_id, "delegation", json.dumps({
                "direction": "in", "from_agent": from_id, "from_name": from_info["name"],
                "task": task, "response": response[:500],
            }))

            return {"success": True, "response": response, "from_agent": from_id, "to_agent": to_id,
                    "from_name": from_info["name"], "to_name": to_info["name"]}
        except subprocess.TimeoutExpired:
            return {"error": "Delegation timed out"}
        except Exception as e:
            return {"error": str(e)}

    def _orchestrate_stream(self, data):
        """POST /api/agents/orchestrate — SSE streaming multi-agent orchestration.

        Sends Server-Sent Events as each step completes so the UI can show
        live progress. Events: phase, plan, delegating, agent_done, combining, done, error.
        """
        message = (data.get("message") or data.get("task") or "").strip()
        if not message:
            self._sse_start()
            self._sse_send("error", {"error": "message required"})
            self._sse_end()
            return

        self._sse_start()
        import sys

        state = load_state()
        count = int(state.get("AGENT_COUNT", "0"))
        orch_id = get_orchestrator_agent_id(state)

        agents_roster = []
        for i in range(1, count + 1):
            info = get_role_info(state.get(f"ROLE_{i}", ""))
            agents_roster.append({"id": i, "name": info["name"], "role": info["role_title"], "emoji": info["emoji"]})

        roster_text = "\n".join(
            f"- Agent {a['id']}: {a['emoji']} {a['name']} — {a['role']}"
            for a in agents_roster
        )

        # Find ALL media URLs from chat history for context
        import re as _re
        all_media_urls = []
        recent_media_url = ""
        try:
            history = read_chat_history(orch_id, limit=200)
            for entry in history:
                content = entry.get("content", "")
                # Match Wiro CDN URLs and common media extensions
                urls = _re.findall(r'(https?://cdn[^\s<>"]+|https?://[^\s<>"]+\.(?:png|jpe?g|webp|gif|mp4|webm|mp3|wav|ogg))\b', content)
                for u in urls:
                    if u not in all_media_urls:
                        all_media_urls.append(u)
            if all_media_urls:
                recent_media_url = all_media_urls[-1]
        except Exception:
            pass

        context_hint = ""
        if all_media_urls:
            media_list = "\n".join(f"  - {u}" for u in all_media_urls[-10:])
            context_hint = (
                f'\nMedia generated in this conversation ({len(all_media_urls)} total, showing last {min(10, len(all_media_urls))}):\n{media_list}\n'
                f'Most recent: {recent_media_url}\n'
                f'If the user refers to "this image/video", "convert this", "make this a video", etc., use the most recent relevant URL as input_image.\n'
                f'For image-to-video: set task_type to "image-to-video" and include "input_image":"<URL>" in wiro_generate.\n'
            )

        # RAG: search uploaded documents for relevant context
        rag_context = ""
        if vector_store and vector_store.is_available():
            try:
                doc_results = vector_store.search_docs(orch_id, message, limit=5)
                if doc_results:
                    snippets = [f"[{r['filename']}]: {r['content']}" for r in doc_results if r.get("score", 0) > 0.3]
                    if snippets:
                        rag_context = "\nRelevant context from uploaded documents:\n" + "\n".join(snippets) + "\n"
            except Exception:
                pass

        # Direct model selection: if user typed a number (1, 2, 3), pick from previous suggestions
        stripped_msg = message.strip()
        if stripped_msg in ("1", "2", "3"):
            try:
                history = read_chat_history(orch_id, limit=10)
                for entry in reversed(history):
                    content = entry.get("content", "")
                    if entry.get("role") == "assistant" and "wiro_model_options:" in content:
                        import re as _re
                        opts_match = _re.search(r'wiro_model_options:\s*(\[.*?\])', content)
                        prompt_match = _re.search(r'wiro_prompt:\s*(.+?)-->', content)
                        task_match = _re.search(r'wiro_task_type:\s*(\S+)', content)
                        if opts_match:
                            opts = json.loads(opts_match.group(1))
                            idx = int(stripped_msg) - 1
                            if 0 <= idx < len(opts):
                                chosen = opts[idx]
                                wiro_prompt = prompt_match.group(1).strip() if prompt_match else message
                                task_type = task_match.group(1).strip() if task_match else "text-to-image"
                                chosen_model = f"{chosen['owner']}/{chosen['project']}"
                                input_image = ""
                                if recent_media_url and "video" in task_type:
                                    input_image = recent_media_url

                                print(f"[ORCH] Direct model selection: {stripped_msg} -> {chosen_model}, prompt={wiro_prompt[:60]}, task={task_type}", file=sys.stderr, flush=True)
                                self._sse_send("phase", {"phase": "generating", "message": f"Generating with {chosen.get('name', chosen_model)}..."})
                                append_chat_history(orch_id, "user", message)

                                client = get_wiro_client()
                                if client and client.is_configured:
                                    try:
                                        owner, project = chosen_model.split("/", 1)
                                        inputs = client.get_model_inputs(owner, project)
                                        if inputs:
                                            from wiro_client import build_params_from_docs
                                            params = build_params_from_docs(inputs, wiro_prompt, input_image=input_image)
                                        else:
                                            params = {"prompt": wiro_prompt}
                                            if input_image:
                                                params["inputImage"] = [input_image]
                                        result = client.generate(owner, project, params)
                                        if result.get("output"):
                                            out_url = result["output"]
                                            answer = f"Generated with **{chosen.get('name', chosen_model)}**:\n\n{out_url}"
                                        elif result.get("error"):
                                            answer = f"Generation failed: {result['error']}"
                                        else:
                                            answer = f"Generation completed but no output URL returned."
                                    except Exception as e:
                                        answer = f"Generation error: {e}"
                                else:
                                    answer = "Wiro AI is not configured."

                                append_chat_history(orch_id, "assistant", answer)
                                self._sse_send("done", {"response": answer, "chain": [], "plan": f"generate with {chosen_model}"})
                                self._sse_end()
                                return
                        break
            except Exception as e:
                print(f"[ORCH] Direct selection failed: {e}", file=sys.stderr, flush=True)

        # Check if user is selecting a previously suggested model (for LLM fallback)
        model_selection = ""
        try:
            history = read_chat_history(orch_id, limit=5)
            for entry in reversed(history):
                if entry.get("role") == "assistant" and "wiro_model_options" in entry.get("content", ""):
                    model_selection = entry["content"]
                    break
        except Exception:
            pass

        selection_hint = ""
        if model_selection:
            selection_hint = (
                f"\nThe user was previously shown model options. If they are selecting one "
                f"(by number, name, or description), use wiro_generate with the selected model. "
                f'Include "model":"owner/project" in wiro_generate to use that specific model.\n'
                f"Previous options shown:\n{model_selection[:500]}\n"
            )

        analysis_prompt = (
            f"SYSTEM: You are a task router. Respond with ONLY a raw JSON object. "
            f"No markdown fences, no explanation, no text before or after.\n\n"
            f"Available agents:\n{roster_text}\n\n"
            f"You have the wiro-ai skill for AI content generation.\n"
            f"When the user wants to generate/create/draw an image, video, or audio:\n"
            f"- FIRST TIME: use wiro_suggest to show model options with costs\n"
            f"- AFTER USER SELECTS: use wiro_generate with the chosen model\n"
            f'For image-to-video, include "input_image":"URL" in wiro_generate.\n'
            f"{context_hint}{selection_hint}{rag_context}\n"
            f"User request: {message}\n\n"
            f"You are Agent {orch_id} (OrchestratorKoala). Do NOT delegate to yourself.\n"
            f"Only delegate when the task genuinely needs a specialist. "
            f"For simple questions, answer directly.\n\n"
            f"JSON format:\n"
            f'{{"plan":"brief plan","delegations":[{{"agent_id":N,"task":"task"}}],"direct_answer":null}}\n'
            f"For simple/direct: "
            f'{{"plan":"direct","delegations":[],"direct_answer":"your answer"}}\n'
            f"To suggest models (first time): "
            f'{{"plan":"suggest models","delegations":[],"direct_answer":null,"wiro_suggest":{{"prompt":"detailed prompt","task_type":"text-to-image"}}}}\n'
            f"To generate with chosen model: "
            f'{{"plan":"generate","delegations":[],"direct_answer":null,"wiro_generate":{{"prompt":"detailed prompt","task_type":"text-to-image","model":"owner/project"}}}}\n'
            f"To generate without asking (user says 'just do it' or picks a model): "
            f'{{"plan":"generate","delegations":[],"direct_answer":null,"wiro_generate":{{"prompt":"detailed prompt","task_type":"text-to-image"}}}}'
        )

        self._sse_send("phase", {"phase": "analyzing", "message": "Analyzing task..."})
        print(f"[ORCH] Analyzing task via Agent {orch_id}...", file=sys.stderr, flush=True)

        try:
            raw_plan = _exec_agent_message(orch_id, analysis_prompt, timeout=60)
            print(f"[ORCH] Raw plan: {raw_plan[:300]}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"[ORCH] Analysis failed: {e}", file=sys.stderr, flush=True)
            self._sse_send("phase", {"phase": "fallback", "message": "Answering directly..."})
            try:
                fallback = _exec_agent_message(orch_id, message, timeout=60)
            except Exception:
                self._sse_send("error", {"error": f"Orchestrator failed: {e}"})
                self._sse_end()
                return
            append_chat_history(orch_id, "user", message)
            append_chat_history(orch_id, "assistant", fallback)
            self._sse_send("done", {"response": fallback, "chain": [], "plan": "direct (fallback)"})
            self._sse_end()
            return

        plan = _parse_json_from_response(raw_plan)
        print(f"[ORCH] Parsed plan: {plan}", file=sys.stderr, flush=True)

        if not plan:
            self._sse_send("phase", {"phase": "direct", "message": "Answering directly..."})
            try:
                direct_resp = _exec_agent_message(orch_id, message, timeout=60)
            except Exception:
                direct_resp = raw_plan
            append_chat_history(orch_id, "user", message)
            append_chat_history(orch_id, "assistant", direct_resp)
            self._sse_send("done", {"response": direct_resp, "chain": [], "plan": "direct"})
            self._sse_end()
            return

        if plan.get("wiro_suggest"):
            suggest_data = plan["wiro_suggest"] if isinstance(plan["wiro_suggest"], dict) else {"task_type": "text-to-image"}
            suggest_prompt = suggest_data.get("prompt", message)
            task_type = suggest_data.get("task_type", "text-to-image")
            self._sse_send("plan", {"plan": plan.get("plan", "suggest models"), "delegations": []})
            self._sse_send("phase", {"phase": "searching_models", "message": "Searching for best models..."})
            client = get_wiro_client()
            if client and client.is_configured:
                suggestions = client.suggest_models(task_type=task_type, count=3)
                if suggestions:
                    lines = [f"I found these models for your request. Pick one and I'll generate:\n"]
                    for idx, s in enumerate(suggestions, 1):
                        speed = f" | {s['avg_time']}" if s.get('avg_time') else ""
                        lines.append(f"**{idx}. {s['name']}**")
                        lines.append(f"   {s['description']}")
                        lines.append(f"   Cost: {s['cost']}{speed} | {s['runs']:,} runs")
                        lines.append("")
                    lines.append(f"_Your prompt: \"{suggest_prompt[:100]}\"_")
                    lines.append(f"\nJust reply with the number (1, 2, or 3) to generate.")
                    answer = "\n".join(lines)
                    # Tag with wiro_model_options so next turn can detect selection
                    tagged = f"<!-- wiro_model_options: {json.dumps([{'owner': s['owner'], 'project': s['project'], 'name': s['name']} for s in suggestions])} -->\n<!-- wiro_prompt: {suggest_prompt} -->\n<!-- wiro_task_type: {task_type} -->\n{answer}"
                    append_chat_history(orch_id, "user", message)
                    append_chat_history(orch_id, "assistant", tagged)
                    self._sse_send("done", {"response": answer, "chain": [], "plan": "model suggestions"})
                else:
                    self._sse_send("done", {"response": "No models found for this task type. Try a different request.", "chain": [], "plan": "no models"})
            else:
                self._sse_send("done", {"response": "Wiro AI is not configured. Please add your API key and secret in Settings > Integrations.", "chain": [], "plan": "wiro not configured"})
            self._sse_end()
            return

        if plan.get("direct_answer") and not plan.get("delegations") and not plan.get("wiro_generate") and not plan.get("wiro_suggest"):
            answer = plan["direct_answer"]
            append_chat_history(orch_id, "user", message)
            append_chat_history(orch_id, "assistant", answer)
            self._sse_send("plan", {"plan": plan.get("plan", "direct"), "delegations": []})
            self._sse_send("done", {"response": answer, "chain": [], "plan": plan.get("plan", "direct")})
            self._sse_end()
            return

        if plan.get("wiro_generate"):
            wiro_data = plan["wiro_generate"] if isinstance(plan["wiro_generate"], dict) else {"prompt": str(plan["wiro_generate"])}
            wiro_prompt = wiro_data.get("prompt", message)
            task_type = wiro_data.get("task_type", "text-to-image")
            input_image = wiro_data.get("input_image", "")
            chosen_model = wiro_data.get("model", "")

            # Auto-detect image-to-video: if user mentions "video" and we have a recent image
            import re as _re_vid
            msg_lower = message.lower()
            video_keywords = ["videoya", "video", "animate", "canlandır", "hareketlendir", "çevir"]
            if any(kw in msg_lower for kw in video_keywords) and recent_media_url:
                is_image_url = _re_vid.search(r'\.(png|jpe?g|webp|gif)\b', recent_media_url)
                if is_image_url and not input_image:
                    input_image = recent_media_url
                    print(f"[ORCH] Auto-detected image-to-video: input_image={input_image[:80]}", file=sys.stderr, flush=True)
                if "video" not in task_type:
                    task_type = "image-to-video"
                    print(f"[ORCH] Auto-set task_type to image-to-video", file=sys.stderr, flush=True)

            # If user selected a model from suggestions, recover prompt from history
            if not wiro_prompt or wiro_prompt == message:
                try:
                    hist = read_chat_history(orch_id, limit=5)
                    for entry in reversed(hist):
                        c = entry.get("content", "")
                        if "wiro_prompt:" in c:
                            import re as _re
                            pm = _re.search(r'wiro_prompt:\s*(.+?)\s*-->', c)
                            if pm:
                                wiro_prompt = pm.group(1).strip()
                            tm = _re.search(r'wiro_task_type:\s*(.+?)\s*-->', c)
                            if tm:
                                task_type = tm.group(1).strip()
                            break
                except Exception:
                    pass

            self._sse_send("plan", {"plan": plan.get("plan", f"generate {task_type}"), "delegations": []})
            self._sse_send("phase", {"phase": "generating", "message": f"Generating via Wiro AI ({task_type})..."})
            print(f"[ORCH] Wiro {task_type}: prompt={wiro_prompt[:80]}, model={chosen_model or 'auto'}, input_image={input_image[:80] if input_image else 'none'}", file=sys.stderr, flush=True)
            client = get_wiro_client()
            if client and client.is_configured:
                try:
                    if chosen_model and "/" in chosen_model:
                        owner, project = chosen_model.split("/", 1)
                        inputs = client.get_model_inputs(owner, project)
                        if inputs:
                            from wiro_client import build_params_from_docs
                            params = build_params_from_docs(inputs, wiro_prompt, input_image=input_image)
                        else:
                            params = {"prompt": wiro_prompt}
                            if input_image:
                                params["inputImage"] = [input_image]
                        result = client.generate(owner, project, params)
                        result["model_used"] = chosen_model
                    else:
                        result = client.smart_generate(wiro_prompt, task_type=task_type, input_image=input_image)
                    model_name = result.get("model_used", "Wiro AI")
                    if result.get("output_url"):
                        img_response = f"Generated with **{model_name}**:\n\n{result['output_url']}"
                        append_chat_history(orch_id, "user", message)
                        append_chat_history(orch_id, "assistant", img_response)
                        self._sse_send("done", {"response": img_response, "chain": [], "plan": f"image generated via {model_name}"})
                    else:
                        err_msg = result.get("message") or result.get("status") or "Image generation failed"
                        self._sse_send("done", {"response": f"Image generation failed: {err_msg}", "chain": [], "plan": "image generation error"})
                except Exception as e:
                    print(f"[ORCH] Wiro generate error: {e}", file=sys.stderr, flush=True)
                    self._sse_send("done", {"response": f"Image generation error: {e}", "chain": [], "plan": "image generation error"})
            else:
                self._sse_send("done", {"response": "Wiro AI is not configured. Please add your API key and secret in Settings > Integrations > Wiro AI.", "chain": [], "plan": "wiro not configured"})
            self._sse_end()
            return

        delegations = plan.get("delegations") or []
        self._sse_send("plan", {
            "plan": plan.get("plan", ""),
            "delegations": [
                {"agent_id": d.get("agent_id"), "task": d.get("task", "")[:120],
                 "agent_name": next((a["name"] for a in agents_roster if a["id"] == d.get("agent_id")), f"Agent {d.get('agent_id')}"),
                 "agent_emoji": next((a["emoji"] for a in agents_roster if a["id"] == d.get("agent_id")), "🐨")}
                for d in delegations
            ],
        })

        chain = []
        for deleg in delegations:
            target_id = int(deleg.get("agent_id", 0))
            task_text = deleg.get("task", "")
            if target_id < 1 or target_id > count or target_id == orch_id or not task_text:
                continue

            target_info = get_role_info(state.get(f"ROLE_{target_id}", ""))
            self._sse_send("delegating", {
                "agent_id": target_id, "agent_name": target_info["name"],
                "agent_emoji": target_info["emoji"], "role": target_info["role_title"],
                "task": task_text,
            })
            print(f"[ORCH] Delegating to Agent {target_id} ({target_info['name']}): {task_text[:80]}...", file=sys.stderr, flush=True)

            try:
                resp = _exec_agent_message(target_id, task_text, timeout=120)
            except Exception as e:
                resp = f"(Agent {target_id} error: {e})"

            step = {
                "agent_id": target_id, "agent_name": target_info["name"],
                "agent_emoji": target_info["emoji"], "role": target_info["role_title"],
                "task": task_text, "response": resp,
            }
            chain.append(step)
            self._sse_send("agent_done", step)

            append_chat_history(target_id, "delegation", json.dumps({
                "direction": "in", "from_agent": orch_id, "from_name": "OrchestratorKoala",
                "task": task_text, "response": resp[:500],
            }))

        if chain:
            self._sse_send("phase", {"phase": "combining", "message": "Combining results..."})
            summary_parts = "\n\n".join(
                f"### {c['agent_name']} ({c['role']})\n{c['response']}" for c in chain
            )
            combine_prompt = (
                f"Combine these specialist responses into one clear, unified answer for the user. "
                f"Attribute contributions where useful.\n\n"
                f"## Original Request\n{message}\n\n"
                f"## Agent Responses\n{summary_parts}\n\n"
                f"Write a well-structured final response."
            )
            try:
                final = _exec_agent_message(orch_id, combine_prompt, timeout=60)
            except Exception:
                final = summary_parts
        else:
            final = plan.get("direct_answer") or raw_plan

        append_chat_history(orch_id, "user", message)
        append_chat_history(orch_id, "assistant", final)

        self._sse_send("done", {"response": final, "chain": chain, "plan": plan.get("plan", "")})
        self._sse_end()

    def _sse_start(self):
        """Begin an SSE response."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def _sse_send(self, event, data):
        """Send one SSE event."""
        payload = json.dumps(data, ensure_ascii=False)
        self.wfile.write(f"event: {event}\ndata: {payload}\n\n".encode("utf-8"))
        self.wfile.flush()

    def _sse_end(self):
        """End SSE stream."""
        self.wfile.write(b"event: close\ndata: {}\n\n")
        self.wfile.flush()

    def _get_roster(self):
        """GET /api/agents/roster — agent discovery for inter-agent communication."""
        state = load_state()
        count = int(state.get("AGENT_COUNT", "0"))
        roster = []
        for i in range(1, count + 1):
            role_id = state.get(f"ROLE_{i}", "")
            info = get_role_info(role_id)
            cs = docker_container_status(i)
            roster.append({
                "id": i,
                "name": info["name"],
                "emoji": info["emoji"],
                "role": info["role_title"],
                "role_id": role_id,
                "status": "online" if cs["status"] == "running" else "offline",
            })
        return {"roster": roster, "orchestrator_id": get_orchestrator_agent_id(state)}

    def _broadcast(self, data):
        """POST /api/agents/broadcast — send message to multiple agents, collect responses."""
        message = (data.get("message") or "").strip()
        agent_ids = data.get("agent_ids") or []
        if not message:
            return {"error": "message required"}

        state = load_state()
        count = int(state.get("AGENT_COUNT", "0"))
        if not agent_ids:
            agent_ids = list(range(1, count + 1))

        results = []
        for aid in agent_ids:
            aid = int(aid)
            if aid < 1 or aid > count:
                continue
            info = get_role_info(state.get(f"ROLE_{aid}", ""))
            try:
                resp = _exec_agent_message(aid, message, timeout=90)
            except Exception as e:
                resp = f"(error: {e})"
            results.append({
                "agent_id": aid,
                "agent_name": info["name"],
                "agent_emoji": info["emoji"],
                "role": info["role_title"],
                "response": resp,
            })
        return {"success": True, "results": results}

    def _post_settings(self, data):
        """POST /api/settings — update settings (Wiro key/secret, channel tokens)."""
        updates = {}
        if "wiro_api_key" in data and data["wiro_api_key"] is not None:
            updates["wiro_api_key"] = (data["wiro_api_key"] or "").strip()
        if "wiro_api_secret" in data and data["wiro_api_secret"] is not None:
            updates["wiro_api_secret"] = (data["wiro_api_secret"] or "").strip()
        if "channels" in data and isinstance(data["channels"], dict):
            updates["channels"] = data["channels"]
        if "default_model" in data:
            updates["default_model"] = data["default_model"]
        if not updates:
            return load_settings()
        return save_settings(updates)

    def _channel_status(self, name):
        """GET /api/settings/channel/{name}/status — check channel connection."""
        state = load_state()
        orch_id = get_orchestrator_agent_id(state)
        container = f"koala-agent-{orch_id}"
        try:
            result = subprocess.run(
                ["docker", "exec", container, "node", "openclaw.mjs", "channels", "status", name],
                capture_output=True, text=True, timeout=10
            )
            out = (result.stdout or "").strip()
            return {"channel": name, "status": "connected" if result.returncode == 0 and out else "unknown", "detail": out or result.stderr}
        except Exception as e:
            return {"channel": name, "status": "error", "detail": str(e)}

    def _channel_configure(self, name, data):
        """POST /api/settings/channel/{name} — configure channel for orchestrator (legacy)."""
        state = load_state()
        orch_id = get_orchestrator_agent_id(state)
        return self._channel_configure_for_agent(orch_id, name, data)

    def _channel_status_for_agent(self, agent_id, name):
        """GET /api/agents/{id}/channels/{name}/status"""
        container = f"koala-agent-{agent_id}"
        try:
            result = subprocess.run(
                ["docker", "exec", container, "node", "openclaw.mjs", "channels", "status", name],
                capture_output=True, text=True, timeout=10
            )
            out = (result.stdout or "").strip()
            connected = result.returncode == 0 and out and "error" not in out.lower()
            return {"channel": name, "agent_id": agent_id, "status": "connected" if connected else "disconnected", "detail": out or result.stderr}
        except Exception as e:
            return {"channel": name, "agent_id": agent_id, "status": "error", "detail": str(e)}

    def _all_channel_statuses(self, agent_id):
        """GET /api/agents/{id}/channels — list all channel statuses."""
        channels = {}
        for name in ["telegram", "whatsapp", "slack", "discord"]:
            channels[name] = self._channel_status_for_agent(agent_id, name)
        return {"agent_id": agent_id, "channels": channels}

    def _channel_configure_for_agent(self, agent_id, name, data):
        """POST /api/agents/{id}/channels/{name} — configure channel for specific agent.

        Telegram/Discord/Slack use 'channels add --channel X --token T'.
        WhatsApp uses 'channels login --channel whatsapp' (QR flow).
        """
        container = f"koala-agent-{agent_id}"

        if name == "whatsapp":
            try:
                result = subprocess.run(
                    ["docker", "exec", container, "node", "openclaw.mjs", "channels", "login", "--channel", "whatsapp", "--verbose"],
                    capture_output=True, text=True, timeout=60
                )
                out = (result.stdout or "") + (result.stderr or "")
                return {"success": result.returncode == 0, "channel": name, "agent_id": agent_id, "message": out[:500], "qr_url": out if "http" in out else None}
            except Exception as e:
                return {"error": str(e)}

        if name == "telegram":
            token = (data.get("token") or data.get("bot_token") or "").strip()
            if not token:
                return {"error": "Bot token required"}
            try:
                result = subprocess.run(
                    ["docker", "exec", container, "node", "openclaw.mjs", "channels", "add", "--channel", "telegram", "--token", token],
                    capture_output=True, text=True, timeout=30
                )
                out = (result.stdout or "") + (result.stderr or "")
                # Auto-approve any pending pairing requests
                self._auto_approve_pairings(container, "telegram")
                return {
                    "success": result.returncode == 0, "channel": name, "agent_id": agent_id,
                    "message": out[:300] + "\n\nTelegram bot added. Send a message to your bot on Telegram — pairing requests will be auto-approved.",
                }
            except Exception as e:
                return {"error": str(e)}

        if name == "discord":
            token = (data.get("token") or data.get("bot_token") or "").strip()
            if not token:
                return {"error": "Bot token required"}
            try:
                result = subprocess.run(
                    ["docker", "exec", container, "node", "openclaw.mjs", "channels", "add", "--channel", "discord", "--token", token],
                    capture_output=True, text=True, timeout=30
                )
                out = (result.stdout or "") + (result.stderr or "")
                return {"success": result.returncode == 0, "channel": name, "agent_id": agent_id, "message": out[:500]}
            except Exception as e:
                return {"error": str(e)}

        if name == "slack":
            bot = (data.get("bot_token") or data.get("token") or "").strip()
            app = (data.get("app_token") or "").strip()
            if not bot:
                return {"error": "Bot token required"}
            try:
                args = ["docker", "exec", container, "node", "openclaw.mjs", "channels", "add", "--channel", "slack", "--token", bot]
                if app:
                    args.extend(["--app-token", app])
                result = subprocess.run(args, capture_output=True, text=True, timeout=30)
                out = (result.stdout or "") + (result.stderr or "")
                return {"success": result.returncode == 0, "channel": name, "agent_id": agent_id, "message": out[:500]}
            except Exception as e:
                return {"error": str(e)}

        return {"error": f"Unknown channel: {name}"}

    def _auto_approve_pairings(self, container, channel):
        """Auto-approve all pending pairing requests for a channel."""
        def _do_approve():
            import time as _time
            for attempt in range(5):
                _time.sleep(3 if attempt == 0 else 10)
                try:
                    list_result = subprocess.run(
                        ["docker", "exec", container, "node", "openclaw.mjs", "pairing", "list", "--channel", channel],
                        capture_output=True, text=True, timeout=10
                    )
                    output = list_result.stdout or ""
                    import re as _re
                    codes = _re.findall(r'│\s*([A-Z0-9]{6,10})\s*│', output)
                    for code in codes:
                        subprocess.run(
                            ["docker", "exec", container, "node", "openclaw.mjs", "pairing", "approve", channel, code, "--notify"],
                            capture_output=True, text=True, timeout=10
                        )
                        print(f"[CHANNEL] Auto-approved pairing {code} for {channel} on {container}", file=sys.stderr, flush=True)
                    if codes:
                        break
                except Exception:
                    pass
        threading.Thread(target=_do_approve, daemon=True).start()

    def _json_response(self, data, status=HTTPStatus.OK):
        """Send a JSON response."""
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        """Log API requests for debugging."""
        if "/api/" in (args[0] if args else ""):
            import sys
            sys.stderr.write(f"[API] {args[0]}\n")
            sys.stderr.flush()


# ─── Server ──────────────────────────────────────────────────────
def run_server():
    """Start the Admin API server."""
    server = ThreadingHTTPServer(("0.0.0.0", API_PORT), AdminAPIHandler)
    print(f"🦞 KoalaClaw Admin API running on http://0.0.0.0:{API_PORT}")
    print(f"   UI:  http://0.0.0.0:{API_PORT}/")
    print(f"   API: http://0.0.0.0:{API_PORT}/api/status")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == "__main__":
    run_server()

