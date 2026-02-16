// KoalaClaw WebSocket Manager
// Manages WebSocket connections to each agent's OpenClaw gateway

class WebSocketManager {
    constructor(app) {
        this.app = app;
        this.connections = new Map(); // agentId -> WebSocket
        this.reconnectTimers = new Map();
        this.maxReconnectDelay = 30000;
        this.baseReconnectDelay = 2000;
    }

    connectToAgent(agent) {
        if (this.connections.has(agent.id)) {
            const existing = this.connections.get(agent.id);
            if (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING) {
                return;
            }
        }

        const wsUrl = `ws://${window.location.hostname}:${agent.port}/__openclaw__/ws`;
        this.app.addLog('info', `Connecting to ${agent.name}...`, 'System');

        try {
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                this.app.addLog('success', `Connected to ${agent.name}`, 'System');
                this.app.updateAgentStatus(agent.id, 'online', 'idle');

                // Authenticate with token
                if (agent.token) {
                    ws.send(JSON.stringify({
                        type: 'auth',
                        token: agent.token
                    }));
                }

                // Reset reconnect delay
                this.reconnectTimers.delete(agent.id);
            };

            ws.onmessage = (event) => {
                this.handleMessage(agent, event.data);
            };

            ws.onclose = (event) => {
                this.app.addLog('warning', `Disconnected from ${agent.name} (${event.code})`, 'System');
                this.app.updateAgentStatus(agent.id, 'offline', 'idle');
                this.connections.delete(agent.id);
                this.scheduleReconnect(agent);
            };

            ws.onerror = (error) => {
                this.app.addLog('error', `Connection error for ${agent.name}`, 'System');
            };

            this.connections.set(agent.id, ws);
        } catch (e) {
            this.app.addLog('error', `Failed to connect to ${agent.name}: ${e.message}`, 'System');
            this.scheduleReconnect(agent);
        }
    }

    handleMessage(agent, rawData) {
        try {
            const data = JSON.parse(rawData);

            switch (data.type) {
                case 'chat':
                case 'message':
                    this.app.addLog('success', `${agent.name}: ${data.content || data.text || JSON.stringify(data)}`, agent.name);
                    this.app.updateAgentStatus(agent.id, 'online', 'talking');
                    setTimeout(() => this.app.updateAgentStatus(agent.id, 'online', 'idle'), 3000);
                    break;

                case 'thinking':
                case 'processing':
                    this.app.updateAgentStatus(agent.id, 'online', 'thinking');
                    this.app.addLog('info', `${agent.name} is thinking...`, agent.name);
                    break;

                case 'tool_call':
                case 'tool':
                    this.app.addLog('info', `${agent.name} using tool: ${data.tool || data.name || 'unknown'}`, agent.name);
                    this.app.updateAgentStatus(agent.id, 'online', 'typing');
                    break;

                case 'error':
                    this.app.addLog('error', `${agent.name} error: ${data.message || data.error || JSON.stringify(data)}`, agent.name);
                    this.app.updateAgentStatus(agent.id, 'online', 'error');
                    setTimeout(() => this.app.updateAgentStatus(agent.id, 'online', 'idle'), 5000);
                    break;

                case 'status':
                    this.app.updateAgentStatus(agent.id, 'online', data.state || 'idle');
                    break;

                case 'auth_ok':
                    this.app.addLog('success', `Authenticated with ${agent.name}`, 'System');
                    break;

                default:
                    // Log unknown message types for debugging
                    this.app.addLog('info', `${agent.name} [${data.type || 'unknown'}]: ${JSON.stringify(data).substring(0, 200)}`, agent.name);
                    break;
            }
        } catch (e) {
            // Non-JSON message
            if (rawData.length > 0) {
                this.app.addLog('info', `${agent.name}: ${rawData.substring(0, 200)}`, agent.name);
            }
        }
    }

    sendMessage(agentId, message) {
        const ws = this.connections.get(agentId);
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            this.app.addLog('error', 'Not connected to agent', 'System');
            return false;
        }

        ws.send(JSON.stringify({
            type: 'chat',
            content: message
        }));
        return true;
    }

    scheduleReconnect(agent) {
        const currentDelay = this.reconnectTimers.get(agent.id) || this.baseReconnectDelay;
        const nextDelay = Math.min(currentDelay * 1.5, this.maxReconnectDelay);
        this.reconnectTimers.set(agent.id, nextDelay);

        setTimeout(() => {
            if (!this.connections.has(agent.id) || this.connections.get(agent.id).readyState === WebSocket.CLOSED) {
                this.connectToAgent(agent);
            }
        }, currentDelay);
    }

    connectAll(agents) {
        agents.forEach(agent => {
            if (agent.status === 'online') {
                this.connectToAgent(agent);
            }
        });
    }

    disconnectAll() {
        this.connections.forEach((ws, id) => {
            ws.close();
        });
        this.connections.clear();
    }

    isConnected(agentId) {
        const ws = this.connections.get(agentId);
        return ws && ws.readyState === WebSocket.OPEN;
    }
}

