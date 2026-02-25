#!/usr/bin/env node
/**
 * Builds a composite 32x32 tileset from CC0 pixel art sources:
 * - Kenney Roguelike Indoors (16x16, scaled 2x) — furniture, items
 * - OpenGameArt Lab/Office Tiles (32x32) — floors, walls
 * - Custom procedural — fills for any gaps
 *
 * Output: ../ui/assets/tileset.png (16 cols x 4 rows = 64 tiles)
 *
 * Tile layout matches the T={} lookup in office-game.js:
 * Row0: void, wood, ceramic, carpet, wall, window, glass, desk
 * Row1: monitor, coffee, couch, bookshelf, plant, server, watercooler, door
 * Row2: mgrfloor, fridge, vending, cabinet, painting, clock, whiteboard, beanbag
 * Row3: rug, lamp, cactus, trophy, (unused...)
 */

const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');

const TILE = 32;
const COLS = 16;
const ROWS = 4;
const OUT = path.join(__dirname, '..', 'ui', 'assets', 'tileset.png');

// Kenney tile positions (16x16, 1px margin = 17px stride)
// Manually mapped from the Kenney Roguelike Indoors spritesheet
const K_STRIDE = 17;
function kTile(col, row) { return { x: col * K_STRIDE, y: row * K_STRIDE, w: 16, h: 16 }; }

// Kenney tile index to our tileset position mapping
// These are manually identified from Kenney's preview
const KENNEY_MAP = {
    // Manually mapped from Kenney Roguelike Indoors spritesheet
    // Format: kTile(column, row) in the 16x16+1px-margin grid
    desk:        kTile(0, 5),    // wooden table top
    monitor:     kTile(14, 5),   // monitor/screen
    chair:       kTile(5, 5),    // chair front
    couch:       kTile(0, 8),    // long sofa top
    bookshelf:   kTile(0, 7),    // bookshelf with books
    fridge:      kTile(7, 9),    // tall white appliance
    cabinet:     kTile(3, 7),    // filing cabinet
    plant1:      kTile(17, 3),   // potted plant
    plant2:      kTile(16, 3),   // bigger potted plant
    coffee:      kTile(8, 9),    // coffee maker / stove
    clock:       kTile(25, 1),   // wall decoration
    lamp:        kTile(19, 3),   // candelabra = lamp
    rug:         kTile(8, 5),    // rug/mat
    vending:     kTile(5, 9),    // tall shelf = vending
    painting:    kTile(25, 0),   // wall art
    door:        kTile(6, 0),    // door
    window:      kTile(5, 0),    // window
    trophy:      kTile(20, 3),   // trophy/ornament
    beanbag:     kTile(2, 8),    // cushion/pillow
    server:      kTile(4, 7),    // tall dark cabinet
    watercooler: kTile(6, 9),    // dispenser
    whiteboard:  kTile(25, 2),   // sign/board
};

async function build() {
    const canvas = createCanvas(COLS * TILE, ROWS * TILE);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Load source images
    const kenney = await loadImage(path.join(__dirname, '..', 'raw-assets', 'kenney-indoor.png'));
    let oga = null;
    try {
        oga = await loadImage(path.join(__dirname, '..', 'raw-assets', 'opengameart-office.png'));
    } catch(e) { console.warn('OGA tiles not found, using procedural floors'); }

    // Helper: draw a Kenney tile scaled 2x to 32x32 at target position
    function drawKenney(targetCol, targetRow, kenneyTile) {
        const tx = targetCol * TILE, ty = targetRow * TILE;
        ctx.drawImage(kenney, kenneyTile.x, kenneyTile.y, kenneyTile.w, kenneyTile.h, tx, ty, TILE, TILE);
    }

    // Helper: draw procedural tile
    function drawProcedural(col, row, fn) {
        ctx.save();
        ctx.translate(col * TILE, row * TILE);
        fn(ctx, TILE);
        ctx.restore();
    }

    // ── Row 0: Floors + structural ──────────────

    // 0: void
    drawProcedural(0, 0, (c, S) => {
        c.fillStyle = '#0d1117';
        c.fillRect(0, 0, S, S);
    });

    // 1: wood floor — procedural (warm, bright planks)
    drawProcedural(1, 0, (c, S) => {
        c.fillStyle = '#6a5540';
        c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            c.fillStyle = y % 16 === 0 ? '#7a6550' : '#5e4a38';
            c.fillRect(0, y, S, 6);
            c.fillStyle = '#504030';
            c.fillRect(0, y + 6, S, 1);
            c.fillStyle = '#8a7560';
            c.fillRect(0, y + 7, S, 1);
        }
        c.globalAlpha = 0.05;
        c.fillStyle = '#000';
        for (let x = 3; x < S; x += 7) c.fillRect(x, 0, 1, S);
        c.globalAlpha = 0.06;
        c.fillStyle = '#fff';
        for (let x = 1; x < S; x += 9) c.fillRect(x, 0, 1, S);
        c.globalAlpha = 1;
    });

    // 2: ceramic tile floor (bright)
    drawProcedural(2, 0, (c, S) => {
        c.fillStyle = '#506868';
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#587272';
        c.fillRect(1, 1, S/2-2, S/2-2);
        c.fillRect(S/2+1, S/2+1, S/2-2, S/2-2);
        c.fillStyle = '#546e6e';
        c.fillRect(S/2+1, 1, S/2-2, S/2-2);
        c.fillRect(1, S/2+1, S/2-2, S/2-2);
        c.fillStyle = '#486060';
        c.fillRect(0, S/2-1, S, 2);
        c.fillRect(S/2-1, 0, 2, S);
        c.globalAlpha = 0.12;
        c.fillStyle = '#fff';
        c.fillRect(3, 3, 4, 2);
        c.fillRect(S/2+3, S/2+3, 4, 2);
        c.globalAlpha = 1;
    });

    // 3: carpet (bright blue)
    drawProcedural(3, 0, (c, S) => {
        c.fillStyle = '#3a4878';
        c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 2) {
            c.fillStyle = y % 4 === 0 ? '#425088' : '#344068';
            c.fillRect(0, y, S, 2);
        }
        c.globalAlpha = 0.06;
        c.fillStyle = '#fff';
        for (let x = 0; x < S; x += 4) c.fillRect(x, 0, 1, S);
        c.globalAlpha = 1;
    });

    // 4: wall (from Kenney or procedural)
    drawProcedural(4, 0, (c, S) => {
        const grad = c.createLinearGradient(0, 0, 0, S);
        grad.addColorStop(0, '#383858');
        grad.addColorStop(0.7, '#404068');
        grad.addColorStop(1, '#484878');
        c.fillStyle = grad;
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#505080';
        c.fillRect(0, S-6, S, 6);
        c.fillStyle = '#585890';
        c.fillRect(0, S-3, S, 3);
        c.fillStyle = 'rgba(0,0,0,0.15)';
        c.fillRect(0, 0, S, 2);
    });

    // 5: window — Kenney
    drawKenney(5, 0, KENNEY_MAP.window);

    // 6: glass partition — procedural
    drawProcedural(6, 0, (c, S) => {
        c.fillStyle = '#1a2030';
        c.fillRect(0, 0, S, S);
        c.fillStyle = 'rgba(62,207,160,0.12)';
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#3a3a50';
        c.fillRect(0, S/2-2, S, 1);
        c.fillRect(0, S/2+1, S, 1);
        c.fillStyle = 'rgba(62,207,160,0.25)';
        c.fillRect(0, S/2-1, S, 2);
        c.globalAlpha = 0.08;
        c.fillStyle = '#fff';
        c.fillRect(0, 2, S, 4);
        c.globalAlpha = 1;
    });

    // 7: desk — Kenney
    drawKenney(7, 0, KENNEY_MAP.desk);

    // ── Row 1: Furniture ────────────────────────

    // 8: monitor — Kenney
    drawKenney(0, 1, KENNEY_MAP.monitor);

    // 9: coffee machine — Kenney
    drawKenney(1, 1, KENNEY_MAP.coffee);

    // 10: couch — Kenney
    drawKenney(2, 1, KENNEY_MAP.couch);

    // 11: bookshelf — Kenney
    drawKenney(3, 1, KENNEY_MAP.bookshelf);

    // 12: plant — Kenney
    drawKenney(4, 1, KENNEY_MAP.plant1);

    // 13: server — Kenney
    drawKenney(5, 1, KENNEY_MAP.server);

    // 14: water cooler — Kenney
    drawKenney(6, 1, KENNEY_MAP.watercooler);

    // 15: door — Kenney
    drawKenney(7, 1, KENNEY_MAP.door);

    // ── Row 2: More items ───────────────────────

    // 16: manager floor (premium dark)
    drawProcedural(0, 2, (c, S) => {
        c.fillStyle = '#5a4e3a';
        c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            c.fillStyle = y % 16 === 0 ? '#685848' : '#504430';
            c.fillRect(0, y, S, 6);
            c.fillStyle = '#443828';
            c.fillRect(0, y + 6, S, 1);
            c.fillStyle = '#706050';
            c.fillRect(0, y + 7, S, 1);
        }
        c.globalAlpha = 0.08;
        c.fillStyle = '#d4a830';
        c.fillRect(0, 0, S, S);
        c.globalAlpha = 1;
    });

    // 17: fridge — Kenney
    drawKenney(1, 2, KENNEY_MAP.fridge);

    // 18: vending — Kenney
    drawKenney(2, 2, KENNEY_MAP.vending);

    // 19: cabinet — Kenney
    drawKenney(3, 2, KENNEY_MAP.cabinet);

    // 20: painting — Kenney
    drawKenney(4, 2, KENNEY_MAP.painting);

    // 21: clock — Kenney
    drawKenney(5, 2, KENNEY_MAP.clock);

    // 22: whiteboard — Kenney
    drawKenney(6, 2, KENNEY_MAP.whiteboard);

    // 23: beanbag — Kenney
    drawKenney(7, 2, KENNEY_MAP.beanbag);

    // ── Row 3: Extras ───────────────────────────

    // 24: rug — Kenney
    drawKenney(0, 3, KENNEY_MAP.rug);

    // 25: lamp — Kenney
    drawKenney(1, 3, KENNEY_MAP.lamp);

    // 26: cactus — use plant2
    drawKenney(2, 3, KENNEY_MAP.plant2);

    // 27: trophy — Kenney
    drawKenney(3, 3, KENNEY_MAP.trophy);

    // Save
    fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
    console.log('Tileset written to', OUT);
    console.log(`${COLS}x${ROWS} = ${COLS*ROWS} tiles at ${TILE}x${TILE}px`);
}

build().catch(e => { console.error(e); process.exit(1); });
