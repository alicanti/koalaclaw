// Wiro AI model selector modal — list models, generate, show result in chat

(function () {
    const CATEGORIES = ['Image', 'Video', 'Audio', 'LLM'];
    let currentAgent = null;
    let modelsData = { categories: {}, models: [] };

    function getApp() {
        return window.koalaApp || null;
    }

    function apiGet(path) {
        const app = getApp();
        if (app && app.apiGet) return app.apiGet(path);
        const p = path.replace(/^\/api\//, '/');
        return fetch((p.startsWith('/') ? window.location.origin + '/api' : '/api') + (p.startsWith('/') ? p : '/' + p)).then(r => r.json());
    }

    function apiPost(path, body) {
        const app = getApp();
        if (app && app.apiPost) return app.apiPost(path, body);
        const p = path.replace(/^\/api\//, '/');
        const url = (p.startsWith('/') ? window.location.origin + '/api' : '/api') + (p.startsWith('/') ? p : '/' + p);
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

    function sendResultToChat(result) {
        const app = getApp();
        const text = typeof result === 'string' ? result : (result && result.url) ? result.url : (result && result.output) ? result.output : JSON.stringify(result);
        window.dispatchEvent(new CustomEvent('koalaclaw-wiro-result', { detail: { agent: currentAgent, result: text, raw: result } }));
    }

    function renderProgress(modelName) {
        return `
            <div class="chat-wiro-progress wiro-modal-progress">
                <span class="spinner"></span>
                <span>Generating with ${escapeHtml(modelName)}...</span>
            </div>
        `;
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    function renderModal() {
        const cats = CATEGORIES;
        const tabList = cats.map(c => `<button type="button" class="wiro-tab" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
        const searchHtml = `
            <input type="text" id="wiro-search" class="wiro-search" placeholder="Search models...">
        `;
        return `
            <div class="wiro-modal">
                <div class="wiro-modal-header">
                    <h2>✨ Wiro AI — Generate</h2>
                    <button type="button" class="wiro-close" id="wiro-close">×</button>
                </div>
                <div class="wiro-tabs">${tabList}</div>
                ${searchHtml}
                <div id="wiro-progress-area"></div>
                <div class="wiro-model-grid" id="wiro-model-grid">Loading models...</div>
            </div>
        `;
    }

    function renderModelCard(model, category) {
        const name = model.name || model.id || model.title || 'Unnamed';
        const desc = model.description || model.desc || '';
        const id = model.id || name;
        const owner = model.owner || model.owner_id || '';
        const project = model.project || model.project_id || model.id || '';
        const modelKey = owner && project ? `${owner}/${project}` : id;
        return `
            <div class="wiro-card" data-category="${escapeHtml(category)}" data-model="${escapeHtml(modelKey)}">
                <div class="wiro-card-name">${escapeHtml(name)}</div>
                <div class="wiro-card-desc">${escapeHtml(desc)}</div>
                <div class="wiro-card-prompt">
                    <input type="text" class="wiro-prompt-input" placeholder="Prompt..." data-model="${escapeHtml(modelKey)}">
                </div>
                <button type="button" class="wiro-generate-btn" data-model="${escapeHtml(modelKey)}">Generate</button>
            </div>
        `;
    }

    function fillModelGrid(data, category, search) {
        const grid = document.getElementById('wiro-model-grid');
        if (!grid) return;

        if (data.error && data.error !== 'Wiro not configured') {
            grid.innerHTML = `<p class="wiro-error">${escapeHtml(data.error)}</p>`;
            return;
        }
        if (data.error && data.error === 'Wiro not configured') {
            grid.innerHTML = '<p class="wiro-error">Wiro AI is not configured. Add your API key in Settings.</p>';
            return;
        }

        let list = [];
        if (Array.isArray(data.models)) list = data.models;
        else if (Array.isArray(data)) list = data;
        else if (data.categories && category && data.categories[category]) list = data.categories[category];
        else if (data.models && category && data.models[category]) list = data.models[category];

        const s = (search || '').toLowerCase();
        if (s) list = list.filter(m => {
            const n = (m.name || m.id || '').toLowerCase();
            const d = (m.description || m.desc || '').toLowerCase();
            return n.includes(s) || d.includes(s);
        });

        if (list.length === 0) {
            grid.innerHTML = '<p class="wiro-empty">No models in this category.</p>';
            return;
        }
        grid.innerHTML = list.map(m => renderModelCard(m, category)).join('');
    }

    function bindModalEvents() {
        document.getElementById('wiro-close')?.addEventListener('click', closeModal);
        document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') closeModal();
        });

        const grid = document.getElementById('wiro-model-grid');
        if (grid) {
            grid.addEventListener('click', async (e) => {
                const btn = e.target.closest('.wiro-generate-btn');
                if (!btn) return;
                const modelKey = btn.getAttribute('data-model');
                const promptInput = document.querySelector(`.wiro-prompt-input[data-model="${modelKey}"]`);
                const prompt = (promptInput && promptInput.value) ? promptInput.value.trim() : '';
                const [owner, project] = modelKey.includes('/') ? modelKey.split('/', 2) : ['', modelKey];
                if (!owner || !project) return;

                const progressArea = document.getElementById('wiro-progress-area');
                if (progressArea) progressArea.innerHTML = renderProgress(modelKey);
                btn.disabled = true;

                try {
                    const res = await apiPost('/wiro/generate', {
                        owner,
                        project,
                        params: { prompt: prompt || 'Generate' }
                    });
                    if (res.error) throw new Error(res.error);
                    sendResultToChat(res);
                    closeModal();
                } catch (err) {
                    if (progressArea) progressArea.innerHTML = `<p class="wiro-error">${escapeHtml(err.message)}</p>`;
                }
                btn.disabled = false;
            });
        }

        document.querySelectorAll('.wiro-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.wiro-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const cat = tab.getAttribute('data-cat');
                loadCategory(cat);
            });
        });

        const searchEl = document.getElementById('wiro-search');
        if (searchEl) {
            searchEl.addEventListener('input', () => {
                const cat = document.querySelector('.wiro-tab.active')?.getAttribute('data-cat') || CATEGORIES[0];
                loadCategory(cat, searchEl.value.trim());
            });
        }
    }

    async function loadCategory(category, search) {
        const grid = document.getElementById('wiro-model-grid');
        if (grid) grid.innerHTML = 'Loading...';
        try {
            const q = search ? `?category=${encodeURIComponent(category)}` : `?category=${encodeURIComponent(category)}`;
            const data = await apiGet(`/wiro/models${q}`);
            modelsData = data;
            fillModelGrid(data, category, search);
        } catch (e) {
            if (grid) grid.innerHTML = `<p class="wiro-error">${escapeHtml(e.message)}</p>`;
        }
    }

    async function open() {
        currentAgent = null;
        const detail = typeof arguments[0] === 'object' && arguments[0] !== null ? arguments[0] : {};
        if (detail.agent) currentAgent = detail.agent;

        showModal(renderModal());
        document.querySelector('.wiro-tab')?.classList.add('active');
        await loadCategory(CATEGORIES[0]);
        bindModalEvents();
    }

    window.addEventListener('koalaclaw-open-wiro', (e) => open(e.detail));
    window.openWiroModal = open;
})();
