// KoalaClaw Monitoring Dashboard - Phase 5

class MonitoringDashboard {
    constructor(app) {
        this.app = app;
        this.metricsHistory = [];
        this.alerts = [];
        this.alertThresholds = {
            cpu: 80,
            memory: 90,
            disk: 85
        };
        this.pollInterval = null;
    }

    startMonitoring() {
        this.pollInterval = setInterval(() => this.collectMetrics(), 15000);
        this.collectMetrics();
    }

    stopMonitoring() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async collectMetrics() {
        const data = await this.app.apiGet('/stats');
        if (!data || !data.stats) return;

        const timestamp = new Date().toISOString();
        const snapshot = {
            timestamp,
            agents: data.stats.map(s => ({
                name: s.name,
                cpu: parseFloat(s.cpu) || 0,
                mem: s.mem,
                mem_perc: parseFloat(s.mem_perc) || 0
            }))
        };

        this.metricsHistory.push(snapshot);
        // Keep last 100 snapshots (~25 minutes at 15s intervals)
        if (this.metricsHistory.length > 100) {
            this.metricsHistory.shift();
        }

        // Check alerts
        snapshot.agents.forEach(agent => {
            if (agent.cpu > this.alertThresholds.cpu) {
                this.addAlert('warning', `${agent.name}: CPU at ${agent.cpu}%`);
            }
            if (agent.mem_perc > this.alertThresholds.memory) {
                this.addAlert('error', `${agent.name}: Memory at ${agent.mem_perc}%`);
            }
        });
    }

    addAlert(type, message) {
        const alert = {
            id: Date.now(),
            type,
            message,
            timestamp: new Date().toISOString(),
            read: false
        };
        this.alerts.unshift(alert);
        // Keep last 50 alerts
        if (this.alerts.length > 50) this.alerts.pop();

        this.app.addLog(type === 'error' ? 'error' : 'warning', `Alert: ${message}`, 'Monitor');
        this.updateAlertBadge();
    }

    updateAlertBadge() {
        const unread = this.alerts.filter(a => !a.read).length;
        const badge = document.getElementById('alert-badge');
        if (badge) {
            badge.textContent = unread;
            badge.style.display = unread > 0 ? 'inline-block' : 'none';
        }
    }

    // ─── Dashboard Modal ────────────────────────────────────────
    showDashboard() {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        const latestMetrics = this.metricsHistory.length > 0
            ? this.metricsHistory[this.metricsHistory.length - 1]
            : null;

        content.innerHTML = `
            <div class="modal-header">
                <h2>📊 Monitoring Dashboard</h2>
                <button class="btn-close-modal" onclick="adminPanel.closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="monitor-tabs">
                    <button class="tab-btn active" onclick="monitor.showMetricsTab()">Metrics</button>
                    <button class="tab-btn" onclick="monitor.showAlertsTab()">Alerts (${this.alerts.filter(a => !a.read).length})</button>
                    <button class="tab-btn" onclick="monitor.showCronTab()">Cron Jobs</button>
                </div>
                <div id="monitor-content">
                    ${this._renderMetrics(latestMetrics)}
                </div>
            </div>
        `;

        modal.classList.add('visible');
    }

    showMetricsTab() {
        const latestMetrics = this.metricsHistory.length > 0
            ? this.metricsHistory[this.metricsHistory.length - 1]
            : null;
        document.getElementById('monitor-content').innerHTML = this._renderMetrics(latestMetrics);
    }

    showAlertsTab() {
        this.alerts.forEach(a => a.read = true);
        this.updateAlertBadge();
        document.getElementById('monitor-content').innerHTML = this._renderAlerts();
    }

    showCronTab() {
        document.getElementById('monitor-content').innerHTML = this._renderCron();
    }

    _renderMetrics(snapshot) {
        if (!snapshot) {
            return '<p class="empty-state">No metrics collected yet. Data appears after ~15 seconds.</p>';
        }

        return `
            <div class="metrics-grid">
                ${snapshot.agents.map(agent => `
                    <div class="metric-card">
                        <h4>${agent.name.replace('koala-agent-', 'Agent ')}</h4>
                        <div class="metric-row">
                            <span class="metric-label">CPU</span>
                            <div class="metric-bar">
                                <div class="metric-fill ${agent.cpu > 80 ? 'danger' : agent.cpu > 50 ? 'warning' : 'ok'}"
                                     style="width: ${Math.min(agent.cpu, 100)}%"></div>
                            </div>
                            <span class="metric-value">${agent.cpu.toFixed(1)}%</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">MEM</span>
                            <div class="metric-bar">
                                <div class="metric-fill ${agent.mem_perc > 90 ? 'danger' : agent.mem_perc > 70 ? 'warning' : 'ok'}"
                                     style="width: ${Math.min(agent.mem_perc, 100)}%"></div>
                            </div>
                            <span class="metric-value">${agent.mem_perc.toFixed(1)}%</span>
                        </div>
                        <div class="metric-detail">${agent.mem || 'N/A'}</div>
                    </div>
                `).join('')}
            </div>
            <div class="metrics-summary">
                <p>Last updated: ${new Date(snapshot.timestamp).toLocaleTimeString()}</p>
                <p>History: ${this.metricsHistory.length} snapshots</p>
            </div>
        `;
    }

    _renderAlerts() {
        if (this.alerts.length === 0) {
            return '<p class="empty-state">No alerts</p>';
        }

        return `
            <div class="alerts-list">
                ${this.alerts.map(alert => `
                    <div class="alert-item alert-${alert.type}">
                        <span class="alert-icon">${alert.type === 'error' ? '🚨' : '⚠️'}</span>
                        <span class="alert-message">${alert.message}</span>
                        <span class="alert-time">${new Date(alert.timestamp).toLocaleTimeString()}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderCron() {
        return `
            <div class="cron-section">
                <p class="modal-description">Schedule recurring tasks for your agents:</p>
                <div class="cron-list">
                    <div class="cron-item">
                        <span class="cron-schedule">0 9 * * *</span>
                        <span class="cron-task">ResearchKoala: Daily news summary</span>
                        <span class="cron-status active">Active</span>
                    </div>
                    <div class="cron-item">
                        <span class="cron-schedule">0 0 * * 1</span>
                        <span class="cron-task">DataKoala: Weekly metrics report</span>
                        <span class="cron-status active">Active</span>
                    </div>
                    <div class="cron-item">
                        <span class="cron-schedule">*/30 * * * *</span>
                        <span class="cron-task">SecurityKoala: Health check scan</span>
                        <span class="cron-status active">Active</span>
                    </div>
                </div>
                <div class="modal-note">
                    <p>Configure cron jobs via the server CLI:</p>
                    <code>sudo koalaclaw cron add "0 9 * * *" research-koala "Daily news summary"</code>
                </div>
            </div>
        `;
    }
}

// Global reference
let monitor;

