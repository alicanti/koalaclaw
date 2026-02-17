// KoalaClaw Pixel Art Office Renderer

class OfficeRenderer {
    constructor() {
        this.agents = [];
        this.selectedId = null;
    }

    render(agents, selectedId) {
        this.agents = agents;
        this.selectedId = selectedId;
        const scene = document.getElementById('office-scene');
        if (!scene) return;

        const hour = new Date().getHours();
        scene.className = 'office-scene' + (hour >= 20 || hour < 6 ? ' night' : '');

        scene.innerHTML = '';

        // Floor grid
        const floor = document.createElement('div');
        floor.className = 'office-floor-bg';
        scene.appendChild(floor);

        // Wall
        const wall = document.createElement('div');
        wall.className = 'office-wall';
        scene.appendChild(wall);

        // Clock
        const clock = document.createElement('div');
        clock.className = 'wall-clock';
        clock.id = 'wall-clock';
        clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        scene.appendChild(clock);

        // Desk grid
        const grid = document.createElement('div');
        grid.className = 'desk-grid';

        agents.forEach((agent, idx) => {
            grid.appendChild(this._createDesk(agent, idx));
        });

        scene.appendChild(grid);

        // Office decorations
        this._addDecorations(scene, agents.length);

        // Update clock every minute
        this._startClock();
    }

    _createDesk(agent, idx) {
        const unit = document.createElement('div');
        unit.className = 'desk-unit' +
            (agent.status === 'online' ? ' active' : '') +
            (agent.id === this.selectedId ? ' selected' : '');
        unit.dataset.agentId = agent.id;

        unit.onclick = () => {
            if (window.app) window.app.selectAgent(agent.id);
        };

        const state = agent.state || 'idle';
        const statusClass = agent.status === 'online'
            ? (state === 'thinking' ? 'thinking' : 'online')
            : '';

        // Determine speech text
        let speech = '';
        if (state === 'thinking') speech = 'Thinking...';
        else if (state === 'typing') speech = 'Typing...';
        else if (state === 'talking') speech = 'Responding...';
        else if (state === 'error') speech = 'Error!';
        else if (state === 'sleeping') speech = 'Zzz...';
        else if (agent.status === 'online') speech = 'Ready';
        else speech = 'Offline';

        unit.innerHTML = `
            <div class="desk-status-light ${statusClass}"></div>
            <div class="speech-bubble">${speech}</div>
            <div class="koala-char ${state}">${agent.emoji || '🐨'}</div>
            <div class="desk-monitor"></div>
            <div class="desk-monitor-stand"></div>
            <div class="desk-surface"></div>
            <div class="desk-chair">
                <div class="desk-chair-back"></div>
                <div class="desk-chair-seat"></div>
                <div class="desk-chair-leg"></div>
            </div>
            <div class="desk-item item-coffee">☕</div>
            ${idx % 3 === 0 ? '<div class="desk-item item-plant">🌱</div>' : ''}
            ${idx % 2 === 1 ? '<div class="desk-item item-book">📚</div>' : ''}
            <div class="desk-nameplate">
                <div class="np-name">${agent.name || 'Agent ' + agent.id}</div>
                <div class="np-role">${agent.role || ''}</div>
            </div>
        `;

        return unit;
    }

    _addDecorations(scene, agentCount) {
        // Add some office plants and decorations around the edges
        const decorations = [
            { emoji: '🌿', top: '130px', left: '20px' },
            { emoji: '🪴', top: '130px', right: '20px' },
            { emoji: '🚰', bottom: '20px', right: '30px', cls: 'office-watercooler' },
        ];

        decorations.forEach(d => {
            const el = document.createElement('div');
            el.className = d.cls || 'office-plant';
            el.textContent = d.emoji;
            if (d.top) el.style.top = d.top;
            if (d.bottom) el.style.bottom = d.bottom;
            if (d.left) el.style.left = d.left;
            if (d.right) el.style.right = d.right;
            scene.appendChild(el);
        });
    }

    _startClock() {
        setInterval(() => {
            const el = document.getElementById('wall-clock');
            if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }, 60000);
    }

    updateAgentState(agentId, status, state) {
        const unit = document.querySelector(`.desk-unit[data-agent-id="${agentId}"]`);
        if (!unit) return;

        // Update character animation
        const char = unit.querySelector('.koala-char');
        if (char) char.className = 'koala-char ' + (state || 'idle');

        // Update status light
        const light = unit.querySelector('.desk-status-light');
        if (light) {
            light.className = 'desk-status-light ' +
                (status === 'online' ? (state === 'thinking' ? 'thinking' : 'online') : '');
        }

        // Update monitor
        if (status === 'online') unit.classList.add('active');
        else unit.classList.remove('active');

        // Update speech
        const bubble = unit.querySelector('.speech-bubble');
        if (bubble) {
            if (state === 'thinking') bubble.textContent = 'Thinking...';
            else if (state === 'typing') bubble.textContent = 'Typing...';
            else if (state === 'talking') bubble.textContent = 'Responding...';
            else if (state === 'error') bubble.textContent = 'Error!';
            else bubble.textContent = status === 'online' ? 'Ready' : 'Offline';
        }
    }

    selectDesk(agentId) {
        document.querySelectorAll('.desk-unit').forEach(u => u.classList.remove('selected'));
        const unit = document.querySelector(`.desk-unit[data-agent-id="${agentId}"]`);
        if (unit) unit.classList.add('selected');
        this.selectedId = agentId;
    }
}

// Global instance
const officeRenderer = new OfficeRenderer();
