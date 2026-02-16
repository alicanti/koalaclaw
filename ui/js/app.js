// KoalaClaw Main Application - Phase 2

const API_BASE = window.location.origin + '/api';

class KoalaClawApp {
    constructor() {
        this.agents = [];
        this.selectedAgent = null;
        this.logsPaused = false;
        this.logPollTimer = null;
        this.statusPollTimer = null;
        this.wsManager = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadAgents();
        this.updateSystemStatus();
        this.startPolling();

        // Initialize WebSocket manager
        this.wsManager = new WebSocketManager(this);

        // Initialize Admin Panel
        adminPanel = new AdminPanel(this);

        // Initialize Workflow Engine & Message Bus
        workflowEngine = new WorkflowEngine(this);
        messageBus = new AgentMessageBus(this);

        // Initialize Monitoring
        monitor = new MonitoringDashboard(this);
        monitor.startMonitoring();

        // Initialize Gamification
        gamification = new GamificationSystem(this);
    }

    setupEventListeners() {
        document.getElementById('btn-add-agent').addEventListener('click', () => {
            this.showAddAgentModal();
        });

        const chatInput = document.getElementById('chat-input');
        const btnSend = document.getElementById('btn-send');

        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !chatInput.disabled) {
                this.sendMessage();
            }
        });

        btnSend.addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('agent-selector').addEventListener('change', (e) => {
            const agentId = e.target.value;
            if (agentId) {
                this.selectAgent(parseInt(agentId));
            } else {
                this.deselectAgent();
            }
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

        // Keyboard shortcut: Ctrl+K for command palette (Phase 6)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('chat-input').focus();
            }
        });
    }

    // ─── API Calls ──────────────────────────────────────────────
    async apiGet(path) {
        try {
            const res = await fetch(`${API_BASE}${path}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.error(`API GET ${path} failed:`, e);
            return null;
        }
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
        } catch (e) {
            console.error(`API POST ${path} failed:`, e);
            return null;
        }
    }

    // ─── Data Loading ───────────────────────────────────────────
    async loadAgents() {
        const data = await this.apiGet('/agents');
        if (data && data.agents) {
            this.agents = data.agents;
        } else {
            // Fallback to mock data if API is not available
            this.agents = this._mockAgents();
            this.addLog('warning', 'API not available, using mock data', 'System');
        }

        this.renderAgentList();
        this.renderOffice();
        this.updateAgentSelector();
        this.updateSystemStatus();

        // Connect WebSockets to online agents
        if (this.wsManager) {
            this.wsManager.connectAll(this.agents);
        }
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
        if (data) {
            const statusEl = document.getElementById('system-status');
            statusEl.textContent = data.status === 'online' ? 'Online' : 'Offline';
            statusEl.style.color = data.status === 'online' ? 'var(--success)' : 'var(--error)';
            document.getElementById('agent-count').textContent = `${data.agents_online || 0}/${data.agents_total || 0}`;
        } else {
            document.getElementById('system-status').textContent = 'API Offline';
            document.getElementById('system-status').style.color = 'var(--error)';
            document.getElementById('agent-count').textContent = this.agents.length;
        }
    }

    // ─── Polling ────────────────────────────────────────────────
    startPolling() {
        // Poll agent status every 10 seconds
        this.statusPollTimer = setInterval(() => {
            this.refreshAgentStatuses();
        }, 10000);

        // Poll logs every 3 seconds
        this.logPollTimer = setInterval(() => {
            if (!this.logsPaused && this.selectedAgent) {
                this.pollAgentLogs(this.selectedAgent.id);
            }
        }, 3000);
    }

    async refreshAgentStatuses() {
        const data = await this.apiGet('/agents');
        if (data && data.agents) {
            data.agents.forEach(updated => {
                const existing = this.agents.find(a => a.id === updated.id);
                if (existing) {
                    const statusChanged = existing.status !== updated.status;
                    const stateChanged = existing.state !== updated.state;
                    existing.status = updated.status;
                    existing.state = updated.state;
                    existing.health = updated.health;

                    if (statusChanged || stateChanged) {
                        this.updateDeskVisual(existing);
                        this.updateAgentListItem(existing);
                    }
                }
            });
            this.updateSystemStatus();
        }
    }

    async pollAgentLogs(agentId) {
        const data = await this.apiGet(`/agents/${agentId}/logs?tail=5`);
        if (data && data.logs) {
            // Only show new logs (simple dedup by checking last log)
            const logsContent = document.getElementById('logs-content');
            const lastLog = logsContent.querySelector('.log-entry:last-child .log-message');
            const lastText = lastLog ? lastLog.textContent : '';

            data.logs.forEach(line => {
                if (line && !lastText.includes(line.substring(0, 50))) {
                    const agent = this.agents.find(a => a.id === agentId);
                    this.addLog('info', line, agent ? agent.name : `Agent ${agentId}`);
                }
            });
        }
    }

    // ─── Rendering ──────────────────────────────────────────────
    renderAgentList() {
        const agentList = document.getElementById('agent-list');
        agentList.innerHTML = '';

        this.agents.forEach(agent => {
            const item = document.createElement('div');
            item.className = `agent-item ${this.selectedAgent?.id === agent.id ? 'selected' : ''}`;
            item.dataset.agentId = agent.id;
            item.addEventListener('click', () => this.selectAgent(agent.id));

            const wsConnected = this.wsManager && this.wsManager.isConnected(agent.id);
            const statusClass = agent.status === 'online' ? 'online' : 'offline';

            item.innerHTML = `
                <div class="agent-item-header">
                    <span class="agent-emoji">${agent.emoji}</span>
                    <span class="agent-name">${agent.name}</span>
                    <span class="agent-status ${statusClass}" title="${agent.status}${wsConnected ? ' (WS)' : ''}"></span>
                </div>
                <div class="agent-role">${agent.role}</div>
            `;

            agentList.appendChild(item);
        });
    }

    updateAgentListItem(agent) {
        const item = document.querySelector(`.agent-item[data-agent-id="${agent.id}"]`);
        if (!item) return;
        const statusEl = item.querySelector('.agent-status');
        if (statusEl) {
            statusEl.className = `agent-status ${agent.status === 'online' ? 'online' : 'offline'}`;
        }
    }

    renderOffice() {
        const officeFloor = document.getElementById('office-floor');
        const grid = document.createElement('div');
        grid.className = 'desk-grid';

        this.agents.forEach(agent => {
            const desk = this.createDesk(agent);
            grid.appendChild(desk);
        });

        officeFloor.innerHTML = '';
        officeFloor.appendChild(grid);
    }

    createDesk(agent) {
        const desk = document.createElement('div');
        desk.className = 'desk';
        desk.dataset.agentId = agent.id;
        desk.addEventListener('click', () => this.selectAgent(agent.id));

        const stateClass = agent.state || 'idle';
        const statusClass = agent.status === 'online' ? 'online' : 'offline';

        desk.innerHTML = `
            <div class="desk-top"></div>
            <div class="desk-front"></div>
            <div class="desk-side"></div>
            <div class="desk-status ${statusClass} ${stateClass === 'thinking' ? 'thinking' : ''}"></div>
            <div class="koala-character ${stateClass}">${agent.emoji}</div>
            <div class="desk-decoration monitor">🖥️</div>
            <div class="desk-decoration keyboard">⌨️</div>
            <div class="desk-decoration coffee">☕</div>
            <div class="desk-label">
                <div class="agent-name">${agent.name}</div>
                <div class="agent-role">${agent.role}</div>
            </div>
        `;

        return desk;
    }

    updateDeskVisual(agent) {
        const desk = document.querySelector(`.desk[data-agent-id="${agent.id}"]`);
        if (!desk) return;

        const statusEl = desk.querySelector('.desk-status');
        if (statusEl) {
            statusEl.className = `desk-status ${agent.status === 'online' ? 'online' : 'offline'} ${agent.state === 'thinking' ? 'thinking' : ''}`;
        }

        const charEl = desk.querySelector('.koala-character');
        if (charEl) {
            charEl.className = `koala-character ${agent.state || 'idle'}`;
        }
    }

    updateAgentSelector() {
        const selector = document.getElementById('agent-selector');
        selector.innerHTML = '<option value="">Select Agent...</option>';

        this.agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent.id;
            option.textContent = `${agent.emoji} ${agent.name}`;
            if (this.selectedAgent?.id === agent.id) option.selected = true;
            selector.appendChild(option);
        });
    }

    // ─── Agent Selection ────────────────────────────────────────
    selectAgent(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;

        this.selectedAgent = agent;
        this.renderAgentList();

        document.getElementById('chat-input').disabled = false;
        document.getElementById('btn-send').disabled = false;
        document.getElementById('agent-selector').value = agentId;

        this.addLog('info', `Selected: ${agent.emoji} ${agent.name} (${agent.role})`, 'System');

        // Show agent detail panel
        if (adminPanel) {
            adminPanel.showAgentDetail(agent);
        }

        // Try to connect WebSocket if not connected
        if (this.wsManager && agent.status === 'online' && !this.wsManager.isConnected(agent.id)) {
            this.wsManager.connectToAgent(agent);
        }
    }

    deselectAgent() {
        this.selectedAgent = null;
        this.renderAgentList();
        document.getElementById('chat-input').disabled = true;
        document.getElementById('btn-send').disabled = true;
    }

    updateAgentStatus(agentId, status, state) {
        const agent = this.agents.find(a => a.id === agentId);
        if (!agent) return;
        agent.status = status;
        agent.state = state;
        this.updateDeskVisual(agent);
        this.updateAgentListItem(agent);
    }

    // ─── Chat ───────────────────────────────────────────────────
    async sendMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message || !this.selectedAgent) return;

        this.addLog('info', `You → ${this.selectedAgent.name}: ${message}`, 'You');
        input.value = '';

        // Update agent state to thinking
        this.updateAgentStatus(this.selectedAgent.id, 'online', 'thinking');

        // Try WebSocket first
        if (this.wsManager && this.wsManager.isConnected(this.selectedAgent.id)) {
            const sent = this.wsManager.sendMessage(this.selectedAgent.id, message);
            if (sent) return;
        }

        // Fallback to REST API
        const result = await this.apiPost('/agents/chat', {
            agent_id: this.selectedAgent.id,
            message: message
        });

        if (result) {
            if (result.error) {
                this.addLog('error', `Error: ${result.error}`, this.selectedAgent.name);
                this.updateAgentStatus(this.selectedAgent.id, 'online', 'error');
            } else if (result.response) {
                this.addLog('success', `${this.selectedAgent.name}: ${result.response}`, this.selectedAgent.name);
                this.updateAgentStatus(this.selectedAgent.id, 'online', 'talking');
            }
        } else {
            this.addLog('error', 'Failed to send message (API unavailable)', 'System');
        }

        // Reset state after delay
        setTimeout(() => {
            if (this.selectedAgent) {
                this.updateAgentStatus(this.selectedAgent.id, 'online', 'idle');
            }
        }, 3000);
    }

    // ─── Logs ───────────────────────────────────────────────────
    addLog(type, message, agentName) {
        if (this.logsPaused) return;

        const logsContent = document.getElementById('logs-content');
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;

        const time = new Date().toLocaleTimeString();
        const agent = agentName || 'System';

        entry.innerHTML = `
            <span class="log-time">${time}</span>
            <span class="log-agent">${agent}</span>
            <span class="log-message">${this._escapeHtml(message)}</span>
        `;

        logsContent.appendChild(entry);

        // Keep max 500 log entries
        while (logsContent.children.length > 500) {
            logsContent.removeChild(logsContent.firstChild);
        }

        logsContent.scrollTop = logsContent.scrollHeight;
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    toggleLogsPause() {
        this.logsPaused = !this.logsPaused;
        const btn = document.getElementById('btn-pause-logs');
        btn.textContent = this.logsPaused ? '▶️ Resume' : '⏸️ Pause';
    }

    clearLogs() {
        document.getElementById('logs-content').innerHTML = '';
        this.addLog('info', 'Logs cleared', 'System');
    }

    // ─── Modals ─────────────────────────────────────────────────
    showAddAgentModal() {
        if (adminPanel) {
            adminPanel.showAddAgentModal();
        } else {
            alert('Add Agent: Use "koalaclaw add-agent" on the server CLI.');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new KoalaClawApp();
});
