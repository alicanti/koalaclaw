/**
 * KoalaClaw Pixel Art Living Office — Phaser 3
 *
 * Procedurally generates all assets at runtime (no external PNGs needed).
 * Top-down pixel art office with koala characters, pathfinding, NPC AI.
 */

const TILE = 16;
const MAP_W = 40;
const MAP_H = 30;
const CHAR_SIZE = 16;

// ── Procedural Tileset Generator ────────────────────────

function generateTileset() {
    const cols = 16, rows = 8, size = TILE;
    const canvas = document.createElement('canvas');
    canvas.width = cols * size;
    canvas.height = rows * size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function drawTile(col, row, fn) {
        ctx.save();
        ctx.translate(col * size, row * size);
        fn(ctx, size);
        ctx.restore();
    }

    // 0: empty/black
    drawTile(0, 0, (c, s) => { c.fillStyle = '#0a0a0f'; c.fillRect(0, 0, s, s); });
    // 1: wood floor
    drawTile(1, 0, (c, s) => {
        c.fillStyle = '#2a2520'; c.fillRect(0, 0, s, s);
        c.fillStyle = '#332e28'; c.fillRect(0, 0, s, 7);
        c.fillStyle = '#1e1a16'; c.fillRect(0, 8, s, 1);
    });
    // 2: tile floor (break room)
    drawTile(2, 0, (c, s) => {
        c.fillStyle = '#1e2a2a'; c.fillRect(0, 0, s, s);
        c.strokeStyle = '#2a3838'; c.lineWidth = 1;
        c.strokeRect(0.5, 0.5, s - 1, s - 1);
    });
    // 3: carpet (lounge)
    drawTile(3, 0, (c, s) => {
        c.fillStyle = '#1a2030'; c.fillRect(0, 0, s, s);
        for (let i = 0; i < 4; i++) { c.fillStyle = '#1e2438'; c.fillRect(i * 4, 0, 2, s); }
    });
    // 4: wall
    drawTile(4, 0, (c, s) => {
        c.fillStyle = '#1a1a24'; c.fillRect(0, 0, s, s);
        c.fillStyle = '#222230'; c.fillRect(0, s - 4, s, 4);
        c.fillStyle = '#2a2a38'; c.fillRect(0, s - 2, s, 2);
    });
    // 5: window
    drawTile(5, 0, (c, s) => {
        c.fillStyle = '#1a1a24'; c.fillRect(0, 0, s, s);
        c.fillStyle = '#0a1520'; c.fillRect(2, 2, s - 4, s - 6);
        c.fillStyle = '#1a3040'; c.fillRect(3, 3, s - 6, s - 8);
        c.strokeStyle = '#2a2a38'; c.lineWidth = 1; c.strokeRect(2, 2, s - 4, s - 6);
    });
    // 6: glass partition
    drawTile(6, 0, (c, s) => {
        c.fillStyle = '#0a0a0f'; c.fillRect(0, 0, s, s);
        c.fillStyle = 'rgba(62,207,160,0.15)'; c.fillRect(0, s / 2 - 1, s, 3);
        c.fillStyle = 'rgba(62,207,160,0.08)'; c.fillRect(0, 0, s, s);
    });
    // 7: desk top
    drawTile(7, 0, (c, s) => {
        c.fillStyle = '#3a3020'; c.fillRect(1, 2, s - 2, s - 4);
        c.fillStyle = '#4a4030'; c.fillRect(2, 3, s - 4, s - 6);
        c.fillStyle = '#2a2018'; c.fillRect(1, s - 3, s - 2, 1);
    });
    // 8: chair
    drawTile(0, 1, (c, s) => {
        c.fillStyle = '#2a3028'; c.fillRect(3, 3, s - 6, s - 6);
        c.fillStyle = '#3a4038'; c.fillRect(4, 1, s - 8, 4);
        c.fillStyle = '#1a2018'; c.fillRect(5, s - 4, s - 10, 3);
    });
    // 9: monitor
    drawTile(1, 1, (c, s) => {
        c.fillStyle = '#1a1a1a'; c.fillRect(2, 1, s - 4, s - 6);
        c.fillStyle = '#0a2a20'; c.fillRect(3, 2, s - 6, s - 8);
        c.fillStyle = '#1a1a1a'; c.fillRect(6, s - 4, 4, 2);
        c.fillStyle = '#1a1a1a'; c.fillRect(4, s - 2, 8, 1);
    });
    // 10: coffee machine
    drawTile(2, 1, (c, s) => {
        c.fillStyle = '#3a3a3a'; c.fillRect(3, 2, s - 6, s - 4);
        c.fillStyle = '#2a2a2a'; c.fillRect(4, 3, s - 8, s - 6);
        c.fillStyle = '#ff6030'; c.fillRect(6, 5, 3, 2);
        c.fillStyle = '#4a4a4a'; c.fillRect(3, s - 3, s - 6, 1);
    });
    // 11: couch
    drawTile(3, 1, (c, s) => {
        c.fillStyle = '#2a3548'; c.fillRect(1, 3, s - 2, s - 5);
        c.fillStyle = '#344060'; c.fillRect(2, 4, s - 4, s - 7);
        c.fillStyle = '#1e2838'; c.fillRect(1, 2, 3, s - 4);
        c.fillStyle = '#1e2838'; c.fillRect(s - 4, 2, 3, s - 4);
    });
    // 12: bookshelf
    drawTile(4, 1, (c, s) => {
        c.fillStyle = '#3a2a1a'; c.fillRect(1, 0, s - 2, s);
        c.fillStyle = '#2a1a0a'; c.fillRect(1, 5, s - 2, 1);
        c.fillStyle = '#2a1a0a'; c.fillRect(1, 10, s - 2, 1);
        const colors = ['#4a2020', '#204a20', '#20204a', '#4a4a20', '#4a204a'];
        for (let i = 0; i < 5; i++) { c.fillStyle = colors[i]; c.fillRect(2 + i * 2, 1, 2, 4); }
        for (let i = 0; i < 5; i++) { c.fillStyle = colors[4 - i]; c.fillRect(2 + i * 2, 6, 2, 4); }
    });
    // 13: plant
    drawTile(5, 1, (c, s) => {
        c.fillStyle = '#4a3020'; c.fillRect(5, s - 5, 6, 5);
        c.fillStyle = '#1a5a30'; c.fillRect(4, s - 9, 8, 5);
        c.fillStyle = '#2a7a40'; c.fillRect(5, s - 11, 6, 4);
        c.fillStyle = '#3a8a50'; c.fillRect(6, s - 12, 4, 2);
    });
    // 14: fridge
    drawTile(6, 1, (c, s) => {
        c.fillStyle = '#d0d0d0'; c.fillRect(2, 1, s - 4, s - 2);
        c.fillStyle = '#b0b0b0'; c.fillRect(3, 2, s - 6, 5);
        c.fillStyle = '#b0b0b0'; c.fillRect(3, 8, s - 6, 6);
        c.fillStyle = '#808080'; c.fillRect(s - 5, 4, 1, 3);
        c.fillStyle = '#808080'; c.fillRect(s - 5, 10, 1, 3);
    });
    // 15: vending machine
    drawTile(7, 1, (c, s) => {
        c.fillStyle = '#2a2a4a'; c.fillRect(2, 1, s - 4, s - 2);
        c.fillStyle = '#1a1a3a'; c.fillRect(3, 2, s - 6, s - 5);
        c.fillStyle = '#ff4040'; c.fillRect(4, 3, 3, 2);
        c.fillStyle = '#40ff40'; c.fillRect(8, 3, 3, 2);
        c.fillStyle = '#4040ff'; c.fillRect(4, 6, 3, 2);
    });
    // 16: rug center
    drawTile(0, 2, (c, s) => {
        c.fillStyle = '#2a1830'; c.fillRect(0, 0, s, s);
        c.fillStyle = '#3a2840'; c.fillRect(1, 1, s - 2, s - 2);
    });
    // 17: painting
    drawTile(1, 2, (c, s) => {
        c.fillStyle = '#4a3a1a'; c.fillRect(1, 1, s - 2, s - 2);
        c.fillStyle = '#1a3a5a'; c.fillRect(2, 2, s - 4, 5);
        c.fillStyle = '#3a6a3a'; c.fillRect(2, 7, s - 4, 4);
        c.fillStyle = '#eac040'; c.fillRect(5, 3, 3, 2);
    });
    // 18: clock
    drawTile(2, 2, (c, s) => {
        c.fillStyle = '#e0e0e0'; c.beginPath(); c.arc(s / 2, s / 2, 5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(s / 2, s / 2, 4, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#e0e0e0'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(s / 2, s / 2); c.lineTo(s / 2, s / 2 - 3); c.stroke();
        c.beginPath(); c.moveTo(s / 2, s / 2); c.lineTo(s / 2 + 2, s / 2); c.stroke();
    });
    // 19: server rack
    drawTile(3, 2, (c, s) => {
        c.fillStyle = '#1a1a1a'; c.fillRect(2, 1, s - 4, s - 2);
        for (let i = 0; i < 4; i++) {
            c.fillStyle = '#2a2a2a'; c.fillRect(3, 2 + i * 3, s - 6, 2);
            c.fillStyle = i % 2 === 0 ? '#3ECFA0' : '#ff4040'; c.fillRect(4, 3 + i * 3, 2, 1);
        }
    });
    // 20: water cooler
    drawTile(4, 2, (c, s) => {
        c.fillStyle = '#a0a0a0'; c.fillRect(4, 6, 8, 8);
        c.fillStyle = '#6090c0'; c.fillRect(5, 1, 6, 6);
        c.fillStyle = '#4070a0'; c.fillRect(6, 2, 4, 4);
    });
    // 21: door
    drawTile(5, 2, (c, s) => {
        c.fillStyle = '#3a2a18'; c.fillRect(2, 0, s - 4, s);
        c.fillStyle = '#4a3a28'; c.fillRect(3, 1, s - 6, s - 2);
        c.fillStyle = '#c0a020'; c.fillRect(s - 5, s / 2, 2, 2);
    });
    // 22: manager floor (darker wood)
    drawTile(6, 2, (c, s) => {
        c.fillStyle = '#1e1a15'; c.fillRect(0, 0, s, s);
        c.fillStyle = '#28231c'; c.fillRect(0, 0, s, 7);
        c.fillStyle = '#151210'; c.fillRect(0, 8, s, 1);
    });
    // 23: filing cabinet
    drawTile(7, 2, (c, s) => {
        c.fillStyle = '#808080'; c.fillRect(2, 1, s - 4, s - 2);
        c.fillStyle = '#707070'; c.fillRect(3, 2, s - 6, 4);
        c.fillStyle = '#707070'; c.fillRect(3, 7, s - 6, 4);
        c.fillStyle = '#606060'; c.fillRect(6, 3, 4, 1);
        c.fillStyle = '#606060'; c.fillRect(6, 8, 4, 1);
    });

    return canvas.toDataURL();
}

// ── Procedural Koala Sprite Generator ────────────────────

function generateKoalaSheet(bodyColor, accColor, detail) {
    const frameW = CHAR_SIZE, frameH = CHAR_SIZE;
    const cols = 8, rows = 8;
    const canvas = document.createElement('canvas');
    canvas.width = cols * frameW;
    canvas.height = rows * frameH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    function drawKoala(col, row, opts = {}) {
        const x = col * frameW, y = row * frameH;
        const { facing = 'down', legOffset = 0, armUp = false, sitting = false, sleeping = false } = opts;

        // Body
        ctx.fillStyle = bodyColor;
        if (sleeping) {
            ctx.fillRect(x + 2, y + 8, 12, 6);
            ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 10, y + 9, 2, 1);
            return;
        }
        const bodyY = sitting ? y + 4 : y + 3;
        ctx.fillRect(x + 4, bodyY, 8, 8);

        // Head
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 3, y + (sitting ? 0 : 0), 10, 7);

        // Ears
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 2, y - 1 + (sitting ? 0 : 0), 3, 3);
        ctx.fillRect(x + 11, y - 1 + (sitting ? 0 : 0), 3, 3);
        ctx.fillStyle = '#e8a0a0';
        ctx.fillRect(x + 3, y + (sitting ? 0 : 0), 1, 1);
        ctx.fillRect(x + 12, y + (sitting ? 0 : 0), 1, 1);

        // Eyes
        if (facing !== 'up') {
            ctx.fillStyle = '#1a1a1a';
            if (facing === 'left') {
                ctx.fillRect(x + 4, y + 3, 2, 2);
                ctx.fillRect(x + 8, y + 3, 2, 2);
            } else if (facing === 'right') {
                ctx.fillRect(x + 6, y + 3, 2, 2);
                ctx.fillRect(x + 10, y + 3, 2, 2);
            } else {
                ctx.fillRect(x + 5, y + 3, 2, 2);
                ctx.fillRect(x + 9, y + 3, 2, 2);
            }
        }

        // Nose
        if (facing === 'down') {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(x + 7, y + 5, 2, 1);
        }

        // Clothing
        ctx.fillStyle = accColor;
        ctx.fillRect(x + 5, bodyY + 1, 6, 4);

        // Detail (accessory)
        if (detail && facing === 'down') {
            ctx.fillStyle = detail;
            ctx.fillRect(x + 7, bodyY + 1, 2, 1);
        }

        // Arms
        if (!sitting) {
            ctx.fillStyle = bodyColor;
            if (armUp) {
                ctx.fillRect(x + 2, bodyY - 2, 2, 4);
                ctx.fillRect(x + 12, bodyY - 2, 2, 4);
            } else {
                ctx.fillRect(x + 2, bodyY + 1, 2, 5);
                ctx.fillRect(x + 12, bodyY + 1, 2, 5);
            }
        }

        // Legs
        if (!sitting) {
            ctx.fillStyle = '#2a2a3a';
            ctx.fillRect(x + 5 + legOffset, bodyY + 7, 3, 3);
            ctx.fillRect(x + 9 - legOffset, bodyY + 7, 3, 3);
        }
    }

    // Row 0: idle down (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 0, { facing: 'down', legOffset: i % 2 === 0 ? 0 : 0 });
    // Row 1: walk down (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 1, { facing: 'down', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 2: walk up (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 2, { facing: 'up', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 3: walk left (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 3, { facing: 'left', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 4: walk right (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 4, { facing: 'right', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 5: sit/work (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 5, { facing: 'down', sitting: true });
    // Row 6: sleep (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 6, { sleeping: true });
    // Row 7: celebrate (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 7, { facing: 'down', armUp: i % 2 === 0 });

    return canvas.toDataURL();
}

// ── Role Colors ─────────────────────────────────────────

const ROLE_COLORS = {
    'orchestrator-koala': { body: '#808080', acc: '#2a2a3a', detail: '#3ECFA0' },
    'research-koala':     { body: '#a0a0a0', acc: '#e0e0e0', detail: '#4080c0' },
    'coder-koala':        { body: '#707070', acc: '#2a4a2a', detail: '#40c040' },
    'content-koala':      { body: '#909090', acc: '#3a5a8a', detail: '#80c0ff' },
    'marketer-koala':     { body: '#858585', acc: '#8a3a3a', detail: '#ff8040' },
    'strategy-koala':     { body: '#7a7a7a', acc: '#2a3a5a', detail: '#c0c0ff' },
    'generative-koala':   { body: '#959595', acc: '#6a3a8a', detail: '#c040ff' },
    'design-koala':       { body: '#6a6a6a', acc: '#1a1a1a', detail: '#ff4080' },
    'data-koala':         { body: '#8a8a8a', acc: '#4a4a5a', detail: '#40c0c0' },
    'devops-koala':       { body: '#7a7a70', acc: '#5a3a1a', detail: '#ff8000' },
    'finance-koala':      { body: '#808080', acc: '#3a3a2a', detail: '#ffd700' },
    'security-koala':     { body: '#606060', acc: '#1a1a1a', detail: '#ff2020' },
    'customer-koala':     { body: '#909090', acc: '#2a5a3a', detail: '#3ECFA0' },
    'scheduler-koala':    { body: '#8a7a6a', acc: '#4a3a2a', detail: '#c0a040' },
    'qa-koala':           { body: '#9a9a80', acc: '#6a6a2a', detail: '#e0e040' },
    'translator-koala':   { body: '#858585', acc: '#3a3a5a', detail: '#8080ff' },
    'legal-koala':        { body: '#707070', acc: '#2a2a3a', detail: '#c0c0c0' },
    'hr-koala':           { body: '#909090', acc: '#8a4a6a', detail: '#ff80c0' },
    'sales-koala':        { body: '#808080', acc: '#4a4a5a', detail: '#c0c0c0' },
    'custom-koala':       { body: '#8a8a8a', acc: '#3a3a3a', detail: '#3ECFA0' },
};

// ── Procedural Map Generator ────────────────────────────

function generateMapData() {
    const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
    const collision = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
    const furniture = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));

    function fill(layer, x1, y1, x2, y2, val) {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) layer[y][x] = val;
    }

    // Manager room floor (top area)
    fill(map, 1, 1, MAP_W - 2, 7, 22 + 1); // +1 because Phaser tilemap is 1-indexed
    // Main work area floor
    fill(map, 1, 9, 22, MAP_H - 2, 1 + 1);
    // Break room floor
    fill(map, 24, 9, MAP_W - 2, 18, 2 + 1);
    // Lounge floor
    fill(map, 24, 20, MAP_W - 2, MAP_H - 2, 3 + 1);

    // Walkable areas
    fill(collision, 1, 1, MAP_W - 2, 7, 0);
    fill(collision, 1, 9, 22, MAP_H - 2, 0);
    fill(collision, 24, 9, MAP_W - 2, MAP_H - 2, 0);
    fill(collision, 1, 8, MAP_W - 2, 8, 0);
    fill(collision, 23, 9, 23, MAP_H - 2, 0);
    fill(collision, 24, 19, MAP_W - 2, 19, 0);

    // Walls (top)
    fill(map, 0, 0, MAP_W - 1, 0, 4 + 1);
    fill(map, 0, 0, 0, MAP_H - 1, 4 + 1);
    fill(map, MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, 4 + 1);
    fill(map, 0, MAP_H - 1, MAP_W - 1, MAP_H - 1, 4 + 1);

    // Windows on top wall
    for (let x = 5; x < MAP_W - 5; x += 6) map[0][x] = 5 + 1;

    // Glass partition (manager room divider)
    fill(map, 1, 8, MAP_W - 2, 8, 6 + 1);
    map[8][12] = 21 + 1; // door

    // Wall between work area and break room
    for (let y = 9; y <= MAP_H - 2; y++) map[y][23] = 4 + 1;
    map[14][23] = 21 + 1; // door
    collision[14][23] = 0;

    // Wall between break room and lounge
    fill(map, 24, 19, MAP_W - 2, 19, 4 + 1);
    map[19][30] = 21 + 1; // door
    collision[19][30] = 0;

    // Desk positions (work area)
    const desks = [
        { x: 4, y: 12 }, { x: 10, y: 12 }, { x: 16, y: 12 },
        { x: 4, y: 18 }, { x: 10, y: 18 }, { x: 16, y: 18 },
        { x: 4, y: 24 }, { x: 10, y: 24 },
    ];
    desks.forEach(d => {
        furniture[d.y][d.x] = 7 + 1;
        furniture[d.y][d.x + 1] = 9 + 1;
        furniture[d.y + 1][d.x] = 0 + 1; // chair space
        collision[d.y][d.x] = 1;
        collision[d.y][d.x + 1] = 1;
    });

    // Manager desk
    furniture[4][18] = 7 + 1;
    furniture[4][19] = 9 + 1;
    furniture[4][20] = 7 + 1;
    collision[4][18] = 1; collision[4][19] = 1; collision[4][20] = 1;

    // Break room items
    furniture[11][26] = 10 + 1; collision[11][26] = 1; // coffee machine
    furniture[11][28] = 14 + 1; collision[11][28] = 1; // fridge
    furniture[11][30] = 15 + 1; collision[11][30] = 1; // vending
    furniture[14][26] = 20 + 1; collision[14][26] = 1; // water cooler

    // Lounge items
    furniture[22][26] = 11 + 1; collision[22][26] = 1; // couch
    furniture[22][28] = 11 + 1; collision[22][28] = 1; // couch cont
    furniture[25][32] = 11 + 1; collision[25][32] = 1; // armchair
    furniture[23][30] = 16 + 1; // rug

    // Decorations
    furniture[2][2] = 13 + 1; // plant
    furniture[2][MAP_W - 3] = 13 + 1;
    furniture[15][2] = 12 + 1; collision[15][2] = 1; // bookshelf
    furniture[15][20] = 19 + 1; collision[15][20] = 1; // server rack
    furniture[21][MAP_W - 3] = 13 + 1; // plant in lounge
    furniture[10][32] = 23 + 1; collision[10][32] = 1; // filing cabinet

    // Paintings on walls
    furniture[0][10] = 17 + 1;
    furniture[0][20] = 17 + 1;
    furniture[0][30] = 18 + 1; // clock

    return { map, collision, furniture, desks };
}

// ── Phaser Scenes ───────────────────────────────────────

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
        this.load.image('tiles', generateTileset());

        const agents = window._officeAgents || [];
        const generated = new Set();
        agents.forEach(a => {
            const rc = ROLE_COLORS[a.role_id] || ROLE_COLORS['custom-koala'];
            const key = `koala-${a.role_id || 'default'}`;
            if (!generated.has(key)) {
                this.textures.addBase64(key, generateKoalaSheet(rc.body, rc.acc, rc.detail));
                generated.add(key);
            }
        });
        if (!generated.size) {
            this.textures.addBase64('koala-default', generateKoalaSheet('#8a8a8a', '#3a3a3a', '#3ECFA0'));
        }
    }

    create() {
        this.scene.start('OfficeScene');
    }
}

class OfficeScene extends Phaser.Scene {
    constructor() { super('OfficeScene'); }

    create() {
        const { map, collision, furniture, desks } = generateMapData();

        // Create tilemap from data
        const tilemap = this.make.tilemap({
            data: map,
            tileWidth: TILE,
            tileHeight: TILE,
        });
        const tileset = tilemap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
        const groundLayer = tilemap.createLayer(0, tileset, 0, 0);

        // Furniture layer
        const furnitureMap = this.make.tilemap({ data: furniture, tileWidth: TILE, tileHeight: TILE });
        const furnitureTileset = furnitureMap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
        const furnitureLayer = furnitureMap.createLayer(0, furnitureTileset, 0, 0);

        // Pathfinding
        this.easystar = new EasyStar.js();
        this.easystar.setGrid(collision);
        this.easystar.setAcceptableTiles([0]);
        this.easystar.enableDiagonals();
        this.easystar.enableCornerCutting();

        // Characters
        this.koalas = [];
        const agents = window._officeAgents || [];
        const deskPositions = desks;

        agents.forEach((agent, idx) => {
            const isManager = agent.role_id === 'orchestrator-koala';
            const desk = isManager ? { x: 19, y: 5 } : deskPositions[idx % deskPositions.length];
            if (!desk) return;

            const spriteKey = `koala-${agent.role_id || 'default'}`;
            const texKey = this.textures.exists(spriteKey) ? spriteKey : 'koala-default';

            // Create sprite sheet frames from the texture
            if (!this.anims.exists(`${texKey}-idle`)) {
                const tex = this.textures.get(texKey);
                const fw = CHAR_SIZE, fh = CHAR_SIZE;
                // Generate frame data
                const frameNames = [];
                for (let row = 0; row < 8; row++) {
                    for (let col = 0; col < 4; col++) {
                        const fname = `${texKey}_${row}_${col}`;
                        tex.add(fname, 0, col * fw, row * fh, fw, fh);
                        frameNames.push(fname);
                    }
                }

                this.anims.create({ key: `${texKey}-idle`, frames: frameNames.slice(0, 4).map(f => ({ key: texKey, frame: f })), frameRate: 2, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-down`, frames: frameNames.slice(4, 8).map(f => ({ key: texKey, frame: f })), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-up`, frames: frameNames.slice(8, 12).map(f => ({ key: texKey, frame: f })), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-left`, frames: frameNames.slice(12, 16).map(f => ({ key: texKey, frame: f })), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-right`, frames: frameNames.slice(16, 20).map(f => ({ key: texKey, frame: f })), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-sit`, frames: frameNames.slice(20, 24).map(f => ({ key: texKey, frame: f })), frameRate: 2, repeat: -1 });
                this.anims.create({ key: `${texKey}-sleep`, frames: frameNames.slice(24, 28).map(f => ({ key: texKey, frame: f })), frameRate: 1, repeat: -1 });
                this.anims.create({ key: `${texKey}-celebrate`, frames: frameNames.slice(28, 32).map(f => ({ key: texKey, frame: f })), frameRate: 4, repeat: 3 });
            }

            const sprite = this.add.sprite(desk.x * TILE + TILE / 2, desk.y * TILE + TILE / 2, texKey, `${texKey}_5_0`);
            sprite.setDepth(desk.y);
            sprite.play(`${texKey}-sit`);

            // Name label
            const nameText = this.add.text(desk.x * TILE + TILE / 2, desk.y * TILE - 4, agent.name || `Agent ${agent.id}`, {
                fontSize: '7px',
                fontFamily: 'monospace',
                color: '#f0f0f5',
                backgroundColor: 'rgba(10,10,15,0.7)',
                padding: { x: 2, y: 1 },
            }).setOrigin(0.5, 1).setDepth(100);

            // Status bubble
            const statusText = this.add.text(desk.x * TILE + TILE / 2, desk.y * TILE - 12, '', {
                fontSize: '6px',
                fontFamily: 'monospace',
                color: '#3ECFA0',
                backgroundColor: 'rgba(10,10,15,0.8)',
                padding: { x: 2, y: 1 },
            }).setOrigin(0.5, 1).setDepth(100).setAlpha(0);

            const koala = {
                sprite, nameText, statusText, agent,
                texKey, desk, state: 'sitting',
                path: null, pathIdx: 0,
                breakTimer: Phaser.Math.Between(15000, 45000),
                lastBreak: Date.now(),
            };

            sprite.setInteractive({ useHandCursor: true });
            sprite.on('pointerdown', () => {
                if (window.app) window.app.selectAgent(agent.id);
            });

            this.koalas.push(koala);
        });

        // Ambient particles
        this._addAmbientEffects();

        // Day/night tint overlay
        this.dayNightOverlay = this.add.rectangle(
            MAP_W * TILE / 2, MAP_H * TILE / 2,
            MAP_W * TILE, MAP_H * TILE,
            0x000020, 0
        ).setDepth(200).setBlendMode(Phaser.BlendModes.MULTIPLY);

        this._updateDayNight();
        this.time.addEvent({ delay: 60000, callback: () => this._updateDayNight(), loop: true });

        // NPC behavior timer
        this.time.addEvent({ delay: 1000, callback: () => this._updateNPCBehavior(), loop: true });

        // Camera
        this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
        this.cameras.main.setZoom(2);
        this.cameras.main.centerOn(MAP_W * TILE / 2, MAP_H * TILE / 2);

        // Store collision for pathfinding
        this._collision = collision;
    }

    _addAmbientEffects() {
        // Dust motes
        const dustParticles = this.add.particles(0, 0, 'tiles', {
            frame: '__BASE',
            x: { min: 0, max: MAP_W * TILE },
            y: { min: 0, max: MAP_H * TILE },
            lifespan: 8000,
            speed: { min: 2, max: 8 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.3, end: 0 },
            frequency: 2000,
            blendMode: 'ADD',
        });
        dustParticles.setDepth(150);
    }

    _updateDayNight() {
        const hour = new Date().getHours();
        let alpha = 0;
        if (hour >= 20 || hour < 6) alpha = 0.3;
        else if (hour >= 18) alpha = (hour - 18) * 0.15;
        else if (hour < 8) alpha = (8 - hour) * 0.05;
        this.tweens.add({ targets: this.dayNightOverlay, alpha, duration: 2000 });
    }

    _updateNPCBehavior() {
        const now = Date.now();
        this.koalas.forEach(k => {
            if (k.state === 'walking') return;

            const agentStatus = k.agent.status || 'online';
            const agentState = k.agent.state || 'idle';

            // Reactive behavior from agent status
            if (agentState === 'thinking') {
                this._showStatus(k, 'Thinking...');
                k.sprite.play(`${k.texKey}-sit`);
                return;
            }
            if (agentState === 'talking' || agentState === 'typing') {
                this._showStatus(k, 'Working...');
                k.sprite.play(`${k.texKey}-sit`);
                return;
            }
            if (agentStatus === 'offline' && k.state !== 'sleeping') {
                this._walkTo(k, 27, 23, 'sleeping');
                this._showStatus(k, 'Zzz...');
                return;
            }

            // Autonomous break behavior
            if (now - k.lastBreak > k.breakTimer && k.state === 'sitting') {
                const action = Phaser.Math.Between(0, 10);
                if (action < 3) {
                    this._walkTo(k, 26, 12, 'coffee');
                    this._showStatus(k, 'Coffee break');
                } else if (action < 5) {
                    this._walkTo(k, 27, 23, 'resting');
                    this._showStatus(k, 'Taking a break');
                } else if (action < 7) {
                    const other = this.koalas[Phaser.Math.Between(0, this.koalas.length - 1)];
                    if (other !== k) {
                        this._walkTo(k, other.desk.x, other.desk.y + 2, 'chatting');
                        this._showStatus(k, `Chatting with ${other.agent.name}`);
                    }
                } else {
                    this._walkTo(k, 3, 16, 'browsing');
                    this._showStatus(k, 'Browsing bookshelf');
                }
                k.lastBreak = now;
                k.breakTimer = Phaser.Math.Between(20000, 60000);
            }
        });
    }

    _showStatus(k, text) {
        k.statusText.setText(text);
        this.tweens.add({ targets: k.statusText, alpha: 1, duration: 300 });
        this.time.delayedCall(3000, () => {
            this.tweens.add({ targets: k.statusText, alpha: 0, duration: 500 });
        });
    }

    _walkTo(k, targetX, targetY, nextState) {
        const startX = Math.floor(k.sprite.x / TILE);
        const startY = Math.floor(k.sprite.y / TILE);

        this.easystar.findPath(startX, startY, targetX, targetY, (path) => {
            if (!path || path.length < 2) {
                k.state = nextState === 'coffee' || nextState === 'chatting' || nextState === 'browsing' ? 'sitting' : nextState;
                return;
            }
            k.state = 'walking';
            k.path = path;
            k.pathIdx = 1;
            k._nextState = nextState;
            this._moveAlongPath(k);
        });
        this.easystar.calculate();
    }

    _moveAlongPath(k) {
        if (k.pathIdx >= k.path.length) {
            k.state = k._nextState || 'sitting';
            if (k.state === 'sitting') {
                k.sprite.play(`${k.texKey}-sit`);
                k.sprite.x = k.desk.x * TILE + TILE / 2;
                k.sprite.y = k.desk.y * TILE + TILE / 2;
            } else if (k.state === 'sleeping') {
                k.sprite.play(`${k.texKey}-sleep`);
            } else if (k.state === 'coffee' || k.state === 'chatting' || k.state === 'browsing' || k.state === 'resting') {
                k.sprite.play(`${k.texKey}-idle`);
                this.time.delayedCall(Phaser.Math.Between(3000, 8000), () => {
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            }
            k.nameText.x = k.sprite.x;
            k.nameText.y = k.sprite.y - 4;
            k.statusText.x = k.sprite.x;
            k.statusText.y = k.sprite.y - 12;
            return;
        }

        const next = k.path[k.pathIdx];
        const dx = next.x * TILE + TILE / 2 - k.sprite.x;
        const dy = next.y * TILE + TILE / 2 - k.sprite.y;

        let animKey;
        if (Math.abs(dy) > Math.abs(dx)) {
            animKey = dy > 0 ? `${k.texKey}-walk-down` : `${k.texKey}-walk-up`;
        } else {
            animKey = dx > 0 ? `${k.texKey}-walk-right` : `${k.texKey}-walk-left`;
        }
        k.sprite.play(animKey, true);
        k.sprite.setDepth(next.y);

        this.tweens.add({
            targets: k.sprite,
            x: next.x * TILE + TILE / 2,
            y: next.y * TILE + TILE / 2,
            duration: 200,
            onUpdate: () => {
                k.nameText.x = k.sprite.x;
                k.nameText.y = k.sprite.y - 4;
                k.statusText.x = k.sprite.x;
                k.statusText.y = k.sprite.y - 12;
            },
            onComplete: () => {
                k.pathIdx++;
                this._moveAlongPath(k);
            }
        });
    }

    update(time, delta) {
        // Agent status sync is handled by _updateNPCBehavior timer
    }
}

// ── Game Init ───────────────────────────────────────────

function initOfficeGame(agents) {
    window._officeAgents = agents || [];

    const container = document.getElementById('office-scene');
    if (!container) return;
    container.innerHTML = '';

    if (window._officeGame) {
        window._officeGame.destroy(true);
    }

    window._officeGame = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'office-scene',
        width: container.clientWidth || 800,
        height: container.clientHeight || 600,
        pixelArt: true,
        backgroundColor: '#0a0a0f',
        scene: [BootScene, OfficeScene],
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 0 }, debug: false },
        },
    });
}

function updateOfficeAgents(agents) {
    window._officeAgents = agents || [];
    const scene = window._officeGame?.scene?.getScene('OfficeScene');
    if (scene?.koalas) {
        scene.koalas.forEach(k => {
            const updated = agents.find(a => a.id === k.agent.id);
            if (updated) {
                k.agent.status = updated.status;
                k.agent.state = updated.state;
            }
        });
    }
}
