// KoalaClaw Chat — REST API Chat via admin-api.py
// Sends messages via docker exec → OpenClaw CLI

class ChatManager {
    constructor(app) {
        this.app = app;
        this.agent = null;
        this.histories = new Map(); // agentId → [{role, content, timestamp}]
        this.sending = false;
    }

    // ─── Connect to Agent ───────────────────────────────────
    connect(agent) {
        this.agent = agent;

        if (!agent || !agent.id) {
            this._renderError('Agent not available');
            return;
        }

        // Initialize history for this agent if not exists
        if (!this.histories.has(agent.id)) {
            this.histories.set(agent.id, []);
        }

        this.app.addLog('info', `Chat ready: ${agent.name}`, 'Chat');
        this._renderChat();

        // Restore previous messages
        this._restoreHistory();
    }

    disconnect() {
        this.agent = null;
    }

    _getHistory() {
        if (!this.agent) return [];
        return this.histories.get(this.agent.id) || [];
    }

    _pushHistory(role, content) {
        if (!this.agent) return;
        if (!this.histories.has(this.agent.id)) {
            this.histories.set(this.agent.id, []);
        }
        this.histories.get(this.agent.id).push({
            role, content, timestamp: new Date().toISOString()
        });
    }

    _restoreHistory() {
        const history = this._getHistory();
        if (history.length === 0) return;

        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        history.forEach(msg => {
            if (msg.role === 'user') {
                this._appendUserBubble(msg.content, msg.timestamp, true);
            } else if (msg.role === 'assistant') {
                this._appendRestoredAssistantBubble(msg.content, msg.timestamp);
            } else if (msg.role === 'system') {
                this._appendSystemMessage(msg.content, 'info');
            }
        });
        this._scrollToBottom();
    }

    // ─── Send Messages ──────────────────────────────────────
    async send(text) {
        if (!text.trim() || !this.agent || this.sending) return;

        this._appendUserBubble(text);
        this._pushHistory('user', text);
        this.app.addLog('info', `You: ${text}`, 'Chat');

        this.sending = true;
        this._appendAssistantBubble();
        this.app.updateAgentStatus(this.agent.id, 'online', 'thinking');

        try {
            const result = await this.app.apiPost('/agents/chat', {
                agent_id: this.agent.id,
                message: text
            });

            if (result && result.response) {
                this._finalizeStream(result.response);
                this._pushHistory('assistant', result.response);
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

        this.sending = false;
        this.app.updateAgentStatus(this.agent.id, 'online', 'idle');
    }

    _finalizeStream(text) {
        const bubble = document.getElementById('streaming-bubble');
        if (bubble) {
            bubble.removeAttribute('id');
            bubble.innerHTML = this._renderMarkdown(text);
            bubble.closest('.chat-bubble')?.classList.remove('streaming');
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
                <div class="chat-input-row">
                    <input type="text" id="chat-msg-input" class="chat-msg-input"
                           placeholder="Message ${this.agent.name}..."
                           autocomplete="off">
                    <button id="chat-send-btn" class="chat-send-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                        </svg>
                    </button>
                </div>
                <div class="chat-input-hint">
                    ${this.agent.emoji} ${this.agent.name} · ${this.agent.role || ''}
                </div>
            </div>
        `;

        // Event listeners
        const input = document.getElementById('chat-msg-input');
        const btn = document.getElementById('chat-send-btn');

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendFromInput();
            }
        });
        btn.addEventListener('click', () => this._sendFromInput());
        input.focus();

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
        if (text) {
            this.send(text);
            input.value = '';
        }
    }

    _appendUserBubble(text) {
        const messages = document.getElementById('chat-messages');
        if (!messages) return;

        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble user';
        bubble.innerHTML = `
            <div class="bubble-content">${this._escapeHtml(text)}</div>
            <div class="bubble-meta">You · ${this._timeStr()}</div>
        `;
        messages.appendChild(bubble);
        this.messageHistory.push({ role: 'user', content: text, timestamp: new Date().toISOString() });
        this._scrollToBottom();
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
        // Simple markdown: code blocks, bold, italic, links
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
        // Line breaks
        html = html.replace(/\n/g, '<br>');

        return html;
    }
}

