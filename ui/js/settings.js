// KoalaClaw Settings — Wiro AI + Channel integrations

(function () {
    function getApp() {
        return window.app || window.koalaApp || null;
    }

    function apiGet(path) {
        const app = getApp();
        const base = (window.location.origin || '') + '/api';
        const url = path.startsWith('/') ? base + path : base + '/' + path.replace(/^\/api\//, '');
        return fetch(url).then(r => r.json());
    }

    function apiPost(path, body) {
        const app = getApp();
        const base = (window.location.origin || '') + '/api';
        const url = path.startsWith('/') ? base + path : base + '/' + path.replace(/^\/api\//, '');
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(r => r.json());
    }

    function showModal(html) {
        const overlay = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');
        if (!overlay || !content) return;
        content.innerHTML = html;
        overlay.classList.add('visible');
    }

    function closeModal() {
        const overlay = document.getElementById('modal-overlay');
        if (overlay) overlay.classList.remove('visible');
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function render(data) {
        const wiroConfigured = data.wiro_configured || false;
        const agentCount = data.agent_count != null ? data.agent_count : 0;
        const channels = data.channels || {};
        const defaultModel = data.default_model || '';

        return `
            <div class="settings-modal">
                <button type="button" class="settings-close" id="settings-close">×</button>
                <h2>⚙️ Settings</h2>

                <div class="settings-section">
                    <div class="settings-section-title">Wiro AI</div>
                    <div class="settings-row">
                        <label>API Key</label>
                        <input type="password" id="settings-wiro-key" placeholder="${wiroConfigured ? '••••••••' : 'Enter API key'}" autocomplete="off">
                    </div>
                    <div class="settings-row">
                        <label>API Secret</label>
                        <input type="password" id="settings-wiro-secret" placeholder="${wiroConfigured ? '••••••••' : 'Enter API secret'}" autocomplete="off">
                    </div>
                    <div class="settings-actions">
                        <button type="button" class="settings-btn settings-btn-primary" id="settings-wiro-test">Test Connection</button>
                        <button type="button" class="settings-btn settings-btn-primary" id="settings-wiro-save">Save</button>
                        <button type="button" class="settings-btn settings-btn-secondary" id="settings-wiro-clear">Clear</button>
                    </div>
                    <div id="settings-wiro-status"></div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">Channel Integrations (Orchestrator)</div>
                    <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px">Connect Telegram, WhatsApp, Slack to your Orchestrator agent via OpenClaw channels.</p>
                    <div class="channel-block">
                        <div class="channel-name">Telegram</div>
                        <div class="settings-row">
                            <input type="password" id="settings-telegram-token" placeholder="Bot token" autocomplete="off">
                            <button type="button" class="settings-btn settings-btn-primary" id="settings-telegram-connect">Connect</button>
                        </div>
                        <div class="channel-status" id="channel-status-telegram">Not connected</div>
                    </div>
                    <div class="channel-block">
                        <div class="channel-name">WhatsApp</div>
                        <button type="button" class="settings-btn settings-btn-primary" id="settings-whatsapp-qr">Start QR Login</button>
                        <div class="channel-status" id="channel-status-whatsapp">Not connected</div>
                    </div>
                    <div class="channel-block">
                        <div class="channel-name">Slack</div>
                        <div class="settings-row">
                            <input type="password" id="settings-slack-bot" placeholder="Bot token" autocomplete="off">
                            <input type="password" id="settings-slack-app" placeholder="App token" autocomplete="off">
                            <button type="button" class="settings-btn settings-btn-primary" id="settings-slack-connect">Connect</button>
                        </div>
                        <div class="channel-status" id="channel-status-slack">Not connected</div>
                    </div>
                    <div class="channel-block">
                        <div class="channel-name">Discord</div>
                        <div class="settings-row">
                            <input type="password" id="settings-discord-token" placeholder="Bot token" autocomplete="off">
                            <button type="button" class="settings-btn settings-btn-primary" id="settings-discord-connect">Connect</button>
                        </div>
                        <div class="channel-status" id="channel-status-discord">Not connected</div>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">General</div>
                    <div class="settings-row">
                        <label>Default model</label>
                        <input type="text" id="settings-default-model" value="${escapeHtml(defaultModel)}" placeholder="e.g. openai/gpt-4.1">
                    </div>
                    <div class="settings-row">
                        <label>Agents</label>
                        <span class="value">${agentCount}</span>
                    </div>
                </div>
            </div>
        `;
    }

    function setWiroStatus(msg, isError) {
        const el = document.getElementById('settings-wiro-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'settings-status ' + (isError ? 'error' : 'success');
        el.style.display = msg ? 'block' : 'none';
    }

    async function open() {
        let data = {};
        try {
            data = await apiGet('/settings');
        } catch (e) {
            data = { error: e.message };
        }
        showModal(render(data));

        document.getElementById('settings-close')?.addEventListener('click', closeModal);
        document.getElementById('modal-overlay')?.addEventListener('click', function (e) {
            if (e.target.id === 'modal-overlay') closeModal();
        });

        document.getElementById('settings-wiro-test')?.addEventListener('click', async () => {
            setWiroStatus('Testing...', false);
            try {
                const res = await apiGet('/wiro/models');
                if (res.error) throw new Error(res.error);
                setWiroStatus('Connection successful', false);
            } catch (e) {
                setWiroStatus(e.message || 'Connection failed', true);
            }
        });

        document.getElementById('settings-wiro-save')?.addEventListener('click', async () => {
            const key = document.getElementById('settings-wiro-key')?.value?.trim() || '';
            const secret = document.getElementById('settings-wiro-secret')?.value?.trim() || '';
            setWiroStatus('', false);
            try {
                await apiPost('/settings', { wiro_api_key: key, wiro_api_secret: secret });
                setWiroStatus('Saved', false);
            } catch (e) {
                setWiroStatus(e.message || 'Save failed', true);
            }
        });

        document.getElementById('settings-wiro-clear')?.addEventListener('click', async () => {
            try {
                await apiPost('/settings', { wiro_api_key: '', wiro_api_secret: '' });
                setWiroStatus('Cleared', false);
                document.getElementById('settings-wiro-key').value = '';
                document.getElementById('settings-wiro-secret').value = '';
            } catch (e) {
                setWiroStatus(e.message || 'Clear failed', true);
            }
        });

        document.getElementById('settings-telegram-connect')?.addEventListener('click', () => {
            const token = document.getElementById('settings-telegram-token')?.value?.trim();
            if (!token) return;
            apiPost('/settings/channel/telegram', { token }).then((r) => {
                const status = document.getElementById('channel-status-telegram');
                if (status) status.textContent = (r.message || 'Request sent.') + (r.success ? '' : '');
            }).catch(() => {});
        });
        document.getElementById('settings-slack-connect')?.addEventListener('click', () => {
            const bot = document.getElementById('settings-slack-bot')?.value?.trim();
            const app = document.getElementById('settings-slack-app')?.value?.trim();
            apiPost('/settings/channel/slack', { bot_token: bot, app_token: app }).then((r) => {
                const status = document.getElementById('channel-status-slack');
                if (status) status.textContent = r.message || 'Request sent.';
            }).catch(() => {});
        });
        document.getElementById('settings-discord-connect')?.addEventListener('click', () => {
            const token = document.getElementById('settings-discord-token')?.value?.trim();
            if (!token) return;
            apiPost('/settings/channel/discord', { token }).then((r) => {
                const status = document.getElementById('channel-status-discord');
                if (status) status.textContent = r.message || 'Request sent.';
            }).catch(() => {});
        });
        document.getElementById('settings-whatsapp-qr')?.addEventListener('click', () => {
            apiPost('/settings/channel/whatsapp').then((r) => {
                const status = document.getElementById('channel-status-whatsapp');
                if (status) status.textContent = (r.qr_url ? 'Scan QR code (check API response)' : r.message) || 'QR login started.';
            }).catch(() => {});
        });
    }

    window.openSettings = open;
    window.addEventListener('koalaclaw-open-settings', () => open());
})();
