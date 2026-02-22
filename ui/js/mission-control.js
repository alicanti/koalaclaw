/**
 * Mission Control Sidebar: collapsible layout, agent cards, section headers, file editor.
 */
const MC_FILE_TABS = [
    { label: 'Identity', path: 'workspace/IDENTITY.md' },
    { label: 'Soul', path: 'workspace/SOUL.md' },
    { label: 'Memory', path: 'mind/PROFILE.md' },
    { label: 'Protocol', path: 'workspace/COGNITIVE_PROTOCOL.md' },
];

class MissionControl {
    constructor(app) {
        this.app = app;
        this.sidebar = null;
        this.collapsed = false;
        this.sectionOpen = { agents: true, files: false, integrations: false, system: true };
        this.fileEditorAgent = null;
        this.fileEditorPath = null;
        this.fileEditorDirty = false;
        this.init();
    }

    init() {
        this.sidebar = document.getElementById('mission-control-sidebar');
        if (!this.sidebar) return;

        this.bindToggle();
        this.bindSectionHeaders();
        this.renderIntegrations();
        this.renderSystemActions();
    }

    bindToggle() {
        const btn = document.getElementById('mc-toggle');
        if (!btn) return;
        btn.addEventListener('click', () => {
            this.collapsed = !this.collapsed;
            this.sidebar.classList.toggle('collapsed', this.collapsed);
            document.body.classList.toggle('mc-collapsed', this.collapsed);
            btn.title = this.collapsed ? 'Expand' : 'Collapse';
        });
    }

    bindSectionHeaders() {
        this.sidebar.querySelectorAll('.mc-section-header').forEach(h => {
            h.addEventListener('click', () => {
                const section = h.closest('.mc-section');
                if (!section) return;
                const key = section.dataset.section;
                if (!key) return;
                this.sectionOpen[key] = !this.sectionOpen[key];
                section.classList.toggle('open', this.sectionOpen[key]);
            });
        });
    }

    /** Called when app selects an agent: show Agent Files section and file editor */
    onAgentSelected(agent) {
        this.fileEditorAgent = agent;
        const section = this.sidebar?.querySelector('[data-section="files"]');
        const content = document.getElementById('mc-files-content');
        if (!section || !content) return;
        section.classList.add('open');
        this.sectionOpen.files = true;

        content.innerHTML = `
            <div class="mc-file-editor">
                <div class="mc-files-tabs" role="tablist"></div>
                <textarea class="mc-file-textarea" id="mc-file-textarea" placeholder="Select a tab to load file..." spellcheck="false"></textarea>
                <div class="mc-file-actions">
                    <span class="mc-file-status" id="mc-file-status"></span>
                    <button type="button" class="mc-btn-save" id="mc-btn-save" disabled>Save</button>
                </div>
            </div>
        `;

        const tabsWrap = content.querySelector('.mc-files-tabs');
        MC_FILE_TABS.forEach((tab, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mc-file-tab' + (i === 0 ? ' active' : '');
            btn.textContent = tab.label;
            btn.dataset.path = tab.path;
            btn.addEventListener('click', () => this.switchFileTab(tab.path));
            tabsWrap.appendChild(btn);
        });

        const textarea = content.querySelector('#mc-file-textarea');
        const saveBtn = content.querySelector('#mc-btn-save');
        textarea?.addEventListener('input', () => {
            this.fileEditorDirty = true;
            saveBtn.disabled = false;
            this.updateFileStatus('Unsaved changes');
        });
        saveBtn?.addEventListener('click', () => this.saveCurrentFile());

        this.fileEditorPath = MC_FILE_TABS[0].path;
        this.loadFileContent(agent.id, MC_FILE_TABS[0].path);
    }

    updateFileStatus(text) {
        const el = document.getElementById('mc-file-status');
        if (el) el.textContent = text;
    }

    async loadFileContent(agentId, path) {
        this.updateFileStatus('Loading...');
        const data = await this.app.apiGet(`/agents/${agentId}/files/${path}`);
        const textarea = document.getElementById('mc-file-textarea');
        if (textarea) {
            textarea.value = (data && data.content !== undefined) ? data.content : '';
            this.fileEditorDirty = false;
        }
        document.querySelectorAll('.mc-file-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.path === path);
        });
        const saveBtn = document.getElementById('mc-btn-save');
        if (saveBtn) saveBtn.disabled = true;
        this.updateFileStatus('');
    }

    switchFileTab(path) {
        if (!this.fileEditorAgent || this.fileEditorPath === path) return;
        if (this.fileEditorDirty && !confirm('Unsaved changes. Discard?')) return;
        this.fileEditorPath = path;
        this.loadFileContent(this.fileEditorAgent.id, path);
    }

    async saveCurrentFile() {
        if (!this.fileEditorAgent || !this.fileEditorPath) return;
        const textarea = document.getElementById('mc-file-textarea');
        if (!textarea) return;
        this.updateFileStatus('Saving...');
        const data = await this.app.apiPost(`/agents/${this.fileEditorAgent.id}/files/${this.fileEditorPath}`, {
            content: textarea.value
        });
        if (data && data.success) {
            this.fileEditorDirty = false;
            document.getElementById('mc-btn-save').disabled = true;
            this.updateFileStatus('Saved');
            this.app.addLog?.('info', `Saved ${this.fileEditorPath} for ${this.fileEditorAgent.name}`, 'System');
            setTimeout(() => this.updateFileStatus(''), 2000);
        } else {
            this.updateFileStatus('Save failed');
        }
    }

    /** Called when app deselects agent */
    onAgentDeselected() {
        this.fileEditorAgent = null;
        this.fileEditorPath = null;
        this.fileEditorDirty = false;
        const content = document.getElementById('mc-files-content');
        if (!content) return;
        content.innerHTML = '<p class="mc-placeholder">Select an agent to edit files.</p>';
    }

    async renderIntegrations() {
        const el = document.getElementById('mc-integrations-content');
        if (!el) return;
        const data = await this.app.apiGet('/integrations');
        if (!data || typeof data !== 'object') {
            el.innerHTML = '<p class="mc-placeholder">Failed to load integrations.</p>';
            return;
        }
        const providers = [
            { id: 'openai', name: 'OpenAI', icon: '🤖' },
            { id: 'anthropic', name: 'Anthropic', icon: '🧠' },
            { id: 'wiro', name: 'Wiro AI', icon: '✨' },
            { id: 'google', name: 'Google', icon: '🔷' },
            { id: 'groq', name: 'Groq', icon: '⚡' },
            { id: 'mistral', name: 'Mistral', icon: '🌪' },
        ];
        el.innerHTML = providers.map(p => {
            const cfg = data[p.id] || {};
            const configured = !!cfg.configured;
            return `
                <div class="mc-integration-card" data-provider="${p.id}">
                    <div class="mc-integration-header">
                        <span class="mc-integration-icon">${p.icon}</span>
                        <span class="mc-integration-name">${p.name}</span>
                        ${configured ? '<span class="mc-integration-badge configured">Configured</span>' : '<span class="mc-integration-badge">Not set</span>'}
                    </div>
                    <input type="password" class="mc-integration-input" data-provider="${p.id}" placeholder="${configured ? '••••••••' : 'API key'}" autocomplete="off">
                    ${p.id === 'wiro' ? `<input type="password" class="mc-integration-input mc-integration-secret" data-provider="${p.id}" placeholder="Secret" autocomplete="off">` : ''}
                    <div class="mc-integration-actions">
                        <button type="button" class="mc-int-btn mc-int-test" data-provider="${p.id}" title="Test">Test</button>
                        <button type="button" class="mc-int-btn mc-int-save" data-provider="${p.id}" title="Save">Save</button>
                        ${configured ? `<button type="button" class="mc-int-btn mc-int-delete" data-provider="${p.id}" title="Remove">Delete</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        el.querySelectorAll('.mc-int-test').forEach(btn => btn.addEventListener('click', () => this.testIntegration(btn.dataset.provider)));
        el.querySelectorAll('.mc-int-save').forEach(btn => btn.addEventListener('click', () => this.saveIntegration(btn.dataset.provider)));
        el.querySelectorAll('.mc-int-delete').forEach(btn => btn.addEventListener('click', () => this.deleteIntegration(btn.dataset.provider)));
    }

    async testIntegration(provider) {
        const data = await this.app.apiPost(`/integrations/${provider}/test`, {});
        const msg = data?.ok ? `OK: ${data.message || 'Connected'}` : `Failed: ${data?.message || 'Unknown'}`;
        this.app.addLog?.(data?.ok ? 'info' : 'warning', `${provider}: ${msg}`, 'System');
    }

    async saveIntegration(provider) {
        const card = this.sidebar?.querySelector(`.mc-integration-card[data-provider="${provider}"]`);
        const keyInput = card?.querySelector('.mc-integration-input:not(.mc-integration-secret)');
        const secretInput = card?.querySelector('.mc-integration-secret');
        const key = keyInput?.value?.trim() || '';
        const body = { key };
        if (provider === 'wiro' && secretInput) body.secret = secretInput.value?.trim() || '';
        const data = await this.app.apiPost(`/integrations/${provider}`, body);
        if (data && typeof data === 'object') {
            this.app.addLog?.('info', `Saved ${provider} integration`, 'System');
            this.renderIntegrations();
        }
    }

    async deleteIntegration(provider) {
        if (!confirm(`Remove ${provider} API key?`)) return;
        const data = await this.app.apiDelete(`/integrations/${provider}`);
        if (data && typeof data === 'object') {
            this.app.addLog?.('info', `Removed ${provider} integration`, 'System');
            this.renderIntegrations();
        }
    }

    renderSystemActions() {
        const wrap = document.getElementById('mc-system-actions');
        if (!wrap) return;
        wrap.innerHTML = `
            <button type="button" class="mc-btn-restart-all" title="Restart all agents">Restart All</button>
            <button type="button" class="mc-btn-backup" title="Backup">Backup</button>
        `;
        wrap.querySelector('.mc-btn-restart-all')?.addEventListener('click', () => this.restartAll());
        wrap.querySelector('.mc-btn-backup')?.addEventListener('click', () => this.backup());
    }

    async restartAll() {
        if (!this.app?.apiPost) return;
        const data = await this.app.apiPost('/system/restart-all', {});
        if (data?.success) {
            this.app.addLog?.('info', `Restarted ${data.restarted}/${data.total} agents`, 'System');
            this.app.loadAgents?.();
        } else {
            this.app.addLog?.('warning', 'Restart all failed', 'System');
        }
    }

    backup() {
        this.app.addLog?.('info', 'Run: koalaclaw backup', 'System');
    }
}
