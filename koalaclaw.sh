#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  KoalaClaw - OpenClaw Multi-Agent Deployment Tool           ║
# ║  https://github.com/alicanti/koalaclaw                     ║
# ║  by Alican Tilki (@alicanti)                                ║
# ╚══════════════════════════════════════════════════════════════╝
set -euo pipefail

VERSION="2.0.0"
DEFAULT_INSTALL_DIR="/opt/koalaclaw"
DEFAULT_START_PORT=3001
DEFAULT_SUBNET="172.30.0.0/24"
DEFAULT_GATEWAY_IP="172.30.0.1"
DEFAULT_CADDY_IP="172.30.0.100"
DEFAULT_AGENT_IP_PREFIX="172.30.0.1"  # agents: .11, .12, .13 ...
STATE_FILE=".koalaclaw.state"
CREDENTIALS_FILE=".credentials"
LOG_FILE="/var/log/koalaclaw-install.log"
OPENCLAW_IMAGE="alpine/openclaw:latest"
CADDY_IMAGE="caddy:2-alpine"
MIN_RAM_MB=1024
MIN_DISK_MB=5120
INTERNAL_PORT=18789
ADMIN_API_PORT=3099
GITHUB_REPO="https://github.com/alicanti/koalaclaw.git"
REPO_DIR="${DEFAULT_INSTALL_DIR}/repo"

# ═══════════════════════════════════════
# COLORS
# ═══════════════════════════════════════
if [[ -t 1 ]] && [[ "${NO_COLOR:-}" != "1" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    WHITE='\033[1;37m'
    DIM='\033[2m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' WHITE='' DIM='' BOLD='' NC=''
fi

# ═══════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════
_log() { echo -e "$1" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "$1"; }
_info()    { _log "${GREEN}  ✓${NC} $1"; }
_warn()    { _log "${YELLOW}  ⚠${NC} $1"; }
_error()   { _log "${RED}  ✗${NC} $1"; }
_step()    { _log "${CYAN}  →${NC} $1"; }
_header()  { _log "\n${BOLD}${WHITE}  ─── $1 ───${NC}\n"; }
_spinner() {
    local pid=$1 msg=$2
    local spin='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    while kill -0 "$pid" 2>/dev/null; do
        printf "\r${CYAN}  %s${NC} %s" "${spin:i++%10:1}" "$msg"
        sleep 0.1
    done
    printf "\r"
}

# ═══════════════════════════════════════
# BANNER
# ═══════════════════════════════════════
_banner() {
    echo -e "${CYAN}"
    cat << 'KOALA'
  ⢀⠔⠊⠉⠑⢄⠀⠀⣀⣀⠤⠤⠤⢀⣀⠀⠀⣀⠔⠋⠉⠒⡄⠀
  ⡎⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠉⠀⠀⠀⠀⠀⠘⡄
  ⣧⢢⠀⠀⠀⠀⠀⠀⠀⠀⣀⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⢈⣆⡗
  ⠘⡇⠀⢀⠆⠀⠀⣀⠀⢰⣿⣿⣧⠀⢀⡀⠀⠀⠘⡆⠀⠈⡏⠀
  ⠀⠑⠤⡜⠀⠀⠈⠋⠀⢸⣿⣿⣿⠀⠈⠃⠀⠀⠀⠸⡤⠜⠀⠀
  ⠀⠀⠀⣇⠀⠀⠀⠀⠀⠢⣉⢏⣡⠀⠀⠀⠀⠀⠀⢠⠇⠀⠀⠀
  ⠀⠀⠀⠈⠢⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡤⠋⠀⠀⠀⠀
  ⠀⠀⠀⠀⠀⢨⠃⠀⢀⠀⢀⠔⡆⠀⠀⠀⠀⠻⡄⠀⠀⠀⠀⠀
  ⠀⠀⠀⠀⠀⡎⠀⠀⠧⠬⢾⠊⠀⠀⢀⡇⠀⠀⠟⢆⠀⠀⠀⠀
  ⠀⠀⠀⠀⢀⡇⠀⠀⡞⠀⠀⢣⣀⡠⠊⠀⠀⠀⢸⠈⣆⡀⠀⠀
  ⠀⠀⡠⠒⢸⠀⠀⠀⡇⡠⢤⣯⠅⠀⠀⠀⢀⡴⠃⠀⢸⠘⢤⠀
  ⠀⢰⠁⠀⢸⠀⠀⠀⣿⠁⠀⠙⡟⠒⠒⠉⠀⠀⠀⠀⠀⡇⡎⠀
  ⠀⠘⣄⠀⠸⡆⠀⠀⣿⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⢀⠟⠁⠀
  ⠀⠀⠘⠦⣀⣷⣀⡼⠽⢦⡀⠀⠀⢀⣀⣀⣀⠤⠄⠒⠁⠀⠀⠀
KOALA
    echo -e "${NC}"
    echo -e "  ${RED}🦞${NC} ${BOLD}${GREEN}K O A L A C L A W${NC} ${RED}🦞${NC}"
    echo ""
    echo -e "  ${WHITE}█▄▀ █▀█ ▄▀█ █   ▄▀█ █▀▀ █   ▄▀█ █ █ █${NC}"
    echo -e "  ${WHITE}█ █ █▄█ █▀█ █▄▄ █▀█ █▄▄ █▄▄ █▀█ ▀▄▀▄▀${NC}"
    echo ""
    echo -e "  ${DIM}Multi-Agent Deployment Tool  v${VERSION}${NC}"
    echo -e "  ${DIM}by Alican Tilki (@alicanti)${NC}"
    echo -e "  ${DIM}github.com/alicanti/koalaclaw${NC}"
    echo ""
}

# ═══════════════════════════════════════
# ROLE MANAGEMENT
# ═══════════════════════════════════════
_list_roles() {
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local roles_dir="${script_dir}/roles"
    
    # Also check repo dir and install dir
    if [[ ! -d "$roles_dir" ]]; then
        roles_dir="${REPO_DIR:-${INSTALL_DIR:-/opt/koalaclaw}/repo}/roles"
    fi
    if [[ ! -d "$roles_dir" ]]; then
        roles_dir="${INSTALL_DIR:-/opt/koalaclaw}/repo/roles"
    fi
    if [[ ! -d "$roles_dir" ]]; then
        return 0  # Return 0 to avoid set -e issues; empty output means no roles
    fi
    
    local roles=()
    for role_dir in "${roles_dir}"/*; do
        if [[ -d "$role_dir" && -f "${role_dir}/IDENTITY.md" ]]; then
            local role_name
            role_name=$(basename "$role_dir")
            roles+=("$role_name")
        fi
    done
    
    if (( ${#roles[@]} > 0 )); then
        printf '%s\n' "${roles[@]}" | sort
    fi
}

_get_role_info() {
    local role="$1"
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local role_dir="${script_dir}/roles/${role}"
    
    # Also check repo dir
    if [[ ! -f "${role_dir}/IDENTITY.md" ]]; then
        role_dir="${REPO_DIR:-${INSTALL_DIR:-/opt/koalaclaw}/repo}/roles/${role}"
    fi
    if [[ ! -f "${role_dir}/IDENTITY.md" ]]; then
        echo "🐨 ${role}"
        return 0
    fi
    
    # Extract name and emoji from IDENTITY.md
    local name emoji
    name=$(grep -E "^\*\*Name:\*\*" "${role_dir}/IDENTITY.md" 2>/dev/null | sed 's/.*\*\*Name:\*\* //' | head -1)
    emoji=$(grep -E "^\*\*Emoji:\*\*" "${role_dir}/IDENTITY.md" 2>/dev/null | sed 's/.*\*\*Emoji:\*\* //' | head -1)
    
    echo "${emoji:-🐨} ${name:-${role}}"
}

_select_role() {
    local agent_num="${1:-}"
    local prompt_text="Select role"
    [[ -n "$agent_num" ]] && prompt_text="Select role for Agent ${agent_num}"
    
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local roles_dir="${script_dir}/roles"
    
    # Also check repo dir
    if [[ ! -d "$roles_dir" ]]; then
        roles_dir="${REPO_DIR:-${INSTALL_DIR:-/opt/koalaclaw}/repo}/roles"
    fi
    if [[ ! -d "$roles_dir" ]]; then
        _warn "Roles directory not found. Using default role." >&2
        echo "coder-koala"
        return 0
    fi
    
    local roles=()
    while IFS= read -r role; do
        [[ -n "$role" ]] && roles+=("$role")
    done < <(_list_roles)
    
    if (( ${#roles[@]} == 0 )); then
        _warn "No roles found. Using default role." >&2
        echo "coder-koala"
        return 0
    fi
    
    # Print menu to stderr so it doesn't pollute stdout (which is the return value)
    echo "" >&2
    echo -e "  ${BOLD}${prompt_text}:${NC}" >&2
    local idx=1
    for role in "${roles[@]}"; do
        local info
        info=$(_get_role_info "$role")
        printf "    %2d) %s\n" "$idx" "$info" >&2
        (( idx++ ))
    done
    echo "" >&2
    
    while true; do
        read -rp "  Choice [1]: " choice
        choice="${choice:-1}"
        if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#roles[@]} )); then
            echo "${roles[$((choice - 1))]}"
            return 0
        fi
        _error "Invalid choice. Enter a number between 1 and ${#roles[@]}" >&2
    done
}

_apply_role_to_agent() {
    local agent_num="$1"
    local role="$2"
    local agent_dir="${INSTALL_DIR}/data/koala-agent-${agent_num}"
    local role_dir
    
    # Find role directory (script dir → repo dir → install dir)
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    role_dir="${script_dir}/roles/${role}"
    
    if [[ ! -d "$role_dir" ]]; then
        role_dir="${REPO_DIR:-${INSTALL_DIR}/repo}/roles/${role}"
    fi
    if [[ ! -d "$role_dir" ]]; then
        _warn "Role directory not found for '${role}'. Skipping role application."
        return 1
    fi
    
    # Create agent identity directory
    local identity_dir="${agent_dir}/agents/main/agent/identity"
    mkdir -p "$identity_dir"
    
    # Copy role files
    if [[ -f "${role_dir}/IDENTITY.md" ]]; then
        cp "${role_dir}/IDENTITY.md" "${identity_dir}/IDENTITY.md"
    fi
    if [[ -f "${role_dir}/SOUL.md" ]]; then
        cp "${role_dir}/SOUL.md" "${identity_dir}/SOUL.md"
    fi
    
    # Apply skills from role
    if [[ -f "${role_dir}/skills.json" ]]; then
        # Skills will be applied via OpenClaw config
        local skills_file="${agent_dir}/role-skills.json"
        cp "${role_dir}/skills.json" "$skills_file"
    fi
    
    _info "Applied role '${role}' to Agent ${agent_num}"
}

# ═══════════════════════════════════════
# STATE MANAGEMENT
# ═══════════════════════════════════════
_state_path() { echo "${INSTALL_DIR}/${STATE_FILE}"; }
_state_exists() { [[ -f "$(_state_path)" ]]; }

_load_state() {
    if ! _state_exists; then
        _error "No KoalaClaw installation found at ${INSTALL_DIR}"
        _error "Run: sudo $0 install"
        exit 1
    fi
    # Source state variables
    # State is a simple key=value bash file
    source "$(_state_path)"
}

_save_state() {
    cat > "$(_state_path)" << STATEEOF
# KoalaClaw State File - DO NOT EDIT MANUALLY
KOALACLAW_VERSION="${VERSION}"
INSTALL_DIR="${INSTALL_DIR}"
SERVER_IP="${SERVER_IP}"
AGENT_COUNT=${AGENT_COUNT}
START_PORT=${START_PORT}
SUBNET="${SUBNET}"
CADDY_IP="${CADDY_IP}"
MODEL="${MODEL}"
PROVIDER="${PROVIDER}"
API_KEY="${API_KEY}"
CREATED_AT="${CREATED_AT:-$(date -Iseconds)}"
UPDATED_AT="$(date -Iseconds)"
$(for i in $(seq 1 "$AGENT_COUNT"); do
    eval "echo \"TOKEN_${i}=\${TOKEN_${i}}\""
    eval "echo \"ROLE_${i}=\${ROLE_${i}:-coder-koala}\""
done)
STATEEOF
    chmod 600 "$(_state_path)"
}

# ═══════════════════════════════════════
# PREREQUISITES
# ═══════════════════════════════════════
_check_os() {
    _step "Checking operating system..."
    if [[ ! -f /etc/os-release ]]; then
        _error "Cannot detect OS. This script requires Ubuntu 22.04/24.04."
        exit 1
    fi
    source /etc/os-release
    if [[ "$ID" != "ubuntu" ]] && [[ "$ID" != "debian" ]]; then
        _warn "Detected ${ID} ${VERSION_ID}. This script is tested on Ubuntu 22.04/24.04."
        _warn "Continuing anyway, but things may break."
    else
        _info "OS: ${PRETTY_NAME}"
    fi
}

_check_root() {
    if [[ $EUID -ne 0 ]]; then
        _error "This script must be run as root (use sudo)"
        exit 1
    fi
}

_check_internet() {
    _step "Checking internet connectivity..."
    # Use curl as primary check (more reliable than ping on cloud VMs)
    if curl -sf --max-time 5 https://google.com &>/dev/null || \
       curl -sf --max-time 5 https://github.com &>/dev/null; then
        _info "Internet connectivity OK"
    elif command -v ping &>/dev/null && \
         (ping -c 1 -W 3 8.8.8.8 &>/dev/null || ping -c 1 -W 3 1.1.1.1 &>/dev/null); then
        _info "Internet connectivity OK (DNS may be limited)"
    else
        _error "No internet connectivity. Docker images cannot be pulled."
        exit 1
    fi

    if ! curl -sf --max-time 5 https://registry-1.docker.io/v2/ &>/dev/null && \
       ! curl -sf --max-time 5 https://hub.docker.com &>/dev/null; then
        _warn "Docker Hub may not be reachable. Pull might fail."
    fi
}

_check_ram() {
    _step "Checking available memory..."
    local total_mb
    total_mb=$(awk '/MemTotal/ {printf "%.0f", $2/1024}' /proc/meminfo)
    local free_mb
    free_mb=$(awk '/MemAvailable/ {printf "%.0f", $2/1024}' /proc/meminfo)

    if (( total_mb < MIN_RAM_MB )); then
        _error "Insufficient RAM: ${total_mb}MB total (minimum ${MIN_RAM_MB}MB)"
        _error "Each agent needs ~300-500MB. Consider adding swap."
        exit 1
    fi

    local needed_mb=$(( AGENT_COUNT * 400 + 200 ))  # agents + caddy
    if (( free_mb < needed_mb )); then
        _warn "Low available memory: ${free_mb}MB free, ~${needed_mb}MB needed for ${AGENT_COUNT} agents"
        _warn "Agents may crash under load. Consider adding swap or reducing agent count."
    else
        _info "Memory: ${free_mb}MB available / ${total_mb}MB total"
    fi
}

_check_disk() {
    _step "Checking disk space..."
    local free_mb
    free_mb=$(df -BM "${INSTALL_DIR%/*}" 2>/dev/null | awk 'NR==2 {gsub(/M/,"",$4); print $4}')
    if [[ -z "$free_mb" ]]; then
        free_mb=$(df -BM / | awk 'NR==2 {gsub(/M/,"",$4); print $4}')
    fi

    if (( free_mb < MIN_DISK_MB )); then
        _error "Insufficient disk space: ${free_mb}MB free (minimum ${MIN_DISK_MB}MB)"
        exit 1
    fi
    _info "Disk: ${free_mb}MB available"
}

_check_ports() {
    _step "Checking port availability..."
    local conflict=false
    # Check agent ports
    for i in $(seq 0 $(( AGENT_COUNT - 1 ))); do
        local port=$(( START_PORT + i ))
        if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
           netstat -tlnp 2>/dev/null | grep -q ":${port} "; then
            _error "Port ${port} is already in use"
            conflict=true
        fi
    done
    # Check admin API port
    if ss -tlnp 2>/dev/null | grep -q ":${ADMIN_API_PORT} " || \
       netstat -tlnp 2>/dev/null | grep -q ":${ADMIN_API_PORT} "; then
        _error "Port ${ADMIN_API_PORT} (Web UI) is already in use"
        conflict=true
    fi
    if $conflict; then
        _error "Free the conflicting ports or choose a different starting port."
        exit 1
    fi
    _info "Ports ${START_PORT}-$(( START_PORT + AGENT_COUNT - 1 )) + ${ADMIN_API_PORT} available"
}

_check_subnet() {
    _step "Checking Docker network subnet..."
    if docker network ls --format '{{.Name}}' 2>/dev/null | grep -q koala-net; then
        _warn "Docker network 'koala-net' already exists (will be recreated)"
    fi
    # Check if subnet conflicts with existing networks
    local existing
    existing=$(docker network inspect --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' \
        $(docker network ls -q) 2>/dev/null | tr '\n' ' ')
    if echo "$existing" | grep -q "${SUBNET}"; then
        # Try alternate subnets
        for alt in "172.31.0.0/24" "172.29.0.0/24" "172.28.0.0/24" "10.99.0.0/24"; do
            if ! echo "$existing" | grep -q "${alt}"; then
                _warn "Subnet ${SUBNET} conflicts. Using ${alt} instead."
                SUBNET="$alt"
                local prefix="${alt%.*}"
                CADDY_IP="${prefix}.100"
                DEFAULT_AGENT_IP_PREFIX="${prefix}.1"
                return
            fi
        done
        _error "Cannot find a free subnet. Please specify manually."
        exit 1
    fi
    _info "Subnet ${SUBNET} available"
}

_check_firewall() {
    _step "Checking firewall..."
    if command -v ufw &>/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
        _warn "UFW firewall is active"
        local end_port=$(( START_PORT + AGENT_COUNT - 1 ))
        echo ""
        read -rp "  Open ports ${START_PORT}-${end_port} + ${ADMIN_API_PORT} (Web UI) in UFW? [Y/n]: " fw_answer
        fw_answer="${fw_answer:-Y}"
        if [[ "${fw_answer,,}" == "y" ]]; then
            ufw allow "${START_PORT}:${end_port}/tcp" &>/dev/null
            ufw allow "${ADMIN_API_PORT}/tcp" &>/dev/null
            _info "UFW: ports ${START_PORT}-${end_port} + ${ADMIN_API_PORT} opened"
        else
            _warn "Ports not opened. External access may not work."
        fi
    else
        _info "No active firewall detected"
    fi
}

# ═══════════════════════════════════════
# DOCKER INSTALLATION
# ═══════════════════════════════════════
_check_docker() {
    _step "Checking Docker..."
    if command -v docker &>/dev/null; then
        local docker_version
        docker_version=$(docker --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        _info "Docker ${docker_version} found"

        # Check compose v2
        if docker compose version &>/dev/null; then
            local compose_version
            compose_version=$(docker compose version --short 2>/dev/null)
            _info "Docker Compose ${compose_version} found"
        else
            _warn "Docker Compose v2 not found. Installing..."
            _install_compose
        fi

        # Ensure docker is running
        if ! docker info &>/dev/null; then
            _step "Starting Docker service..."
            systemctl enable --now docker &>/dev/null
            sleep 2
            if ! docker info &>/dev/null; then
                _error "Docker is installed but not running. Try: systemctl start docker"
                exit 1
            fi
        fi
        return
    fi

    echo ""
    read -rp "  Docker not found. Install Docker CE? [Y/n]: " install_answer
    install_answer="${install_answer:-Y}"
    if [[ "${install_answer,,}" != "y" ]]; then
        _error "Docker is required. Aborting."
        exit 1
    fi
    _install_docker
}

_install_docker() {
    _header "Installing Docker CE"
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release >/dev/null 2>&1
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg

    local codename
    codename=$(. /etc/os-release && echo "$VERSION_CODENAME" 2>/dev/null || echo "jammy")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable" \
        > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin >/dev/null 2>&1

    systemctl enable --now docker &>/dev/null
    sleep 2

    if ! docker info &>/dev/null; then
        _error "Docker installation failed."
        exit 1
    fi
    _info "Docker CE installed successfully"
}

_install_compose() {
    apt-get update -qq
    apt-get install -y -qq docker-compose-plugin >/dev/null 2>&1
    if docker compose version &>/dev/null; then
        _info "Docker Compose v2 installed"
    else
        _error "Failed to install Docker Compose v2"
        exit 1
    fi
}

# ═══════════════════════════════════════
# CLONE REPO (roles, ui, admin-api, skills, workflows)
# ═══════════════════════════════════════
_clone_repo() {
    _step "Setting up KoalaClaw platform files..."
    REPO_DIR="${INSTALL_DIR}/repo"

    # Check if git is available
    if ! command -v git &>/dev/null; then
        _step "Installing git..."
        apt-get update -qq 2>/dev/null
        apt-get install -y -qq git >/dev/null 2>&1
    fi

    if [[ -d "${REPO_DIR}/.git" ]]; then
        _step "Updating existing repo..."
        cd "${REPO_DIR}"
        git pull --quiet 2>/dev/null || _warn "Git pull failed, using existing files"
        cd "${INSTALL_DIR}"
    else
        _step "Cloning KoalaClaw repo..."
        rm -rf "${REPO_DIR}" 2>/dev/null
        if git clone --depth 1 "${GITHUB_REPO}" "${REPO_DIR}" 2>&1 | tail -2; then
            _info "Repo cloned successfully"
        else
            _warn "Git clone failed, trying tarball download..."
        fi
    fi

    # Fallback: download tarball if git clone failed
    if [[ ! -d "${REPO_DIR}/roles" ]]; then
        _step "Downloading via tarball..."
        mkdir -p "${REPO_DIR}"
        if curl -fsSL "https://github.com/alicanti/koalaclaw/archive/refs/heads/main.tar.gz" \
            | tar xz --strip-components=1 -C "${REPO_DIR}" 2>/dev/null; then
            _info "Tarball downloaded successfully"
        else
            _warn "Tarball download also failed"
        fi
    fi

    if [[ -d "${REPO_DIR}/roles" ]]; then
        local role_count
        role_count=$(ls -d "${REPO_DIR}/roles/"*/ 2>/dev/null | wc -l)
        _info "Platform files ready: ${role_count} roles, UI, skills, workflows"
    else
        _warn "Could not download platform files. Roles and Web UI will not be available."
        _warn "You can manually clone: git clone ${GITHUB_REPO} ${REPO_DIR}"
    fi
}

# ═══════════════════════════════════════
# ADMIN API (Web UI) SETUP
# ═══════════════════════════════════════
_setup_admin_api() {
    _step "Setting up Web UI (Admin API on port ${ADMIN_API_PORT})..."

    if [[ ! -f "${REPO_DIR}/admin-api.py" ]]; then
        _warn "admin-api.py not found. Web UI will not be available."
        return 1
    fi

    # Create systemd service
    cat > /etc/systemd/system/koalaclaw-ui.service << UIEOF
[Unit]
Description=KoalaClaw Web UI (Admin API)
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=${REPO_DIR}
ExecStart=/usr/bin/python3 ${REPO_DIR}/admin-api.py
Restart=always
RestartSec=5
User=root
Environment=KOALACLAW_INSTALL_DIR=${INSTALL_DIR}
Environment=KOALACLAW_API_PORT=${ADMIN_API_PORT}

[Install]
WantedBy=multi-user.target
UIEOF

    systemctl daemon-reload
    systemctl enable koalaclaw-ui &>/dev/null
    systemctl restart koalaclaw-ui &>/dev/null

    sleep 2

    # Verify it started
    if systemctl is-active --quiet koalaclaw-ui; then
        _info "Web UI running on port ${ADMIN_API_PORT}"
    else
        _warn "Web UI failed to start. Check: journalctl -u koalaclaw-ui"
    fi
}

# ═══════════════════════════════════════
# INSTALL DEPENDENCIES
# ═══════════════════════════════════════
_install_deps() {
    _step "Checking dependencies..."
    local missing=()
    local apt_packages=()
    
    for cmd in curl openssl python3 git; do
        if ! command -v "$cmd" &>/dev/null; then
            missing+=("$cmd")
            # Map command names to apt package names
            case "$cmd" in
                python3) apt_packages+=("python3") ;;
                *)       apt_packages+=("$cmd") ;;
            esac
        fi
    done
    if ! command -v ss &>/dev/null && ! command -v netstat &>/dev/null; then
        missing+=("ss")
        apt_packages+=("iproute2")
    fi

    if (( ${#missing[@]} > 0 )); then
        _step "Installing: ${missing[*]}"
        apt-get update -qq 2>/dev/null
        apt-get install -y -qq "${apt_packages[@]}" >/dev/null 2>&1
        # Verify
        local still_missing=false
        for cmd in curl openssl python3 git; do
            if ! command -v "$cmd" &>/dev/null; then
                _error "Failed to install: $cmd"
                still_missing=true
            fi
        done
        if $still_missing; then
            _error "Some dependencies could not be installed. Check apt sources."
            exit 1
        fi
        _info "Dependencies installed"
    else
        _info "All dependencies present"
    fi
}

# ═══════════════════════════════════════
# DETECT SERVER IP
# ═══════════════════════════════════════
_detect_server_ip() {
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [[ -z "$ip" ]]; then
        ip=$(ip route get 8.8.8.8 2>/dev/null | awk '{print $7; exit}')
    fi
    echo "${ip:-127.0.0.1}"
}

# ═══════════════════════════════════════
# API KEY VALIDATION
# ═══════════════════════════════════════
_validate_api_key() {
    local provider="$1" key="$2"
    _step "Validating API key..."

    case "$provider" in
        openai)
            local response
            response=$(curl -sf --max-time 10 \
                -H "Authorization: Bearer ${key}" \
                "https://api.openai.com/v1/models" 2>/dev/null) || {
                _error "Invalid API key or cannot reach OpenAI API"
                return 1
            }

            # Check for error
            if echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if 'data' in d else 1)" 2>/dev/null; then
                _info "API key valid"

                # Check billing
                local billing
                billing=$(curl -sf --max-time 10 \
                    -X POST "https://api.openai.com/v1/chat/completions" \
                    -H "Authorization: Bearer ${key}" \
                    -H "Content-Type: application/json" \
                    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}],"max_tokens":1}' 2>/dev/null)

                if echo "$billing" | grep -q "insufficient_quota"; then
                    _warn "API key has no billing credits. Chat will not work until you add credits."
                    _warn "Add credits at: https://platform.openai.com/account/billing"
                fi
                return 0
            else
                _error "API key is invalid"
                return 1
            fi
            ;;
        anthropic)
            local response
            response=$(curl -sf --max-time 10 \
                -H "x-api-key: ${key}" \
                -H "anthropic-version: 2023-06-01" \
                "https://api.anthropic.com/v1/models" 2>/dev/null)
            if [[ $? -eq 0 ]]; then
                _info "Anthropic API key valid"
                return 0
            else
                _error "Invalid Anthropic API key"
                return 1
            fi
            ;;
        *)
            _warn "Cannot validate key for provider: ${provider}. Skipping validation."
            return 0
            ;;
    esac
}

_list_models() {
    local provider="$1" key="$2"
    case "$provider" in
        openai)
            curl -sf --max-time 10 \
                -H "Authorization: Bearer ${key}" \
                "https://api.openai.com/v1/models" 2>/dev/null | \
            python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    models = sorted([m['id'] for m in d.get('data',[]) if any(x in m['id'] for x in ['gpt','o1','o3','o4'])])
    for i,m in enumerate(models,1):
        print(f'    {i}) {m}')
except:
    pass
" 2>/dev/null
            ;;
        anthropic)
            echo "    1) claude-opus-4-6"
            echo "    2) claude-sonnet-4-5"
            echo "    3) claude-haiku-3-5"
            ;;
    esac
}

# ═══════════════════════════════════════
# FILE GENERATORS
# ═══════════════════════════════════════
_generate_compose() {
    local compose_file="${INSTALL_DIR}/docker-compose.yml"
    _step "Generating docker-compose.yml..."

    cat > "$compose_file" << 'COMPOSE_HEADER'
services:
COMPOSE_HEADER

    # Agent services
    for i in $(seq 1 "$AGENT_COUNT"); do
        local agent_ip="${DEFAULT_AGENT_IP_PREFIX}${i}"
        eval "local token=\${TOKEN_${i}}"
        local port=$(( START_PORT + i - 1 ))

        cat >> "$compose_file" << AGENT_EOF
  koala-agent-${i}:
    image: ${OPENCLAW_IMAGE}
    container_name: koala-agent-${i}
    restart: unless-stopped
    environment:
      - OPENCLAW_GATEWAY_TOKEN=${token}
      - OPENCLAW_STATE_DIR=/state
AGENT_EOF

        # Provider-specific env vars
        case "$PROVIDER" in
            openai)     echo "      - OPENAI_API_KEY=${API_KEY}" >> "$compose_file" ;;
            anthropic)  echo "      - ANTHROPIC_API_KEY=${API_KEY}" >> "$compose_file" ;;
            *)          echo "      - OPENAI_API_KEY=${API_KEY}" >> "$compose_file" ;;
        esac

        cat >> "$compose_file" << AGENT_EOF2
    volumes:
      - ./data/koala-agent-${i}:/state
    networks:
      koala-net:
        ipv4_address: ${agent_ip}
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "--header=Authorization: Bearer ${token}", "http://127.0.0.1:${INTERNAL_PORT}/__openclaw__/canvas/"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 20s

AGENT_EOF2
    done

    # Caddy service
    cat >> "$compose_file" << CADDY_HEAD
  caddy:
    image: ${CADDY_IMAGE}
    container_name: koala-caddy
    restart: unless-stopped
    depends_on:
CADDY_HEAD

    for i in $(seq 1 "$AGENT_COUNT"); do
        cat >> "$compose_file" << DEP_EOF
      koala-agent-${i}:
        condition: service_healthy
DEP_EOF
    done

    echo "    ports:" >> "$compose_file"
    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        echo "      - \"${port}:${port}\"" >> "$compose_file"
    done

    cat >> "$compose_file" << CADDY_TAIL
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"
    networks:
      koala-net:
        ipv4_address: ${CADDY_IP}

networks:
  koala-net:
    driver: bridge
    ipam:
      config:
        - subnet: ${SUBNET}
          gateway: ${SUBNET%.*}.1

volumes:
  caddy_data:
  caddy_config:
CADDY_TAIL

    _info "docker-compose.yml created"
}

_generate_caddyfile() {
    local caddy_file="${INSTALL_DIR}/Caddyfile"
    _step "Generating Caddyfile..."

    > "$caddy_file"
    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        eval "local token=\${TOKEN_${i}}"

        cat >> "$caddy_file" << CADDY_EOF
:${port} {
	reverse_proxy koala-agent-${i}:${INTERNAL_PORT} {
		header_up Authorization "Bearer ${token}"
		header_up X-Forwarded-Proto "https"
	}
	log {
		output stderr
		level WARN
	}
}

CADDY_EOF
    done
    _info "Caddyfile created (${AGENT_COUNT} ports)"
}

_generate_agent_configs() {
    _step "Generating agent configurations..."

    for i in $(seq 1 "$AGENT_COUNT"); do
        local agent_dir="${INSTALL_DIR}/data/koala-agent-${i}"
        local auth_dir="${agent_dir}/agents/main/agent"
        local port=$(( START_PORT + i - 1 ))
        eval "local token=\${TOKEN_${i}}"
        eval "local role=\${ROLE_${i}:-coder-koala}"

        mkdir -p "$auth_dir"
        
        # Apply role to agent (non-fatal if role not found)
        _apply_role_to_agent "$i" "$role" || true

        # openclaw.json
        local cdp_port=$(( 18792 + i - 1 ))
        python3 -c "
import json
cfg = {
    'agents': {
        'defaults': {
            'model': {
                'primary': '${MODEL}'
            }
        }
    },
    'gateway': {
        'port': ${INTERNAL_PORT},
        'bind': 'lan',
        'controlUi': {
            'allowedOrigins': ['http://${SERVER_IP}:${port}'],
            'allowInsecureAuth': True,
            'dangerouslyDisableDeviceAuth': True
        },
        'auth': {
            'token': '${token}'
        },
        'trustedProxies': ['${CADDY_IP}']
    },
    'browser': {
        'enabled': True,
        'noSandbox': True,
        'attachOnly': True,
        'defaultProfile': 'chrome',
        'profiles': {
            'chrome': {
                'cdpPort': ${cdp_port},
                'driver': 'extension',
                'color': '#00AA00'
            }
        }
    }
}
with open('${agent_dir}/openclaw.json', 'w') as f:
    json.dump(cfg, f, indent=4)
"

        # auth-profiles.json
        local provider_id="${PROVIDER}"
        python3 -c "
import json
data = {
    'version': 1,
    'profiles': {
        '${provider_id}': {
            'type': 'api_key',
            'provider': '${provider_id}',
            'key': '${API_KEY}'
        }
    }
}
with open('${auth_dir}/auth-profiles.json', 'w') as f:
    json.dump(data, f, indent=2)
"
    done

    # Fix permissions
    chown -R 1000:1000 "${INSTALL_DIR}/data/"
    chmod -R u+rwX,g+rwX,o-rwx "${INSTALL_DIR}/data/"

    _info "Agent configs created (${AGENT_COUNT} agents)"
}

_generate_credentials() {
    local creds_file="${INSTALL_DIR}/${CREDENTIALS_FILE}"
    _step "Saving credentials..."

    cat > "$creds_file" << CREDS_HEADER
# ╔══════════════════════════════════════════════════════╗
# ║  KoalaClaw Credentials                              ║
# ║  Generated: $(date)              ║
# ║  KEEP THIS FILE SECURE                              ║
# ╚══════════════════════════════════════════════════════╝

Server: ${SERVER_IP}
Model: ${MODEL}
Provider: ${PROVIDER}
Install Dir: ${INSTALL_DIR}

Web UI: http://${SERVER_IP}:${ADMIN_API_PORT}

CREDS_HEADER

    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        eval "local token=\${TOKEN_${i}}"
        cat >> "$creds_file" << CRED_AGENT
Agent ${i}:
  URL:   http://${SERVER_IP}:${port}/#token=${token}
  Token: ${token}
  Port:  ${port}

CRED_AGENT
    done

    chmod 600 "$creds_file"
    _info "Credentials saved to ${creds_file}"
}

# ═══════════════════════════════════════
# DEPLOY
# ═══════════════════════════════════════
_deploy() {
    _header "Deploying"

    cd "${INSTALL_DIR}"

    _step "Pulling Docker images..."
    docker compose pull --quiet 2>&1 | tail -1
    _info "Images pulled"

    _step "Starting containers..."
    docker compose up -d 2>&1 | tail -5
    _info "Containers started"

    _wait_healthy
    _reset_device_identity
    _setup_browser_relay
    _verify_endpoints
}

_setup_browser_relay() {
    _step "Setting up browser relay (CDP proxy)..."

    # Each agent needs a Node.js TCP proxy inside the container to forward
    # from 0.0.0.0:<cdp_proxy_port> → 127.0.0.1:<cdp_port>
    # because the CDP relay only binds to localhost inside the container.
    # Then a host socat forwards host:<cdp_port> → container:<cdp_proxy_port>

    for i in $(seq 1 "$AGENT_COUNT"); do
        local cdp_port=$(( 18792 + i - 1 ))
        local proxy_port=$(( 18892 + i - 1 ))  # internal proxy port

        # Create Node.js TCP proxy script inside container
        docker exec "koala-agent-${i}" sh -c "cat > /tmp/cdp-proxy.js << 'PROXYEOF'
const net = require('net');
const server = net.createServer((client) => {
  const target = net.connect(${cdp_port}, '127.0.0.1', () => {
    client.pipe(target);
    target.pipe(client);
  });
  target.on('error', () => client.destroy());
  client.on('error', () => target.destroy());
});
server.listen(${proxy_port}, '0.0.0.0', () => {
  console.log('CDP proxy: 0.0.0.0:${proxy_port} -> 127.0.0.1:${cdp_port}');
});
PROXYEOF" 2>/dev/null

        # Start the proxy inside container (kill old one first)
        docker exec "koala-agent-${i}" sh -c \
            "kill \$(lsof -t -i:${proxy_port} 2>/dev/null) 2>/dev/null; node /tmp/cdp-proxy.js &" 2>/dev/null &
        disown 2>/dev/null

        # Kill old host socat for this port
        pkill -f "socat.*${cdp_port}.*${proxy_port}" 2>/dev/null || true
    done

    sleep 2

    # Install socat on host if needed
    if ! command -v socat &>/dev/null; then
        _step "Installing socat..."
        apt-get install -y -qq socat >/dev/null 2>&1
    fi

    # Start host socat forwarders
    local relay_ok=0
    for i in $(seq 1 "$AGENT_COUNT"); do
        local cdp_port=$(( 18792 + i - 1 ))
        local proxy_port=$(( 18892 + i - 1 ))
        local agent_ip="${DEFAULT_AGENT_IP_PREFIX}${i}"

        # Kill old socat
        pkill -f "socat.*TCP-LISTEN:${cdp_port}" 2>/dev/null || true
        sleep 0.5

        # Forward host:cdp_port → container_ip:proxy_port
        nohup socat "TCP-LISTEN:${cdp_port},fork,reuseaddr" \
            "TCP:${agent_ip}:${proxy_port}" >/dev/null 2>&1 &
        disown 2>/dev/null
        relay_ok=$(( relay_ok + 1 ))
    done

    # Create systemd service for persistence across reboots
    _create_relay_systemd_service

    _info "Browser relay: ${relay_ok}/${AGENT_COUNT} agents configured"
    _info "CDP ports: $(seq -s', ' 18792 $(( 18792 + AGENT_COUNT - 1 )))"
}

_create_relay_systemd_service() {
    # Create a systemd service to start socat forwarders on boot
    local service_file="/etc/systemd/system/koalaclaw-relay.service"
    local script_file="${INSTALL_DIR}/relay-start.sh"

    cat > "$script_file" << RELAYEOF
#!/bin/bash
# KoalaClaw CDP Relay - auto-generated
# Forwards host CDP ports to container Node.js proxies

# Wait for Docker containers to be ready
sleep 10

RELAYEOF

    for i in $(seq 1 "$AGENT_COUNT"); do
        local cdp_port=$(( 18792 + i - 1 ))
        local proxy_port=$(( 18892 + i - 1 ))
        local agent_ip="${DEFAULT_AGENT_IP_PREFIX}${i}"

        cat >> "$script_file" << RELAYAGENT
# Agent ${i}: start Node proxy inside container
docker exec -d koala-agent-${i} sh -c "node /tmp/cdp-proxy.js 2>/dev/null &" 2>/dev/null

# Agent ${i}: forward host:${cdp_port} → container:${proxy_port}
socat TCP-LISTEN:${cdp_port},fork,reuseaddr TCP:${agent_ip}:${proxy_port} &

RELAYAGENT
    done

    echo "wait" >> "$script_file"
    chmod +x "$script_file"

    cat > "$service_file" << SVCEOF
[Unit]
Description=KoalaClaw CDP Browser Relay
After=docker.service
Requires=docker.service

[Service]
Type=simple
ExecStart=${script_file}
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload 2>/dev/null
    systemctl enable koalaclaw-relay 2>/dev/null
    _info "Relay systemd service created (persistent across reboots)"
}

_reset_device_identity() {
    _step "Resetting device identity for CLI pairing..."
    # OpenClaw requires device pairing for CLI→Gateway communication.
    # Stale device identity files cause "pairing required" errors.
    # Removing them forces a fresh auto-pairing on next local connection.
    for i in $(seq 1 "$AGENT_COUNT"); do
        docker exec "koala-agent-${i}" sh -c \
            "rm -rf /state/identity/device.json /state/devices/ 2>/dev/null" || true
    done

    # Trigger auto-pairing by connecting once from localhost
    sleep 2
    local paired=0
    for i in $(seq 1 "$AGENT_COUNT"); do
        eval "local token=\${TOKEN_${i}}"
        if docker exec "koala-agent-${i}" node openclaw.mjs devices list \
            --url "ws://127.0.0.1:${INTERNAL_PORT}" \
            --token "${token}" &>/dev/null; then
            paired=$(( paired + 1 ))
        fi
    done
    _info "Device pairing: ${paired}/${AGENT_COUNT} agents paired"
}

_wait_healthy() {
    _step "Waiting for healthchecks (up to 90s)..."
    local timeout=90
    local elapsed=0
    local all_healthy=false

    while (( elapsed < timeout )); do
        local healthy_count=0
        local total=${AGENT_COUNT}

        for i in $(seq 1 "$AGENT_COUNT"); do
            local status
            status=$(docker inspect --format='{{.State.Health.Status}}' "koala-agent-${i}" 2>/dev/null || echo "unknown")
            if [[ "$status" == "healthy" ]]; then
                healthy_count=$(( healthy_count + 1 ))
            fi
        done

        printf "\r  ${CYAN}⏳${NC} ${healthy_count}/${total} agents healthy (${elapsed}s)"

        if (( healthy_count == total )); then
            all_healthy=true
            break
        fi

        sleep 3
        (( elapsed += 3 ))
    done
    echo ""

    if $all_healthy; then
        _info "All ${AGENT_COUNT} agents healthy"
    else
        _warn "Not all agents became healthy within ${timeout}s"
        _warn "Check logs: docker compose -f ${INSTALL_DIR}/docker-compose.yml logs"
    fi
}

_verify_endpoints() {
    _step "Verifying endpoints..."
    local all_ok=true

    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        local code
        code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 \
            "http://127.0.0.1:${port}/__openclaw__/canvas/" 2>/dev/null || echo "000")
        if [[ "$code" == "200" ]]; then
            _info "Agent ${i} :${port} → HTTP ${code}"
        else
            _error "Agent ${i} :${port} → HTTP ${code}"
            all_ok=false
        fi
    done

    if ! $all_ok; then
        _warn "Some endpoints failed. Check: docker compose logs"
    fi
}

# ═══════════════════════════════════════
# PRINT SUMMARY
# ═══════════════════════════════════════
_print_summary() {
    echo ""
    echo -e "  ${BOLD}${GREEN}═══════════════════════════════════════════${NC}"
    echo -e "  ${BOLD}${GREEN}  ✅ KoalaClaw deployed successfully!${NC}"
    echo -e "  ${BOLD}${GREEN}═══════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${BOLD}🎮 Web UI:${NC}"
    echo -e "    ${CYAN}http://${SERVER_IP}:${ADMIN_API_PORT}${NC}"
    echo ""
    echo -e "  ${BOLD}Agent Canvas URLs:${NC}"
    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        eval "local token=\${TOKEN_${i}}"
        eval "local role=\${ROLE_${i}:-coder-koala}"
        local role_info
        role_info=$(_get_role_info "$role" 2>/dev/null || echo "$role")
        echo -e "    ${CYAN}Agent ${i}${NC} (${role_info}): http://${SERVER_IP}:${port}/#token=${token}"
    done
    echo ""
    echo -e "  ${DIM}Credentials: ${INSTALL_DIR}/${CREDENTIALS_FILE}${NC}"
    echo -e "  ${DIM}Model: ${MODEL}${NC}"
    echo ""
    echo -e "  ${BOLD}Quick commands:${NC}"
    echo -e "    ${DIM}koalaclaw status${NC}        # Check health"
    echo -e "    ${DIM}koalaclaw credentials${NC}   # Show access URLs"
    echo -e "    ${DIM}koalaclaw logs [N]${NC}      # View agent logs"
    echo -e "    ${DIM}koalaclaw add-agent${NC}     # Add more agents"
    echo -e "    ${DIM}koalaclaw backup${NC}        # Backup data"
    echo ""
}

# ═══════════════════════════════════════
# COMMAND: INSTALL
# ═══════════════════════════════════════
cmd_install() {
    _banner
    _check_root

    # Check existing installation
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    if [[ -f "${INSTALL_DIR}/${STATE_FILE}" ]]; then
        _warn "Existing KoalaClaw installation found at ${INSTALL_DIR}"
        echo ""
        read -rp "  Overwrite? (existing data will be preserved) [y/N]: " overwrite
        if [[ "${overwrite,,}" != "y" ]]; then
            _info "Aborting. Use 'koalaclaw update' to update or 'koalaclaw uninstall' to remove."
            exit 0
        fi
        # Stop existing
        cd "${INSTALL_DIR}" && docker compose down 2>/dev/null || true
    fi

    _header "Prerequisites"
    _check_os
    _install_deps
    _check_internet

    # ─── Interactive Config ───
    _header "Configuration"

    # Install directory (ask first so we can clone repo there)
    read -rp "  Install directory? [${DEFAULT_INSTALL_DIR}]: " INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

    # Agent count
    read -rp "  How many agents? [3]: " AGENT_COUNT
    AGENT_COUNT="${AGENT_COUNT:-3}"
    if ! [[ "$AGENT_COUNT" =~ ^[0-9]+$ ]] || (( AGENT_COUNT < 1 || AGENT_COUNT > 50 )); then
        _error "Agent count must be between 1 and 50"
        exit 1
    fi

    # Starting port
    read -rp "  Starting port? [${DEFAULT_START_PORT}]: " START_PORT
    START_PORT="${START_PORT:-$DEFAULT_START_PORT}"

    # Server IP
    local detected_ip
    detected_ip=$(_detect_server_ip)
    read -rp "  Server IP [${detected_ip}]: " SERVER_IP
    SERVER_IP="${SERVER_IP:-$detected_ip}"

    # Provider
    echo ""
    echo -e "  ${BOLD}AI Provider:${NC}"
    echo "    1) OpenAI"
    echo "    2) Anthropic"
    echo "    3) Custom (OpenAI-compatible)"
    read -rp "  Choice [1]: " provider_choice
    provider_choice="${provider_choice:-1}"

    case "$provider_choice" in
        1) PROVIDER="openai" ;;
        2) PROVIDER="anthropic" ;;
        3) PROVIDER="openai" ;;
        *) PROVIDER="openai" ;;
    esac

    # API Key
    echo ""
    while true; do
        read -rp "  ${PROVIDER^} API Key: " API_KEY
        if [[ -z "$API_KEY" ]]; then
            _error "API key is required"
            continue
        fi
        if _validate_api_key "$PROVIDER" "$API_KEY"; then
            break
        fi
        read -rp "  Try again? [Y/n]: " retry
        if [[ "${retry,,}" == "n" ]]; then
            _warn "Continuing with unvalidated key"
            break
        fi
    done

    # Model selection
    echo ""
    echo -e "  ${BOLD}Available models:${NC}"
    _list_models "$PROVIDER" "$API_KEY"
    echo ""
    local default_model="openai/gpt-4o"
    [[ "$PROVIDER" == "anthropic" ]] && default_model="anthropic/claude-sonnet-4-5"
    read -rp "  Model (full name, e.g. openai/gpt-5.2) [${default_model}]: " MODEL
    MODEL="${MODEL:-$default_model}"

    # Subnet
    SUBNET="${DEFAULT_SUBNET}"
    CADDY_IP="${DEFAULT_CADDY_IP}"

    # ─── Checks ───
    _header "System Checks"
    _check_ram
    _check_disk
    _check_docker
    _check_ports
    _check_subnet
    _check_firewall

    # ─── Clone Repo (roles, ui, admin-api) ───
    _header "Platform Files"
    mkdir -p "${INSTALL_DIR}"
    REPO_DIR="${INSTALL_DIR}/repo"
    _clone_repo

    # ─── Generate ───
    _header "Generating Configuration"

    touch "$LOG_FILE" 2>/dev/null || LOG_FILE="${INSTALL_DIR}/install.log"

    # Generate tokens and select roles
    _step "Generating tokens and selecting roles..."
    for i in $(seq 1 "$AGENT_COUNT"); do
        eval "TOKEN_${i}=$(openssl rand -hex 32)"
        # Select role for each agent
        local selected_role
        selected_role=$(_select_role "$i")
        eval "ROLE_${i}=${selected_role}"
    done
    _info "${AGENT_COUNT} tokens generated and roles assigned"

    CREATED_AT="$(date -Iseconds)"
    _save_state
    _generate_compose
    _generate_caddyfile
    _generate_agent_configs
    _generate_credentials

    # ─── Deploy ───
    _deploy

    # ─── Web UI ───
    _header "Web UI"
    _setup_admin_api || true

    _print_summary

    # Symlink for easy access
    if [[ ! -f /usr/local/bin/koalaclaw ]]; then
        local script_path
        script_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
        ln -sf "$script_path" /usr/local/bin/koalaclaw 2>/dev/null || true
    fi

    # Copy script to install dir for future use
    cp -f "${BASH_SOURCE[0]}" "${INSTALL_DIR}/koalaclaw.sh" 2>/dev/null || true
    chmod +x "${INSTALL_DIR}/koalaclaw.sh" 2>/dev/null || true
}

# ═══════════════════════════════════════
# COMMAND: ADD-AGENT
# ═══════════════════════════════════════
cmd_add_agent() {
    _banner
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state
    REPO_DIR="${INSTALL_DIR}/repo"

    local old_count=$AGENT_COUNT
    read -rp "  How many agents to add? [1]: " add_count
    add_count="${add_count:-1}"

    local new_total=$(( old_count + add_count ))
    echo -e "  ${DIM}Current: ${old_count} agents → New total: ${new_total} agents${NC}"
    echo ""

    # Same key?
    read -rp "  Use same API key? [Y/n]: " same_key
    if [[ "${same_key,,}" == "n" ]]; then
        read -rp "  New API key: " API_KEY
        _validate_api_key "$PROVIDER" "$API_KEY" || true
    fi

    # Same model?
    read -rp "  Use same model (${MODEL})? [Y/n]: " same_model
    if [[ "${same_model,,}" == "n" ]]; then
        read -rp "  New model: " MODEL
    fi

    # Generate new tokens and select roles
    for i in $(seq $(( old_count + 1 )) "$new_total"); do
        eval "TOKEN_${i}=$(openssl rand -hex 32)"
        # Select role for each new agent
        local selected_role
        selected_role=$(_select_role "$i")
        eval "ROLE_${i}=${selected_role}"
    done

    AGENT_COUNT=$new_total
    START_PORT="${START_PORT}"

    # Check new ports
    _check_ports
    _check_ram

    # Regenerate everything
    _header "Regenerating Configuration"
    _save_state
    _generate_compose
    _generate_caddyfile
    _generate_agent_configs
    _generate_credentials

    # Redeploy
    _header "Deploying"
    cd "${INSTALL_DIR}"
    docker compose up -d 2>&1 | tail -5
    _wait_healthy
    _reset_device_identity
    _verify_endpoints

    echo ""
    echo -e "  ${GREEN}✅ ${add_count} agent(s) added (total: ${new_total})${NC}"
    echo ""
    for i in $(seq $(( old_count + 1 )) "$new_total"); do
        local port=$(( START_PORT + i - 1 ))
        eval "local token=\${TOKEN_${i}}"
        echo -e "  ${CYAN}Agent ${i}:${NC} http://${SERVER_IP}:${port}/#token=${token}"
    done
    echo ""
}

# ═══════════════════════════════════════
# COMMAND: REMOVE-AGENT
# ═══════════════════════════════════════
cmd_remove_agent() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state

    local agent_id="${1:-}"
    if [[ -z "$agent_id" ]]; then
        read -rp "  Which agent to remove? (1-${AGENT_COUNT}): " agent_id
    fi

    if (( agent_id < 1 || agent_id > AGENT_COUNT )); then
        _error "Invalid agent ID. Must be between 1 and ${AGENT_COUNT}."
        exit 1
    fi

    if (( AGENT_COUNT <= 1 )); then
        _error "Cannot remove the last agent. Use 'koalaclaw uninstall' instead."
        exit 1
    fi

    local port=$(( START_PORT + agent_id - 1 ))
    _warn "This will remove Agent ${agent_id} (port ${port})"
    _warn "Agent data in data/koala-agent-${agent_id}/ will be preserved."
    read -rp "  Proceed? [y/N]: " confirm
    if [[ "${confirm,,}" != "y" ]]; then
        _info "Cancelled."
        exit 0
    fi

    # Stop specific agent
    cd "${INSTALL_DIR}"
    docker compose stop "koala-agent-${agent_id}" 2>/dev/null || true
    docker compose rm -f "koala-agent-${agent_id}" 2>/dev/null || true

    # Shift tokens down
    for i in $(seq "$agent_id" $(( AGENT_COUNT - 1 ))); do
        local next=$(( i + 1 ))
        eval "TOKEN_${i}=\${TOKEN_${next}}"
    done
    unset "TOKEN_${AGENT_COUNT}"

    AGENT_COUNT=$(( AGENT_COUNT - 1 ))

    # Regenerate
    _save_state
    _generate_compose
    _generate_caddyfile
    _generate_credentials

    # Redeploy
    docker compose up -d 2>&1 | tail -3
    _wait_healthy

    _info "Agent ${agent_id} removed. Remaining: ${AGENT_COUNT} agents."
}

# ═══════════════════════════════════════
# COMMAND: STATUS
# ═══════════════════════════════════════
cmd_status() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state

    echo ""
    echo -e "  ${BOLD}KoalaClaw Status${NC}"
    echo -e "  ${DIM}────────────────────────────────────────${NC}"
    echo -e "  Server:  ${SERVER_IP}"
    echo -e "  Agents:  ${AGENT_COUNT}"
    echo -e "  Model:   ${MODEL}"
    echo -e "  Dir:     ${INSTALL_DIR}"
    echo ""

    cd "${INSTALL_DIR}"
    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        local status health
        status=$(docker inspect --format='{{.State.Status}}' "koala-agent-${i}" 2>/dev/null || echo "not found")
        health=$(docker inspect --format='{{.State.Health.Status}}' "koala-agent-${i}" 2>/dev/null || echo "unknown")

        local code
        code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 3 \
            "http://127.0.0.1:${port}/__openclaw__/canvas/" 2>/dev/null || echo "000")

        local status_icon="${RED}✗${NC}"
        [[ "$health" == "healthy" && "$code" == "200" ]] && status_icon="${GREEN}✓${NC}"

        echo -e "  ${status_icon} Agent ${i}  :${port}  container=${status}  health=${health}  http=${code}"
    done

    # Caddy
    local caddy_status
    caddy_status=$(docker inspect --format='{{.State.Status}}' "koala-caddy" 2>/dev/null || echo "not found")
    echo -e "  ${DIM}  Caddy    container=${caddy_status}${NC}"
    echo ""
}

# ═══════════════════════════════════════
# COMMAND: CREDENTIALS
# ═══════════════════════════════════════
cmd_credentials() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state

    echo ""
    echo -e "  ${BOLD}KoalaClaw Access URLs${NC}"
    echo -e "  ${DIM}────────────────────────────────────────${NC}"
    for i in $(seq 1 "$AGENT_COUNT"); do
        local port=$(( START_PORT + i - 1 ))
        eval "local token=\${TOKEN_${i}}"
        echo -e "  ${CYAN}Agent ${i}:${NC} http://${SERVER_IP}:${port}/#token=${token}"
    done
    echo ""
    echo -e "  ${DIM}Full credentials: ${INSTALL_DIR}/${CREDENTIALS_FILE}${NC}"
    echo ""
}

# ═══════════════════════════════════════
# COMMAND: LOGS
# ═══════════════════════════════════════
cmd_logs() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state
    cd "${INSTALL_DIR}"

    local agent_id="${1:-}"
    if [[ -n "$agent_id" ]]; then
        docker compose logs --tail=50 -f "koala-agent-${agent_id}"
    else
        docker compose logs --tail=50 -f
    fi
}

# ═══════════════════════════════════════
# COMMAND: UPDATE
# ═══════════════════════════════════════
cmd_update() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state
    REPO_DIR="${INSTALL_DIR}/repo"

    _header "Updating KoalaClaw"
    cd "${INSTALL_DIR}"

    # Update platform files (roles, ui, admin-api)
    _step "Updating platform files..."
    _clone_repo

    _step "Pulling latest images..."
    docker compose pull --quiet
    _info "Images updated"

    _step "Recreating containers..."
    docker compose up -d --force-recreate 2>&1 | tail -5
    _wait_healthy
    _reset_device_identity
    _verify_endpoints

    # Restart Web UI
    if systemctl is-enabled --quiet koalaclaw-ui 2>/dev/null; then
        _step "Restarting Web UI..."
        systemctl restart koalaclaw-ui
        _info "Web UI restarted"
    fi

    # Version check
    local oc_version
    oc_version=$(docker exec koala-agent-1 node openclaw.mjs --version 2>/dev/null || echo "unknown")
    _info "OpenClaw version: ${oc_version}"
}

# ═══════════════════════════════════════
# COMMAND: BACKUP
# ═══════════════════════════════════════
cmd_backup() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state

    local backup_file="${INSTALL_DIR}/koalaclaw-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

    _step "Stopping containers..."
    cd "${INSTALL_DIR}"
    docker compose stop 2>/dev/null

    _step "Creating backup..."
    tar czf "$backup_file" \
        -C "${INSTALL_DIR}" \
        data/ \
        "${STATE_FILE}" \
        "${CREDENTIALS_FILE}" \
        docker-compose.yml \
        Caddyfile \
        2>/dev/null

    _step "Restarting containers..."
    docker compose start 2>/dev/null

    local size
    size=$(du -h "$backup_file" | cut -f1)
    _info "Backup created: ${backup_file} (${size})"
}

# ═══════════════════════════════════════
# COMMAND: RESTORE
# ═══════════════════════════════════════
cmd_restore() {
    _check_root
    local backup_file="${1:-}"
    if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
        _error "Usage: koalaclaw restore <backup-file.tar.gz>"
        exit 1
    fi

    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

    _warn "This will overwrite the current installation at ${INSTALL_DIR}"
    read -rp "  Proceed? [y/N]: " confirm
    if [[ "${confirm,,}" != "y" ]]; then
        exit 0
    fi

    # Stop existing
    if [[ -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
        cd "${INSTALL_DIR}" && docker compose down 2>/dev/null || true
    fi

    _step "Restoring from backup..."
    mkdir -p "${INSTALL_DIR}"
    tar xzf "$backup_file" -C "${INSTALL_DIR}"
    chown -R 1000:1000 "${INSTALL_DIR}/data/"

    _step "Starting containers..."
    cd "${INSTALL_DIR}"
    docker compose up -d 2>&1 | tail -5

    _load_state
    _wait_healthy
    _verify_endpoints

    _info "Restore complete"
}

# ═══════════════════════════════════════
# COMMAND: UNINSTALL
# ═══════════════════════════════════════
cmd_uninstall() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"

    if [[ ! -d "$INSTALL_DIR" ]]; then
        _error "No installation found at ${INSTALL_DIR}"
        exit 1
    fi

    _warn "This will remove all KoalaClaw containers and configuration."
    read -rp "  Also delete agent data? [y/N]: " delete_data
    read -rp "  Proceed with uninstall? [y/N]: " confirm

    if [[ "${confirm,,}" != "y" ]]; then
        exit 0
    fi

    cd "${INSTALL_DIR}"
    _step "Stopping and removing containers..."
    docker compose down -v 2>/dev/null || true

    if [[ "${delete_data,,}" == "y" ]]; then
        _step "Removing all data..."
        rm -rf "${INSTALL_DIR}"
        _info "All data removed"
    else
        _step "Removing configuration (data preserved)..."
        rm -f docker-compose.yml Caddyfile "${STATE_FILE}" "${CREDENTIALS_FILE}"
        _info "Config removed. Agent data preserved at ${INSTALL_DIR}/data/"
    fi

    rm -f /usr/local/bin/koalaclaw 2>/dev/null || true
    _info "KoalaClaw uninstalled"
}

# ═══════════════════════════════════════
# COMMAND: DRY-RUN
# ═══════════════════════════════════════
cmd_dry_run() {
    echo ""
    echo -e "  ${BOLD}KoalaClaw Dry Run${NC}"
    echo -e "  ${DIM}This shows what would happen without making changes.${NC}"
    echo ""
    echo "  Would perform:"
    echo "    1. Check OS, RAM (min ${MIN_RAM_MB}MB), Disk (min ${MIN_DISK_MB}MB)"
    echo "    2. Install Docker CE + Compose v2 (if missing)"
    echo "    3. Install curl, openssl, python3 (if missing)"
    echo "    4. Ask: agent count, port, provider, API key, model"
    echo "    5. Generate: docker-compose.yml, Caddyfile, openclaw.json per agent"
    echo "    6. Set file permissions (uid 1000)"
    echo "    7. Pull images: ${OPENCLAW_IMAGE}, ${CADDY_IMAGE}"
    echo "    8. Start containers, wait for healthchecks"
    echo "    9. Verify HTTP 200 on each port"
    echo "   10. Save credentials to ${DEFAULT_INSTALL_DIR}/${CREDENTIALS_FILE}"
    echo ""
    echo "  Estimated disk usage: ~2GB (images) + ~50MB per agent (data)"
    echo "  Estimated RAM usage: ~400MB per agent + ~50MB for Caddy"
    echo ""
}

# ═══════════════════════════════════════
# COMMAND: SKILLS
# ═══════════════════════════════════════
_get_agent_token() {
    local agent_id="$1"
    eval "echo \${TOKEN_${agent_id}}"
}

_exec_openclaw() {
    local agent_id="$1"
    shift
    local token
    token=$(_get_agent_token "$agent_id")
    docker exec "koala-agent-${agent_id}" node openclaw.mjs "$@" \
        --url "ws://127.0.0.1:${INTERNAL_PORT}" \
        --token "${token}" 2>&1
}

# ═══════════════════════════════════════
# COMMAND: BROWSER
# ═══════════════════════════════════════
cmd_browser() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state

    local subcmd="${1:-}"
    shift || true

    case "$subcmd" in
        status)     cmd_browser_status "$@" ;;
        tabs)       cmd_browser_tabs "$@" ;;
        screenshot) cmd_browser_screenshot "$@" ;;
        navigate)   cmd_browser_navigate "$@" ;;
        relay)      cmd_browser_relay "$@" ;;
        ""|--help)  cmd_browser_help ;;
        *)
            _error "Unknown browser command: ${subcmd}"
            cmd_browser_help
            exit 1
            ;;
    esac
}

cmd_browser_help() {
    echo ""
    echo -e "  ${BOLD}Usage:${NC} koalaclaw browser <command> [options]"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo -e "    ${GREEN}status${NC} ${DIM}[agent-id]${NC}               Browser relay status"
    echo -e "    ${GREEN}tabs${NC} ${DIM}[agent-id]${NC}                 List attached browser tabs"
    echo -e "    ${GREEN}screenshot${NC} ${DIM}[agent-id]${NC}           Take a screenshot"
    echo -e "    ${GREEN}navigate${NC} ${DIM}<url> [agent-id]${NC}       Navigate to a URL"
    echo -e "    ${GREEN}relay${NC}                          Restart CDP relay forwarders"
    echo ""
    echo -e "  ${BOLD}Setup:${NC}"
    echo -e "    1. Install 'OpenClaw Browser Relay' extension in Chromium"
    echo -e "    2. Open a web page and click the extension icon"
    echo -e "    3. Extension connects to agent via CDP port"
    echo ""
    echo -e "  ${BOLD}CDP Ports:${NC}"
    for i in $(seq 1 "$AGENT_COUNT"); do
        local cdp_port=$(( 18792 + i - 1 ))
        echo -e "    Agent ${i}: localhost:${cdp_port}"
    done
    echo ""
}

cmd_browser_status() {
    local agent_id="${1:-1}"
    echo ""
    echo -e "  ${BOLD}Browser Status — Agent ${agent_id}${NC}"
    echo -e "  ${DIM}────────────────────────────────────────${NC}"
    _exec_openclaw "$agent_id" browser status
    echo ""

    # Check relay chain
    local cdp_port=$(( 18792 + agent_id - 1 ))
    local relay_ok="no"
    if curl -sf --max-time 2 --head "http://127.0.0.1:${cdp_port}/" &>/dev/null; then
        relay_ok="yes"
    fi
    echo -e "  ${DIM}Relay chain (host:${cdp_port}): ${relay_ok}${NC}"
    echo ""
}

cmd_browser_tabs() {
    local agent_id="${1:-1}"
    echo ""
    echo -e "  ${BOLD}Browser Tabs — Agent ${agent_id}${NC}"
    echo -e "  ${DIM}────────────────────────────────────────${NC}"
    _exec_openclaw "$agent_id" browser tabs
    echo ""
}

cmd_browser_screenshot() {
    local agent_id="${1:-1}"
    _step "Taking screenshot from Agent ${agent_id}..."
    _exec_openclaw "$agent_id" browser screenshot
}

cmd_browser_navigate() {
    local url="${1:-}"
    local agent_id="${2:-1}"
    if [[ -z "$url" ]]; then
        _error "Usage: koalaclaw browser navigate <url> [agent-id]"
        exit 1
    fi
    _step "Navigating Agent ${agent_id} to ${url}..."
    _exec_openclaw "$agent_id" browser navigate "$url"
}

cmd_browser_relay() {
    _step "Restarting browser relay forwarders..."
    _setup_browser_relay
    _info "Relay forwarders restarted"
}

cmd_skills() {
    _check_root
    INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
    _load_state

    local subcmd="${1:-}"
    shift || true

    case "$subcmd" in
        list)       cmd_skills_list "$@" ;;
        status)     cmd_skills_status "$@" ;;
        enable)     cmd_skills_enable "$@" ;;
        disable)    cmd_skills_disable "$@" ;;
        add)        cmd_skills_add "$@" ;;
        remove)     cmd_skills_remove "$@" ;;
        ""|--help)  cmd_skills_help ;;
        *)
            _error "Unknown skills command: ${subcmd}"
            cmd_skills_help
            exit 1
            ;;
    esac
}

cmd_skills_help() {
    echo ""
    echo -e "  ${BOLD}Usage:${NC} koalaclaw skills <command> [options]"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo -e "    ${GREEN}list${NC}                          List all available bundled skills"
    echo -e "    ${GREEN}status${NC} ${DIM}[agent-id]${NC}             Show enabled skills per agent"
    echo -e "    ${GREEN}enable${NC} ${DIM}<skill> [agent-id]${NC}     Enable a skill (all agents or specific)"
    echo -e "    ${GREEN}disable${NC} ${DIM}<skill> [agent-id]${NC}    Disable a skill"
    echo -e "    ${GREEN}add${NC} ${DIM}<path> [agent-id]${NC}         Add a custom skill from a directory"
    echo -e "    ${GREEN}remove${NC} ${DIM}<skill> [agent-id]${NC}     Remove a custom skill"
    echo ""
    echo -e "  ${BOLD}Examples:${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills list${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills enable github${NC}        ${DIM}# all agents${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills enable weather 2${NC}     ${DIM}# agent 2 only${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills disable coding-agent${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills add ./my-skill${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills status${NC}"
    echo ""
}

cmd_skills_list() {
    echo ""
    echo -e "  ${BOLD}Available Bundled Skills${NC}"
    echo -e "  ${DIM}────────────────────────────────────────${NC}"

    # Get skill list from container
    local skills
    skills=$(docker exec koala-agent-1 ls /app/skills/ 2>/dev/null)

    if [[ -z "$skills" ]]; then
        _error "Cannot read skills from container"
        return
    fi

    # Categorize skills
    local -A categories
    categories=(
        ["Productivity"]="apple-notes apple-reminders bear-notes notion obsidian things-mac trello"
        ["Coding"]="coding-agent github skill-creator"
        ["Communication"]="discord slack imsg voice-call"
        ["Media"]="openai-image-gen openai-whisper openai-whisper-api spotify-player songsee video-frames camsnap gifgrep"
        ["AI / Models"]="gemini oracle summarize model-usage clawhub"
        ["Browser / Web"]="canvas peekaboo blogwatcher"
        ["System"]="tmux healthcheck session-logs weather nano-pdf"
        ["Smart Home"]="openhue sonoscli"
        ["Security"]="1password"
        ["Other"]="food-order gog goplaces himalaya mcporter nano-banana-pro ordercli sag eightctl blucli bluebubbles sherpa-onnx-tts songsee wacli"
    )

    for category in "Productivity" "Coding" "Communication" "Media" "AI / Models" "Browser / Web" "System" "Smart Home" "Security" "Other"; do
        echo ""
        echo -e "  ${CYAN}${category}:${NC}"
        for skill in ${categories[$category]}; do
            if echo "$skills" | grep -q "^${skill}$"; then
                # Read emoji from SKILL.md
                local emoji
                emoji=$(docker exec koala-agent-1 sh -c "grep -o '\"emoji\": \"[^\"]*\"' /app/skills/${skill}/SKILL.md 2>/dev/null | head -1 | cut -d'\"' -f4")
                emoji="${emoji:-📦}"
                local desc
                desc=$(docker exec koala-agent-1 sh -c "grep '^description:' /app/skills/${skill}/SKILL.md 2>/dev/null | head -1 | sed 's/description: //' | sed 's/\"//g' | head -c 60")
                desc="${desc:-No description}"
                echo -e "    ${emoji}  ${WHITE}${skill}${NC}  ${DIM}${desc}${NC}"
            fi
        done
    done
    echo ""

    # Count
    local count
    count=$(echo "$skills" | wc -l | tr -d ' ')
    echo -e "  ${DIM}Total: ${count} bundled skills${NC}"
    echo ""
}

cmd_skills_status() {
    local agent_id="${1:-}"

    echo ""
    echo -e "  ${BOLD}Skills Status${NC}"
    echo -e "  ${DIM}────────────────────────────────────────${NC}"

    local agents_to_check
    if [[ -n "$agent_id" ]]; then
        agents_to_check="$agent_id"
    else
        agents_to_check=$(seq 1 "$AGENT_COUNT")
    fi

    for i in $agents_to_check; do
        echo ""
        echo -e "  ${CYAN}Agent ${i}:${NC}"

        # Get enabled skills from config
        local config_skills
        config_skills=$(docker exec "koala-agent-${i}" python3 -c "
import json
try:
    cfg = json.load(open('/state/openclaw.json'))
    skills = cfg.get('skills', {}).get('entries', {})
    ab = cfg.get('skills', {}).get('allowBundled', [])
    if skills:
        for name, conf in skills.items():
            status = 'enabled' if conf.get('enabled', True) else 'disabled'
            print(f'  {name}: {status}')
    elif ab:
        for name in ab:
            print(f'  {name}: allowed')
    else:
        print('  (all bundled skills available, none explicitly configured)')
except Exception as e:
    print(f'  Error: {e}')
" 2>/dev/null)
        echo "$config_skills"

        # Check workspace custom skills
        local custom
        custom=$(docker exec "koala-agent-${i}" sh -c \
            "find /home/node/.openclaw/workspace/skills -name SKILL.md 2>/dev/null | head -10")
        if [[ -n "$custom" ]]; then
            echo -e "    ${GREEN}Custom skills:${NC}"
            echo "$custom" | while read -r path; do
                local name
                name=$(basename "$(dirname "$path")")
                echo -e "      📝 ${name}"
            done
        fi
    done
    echo ""
}

cmd_skills_enable() {
    local skill_name="${1:-}"
    local agent_id="${2:-}"

    if [[ -z "$skill_name" ]]; then
        _error "Usage: koalaclaw skills enable <skill-name> [agent-id]"
        exit 1
    fi

    # Verify skill exists
    if ! docker exec koala-agent-1 test -d "/app/skills/${skill_name}" 2>/dev/null; then
        _error "Skill '${skill_name}' not found in bundled skills"
        _step "Run 'koalaclaw skills list' to see available skills"
        exit 1
    fi

    local agents_to_update
    if [[ -n "$agent_id" ]]; then
        agents_to_update="$agent_id"
        _step "Enabling '${skill_name}' on agent ${agent_id}..."
    else
        agents_to_update=$(seq 1 "$AGENT_COUNT")
        _step "Enabling '${skill_name}' on all ${AGENT_COUNT} agents..."
    fi

    for i in $agents_to_update; do
        docker exec "koala-agent-${i}" python3 -c "
import json
path = '/state/openclaw.json'
with open(path) as f:
    cfg = json.load(f)
if 'skills' not in cfg:
    cfg['skills'] = {}
if 'entries' not in cfg['skills']:
    cfg['skills']['entries'] = {}
cfg['skills']['entries']['${skill_name}'] = {'enabled': True}
with open(path, 'w') as f:
    json.dump(cfg, f, indent=4)
" 2>/dev/null
        _info "Agent ${i}: '${skill_name}' enabled"
    done
    echo ""
}

cmd_skills_disable() {
    local skill_name="${1:-}"
    local agent_id="${2:-}"

    if [[ -z "$skill_name" ]]; then
        _error "Usage: koalaclaw skills disable <skill-name> [agent-id]"
        exit 1
    fi

    local agents_to_update
    if [[ -n "$agent_id" ]]; then
        agents_to_update="$agent_id"
        _step "Disabling '${skill_name}' on agent ${agent_id}..."
    else
        agents_to_update=$(seq 1 "$AGENT_COUNT")
        _step "Disabling '${skill_name}' on all ${AGENT_COUNT} agents..."
    fi

    for i in $agents_to_update; do
        docker exec "koala-agent-${i}" python3 -c "
import json
path = '/state/openclaw.json'
with open(path) as f:
    cfg = json.load(f)
if 'skills' not in cfg:
    cfg['skills'] = {}
if 'entries' not in cfg['skills']:
    cfg['skills']['entries'] = {}
cfg['skills']['entries']['${skill_name}'] = {'enabled': False}
with open(path, 'w') as f:
    json.dump(cfg, f, indent=4)
" 2>/dev/null
        _info "Agent ${i}: '${skill_name}' disabled"
    done
    echo ""
}

cmd_skills_add() {
    local skill_path="${1:-}"
    local agent_id="${2:-}"

    if [[ -z "$skill_path" ]]; then
        _error "Usage: koalaclaw skills add <path-to-skill-dir> [agent-id]"
        _step "The directory must contain a SKILL.md file"
        exit 1
    fi

    # Validate
    if [[ ! -d "$skill_path" ]]; then
        _error "Directory not found: ${skill_path}"
        exit 1
    fi
    if [[ ! -f "${skill_path}/SKILL.md" ]]; then
        _error "No SKILL.md found in ${skill_path}"
        _step "A skill directory must contain a SKILL.md file"
        _step "See: https://docs.openclaw.ai/skills"
        exit 1
    fi

    local skill_name
    skill_name=$(basename "$skill_path")

    local agents_to_update
    if [[ -n "$agent_id" ]]; then
        agents_to_update="$agent_id"
    else
        agents_to_update=$(seq 1 "$AGENT_COUNT")
    fi

    _step "Adding custom skill '${skill_name}'..."

    for i in $agents_to_update; do
        # Copy skill to workspace
        local ws_skills="/home/node/.openclaw/workspace/skills"
        docker exec "koala-agent-${i}" mkdir -p "${ws_skills}/${skill_name}" 2>/dev/null

        # Copy files into container
        docker cp "${skill_path}/." "koala-agent-${i}:${ws_skills}/${skill_name}/"
        docker exec "koala-agent-${i}" chown -R node:node "${ws_skills}/${skill_name}" 2>/dev/null

        # Also add extraDirs to config if not present
        docker exec "koala-agent-${i}" python3 -c "
import json
path = '/state/openclaw.json'
with open(path) as f:
    cfg = json.load(f)
if 'skills' not in cfg:
    cfg['skills'] = {}
if 'load' not in cfg['skills']:
    cfg['skills']['load'] = {}
dirs = cfg['skills']['load'].get('extraDirs', [])
ws = '/home/node/.openclaw/workspace/skills'
if ws not in dirs:
    dirs.append(ws)
    cfg['skills']['load']['extraDirs'] = dirs
if 'entries' not in cfg['skills']:
    cfg['skills']['entries'] = {}
cfg['skills']['entries']['${skill_name}'] = {'enabled': True}
with open(path, 'w') as f:
    json.dump(cfg, f, indent=4)
" 2>/dev/null

        _info "Agent ${i}: custom skill '${skill_name}' added"
    done
    echo ""
}

cmd_skills_remove() {
    local skill_name="${1:-}"
    local agent_id="${2:-}"

    if [[ -z "$skill_name" ]]; then
        _error "Usage: koalaclaw skills remove <skill-name> [agent-id]"
        exit 1
    fi

    local agents_to_update
    if [[ -n "$agent_id" ]]; then
        agents_to_update="$agent_id"
    else
        agents_to_update=$(seq 1 "$AGENT_COUNT")
    fi

    _warn "This will remove custom skill '${skill_name}' from workspace"
    read -rp "  Proceed? [y/N]: " confirm
    if [[ "${confirm,,}" != "y" ]]; then
        exit 0
    fi

    for i in $agents_to_update; do
        local ws_skill="/home/node/.openclaw/workspace/skills/${skill_name}"
        docker exec "koala-agent-${i}" rm -rf "${ws_skill}" 2>/dev/null

        # Disable in config
        docker exec "koala-agent-${i}" python3 -c "
import json
path = '/state/openclaw.json'
with open(path) as f:
    cfg = json.load(f)
entries = cfg.get('skills', {}).get('entries', {})
if '${skill_name}' in entries:
    del entries['${skill_name}']
    cfg['skills']['entries'] = entries
    with open(path, 'w') as f:
        json.dump(cfg, f, indent=4)
" 2>/dev/null

        _info "Agent ${i}: '${skill_name}' removed"
    done
    echo ""
}

# ═══════════════════════════════════════
# USAGE
# ═══════════════════════════════════════
_usage() {
    _banner
    echo -e "  ${BOLD}Usage:${NC} koalaclaw <command> [options]"
    echo ""
    echo -e "  ${BOLD}Commands:${NC}"
    echo -e "    ${GREEN}install${NC}          Interactive setup (Docker + agents + Caddy)"
    echo -e "    ${GREEN}add-agent${NC}        Add more agents to existing setup"
    echo -e "    ${GREEN}remove-agent${NC} ${DIM}[N]${NC} Remove an agent"
    echo -e "    ${GREEN}status${NC}           Show health of all agents"
    echo -e "    ${GREEN}credentials${NC}      Show access URLs and tokens"
    echo -e "    ${GREEN}skills${NC}           Manage agent skills (list/enable/disable/add)"
    echo -e "    ${GREEN}browser${NC}          Browser relay control (status/tabs/screenshot)"
    echo -e "    ${GREEN}logs${NC} ${DIM}[N]${NC}         View logs (all or specific agent)"
    echo -e "    ${GREEN}update${NC}           Pull latest images and restart"
    echo -e "    ${GREEN}backup${NC}           Create a backup archive"
    echo -e "    ${GREEN}restore${NC} ${DIM}<file>${NC}  Restore from backup"
    echo -e "    ${GREEN}uninstall${NC}        Remove everything"
    echo -e "    ${GREEN}dry-run${NC}          Show what install would do"
    echo ""
    echo -e "  ${BOLD}Options:${NC}"
    echo -e "    ${DIM}--install-dir <path>${NC}  Override install directory"
    echo -e "    ${DIM}--no-color${NC}            Disable colors"
    echo -e "    ${DIM}--version${NC}             Show version"
    echo -e "    ${DIM}--help${NC}                Show this help"
    echo ""
    echo -e "  ${BOLD}Examples:${NC}"
    echo -e "    ${DIM}sudo ./koalaclaw.sh install${NC}"
    echo -e "    ${DIM}sudo koalaclaw add-agent${NC}"
    echo -e "    ${DIM}sudo koalaclaw status${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills list${NC}"
    echo -e "    ${DIM}sudo koalaclaw skills enable github${NC}"
    echo -e "    ${DIM}sudo koalaclaw logs 1${NC}"
    echo ""
}

# ═══════════════════════════════════════
# MAIN
# ═══════════════════════════════════════
main() {
    # Parse global flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --install-dir)
                INSTALL_DIR="$2"
                shift 2
                ;;
            --no-color)
                NO_COLOR=1
                RED='' GREEN='' YELLOW='' BLUE='' CYAN='' WHITE='' DIM='' BOLD='' NC=''
                shift
                ;;
            --version|-v)
                echo "KoalaClaw v${VERSION}"
                exit 0
                ;;
            --help|-h)
                _usage
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done

    local cmd="${1:-}"
    shift || true

    case "$cmd" in
        install)        cmd_install "$@" ;;
        add-agent)      cmd_add_agent "$@" ;;
        remove-agent)   cmd_remove_agent "$@" ;;
        status)         cmd_status "$@" ;;
        credentials)    cmd_credentials "$@" ;;
        skills)         cmd_skills "$@" ;;
        browser)        cmd_browser "$@" ;;
        logs)           cmd_logs "$@" ;;
        update)         cmd_update "$@" ;;
        backup)         cmd_backup "$@" ;;
        restore)        cmd_restore "$@" ;;
        uninstall)      cmd_uninstall "$@" ;;
        dry-run)        cmd_dry_run "$@" ;;
        "")             _usage ;;
        *)
            _error "Unknown command: ${cmd}"
            echo ""
            _usage
            exit 1
            ;;
    esac
}

main "$@"

