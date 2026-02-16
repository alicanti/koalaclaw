// KoalaClaw Admin Panel - Phase 3

class AdminPanel {
    constructor(app) {
        this.app = app;
        this.roles = [];
        this.selectedAgentDetail = null;
        this.init();
    }

    async init() {
        await this.loadRoles();
    }

    async loadRoles() {
        const data = await this.app.apiGet('/roles');
        if (data && data.roles) {
            this.roles = data.roles;
        }
    }

    // ─── Agent Detail Panel ─────────────────────────────────────
    showAgentDetail(agent) {
        this.selectedAgentDetail = agent;
        const panel = document.getElementById('agent-detail-panel');
        if (!panel) return;

        const role = this.roles.find(r => r.id === agent.role_id) || {};
        const skills = role.skills || { enabled: [], disabled: [] };
        const wsConnected = this.app.wsManager && this.app.wsManager.isConnected(agent.id);

        panel.innerHTML = `
            <div class="detail-header">
                <span class="detail-emoji">${agent.emoji}</span>
                <div class="detail-info">
                    <h3>${agent.name}</h3>
                    <p class="detail-role">${agent.role}</p>
                </div>
                <button class="btn-close-detail" onclick="adminPanel.hideAgentDetail()">✕</button>
            </div>

            <div class="detail-section">
                <h4>Status</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="label">Container:</span>
                        <span class="value status-${agent.status}">${agent.status}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">State:</span>
                        <span class="value">${agent.state || 'idle'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">WebSocket:</span>
                        <span class="value ${wsConnected ? 'status-online' : 'status-offline'}">${wsConnected ? 'Connected' : 'Disconnected'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="label">Port:</span>
                        <span class="value">${agent.port}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h4>Skills</h4>
                <div class="skills-list">
                    ${(skills.enabled || []).map(s => `
                        <label class="skill-toggle">
                            <input type="checkbox" checked data-skill="${s}" data-agent="${agent.id}">
                            <span class="skill-name">${s}</span>
                        </label>
                    `).join('')}
                    ${(skills.disabled || []).map(s => `
                        <label class="skill-toggle">
                            <input type="checkbox" data-skill="${s}" data-agent="${agent.id}">
                            <span class="skill-name">${s}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="detail-section">
                <h4>Quick Actions</h4>
                <div class="action-buttons">
                    <button class="btn-action" onclick="adminPanel.openCanvas(${agent.id})">🌐 Open Canvas</button>
                    <button class="btn-action" onclick="adminPanel.viewLogs(${agent.id})">📋 View Logs</button>
                    <button class="btn-action btn-danger" onclick="adminPanel.restartAgent(${agent.id})">🔄 Restart</button>
                </div>
            </div>
        `;

        panel.classList.add('visible');
    }

    hideAgentDetail() {
        const panel = document.getElementById('agent-detail-panel');
        if (panel) panel.classList.remove('visible');
        this.selectedAgentDetail = null;
    }

    // ─── Add Agent Modal ────────────────────────────────────────
    showAddAgentModal() {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        content.innerHTML = `
            <div class="modal-header">
                <h2>Add New Agent</h2>
                <button class="btn-close-modal" onclick="adminPanel.closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <p class="modal-description">Select a role for the new agent:</p>
                <div class="role-grid">
                    ${this.roles.map(role => `
                        <div class="role-card" onclick="adminPanel.selectRoleForAdd('${role.id}')">
                            <span class="role-emoji">${role.emoji}</span>
                            <span class="role-name">${role.name}</span>
                            <span class="role-title">${role.role_title}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="modal-note">
                    <p>⚠️ Agent will be added via CLI. Run on server:</p>
                    <code>sudo koalaclaw add-agent</code>
                </div>
            </div>
        `;

        modal.classList.add('visible');
    }

    selectRoleForAdd(roleId) {
        const role = this.roles.find(r => r.id === roleId);
        if (role) {
            this.app.addLog('info', `Selected role: ${role.emoji} ${role.name}. Run 'sudo koalaclaw add-agent' on the server.`, 'System');
        }
        this.closeModal();
    }

    closeModal() {
        const modal = document.getElementById('modal-overlay');
        if (modal) modal.classList.remove('visible');
    }

    // ─── Actions ────────────────────────────────────────────────
    openCanvas(agentId) {
        const agent = this.app.agents.find(a => a.id === agentId);
        if (agent && agent.canvas_url) {
            window.open(agent.canvas_url, '_blank');
        }
    }

    async viewLogs(agentId) {
        const data = await this.app.apiGet(`/agents/${agentId}/logs?tail=100`);
        if (data && data.logs) {
            const modal = document.getElementById('modal-overlay');
            const content = document.getElementById('modal-content');

            content.innerHTML = `
                <div class="modal-header">
                    <h2>Logs: Agent ${agentId}</h2>
                    <button class="btn-close-modal" onclick="adminPanel.closeModal()">✕</button>
                </div>
                <div class="modal-body">
                    <pre class="log-viewer">${data.logs.join('\n')}</pre>
                </div>
            `;

            modal.classList.add('visible');
        }
    }

    async restartAgent(agentId) {
        if (!confirm(`Restart Agent ${agentId}?`)) return;
        this.app.addLog('warning', `Restarting Agent ${agentId}...`, 'System');
        // This would need a server-side endpoint
        this.app.addLog('info', `Run on server: docker compose restart koala-agent-${agentId}`, 'System');
    }
}

// Global reference
let adminPanel;

