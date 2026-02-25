// KoalaClaw Chat — REST API Chat via admin-api.py
// Supports direct agent chat and orchestrated multi-agent mode

class ChatManager {
    constructor(app) {
        this.app = app;
        this.agent = null;
        this.sending = false;
        this.pendingImage = null;
        this.orchestrateMode = false; // when true, messages go through orchestrator
    }

    // ─── Connect to Agent ───────────────────────────────────
    async connect(agent) {
        this.agent = agent;

        if (!agent || !agent.id) {
            this._renderError('Agent not available');
            return;
        }

        // Auto-enable orchestration when connecting to OrchestratorKoala
        if (agent.role_id === 'orchestrator-koala') {
            this.orchestrateMode = true;
        }

        this.app.addLog('info', `Chat ready: ${agent.name}`, 'Chat');
        this._renderChat();

        // Load history from server
        await this._loadHistory();
    }

    disconnect() {
        this.agent = null;
    }

    async _loadHistory() {
        if (!this.agent) return;

        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        try {
            const data = await this.app.apiGet(`/agents/${this.agent.id}/history?limit=100`);

            if (data && data.history && data.history.length > 0) {
                data.history.forEach(msg => {
                    if (msg.role === 'user') {
                        this._appendUserBubble(msg.content, msg.timestamp, true, msg.image_base64);
                    } else if (msg.role === 'assistant') {
                        this._appendRestoredAssistantBubble(msg.content, msg.timestamp);
                    }
                });
                this._appendSystemMessage(`${data.history.length} previous messages loaded`, 'info');
            }
        } catch (err) {
            this.app.addLog('error', `History load failed: ${err.message}`, 'Chat');
        }

        this._scrollToBottom();
    }

    // ─── Send Messages ──────────────────────────────────────
    async send(text, imageBase64) {
        if (!text.trim() || !this.agent || this.sending) return;

        const img = imageBase64 || this.pendingImage;
        this._appendUserBubble(text, null, false, img);
        this.pendingImage = null;
        this._clearUploadPreview();

        this.app.addLog('info', `You: ${text}`, 'Chat');

        this.sending = true;
        this.app.updateAgentStatus(this.agent.id, 'online', 'thinking');

        try {
            if (this.orchestrateMode) {
                await this._sendOrchestrated(text);
            } else {
                await this._sendDirect(text, img);
            }
        } finally {
            this.sending = false;
            this.app.updateAgentStatus(this.agent.id, 'online', 'idle');
        }
    }

    async _sendDirect(text, img) {
        this._appendAssistantBubble();
        try {
            const payload = { agent_id: this.agent.id, message: text };
            if (img) payload.image_base64 = img;
            const result = await this.app.apiPost('/agents/chat', payload);

            if (result && result.response) {
                this._finalizeStream(result.response);
                this.app.addLog('success', `${this.agent.name}: ${result.response.substring(0, 100)}`, this.agent.name);
            } else if (result && result.error) {
                this._removeStreamingBubble();
                this._appendSystemMessage(`Error: ${result.error}`, 'error');
                this.app.addLog('error', result.error, this.agent.name);
            } else {
                this._removeStreamingBubble();
                this._appendSystemMessage('No response received', 'warning');
            }
        } catch (e) {
            this._removeStreamingBubble();
            this._appendSystemMessage(`Failed: ${e.message}`, 'error');
        }
    }

    async _sendOrchestrated(text) {
        const chainEl = this._createLiveChain();

        try {
            const res = await fetch(`${API_BASE}/agents/orchestrate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            });

            if (!res.ok || !res.body) {
                this._removeLiveChain(chainEl);
                this._appendSystemMessage(`Orchestration HTTP error: ${res.status}`, 'error');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = '';
                let streamDone = false;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && currentEvent) {
                        if (currentEvent === 'close') { streamDone = true; break; }
                        try {
                            const data = JSON.parse(line.slice(6));
                            this._handleOrchEvent(currentEvent, data, chainEl);
                        } catch {}
                        currentEvent = '';
                    }
                }
                if (streamDone) break;
            }
        } catch (e) {
            this._removeLiveChain(chainEl);
            this._appendSystemMessage(`Orchestration failed: ${e.message}`, 'error');
        }
    }

    _createLiveChain() {
        const messages = document.getElementById('chat-messages');
        if (!messages) return null;
        const el = document.createElement('div');
        el.className = 'chat-delegation-chain live';
        el.innerHTML = `
            <div class="chain-header">🎯 Orchestration</div>
            <div class="chain-status">Analyzing task...</div>
            <div class="chain-steps"></div>
        `;
        messages.appendChild(el);
        this._scrollToBottom();
        return el;
    }

    _removeLiveChain(el) {
        if (el) el.remove();
    }

    _handleOrchEvent(event, data, chainEl) {
        if (!chainEl) return;
        const statusEl = chainEl.querySelector('.chain-status');
        const stepsEl = chainEl.querySelector('.chain-steps');

        switch (event) {
            case 'phase':
                if (statusEl) statusEl.textContent = data.message || data.phase;
                break;

            case 'plan':
                if (statusEl) statusEl.textContent = data.plan || 'Delegating...';
                if (data.delegations && data.delegations.length > 0 && stepsEl) {
                    data.delegations.forEach(d => {
                        const step = document.createElement('div');
                        step.className = 'chain-step pending';
                        step.id = `chain-step-${d.agent_id}`;
                        step.innerHTML = `
                            <span class="chain-agent-emoji">${d.agent_emoji || '🐨'}</span>
                            <div class="chain-step-body">
                                <div class="chain-agent-name">${this._escapeHtml(d.agent_name || '')} <span class="chain-role">${this._escapeHtml(d.task || '').substring(0, 60)}...</span></div>
                                <div class="chain-step-status">⏳ Waiting</div>
                            </div>
                        `;
                        stepsEl.appendChild(step);
                    });
                } else if (stepsEl) {
                    if (statusEl) statusEl.textContent = 'Direct answer';
                }
                this._scrollToBottom();
                break;

            case 'delegating': {
                const step = chainEl.querySelector(`#chain-step-${data.agent_id}`);
                if (step) {
                    step.classList.remove('pending');
                    step.classList.add('running');
                    const st = step.querySelector('.chain-step-status');
                    if (st) st.innerHTML = '<span class="chain-spinner"></span> Working...';
                }
                if (statusEl) statusEl.textContent = `${data.agent_emoji || ''} ${data.agent_name} is working...`;
                this.app.addLog('info', `Delegating to ${data.agent_name}`, 'Orchestrator');
                this._scrollToBottom();
                break;
            }

            case 'agent_done': {
                const step = chainEl.querySelector(`#chain-step-${data.agent_id}`);
                if (step) {
                    step.classList.remove('running');
                    step.classList.add('done');
                    const st = step.querySelector('.chain-step-status');
                    if (st) st.innerHTML = '✅ Done';
                    const body = step.querySelector('.chain-step-body');
                    if (body && data.response) {
                        const details = document.createElement('details');
                        details.className = 'chain-response-details';
                        details.innerHTML = `<summary>View response</summary><div class="chain-response">${this._renderMarkdown(data.response)}</div>`;
                        body.appendChild(details);
                    }
                }
                this.app.addLog('success', `${data.agent_name} completed`, 'Orchestrator');
                this._scrollToBottom();
                break;
            }

            case 'done':
                if (statusEl) statusEl.textContent = '✅ Complete';
                chainEl.classList.remove('live');
                if (data.response) {
                    this._appendRestoredAssistantBubble(data.response);
                }
                if (data.plan) {
                    this.app.addLog('success', `Orchestrated: ${data.plan}`, 'OrchestratorKoala');
                }
                this._scrollToBottom();
                break;

            case 'error':
                if (statusEl) statusEl.textContent = `❌ ${data.error || 'Error'}`;
                chainEl.classList.remove('live');
                this.app.addLog('error', data.error || 'Orchestration error', 'OrchestratorKoala');
                break;

            case 'close':
                break;
        }
    }

    _finalizeStream(text) {
        const bubble = document.getElementById('streaming-bubble');
        if (bubble) {
            bubble.removeAttribute('id');
            bubble.innerHTML = this._renderMarkdown(text);
            bubble.closest('.chat-bubble')?.classList.remove('streaming');
            this._injectDownloadButtons(bubble);
        }
        this._scrollToBottom();
    }

    _removeStreamingBubble() {
        const bubble = document.getElementById('streaming-bubble');
        if (bubble) {
            const parent = bubble.closest('.chat-bubble');
            if (parent) parent.remove();
        }
    }

    // ─── UI Rendering ───────────────────────────────────────
    _renderChat() {
        const container = document.getElementById('chat-area');
        if (!container) return;

        container.innerHTML = `
            <div class="chat-messages" id="chat-messages"></div>
            <div class="chat-input-area">
                <div class="chat-upload-preview" id="chat-upload-preview" style="display:none">
                    <img id="chat-upload-preview-img" alt="Preview">
                    <button type="button" id="chat-upload-clear" class="chat-upload-clear">✕</button>
                </div>
                <div class="chat-input-row">
                    <input type="file" id="chat-image-input" accept="image/*" class="chat-image-input" title="Attach image">
                    <button type="button" id="chat-attach-btn" class="chat-attach-btn" title="Attach image">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                    </button>
                    <input type="text" id="chat-msg-input" class="chat-msg-input"
                           placeholder="Message ${this.agent.name}..."
                           autocomplete="off">
                    <button type="button" id="chat-search-btn" class="chat-search-btn" title="Search chat history">🔍</button>
                    <button type="button" id="chat-wiro-btn" class="chat-wiro-btn" title="Generate with Wiro AI">
                        <img src="images/w.png" alt="W" width="20" height="20" style="object-fit:contain">
                    </button>
                    <button type="button" id="chat-send-btn" class="chat-send-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="chat-input-hint">
                    ${this.agent.emoji} ${this.agent.name} · ${this.agent.role || ''}
                    <label class="orchestrate-toggle" title="When enabled, messages are routed through OrchestratorKoala who delegates to specialist agents">
                        <input type="checkbox" id="chat-orchestrate-toggle" ${this.orchestrateMode ? 'checked' : ''}>
                        <span class="orchestrate-label">🎯 Orchestrate</span>
                    </label>
                </div>
            </div>
        `;

        // Event listeners
        const input = document.getElementById('chat-msg-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const attachBtn = document.getElementById('chat-attach-btn');
        const fileInput = document.getElementById('chat-image-input');
        const clearPreview = document.getElementById('chat-upload-clear');
        const wiroBtn = document.getElementById('chat-wiro-btn');

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendFromInput();
            }
        });
        sendBtn.addEventListener('click', () => this._sendFromInput());
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this._onImageSelect(e));
        if (clearPreview) clearPreview.addEventListener('click', () => this._clearUploadPreview());
        if (wiroBtn) wiroBtn.addEventListener('click', () => this._openWiroModal());
        const searchBtn = document.getElementById('chat-search-btn');
        if (searchBtn) searchBtn.addEventListener('click', () => this._openSearchModal());
        const orchToggle = document.getElementById('chat-orchestrate-toggle');
        if (orchToggle) orchToggle.addEventListener('change', (e) => {
            this.orchestrateMode = e.target.checked;
            this.app.addLog('info', `Orchestration mode: ${this.orchestrateMode ? 'ON' : 'OFF'}`, 'Chat');
        });
        input.focus();

        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) return;
        chatMessages.addEventListener('click', (e) => {
            const dl = e.target.closest('.chat-media-download');
            if (!dl) return;
            e.preventDefault();
            const url = dl.getAttribute('href');
            if (!url) return;
            dl.textContent = '...';
            fetch(url)
                .then(r => r.blob())
                .then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    const ext = url.split('.').pop()?.split('?')[0] || 'png';
                    a.download = `wiro-generated.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(a.href);
                    dl.textContent = '⬇';
                })
                .catch(() => {
                    window.open(url, '_blank');
                    dl.textContent = '⬇';
                });
        });

        window.addEventListener('koalaclaw-wiro-result', (e) => {
            if (!this.agent || !e.detail || e.detail.agent !== this.agent) return;
            const text = e.detail.result || (e.detail.raw && e.detail.raw.url) || '';
            if (text) this._appendRestoredAssistantBubble(text);
        });

        // Show welcome
        this._appendSystemMessage(`Connected to ${this.agent.emoji} ${this.agent.name}`, 'success');
    }

    _renderConnecting() {
        const container = document.getElementById('chat-area');
        if (!container) return;
        container.innerHTML = `
            <div class="chat-connecting">
                <div class="chat-connecting-spinner"></div>
                <p>Connecting to ${this.agent?.name || 'agent'}...</p>
            </div>
        `;
    }

    _renderError(msg) {
        const container = document.getElementById('chat-area');
        if (!container) return;
        container.innerHTML = `
            <div class="chat-connecting">
                <div style="font-size:48px;margin-bottom:16px">⚠️</div>
                <p style="color:var(--error)">${msg}</p>
            </div>
        `;
    }

    _sendFromInput() {
        const input = document.getElementById('chat-msg-input');
        if (!input) return;
        const text = input.value.trim();
        if (text || this.pendingImage) {
            this.send(text || '(image)', this.pendingImage);
            input.value = '';
        }
    }

    _onImageSelect(e) {
        const file = e.target.files && e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
            this.pendingImage = reader.result;
            const preview = document.getElementById('chat-upload-preview');
            const img = document.getElementById('chat-upload-preview-img');
            if (preview && img) {
                img.src = reader.result;
                preview.style.display = 'flex';
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    _clearUploadPreview() {
        this.pendingImage = null;
        const preview = document.getElementById('chat-upload-preview');
        const img = document.getElementById('chat-upload-preview-img');
        if (preview) preview.style.display = 'none';
        if (img) img.src = '';
        const fileInput = document.getElementById('chat-image-input');
        if (fileInput) fileInput.value = '';
    }

    _openWiroModal() {
        window.dispatchEvent(new CustomEvent('koalaclaw-open-wiro', { detail: { agent: this.agent } }));
    }

    _appendUserBubble(text, timestamp, skipScroll, imageBase64) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const time = timestamp
            ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : this._timeStr();

        const safeDataUrl = (imageBase64 && String(imageBase64).startsWith('data:image/')) ? imageBase64 : '';
        const imgHtml = safeDataUrl
            ? `<div class="chat-image-wrap"><img class="chat-image" src="${safeDataUrl.replace(/"/g, '&quot;')}" alt="Attached"></div>`
            : '';
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user';
        bubble.innerHTML = `
            <div class="bubble-content">${imgHtml}${this._escapeHtml(text || '')}</div>
            <div class="bubble-meta">You · ${time}</div>
        `;
        messages.appendChild(bubble);
        if (!skipScroll) this._scrollToBottom();
    }

    _appendRestoredAssistantBubble(text, timestamp) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const time = timestamp
            ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : this._timeStr();

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble assistant';
        bubble.innerHTML = `
            <div class="bubble-avatar">${this.agent?.emoji || '🐨'}</div>
            <div class="bubble-body">
                <div class="bubble-name">${this.agent?.name || 'Agent'}</div>
                <div class="bubble-content">${this._renderMarkdown(text)}</div>
                <div class="bubble-meta">${time}</div>
            </div>
        `;
        messages.appendChild(bubble);
        this._injectDownloadButtons(bubble);
    }

    _injectDownloadButtons(container) {
        container.querySelectorAll('img.chat-image, video.chat-video, audio.chat-audio').forEach(el => {
            const src = el.src || el.querySelector('source')?.src;
            if (!src || src.startsWith('data:')) return;
            if (el.parentElement.querySelector('.chat-media-download')) return;
            const ext = src.split('.').pop()?.split('?')[0] || '';
            const typeLabel = /mp4|webm|mov/i.test(ext) ? 'Video' : /mp3|wav|ogg|m4a|aac/i.test(ext) ? 'Audio' : 'Image';
            const btn = document.createElement('a');
            btn.className = 'chat-media-download';
            btn.href = src;
            btn.download = `wiro-generated.${ext}`;
            btn.textContent = `⬇ Download ${typeLabel}`;
            el.insertAdjacentElement('afterend', btn);
        });
    }

    _openSearchModal() {
        if (!this.agent) return;
        let modal = document.getElementById('chat-search-modal');
        if (modal) { modal.remove(); }
        modal = document.createElement('div');
        modal.id = 'chat-search-modal';
        modal.className = 'chat-search-modal';
        modal.innerHTML = `
            <div class="chat-search-overlay"></div>
            <div class="chat-search-dialog">
                <div class="chat-search-header">
                    <span>Search Chat History</span>
                    <button class="chat-search-close">✕</button>
                </div>
                <input type="text" class="chat-search-input" placeholder="Search conversations..." autofocus>
                <div class="chat-search-results"></div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.chat-search-close');
        const overlay = modal.querySelector('.chat-search-overlay');
        const input = modal.querySelector('.chat-search-input');
        const resultsEl = modal.querySelector('.chat-search-results');

        const close = () => modal.remove();
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', close);

        let debounce = null;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => this._doSearch(input.value, resultsEl), 400);
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });
    }

    async _doSearch(query, resultsEl) {
        if (!query.trim() || !this.agent) {
            resultsEl.innerHTML = '<div class="chat-search-empty">Type to search...</div>';
            return;
        }
        resultsEl.innerHTML = '<div class="chat-search-empty">Searching...</div>';
        try {
            const data = await this.app.apiGet(`/agents/${this.agent.id}/history/search?q=${encodeURIComponent(query)}&limit=10`);
            if (data?.error) {
                resultsEl.innerHTML = `<div class="chat-search-empty">${data.error}</div>`;
                return;
            }
            const results = data?.results || [];
            if (!results.length) {
                resultsEl.innerHTML = '<div class="chat-search-empty">No results found.</div>';
                return;
            }
            resultsEl.innerHTML = results.map(r => `
                <div class="chat-search-result">
                    <div class="chat-search-result-meta">${r.role || ''} · ${r.timestamp || ''} · score: ${r.score}</div>
                    <div class="chat-search-result-text">${this._escapeHtml((r.content || '').substring(0, 200))}</div>
                </div>
            `).join('');
        } catch (e) {
            resultsEl.innerHTML = `<div class="chat-search-empty">Search failed: ${e.message}</div>`;
        }
    }

    _appendAssistantBubble() {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        // Remove existing streaming bubble if any
        const existing = document.getElementById('streaming-bubble');
        if (existing) return;

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble assistant streaming';
        bubble.innerHTML = `
            <div class="bubble-avatar">${this.agent?.emoji || '🐨'}</div>
            <div class="bubble-body">
                <div class="bubble-name">${this.agent?.name || 'Agent'}</div>
                <div class="bubble-content" id="streaming-bubble">
                    <span class="typing-indicator">
                        <span></span><span></span><span></span>
                    </span>
                </div>
                <div class="bubble-meta">${this._timeStr()}</div>
            </div>
        `;
        messages.appendChild(bubble);
        this._scrollToBottom();
    }

    _appendToolCall(data) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const name = data.name || data.tool || 'unknown';
        const el = document.createElement('div');
        el.className = 'chat-tool-call';
        el.id = `tool-${data.callId || Date.now()}`;
        el.innerHTML = `
            <span class="tool-icon">⚙️</span>
            <span class="tool-name">${this._escapeHtml(name)}</span>
            <span class="tool-status running">running...</span>
        `;
        messages.appendChild(el);
        this._scrollToBottom();
    }

    _updateToolResult(data) {
        const el = document.getElementById(`tool-${data.callId}`);
        if (el) {
            const status = el.querySelector('.tool-status');
            if (status) {
                status.textContent = 'done';
                status.className = 'tool-status done';
            }
        }
    }

    _renderDelegationChain(chain) {
        const messages = document.getElementById('chat-messages');
        if (!messages || !chain || chain.length < 2) return;

        const el = document.createElement('div');
        el.className = 'chat-delegation-chain';

        const steps = chain.slice(1).map(c => `
            <div class="chain-step">
                <span class="chain-agent-emoji">${c.agent_emoji || '🐨'}</span>
                <div class="chain-step-body">
                    <div class="chain-agent-name">${this._escapeHtml(c.agent_name)} <span class="chain-role">${this._escapeHtml(c.role)}</span></div>
                    <div class="chain-task">${this._escapeHtml(c.task || '')}</div>
                    <details class="chain-response-details">
                        <summary>View response</summary>
                        <div class="chain-response">${this._renderMarkdown(c.response || '')}</div>
                    </details>
                </div>
            </div>
        `).join('');

        el.innerHTML = `
            <div class="chain-header">🎯 Delegation Chain</div>
            ${steps}
        `;
        messages.appendChild(el);
        this._scrollToBottom();
    }

    _appendSystemMessage(text, type) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const el = document.createElement('div');
        el.className = `chat-system-msg ${type || ''}`;
        el.textContent = text;
        messages.appendChild(el);
        this._scrollToBottom();
    }

    _scrollToBottom() {
        const messages = document.getElementById('chat-messages');
        if (messages) {
            requestAnimationFrame(() => {
                messages.scrollTop = messages.scrollHeight;
            });
        }
    }

    // ─── Helpers ────────────────────────────────────────────
    _escapeHtml(t) {
        const d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }

    _timeStr() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    _renderMarkdown(text) {
        // Strip HTML comments (internal metadata like wiro_model_options)
        text = text.replace(/<!--[\s\S]*?-->/g, '').trim();
        let html = this._escapeHtml(text);

        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
        // Image URLs
        html = html.replace(/(https?:\/\/[^\s<>"]+\.(?:png|jpe?g|webp|gif))\b/gi, '<div class="chat-image-wrap"><img class="chat-image" src="$1" alt="Image" loading="lazy"><br><a class="chat-media-download" href="$1" download>⬇ Download Image</a></div>');
        // Video URLs
        html = html.replace(/(https?:\/\/[^\s<>"]+\.(?:mp4|webm|mov))\b/gi, '<div class="chat-video-wrap"><video class="chat-video" src="$1" controls preload="metadata"></video><br><a class="chat-media-download" href="$1" download>⬇ Download Video</a></div>');
        // Audio URLs
        html = html.replace(/(https?:\/\/[^\s<>"]+\.(?:mp3|wav|ogg|m4a|aac))\b/gi, '<div class="chat-audio-wrap"><audio class="chat-audio" src="$1" controls preload="metadata"></audio> <a class="chat-media-download" href="$1" download>⬇ Download Audio</a></div>');
        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }
}

