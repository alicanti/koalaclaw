/**
 * KoalaClaw Pixel Art Living Office — Phaser 3
 *
 * Procedurally generates all assets at runtime (no external PNGs needed).
 * Top-down pixel art office with koala characters, pathfinding, NPC AI,
 * particle effects, day/night cycle, speech bubbles, weather, decoration editor.
 */

const TILE = 32;
const MAP_W = 24;
const MAP_H = 18;
const CHAR_SIZE = 32;

// ── Assets loaded from pre-generated PNGs (ui/assets/) ──
// To regenerate: cd tools && npm install && npm run generate
//
// Tileset: 16 cols x 4 rows of 32x32 tiles
// Koalas:  8 cols x 8 rows of 32x32 frames per role
// Particle: 8x8 soft glow

/*--- REMOVED: generateTileset() and generateKoalaSheet() ---
 * These functions have been replaced by build-time PNG generation.
 * See tools/generate-assets.js for the source.
 *--- END REMOVED ---*/

// Stub kept so old references don't crash
function generateTileset() { return 'assets/tileset.png'; }
function generateKoalaSheet() { return 'assets/koala-default.png'; }

/* Procedural drawing code removed — see tools/generate-assets.js
   ~400 lines of tileset + koala sprite generation deleted.
   Assets are now pre-built PNGs in ui/assets/ */

/*
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

    const S = size;

    // 0: empty/black
    drawTile(0, 0, (c) => { c.fillStyle = '#0d1117'; c.fillRect(0, 0, S, S); });

    // 1: wood floor — warm planks
    drawTile(1, 0, (c) => {
        c.fillStyle = '#3d3225'; c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            c.fillStyle = y % 16 === 0 ? '#453a2c' : '#352c20';
            c.fillRect(0, y, S, 7);
            c.fillStyle = '#2a2218'; c.fillRect(0, y + 7, S, 1);
        }
        c.fillStyle = 'rgba(255,240,200,0.03)'; c.fillRect(0, 0, S, S);
    });

    // 2: tile floor (break room) — clean tiles
    drawTile(2, 0, (c) => {
        c.fillStyle = '#2a3535'; c.fillRect(0, 0, S, S);
        c.strokeStyle = '#354545'; c.lineWidth = 1;
        c.strokeRect(1, 1, S / 2 - 1, S / 2 - 1);
        c.strokeRect(S / 2, 1, S / 2 - 1, S / 2 - 1);
        c.strokeRect(1, S / 2, S / 2 - 1, S / 2 - 1);
        c.strokeRect(S / 2, S / 2, S / 2 - 1, S / 2 - 1);
    });

    // 3: carpet (lounge) — soft pattern
    drawTile(3, 0, (c) => {
        c.fillStyle = '#1e2840'; c.fillRect(0, 0, S, S);
        for (let i = 0; i < S; i += 4) {
            c.fillStyle = i % 8 === 0 ? '#222e48' : '#1a2438';
            c.fillRect(i, 0, 3, S);
        }
    });

    // 4: wall — dark with baseboard
    drawTile(4, 0, (c) => {
        c.fillStyle = '#1c1c28'; c.fillRect(0, 0, S, S);
        c.fillStyle = '#242434'; c.fillRect(0, S - 8, S, 8);
        c.fillStyle = '#2e2e40'; c.fillRect(0, S - 3, S, 3);
        c.fillStyle = '#181824'; c.fillRect(0, 0, S, 2);
    });

    // 5: window — glass with frame
    drawTile(5, 0, (c) => {
        c.fillStyle = '#1c1c28'; c.fillRect(0, 0, S, S);
        c.fillStyle = '#0c1a28'; c.fillRect(4, 3, S - 8, S - 10);
        c.fillStyle = '#142838'; c.fillRect(5, 4, S - 10, S - 12);
        c.fillStyle = '#1c3848'; c.fillRect(6, 5, S - 12, S - 14);
        c.strokeStyle = '#2e2e40'; c.lineWidth = 2; c.strokeRect(4, 3, S - 8, S - 10);
        c.fillStyle = '#2e2e40'; c.fillRect(S / 2 - 1, 3, 2, S - 10);
    });

    // 6: glass partition
    drawTile(6, 0, (c) => {
        c.fillStyle = '#0d1117'; c.fillRect(0, 0, S, S);
        c.fillStyle = 'rgba(62,207,160,0.12)'; c.fillRect(0, 0, S, S);
        c.fillStyle = 'rgba(62,207,160,0.25)'; c.fillRect(0, S / 2 - 2, S, 4);
        c.fillStyle = '#2a2a38'; c.fillRect(0, S / 2 - 1, S, 1);
    });

    // 7: desk
    drawTile(7, 0, (c) => {
        c.fillStyle = '#4a3c28'; c.fillRect(2, 4, S - 4, S - 8);
        c.fillStyle = '#5a4c38'; c.fillRect(3, 5, S - 6, S - 10);
        c.fillStyle = '#3a2e1c'; c.fillRect(2, S - 5, S - 4, 2);
        c.fillStyle = '#3a2e1c'; c.fillRect(4, S - 4, 3, 4);
        c.fillStyle = '#3a2e1c'; c.fillRect(S - 7, S - 4, 3, 4);
    });

    // 8: monitor on desk
    drawTile(0, 1, (c) => {
        c.fillStyle = '#1a1a22'; c.fillRect(6, 2, S - 12, S - 12);
        c.fillStyle = '#0a2820'; c.fillRect(7, 3, S - 14, S - 14);
        c.fillStyle = '#0e3828'; c.fillRect(8, 4, S - 16, S - 16);
        c.fillStyle = '#1a1a22'; c.fillRect(S / 2 - 2, S - 10, 4, 4);
        c.fillStyle = '#1a1a22'; c.fillRect(S / 2 - 4, S - 6, 8, 2);
    });

    // 9: coffee machine
    drawTile(1, 1, (c) => {
        c.fillStyle = '#484848'; c.fillRect(6, 4, S - 12, S - 8);
        c.fillStyle = '#383838'; c.fillRect(7, 5, S - 14, S - 10);
        c.fillStyle = '#ff5020'; c.fillRect(10, 10, 4, 3);
        c.fillStyle = '#585858'; c.fillRect(6, S - 5, S - 12, 2);
        c.fillStyle = '#303030'; c.fillRect(8, 6, S - 16, 3);
    });

    // 10: couch
    drawTile(2, 1, (c) => {
        c.fillStyle = '#2e3e58'; c.fillRect(2, 6, S - 4, S - 10);
        c.fillStyle = '#384868'; c.fillRect(3, 7, S - 6, S - 12);
        c.fillStyle = '#243048'; c.fillRect(2, 4, 5, S - 8);
        c.fillStyle = '#243048'; c.fillRect(S - 7, 4, 5, S - 8);
    });

    // 11: bookshelf
    drawTile(3, 1, (c) => {
        c.fillStyle = '#4a3520'; c.fillRect(2, 0, S - 4, S);
        const colors = ['#6a2828', '#286a28', '#28286a', '#6a6a28', '#6a286a', '#286a6a'];
        for (let shelf = 0; shelf < 3; shelf++) {
            const sy = 2 + shelf * 10;
            c.fillStyle = '#3a2510'; c.fillRect(2, sy + 8, S - 4, 2);
            for (let i = 0; i < 6; i++) {
                c.fillStyle = colors[(i + shelf) % 6];
                c.fillRect(4 + i * 4, sy, 3, 8);
            }
        }
    });

    // 12: plant
    drawTile(4, 1, (c) => {
        c.fillStyle = '#6a4828'; c.fillRect(10, S - 10, 12, 10);
        c.fillStyle = '#7a5838'; c.fillRect(11, S - 9, 10, 8);
        c.fillStyle = '#1a6a30'; c.fillRect(6, S - 20, 20, 12);
        c.fillStyle = '#2a8a40'; c.fillRect(8, S - 24, 16, 10);
        c.fillStyle = '#3aaa50'; c.fillRect(10, S - 26, 12, 6);
        c.fillStyle = '#4aba60'; c.fillRect(12, S - 28, 8, 4);
    });

    // 13: server rack
    drawTile(5, 1, (c) => {
        c.fillStyle = '#1e1e1e'; c.fillRect(4, 2, S - 8, S - 4);
        for (let i = 0; i < 5; i++) {
            c.fillStyle = '#2a2a2a'; c.fillRect(5, 4 + i * 5, S - 10, 4);
            c.fillStyle = i % 2 === 0 ? '#3ECFA0' : '#ff4040'; c.fillRect(7, 5 + i * 5, 3, 2);
            c.fillStyle = '#444'; c.fillRect(S - 12, 5 + i * 5, 4, 2);
        }
    });

    // 14: water cooler
    drawTile(6, 1, (c) => {
        c.fillStyle = '#b0b0b0'; c.fillRect(8, 12, 16, 16);
        c.fillStyle = '#6898c8'; c.fillRect(10, 2, 12, 12);
        c.fillStyle = '#4878a8'; c.fillRect(12, 4, 8, 8);
        c.fillStyle = '#88b8e8'; c.fillRect(13, 5, 6, 6);
    });

    // 15: door
    drawTile(7, 1, (c) => {
        c.fillStyle = '#4a3820'; c.fillRect(4, 0, S - 8, S);
        c.fillStyle = '#5a4830'; c.fillRect(6, 2, S - 12, S - 4);
        c.fillStyle = '#d4a830'; c.fillRect(S - 10, S / 2 - 1, 3, 3);
    });

    // 16: manager floor
    drawTile(0, 2, (c) => {
        c.fillStyle = '#28221a'; c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            c.fillStyle = y % 16 === 0 ? '#302a20' : '#201c14';
            c.fillRect(0, y, S, 7);
            c.fillStyle = '#181410'; c.fillRect(0, y + 7, S, 1);
        }
    });

    // 17: fridge
    drawTile(1, 2, (c) => {
        c.fillStyle = '#d8d8d8'; c.fillRect(4, 2, S - 8, S - 4);
        c.fillStyle = '#c0c0c0'; c.fillRect(6, 4, S - 12, 10);
        c.fillStyle = '#c0c0c0'; c.fillRect(6, 16, S - 12, 10);
        c.fillStyle = '#909090'; c.fillRect(S - 10, 8, 2, 5);
        c.fillStyle = '#909090'; c.fillRect(S - 10, 20, 2, 5);
    });

    // 18: vending machine
    drawTile(2, 2, (c) => {
        c.fillStyle = '#2e2e58'; c.fillRect(4, 2, S - 8, S - 4);
        c.fillStyle = '#1e1e48'; c.fillRect(6, 4, S - 12, S - 10);
        c.fillStyle = '#ff4848'; c.fillRect(8, 6, 5, 4);
        c.fillStyle = '#48ff48'; c.fillRect(16, 6, 5, 4);
        c.fillStyle = '#4848ff'; c.fillRect(8, 12, 5, 4);
        c.fillStyle = '#ffff48'; c.fillRect(16, 12, 5, 4);
    });

    // 19: filing cabinet
    drawTile(3, 2, (c) => {
        c.fillStyle = '#909090'; c.fillRect(4, 2, S - 8, S - 4);
        c.fillStyle = '#808080'; c.fillRect(6, 4, S - 12, 8);
        c.fillStyle = '#808080'; c.fillRect(6, 14, S - 12, 8);
        c.fillStyle = '#707070'; c.fillRect(12, 6, 8, 2);
        c.fillStyle = '#707070'; c.fillRect(12, 16, 8, 2);
    });

    // 20: painting
    drawTile(4, 2, (c) => {
        c.fillStyle = '#5a4a20'; c.fillRect(3, 3, S - 6, S - 8);
        c.fillStyle = '#1a4a6a'; c.fillRect(5, 5, S - 10, 10);
        c.fillStyle = '#3a7a3a'; c.fillRect(5, 15, S - 10, 6);
        c.fillStyle = '#f0c848'; c.fillRect(10, 7, 6, 5);
    });

    // 21: clock
    drawTile(5, 2, (c) => {
        c.fillStyle = '#e8e8e8';
        c.beginPath(); c.arc(S / 2, S / 2, 10, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1a1a1a';
        c.beginPath(); c.arc(S / 2, S / 2, 8, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#e8e8e8'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(S / 2, S / 2); c.lineTo(S / 2, S / 2 - 6); c.stroke();
        c.beginPath(); c.moveTo(S / 2, S / 2); c.lineTo(S / 2 + 4, S / 2); c.stroke();
    });

    // 22-31: additional decoration tiles (simplified for 32px)
    // 22: whiteboard
    drawTile(6, 2, (c) => {
        c.fillStyle = '#f0f0f0'; c.fillRect(2, 2, S - 4, S - 6);
        c.fillStyle = '#fafafa'; c.fillRect(4, 4, S - 8, S - 10);
        c.fillStyle = '#444'; c.fillRect(2, S - 4, S - 4, 3);
        c.fillStyle = '#ff4040'; c.fillRect(6, 6, 8, 2);
        c.fillStyle = '#4040ff'; c.fillRect(6, 10, 12, 2);
    });

    // 23: bean bag
    drawTile(7, 2, (c) => {
        c.fillStyle = '#4a6888'; c.fillRect(4, 8, S - 8, S - 10);
        c.fillStyle = '#5a78a0'; c.fillRect(5, 6, S - 10, S - 10);
        c.fillStyle = '#6a88b0'; c.fillRect(7, 9, S - 14, S - 16);
    });

    // Row 3: more items
    // 24: rug
    drawTile(0, 3, (c) => {
        c.fillStyle = '#2e1e3a'; c.fillRect(0, 0, S, S);
        c.fillStyle = '#3e2e4a'; c.fillRect(2, 2, S - 4, S - 4);
        c.fillStyle = '#4e3e5a'; c.fillRect(4, 4, S - 8, S - 8);
    });

    // 25: lamp
    drawTile(1, 3, (c) => {
        c.fillStyle = '#444'; c.fillRect(13, S - 6, 6, 6);
        c.fillStyle = '#555'; c.fillRect(14, 8, 4, S - 14);
        c.fillStyle = '#f8d860'; c.fillRect(8, 2, 16, 8);
        c.fillStyle = '#ffe888'; c.fillRect(10, 4, 12, 4);
    });

    // 26: cactus
    drawTile(2, 3, (c) => {
        c.fillStyle = '#9a6a38'; c.fillRect(8, S - 10, 16, 10);
        c.fillStyle = '#2a9a38'; c.fillRect(12, 4, 8, S - 14);
        c.fillStyle = '#3aaa48'; c.fillRect(6, 10, 6, 8);
        c.fillStyle = '#3aaa48'; c.fillRect(S - 12, 6, 6, 10);
    });

    // 27: trophy
    drawTile(3, 3, (c) => {
        c.fillStyle = '#5a4a20'; c.fillRect(2, 0, S - 4, S);
        c.fillStyle = '#7a6a40'; c.fillRect(4, 2, S - 8, S - 4);
        c.fillStyle = '#ffd700'; c.fillRect(8, 5, 6, 8);
        c.fillStyle = '#ffd700'; c.fillRect(10, 3, 2, 2);
        c.fillStyle = '#c0c0c0'; c.fillRect(18, 8, 5, 6);
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

        const S = CHAR_SIZE;

        if (sleeping) {
            ctx.fillStyle = bodyColor;
            ctx.fillRect(x + 4, y + 16, 24, 10);
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x + 22, y + 18, 3, 2);
            ctx.fillStyle = '#e8a0a0';
            ctx.fillRect(x + 6, y + 18, 2, 2);
            return;
        }

        const bodyY = sitting ? y + 10 : y + 8;

        // Body
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 8, bodyY, 16, 14);

        // Head
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 6, y + 1, 20, 14);

        // Ears (fluffy)
        ctx.fillStyle = bodyColor;
        ctx.fillRect(x + 3, y - 1, 7, 6);
        ctx.fillRect(x + 22, y - 1, 7, 6);
        ctx.fillStyle = '#e8a0a0';
        ctx.fillRect(x + 5, y + 1, 3, 3);
        ctx.fillRect(x + 24, y + 1, 3, 3);

        // Eyes
        if (facing !== 'up') {
            ctx.fillStyle = '#1a1a1a';
            const eyeY = y + 7;
            if (facing === 'left') {
                ctx.fillRect(x + 8, eyeY, 3, 3);
                ctx.fillRect(x + 16, eyeY, 3, 3);
            } else if (facing === 'right') {
                ctx.fillRect(x + 13, eyeY, 3, 3);
                ctx.fillRect(x + 21, eyeY, 3, 3);
            } else {
                ctx.fillRect(x + 10, eyeY, 3, 3);
                ctx.fillRect(x + 19, eyeY, 3, 3);
            }
            // Eye shine
            ctx.fillStyle = '#ffffff';
            if (facing === 'down') {
                ctx.fillRect(x + 11, eyeY, 1, 1);
                ctx.fillRect(x + 20, eyeY, 1, 1);
            }
        }

        // Nose
        if (facing === 'down') {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(x + 14, y + 11, 4, 2);
        }

        // Clothing
        ctx.fillStyle = accColor;
        ctx.fillRect(x + 9, bodyY + 2, 14, 8);

        // Detail badge
        if (detail && facing === 'down') {
            ctx.fillStyle = detail;
            ctx.fillRect(x + 14, bodyY + 3, 4, 3);
        }

        // Arms
        if (!sitting) {
            ctx.fillStyle = bodyColor;
            if (armUp || waving) {
                ctx.fillRect(x + 4, bodyY - 4, 4, 8);
                ctx.fillRect(x + 24, bodyY - (waving ? 8 : 4), 4, 8);
            } else if (holdingCup) {
                ctx.fillRect(x + 4, bodyY + 2, 4, 10);
                ctx.fillRect(x + 24, bodyY - 2, 4, 8);
                ctx.fillStyle = '#e0d0c0';
                ctx.fillRect(x + 26, bodyY - 4, 4, 5);
            } else if (stretching) {
                ctx.fillRect(x + 2, bodyY - 6, 4, 6);
                ctx.fillRect(x + 26, bodyY - 6, 4, 6);
            } else {
                ctx.fillRect(x + 4, bodyY + 2, 4, 10);
                ctx.fillRect(x + 24, bodyY + 2, 4, 10);
            }
        }

        // Legs
        if (!sitting) {
            ctx.fillStyle = '#2a2a3a';
            ctx.fillRect(x + 10 + legOffset * 2, bodyY + 12, 5, 6);
            ctx.fillRect(x + 18 - legOffset * 2, bodyY + 12, 5, 6);
            // Shoes
            ctx.fillStyle = '#1a1a2a';
            ctx.fillRect(x + 10 + legOffset * 2, bodyY + 16, 5, 2);
            ctx.fillRect(x + 18 - legOffset * 2, bodyY + 16, 5, 2);
        }
    }

    // Row 0: idle down
    for (let i = 0; i < 4; i++) drawKoala(i, 0, { facing: 'down' });
    // Row 1: walk down
    for (let i = 0; i < 4; i++) drawKoala(i, 1, { facing: 'down', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 2: walk up
    for (let i = 0; i < 4; i++) drawKoala(i, 2, { facing: 'up', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 3: walk left
    for (let i = 0; i < 4; i++) drawKoala(i, 3, { facing: 'left', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 4: walk right
    for (let i = 0; i < 4; i++) drawKoala(i, 4, { facing: 'right', legOffset: i % 2 === 0 ? 1 : -1 });
    // Row 5: sit/work
    for (let i = 0; i < 4; i++) drawKoala(i, 5, { facing: 'down', sitting: true });
    // Row 6: sleep (2) + coffee (1) + wave (1)
    drawKoala(0, 6, { sleeping: true });
    drawKoala(1, 6, { sleeping: true });
    drawKoala(2, 6, { facing: 'down', holdingCup: true });
    drawKoala(3, 6, { facing: 'down', waving: true });
    // Row 7: celebrate (2) + stretch (2)
    drawKoala(0, 7, { facing: 'down', armUp: true });
    drawKoala(1, 7, { facing: 'down', armUp: false });
    drawKoala(2, 7, { facing: 'down', stretching: true });
    drawKoala(3, 7, { facing: 'down' });

*/

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
// Tile IDs match the tileset: row*16+col, 1-indexed for Phaser

const DECORATION_CATALOG = [
    { id: 'plant', name: 'Plant', tileId: 21, blocking: false },
    { id: 'bookshelf', name: 'Bookshelf', tileId: 20, blocking: true },
    { id: 'couch', name: 'Couch', tileId: 19, blocking: true },
    { id: 'coffeemachine', name: 'Coffee Machine', tileId: 18, blocking: true },
    { id: 'fridge', name: 'Fridge', tileId: 34, blocking: true },
    { id: 'vending', name: 'Vending Machine', tileId: 35, blocking: true },
    { id: 'server', name: 'Server Rack', tileId: 22, blocking: true },
    { id: 'watercooler', name: 'Water Cooler', tileId: 23, blocking: true },
    { id: 'cabinet', name: 'Filing Cabinet', tileId: 36, blocking: true },
    { id: 'whiteboard', name: 'Whiteboard', tileId: 39, blocking: true },
    { id: 'beanbag', name: 'Bean Bag', tileId: 40, blocking: true },
    { id: 'painting', name: 'Painting', tileId: 37, blocking: true },
    { id: 'clock', name: 'Clock', tileId: 38, blocking: true },
    { id: 'rug', name: 'Rug', tileId: 49, blocking: false },
    { id: 'lamp', name: 'Floor Lamp', tileId: 50, blocking: false },
    { id: 'cactus', name: 'Cactus', tileId: 51, blocking: false },
    { id: 'trophy', name: 'Trophy Case', tileId: 52, blocking: true },
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
    // Map: 24 wide x 18 tall (32px tiles = 768x576 world)
    const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));
    const collision = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(1));
    const furniture = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(0));

    function fill(layer, x1, y1, x2, y2, val) {
        for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
            if (y >= 0 && y < MAP_H && x >= 0 && x < MAP_W) layer[y][x] = val;
        }
    }

    // Tile IDs (Phaser 1-indexed, 16 cols per row):
    // Row0: 1=void,2=wood,3=ceramic,4=carpet,5=wall,6=window,7=glass,8=desk
    // Row1: 17=monitor,18=coffee,19=couch,20=bookshelf,21=plant,22=server,23=watercooler,24=door
    // Row2: 33=mgrfloor,34=fridge,35=vending,36=cabinet,37=painting,38=clock,39=whiteboard,40=beanbag
    // Row3: 49=rug,50=lamp,51=cactus,52=trophy
    const T = { void:1, wood:2, ceramic:3, carpet:4, wall:5, window:6, glass:7, desk:8,
                monitor:17, coffee:18, couch:19, bookshelf:20, plant:21, server:22, watercooler:23, door:24,
                mgrfloor:33, fridge:34, vending:35, cabinet:36, painting:37, clock:38, whiteboard:39, beanbag:40,
                rug:49, lamp:50, cactus:51, trophy:52 };

    // Manager room floor (top, rows 1-4)
    fill(map, 1, 1, MAP_W - 2, 4, T.mgrfloor);
    // Main work area (rows 6-16)
    fill(map, 1, 6, 14, MAP_H - 2, T.wood);
    // Break room (right side, rows 6-11)
    fill(map, 16, 6, MAP_W - 2, 11, T.ceramic);
    // Lounge (right side, rows 13-16)
    fill(map, 16, 13, MAP_W - 2, MAP_H - 2, T.carpet);

    // Walkable areas
    fill(collision, 1, 1, MAP_W - 2, 4, 0);
    fill(collision, 1, 6, 14, MAP_H - 2, 0);
    fill(collision, 16, 6, MAP_W - 2, MAP_H - 2, 0);
    fill(collision, 1, 5, MAP_W - 2, 5, 0);
    fill(collision, 15, 6, 15, MAP_H - 2, 0);
    fill(collision, 16, 12, MAP_W - 2, 12, 0);

    // Outer walls
    fill(map, 0, 0, MAP_W - 1, 0, T.wall);
    fill(map, 0, 0, 0, MAP_H - 1, T.wall);
    fill(map, MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, T.wall);
    fill(map, 0, MAP_H - 1, MAP_W - 1, MAP_H - 1, T.wall);

    // Windows on top wall
    for (let x = 3; x < MAP_W - 3; x += 4) {
        if (x < MAP_W) map[0][x] = T.window;
    }

    // Glass partition (manager room divider, row 5)
    fill(map, 1, 5, MAP_W - 2, 5, T.glass);
    map[5][7] = T.door;
    collision[5][7] = 0;

    // Wall between work area and break room (col 15)
    for (let y = 6; y <= MAP_H - 2; y++) map[y][15] = T.wall;
    map[9][15] = T.door;
    collision[9][15] = 0;

    // Wall between break room and lounge (row 12)
    fill(map, 16, 12, MAP_W - 2, 12, T.wall);
    map[12][19] = T.door;
    collision[12][19] = 0;

    // Work desks (main area)
    const desks = [
        { x: 3, y: 8 }, { x: 7, y: 8 }, { x: 11, y: 8 },
        { x: 3, y: 12 }, { x: 7, y: 12 }, { x: 11, y: 12 },
        { x: 3, y: 15 }, { x: 7, y: 15 },
    ];
    desks.forEach(d => {
        if (d.y < MAP_H && d.x < MAP_W) {
            furniture[d.y][d.x] = T.desk;
            collision[d.y][d.x] = 1;
            if (d.x + 1 < MAP_W) {
                furniture[d.y][d.x + 1] = T.monitor;
                collision[d.y][d.x + 1] = 1;
            }
        }
    });

    // Manager desk (larger)
    furniture[3][10] = T.desk; collision[3][10] = 1;
    furniture[3][11] = T.monitor; collision[3][11] = 1;
    furniture[3][12] = T.desk; collision[3][12] = 1;

    // Break room items
    furniture[7][17] = T.coffee; collision[7][17] = 1;
    furniture[7][19] = T.fridge; collision[7][19] = 1;
    furniture[7][21] = T.vending; collision[7][21] = 1;
    furniture[9][17] = T.watercooler; collision[9][17] = 1;

    // Lounge items
    furniture[14][17] = T.couch; collision[14][17] = 1;
    furniture[14][19] = T.couch; collision[14][19] = 1;
    furniture[15][21] = T.beanbag; collision[15][21] = 1;

    // Decorations
    furniture[2][2] = T.plant;
    furniture[2][MAP_W - 3] = T.plant;
    furniture[10][2] = T.bookshelf; collision[10][2] = 1;
    furniture[10][13] = T.server; collision[10][13] = 1;
    furniture[14][MAP_W - 3] = T.plant;
    furniture[7][MAP_W - 3] = T.cabinet; collision[7][MAP_W - 3] = 1;

    // Wall decorations
    furniture[0][6] = T.painting;
    furniture[0][12] = T.painting;
    furniture[0][18] = T.clock;

    // Extra decorations
    furniture[2][6] = T.lamp;
    furniture[15][17] = T.rug;
    furniture[2][MAP_W - 5] = T.trophy; collision[2][MAP_W - 5] = 1;

    return { map, collision, furniture, desks };
}

// ── Phaser Scenes ───────────────────────────────────────

class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    preload() {
        this.load.image('office-bg', 'assets/office-bg.png');
        this.load.image('particle', 'assets/particle.png');

        const agents = window._officeAgents || [];
        const loaded = new Set();
        agents.forEach(a => {
            const key = `koala-${a.role_id || 'default'}`;
            if (!loaded.has(key)) {
                this.load.spritesheet(key, `assets/${key}.png`, {
                    frameWidth: CHAR_SIZE, frameHeight: CHAR_SIZE
                });
                loaded.add(key);
            }
        });
        if (!loaded.size) {
            this.load.spritesheet('koala-default', 'assets/koala-default.png', {
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
        // Background image (pre-rendered office scene)
        const BG_W = 768, BG_H = 576;
        this.add.image(BG_W / 2, BG_H / 2, 'office-bg').setDepth(0);

        // Desk positions in pixel coordinates (matching the background image)
        const desks = [
            // Manager desk
            { x: 384, y: 90, isManager: true },
            // Work area row 1
            { x: 66, y: 220 }, { x: 206, y: 220 }, { x: 346, y: 220 },
            // Work area row 2
            { x: 66, y: 330 }, { x: 206, y: 330 }, { x: 346, y: 330 },
            // Work area row 3
            { x: 66, y: 440 }, { x: 206, y: 440 },
        ];
        this._deskPositions = desks;

        // Simple collision grid (32px cells)
        const gridW = Math.ceil(BG_W / TILE), gridH = Math.ceil(BG_H / TILE);
        const collision = Array.from({ length: gridH }, () => Array(gridW).fill(1));

        // Mark walkable areas
        function fillWalk(x1, y1, x2, y2) {
            for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
                if (y >= 0 && y < gridH && x >= 0 && x < gridW) collision[y][x] = 0;
            }
        }
        fillWalk(1, 1, gridW - 2, 4);    // Manager room
        fillWalk(1, 5, 14, gridH - 2);   // Work area
        fillWalk(15, 5, gridW - 2, gridH - 2); // Break + lounge

        this._collisionData = collision;

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
            const mgrDesk = desks.find(d => d.isManager);
            const workerDesks = desks.filter(d => !d.isManager);
            const desk = isManager && mgrDesk ? mgrDesk : workerDesks[idx % workerDesks.length];
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

            const sprite = this.add.sprite(desk.x, desk.y, texKey, 5 * 8 + 0);
            sprite.setDepth(desk.y);
            sprite.play(`${texKey}-sit`);

            // Name label
            const nameText = this.add.text(desk.x, desk.y - 20, agent.name || `Agent ${agent.id}`, {
                fontSize: '10px', fontFamily: 'monospace', color: '#f0f0f5',
                backgroundColor: 'rgba(10,10,15,0.8)', padding: { x: 4, y: 2 },
            }).setOrigin(0.5, 1).setDepth(100);

            // Status indicator dot
            const statusDot = this.add.circle(desk.x + 40, desk.y - 20, 4, 0x3ECFA0).setDepth(101);

            // Speech bubble container (text that appears above koala)
            const bubbleText = this.add.text(desk.x, desk.y - 34, '', {
                fontSize: '9px', fontFamily: 'monospace', color: '#0a0a0f',
                backgroundColor: '#3ECFA0', padding: { x: 5, y: 3 },
            }).setOrigin(0.5, 1).setDepth(102).setAlpha(0);

            // Thought bubble (smaller, dimmer)
            const thoughtText = this.add.text(desk.x, desk.y - 48, '', {
                fontSize: '8px', fontFamily: 'monospace', color: '#f0f0f5',
                backgroundColor: 'rgba(42,42,56,0.9)', padding: { x: 4, y: 2 },
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
        const BG_W2 = 768, BG_H2 = 576;
        this.cameras.main.setBounds(0, 0, BG_W2, BG_H2);
        const cw = this.scale.width, ch = this.scale.height;
        const worldW = BG_W2, worldH = BG_H2;
        const autoZoom = Math.max(cw / worldW, ch / worldH, 1);
        this.cameras.main.setZoom(Math.min(autoZoom, 2.5));
        this.cameras.main.centerOn(worldW / 2, worldH / 2);

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
            x: { min: 20, max: 750 },
            y: { min: 20, max: 560 },
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
        this._steamEmitter = this.add.particles(530, 185, 'particle', {
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
        this._serverLedEmitter = this.add.particles(452, 280, 'particle', {
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
            384, 288,
            768, 576,
            0x000030, 0
        ).setDepth(200).setBlendMode(Phaser.BlendModes.MULTIPLY);

        // Window light beams (visible during day)
        this._windowLights = [];
        for (let wx = 80; wx < 700; wx += 120) {
            const light = this.add.rectangle(wx, 50, 40, 80, 0xfff8e0, 0)
                .setDepth(199).setBlendMode(Phaser.BlendModes.ADD);
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
                x: { min: 0, max: 768 },
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
                x: { min: 0, max: 768 },
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
            384, 288,
            768, 576,
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
            const gx = k.desk.x + 26;
            const gy = k.desk.y - 8;
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
                this._walkTo(k, 18, 14, 'sleeping');
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
                            this._walkTo(k, 18, 14, 'resting');
                        } else {
                            this._walkTo(k, 17, 8, 'coffee');
                        }
                    });
                } else if (action < 4) {
                    this._walkTo(k, 17, 8, 'coffee');
                    this._showBubble(k, this._pickMessage('coffee'));
                } else if (action < 6) {
                    this._walkTo(k, 18, 14, 'resting');
                    this._showBubble(k, this._pickMessage('resting'));
                } else if (action < 8) {
                    const other = this.koalas[Phaser.Math.Between(0, this.koalas.length - 1)];
                    if (other !== k && other.state !== 'walking' && other.state !== 'sleeping') {
                        this._walkTo(k, Math.floor(other.desk.x / TILE), Math.floor(other.desk.y / TILE) + 2, 'chatting');
                        this._showBubble(k, this._pickMessage('chatting'));
                        this.time.delayedCall(2000, () => {
                            if (other.state === 'sitting') {
                                this._showBubble(other, this._pickMessage('chatting'));
                            }
                        });
                    }
                } else if (action < 10) {
                    this._walkTo(k, 2, 10, 'browsing');
                    this._showBubble(k, this._pickMessage('browsing'));
                } else if (action < 11) {
                    // Water cooler
                    this._walkTo(k, 17, 10, 'coffee');
                } else if (action < 12) {
                    // Vending machine
                    this._walkTo(k, 21, 8, 'coffee');
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
                    const meetX = 6, meetY = 10;
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
                this._walkTo(k, 19, 15, 'playing');
                this._showBubble(k, this._pickMessage('playing'));
                break;
            case 3: // Coffee run for two
                if (activeKoalas.length >= 2) {
                    const buddy = activeKoalas.find(b => b !== k);
                    if (buddy) {
                        this._walkTo(k, 17, 8, 'coffee');
                        this.time.delayedCall(1500, () => {
                            this._walkTo(buddy, 17, 9, 'coffee');
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
        k.bubbleText.y = k.sprite.y - 34;
        this.tweens.killTweensOf(k.bubbleText);
        k.bubbleText.setAlpha(1);
        this.tweens.add({ targets: k.bubbleText, alpha: 0, duration: 600, delay: 3000 });
    }

    _showThought(k, text) {
        k.thoughtText.setText(text);
        k.thoughtText.x = k.sprite.x;
        k.thoughtText.y = k.sprite.y - 48;
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

    _walkToDesk(k) {
        const tx = Math.floor(k.desk.x / TILE);
        const ty = Math.floor(k.desk.y / TILE) + 1;
        this._walkTo(k, tx, ty, 'sitting');
    }

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
                k.sprite.x = k.desk.x;
                k.sprite.y = k.desk.y;
            } else if (k.state === 'sleeping') {
                k.sprite.play(`${k.texKey}-sleep`);
                this._showBubble(k, 'Zzz...');
            } else if (k.state === 'coffee') {
                k.sprite.play(`${k.texKey}-coffee`);
                this._showBubble(k, this._pickMessage('coffee'));
                this.time.delayedCall(Phaser.Math.Between(4000, 8000), () => {
                    k.energy = Math.min(k.energy + 20, 100);
                    this._walkToDesk(k);
                });
            } else if (k.state === 'chatting') {
                k.sprite.play(`${k.texKey}-idle`);
                this.time.delayedCall(Phaser.Math.Between(4000, 10000), () => {
                    this._walkToDesk(k);
                });
            } else if (k.state === 'browsing') {
                k.sprite.play(`${k.texKey}-idle`);
                this._showBubble(k, this._pickMessage('browsing'));
                this.time.delayedCall(Phaser.Math.Between(3000, 7000), () => {
                    this._walkToDesk(k);
                });
            } else if (k.state === 'resting') {
                k.sprite.play(`${k.texKey}-sleep`);
                this._showBubble(k, this._pickMessage('resting'));
                this.time.delayedCall(Phaser.Math.Between(6000, 15000), () => {
                    k.energy = Math.min(k.energy + 30, 100);
                    this._walkToDesk(k);
                });
            } else if (k.state === 'playing') {
                k.sprite.play(`${k.texKey}-celebrate`);
                this._showBubble(k, this._pickMessage('playing'));
                this.time.delayedCall(Phaser.Math.Between(5000, 10000), () => {
                    k.energy = Math.min(k.energy + 10, 100);
                    this._walkToDesk(k);
                });
            } else {
                k.sprite.play(`${k.texKey}-idle`);
                this.time.delayedCall(Phaser.Math.Between(3000, 8000), () => {
                    this._walkToDesk(k);
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
        k.nameText.y = k.sprite.y - 20;
        k.statusDot.x = k.sprite.x + 40;
        k.statusDot.y = k.sprite.y - 20;
        k.bubbleText.x = k.sprite.x;
        k.bubbleText.y = k.sprite.y - 34;
        k.thoughtText.x = k.sprite.x;
        k.thoughtText.y = k.sprite.y - 48;
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
        for (let x = 0; x <= 24; x++) this._gridOverlay.lineBetween(x * TILE, 0, x * TILE, 576);
        for (let y = 0; y <= 18; y++) this._gridOverlay.lineBetween(0, y * TILE, 768, y * TILE);

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
