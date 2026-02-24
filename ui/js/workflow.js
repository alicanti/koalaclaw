// KoalaClaw Workflow Pipeline Engine - Phase 4

class WorkflowEngine {
    constructor(app) {
        this.app = app;
        this.workflows = [];
        this.activeWorkflows = [];
        this.init();
    }

    async init() {
        await this.loadWorkflows();
    }

    async loadWorkflows() {
        // Load preset workflows from API
        const data = await this.app.apiGet('/workflows');
        if (data && data.workflows) {
            this.workflows = data.workflows;
        } else {
            // Fallback: built-in presets
            this.workflows = [
                {
                    name: "Blog Post Pipeline",
                    description: "Research, write, optimize, and publish a blog post",
                    steps: [
                        { agent_role: "research-koala", task: "Research topic: {{topic}}" },
                        { agent_role: "content-koala", task: "Write blog post from research", input_from: [0] },
                        { agent_role: "content-koala", task: "Optimize for SEO", input_from: [1] },
                        { agent_role: "marketer-koala", task: "Create social media posts", input_from: [2] }
                    ],
                    variables: { topic: "Topic to research" }
                },
                {
                    name: "Security Audit",
                    description: "Comprehensive security audit",
                    steps: [
                        { agent_role: "security-koala", task: "Scan {{target}} for vulnerabilities" },
                        { agent_role: "devops-koala", task: "Review server configuration", input_from: [0] },
                        { agent_role: "legal-koala", task: "Generate compliance report", input_from: [0, 1] }
                    ],
                    variables: { target: "Target to audit" }
                },
                {
                    name: "Product Launch",
                    description: "Full product launch pipeline",
                    steps: [
                        { agent_role: "strategy-koala", task: "Create launch strategy for {{product}}" },
                        { agent_role: "content-koala", task: "Write announcement", input_from: [0] },
                        { agent_role: "marketer-koala", task: "Create social campaign", input_from: [0, 1] },
                        { agent_role: "sales-koala", task: "Prepare sales materials", input_from: [0] }
                    ],
                    variables: { product: "Product name" }
                }
            ];
        }
    }

    // ─── Workflow Execution ──────────────────────────────────────
    async executeWorkflow(workflow, variables) {
        const execution = {
            id: Date.now(),
            workflow: workflow,
            variables: variables,
            steps: workflow.steps.map((step, i) => ({
                ...step,
                index: i,
                status: 'pending',
                output: null,
                startedAt: null,
                completedAt: null
            })),
            status: 'running',
            startedAt: new Date().toISOString()
        };

        this.activeWorkflows.push(execution);
        this.app.addLog('info', `Starting workflow: ${workflow.name}`, 'Workflow');
        this.renderKanban();

        // Execute steps
        await this._executeSteps(execution);

        execution.status = 'completed';
        execution.completedAt = new Date().toISOString();
        this.app.addLog('success', `Workflow completed: ${workflow.name}`, 'Workflow');
        this.renderKanban();

        return execution;
    }

    async _executeSteps(execution) {
        const { steps, variables } = execution;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];

            // Check dependencies
            if (step.input_from) {
                const deps = Array.isArray(step.input_from) ? step.input_from : [step.input_from];
                const allDone = deps.every(d => steps[d].status === 'completed');
                if (!allDone) {
                    step.status = 'blocked';
                    continue;
                }
            }

            // Execute step
            step.status = 'running';
            step.startedAt = new Date().toISOString();
            this.renderKanban();

            // Resolve variables in task
            let task = step.task;
            for (const [key, value] of Object.entries(variables)) {
                task = task.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
            }

            // Add input from previous steps
            if (step.input_from) {
                const deps = Array.isArray(step.input_from) ? step.input_from : [step.input_from];
                const context = deps.map(d => steps[d].output).filter(Boolean).join('\n\n');
                if (context) {
                    task += `\n\nContext from previous steps:\n${context}`;
                }
            }

            // Find agent with matching role
            const agent = this.app.agents.find(a => a.role_id === step.agent_role);
            if (!agent) {
                step.status = 'error';
                step.output = `No agent found with role: ${step.agent_role}`;
                this.app.addLog('error', `Step ${i + 1}: ${step.output}`, 'Workflow');
                continue;
            }

            this.app.addLog('info', `Step ${i + 1}: ${agent.emoji} ${agent.name} - ${task.substring(0, 100)}...`, 'Workflow');

            // Send message to agent
            const result = await this.app.apiPost('/agents/chat', {
                agent_id: agent.id,
                message: task
            });

            if (result && result.response) {
                step.output = result.response;
                step.status = 'completed';
                this.app.addLog('success', `Step ${i + 1} completed by ${agent.name}`, 'Workflow');
            } else {
                step.output = result?.error || 'No response';
                step.status = 'error';
                this.app.addLog('error', `Step ${i + 1} failed: ${step.output}`, 'Workflow');
            }

            step.completedAt = new Date().toISOString();
            this.renderKanban();

            // Small delay between steps
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // ─── Kanban Board Rendering ─────────────────────────────────
    showKanbanModal() {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        content.innerHTML = `
            <div class="modal-header">
                <h2>Workflow Pipelines</h2>
                <button class="btn-close-modal" onclick="adminPanel.closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="workflow-tabs">
                    <button class="tab-btn active" onclick="workflowEngine.showPresets()">Presets</button>
                    <button class="tab-btn" onclick="workflowEngine.showActive()">Active (${this.activeWorkflows.length})</button>
                </div>
                <div id="workflow-content">
                    ${this._renderPresets()}
                </div>
            </div>
        `;

        modal.classList.add('visible');
    }

    showPresets() {
        document.getElementById('workflow-content').innerHTML = this._renderPresets();
    }

    showActive() {
        document.getElementById('workflow-content').innerHTML = this._renderActive();
    }

    _renderPresets() {
        return `
            <div class="workflow-list">
                ${this.workflows.map((wf, i) => `
                    <div class="workflow-card">
                        <h3>${wf.name}</h3>
                        <p>${wf.description}</p>
                        <div class="workflow-steps-preview">
                            ${wf.steps.map((s, j) => `
                                <span class="step-badge">${j + 1}. ${s.agent_role}</span>
                            `).join(' → ')}
                        </div>
                        <button class="btn-action" onclick="workflowEngine.startWorkflow(${i})">▶️ Start</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderActive() {
        if (this.activeWorkflows.length === 0) {
            return '<p class="empty-state">No active workflows</p>';
        }

        return this.activeWorkflows.map(exec => `
            <div class="kanban-board">
                <h3>${exec.workflow.name} <span class="status-badge ${exec.status}">${exec.status}</span></h3>
                <div class="kanban-columns">
                    <div class="kanban-column">
                        <h4>Pending</h4>
                        ${exec.steps.filter(s => s.status === 'pending').map(s => this._renderKanbanCard(s)).join('')}
                    </div>
                    <div class="kanban-column">
                        <h4>Running</h4>
                        ${exec.steps.filter(s => s.status === 'running').map(s => this._renderKanbanCard(s)).join('')}
                    </div>
                    <div class="kanban-column">
                        <h4>Completed</h4>
                        ${exec.steps.filter(s => s.status === 'completed').map(s => this._renderKanbanCard(s)).join('')}
                    </div>
                    <div class="kanban-column">
                        <h4>Error</h4>
                        ${exec.steps.filter(s => s.status === 'error').map(s => this._renderKanbanCard(s)).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    _renderKanbanCard(step) {
        const agent = this.app.agents.find(a => a.role_id === step.agent_role);
        const emoji = agent ? agent.emoji : '🐨';
        return `
            <div class="kanban-card status-${step.status}">
                <span class="card-emoji">${emoji}</span>
                <span class="card-role">${step.agent_role}</span>
                <p class="card-task">${step.task.substring(0, 80)}...</p>
            </div>
        `;
    }

    async startWorkflow(index) {
        const wf = this.workflows[index];
        if (!wf) return;

        // Collect variables
        const variables = {};
        for (const [key, desc] of Object.entries(wf.variables || {})) {
            const value = prompt(`${desc} (${key}):`);
            if (value === null) return; // Cancelled
            variables[key] = value;
        }

        adminPanel.closeModal();
        await this.executeWorkflow(wf, variables);
    }

    renderKanban() {
        // Update active view if modal is open
        const content = document.getElementById('workflow-content');
        if (content && content.querySelector('.kanban-board')) {
            content.innerHTML = this._renderActive();
        }
    }
}

// ─── Agent-to-Agent Communication ───────────────────────────────
class AgentMessageBus {
    constructor(app) {
        this.app = app;
        this.messageQueue = [];
        this.handlers = new Map();
    }

    async delegate(fromAgent, toAgent, task, context) {
        const message = {
            id: Date.now(),
            type: 'delegate',
            from: fromAgent.role_id,
            to: toAgent.role_id,
            task: task,
            context: context,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };

        this.messageQueue.push(message);
        this.app.addLog('info',
            `${fromAgent.emoji} ${fromAgent.name} → ${toAgent.emoji} ${toAgent.name}: ${task.substring(0, 100)}`,
            'MessageBus'
        );

        // Send to target agent
        const result = await this.app.apiPost('/agents/chat', {
            agent_id: toAgent.id,
            message: `[Delegated from ${fromAgent.name}] ${task}\n\nContext: ${context || 'None'}`
        });

        message.status = result?.error ? 'error' : 'completed';
        message.response = result?.response || result?.error;

        return message;
    }

    getHistory() {
        return this.messageQueue;
    }
}

// Global references
let workflowEngine;
let messageBus;

