// KoalaClaw Gamification System - Phase 6

class GamificationSystem {
    constructor(app) {
        this.app = app;
        this.agentStats = new Map(); // agentId -> stats
        this.levelTitles = {
            1: 'Junior Koala', 5: 'Junior Koala',
            6: 'Koala Associate', 15: 'Koala Associate',
            16: 'Senior Koala', 30: 'Senior Koala',
            31: 'Koala Expert', 45: 'Koala Expert',
            46: 'Legendary Koala', 50: 'Legendary Koala'
        };
        this.xpPerTask = { easy: 10, medium: 25, hard: 50, epic: 100 };
        this.init();
    }

    init() {
        this.loadStats();
    }

    loadStats() {
        // Load from localStorage
        try {
            const saved = localStorage.getItem('koalaclaw_gamification');
            if (saved) {
                const data = JSON.parse(saved);
                for (const [id, stats] of Object.entries(data)) {
                    this.agentStats.set(parseInt(id), stats);
                }
            }
        } catch (e) {
            console.error('Failed to load gamification stats:', e);
        }
    }

    saveStats() {
        const data = {};
        this.agentStats.forEach((stats, id) => { data[id] = stats; });
        localStorage.setItem('koalaclaw_gamification', JSON.stringify(data));
    }

    getStats(agentId) {
        if (!this.agentStats.has(agentId)) {
            this.agentStats.set(agentId, {
                xp: 0,
                level: 1,
                tasksCompleted: 0,
                achievements: [],
                outfit: 'default',
                deskItems: []
            });
        }
        return this.agentStats.get(agentId);
    }

    // ─── XP & Levels ────────────────────────────────────────────
    addXP(agentId, amount, reason) {
        const stats = this.getStats(agentId);
        stats.xp += amount;
        stats.tasksCompleted++;

        const oldLevel = stats.level;
        stats.level = this.calculateLevel(stats.xp);

        if (stats.level > oldLevel) {
            const agent = this.app.agents.find(a => a.id === agentId);
            const name = agent ? agent.name : `Agent ${agentId}`;
            this.app.addLog('success', `🎉 ${name} leveled up to ${stats.level}! (${this.getLevelTitle(stats.level)})`, 'Gamification');
            this.checkAchievements(agentId);
        }

        this.saveStats();
        return stats;
    }

    calculateLevel(xp) {
        // XP curve: level = floor(sqrt(xp / 50)) + 1, capped at 50
        return Math.min(50, Math.floor(Math.sqrt(xp / 50)) + 1);
    }

    xpForLevel(level) {
        return Math.pow(level - 1, 2) * 50;
    }

    getLevelTitle(level) {
        if (level <= 5) return 'Junior Koala';
        if (level <= 15) return 'Koala Associate';
        if (level <= 30) return 'Senior Koala';
        if (level <= 45) return 'Koala Expert';
        return 'Legendary Koala';
    }

    getLevelColor(level) {
        if (level <= 5) return '#b8b8b8';
        if (level <= 15) return '#00d4ff';
        if (level <= 30) return '#00d4aa';
        if (level <= 45) return '#ffa500';
        return '#ff6b6b';
    }

    // ─── Achievements ───────────────────────────────────────────
    checkAchievements(agentId) {
        const stats = this.getStats(agentId);
        const agent = this.app.agents.find(a => a.id === agentId);
        if (!agent) return;

        const checks = [
            { id: 'first-task', name: 'First Task', condition: stats.tasksCompleted >= 1 },
            { id: 'ten-tasks', name: 'Getting Started', condition: stats.tasksCompleted >= 10 },
            { id: 'fifty-tasks', name: 'Productive', condition: stats.tasksCompleted >= 50 },
            { id: 'hundred-tasks', name: 'Centurion', condition: stats.tasksCompleted >= 100 },
            { id: 'five-hundred', name: 'Marathon Runner', condition: stats.tasksCompleted >= 500 },
            { id: 'thousand', name: 'Legendary', condition: stats.tasksCompleted >= 1000 },
            { id: 'level-5', name: 'Rising Star', condition: stats.level >= 5 },
            { id: 'level-10', name: 'Experienced', condition: stats.level >= 10 },
            { id: 'level-20', name: 'Expert', condition: stats.level >= 20 },
            { id: 'level-30', name: 'Master', condition: stats.level >= 30 },
            { id: 'level-50', name: 'Legendary Koala', condition: stats.level >= 50 },
        ];

        checks.forEach(check => {
            if (check.condition && !stats.achievements.includes(check.id)) {
                stats.achievements.push(check.id);
                this.app.addLog('success', `🏆 ${agent.name} earned: "${check.name}"`, 'Achievement');
            }
        });

        this.saveStats();
    }

    // ─── Outfits & Cosmetics ────────────────────────────────────
    getAvailableOutfits(level) {
        const outfits = [
            { id: 'default', name: 'Default', unlocksAt: 1, icon: '🐨' },
            { id: 'hat', name: 'Top Hat', unlocksAt: 5, icon: '🎩' },
            { id: 'glasses', name: 'Cool Glasses', unlocksAt: 10, icon: '😎' },
            { id: 'cape', name: 'Super Cape', unlocksAt: 15, icon: '🦸' },
            { id: 'crown', name: 'Royal Crown', unlocksAt: 20, icon: '👑' },
            { id: 'wizard', name: 'Wizard Hat', unlocksAt: 25, icon: '🧙' },
            { id: 'ninja', name: 'Ninja Mask', unlocksAt: 30, icon: '🥷' },
            { id: 'astronaut', name: 'Space Suit', unlocksAt: 35, icon: '🧑‍🚀' },
            { id: 'robot', name: 'Robot Armor', unlocksAt: 40, icon: '🤖' },
            { id: 'legendary', name: 'Legendary Aura', unlocksAt: 45, icon: '✨' },
        ];
        return outfits.filter(o => o.unlocksAt <= level);
    }

    getDeskRewards(level) {
        const items = [
            { id: 'plant', name: 'Small Plant', unlocksAt: 1, icon: '🌱' },
            { id: 'trophy', name: 'Trophy', unlocksAt: 5, icon: '🏆' },
            { id: 'lamp', name: 'Desk Lamp', unlocksAt: 8, icon: '💡' },
            { id: 'photo', name: 'Photo Frame', unlocksAt: 10, icon: '🖼️' },
            { id: 'fish', name: 'Fish Tank', unlocksAt: 15, icon: '🐠' },
            { id: 'cactus', name: 'Cactus', unlocksAt: 18, icon: '🌵' },
            { id: 'globe', name: 'Globe', unlocksAt: 20, icon: '🌍' },
            { id: 'cat', name: 'Office Cat', unlocksAt: 25, icon: '🐱' },
            { id: 'crystal', name: 'Crystal Ball', unlocksAt: 30, icon: '🔮' },
            { id: 'rocket', name: 'Rocket Model', unlocksAt: 35, icon: '🚀' },
        ];
        return items.filter(i => i.unlocksAt <= level);
    }

    // ─── Leaderboard ────────────────────────────────────────────
    getLeaderboard() {
        const entries = [];
        this.app.agents.forEach(agent => {
            const stats = this.getStats(agent.id);
            entries.push({
                agent,
                ...stats
            });
        });
        return entries.sort((a, b) => b.xp - a.xp);
    }

    // ─── UI Rendering ───────────────────────────────────────────
    showGamificationModal() {
        const modal = document.getElementById('modal-overlay');
        const content = document.getElementById('modal-content');

        content.innerHTML = `
            <div class="modal-header">
                <h2>🎮 Gamification</h2>
                <button class="btn-close-modal" onclick="adminPanel.closeModal()">✕</button>
            </div>
            <div class="modal-body">
                <div class="gam-tabs">
                    <button class="tab-btn active" onclick="gamification.showLeaderboardTab()">🏆 Leaderboard</button>
                    <button class="tab-btn" onclick="gamification.showAchievementsTab()">🎖️ Achievements</button>
                    <button class="tab-btn" onclick="gamification.showCosmeticsTab()">👔 Cosmetics</button>
                </div>
                <div id="gam-content">
                    ${this._renderLeaderboard()}
                </div>
            </div>
        `;

        modal.classList.add('visible');
    }

    showLeaderboardTab() {
        document.getElementById('gam-content').innerHTML = this._renderLeaderboard();
    }

    showAchievementsTab() {
        document.getElementById('gam-content').innerHTML = this._renderAchievements();
    }

    showCosmeticsTab() {
        document.getElementById('gam-content').innerHTML = this._renderCosmetics();
    }

    _renderLeaderboard() {
        const leaderboard = this.getLeaderboard();

        return `
            <div class="leaderboard">
                ${leaderboard.map((entry, i) => {
                    const xpNext = this.xpForLevel(entry.level + 1);
                    const xpCurrent = this.xpForLevel(entry.level);
                    const progress = xpNext > xpCurrent ? ((entry.xp - xpCurrent) / (xpNext - xpCurrent)) * 100 : 100;

                    return `
                        <div class="leaderboard-entry ${i === 0 ? 'first' : ''}">
                            <span class="lb-rank">#${i + 1}</span>
                            <span class="lb-emoji">${entry.agent.emoji}</span>
                            <div class="lb-info">
                                <span class="lb-name">${entry.agent.name}</span>
                                <span class="lb-title" style="color: ${this.getLevelColor(entry.level)}">${this.getLevelTitle(entry.level)}</span>
                            </div>
                            <div class="lb-stats">
                                <div class="lb-level">Lv.${entry.level}</div>
                                <div class="lb-xp-bar">
                                    <div class="lb-xp-fill" style="width: ${progress}%; background: ${this.getLevelColor(entry.level)}"></div>
                                </div>
                                <div class="lb-xp">${entry.xp} XP</div>
                            </div>
                            <span class="lb-tasks">${entry.tasksCompleted} tasks</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    _renderAchievements() {
        const allAchievements = [
            { id: 'first-task', name: 'First Task', desc: 'Complete your first task', icon: '⭐' },
            { id: 'ten-tasks', name: 'Getting Started', desc: 'Complete 10 tasks', icon: '🌟' },
            { id: 'fifty-tasks', name: 'Productive', desc: 'Complete 50 tasks', icon: '💫' },
            { id: 'hundred-tasks', name: 'Centurion', desc: 'Complete 100 tasks', icon: '🏅' },
            { id: 'five-hundred', name: 'Marathon Runner', desc: 'Complete 500 tasks', icon: '🏆' },
            { id: 'thousand', name: 'Legendary', desc: 'Complete 1000 tasks', icon: '👑' },
            { id: 'level-5', name: 'Rising Star', desc: 'Reach level 5', icon: '⭐' },
            { id: 'level-10', name: 'Experienced', desc: 'Reach level 10', icon: '🌟' },
            { id: 'level-20', name: 'Expert', desc: 'Reach level 20', icon: '💫' },
            { id: 'level-30', name: 'Master', desc: 'Reach level 30', icon: '🏅' },
            { id: 'level-50', name: 'Legendary Koala', desc: 'Reach level 50', icon: '👑' },
        ];

        return `
            <div class="achievements-grid">
                ${allAchievements.map(ach => {
                    const earned = this.app.agents.some(a => {
                        const stats = this.getStats(a.id);
                        return stats.achievements.includes(ach.id);
                    });
                    return `
                        <div class="achievement-card ${earned ? 'earned' : 'locked'}">
                            <span class="ach-icon">${ach.icon}</span>
                            <span class="ach-name">${ach.name}</span>
                            <span class="ach-desc">${ach.desc}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    _renderCosmetics() {
        return `
            <div class="cosmetics-section">
                <h3>Outfits</h3>
                <div class="cosmetics-grid">
                    ${this.getAvailableOutfits(50).map(outfit => `
                        <div class="cosmetic-card">
                            <span class="cosmetic-icon">${outfit.icon}</span>
                            <span class="cosmetic-name">${outfit.name}</span>
                            <span class="cosmetic-unlock">Unlocks at Lv.${outfit.unlocksAt}</span>
                        </div>
                    `).join('')}
                </div>

                <h3>Desk Items</h3>
                <div class="cosmetics-grid">
                    ${this.getDeskRewards(50).map(item => `
                        <div class="cosmetic-card">
                            <span class="cosmetic-icon">${item.icon}</span>
                            <span class="cosmetic-name">${item.name}</span>
                            <span class="cosmetic-unlock">Unlocks at Lv.${item.unlocksAt}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// Global reference
let gamification;

