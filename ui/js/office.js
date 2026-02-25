// KoalaClaw Office Renderer — Phaser 3 bridge

class OfficeRenderer {
    constructor() {
        this.agents = [];
        this.selectedId = null;
        this._initialized = false;
    }

    render(agents, selectedId) {
        this.agents = agents;
        this.selectedId = selectedId;

        if (!this._initialized && agents.length > 0 && typeof initOfficeGame === 'function') {
            initOfficeGame(agents);
            this._initialized = true;
        } else if (typeof updateOfficeAgents === 'function') {
            updateOfficeAgents(agents);
        }
    }

    setAgents(agents) {
        this.agents = agents;
        if (typeof updateOfficeAgents === 'function') {
            updateOfficeAgents(agents);
        }
    }

    updateAgentState(agentId, status, state) {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            agent.status = status;
            agent.state = state;
        }
        if (typeof updateOfficeAgents === 'function') {
            updateOfficeAgents(this.agents);
        }
    }

    selectDesk(agentId) {
        this.selectedId = agentId;
    }
}

const officeRenderer = new OfficeRenderer();
