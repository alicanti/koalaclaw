/**
 * Procedural pixel koala colors (one per agent index).
 */
const PIXEL_KOALA_COLORS = ['#7dd3fc', '#a78bfa', '#86efac', '#fcd34d', '#f472b6', '#94a3b8', '#22d3ee', '#c084fc'];

/**
 * PixelCharacter: position, state, frame index, frame timer, color.
 */
class PixelCharacter {
    constructor(agentId, color) {
        this.agentId = agentId;
        this.x = 0;
        this.y = 0;
        this.state = 'idle';
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.color = color;
        this.walkTarget = null;
        this.walkProgress = 0;
    }
}

/**
 * OfficeAnimator: transparent Canvas overlay on the office DOM scene.
 * Render loop via requestAnimationFrame, pixel-perfect (imageSmoothingEnabled = false).
 * Draws particles, sprite characters, and effects (see mc-ambient).
 */
class OfficeAnimator {
    constructor(containerEl, options = {}) {
        this.container = containerEl;
        this.canvas = null;
        this.ctx = null;
        this.rafId = null;
        this.running = false;
        this.width = 0;
        this.height = 0;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        this.agents = options.agents || [];
        this.characters = [];
        this.particles = [];
        this.dust = [];
        this.steam = [];
        this.sparkles = [];
        this.lastDeskQuery = 0;
        this.initDust();
        this.init();
    }

    initDust() {
        for (let i = 0; i < 18; i++) {
            this.dust.push({
                x: Math.random() * 1000,
                y: Math.random() * 600,
                vx: (Math.random() - 0.5) * 0.3,
                vy: -0.2 - Math.random() * 0.3,
                size: 1 + Math.random() * 1.5,
                opacity: 0.15 + Math.random() * 0.2
            });
        }
    }

    init() {
        if (!this.container) return;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'office-canvas-overlay';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.imageSmoothingQuality = 'low';
        }
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.start();
    }

    resize() {
        if (!this.canvas || !this.container) return;
        const rect = this.container.getBoundingClientRect();
        const w = Math.floor(rect.width);
        const h = Math.floor(rect.height);
        if (w === this.width && h === this.height) return;
        this.width = w;
        this.height = h;
        this.canvas.width = w * this.pixelRatio;
        this.canvas.height = h * this.pixelRatio;
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        if (this.ctx) {
            this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
            this.ctx.imageSmoothingEnabled = false;
        }
    }

    start() {
        this.running = true;
        const loop = () => {
            if (!this.running) return;
            this.rafId = requestAnimationFrame(loop);
            this.render();
        };
        loop();
    }

    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    render() {
        if (!this.ctx || this.width <= 0 || this.height <= 0) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);
        // Layer order: particles (back), then characters, then effects (front)
        this.renderParticles(ctx);
        this.renderCharacters(ctx);
        this.renderEffects(ctx);
    }

    renderParticles(ctx) {
        const w = this.width;
        const h = this.height;

        // Dust motes
        this.dust.forEach(d => {
            d.x += d.vx;
            d.y += d.vy;
            if (d.x < 0 || d.x > w) d.vx *= -1;
            if (d.y < 0 || d.y > h) d.vy *= -1;
            d.x = Math.max(0, Math.min(w, d.x));
            d.y = Math.max(0, Math.min(h, d.y));
            ctx.fillStyle = `rgba(255,255,255,${d.opacity})`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // Coffee steam above desks
        const positions = this.getDeskPositions();
        positions.forEach((pos, i) => {
            if (this.steam.length <= i) this.steam[i] = [];
            const steamParticles = this.steam[i];
            if (steamParticles.length < 5 && Math.random() < 0.02) {
                steamParticles.push({
                    x: pos.x + (Math.random() - 0.5) * 16,
                    y: pos.y - 10,
                    life: 1,
                    vy: -0.4
                });
            }
            for (let j = steamParticles.length - 1; j >= 0; j--) {
                const s = steamParticles[j];
                s.y += s.vy;
                s.life -= 0.015;
                if (s.life <= 0) { steamParticles.splice(j, 1); continue; }
                ctx.fillStyle = `rgba(200,220,255,${s.life * 0.25})`;
                ctx.beginPath();
                ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // Thinking sparkles (when any character is thinking)
        const thinkingChars = this.characters.filter(c => c.state === 'thinking');
        if (thinkingChars.length > 0 && this.sparkles.length < 8) {
            const ch = thinkingChars[Math.floor(Math.random() * thinkingChars.length)];
            this.sparkles.push({ x: ch.x + (Math.random() - 0.5) * 20, y: ch.y - 15, life: 1, vx: (Math.random() - 0.5) * 2, vy: -1.5 });
        }
        for (let j = this.sparkles.length - 1; j >= 0; j--) {
            const s = this.sparkles[j];
            s.x += s.vx;
            s.y += s.vy;
            s.life -= 0.04;
            if (s.life <= 0) { this.sparkles.splice(j, 1); continue; }
            ctx.fillStyle = `rgba(255,230,150,${s.life})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    getDeskPositions() {
        const containerRect = this.container.getBoundingClientRect();
        const positions = [];
        this.container.querySelectorAll('.desk-unit[data-agent-id]').forEach(desk => {
            const id = parseInt(desk.dataset.agentId, 10);
            if (isNaN(id)) return;
            const r = desk.getBoundingClientRect();
            const x = r.left - containerRect.left + (r.width / 2);
            const y = r.top - containerRect.top + (r.height / 2) - 20;
            positions.push({ agentId: id, x, y });
        });
        return positions;
    }

    updateCharacters() {
        const positions = this.getDeskPositions();
        const agentsById = {};
        (this.agents || []).forEach(a => { agentsById[a.id] = a; });
        positions.forEach((pos, idx) => {
            let ch = this.characters.find(c => c.agentId === pos.agentId);
            if (!ch) {
                ch = new PixelCharacter(pos.agentId, PIXEL_KOALA_COLORS[idx % PIXEL_KOALA_COLORS.length]);
                this.characters.push(ch);
            }
            const agent = agentsById[pos.agentId];
            ch.x = pos.x;
            ch.y = pos.y;
            ch.state = (agent && agent.state) ? agent.state : 'idle';
            ch.frameTimer++;
            const frameRates = { idle: 12, typing: 6, thinking: 8, talking: 8, walking: 4, sleeping: 20, error: 10 };
            const frameCounts = { idle: 4, typing: 4, thinking: 3, talking: 4, walking: 6, sleeping: 2, error: 2 };
            const rate = frameRates[ch.state] || 12;
            const count = frameCounts[ch.state] || 4;
            if (ch.frameTimer >= rate) {
                ch.frameTimer = 0;
                ch.frameIndex = (ch.frameIndex + 1) % count;
            }
        });
        this.characters = this.characters.filter(c => positions.some(p => p.agentId === c.agentId));
    }

    drawPixelKoala(ctx, x, y, state, frameIndex, color) {
        const scale = 2;
        const bounce = state === 'idle' || state === 'typing' || state === 'talking'
            ? Math.sin(frameIndex * Math.PI / 2) * 2 : 0;
        const shake = state === 'thinking' ? (frameIndex === 1 ? 2 : frameIndex === 2 ? -2 : 0) : 0;
        const ox = x + (state === 'thinking' ? shake : 0);
        const oy = y + bounce + (state === 'thinking' ? 0 : shake);
        const px = (i, j) => {
            ctx.fillRect(ox + i * scale, oy + j * scale, scale, scale);
        };
        ctx.fillStyle = color;
        px(2, 0); px(3, 0);
        px(1, 1); px(2, 1); px(3, 1); px(4, 1);
        px(0, 2); px(1, 2); px(2, 2); px(3, 2); px(4, 2); px(5, 2);
        px(1, 3); px(2, 3); px(3, 3); px(4, 3);
        px(2, 4); px(3, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        px(2, 1); px(3, 2);
    }

    renderCharacters(ctx) {
        this.updateCharacters();
        this.characters.forEach(ch => {
            this.drawPixelKoala(ctx, ch.x - 6, ch.y - 6, ch.state, ch.frameIndex, ch.color);
        });
    }

    renderEffects(ctx) {
        const w = this.width;
        const h = this.height;
        const hour = new Date().getHours();
        const isNight = hour >= 20 || hour < 6;

        // Screen glow behind active monitors (soft radial at desk centers)
        const positions = this.getDeskPositions();
        const agentsById = {};
        (this.agents || []).forEach(a => { agentsById[a.id] = a; });
        positions.forEach(pos => {
            const agent = agentsById[pos.agentId];
            if (agent && agent.status === 'online') {
                const g = ctx.createRadialGradient(pos.x, pos.y - 25, 0, pos.x, pos.y - 25, 45);
                g.addColorStop(0, 'rgba(45,212,168,0.08)');
                g.addColorStop(1, 'rgba(45,212,168,0)');
                ctx.fillStyle = g;
                ctx.fillRect(pos.x - 50, pos.y - 70, 100, 70);
            }
        });

        // Day/night tint overlay
        const tint = isNight
            ? 'rgba(20,25,80,0.15)'
            : 'rgba(255,240,200,0.06)';
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, w, h);
    }

    /** Call when office re-renders with new agents (e.g. desk positions) */
    setAgents(agents) {
        this.agents = agents || [];
    }

    destroy() {
        this.stop();
        if (this.canvas && this.container && this.canvas.parentNode === this.container) {
            this.container.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
    }
}
