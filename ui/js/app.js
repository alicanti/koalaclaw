// KoalaClaw Main Application

const API_BASE = window.location.origin + '/api';

class KoalaClawApp {
    constructor() {
        this.agents = [];
        this.selectedAgent = null;
        this.logsPaused = false;
        this.statusPollTimer = null;
        this.wsManager = null;
        this.currentTab = 'office';
        this.init();
    }

    async init() {
        this.setupTabs();
        this.setupEventListeners();
        await this.loadAgents();
        this.updateSystemStatus();
        this.startPolling();
        this.wsManager = new WebSocketManager(this);
        adminPanel = new AdminPanel(this);
        workflowEngine = new WorkflowEngine(this);
        messageBus = new AgentMessageBus(this);
        monitor = new MonitoringDashboard(this);
        monitor.startMonitoring();
        gamification = new GamificationSystem(this);
    }

    // ─── Tabs ───────────────────────────────────────────────
    setupTabs() {
        document.querySelectorAll('.tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                const id = tab.dataset.tab;
                this.switchTab(id);
            });
        });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
        const content = document.getElementById('content-' + tabId);
        if (tab) tab.classList.add('active');
        if (content) content.classList.add('active');

        // Hide chat badge when switching to chat
        if (tabId === 'chat') {
            const badge = document.getElementById('chat-badge');
            if (badge) badge.style.display = 'none';
        }
    }

    // ─── Events ─────────────────────────────────────────────
    setupEventListeners() {
        document.getElementById('btn-add-agent').addEventListener('click', () => {
            this.showAddAgentModal();
        });

        document.getElementById('btn-pause-logs').addEventListener('click', () => {
            this.toggleLogsPause();
        });

        document.getElementById('btn-clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        document.getElementById('btn-refresh').addEventListener('click', () => {
            this.loadAgents();
        });

        // Ctrl+K focus
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.switchTab('chat');
            }
        });
    }

    // ─── API ────────────────────────────────────────────────
    async apiGet(path) {
        try {
            const res = await fetch(`${API_BASE}${path}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) { return null; }
    }

    async apiPost(path, data) {
        try {
            const res = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) { return null; }
    }

    // ─── Data ───────────────────────────────────────────────
    async loadAgents() {
        const data = await this.apiGet('/agents');
        if (data && data.agents) {
            this.agents = data.agents;
        } else {
            this.agents = this._mockAgents();
            this.addLog('warning', 'API not available — using mock data', 'System');
        }

        this.renderAgentList();
        officeRenderer.render(this.agents, this.selectedAgent?.id);
        this.updateSystemStatus();

        if (this.wsManager) this.wsManager.connectAll(this.agents);
    }

    _mockAgents() {
        return [
            { id: 1, name: 'CoderKoala', emoji: '💻', role: 'Software Development', role_id: 'coder-koala', status: 'offline', state: 'idle', port: 3001, token: '' },
            { id: 2, name: 'MarketerKoala', emoji: '📣', role: 'Marketing', role_id: 'marketer-koala', status: 'offline', state: 'idle', port: 3002, token: '' },
            { id: 3, name: 'StrategyKoala', emoji: '🧠', role: 'Strategy', role_id: 'strategy-koala', status: 'offline', state: 'idle', port: 3003, token: '' },
        ];
    }

    async updateSystemStatus() {
        const data = await this.apiGet('/status');
        const statusEl = document.getElementById('system-status');
        const countEl = document.getElementById('agent-count');
        const modelEl = document.getElementById('system-model');

        if (data) {
            statusEl.textContent = data.status === 'online' ? '● Online' : '○ Offline';
            statusEl.style.color = data.status === 'online' ? 'var(--success)' : 'var(--error)';
            countEl.textContent = `${data.agents_online || 0} / ${data.agents_total || 0}`;
            if (modelEl) modelEl.textContent = (data.model || '').split('/').pop() || '...';
        } else {
            statusEl.textContent = '○ API Offline';
            statusEl.style.color = 'var(--error)';
            countEl.textContent = this.agents.length;
        }
    }

    // ─── Polling ────────────────────────────────────────────
    startPolling() {
        this.statusPollTimer = setInterval(() => this.refreshAgentStatuses(), 10000);
    }

    async refreshAgentStatuses() {
        const data = await this.apiGet('/agents');
        if (!data || !data.agents) return;

        data.agents.forEach(updated => {
            const existing = this.agents.find(a => a.id === updated.id);
            if (existing) {
                const changed = existing.status !== updated.status || existing.state !== updated.state;
                existing.status = updated.status;
                existing.state = updated.state;
                existing.health = updated.health;
                if (changed) {
                    officeRenderer.updateAgentState(existing.id, existing.status, existing.state);
                    this.updateAgentListItem(existing);
                }
            }
        });
        this.updateSystemStatus();
    }

    // ─── Agent List ─────────────────────────────────────────
    renderAgentList() {
        const list = document.getElementById('agent-list');
        list.innerHTML = '';

        this.agents.forEach(agent => {
            const item = document.createElement('div');
            item.className = 'agent-item' + (this.selectedAgent?.id === agent.id ? ' selected' : '');
            item.dataset.agentId = agent.id;
            item.onclick = () => this.selectAgent(agent.id);

            item.innerHTML = `
                <span class="emoji">${agent.emoji || '🐨'}</span>
                <div class="info">
                    <div class="name">${agent.name || 'Agent ' + agent.id}</div>
                    <div class="role">${agent.role || agent.role_id || ''}</div>
                </div>
                <div class="status-dot ${agent.status === 'online' ? 'online' : 'offline'}"></div>
            `;

            list.appendChild(item);
        });
    }

    updateAgentListItem(agent) {
        const item = document.querySelector(`.agent-item[data-agent-id="${agent.id}"]`);
        if (!item) return;
        const dot = item.querySelector('.status-dot');
        if (dot) dot.className = 'status-dot ' + (agent.status === 'online' ? 'online' : 'offline');
    }

    // ─── Agent Selection ────────────────────────────────────
    selectAgent(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;

        this.selectedAgent = agent;
        this.renderAgentList();
        officeRenderer.selectDesk(agentId);

        // Load Canvas iframe
        this._loadCanvasFrame(agent);

        // Switch to chat tab
        this.switchTab('chat');

        this.addLog('info', `Selected: ${agent.emoji} ${agent.name}`, 'System');

        // Show detail panel
        if (adminPanel) adminPanel.showAgentDetail(agent);

        // Connect WS if needed
        if (this.wsManager && agent.status === 'online' && !this.wsManager.isConnected(agent.id)) {
            this.wsManager.connectToAgent(agent);
        }
    }

    _loadCanvasFrame(agent) {
        const frame = document.getElementById('canvas-frame');
        const placeholder = document.getElementById('chat-placeholder');

        if (!agent.token || !agent.id) {
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <div class="chat-placeholder-icon">💬</div>
                    <p>Agent not available</p>
                `;
            }
            if (frame) frame.style.display = 'none';
            return;
        }

        // Proxy URL: same origin, no cross-origin issues
        // /agent/{id}/ is reverse-proxied to the agent container by admin-api.py
        const canvasUrl = `/agent/${agent.id}/__openclaw__/canvas/#token=${agent.token}`;

        if (frame) {
            frame.src = canvasUrl;
            frame.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    }

    updateAgentStatus(agentId, status, state) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        agent.status = status;
        agent.state = state;
        officeRenderer.updateAgentState(agentId, status, state);
        this.updateAgentListItem(agent);
    }

    // ─── Logs ───────────────────────────────────────────────
    addLog(type, message, agentName) {
        if (this.logsPaused) return;

        const logsContent = document.getElementById('logs-content');
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-agent">${agentName || 'System'}</span>
            <span class="log-message">${this._esc(message)}</span>
        `;

        logsContent.appendChild(entry);
        while (logsContent.children.length > 500) logsContent.removeChild(logsContent.firstChild);
        logsContent.scrollTop = logsContent.scrollHeight;

        // Flash chat badge if on office tab
        if (this.currentTab === 'office' && type === 'success') {
            const badge = document.getElementById('chat-badge');
            if (badge) { badge.style.display = 'inline'; badge.textContent = '!'; }
        }
    }

    _esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

    toggleLogsPause() {
        this.logsPaused = !this.logsPaused;
        document.getElementById('btn-pause-logs').textContent = this.logsPaused ? '▶' : '⏸';
    }

    clearLogs() {
        document.getElementById('logs-content').innerHTML = '';
        this.addLog('info', 'Logs cleared', 'System');
    }

    // ─── Modals ─────────────────────────────────────────────
    showAddAgentModal() {
        if (adminPanel) adminPanel.showAddAgentModal();
        else alert('Run: sudo koalaclaw add-agent');
    }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
    window.app = new KoalaClawApp();
});
