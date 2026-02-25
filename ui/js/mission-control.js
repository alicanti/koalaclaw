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
        this.sectionOpen = { agents: true, files: false, documents: false, channels: false, integrations: false, 'wiro-status': false, system: true };
        this.docsAgent = null;
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
        this.loadWiroModels();
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

    /** Called when app selects an agent: show Agent Files section, file editor, and documents */
    onAgentSelected(agent) {
        this.fileEditorAgent = agent;
        if (agent?.id) this.loadDocuments(agent.id);
        if (agent?.id) this.loadChannels(agent.id);
        const section = this.sidebar?.querySelector('[data-section="files"]');
        const content = document.getElementById('mc-files-content');
        if (!section || !content) return;
        // Keep files section collapsed by default when selecting an agent

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

    async loadWiroModels() {
        const wrap = document.getElementById('mc-wiro-content');
        if (!wrap) return;
        try {
            const data = this.app?.apiGet ? await this.app.apiGet('/wiro/status') : null;
            const configured = data?.configured === true;
            const skillAgents = (data?.skill_agents || []).map(a => this._esc(a)).join(', ');

            wrap.innerHTML = `
                <div class="wiro-status-panel">
                    <div class="wiro-status-row">
                        <span class="wiro-status-label">Status</span>
                        <span class="wiro-status-value ${configured ? 'wiro-ok' : 'wiro-err'}">${configured ? 'Connected' : 'Not configured'}</span>
                    </div>
                    ${!configured ? `<p class="wiro-status-hint">Add your Wiro API Key &amp; Secret in <strong>Integrations</strong> to enable AI generation.</p>` : ''}
                    ${configured ? `
                    <div class="wiro-status-row">
                        <span class="wiro-status-label">How it works</span>
                    </div>
                    <p class="wiro-status-hint">Agents with the <strong>wiro-ai</strong> skill can generate images, videos, and audio. Just ask them in chat — they automatically find the best model and generate.</p>
                    <div class="wiro-status-row">
                        <span class="wiro-status-label">Agents with skill</span>
                        <span class="wiro-status-value">${skillAgents || 'None yet'}</span>
                    </div>
                    <div class="wiro-quick-test">
                        <input type="text" class="wiro-test-prompt" placeholder="Quick test: describe an image...">
                        <button type="button" class="wiro-test-btn" title="Test generate">Test</button>
                    </div>
                    <div class="wiro-test-result"></div>
                    ` : ''}
                </div>`;

            if (configured) {
                const testBtn = wrap.querySelector('.wiro-test-btn');
                const testInput = wrap.querySelector('.wiro-test-prompt');
                const testResult = wrap.querySelector('.wiro-test-result');
                if (testBtn) {
                    testBtn.addEventListener('click', () => this._wiroQuickTest(testInput, testBtn, testResult));
                }
                if (testInput) {
                    testInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') this._wiroQuickTest(testInput, testBtn, testResult);
                    });
                }
            }
        } catch (err) {
            wrap.innerHTML = `<p class="mc-placeholder">Error checking Wiro status.</p>`;
        }
    }

    async _wiroQuickTest(input, btn, resultEl) {
        const prompt = (input?.value || '').trim();
        if (!prompt) { input?.focus(); return; }

        btn.disabled = true;
        btn.textContent = '...';
        resultEl.textContent = 'Finding best model and generating...';

        try {
            const res = this.app?.apiPost ? await this.app.apiPost('/wiro/smart-generate', { prompt, task_type: 'text-to-image' }) : null;
            if (res?.error) throw new Error(res.error);
            if (res?.success === false) throw new Error(res.message || 'Generation failed');
            const url = res?.output_url || '';
            const modelName = res?.model_used || 'Wiro AI';
            if (url) {
                resultEl.innerHTML = `<div class="wiro-test-success">Generated with <strong>${this._esc(modelName)}</strong>:</div><img class="wiro-test-img" src="${this._esc(url)}" alt="Generated">`;
                if (window.app?.chatManager) {
                    window.app.chatManager._appendRestoredAssistantBubble(`Generated with **${modelName}**:\n\n${url}`);
                    window.app.chatManager._scrollToBottom?.();
                }
            } else {
                resultEl.textContent = 'No output received.';
            }
            if (input) input.value = '';
        } catch (err) {
            resultEl.textContent = `Error: ${err.message}`;
            this.app?.addLog?.('error', `Wiro test: ${err.message}`, 'Wiro');
        }
        btn.disabled = false;
        btn.textContent = 'Test';
    }

    // ── Channels ─────────────────────────────────────────

    loadChannels(agentId) {
        this._channelsAgent = agentId;
        const wrap = document.getElementById('mc-channels-content');
        if (!wrap) return;
        wrap.innerHTML = '<p class="mc-placeholder">Loading channels...</p>';

        const CHANNELS = [
            { id: 'telegram', name: 'Telegram', icon: '✈️', tokenLabel: 'Bot Token' },
            { id: 'whatsapp', name: 'WhatsApp', icon: '💬', tokenLabel: null },
            { id: 'slack', name: 'Slack', icon: '💼', tokenLabel: 'Bot Token', extraLabel: 'App Token' },
            { id: 'discord', name: 'Discord', icon: '🎮', tokenLabel: 'Bot Token' },
        ];

        let html = '';
        for (const ch of CHANNELS) {
            const tokenInput = ch.tokenLabel
                ? `<input type="password" class="channel-token-input" placeholder="${ch.tokenLabel}" data-channel="${ch.id}" data-field="token">`
                : '';
            const extraInput = ch.extraLabel
                ? `<input type="password" class="channel-token-input" placeholder="${ch.extraLabel}" data-channel="${ch.id}" data-field="app_token">`
                : '';
            const connectLabel = ch.id === 'whatsapp' ? 'QR Login' : 'Connect';
            html += `
                <div class="channel-card" data-channel="${ch.id}">
                    <div class="channel-card-header">
                        <span class="channel-icon">${ch.icon}</span>
                        <span class="channel-name">${ch.name}</span>
                        <span class="channel-status-dot" id="ch-status-${ch.id}" title="checking..."></span>
                    </div>
                    ${tokenInput}${extraInput}
                    <div class="channel-card-actions">
                        <button class="channel-connect-btn" data-channel="${ch.id}">${connectLabel}</button>
                        <span class="channel-status-text" id="ch-text-${ch.id}"></span>
                    </div>
                </div>`;
        }
        wrap.innerHTML = html;

        wrap.addEventListener('click', (e) => {
            const btn = e.target.closest('.channel-connect-btn');
            if (btn) this._connectChannel(btn.getAttribute('data-channel'));
        });

        this._pollChannelStatuses(agentId);
    }

    async _pollChannelStatuses(agentId) {
        try {
            const data = await this.app.apiGet(`/agents/${agentId}/channels`);
            if (!data?.channels) return;
            for (const [name, info] of Object.entries(data.channels)) {
                const dot = document.getElementById(`ch-status-${name}`);
                const text = document.getElementById(`ch-text-${name}`);
                if (dot) {
                    dot.className = `channel-status-dot ${info.status === 'connected' ? 'connected' : 'disconnected'}`;
                    dot.title = info.status;
                }
                if (text) text.textContent = info.status;
            }
        } catch {}
    }

    async _connectChannel(name) {
        if (!this._channelsAgent) return;
        const card = document.querySelector(`.channel-card[data-channel="${name}"]`);
        if (!card) return;
        const btn = card.querySelector('.channel-connect-btn');
        const textEl = document.getElementById(`ch-text-${name}`);

        const tokenInput = card.querySelector('.channel-token-input[data-field="token"]');
        const appInput = card.querySelector('.channel-token-input[data-field="app_token"]');

        const body = {};
        if (tokenInput) body.token = tokenInput.value.trim();
        if (appInput) body.app_token = appInput.value.trim();

        if (name !== 'whatsapp' && !body.token) {
            if (textEl) textEl.textContent = 'Token required';
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        if (textEl) textEl.textContent = 'Connecting...';

        try {
            const res = await this.app.apiPost(`/agents/${this._channelsAgent}/channels/${name}`, body);
            if (res?.error) {
                if (textEl) textEl.textContent = res.error;
            } else if (res?.qr_url) {
                if (textEl) textEl.innerHTML = `<a href="${this._esc(res.qr_url)}" target="_blank">Scan QR</a>`;
            } else {
                if (textEl) textEl.textContent = res?.success ? 'Connected!' : (res?.message || 'Done');
                this._pollChannelStatuses(this._channelsAgent);
            }
            if (tokenInput) tokenInput.value = '';
            if (appInput) appInput.value = '';
        } catch (err) {
            if (textEl) textEl.textContent = `Error: ${err.message}`;
        }
        if (btn) { btn.disabled = false; btn.textContent = name === 'whatsapp' ? 'QR Login' : 'Connect'; }
    }

    // ── Documents ─────────────────────────────────────────

    loadDocuments(agentId) {
        this.docsAgent = agentId;
        const wrap = document.getElementById('mc-documents-content');
        if (!wrap) return;
        wrap.innerHTML = '<p class="mc-placeholder">Loading...</p>';

        this.app.apiGet(`/agents/${agentId}/documents`).then(data => {
            const docs = data?.documents || [];
            let html = `
                <div class="docs-upload-area" id="docs-upload-area">
                    <div class="docs-upload-label">Drop files here or click to upload</div>
                    <div class="docs-upload-hint">PDF, MD, TXT (max 10MB)</div>
                    <input type="file" id="docs-file-input" accept=".pdf,.md,.txt,.csv,.json" style="display:none">
                </div>
                <div class="docs-list" id="docs-list">`;

            if (docs.length === 0) {
                html += '<div class="docs-empty">No documents uploaded yet.</div>';
            } else {
                for (const d of docs) {
                    const sizeKB = (d.size / 1024).toFixed(1);
                    html += `
                        <div class="docs-item" data-filename="${this._esc(d.filename)}">
                            <div class="docs-item-info">
                                <div class="docs-item-name">${this._esc(d.filename)}</div>
                                <div class="docs-item-meta">${sizeKB} KB · ${d.modified || ''}</div>
                            </div>
                            <button class="docs-item-delete" data-filename="${this._esc(d.filename)}" title="Delete">✕</button>
                        </div>`;
                }
            }
            html += '</div>';
            wrap.innerHTML = html;

            const uploadArea = document.getElementById('docs-upload-area');
            const fileInput = document.getElementById('docs-file-input');
            if (uploadArea && fileInput) {
                uploadArea.addEventListener('click', () => fileInput.click());
                uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
                uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.classList.remove('dragover');
                    if (e.dataTransfer.files.length) this._uploadDocument(e.dataTransfer.files[0]);
                });
                fileInput.addEventListener('change', (e) => {
                    if (e.target.files.length) this._uploadDocument(e.target.files[0]);
                });
            }

            wrap.addEventListener('click', (e) => {
                const delBtn = e.target.closest('.docs-item-delete');
                if (delBtn) this._deleteDocument(delBtn.getAttribute('data-filename'));
            });
        }).catch(() => {
            wrap.innerHTML = '<p class="mc-placeholder">Error loading documents.</p>';
        });
    }

    async _uploadDocument(file) {
        if (!this.docsAgent || !file) return;
        const uploadArea = document.getElementById('docs-upload-area');
        const label = uploadArea?.querySelector('.docs-upload-label');
        if (label) label.textContent = 'Uploading & indexing...';

        try {
            const text = await file.text();
            const res = await this.app.apiPost(`/agents/${this.docsAgent}/documents`, {
                filename: file.name,
                content: text,
            });
            if (res?.error) throw new Error(res.error);
            this.app.addLog?.('success', `Uploaded ${file.name} (${res.chunks || 0} chunks indexed)`, 'Documents');
            this.loadDocuments(this.docsAgent);
        } catch (err) {
            this.app.addLog?.('error', `Upload failed: ${err.message}`, 'Documents');
            if (label) label.textContent = `Error: ${err.message}`;
            setTimeout(() => { if (label) label.textContent = 'Drop files here or click to upload'; }, 3000);
        }
    }

    async _deleteDocument(filename) {
        if (!this.docsAgent || !filename) return;
        try {
            await this.app.apiDelete(`/agents/${this.docsAgent}/documents/${filename}`);
            this.app.addLog?.('info', `Deleted ${filename}`, 'Documents');
            this.loadDocuments(this.docsAgent);
        } catch (err) {
            this.app.addLog?.('error', `Delete failed: ${err.message}`, 'Documents');
        }
    }

    _esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
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
