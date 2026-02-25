/**
 * KoalaClaw Pixel Art Living Office — Phaser 3
 *
 * Procedurally generates all assets at runtime (no external PNGs needed).
 * Top-down pixel art office with koala characters, pathfinding, NPC AI,
 * particle effects, day/night cycle, speech bubbles, weather, decoration editor.
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

    // Row 3: extra decorations for layout editor
    // 24: whiteboard
    drawTile(0, 3, (c, s) => {
        c.fillStyle = '#e0e0e0'; c.fillRect(1, 1, s - 2, s - 3);
        c.fillStyle = '#f5f5f5'; c.fillRect(2, 2, s - 4, s - 5);
        c.fillStyle = '#3a3a3a'; c.fillRect(1, s - 2, s - 2, 2);
        c.fillStyle = '#ff4040'; c.fillRect(3, 3, 4, 1);
        c.fillStyle = '#4040ff'; c.fillRect(3, 5, 6, 1);
        c.fillStyle = '#40a040'; c.fillRect(3, 7, 3, 1);
    });
    // 25: trash can
    drawTile(1, 3, (c, s) => {
        c.fillStyle = '#505050'; c.fillRect(4, 4, 8, 10);
        c.fillStyle = '#606060'; c.fillRect(3, 3, 10, 2);
        c.fillStyle = '#404040'; c.fillRect(5, 5, 6, 8);
    });
    // 26: meeting table
    drawTile(2, 3, (c, s) => {
        c.fillStyle = '#4a3828'; c.fillRect(0, 3, s, s - 6);
        c.fillStyle = '#5a4838'; c.fillRect(1, 4, s - 2, s - 8);
        c.fillStyle = '#3a2818'; c.fillRect(2, s - 3, 3, 3);
        c.fillStyle = '#3a2818'; c.fillRect(s - 5, s - 3, 3, 3);
    });
    // 27: lamp (floor)
    drawTile(3, 3, (c, s) => {
        c.fillStyle = '#3a3a3a'; c.fillRect(6, s - 3, 4, 3);
        c.fillStyle = '#4a4a4a'; c.fillRect(7, 4, 2, s - 7);
        c.fillStyle = '#f0d060'; c.fillRect(4, 1, 8, 4);
        c.fillStyle = '#ffe080'; c.fillRect(5, 2, 6, 2);
    });
    // 28: fire extinguisher
    drawTile(4, 3, (c, s) => {
        c.fillStyle = '#cc2020'; c.fillRect(5, 3, 6, 10);
        c.fillStyle = '#aa1010'; c.fillRect(6, 4, 4, 8);
        c.fillStyle = '#e0e0e0'; c.fillRect(6, 1, 4, 3);
        c.fillStyle = '#808080'; c.fillRect(7, 0, 2, 2);
    });
    // 29: printer
    drawTile(5, 3, (c, s) => {
        c.fillStyle = '#e0e0e0'; c.fillRect(2, 4, s - 4, 8);
        c.fillStyle = '#c0c0c0'; c.fillRect(3, 5, s - 6, 6);
        c.fillStyle = '#f0f0f0'; c.fillRect(4, 2, s - 8, 3);
        c.fillStyle = '#3ECFA0'; c.fillRect(s - 5, 6, 2, 2);
    });
    // 30: bean bag
    drawTile(6, 3, (c, s) => {
        c.fillStyle = '#4a6080'; c.fillRect(2, 4, s - 4, s - 5);
        c.fillStyle = '#5a7090'; c.fillRect(3, 3, s - 6, s - 5);
        c.fillStyle = '#6a80a0'; c.fillRect(4, 5, s - 8, s - 8);
    });
    // 31: standing desk
    drawTile(7, 3, (c, s) => {
        c.fillStyle = '#606060'; c.fillRect(1, 5, 2, s - 5);
        c.fillStyle = '#606060'; c.fillRect(s - 3, 5, 2, s - 5);
        c.fillStyle = '#3a3020'; c.fillRect(0, 3, s, 3);
        c.fillStyle = '#4a4030'; c.fillRect(1, 4, s - 2, 1);
        c.fillStyle = '#1a1a1a'; c.fillRect(3, 1, s - 6, 3);
        c.fillStyle = '#0a2a20'; c.fillRect(4, 2, s - 8, 1);
    });
    // Row 4: more extras
    // 32: ping pong table
    drawTile(0, 4, (c, s) => {
        c.fillStyle = '#1a5a3a'; c.fillRect(1, 2, s - 2, s - 4);
        c.fillStyle = '#2a6a4a'; c.fillRect(2, 3, s - 4, s - 6);
        c.fillStyle = '#e0e0e0'; c.fillRect(s / 2, 2, 1, s - 4);
        c.fillStyle = '#2a2a2a'; c.fillRect(3, s - 2, 3, 2);
        c.fillStyle = '#2a2a2a'; c.fillRect(s - 6, s - 2, 3, 2);
    });
    // 33: coffee cup (small decoration)
    drawTile(1, 4, (c, s) => {
        c.fillStyle = '#e0d0c0'; c.fillRect(5, 6, 6, 6);
        c.fillStyle = '#c0b0a0'; c.fillRect(6, 7, 4, 4);
        c.fillStyle = '#6a4020'; c.fillRect(6, 7, 4, 3);
        c.fillStyle = '#e0d0c0'; c.fillRect(11, 8, 2, 3);
        c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(7, 5, 1, 2);
    });
    // 34: potted cactus
    drawTile(2, 4, (c, s) => {
        c.fillStyle = '#8a5a30'; c.fillRect(4, s - 5, 8, 5);
        c.fillStyle = '#2a8a30'; c.fillRect(6, 2, 4, s - 7);
        c.fillStyle = '#3a9a40'; c.fillRect(3, 5, 3, 4);
        c.fillStyle = '#3a9a40'; c.fillRect(s - 6, 3, 3, 5);
    });
    // 35: trophy case
    drawTile(3, 4, (c, s) => {
        c.fillStyle = '#4a3a1a'; c.fillRect(1, 0, s - 2, s);
        c.fillStyle = '#6a5a3a'; c.fillRect(2, 1, s - 4, s - 2);
        c.fillStyle = '#ffd700'; c.fillRect(4, 3, 3, 4);
        c.fillStyle = '#ffd700'; c.fillRect(5, 2, 1, 1);
        c.fillStyle = '#c0c0c0'; c.fillRect(9, 4, 3, 3);
        c.fillStyle = '#c0c0c0'; c.fillRect(10, 3, 1, 1);
        c.fillStyle = '#cd7f32'; c.fillRect(4, 9, 3, 3);
    });
    // 36: AC unit (wall)
    drawTile(4, 4, (c, s) => {
        c.fillStyle = '#e0e0e0'; c.fillRect(1, 2, s - 2, 8);
        c.fillStyle = '#c0c0c0'; c.fillRect(2, 3, s - 4, 6);
        for (let i = 0; i < 4; i++) { c.fillStyle = '#a0a0a0'; c.fillRect(3, 4 + i * 2, s - 6, 1); }
        c.fillStyle = '#3ECFA0'; c.fillRect(s - 4, 3, 2, 1);
    });
    // 37: umbrella stand
    drawTile(5, 4, (c, s) => {
        c.fillStyle = '#3a3a3a'; c.fillRect(4, 8, 8, 6);
        c.fillStyle = '#4a4a4a'; c.fillRect(5, 9, 6, 4);
        c.fillStyle = '#2060c0'; c.fillRect(6, 2, 2, 7);
        c.fillStyle = '#c02020'; c.fillRect(9, 3, 2, 6);
    });
    // 38: coat rack
    drawTile(6, 4, (c, s) => {
        c.fillStyle = '#5a4a3a'; c.fillRect(7, 4, 2, s - 4);
        c.fillStyle = '#5a4a3a'; c.fillRect(5, s - 2, 6, 2);
        c.fillStyle = '#3a3a5a'; c.fillRect(3, 2, 4, 3);
        c.fillStyle = '#5a3a3a'; c.fillRect(9, 3, 4, 2);
        c.fillStyle = '#5a4a3a'; c.fillRect(4, 1, 8, 2);
    });
    // 39: small table
    drawTile(7, 4, (c, s) => {
        c.fillStyle = '#4a3828'; c.fillRect(3, 4, s - 6, 3);
        c.fillStyle = '#5a4838'; c.fillRect(4, 5, s - 8, 1);
        c.fillStyle = '#3a2818'; c.fillRect(4, 7, 2, s - 7);
        c.fillStyle = '#3a2818'; c.fillRect(s - 6, 7, 2, s - 7);
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
        const { facing = 'down', legOffset = 0, armUp = false, sitting = false, sleeping = false,
                holdingCup = false, waving = false, stretching = false } = opts;

        // Body
        ctx.fillStyle = bodyColor;
        if (sleeping) {
            ctx.fillRect(x + 2, y + 8, 12, 6);
            ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x + 10, y + 9, 2, 1);
            ctx.fillStyle = '#e8a0a0'; ctx.fillRect(x + 3, y + 9, 1, 1);
            return;
        }
        const bodyY = sitting ? y + 4 : y + 3;
        ctx.fillRect(x + 4, bodyY, 8, 8);

        // Head
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 3, y, 10, 7);

        // Ears
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 2, y - 1, 3, 3);
        ctx.fillRect(x + 11, y - 1, 3, 3);
        ctx.fillStyle = '#e8a0a0';
        ctx.fillRect(x + 3, y, 1, 1);
        ctx.fillRect(x + 12, y, 1, 1);

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
            if (armUp || waving) {
                ctx.fillRect(x + 2, bodyY - 2, 2, 4);
                ctx.fillRect(x + 12, bodyY - (waving ? 4 : 2), 2, 4);
            } else if (holdingCup) {
                ctx.fillRect(x + 2, bodyY + 1, 2, 5);
                ctx.fillRect(x + 12, bodyY - 1, 2, 4);
                ctx.fillStyle = '#e0d0c0';
                ctx.fillRect(x + 13, bodyY - 2, 2, 3);
            } else if (stretching) {
                ctx.fillRect(x + 1, bodyY - 3, 2, 3);
                ctx.fillRect(x + 13, bodyY - 3, 2, 3);
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

    // Row 0: idle down (4 frames with subtle breathing)
    for (let i = 0; i < 4; i++) drawKoala(i, 0, { facing: 'down' });
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
    // Row 6: sleep (2 frames) + coffee hold (1 frame) + wave (1 frame)
    drawKoala(0, 6, { sleeping: true });
    drawKoala(1, 6, { sleeping: true });
    drawKoala(2, 6, { facing: 'down', holdingCup: true });
    drawKoala(3, 6, { facing: 'down', waving: true });
    // Row 7: celebrate (2 frames) + stretch (2 frames)
    drawKoala(0, 7, { facing: 'down', armUp: true });
    drawKoala(1, 7, { facing: 'down', armUp: false });
    drawKoala(2, 7, { facing: 'down', stretching: true });
    drawKoala(3, 7, { facing: 'down' });

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

// ── Decoration catalog for the layout editor ────────────

const DECORATION_CATALOG = [
    { id: 'plant', name: 'Plant', tileId: 13, blocking: false },
    { id: 'bookshelf', name: 'Bookshelf', tileId: 12, blocking: true },
    { id: 'couch', name: 'Couch', tileId: 11, blocking: true },
    { id: 'coffeemachine', name: 'Coffee Machine', tileId: 10, blocking: true },
    { id: 'fridge', name: 'Fridge', tileId: 14, blocking: true },
    { id: 'vending', name: 'Vending Machine', tileId: 15, blocking: true },
    { id: 'server', name: 'Server Rack', tileId: 19, blocking: true },
    { id: 'watercooler', name: 'Water Cooler', tileId: 20, blocking: true },
    { id: 'cabinet', name: 'Filing Cabinet', tileId: 23, blocking: true },
    { id: 'whiteboard', name: 'Whiteboard', tileId: 24, blocking: true },
    { id: 'trash', name: 'Trash Can', tileId: 25, blocking: false },
    { id: 'meetingtable', name: 'Meeting Table', tileId: 26, blocking: true },
    { id: 'lamp', name: 'Floor Lamp', tileId: 27, blocking: false },
    { id: 'extinguisher', name: 'Fire Extinguisher', tileId: 28, blocking: false },
    { id: 'printer', name: 'Printer', tileId: 29, blocking: true },
    { id: 'beanbag', name: 'Bean Bag', tileId: 30, blocking: true },
    { id: 'standingdesk', name: 'Standing Desk', tileId: 31, blocking: true },
    { id: 'pingtable', name: 'Ping Pong Table', tileId: 32, blocking: true },
    { id: 'cactus', name: 'Cactus', tileId: 34, blocking: false },
    { id: 'trophy', name: 'Trophy Case', tileId: 35, blocking: true },
    { id: 'acunit', name: 'AC Unit', tileId: 36, blocking: true },
    { id: 'umbrella', name: 'Umbrella Stand', tileId: 37, blocking: false },
    { id: 'coatrack', name: 'Coat Rack', tileId: 38, blocking: false },
    { id: 'smalltable', name: 'Side Table', tileId: 39, blocking: true },
    { id: 'painting', name: 'Painting', tileId: 17, blocking: true },
    { id: 'clock', name: 'Clock', tileId: 18, blocking: true },
    { id: 'rug', name: 'Rug', tileId: 16, blocking: false },
];

// ── Speech bubble messages ──────────────────────────────

const SPEECH_MESSAGES = {
    working: ['Coding...', 'Analyzing...', 'Processing...', 'Building...', 'Debugging...', 'Compiling...', 'Optimizing...', 'Testing...'],
    coffee: ['Need caffeine!', 'Coffee time!', 'Espresso please', 'Latte break'],
    resting: ['*yawn*', 'Quick nap...', 'So comfy...', 'Zzz...'],
    chatting: ['Hey!', 'Nice work!', 'Check this out', 'Great idea!', 'Let\'s sync', 'Any blockers?'],
    browsing: ['Interesting...', 'Good read', 'Taking notes', 'Research time'],
    idle: ['...', 'Hmm...', 'What\'s next?', 'Standing by'],
    celebrate: ['Done!', 'Shipped!', 'Success!', 'Nailed it!'],
    thinking: ['Hmm...', 'Let me think...', 'Processing...', 'Calculating...'],
    error: ['Oops!', 'Bug found!', 'Need help!', 'Error!'],
    stretching: ['*stretch*', 'Getting up...', 'Back in a sec'],
    playing: ['Game on!', 'My serve!', 'Nice shot!'],
};

// ── Weather system data ─────────────────────────────────

const WEATHER_TYPES = ['clear', 'cloudy', 'rain', 'snow', 'storm'];

// ── Procedural Map Generator ────────────────────────────

function generateMapData() {
    const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
    const collision = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
    const furniture = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));

    function fill(layer, x1, y1, x2, y2, val) {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) layer[y][x] = val;
    }

    fill(map, 1, 1, MAP_W - 2, 7, 22 + 1);
    fill(map, 1, 9, 22, MAP_H - 2, 1 + 1);
    fill(map, 24, 9, MAP_W - 2, 18, 2 + 1);
    fill(map, 24, 20, MAP_W - 2, MAP_H - 2, 3 + 1);

    fill(collision, 1, 1, MAP_W - 2, 7, 0);
    fill(collision, 1, 9, 22, MAP_H - 2, 0);
    fill(collision, 24, 9, MAP_W - 2, MAP_H - 2, 0);
    fill(collision, 1, 8, MAP_W - 2, 8, 0);
    fill(collision, 23, 9, 23, MAP_H - 2, 0);
    fill(collision, 24, 19, MAP_W - 2, 19, 0);

    fill(map, 0, 0, MAP_W - 1, 0, 4 + 1);
    fill(map, 0, 0, 0, MAP_H - 1, 4 + 1);
    fill(map, MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, 4 + 1);
    fill(map, 0, MAP_H - 1, MAP_W - 1, MAP_H - 1, 4 + 1);

    for (let x = 5; x < MAP_W - 5; x += 6) map[0][x] = 5 + 1;

    fill(map, 1, 8, MAP_W - 2, 8, 6 + 1);
    map[8][12] = 21 + 1;

    for (let y = 9; y <= MAP_H - 2; y++) map[y][23] = 4 + 1;
    map[14][23] = 21 + 1;
    collision[14][23] = 0;

    fill(map, 24, 19, MAP_W - 2, 19, 4 + 1);
    map[19][30] = 21 + 1;
    collision[19][30] = 0;

    const desks = [
        { x: 4, y: 12 }, { x: 10, y: 12 }, { x: 16, y: 12 },
        { x: 4, y: 18 }, { x: 10, y: 18 }, { x: 16, y: 18 },
        { x: 4, y: 24 }, { x: 10, y: 24 },
    ];
    desks.forEach(d => {
        furniture[d.y][d.x] = 7 + 1;
        furniture[d.y][d.x + 1] = 9 + 1;
        furniture[d.y + 1][d.x] = 0 + 1;
        collision[d.y][d.x] = 1;
        collision[d.y][d.x + 1] = 1;
    });

    furniture[4][18] = 7 + 1;
    furniture[4][19] = 9 + 1;
    furniture[4][20] = 7 + 1;
    collision[4][18] = 1; collision[4][19] = 1; collision[4][20] = 1;

    furniture[11][26] = 10 + 1; collision[11][26] = 1;
    furniture[11][28] = 14 + 1; collision[11][28] = 1;
    furniture[11][30] = 15 + 1; collision[11][30] = 1;
    furniture[14][26] = 20 + 1; collision[14][26] = 1;

    furniture[22][26] = 11 + 1; collision[22][26] = 1;
    furniture[22][28] = 11 + 1; collision[22][28] = 1;
    furniture[25][32] = 11 + 1; collision[25][32] = 1;
    furniture[23][30] = 16 + 1;

    furniture[2][2] = 13 + 1;
    furniture[2][MAP_W - 3] = 13 + 1;
    furniture[15][2] = 12 + 1; collision[15][2] = 1;
    furniture[15][20] = 19 + 1; collision[15][20] = 1;
    furniture[21][MAP_W - 3] = 13 + 1;
    furniture[10][32] = 23 + 1; collision[10][32] = 1;

    furniture[0][10] = 17 + 1;
    furniture[0][20] = 17 + 1;
    furniture[0][30] = 18 + 1;

    // Extra default decorations
    furniture[2][10] = 27 + 1; // lamp in manager room
    furniture[16][2] = 28 + 1; // fire extinguisher
    furniture[10][20] = 29 + 1; collision[10][20] = 1; // printer
    furniture[26][26] = 30 + 1; collision[26][26] = 1; // bean bag
    furniture[27][30] = 39 + 1; collision[27][30] = 1; // side table
    furniture[24][34] = 34 + 1; // cactus
    furniture[2][30] = 35 + 1; collision[2][30] = 1; // trophy case in manager room

    return { map, collision, furniture, desks };
}

// ── Phaser Scenes ───────────────────────────────────────

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
        this.load.image('tiles', generateTileset());

        // Generate particle texture
        const pxCanvas = document.createElement('canvas');
        pxCanvas.width = 4; pxCanvas.height = 4;
        const pxCtx = pxCanvas.getContext('2d');
        pxCtx.fillStyle = '#ffffff';
        pxCtx.fillRect(0, 0, 4, 4);
        this.load.image('particle', pxCanvas.toDataURL());

        // Generate koala spritesheets via load.image (synchronous pipeline)
        const agents = window._officeAgents || [];
        const generated = new Set();
        agents.forEach(a => {
            const rc = ROLE_COLORS[a.role_id] || ROLE_COLORS['custom-koala'];
            const key = `koala-${a.role_id || 'default'}`;
            if (!generated.has(key)) {
                this.load.spritesheet(key, generateKoalaSheet(rc.body, rc.acc, rc.detail), {
                    frameWidth: CHAR_SIZE, frameHeight: CHAR_SIZE
                });
                generated.add(key);
            }
        });
        if (!generated.size) {
            this.load.spritesheet('koala-default', generateKoalaSheet('#8a8a8a', '#3a3a3a', '#3ECFA0'), {
                frameWidth: CHAR_SIZE, frameHeight: CHAR_SIZE
            });
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

        const tilemap = this.make.tilemap({ data: map, tileWidth: TILE, tileHeight: TILE });
        const tileset = tilemap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
        this.groundLayer = tilemap.createLayer(0, tileset, 0, 0);

        const furnitureMap = this.make.tilemap({ data: furniture, tileWidth: TILE, tileHeight: TILE });
        const furnitureTileset = furnitureMap.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0);
        this.furnitureLayer = furnitureMap.createLayer(0, furnitureTileset, 0, 0);

        this._furnitureData = furniture;
        this._collisionData = collision;
        this._deskPositions = desks;

        // Pathfinding
        this.easystar = new EasyStar.js();
        this.easystar.setGrid(collision);
        this.easystar.setAcceptableTiles([0]);
        this.easystar.enableDiagonals();
        this.easystar.enableCornerCutting();

        // Characters
        this.koalas = [];
        const agents = window._officeAgents || [];

        agents.forEach((agent, idx) => {
            const isManager = agent.role_id === 'orchestrator-koala';
            const desk = isManager ? { x: 19, y: 5 } : desks[idx % desks.length];
            if (!desk) return;

            const spriteKey = `koala-${agent.role_id || 'default'}`;
            const texKey = this.textures.exists(spriteKey) ? spriteKey : 'koala-default';

            // Spritesheet loaded via load.spritesheet — frames are auto-numbered
            // Layout: 8 cols x 8 rows. Row*8+Col = frame index
            if (!this.anims.exists(`${texKey}-idle`)) {
                const fr = (row, count) => Array.from({ length: count }, (_, i) => ({ key: texKey, frame: row * 8 + i }));
                this.anims.create({ key: `${texKey}-idle`, frames: fr(0, 4), frameRate: 2, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-down`, frames: fr(1, 4), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-up`, frames: fr(2, 4), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-left`, frames: fr(3, 4), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-walk-right`, frames: fr(4, 4), frameRate: 6, repeat: -1 });
                this.anims.create({ key: `${texKey}-sit`, frames: fr(5, 4), frameRate: 2, repeat: -1 });
                this.anims.create({ key: `${texKey}-sleep`, frames: [{ key: texKey, frame: 6 * 8 + 0 }, { key: texKey, frame: 6 * 8 + 1 }], frameRate: 1, repeat: -1 });
                this.anims.create({ key: `${texKey}-coffee`, frames: [{ key: texKey, frame: 6 * 8 + 2 }], frameRate: 1, repeat: -1 });
                this.anims.create({ key: `${texKey}-wave`, frames: [{ key: texKey, frame: 6 * 8 + 3 }, { key: texKey, frame: 0 }], frameRate: 3, repeat: 3 });
                this.anims.create({ key: `${texKey}-celebrate`, frames: [{ key: texKey, frame: 7 * 8 + 0 }, { key: texKey, frame: 7 * 8 + 1 }], frameRate: 4, repeat: 5 });
                this.anims.create({ key: `${texKey}-stretch`, frames: [{ key: texKey, frame: 7 * 8 + 2 }, { key: texKey, frame: 7 * 8 + 3 }], frameRate: 2, repeat: 2 });
            }

            const sprite = this.add.sprite(desk.x * TILE + TILE / 2, desk.y * TILE + TILE / 2, texKey, 5 * 8 + 0);
            sprite.setDepth(desk.y);
            sprite.play(`${texKey}-sit`);

            // Name label
            const nameText = this.add.text(desk.x * TILE + TILE / 2, desk.y * TILE - 4, agent.name || `Agent ${agent.id}`, {
                fontSize: '7px', fontFamily: 'monospace', color: '#f0f0f5',
                backgroundColor: 'rgba(10,10,15,0.7)', padding: { x: 2, y: 1 },
            }).setOrigin(0.5, 1).setDepth(100);

            // Status indicator dot
            const statusDot = this.add.circle(desk.x * TILE + TILE / 2 + 20, desk.y * TILE - 4, 3, 0x3ECFA0).setDepth(101);

            // Speech bubble container (text that appears above koala)
            const bubbleText = this.add.text(desk.x * TILE + TILE / 2, desk.y * TILE - 16, '', {
                fontSize: '5px', fontFamily: 'monospace', color: '#0a0a0f',
                backgroundColor: '#3ECFA0', padding: { x: 3, y: 2 },
            }).setOrigin(0.5, 1).setDepth(102).setAlpha(0);

            // Thought bubble (smaller, dimmer)
            const thoughtText = this.add.text(desk.x * TILE + TILE / 2, desk.y * TILE - 22, '', {
                fontSize: '4px', fontFamily: 'monospace', color: '#f0f0f5',
                backgroundColor: 'rgba(42,42,56,0.9)', padding: { x: 2, y: 1 },
            }).setOrigin(0.5, 1).setDepth(102).setAlpha(0);

            const koala = {
                sprite, nameText, statusDot, bubbleText, thoughtText, agent,
                texKey, desk, state: 'sitting',
                path: null, pathIdx: 0,
                breakTimer: Phaser.Math.Between(10000, 35000),
                lastBreak: Date.now(),
                lastBubble: 0,
                energy: 100,
                mood: 'happy',
                interactionCooldown: 0,
            };

            sprite.setInteractive({ useHandCursor: true });
            sprite.on('pointerdown', () => {
                if (window.app) window.app.selectAgent(agent.id);
                this._onKoalaClicked(koala);
            });
            sprite.on('pointerover', () => {
                this._showThought(koala, `${agent.role || agent.role_id || 'Agent'} | Energy: ${Math.round(koala.energy)}%`);
            });
            sprite.on('pointerout', () => {
                this.tweens.add({ targets: koala.thoughtText, alpha: 0, duration: 200 });
            });

            this.koalas.push(koala);
        });

        // ── Particle Systems ────────────────────────
        this._setupParticles();

        // ── Day/Night Cycle ─────────────────────────
        this._setupDayNight();

        // ── Weather System ──────────────────────────
        this._setupWeather();

        // ── NPC Behavior ────────────────────────────
        this.time.addEvent({ delay: 800, callback: () => this._updateNPCBehavior(), loop: true });

        // ── Energy/Mood decay ───────────────────────
        this.time.addEvent({ delay: 5000, callback: () => this._updateEnergy(), loop: true });

        // ── Random events ───────────────────────────
        this.time.addEvent({ delay: 30000, callback: () => this._triggerRandomEvent(), loop: true });

        // ── Camera ──────────────────────────────────
        this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
        this.cameras.main.setZoom(2);
        this.cameras.main.centerOn(MAP_W * TILE / 2, MAP_H * TILE / 2);

        // Camera drag
        this.input.on('pointermove', (p) => {
            if (p.isDown && !this._layoutMode) {
                this.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.cameras.main.zoom;
                this.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.cameras.main.zoom;
            }
        });

        // Mouse wheel zoom
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
            const zoom = this.cameras.main.zoom;
            const newZoom = Phaser.Math.Clamp(zoom - deltaY * 0.002, 1, 5);
            this.cameras.main.setZoom(newZoom);
        });

        // ── Layout Mode ─────────────────────────────
        this._layoutMode = false;
        this._layoutSelectedItem = null;
        this._layoutGhost = null;
        this._userDecorations = this._loadDecorations();
        this._applyUserDecorations();

        // ── Monitor glow effects ────────────────────
        this._setupMonitorGlows();

        // ── Ambient sounds visual cues ──────────────
        this._lastClockUpdate = 0;
    }

    // ════════════════════════════════════════════════════════
    //  PARTICLES
    // ════════════════════════════════════════════════════════

    _setupParticles() {
        // Wait for particle texture to be ready
        if (!this.textures.exists('particle')) {
            this.time.delayedCall(500, () => this._setupParticles());
            return;
        }

        // Dust motes floating in the air
        this._dustEmitter = this.add.particles(0, 0, 'particle', {
            x: { min: TILE, max: (MAP_W - 1) * TILE },
            y: { min: TILE, max: (MAP_H - 1) * TILE },
            lifespan: 10000,
            speed: { min: 1, max: 5 },
            angle: { min: 240, max: 300 },
            scale: { start: 0.15, end: 0 },
            alpha: { start: 0.2, end: 0 },
            tint: 0xffeecc,
            frequency: 3000,
            blendMode: 'ADD',
        });
        this._dustEmitter.setDepth(150);

        // Coffee steam particles (near coffee machine)
        this._steamEmitter = this.add.particles(26 * TILE + 8, 11 * TILE, 'particle', {
            lifespan: 2000,
            speed: { min: 3, max: 8 },
            angle: { min: 250, max: 290 },
            scale: { start: 0.2, end: 0 },
            alpha: { start: 0.4, end: 0 },
            tint: 0xcccccc,
            frequency: 1200,
            blendMode: 'ADD',
        });
        this._steamEmitter.setDepth(55);

        // Server rack blinking LED emitter
        this._serverLedEmitter = this.add.particles(15 * TILE + 20 * TILE, 15 * TILE, 'particle', {
            x: { min: -2, max: 2 },
            lifespan: 400,
            speed: 0,
            scale: { start: 0.3, end: 0.1 },
            alpha: { start: 0.8, end: 0 },
            tint: 0x3ECFA0,
            frequency: 2000,
            blendMode: 'ADD',
        });
        this._serverLedEmitter.setDepth(55);
    }

    // ════════════════════════════════════════════════════════
    //  DAY/NIGHT CYCLE
    // ════════════════════════════════════════════════════════

    _setupDayNight() {
        // Ambient lighting overlay
        this.dayNightOverlay = this.add.rectangle(
            MAP_W * TILE / 2, MAP_H * TILE / 2,
            MAP_W * TILE, MAP_H * TILE,
            0x000030, 0
        ).setDepth(200).setBlendMode(Phaser.BlendModes.MULTIPLY);

        // Window light beams (visible during day)
        this._windowLights = [];
        for (let x = 5; x < MAP_W - 5; x += 6) {
            const light = this.add.rectangle(
                x * TILE + TILE / 2, 3 * TILE,
                TILE, 5 * TILE,
                0xfff8e0, 0
            ).setDepth(199).setBlendMode(Phaser.BlendModes.ADD);
            this._windowLights.push(light);
        }

        this._updateDayNight();
        this.time.addEvent({ delay: 30000, callback: () => this._updateDayNight(), loop: true });
    }

    _updateDayNight() {
        const hour = new Date().getHours();
        let nightAlpha = 0;
        let lightAlpha = 0;

        if (hour >= 21 || hour < 5) {
            nightAlpha = 0.35;
            lightAlpha = 0;
        } else if (hour >= 19) {
            nightAlpha = (hour - 19) * 0.175;
            lightAlpha = 0;
        } else if (hour < 7) {
            nightAlpha = (7 - hour) * 0.07;
            lightAlpha = 0;
        } else if (hour >= 7 && hour < 10) {
            lightAlpha = 0.06;
        } else if (hour >= 10 && hour < 16) {
            lightAlpha = 0.1;
        } else {
            lightAlpha = 0.04;
        }

        this.tweens.add({ targets: this.dayNightOverlay, alpha: nightAlpha, duration: 3000 });
        this._windowLights.forEach(l => {
            this.tweens.add({ targets: l, alpha: lightAlpha, duration: 3000 });
        });

        // Tint monitor glows brighter at night
        this.koalas.forEach(k => {
            if (k._monitorGlow) {
                const glowAlpha = nightAlpha > 0.1 ? 0.4 : 0.15;
                this.tweens.add({ targets: k._monitorGlow, alpha: glowAlpha, duration: 2000 });
            }
        });
    }

    // ════════════════════════════════════════════════════════
    //  WEATHER SYSTEM
    // ════════════════════════════════════════════════════════

    _setupWeather() {
        this._currentWeather = 'clear';
        this._rainEmitter = null;
        this._snowEmitter = null;
        this._lightningTimer = null;

        // Change weather periodically
        this.time.addEvent({ delay: 120000, callback: () => this._changeWeather(), loop: true });
        // Start with a random weather after a delay
        this.time.delayedCall(5000, () => this._changeWeather());
    }

    _changeWeather() {
        const weights = { clear: 40, cloudy: 25, rain: 20, snow: 10, storm: 5 };
        const hour = new Date().getHours();
        if (hour >= 21 || hour < 5) { weights.clear += 20; weights.rain -= 5; }

        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        let weather = 'clear';
        for (const [type, w] of Object.entries(weights)) {
            r -= w;
            if (r <= 0) { weather = type; break; }
        }

        this._setWeather(weather);
    }

    _setWeather(type) {
        if (this._currentWeather === type) return;
        this._currentWeather = type;

        // Clean up old weather effects
        if (this._rainEmitter) { this._rainEmitter.stop(); this._rainEmitter.destroy(); this._rainEmitter = null; }
        if (this._snowEmitter) { this._snowEmitter.stop(); this._snowEmitter.destroy(); this._snowEmitter = null; }
        if (this._lightningTimer) { this._lightningTimer.remove(); this._lightningTimer = null; }

        if (!this.textures.exists('particle')) return;

        if (type === 'rain' || type === 'storm') {
            this._rainEmitter = this.add.particles(0, 0, 'particle', {
                x: { min: 0, max: MAP_W * TILE },
                y: -10,
                lifespan: 1500,
                speedY: { min: 80, max: 120 },
                speedX: { min: -10, max: 10 },
                scale: { start: 0.15, end: 0.05 },
                alpha: { start: 0.5, end: 0 },
                tint: 0x6688aa,
                frequency: type === 'storm' ? 30 : 80,
                blendMode: 'ADD',
            });
            this._rainEmitter.setDepth(210);

            // Window tint for rain
            this._windowLights.forEach(l => {
                this.tweens.add({ targets: l, alpha: 0, duration: 1000 });
            });
        }

        if (type === 'storm') {
            this._lightningTimer = this.time.addEvent({
                delay: Phaser.Math.Between(4000, 12000),
                callback: () => this._flashLightning(),
                loop: true
            });
        }

        if (type === 'snow') {
            this._snowEmitter = this.add.particles(0, 0, 'particle', {
                x: { min: 0, max: MAP_W * TILE },
                y: -10,
                lifespan: 4000,
                speedY: { min: 15, max: 30 },
                speedX: { min: -15, max: 15 },
                scale: { start: 0.2, end: 0.1 },
                alpha: { start: 0.7, end: 0 },
                tint: 0xffffff,
                frequency: 200,
                blendMode: 'ADD',
            });
            this._snowEmitter.setDepth(210);
        }

        // Dispatch event for UI
        window.dispatchEvent(new CustomEvent('office-weather', { detail: { weather: type } }));
    }

    _flashLightning() {
        const flash = this.add.rectangle(
            MAP_W * TILE / 2, MAP_H * TILE / 2,
            MAP_W * TILE, MAP_H * TILE,
            0xffffff, 0.6
        ).setDepth(220).setBlendMode(Phaser.BlendModes.ADD);

        this.tweens.add({
            targets: flash, alpha: 0, duration: 200,
            onComplete: () => flash.destroy()
        });

        // Koalas react to lightning
        this.koalas.forEach(k => {
            if (k.state === 'sitting' || k.state === 'idle') {
                if (Math.random() < 0.3) {
                    this._showBubble(k, 'Whoa!');
                }
            }
        });
    }

    // ════════════════════════════════════════════════════════
    //  MONITOR GLOWS
    // ════════════════════════════════════════════════════════

    _setupMonitorGlows() {
        this.koalas.forEach(k => {
            const gx = k.desk.x * TILE + TILE + TILE / 2;
            const gy = k.desk.y * TILE + TILE / 2;
            k._monitorGlow = this.add.rectangle(gx, gy, TILE, TILE, 0x0a3a20, 0.15)
                .setDepth(k.desk.y - 1).setBlendMode(Phaser.BlendModes.ADD);

            // Flicker effect
            this.tweens.add({
                targets: k._monitorGlow,
                alpha: { from: 0.1, to: 0.2 },
                duration: Phaser.Math.Between(2000, 4000),
                yoyo: true, repeat: -1,
                ease: 'Sine.easeInOut'
            });
        });
    }

    // ════════════════════════════════════════════════════════
    //  NPC BEHAVIOR (Enhanced)
    // ════════════════════════════════════════════════════════

    _updateNPCBehavior() {
        const now = Date.now();
        this.koalas.forEach(k => {
            if (k.state === 'walking') return;
            if (k.interactionCooldown > now) return;

            const agentStatus = k.agent.status || 'online';
            const agentState = k.agent.state || 'idle';

            // Update status dot color
            this._updateStatusDot(k, agentStatus, agentState);

            // Reactive behavior from agent status
            if (agentState === 'thinking') {
                if (k.state !== 'thinking') {
                    k.state = 'thinking';
                    k.sprite.play(`${k.texKey}-sit`);
                    this._showBubble(k, this._pickMessage('thinking'));
                }
                return;
            }
            if (agentState === 'talking' || agentState === 'typing') {
                if (k.state !== 'working') {
                    k.state = 'working';
                    k.sprite.play(`${k.texKey}-sit`);
                    this._showBubble(k, this._pickMessage('working'));
                    k.energy = Math.max(k.energy - 0.5, 0);
                }
                return;
            }
            if (agentState === 'error') {
                this._showBubble(k, this._pickMessage('error'));
                k.sprite.play(`${k.texKey}-idle`);
                k.mood = 'frustrated';
                return;
            }
            if (agentStatus === 'offline' && k.state !== 'sleeping') {
                this._walkTo(k, 27, 23, 'sleeping');
                return;
            }

            // Autonomous break behavior based on energy
            if (now - k.lastBreak > k.breakTimer && k.state === 'sitting') {
                const energyThreshold = k.energy < 30;
                const action = Phaser.Math.Between(0, 15);

                if (energyThreshold || action < 2) {
                    // Stretch before getting up
                    k.sprite.play(`${k.texKey}-stretch`);
                    this._showBubble(k, this._pickMessage('stretching'));
                    k.interactionCooldown = now + 3000;
                    this.time.delayedCall(3000, () => {
                        if (k.energy < 20) {
                            this._walkTo(k, 27, 23, 'resting');
                        } else {
                            this._walkTo(k, 26, 12, 'coffee');
                        }
                    });
                } else if (action < 4) {
                    this._walkTo(k, 26, 12, 'coffee');
                    this._showBubble(k, this._pickMessage('coffee'));
                } else if (action < 6) {
                    this._walkTo(k, 27, 23, 'resting');
                    this._showBubble(k, this._pickMessage('resting'));
                } else if (action < 8) {
                    const other = this.koalas[Phaser.Math.Between(0, this.koalas.length - 1)];
                    if (other !== k && other.state !== 'walking' && other.state !== 'sleeping') {
                        this._walkTo(k, other.desk.x, other.desk.y + 2, 'chatting');
                        this._showBubble(k, this._pickMessage('chatting'));
                        this.time.delayedCall(2000, () => {
                            if (other.state === 'sitting') {
                                this._showBubble(other, this._pickMessage('chatting'));
                            }
                        });
                    }
                } else if (action < 10) {
                    this._walkTo(k, 3, 16, 'browsing');
                    this._showBubble(k, this._pickMessage('browsing'));
                } else if (action < 11) {
                    // Water cooler
                    this._walkTo(k, 26, 15, 'coffee');
                } else if (action < 12) {
                    // Vending machine
                    this._walkTo(k, 30, 12, 'coffee');
                } else if (action < 13) {
                    // Celebrate (random)
                    k.sprite.play(`${k.texKey}-celebrate`);
                    this._showBubble(k, this._pickMessage('celebrate'));
                    this._spawnConfetti(k.sprite.x, k.sprite.y);
                    k.interactionCooldown = now + 4000;
                    this.time.delayedCall(4000, () => {
                        k.sprite.play(`${k.texKey}-sit`);
                    });
                } else if (action < 14) {
                    // Wave at someone
                    k.sprite.play(`${k.texKey}-wave`);
                    k.interactionCooldown = now + 2000;
                    this.time.delayedCall(2000, () => {
                        k.sprite.play(`${k.texKey}-sit`);
                    });
                } else {
                    // Just idle briefly
                    k.sprite.play(`${k.texKey}-idle`);
                    k.interactionCooldown = now + 5000;
                    this.time.delayedCall(5000, () => {
                        k.sprite.play(`${k.texKey}-sit`);
                    });
                }

                k.lastBreak = now;
                k.breakTimer = Phaser.Math.Between(12000, 45000);
            }
        });
    }

    _updateStatusDot(k, status, state) {
        if (status === 'offline') {
            k.statusDot.setFillStyle(0xff4d6a);
        } else if (state === 'thinking') {
            k.statusDot.setFillStyle(0xf5a623);
        } else if (state === 'talking' || state === 'typing') {
            k.statusDot.setFillStyle(0x4080ff);
        } else if (state === 'error') {
            k.statusDot.setFillStyle(0xff2020);
        } else {
            k.statusDot.setFillStyle(0x3ECFA0);
        }
    }

    _updateEnergy() {
        this.koalas.forEach(k => {
            if (k.state === 'sleeping' || k.state === 'resting') {
                k.energy = Math.min(k.energy + 8, 100);
            } else if (k.state === 'coffee') {
                k.energy = Math.min(k.energy + 15, 100);
            } else if (k.state === 'working' || k.state === 'thinking') {
                k.energy = Math.max(k.energy - 2, 0);
            } else if (k.state === 'sitting') {
                k.energy = Math.max(k.energy - 0.5, 0);
            }

            // Mood based on energy
            if (k.energy > 70) k.mood = 'happy';
            else if (k.energy > 40) k.mood = 'neutral';
            else if (k.energy > 15) k.mood = 'tired';
            else k.mood = 'exhausted';
        });
    }

    // ════════════════════════════════════════════════════════
    //  RANDOM EVENTS
    // ════════════════════════════════════════════════════════

    _triggerRandomEvent() {
        const event = Phaser.Math.Between(0, 8);
        const activeKoalas = this.koalas.filter(k => k.state !== 'sleeping' && k.state !== 'walking');
        if (!activeKoalas.length) return;

        const k = activeKoalas[Phaser.Math.Between(0, activeKoalas.length - 1)];

        switch (event) {
            case 0: // Someone celebrates
                k.sprite.play(`${k.texKey}-celebrate`);
                this._showBubble(k, this._pickMessage('celebrate'));
                this._spawnConfetti(k.sprite.x, k.sprite.y);
                k.interactionCooldown = Date.now() + 4000;
                this.time.delayedCall(4000, () => {
                    if (k.state !== 'walking') k.sprite.play(`${k.texKey}-sit`);
                });
                break;
            case 1: // Group chat: multiple koalas walk to one spot
                if (activeKoalas.length >= 3) {
                    const meetX = 10, meetY = 16;
                    const chatGroup = activeKoalas.slice(0, 3);
                    chatGroup.forEach((ck, i) => {
                        this.time.delayedCall(i * 1000, () => {
                            this._walkTo(ck, meetX + i, meetY, 'chatting');
                            this._showBubble(ck, 'Meeting time!');
                        });
                    });
                }
                break;
            case 2: // Someone goes to ping pong (if there's space in the lounge area)
                this._walkTo(k, 28, 24, 'playing');
                this._showBubble(k, this._pickMessage('playing'));
                break;
            case 3: // Coffee run for two
                if (activeKoalas.length >= 2) {
                    const buddy = activeKoalas.find(b => b !== k);
                    if (buddy) {
                        this._walkTo(k, 26, 12, 'coffee');
                        this.time.delayedCall(1500, () => {
                            this._walkTo(buddy, 26, 13, 'coffee');
                            this._showBubble(buddy, 'Wait for me!');
                        });
                    }
                }
                break;
            case 4: // Deep focus mode: koala sits still, shows focused bubble
                this._showBubble(k, 'Deep focus...');
                k.interactionCooldown = Date.now() + 20000;
                break;
            default:
                break;
        }
    }

    // ════════════════════════════════════════════════════════
    //  SPEECH BUBBLES
    // ════════════════════════════════════════════════════════

    _showBubble(k, text) {
        const now = Date.now();
        if (now - k.lastBubble < 2000) return;
        k.lastBubble = now;

        k.bubbleText.setText(text);
        k.bubbleText.x = k.sprite.x;
        k.bubbleText.y = k.sprite.y - 16;
        this.tweens.killTweensOf(k.bubbleText);
        k.bubbleText.setAlpha(1);
        this.tweens.add({ targets: k.bubbleText, alpha: 0, duration: 600, delay: 3000 });
    }

    _showThought(k, text) {
        k.thoughtText.setText(text);
        k.thoughtText.x = k.sprite.x;
        k.thoughtText.y = k.sprite.y - 22;
        this.tweens.killTweensOf(k.thoughtText);
        k.thoughtText.setAlpha(1);
    }

    _pickMessage(category) {
        const msgs = SPEECH_MESSAGES[category] || SPEECH_MESSAGES.idle;
        return msgs[Phaser.Math.Between(0, msgs.length - 1)];
    }

    // ════════════════════════════════════════════════════════
    //  CONFETTI / EFFECTS
    // ════════════════════════════════════════════════════════

    _spawnConfetti(x, y) {
        if (!this.textures.exists('particle')) return;
        const colors = [0xff4040, 0x40ff40, 0x4040ff, 0xffff40, 0xff40ff, 0x40ffff, 0x3ECFA0];
        const emitter = this.add.particles(x, y - 10, 'particle', {
            lifespan: 1500,
            speed: { min: 30, max: 80 },
            angle: { min: 210, max: 330 },
            scale: { start: 0.3, end: 0 },
            alpha: { start: 1, end: 0 },
            tint: colors,
            frequency: -1,
            quantity: 20,
            blendMode: 'ADD',
        });
        emitter.setDepth(180);
        emitter.explode(20);
        this.time.delayedCall(2000, () => emitter.destroy());
    }

    _spawnHearts(x, y) {
        if (!this.textures.exists('particle')) return;
        const emitter = this.add.particles(x, y - 10, 'particle', {
            lifespan: 1500,
            speed: { min: 10, max: 30 },
            angle: { min: 240, max: 300 },
            scale: { start: 0.25, end: 0 },
            alpha: { start: 0.9, end: 0 },
            tint: 0xff6080,
            frequency: -1,
            quantity: 5,
            blendMode: 'ADD',
        });
        emitter.setDepth(180);
        emitter.explode(5);
        this.time.delayedCall(2000, () => emitter.destroy());
    }

    // ════════════════════════════════════════════════════════
    //  KOALA CLICK INTERACTION
    // ════════════════════════════════════════════════════════

    _onKoalaClicked(k) {
        this._showBubble(k, 'Hi there!');
        k.sprite.play(`${k.texKey}-wave`);
        this._spawnHearts(k.sprite.x, k.sprite.y);
        k.interactionCooldown = Date.now() + 3000;
        this.time.delayedCall(2000, () => {
            if (k.state === 'sitting' || k.state === 'idle') {
                k.sprite.play(`${k.texKey}-sit`);
            }
        });
    }

    // ════════════════════════════════════════════════════════
    //  MOVEMENT / PATHFINDING
    // ════════════════════════════════════════════════════════

    _walkTo(k, targetX, targetY, nextState) {
        const startX = Math.floor(k.sprite.x / TILE);
        const startY = Math.floor(k.sprite.y / TILE);

        targetX = Phaser.Math.Clamp(targetX, 1, MAP_W - 2);
        targetY = Phaser.Math.Clamp(targetY, 1, MAP_H - 2);

        this.easystar.findPath(startX, startY, targetX, targetY, (path) => {
            if (!path || path.length < 2) {
                k.state = (nextState === 'coffee' || nextState === 'chatting' || nextState === 'browsing' || nextState === 'playing') ? 'sitting' : nextState;
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
                this._showBubble(k, 'Zzz...');
            } else if (k.state === 'coffee') {
                k.sprite.play(`${k.texKey}-coffee`);
                this._showBubble(k, this._pickMessage('coffee'));
                this.time.delayedCall(Phaser.Math.Between(4000, 8000), () => {
                    k.energy = Math.min(k.energy + 20, 100);
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            } else if (k.state === 'chatting') {
                k.sprite.play(`${k.texKey}-idle`);
                this.time.delayedCall(Phaser.Math.Between(4000, 10000), () => {
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            } else if (k.state === 'browsing') {
                k.sprite.play(`${k.texKey}-idle`);
                this._showBubble(k, this._pickMessage('browsing'));
                this.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            } else if (k.state === 'resting') {
                k.sprite.play(`${k.texKey}-sleep`);
                this._showBubble(k, this._pickMessage('resting'));
                this.time.delayedCall(Phaser.Math.Between(6000, 15000), () => {
                    k.energy = Math.min(k.energy + 30, 100);
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            } else if (k.state === 'playing') {
                k.sprite.play(`${k.texKey}-celebrate`);
                this._showBubble(k, this._pickMessage('playing'));
                this.time.delayedCall(Phaser.Math.Between(5000, 10000), () => {
                    k.energy = Math.min(k.energy + 10, 100);
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            } else {
                k.sprite.play(`${k.texKey}-idle`);
                this.time.delayedCall(Phaser.Math.Between(3000, 8000), () => {
                    this._walkTo(k, k.desk.x, k.desk.y + 1, 'sitting');
                });
            }

            this._syncLabels(k);
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
            duration: 180,
            onUpdate: () => this._syncLabels(k),
            onComplete: () => {
                k.pathIdx++;
                this._moveAlongPath(k);
            }
        });
    }

    _syncLabels(k) {
        k.nameText.x = k.sprite.x;
        k.nameText.y = k.sprite.y - 4;
        k.statusDot.x = k.sprite.x + 20;
        k.statusDot.y = k.sprite.y - 4;
        k.bubbleText.x = k.sprite.x;
        k.bubbleText.y = k.sprite.y - 16;
        k.thoughtText.x = k.sprite.x;
        k.thoughtText.y = k.sprite.y - 22;
    }

    // ════════════════════════════════════════════════════════
    //  LAYOUT MODE (Decoration Editor)
    // ════════════════════════════════════════════════════════

    toggleLayoutMode() {
        this._layoutMode = !this._layoutMode;
        if (this._layoutMode) {
            this._showLayoutGrid();
        } else {
            this._hideLayoutGrid();
            this._saveDecorations();
        }
        window.dispatchEvent(new CustomEvent('office-layout-mode', { detail: { active: this._layoutMode } }));
    }

    setLayoutItem(catalogId) {
        this._layoutSelectedItem = DECORATION_CATALOG.find(d => d.id === catalogId) || null;
    }

    _showLayoutGrid() {
        if (this._gridOverlay) return;
        this._gridOverlay = this.add.graphics();
        this._gridOverlay.setDepth(300);
        this._gridOverlay.lineStyle(1, 0x3ECFA0, 0.15);
        for (let x = 0; x <= MAP_W; x++) this._gridOverlay.lineBetween(x * TILE, 0, x * TILE, MAP_H * TILE);
        for (let y = 0; y <= MAP_H; y++) this._gridOverlay.lineBetween(0, y * TILE, MAP_W * TILE, y * TILE);

        // Ghost placement indicator
        this._layoutGhost = this.add.rectangle(0, 0, TILE, TILE, 0x3ECFA0, 0.3).setDepth(301).setVisible(false);

        this.input.on('pointermove', this._onLayoutPointerMove, this);
        this.input.on('pointerdown', this._onLayoutPointerDown, this);
    }

    _hideLayoutGrid() {
        if (this._gridOverlay) { this._gridOverlay.destroy(); this._gridOverlay = null; }
        if (this._layoutGhost) { this._layoutGhost.destroy(); this._layoutGhost = null; }
        this.input.off('pointermove', this._onLayoutPointerMove, this);
        this.input.off('pointerdown', this._onLayoutPointerDown, this);
    }

    _onLayoutPointerMove(pointer) {
        if (!this._layoutMode || !this._layoutGhost) return;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tx = Math.floor(worldPoint.x / TILE);
        const ty = Math.floor(worldPoint.y / TILE);
        if (tx >= 1 && tx < MAP_W - 1 && ty >= 1 && ty < MAP_H - 1) {
            this._layoutGhost.setPosition(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
            this._layoutGhost.setVisible(true);
            const canPlace = this._collisionData[ty][tx] === 0 && this._furnitureData[ty][tx] === 0;
            this._layoutGhost.setFillStyle(canPlace ? 0x3ECFA0 : 0xff4040, 0.3);
        } else {
            this._layoutGhost.setVisible(false);
        }
    }

    _onLayoutPointerDown(pointer) {
        if (!this._layoutMode) return;
        if (pointer.rightButtonDown()) return;

        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const tx = Math.floor(worldPoint.x / TILE);
        const ty = Math.floor(worldPoint.y / TILE);
        if (tx < 1 || tx >= MAP_W - 1 || ty < 1 || ty >= MAP_H - 1) return;

        if (this._layoutSelectedItem) {
            if (this._collisionData[ty][tx] === 0 && this._furnitureData[ty][tx] === 0) {
                this._placeDecoration(tx, ty, this._layoutSelectedItem);
            }
        } else {
            // Remove mode: click on existing furniture to remove
            if (this._furnitureData[ty][tx] > 0) {
                this._removeDecoration(tx, ty);
            }
        }
    }

    _placeDecoration(tx, ty, item) {
        const tileId = item.tileId + 1; // Phaser tilemap is 1-indexed
        this._furnitureData[ty][tx] = tileId;
        if (item.blocking) this._collisionData[ty][tx] = 1;

        // Update the tilemap visually
        this.furnitureLayer.putTileAt(tileId, tx, ty);

        // Update pathfinding
        this.easystar.setGrid(this._collisionData);

        // Track user decoration
        this._userDecorations.push({ x: tx, y: ty, itemId: item.id, tileId: tileId, blocking: item.blocking });

        // Pop effect
        if (this.textures.exists('particle')) {
            const emitter = this.add.particles(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'particle', {
                lifespan: 500, speed: { min: 10, max: 30 },
                scale: { start: 0.2, end: 0 }, alpha: { start: 0.8, end: 0 },
                tint: 0x3ECFA0, frequency: -1, quantity: 8, blendMode: 'ADD',
            });
            emitter.setDepth(180);
            emitter.explode(8);
            this.time.delayedCall(600, () => emitter.destroy());
        }
    }

    _removeDecoration(tx, ty) {
        this._furnitureData[ty][tx] = 0;
        this._collisionData[ty][tx] = 0;
        this.furnitureLayer.putTileAt(0, tx, ty);
        this.easystar.setGrid(this._collisionData);

        this._userDecorations = this._userDecorations.filter(d => d.x !== tx || d.y !== ty);
    }

    _saveDecorations() {
        try {
            localStorage.setItem('koalaclaw_office_decorations', JSON.stringify(this._userDecorations));
        } catch (e) { /* ignore */ }
    }

    _loadDecorations() {
        try {
            const saved = localStorage.getItem('koalaclaw_office_decorations');
            return saved ? JSON.parse(saved) : [];
        } catch (e) { return []; }
    }

    _applyUserDecorations() {
        this._userDecorations.forEach(d => {
            if (d.x >= 1 && d.x < MAP_W - 1 && d.y >= 1 && d.y < MAP_H - 1) {
                this._furnitureData[d.y][d.x] = d.tileId;
                if (d.blocking) this._collisionData[d.y][d.x] = 1;
                this.furnitureLayer.putTileAt(d.tileId, d.x, d.y);
            }
        });
        this.easystar.setGrid(this._collisionData);
    }

    // ════════════════════════════════════════════════════════
    //  UPDATE
    // ════════════════════════════════════════════════════════

    update(time, delta) {
        // Nothing needed per-frame; timers handle behavior
    }
}

// ── Layout Mode UI ──────────────────────────────────────

function _buildLayoutUI() {
    const existing = document.getElementById('layout-editor-panel');
    if (existing) { existing.remove(); return null; }

    const panel = document.createElement('div');
    panel.id = 'layout-editor-panel';
    panel.style.cssText = `
        position: fixed; bottom: 60px; left: 50%; transform: translateX(-50%);
        background: rgba(10,10,15,0.95); border: 1px solid #3ECFA0; border-radius: 8px;
        padding: 12px; display: flex; gap: 8px; align-items: center; z-index: 1000;
        backdrop-filter: blur(8px); max-width: 90vw; overflow-x: auto;
    `;

    // Eraser button
    const eraser = document.createElement('button');
    eraser.textContent = 'Eraser';
    eraser.style.cssText = `
        padding: 6px 12px; background: rgba(255,77,106,0.2); color: #ff4d6a;
        border: 1px solid #ff4d6a; border-radius: 4px; cursor: pointer; font-size: 11px;
        white-space: nowrap;
    `;
    eraser.onclick = () => {
        const scene = window._officeGame?.scene?.getScene('OfficeScene');
        if (scene) scene.setLayoutItem(null);
        panel.querySelectorAll('.layout-item').forEach(i => i.classList.remove('active'));
        eraser.classList.add('active');
    };
    panel.appendChild(eraser);

    // Decoration items
    DECORATION_CATALOG.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'layout-item';
        btn.textContent = item.name;
        btn.title = item.name;
        btn.style.cssText = `
            padding: 6px 10px; background: rgba(62,207,160,0.1); color: #f0f0f5;
            border: 1px solid #2a2a38; border-radius: 4px; cursor: pointer; font-size: 10px;
            white-space: nowrap; transition: all 0.15s;
        `;
        btn.onclick = () => {
            const scene = window._officeGame?.scene?.getScene('OfficeScene');
            if (scene) scene.setLayoutItem(item.id);
            panel.querySelectorAll('.layout-item').forEach(i => i.classList.remove('active'));
            btn.classList.add('active');
            btn.style.borderColor = '#3ECFA0';
            eraser.classList.remove('active');
        };
        panel.appendChild(btn);
    });

    // Close button
    const close = document.createElement('button');
    close.textContent = 'Done';
    close.style.cssText = `
        padding: 6px 14px; background: #3ECFA0; color: #0a0a0f;
        border: none; border-radius: 4px; cursor: pointer; font-size: 11px;
        font-weight: 700; white-space: nowrap; margin-left: 8px;
    `;
    close.onclick = () => {
        const scene = window._officeGame?.scene?.getScene('OfficeScene');
        if (scene) scene.toggleLayoutMode();
        panel.remove();
    };
    panel.appendChild(close);

    document.body.appendChild(panel);
    return panel;
}

// ── Game Init ───────────────────────────────────────────

function initOfficeGame(agents) {
    window._officeAgents = agents || [];

    const container = document.getElementById('office-scene');
    if (!container) return;

    if (window._officeGame) {
        window._officeGame.destroy(true);
        window._officeGame = null;
    }

    // Clear only Phaser canvases, keep overlay UI
    container.querySelectorAll('canvas').forEach(c => c.remove());

    container.style.position = 'relative';

    // Add layout toggle button
    if (!document.getElementById('office-layout-btn')) {
        const layoutBtn = document.createElement('button');
        layoutBtn.id = 'office-layout-btn';
        layoutBtn.title = 'Edit Office Layout';
        layoutBtn.textContent = 'Layout';
        layoutBtn.style.cssText = `
            position: absolute; top: 8px; right: 8px; z-index: 100;
            padding: 6px 14px; background: rgba(10,10,15,0.8); color: #3ECFA0;
            border: 1px solid #3ECFA0; border-radius: 4px; cursor: pointer;
            font-size: 11px; font-weight: 600; backdrop-filter: blur(4px);
            transition: all 0.15s;
        `;
        layoutBtn.onmouseenter = () => { layoutBtn.style.background = 'rgba(62,207,160,0.2)'; };
        layoutBtn.onmouseleave = () => { layoutBtn.style.background = 'rgba(10,10,15,0.8)'; };
        layoutBtn.onclick = () => {
            const scene = window._officeGame?.scene?.getScene('OfficeScene');
            if (scene) {
                scene.toggleLayoutMode();
                _buildLayoutUI();
            }
        };
        container.appendChild(layoutBtn);
    }

    // Weather indicator
    if (!document.getElementById('office-weather-indicator')) {
        const weatherEl = document.createElement('div');
        weatherEl.id = 'office-weather-indicator';
        weatherEl.style.cssText = `
            position: absolute; top: 8px; left: 8px; z-index: 100;
            padding: 4px 10px; background: rgba(10,10,15,0.8); color: #f0f0f5;
            border: 1px solid #2a2a38; border-radius: 4px; font-size: 10px;
            backdrop-filter: blur(4px);
        `;
        weatherEl.textContent = 'Clear';
        container.appendChild(weatherEl);
    }

    if (!window._officeWeatherListener) {
        window._officeWeatherListener = true;
        window.addEventListener('office-weather', (e) => {
            const icons = { clear: 'Clear', cloudy: 'Cloudy', rain: 'Rain', snow: 'Snow', storm: 'Storm' };
            const el = document.getElementById('office-weather-indicator');
            if (el) el.textContent = icons[e.detail.weather] || 'Clear';
        });
    }

    // Ensure container has dimensions (fallback if tab not yet visible)
    const w = container.clientWidth || container.offsetWidth || 800;
    const h = container.clientHeight || container.offsetHeight || 600;

    window._officeGame = new Phaser.Game({
        type: Phaser.CANVAS,
        parent: 'office-scene',
        width: w,
        height: h,
        pixelArt: true,
        backgroundColor: '#0a0a0f',
        scene: [BootScene, OfficeScene],
        scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        render: {
            antialias: false,
            pixelArt: true,
            roundPixels: true,
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
                k.agent.name = updated.name;
            }
        });
    }
}

function triggerAgentCelebration(agentId) {
    const scene = window._officeGame?.scene?.getScene('OfficeScene');
    if (!scene?.koalas) return;
    const k = scene.koalas.find(k => k.agent.id === agentId);
    if (k) {
        k.sprite.play(`${k.texKey}-celebrate`);
        scene._showBubble(k, 'Done!');
        scene._spawnConfetti(k.sprite.x, k.sprite.y);
        scene.time.delayedCall(4000, () => {
            if (k.state !== 'walking') k.sprite.play(`${k.texKey}-sit`);
        });
    }
}
