// KoalaClaw Chat — Direct OpenClaw WebSocket Chat
// Connects to agent via Caddy-proxied WebSocket

class ChatManager {
    constructor(app) {
        this.app = app;
        this.ws = null;
        this.agent = null;
        this.reconnectTimer = null;
        this.messageHistory = [];
        this.isStreaming = false;
        this.streamBuffer = '';
        this.currentRunId = null;
    }

    // ─── Connect to Agent ───────────────────────────────────
    connect(agent) {
        this.disconnect();
        this.agent = agent;

        if (!agent || !agent.port || !agent.token) {
            this._renderError('Agent not available');
            return;
        }

        const host = window.location.hostname;
        const wsUrl = `ws://${host}:${agent.port}/__openclaw__/ws`;

        this._renderConnecting();
        this.app.addLog('info', `Connecting to ${agent.name}...`, 'Chat');

        try {
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = () => this._onOpen();
            this.ws.onmessage = (e) => this._onMessage(e);
            this.ws.onclose = (e) => this._onClose(e);
            this.ws.onerror = (e) => this._onError(e);
        } catch (e) {
            this._renderError(`Connection failed: ${e.message}`);
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.isStreaming = false;
        this.streamBuffer = '';
    }

    // ─── WebSocket Events ───────────────────────────────────
    _onOpen() {
        this.app.addLog('success', `Connected to ${this.agent.name}`, 'Chat');
        // Caddy already injects Authorization: Bearer TOKEN header
        // so no extra auth message needed — just render the chat UI
        this._renderChat();
    }

    _onMessage(event) {
        // Debug: log ALL incoming messages
        console.log('[WS RAW]', event.data);

        let data;
        try {
            data = JSON.parse(event.data);
        } catch {
            // Non-JSON message — show it
            if (event.data && event.data.length > 0) {
                this._appendSystemMessage(`[raw] ${event.data.substring(0, 200)}`, 'warning');
            }
            return;
        }

        // Debug: log parsed message type
        console.log('[WS MSG]', data.type || data.kind || 'unknown', data);

        // Show unhandled message types in chat for debugging
        const knownTypes = ['connected','chunk','text','message','run:start','run:end',
            'tool:start','tool:end','error','pong','heartbeat'];
        if (data.type && !knownTypes.includes(data.type)) {
            this._appendSystemMessage(`[${data.type}] ${JSON.stringify(data).substring(0, 150)}`, 'warning');
        }

        switch (data.type) {
            case 'connected':
                this.app.addLog('success', `Authenticated with ${this.agent.name}`, 'Chat');
                this.app.updateAgentStatus(this.agent.id, 'online', 'idle');
                break;

            case 'chunk':
            case 'text':
                this._handleTextChunk(data);
                break;

            case 'message':
                this._handleMessage(data);
                break;

            case 'run:start':
                this.currentRunId = data.runId;
                this.isStreaming = true;
                this.streamBuffer = '';
                this._appendAssistantBubble();
                this.app.updateAgentStatus(this.agent.id, 'online', 'thinking');
                break;

            case 'run:end':
                this.isStreaming = false;
                if (this.streamBuffer) {
                    this._finalizeStream();
                }
                this.currentRunId = null;
                this.app.updateAgentStatus(this.agent.id, 'online', 'idle');
                break;

            case 'tool:start':
                this._appendToolCall(data);
                this.app.updateAgentStatus(this.agent.id, 'online', 'typing');
                this.app.addLog('info', `Tool: ${data.name || data.tool || 'unknown'}`, this.agent.name);
                break;

            case 'tool:end':
                this._updateToolResult(data);
                break;

            case 'error':
                this._appendSystemMessage(`Error: ${data.message || data.error || JSON.stringify(data)}`, 'error');
                this.app.addLog('error', data.message || data.error, this.agent.name);
                this.app.updateAgentStatus(this.agent.id, 'online', 'error');
                break;

            case 'pong':
            case 'heartbeat':
                break;

            default:
                // Try to extract text from unknown message types
                if (data.content || data.text) {
                    this._handleTextChunk({ text: data.content || data.text });
                }
                break;
        }
    }

    _onClose(event) {
        this.app.addLog('warning', `Disconnected (${event.code}: ${event.reason || 'no reason'})`, 'Chat');
        this.app.updateAgentStatus(this.agent?.id, 'offline', 'idle');

        if (this.agent && event.code !== 1000) {
            this._appendSystemMessage('Disconnected. Reconnecting in 5s...', 'warning');
            this.reconnectTimer = setTimeout(() => {
                if (this.agent) this.connect(this.agent);
            }, 5000);
        }
    }

    _onError() {
        this.app.addLog('error', 'WebSocket error', 'Chat');
    }

    // ─── Send Messages ──────────────────────────────────────
    send(text) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this._appendSystemMessage('Not connected', 'error');
            return;
        }
        if (!text.trim()) return;

        // Add user bubble
        this._appendUserBubble(text);

        // Send to OpenClaw
        this._send({
            type: 'chat',
            message: text,
            channel: 'webchat'
        });

        this.app.addLog('info', `You: ${text}`, 'Chat');
    }

    _send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    // ─── Message Handling ───────────────────────────────────
    _handleTextChunk(data) {
        const text = data.text || data.content || data.chunk || '';
        if (!text) return;

        this.streamBuffer += text;

        // Update streaming bubble
        const bubble = document.getElementById('streaming-bubble');
        if (bubble) {
            bubble.innerHTML = this._renderMarkdown(this.streamBuffer);
            this._scrollToBottom();
        } else {
            this._appendAssistantBubble();
        }
    }

    _handleMessage(data) {
        const text = data.content || data.text || data.message || '';
        if (!text) return;

        if (data.role === 'user') {
            // Don't double-show user messages
        } else {
            this.streamBuffer = text;
            this._finalizeStream();
        }
    }

    _finalizeStream() {
        const bubble = document.getElementById('streaming-bubble');
        if (bubble) {
            bubble.removeAttribute('id');
            bubble.innerHTML = this._renderMarkdown(this.streamBuffer);
            bubble.classList.remove('streaming');
        }
        this.messageHistory.push({
            role: 'assistant',
            content: this.streamBuffer,
            timestamp: new Date().toISOString()
        });
        this.streamBuffer = '';
        this._scrollToBottom();
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

