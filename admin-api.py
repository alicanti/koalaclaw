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

# ─── Configuration ───────────────────────────────────────────────
API_PORT = int(os.environ.get("KOALACLAW_API_PORT", "3099"))
INSTALL_DIR = os.environ.get("KOALACLAW_INSTALL_DIR", "/opt/koalaclaw")
STATE_FILE = os.path.join(INSTALL_DIR, ".koalaclaw.state")
UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui")
ROLES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roles")

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
            elif path == "/api/roles":
                self._json_response({"roles": get_all_roles()})
            elif path == "/api/stats":
                self._json_response({"stats": docker_stats()})
            elif path == "/api/config":
                state = load_state()
                safe_state = {k: v for k, v in state.items()
                              if k not in ("API_KEY",) and not k.startswith("TOKEN_")}
                self._json_response(safe_state)
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

        if not agent_id or not message:
            return {"error": "agent_id and message required"}

        state = load_state()
        token = state.get(f"TOKEN_{agent_id}", "")

        if not token:
            return {"error": f"No token found for agent {agent_id}"}

        # Use docker exec + OpenClaw CLI to send message
        # The CLI connects via localhost WebSocket (auto-approved pairing)
        try:
            result = subprocess.run(
                ["docker", "exec", f"koala-agent-{agent_id}",
                 "node", "openclaw.mjs", "chat",
                 "--url", f"ws://127.0.0.1:18789",
                 "--token", token,
                 "--message", message,
                 "--no-stream"],
                capture_output=True, text=True, timeout=60
            )

            stdout = result.stdout.strip()
            stderr = result.stderr.strip()

            if result.returncode == 0 and stdout:
                return {
                    "success": True,
                    "response": stdout,
                }
            else:
                # Try without --no-stream flag
                result2 = subprocess.run(
                    ["docker", "exec", f"koala-agent-{agent_id}",
                     "node", "openclaw.mjs", "chat",
                     "--url", f"ws://127.0.0.1:18789",
                     "--token", token,
                     "-m", message],
                    capture_output=True, text=True, timeout=60
                )
                stdout2 = result2.stdout.strip()
                if stdout2:
                    return {"success": True, "response": stdout2}
                return {
                    "success": False,
                    "response": stdout or stdout2 or None,
                    "error": stderr or "No response from agent",
                }
        except subprocess.TimeoutExpired:
            return {"error": "Request timed out"}
        except Exception as e:
            return {"error": str(e)}

    def _json_response(self, data, status=HTTPStatus.OK):
        """Send a JSON response."""
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

