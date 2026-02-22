#!/usr/bin/env python3
"""
KoalaClaw Admin API Server
Provides REST + WebSocket endpoints for the KoalaClaw UI.
Runs on port 3099 by default.
"""

import asyncio
import json
import os
import subprocess
import time
import hashlib
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
from http import HTTPStatus
import threading
import urllib.parse
import urllib.request
import socket

try:
    from wiro_client import WiroClient
except ImportError:
    WiroClient = None

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
    """Append a message to chat history JSONL file. Optional image_base64 for user messages."""
    path = get_history_path(agent_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    entry = {
        "role": role,
        "content": content,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    if image_base64 is not None:
        entry["image_base64"] = image_base64
    
    try:
        with open(path, "a") as f:
            f.write(json.dumps(entry) + "\n")
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
            # DELETE /api/integrations/{provider} — no trailing /test
            parts = [p for p in path.split("/") if p]
            if len(parts) >= 4 and parts[2] == "integrations":
                provider = parts[3]
                if provider != "test":
                    self._json_response(delete_integration(provider))
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
            elif path.startswith("/api/agents/") and path.endswith("/history"):
                agent_id = int(path.split("/")[3])
                limit = 100
                if query:
                    params = urllib.parse.parse_qs(query)
                    limit = int(params.get("limit", [100])[0])
                self._json_response({"history": read_chat_history(agent_id, limit)})
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
            elif path.startswith("/api/wiro/task/"):
                token = path.split("/api/wiro/task/", 1)[-1].strip("/")
                self._json_response(self._wiro_task_status(token))
            elif path == "/api/settings":
                self._json_response(self._get_settings())
            elif path.startswith("/api/settings/channel/") and path.endswith("/status"):
                # GET /api/settings/channel/{name}/status
                name = path.split("/api/settings/channel/")[1].replace("/status", "").strip("/")
                self._json_response(self._channel_status(name))
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
            elif path == "/api/agents/delegate":
                self._json_response(self._delegate(data))
            elif path == "/api/wiro/generate":
                self._json_response(self._wiro_generate(data))
            elif path == "/api/settings":
                self._json_response(self._post_settings(data))
            elif path.startswith("/api/settings/channel/"):
                # POST /api/settings/channel/{name}
                name = path.split("/api/settings/channel/")[1].strip("/").split("/")[0]
                self._json_response(self._channel_configure(name, data))
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

        # Persist user message to history (with optional image)
        append_chat_history(agent_id, "user", message, image_base64=image_base64)

        # Use docker exec + OpenClaw CLI 'agent' command
        # --agent main selects the default agent session
        try:
            result = subprocess.run(
                ["docker", "exec", f"koala-agent-{agent_id}",
                 "node", "openclaw.mjs", "agent",
                 "--agent", "main",
                 "-m", message + (" [Image attached]" if image_base64 else "")],
                capture_output=True, text=True, timeout=120
            )

            stdout = result.stdout.strip()
            stderr = result.stderr.strip()

            # Filter out OpenClaw banner/noise lines
            lines = [l for l in stdout.split('\n')
                     if l.strip() and not l.startswith('🦞') and not l.startswith('Usage:')]
            response = '\n'.join(lines).strip()

            if response:
                # Persist assistant response to history
                append_chat_history(agent_id, "assistant", response)
                return {"success": True, "response": response}
            elif result.returncode == 0:
                resp = stdout or "(empty response)"
                append_chat_history(agent_id, "assistant", resp)
                return {"success": True, "response": resp}
            else:
                return {
                    "success": False,
                    "error": stderr or "No response from agent",
                }
        except subprocess.TimeoutExpired:
            return {"error": "Request timed out"}
        except Exception as e:
            return {"error": str(e)}

    def _wiro_list_models(self, query):
        """GET /api/wiro/models — list models, optional category from query."""
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
        """POST /api/wiro/generate — {model, params} or {owner, project, params} -> run + poll."""
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
                return {"error": "Provide model (owner/project) or owner and project"}
        params = data.get("params") or {}
        try:
            return client.generate(owner.strip(), project.strip(), params)
        except Exception as e:
            return {"error": str(e)}

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
        from_id = int(from_agent) if isinstance(from_agent, int) else int(from_agent)
        to_id = int(to_agent) if isinstance(to_agent, int) else int(to_agent)
        if from_id == to_id:
            return {"error": "from_agent and to_agent must differ"}

        state = load_state()
        count = int(state.get("AGENT_COUNT", "0"))
        if to_id < 1 or to_id > count:
            return {"error": f"to_agent {to_id} out of range (1..{count})"}

        message = task if not context else f"{task}\n\nContext:\n{context}"
        try:
            result = subprocess.run(
                ["docker", "exec", f"koala-agent-{to_id}",
                 "node", "openclaw.mjs", "agent",
                 "--agent", "main",
                 "-m", message],
                capture_output=True, text=True, timeout=120
            )
            stdout = result.stdout.strip()
            stderr = result.stderr.strip()
            lines = [l for l in stdout.split("\n")
                     if l.strip() and not l.startswith("🦞") and not l.startswith("Usage:")]
            response = "\n".join(lines).strip() or stdout or "(no response)"

            # Log delegation in both agents' chat history
            append_chat_history(from_id, "assistant", f"[Delegated to agent {to_id}] {task}")
            append_chat_history(to_id, "user", f"[From orchestrator/agent {from_id}] {message}")
            append_chat_history(to_id, "assistant", response)

            return {"success": True, "response": response, "from_agent": from_id, "to_agent": to_id}
        except subprocess.TimeoutExpired:
            return {"error": "Delegation timed out"}
        except Exception as e:
            return {"error": str(e)}

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
        """POST /api/settings/channel/{name} — configure channel (login) for orchestrator."""
        state = load_state()
        orch_id = get_orchestrator_agent_id(state)
        container = f"koala-agent-{orch_id}"
        if name == "telegram":
            token = (data.get("token") or data.get("bot_token") or "").strip()
            if not token:
                return {"error": "token required"}
            try:
                result = subprocess.run(
                    ["docker", "exec", container, "node", "openclaw.mjs", "channels", "login", "telegram", "--token", token],
                    capture_output=True, text=True, timeout=30
                )
                return {"success": result.returncode == 0, "message": result.stdout or result.stderr}
            except Exception as e:
                return {"error": str(e)}
        if name == "whatsapp":
            try:
                result = subprocess.run(
                    ["docker", "exec", container, "node", "openclaw.mjs", "channels", "login", "whatsapp"],
                    capture_output=True, text=True, timeout=60
                )
                out = result.stdout or result.stderr
                return {"success": result.returncode == 0, "message": out, "qr_url": out if "http" in out else None}
            except Exception as e:
                return {"error": str(e)}
        if name == "slack":
            bot = (data.get("bot_token") or data.get("token") or "").strip()
            app = (data.get("app_token") or "").strip()
            if not bot:
                return {"error": "bot_token required"}
            try:
                args = ["docker", "exec", container, "node", "openclaw.mjs", "channels", "login", "slack", "--token", bot]
                if app:
                    args.extend(["--app-token", app])
                result = subprocess.run(args, capture_output=True, text=True, timeout=30)
                return {"success": result.returncode == 0, "message": result.stdout or result.stderr}
            except Exception as e:
                return {"error": str(e)}
        if name == "discord":
            token = (data.get("token") or data.get("bot_token") or "").strip()
            if not token:
                return {"error": "token required"}
            try:
                result = subprocess.run(
                    ["docker", "exec", container, "node", "openclaw.mjs", "channels", "login", "discord", "--token", token],
                    capture_output=True, text=True, timeout=30
                )
                return {"success": result.returncode == 0, "message": result.stdout or result.stderr}
            except Exception as e:
                return {"error": str(e)}
        return {"error": f"Unknown channel: {name}"}

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
        """Suppress default logging for cleaner output."""
        pass


# ─── Server ──────────────────────────────────────────────────────
def run_server():
    """Start the Admin API server."""
    server = HTTPServer(("0.0.0.0", API_PORT), AdminAPIHandler)
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

