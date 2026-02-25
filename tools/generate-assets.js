#!/usr/bin/env node
/**
 * KoalaClaw Asset Generator
 *
 * Generates high-quality 32x32 pixel art tileset and koala sprite sheets.
 * Output: ../ui/assets/tileset.png, ../ui/assets/koala-{role}.png, ../ui/assets/particle.png
 *
 * Run: cd tools && npm install && npm run generate
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const TILE = 32;
const CHAR = 32;
const OUT_DIR = path.join(__dirname, '..', 'ui', 'assets');

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════

function hex(color) { return color; }

function lighter(hex, pct) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const f = 1 + pct / 100;
    return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
}

function darker(hex, pct) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const f = 1 - pct / 100;
    return `rgb(${Math.max(0, Math.round(r * f))},${Math.max(0, Math.round(g * f))},${Math.max(0, Math.round(b * f))})`;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function ellipse(ctx, cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

// ═══════════════════════════════════════════════════════════
//  TILESET GENERATION (16 cols x 4 rows = 64 tiles max)
// ═══════════════════════════════════════════════════════════

function generateTileset() {
    const cols = 16, rows = 4;
    const canvas = createCanvas(cols * TILE, rows * TILE);
    const ctx = canvas.getContext('2d');

    function tile(col, row, fn) {
        ctx.save();
        ctx.translate(col * TILE, row * TILE);
        fn(ctx, TILE);
        ctx.restore();
    }

    const S = TILE;

    // ── Row 0 ────────────────────────────────────────

    // 0: void / black
    tile(0, 0, (c) => {
        c.fillStyle = '#0d1117';
        c.fillRect(0, 0, S, S);
    });

    // 1: wood floor — warm planks with grain (BRIGHT)
    tile(1, 0, (c) => {
        c.fillStyle = '#5c4a38';
        c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            c.fillStyle = y % 16 === 0 ? '#6a5845' : '#50402e';
            c.fillRect(0, y, S, 6);
            c.fillStyle = '#45362a';
            c.fillRect(0, y + 6, S, 1);
            c.fillStyle = '#705a48';
            c.fillRect(0, y + 7, S, 1);
        }
        c.globalAlpha = 0.06;
        c.fillStyle = '#000';
        for (let x = 3; x < S; x += 7) { c.fillRect(x, 0, 1, S); }
        c.globalAlpha = 0.08;
        c.fillStyle = '#fff';
        for (let x = 5; x < S; x += 11) { c.fillRect(x, 0, 1, S); }
        c.globalAlpha = 1;
    });

    // 2: tile floor (break room) — clean ceramic (BRIGHT)
    tile(2, 0, (c) => {
        c.fillStyle = '#3e5555';
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#486060';
        c.fillRect(1, 1, S / 2 - 2, S / 2 - 2);
        c.fillRect(S / 2 + 1, S / 2 + 1, S / 2 - 2, S / 2 - 2);
        c.fillStyle = '#425858';
        c.fillRect(S / 2 + 1, 1, S / 2 - 2, S / 2 - 2);
        c.fillRect(1, S / 2 + 1, S / 2 - 2, S / 2 - 2);
        c.fillStyle = '#344848';
        c.fillRect(0, S / 2 - 1, S, 2);
        c.fillRect(S / 2 - 1, 0, 2, S);
        c.globalAlpha = 0.1;
        c.fillStyle = '#fff';
        c.fillRect(3, 3, 6, 2);
        c.fillRect(S / 2 + 3, S / 2 + 3, 6, 2);
        c.globalAlpha = 1;
    });

    // 3: carpet (lounge) — soft woven (BRIGHT)
    tile(3, 0, (c) => {
        c.fillStyle = '#2e3860';
        c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 2) {
            c.fillStyle = y % 4 === 0 ? '#354270' : '#283858';
            c.fillRect(0, y, S, 2);
        }
        c.globalAlpha = 0.08;
        c.fillStyle = '#fff';
        for (let x = 0; x < S; x += 4) { c.fillRect(x, 0, 1, S); }
        c.globalAlpha = 1;
    });

    // 4: wall — visible with baseboard
    tile(4, 0, (c) => {
        const grad = c.createLinearGradient(0, 0, 0, S);
        grad.addColorStop(0, '#282840');
        grad.addColorStop(0.7, '#303050');
        grad.addColorStop(1, '#3a3a5a');
        c.fillStyle = grad;
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#404068';
        c.fillRect(0, S - 6, S, 6);
        c.fillStyle = '#484878';
        c.fillRect(0, S - 3, S, 3);
        c.fillStyle = 'rgba(0,0,0,0.2)';
        c.fillRect(0, 0, S, 2);
    });

    // 5: window — glass with reflection
    tile(5, 0, (c) => {
        // Wall background
        c.fillStyle = '#1a1a28';
        c.fillRect(0, 0, S, S);
        // Frame
        c.fillStyle = '#2e2e40';
        c.fillRect(3, 2, S - 6, S - 8);
        // Glass
        const glassGrad = c.createLinearGradient(5, 4, S - 5, S - 8);
        glassGrad.addColorStop(0, '#0c1e30');
        glassGrad.addColorStop(0.5, '#1a3848');
        glassGrad.addColorStop(1, '#0e2438');
        c.fillStyle = glassGrad;
        c.fillRect(5, 4, S - 10, S - 12);
        // Cross bar
        c.fillStyle = '#2e2e40';
        c.fillRect(S / 2 - 1, 4, 2, S - 12);
        c.fillRect(5, S / 2 - 2, S - 10, 2);
        // Reflection highlight
        c.globalAlpha = 0.15;
        c.fillStyle = '#fff';
        c.beginPath();
        c.moveTo(6, 5);
        c.lineTo(12, 5);
        c.lineTo(6, 14);
        c.closePath();
        c.fill();
        c.globalAlpha = 1;
        // Baseboard
        c.fillStyle = '#303048';
        c.fillRect(0, S - 4, S, 4);
    });

    // 6: glass partition — translucent green
    tile(6, 0, (c) => {
        c.fillStyle = '#0d1117';
        c.fillRect(0, 0, S, S);
        // Glass panel
        c.fillStyle = 'rgba(62,207,160,0.08)';
        c.fillRect(0, 0, S, S);
        // Metal rail
        c.fillStyle = '#2a2a3a';
        c.fillRect(0, S / 2 - 2, S, 1);
        c.fillRect(0, S / 2 + 1, S, 1);
        c.fillStyle = 'rgba(62,207,160,0.2)';
        c.fillRect(0, S / 2 - 1, S, 2);
        // Shine
        c.globalAlpha = 0.06;
        c.fillStyle = '#fff';
        c.fillRect(0, 2, S, 4);
        c.globalAlpha = 1;
    });

    // 7: desk — wooden with shadow
    tile(7, 0, (c) => {
        // Shadow
        c.fillStyle = 'rgba(0,0,0,0.2)';
        roundRect(c, 3, 6, S - 6, S - 8, 2);
        c.fill();
        // Desktop
        const deskGrad = c.createLinearGradient(2, 4, 2, S - 4);
        deskGrad.addColorStop(0, '#5a4c38');
        deskGrad.addColorStop(1, '#4a3c28');
        c.fillStyle = deskGrad;
        roundRect(c, 2, 4, S - 4, S - 8, 2);
        c.fill();
        // Edge highlight
        c.fillStyle = '#6a5c48';
        c.fillRect(3, 4, S - 6, 2);
        // Legs
        c.fillStyle = '#3a2e1c';
        c.fillRect(5, S - 5, 3, 5);
        c.fillRect(S - 8, S - 5, 3, 5);
    });

    // ── Row 1 ────────────────────────────────────────

    // 8: monitor on desk
    tile(0, 1, (c) => {
        // Stand base
        c.fillStyle = '#1e1e28';
        c.fillRect(S / 2 - 5, S - 6, 10, 3);
        // Stand neck
        c.fillStyle = '#1e1e28';
        c.fillRect(S / 2 - 2, S - 10, 4, 5);
        // Screen frame
        c.fillStyle = '#1a1a24';
        roundRect(c, 4, 1, S - 8, S - 11, 2);
        c.fill();
        // Screen
        const screenGrad = c.createRadialGradient(S / 2, S / 2 - 4, 2, S / 2, S / 2 - 4, 14);
        screenGrad.addColorStop(0, '#1a4838');
        screenGrad.addColorStop(1, '#0a2820');
        c.fillStyle = screenGrad;
        c.fillRect(6, 3, S - 12, S - 15);
        // Screen glow
        c.globalAlpha = 0.15;
        c.fillStyle = '#3ECFA0';
        c.fillRect(6, 3, S - 12, S - 15);
        c.globalAlpha = 1;
        // Power LED
        c.fillStyle = '#3ECFA0';
        c.fillRect(S / 2 - 1, S - 12, 2, 1);
    });

    // 9: coffee machine
    tile(1, 1, (c) => {
        // Body
        c.fillStyle = '#505050';
        roundRect(c, 6, 3, S - 12, S - 6, 3);
        c.fill();
        c.fillStyle = '#404040';
        roundRect(c, 7, 4, S - 14, S - 8, 2);
        c.fill();
        // Display
        c.fillStyle = '#1a1a1a';
        c.fillRect(9, 6, S - 18, 5);
        // Brew indicator
        c.fillStyle = '#ff5020';
        c.fillRect(11, 7, 4, 3);
        // Drip area
        c.fillStyle = '#383838';
        c.fillRect(8, S - 8, S - 16, 4);
        // Cup
        c.fillStyle = '#e8d8c8';
        c.fillRect(12, S - 9, 6, 5);
        c.fillStyle = '#c8b8a8';
        c.fillRect(13, S - 8, 4, 3);
    });

    // 10: couch
    tile(2, 1, (c) => {
        // Shadow
        c.fillStyle = 'rgba(0,0,0,0.15)';
        roundRect(c, 3, 8, S - 6, S - 10, 3);
        c.fill();
        // Seat
        c.fillStyle = '#344868';
        roundRect(c, 2, 6, S - 4, S - 10, 4);
        c.fill();
        // Cushion
        c.fillStyle = '#3e5878';
        roundRect(c, 4, 8, S - 8, S - 14, 3);
        c.fill();
        // Arms
        c.fillStyle = '#2a3858';
        roundRect(c, 1, 4, 6, S - 8, 3);
        c.fill();
        roundRect(c, S - 7, 4, 6, S - 8, 3);
        c.fill();
        // Highlight
        c.globalAlpha = 0.1;
        c.fillStyle = '#fff';
        c.fillRect(5, 8, S - 10, 2);
        c.globalAlpha = 1;
    });

    // 11: bookshelf
    tile(3, 1, (c) => {
        // Frame
        c.fillStyle = '#4a3520';
        roundRect(c, 2, 0, S - 4, S, 2);
        c.fill();
        c.fillStyle = '#5a4530';
        c.fillRect(3, 1, S - 6, S - 2);
        // Shelves
        const bookColors = ['#7a3030', '#307a30', '#30307a', '#7a7a30', '#7a307a', '#307a7a', '#7a5030', '#305070'];
        for (let shelf = 0; shelf < 3; shelf++) {
            const sy = 2 + shelf * 10;
            // Shelf board
            c.fillStyle = '#3a2510';
            c.fillRect(3, sy + 8, S - 6, 2);
            // Books
            for (let i = 0; i < 7; i++) {
                const bh = 6 + (i % 3);
                c.fillStyle = bookColors[(i + shelf * 3) % bookColors.length];
                c.fillRect(4 + i * 3.5, sy + (8 - bh), 3, bh);
                // Book spine highlight
                c.globalAlpha = 0.15;
                c.fillStyle = '#fff';
                c.fillRect(4 + i * 3.5, sy + (8 - bh), 1, bh);
                c.globalAlpha = 1;
            }
        }
    });

    // 12: plant — lush potted plant
    tile(4, 1, (c) => {
        // Pot shadow
        c.fillStyle = 'rgba(0,0,0,0.15)';
        ellipse(c, S / 2, S - 4, 10, 4);
        c.fill();
        // Pot
        c.fillStyle = '#7a5030';
        c.fillRect(10, S - 10, 12, 10);
        c.fillStyle = '#8a6040';
        c.fillRect(9, S - 11, 14, 3);
        // Leaves (layers)
        const greens = ['#1a6a30', '#2a8a40', '#3aaa50', '#4aba60'];
        for (let i = 0; i < 4; i++) {
            c.fillStyle = greens[i];
            ellipse(c, S / 2 + (i % 2 ? 3 : -3), S - 14 - i * 4, 10 - i, 6 - i);
            c.fill();
        }
        // Top leaf
        c.fillStyle = '#5aca70';
        ellipse(c, S / 2, S - 28, 5, 3);
        c.fill();
    });

    // 13: server rack
    tile(5, 1, (c) => {
        // Cabinet
        c.fillStyle = '#1a1a1e';
        roundRect(c, 4, 1, S - 8, S - 3, 2);
        c.fill();
        // Server units
        for (let i = 0; i < 5; i++) {
            const uy = 3 + i * 5;
            c.fillStyle = '#282830';
            c.fillRect(6, uy, S - 12, 4);
            // LED
            c.fillStyle = i % 2 === 0 ? '#3ECFA0' : '#ff4040';
            c.fillRect(8, uy + 1, 3, 2);
            // Vent lines
            c.fillStyle = '#1e1e24';
            for (let v = 0; v < 3; v++) {
                c.fillRect(14 + v * 3, uy + 1, 2, 2);
            }
        }
        // Rack handles
        c.fillStyle = '#444';
        c.fillRect(5, 2, 1, S - 5);
        c.fillRect(S - 6, 2, 1, S - 5);
    });

    // 14: water cooler
    tile(6, 1, (c) => {
        // Base
        c.fillStyle = '#b0b0b0';
        roundRect(c, 8, 14, 16, 16, 2);
        c.fill();
        c.fillStyle = '#a0a0a0';
        c.fillRect(10, 16, 12, 12);
        // Water jug
        c.fillStyle = '#78a8d8';
        ellipse(c, S / 2, 8, 7, 8);
        c.fill();
        c.fillStyle = '#88b8e8';
        ellipse(c, S / 2, 7, 5, 6);
        c.fill();
        // Shine
        c.globalAlpha = 0.3;
        c.fillStyle = '#fff';
        ellipse(c, S / 2 - 2, 5, 2, 3);
        c.fill();
        c.globalAlpha = 1;
        // Tap
        c.fillStyle = '#888';
        c.fillRect(S / 2 - 1, 14, 2, 3);
    });

    // 15: door
    tile(7, 1, (c) => {
        // Door frame
        c.fillStyle = '#3a2818';
        c.fillRect(4, 0, S - 8, S);
        // Door panel
        const doorGrad = c.createLinearGradient(6, 0, S - 6, 0);
        doorGrad.addColorStop(0, '#5a4830');
        doorGrad.addColorStop(0.5, '#6a5840');
        doorGrad.addColorStop(1, '#4a3820');
        c.fillStyle = doorGrad;
        c.fillRect(6, 1, S - 12, S - 2);
        // Panels
        c.fillStyle = '#4a3820';
        c.strokeStyle = '#3a2818';
        c.lineWidth = 1;
        c.strokeRect(8, 3, S - 16, 12);
        c.strokeRect(8, 17, S - 16, 10);
        // Handle
        c.fillStyle = '#d4a830';
        ellipse(c, S - 10, S / 2, 2, 2);
        c.fill();
    });

    // ── Row 2 ────────────────────────────────────────

    // 16: manager floor — premium dark wood (BRIGHT)
    tile(0, 2, (c) => {
        c.fillStyle = '#4a3e2e';
        c.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) {
            c.fillStyle = y % 16 === 0 ? '#544838' : '#3e3428';
            c.fillRect(0, y, S, 6);
            c.fillStyle = '#342a20';
            c.fillRect(0, y + 6, S, 1);
            c.fillStyle = '#5a4e3e';
            c.fillRect(0, y + 7, S, 1);
        }
        c.globalAlpha = 0.06;
        c.fillStyle = '#d4a830';
        c.fillRect(0, 0, S, S);
        c.globalAlpha = 1;
    });

    // 17: fridge
    tile(1, 2, (c) => {
        c.fillStyle = 'rgba(0,0,0,0.1)';
        roundRect(c, 5, 4, S - 8, S - 4, 2);
        c.fill();
        c.fillStyle = '#dcdcdc';
        roundRect(c, 4, 2, S - 8, S - 4, 3);
        c.fill();
        c.fillStyle = '#c8c8c8';
        c.fillRect(6, 4, S - 12, 11);
        c.fillRect(6, 17, S - 12, 11);
        // Handles
        c.fillStyle = '#999';
        c.fillRect(S - 10, 8, 2, 5);
        c.fillRect(S - 10, 21, 2, 5);
        // Divider
        c.fillStyle = '#b0b0b0';
        c.fillRect(5, 15, S - 10, 2);
    });

    // 18: vending machine
    tile(2, 2, (c) => {
        c.fillStyle = '#2e2e58';
        roundRect(c, 4, 1, S - 8, S - 3, 3);
        c.fill();
        // Display
        c.fillStyle = '#1a1a40';
        c.fillRect(6, 3, S - 12, S - 10);
        // Items
        const colors = ['#ff4848', '#48ff48', '#4888ff', '#ffff48', '#ff48ff', '#48ffff'];
        for (let r = 0; r < 3; r++) {
            for (let col = 0; col < 2; col++) {
                c.fillStyle = colors[r * 2 + col];
                roundRect(c, 8 + col * 9, 5 + r * 6, 7, 5, 1);
                c.fill();
            }
        }
        // Coin slot
        c.fillStyle = '#888';
        c.fillRect(S / 2 - 1, S - 7, 2, 3);
    });

    // 19: filing cabinet
    tile(3, 2, (c) => {
        c.fillStyle = 'rgba(0,0,0,0.1)';
        roundRect(c, 5, 4, S - 8, S - 4, 2);
        c.fill();
        c.fillStyle = '#909090';
        roundRect(c, 4, 2, S - 8, S - 4, 2);
        c.fill();
        // Drawers
        for (let d = 0; d < 3; d++) {
            const dy = 4 + d * 8;
            c.fillStyle = '#808080';
            c.fillRect(6, dy, S - 12, 7);
            c.fillStyle = '#707070';
            c.fillRect(12, dy + 2, 8, 2);
        }
    });

    // 20: painting
    tile(4, 2, (c) => {
        // Frame
        c.fillStyle = '#6a5a28';
        roundRect(c, 3, 2, S - 6, S - 8, 2);
        c.fill();
        // Canvas
        const paintGrad = c.createLinearGradient(5, 4, 5, S - 8);
        paintGrad.addColorStop(0, '#1a4a6a');
        paintGrad.addColorStop(0.6, '#3a7a5a');
        paintGrad.addColorStop(1, '#2a5a3a');
        c.fillStyle = paintGrad;
        c.fillRect(5, 4, S - 10, S - 12);
        // Sun/moon
        c.fillStyle = '#f0c848';
        ellipse(c, 12, 8, 4, 4);
        c.fill();
        // Mountains
        c.fillStyle = '#2a5a4a';
        c.beginPath();
        c.moveTo(5, S - 10);
        c.lineTo(12, 10);
        c.lineTo(20, S - 10);
        c.closePath();
        c.fill();
    });

    // 21: clock
    tile(5, 2, (c) => {
        c.fillStyle = '#1a1a28';
        c.fillRect(0, 0, S, S);
        // Clock body
        c.fillStyle = '#e8e8e8';
        ellipse(c, S / 2, S / 2, 12, 12);
        c.fill();
        c.fillStyle = '#1a1a1a';
        ellipse(c, S / 2, S / 2, 10, 10);
        c.fill();
        // Hour marks
        c.fillStyle = '#888';
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            c.fillRect(S / 2 + Math.cos(angle) * 8 - 0.5, S / 2 + Math.sin(angle) * 8 - 0.5, 1, 1);
        }
        // Hands
        c.strokeStyle = '#e8e8e8';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(S / 2, S / 2);
        c.lineTo(S / 2, S / 2 - 7);
        c.stroke();
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(S / 2, S / 2);
        c.lineTo(S / 2 + 5, S / 2);
        c.stroke();
        // Center dot
        c.fillStyle = '#ff4040';
        ellipse(c, S / 2, S / 2, 1.5, 1.5);
        c.fill();
    });

    // 22: whiteboard
    tile(6, 2, (c) => {
        // Board
        c.fillStyle = '#e8e8e8';
        roundRect(c, 2, 2, S - 4, S - 6, 2);
        c.fill();
        c.fillStyle = '#f4f4f4';
        c.fillRect(4, 4, S - 8, S - 10);
        // Tray
        c.fillStyle = '#555';
        c.fillRect(3, S - 4, S - 6, 3);
        // Marker scribbles
        c.strokeStyle = '#ff4040';
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(7, 7); c.lineTo(18, 7); c.stroke();
        c.strokeStyle = '#3060ff';
        c.beginPath(); c.moveTo(7, 11); c.lineTo(24, 11); c.stroke();
        c.strokeStyle = '#30a030';
        c.beginPath(); c.moveTo(7, 15); c.lineTo(14, 15); c.stroke();
        // Markers on tray
        c.fillStyle = '#ff4040';
        c.fillRect(6, S - 5, 4, 2);
        c.fillStyle = '#3060ff';
        c.fillRect(12, S - 5, 4, 2);
    });

    // 23: bean bag
    tile(7, 2, (c) => {
        c.fillStyle = 'rgba(0,0,0,0.1)';
        ellipse(c, S / 2, S - 6, 12, 6);
        c.fill();
        // Body
        const bagGrad = c.createRadialGradient(S / 2, S / 2 + 2, 2, S / 2, S / 2 + 2, 14);
        bagGrad.addColorStop(0, '#6a88b0');
        bagGrad.addColorStop(1, '#4a6888');
        c.fillStyle = bagGrad;
        ellipse(c, S / 2, S / 2 + 2, 12, 10);
        c.fill();
        // Highlight
        c.globalAlpha = 0.15;
        c.fillStyle = '#fff';
        ellipse(c, S / 2 - 3, S / 2 - 3, 5, 4);
        c.fill();
        c.globalAlpha = 1;
    });

    // ── Row 3 ────────────────────────────────────────

    // 24: rug
    tile(0, 3, (c) => {
        c.fillStyle = '#2e1e3a';
        c.fillRect(0, 0, S, S);
        c.fillStyle = '#3e2e4a';
        roundRect(c, 2, 2, S - 4, S - 4, 3);
        c.fill();
        c.fillStyle = '#4e3e5a';
        roundRect(c, 5, 5, S - 10, S - 10, 2);
        c.fill();
        // Pattern
        c.globalAlpha = 0.1;
        c.fillStyle = '#fff';
        for (let i = 0; i < 4; i++) {
            c.fillRect(7 + i * 5, 7, 3, S - 14);
        }
        c.globalAlpha = 1;
    });

    // 25: floor lamp
    tile(1, 3, (c) => {
        // Base
        c.fillStyle = '#444';
        ellipse(c, S / 2, S - 4, 5, 3);
        c.fill();
        // Pole
        c.fillStyle = '#555';
        c.fillRect(S / 2 - 1, 8, 2, S - 12);
        // Shade
        const shadeGrad = c.createLinearGradient(S / 2 - 8, 2, S / 2 + 8, 2);
        shadeGrad.addColorStop(0, '#d8a840');
        shadeGrad.addColorStop(0.5, '#f8d860');
        shadeGrad.addColorStop(1, '#d8a840');
        c.fillStyle = shadeGrad;
        c.beginPath();
        c.moveTo(S / 2 - 8, 10);
        c.lineTo(S / 2 + 8, 10);
        c.lineTo(S / 2 + 5, 2);
        c.lineTo(S / 2 - 5, 2);
        c.closePath();
        c.fill();
        // Glow
        c.globalAlpha = 0.08;
        c.fillStyle = '#ffe080';
        ellipse(c, S / 2, 14, 10, 6);
        c.fill();
        c.globalAlpha = 1;
    });

    // 26: cactus
    tile(2, 3, (c) => {
        // Pot
        c.fillStyle = '#9a6a38';
        c.beginPath();
        c.moveTo(9, S - 10);
        c.lineTo(7, S);
        c.lineTo(S - 7, S);
        c.lineTo(S - 9, S - 10);
        c.closePath();
        c.fill();
        c.fillStyle = '#aa7a48';
        c.fillRect(8, S - 11, S - 16, 2);
        // Main stem
        c.fillStyle = '#2a9a38';
        roundRect(c, 12, 4, 8, S - 14, 4);
        c.fill();
        // Arms
        c.fillStyle = '#3aaa48';
        roundRect(c, 5, 10, 8, 5, 3);
        c.fill();
        c.fillRect(12, 10, 2, 5);
        roundRect(c, S - 13, 7, 8, 5, 3);
        c.fill();
        c.fillRect(S - 13, 7, 2, 5);
        // Highlights
        c.globalAlpha = 0.15;
        c.fillStyle = '#fff';
        c.fillRect(14, 5, 2, S - 16);
        c.globalAlpha = 1;
    });

    // 27: trophy case
    tile(3, 3, (c) => {
        // Case
        c.fillStyle = '#5a4a20';
        roundRect(c, 2, 0, S - 4, S, 2);
        c.fill();
        c.fillStyle = '#7a6a40';
        c.fillRect(4, 2, S - 8, S - 4);
        // Glass front
        c.fillStyle = 'rgba(150,200,255,0.08)';
        c.fillRect(4, 2, S - 8, S - 4);
        // Shelves
        c.fillStyle = '#5a4a20';
        c.fillRect(4, 11, S - 8, 1);
        c.fillRect(4, 21, S - 8, 1);
        // Gold trophy
        c.fillStyle = '#ffd700';
        c.fillRect(10, 4, 4, 6);
        c.fillRect(9, 3, 6, 2);
        c.fillRect(11, 3, 2, 1);
        // Silver trophy
        c.fillStyle = '#c0c0c0';
        c.fillRect(18, 13, 4, 5);
        c.fillRect(17, 12, 6, 2);
        // Bronze medal
        c.fillStyle = '#cd7f32';
        ellipse(c, 12, 25, 3, 3);
        c.fill();
    });

    return canvas;
}

// ═══════════════════════════════════════════════════════════
//  KOALA SPRITE SHEET GENERATION (8 cols x 8 rows)
// ═══════════════════════════════════════════════════════════

function generateKoalaSheet(bodyColor, accColor, detailColor) {
    const cols = 8, rows = 8;
    const canvas = createCanvas(cols * CHAR, rows * CHAR);
    const ctx = canvas.getContext('2d');

    function drawKoala(col, row, opts = {}) {
        const x = col * CHAR, y = row * CHAR;
        const { facing = 'down', legOff = 0, armUp = false, sitting = false,
                sleeping = false, holdCup = false, waving = false, stretching = false } = opts;

        ctx.save();
        ctx.translate(x, y);

        if (sleeping) {
            // Lying down koala
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ellipse(ctx, 16, 22, 13, 5);
            ctx.fill();
            ctx.fillStyle = bodyColor;
            ellipse(ctx, 16, 18, 12, 6);
            ctx.fill();
            // Head
            ctx.fillStyle = bodyColor;
            ellipse(ctx, 8, 16, 6, 5);
            ctx.fill();
            // Ear
            ctx.fillStyle = bodyColor;
            ellipse(ctx, 4, 12, 3, 3);
            ctx.fill();
            ctx.fillStyle = '#e8a0a0';
            ellipse(ctx, 4, 12, 1.5, 1.5);
            ctx.fill();
            // Closed eyes
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(6, 16); ctx.lineTo(10, 16); ctx.stroke();
            // Zzz
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '6px monospace';
            ctx.fillText('z', 20, 10);
            ctx.font = '5px monospace';
            ctx.fillText('z', 24, 7);
            ctx.restore();
            return;
        }

        const bodyY = sitting ? 10 : 8;

        // Shadow under character
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ellipse(ctx, 16, 30, 8, 3);
        ctx.fill();

        // Legs
        if (!sitting) {
            ctx.fillStyle = '#2a2a3a';
            roundRect(ctx, 9 + legOff * 2, bodyY + 14, 5, 7, 2);
            ctx.fill();
            roundRect(ctx, 18 - legOff * 2, bodyY + 14, 5, 7, 2);
            ctx.fill();
            // Shoes
            ctx.fillStyle = '#1e1e2a';
            roundRect(ctx, 8 + legOff * 2, bodyY + 18, 6, 3, 1);
            ctx.fill();
            roundRect(ctx, 17 - legOff * 2, bodyY + 18, 6, 3, 1);
            ctx.fill();
        }

        // Body
        ctx.fillStyle = bodyColor;
        ellipse(ctx, 16, bodyY + 8, 8, 8);
        ctx.fill();

        // Clothing
        ctx.fillStyle = accColor;
        ellipse(ctx, 16, bodyY + 9, 7, 6);
        ctx.fill();
        // Collar
        ctx.fillStyle = lighter(accColor, 20);
        ctx.fillRect(12, bodyY + 3, 8, 2);

        // Badge
        if (detailColor) {
            ctx.fillStyle = detailColor;
            ellipse(ctx, 19, bodyY + 6, 2.5, 2.5);
            ctx.fill();
        }

        // Arms
        ctx.fillStyle = bodyColor;
        if (!sitting) {
            if (armUp || waving) {
                // Left arm normal
                ellipse(ctx, 6, bodyY + 6, 3, 5);
                ctx.fill();
                // Right arm up
                ellipse(ctx, 26, waving ? bodyY - 2 : bodyY + 2, 3, 5);
                ctx.fill();
            } else if (holdCup) {
                ellipse(ctx, 6, bodyY + 8, 3, 5);
                ctx.fill();
                ellipse(ctx, 26, bodyY + 4, 3, 4);
                ctx.fill();
                // Cup
                ctx.fillStyle = '#e8d8c8';
                roundRect(ctx, 25, bodyY - 2, 5, 6, 1);
                ctx.fill();
                ctx.fillStyle = '#8a6040';
                ctx.fillRect(26, bodyY - 1, 3, 4);
            } else if (stretching) {
                ellipse(ctx, 4, bodyY - 2, 3, 4);
                ctx.fill();
                ellipse(ctx, 28, bodyY - 2, 3, 4);
                ctx.fill();
            } else {
                ellipse(ctx, 6, bodyY + 8, 3, 5);
                ctx.fill();
                ellipse(ctx, 26, bodyY + 8, 3, 5);
                ctx.fill();
            }
        }

        // Head
        ctx.fillStyle = bodyColor;
        ellipse(ctx, 16, 6, 10, 8);
        ctx.fill();

        // Fur texture on head
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#fff';
        ellipse(ctx, 14, 4, 6, 4);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Ears
        ctx.fillStyle = bodyColor;
        ellipse(ctx, 5, 1, 5, 4);
        ctx.fill();
        ellipse(ctx, 27, 1, 5, 4);
        ctx.fill();
        // Inner ear
        ctx.fillStyle = '#e8a0a0';
        ellipse(ctx, 5, 1, 3, 2.5);
        ctx.fill();
        ellipse(ctx, 27, 1, 3, 2.5);
        ctx.fill();

        // Eyes
        if (facing !== 'up') {
            const eyeY = 6;
            let lx, rx;
            if (facing === 'left') { lx = 9; rx = 17; }
            else if (facing === 'right') { lx = 15; rx = 23; }
            else { lx = 11; rx = 21; }

            // Eye whites
            ctx.fillStyle = '#fff';
            ellipse(ctx, lx, eyeY, 3, 2.5);
            ctx.fill();
            ellipse(ctx, rx, eyeY, 3, 2.5);
            ctx.fill();

            // Pupils
            ctx.fillStyle = '#1a1a1a';
            ellipse(ctx, lx + (facing === 'left' ? -1 : facing === 'right' ? 1 : 0), eyeY, 1.5, 2);
            ctx.fill();
            ellipse(ctx, rx + (facing === 'left' ? -1 : facing === 'right' ? 1 : 0), eyeY, 1.5, 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = '#fff';
            ctx.fillRect(lx - 1, eyeY - 1, 1, 1);
            ctx.fillRect(rx - 1, eyeY - 1, 1, 1);
        }

        // Nose
        if (facing === 'down') {
            ctx.fillStyle = '#2a2a2a';
            ellipse(ctx, 16, 10, 2.5, 1.5);
            ctx.fill();
            // Nose shine
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(15, 9, 1, 1);
        }

        ctx.restore();
    }

    // Row 0: idle down (4 frames)
    for (let i = 0; i < 4; i++) drawKoala(i, 0, { facing: 'down' });
    // Row 1: walk down
    for (let i = 0; i < 4; i++) drawKoala(i, 1, { facing: 'down', legOff: i % 2 === 0 ? 1 : -1 });
    // Row 2: walk up
    for (let i = 0; i < 4; i++) drawKoala(i, 2, { facing: 'up', legOff: i % 2 === 0 ? 1 : -1 });
    // Row 3: walk left
    for (let i = 0; i < 4; i++) drawKoala(i, 3, { facing: 'left', legOff: i % 2 === 0 ? 1 : -1 });
    // Row 4: walk right
    for (let i = 0; i < 4; i++) drawKoala(i, 4, { facing: 'right', legOff: i % 2 === 0 ? 1 : -1 });
    // Row 5: sit/work
    for (let i = 0; i < 4; i++) drawKoala(i, 5, { facing: 'down', sitting: true });
    // Row 6: sleep(2) + coffee(1) + wave(1)
    drawKoala(0, 6, { sleeping: true });
    drawKoala(1, 6, { sleeping: true });
    drawKoala(2, 6, { facing: 'down', holdCup: true });
    drawKoala(3, 6, { facing: 'down', waving: true });
    // Row 7: celebrate(2) + stretch(2)
    drawKoala(0, 7, { facing: 'down', armUp: true });
    drawKoala(1, 7, { facing: 'down' });
    drawKoala(2, 7, { facing: 'down', stretching: true });
    drawKoala(3, 7, { facing: 'down' });

    return canvas;
}

// ═══════════════════════════════════════════════════════════
//  PARTICLE TEXTURE
// ═══════════════════════════════════════════════════════════

function generateParticle() {
    const canvas = createCanvas(8, 8);
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 8);
    return canvas;
}

// ═══════════════════════════════════════════════════════════
//  ROLE DEFINITIONS
// ═══════════════════════════════════════════════════════════

const ROLES = {
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

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // Tileset
    console.log('Generating tileset...');
    const tileset = generateTileset();
    fs.writeFileSync(path.join(OUT_DIR, 'tileset.png'), tileset.toBuffer('image/png'));
    console.log('  -> tileset.png');

    // Koala sheets per role
    for (const [role, colors] of Object.entries(ROLES)) {
        console.log(`Generating koala-${role}...`);
        const sheet = generateKoalaSheet(colors.body, colors.acc, colors.detail);
        fs.writeFileSync(path.join(OUT_DIR, `koala-${role}.png`), sheet.toBuffer('image/png'));
        console.log(`  -> koala-${role}.png`);
    }

    // Default koala
    console.log('Generating koala-default...');
    const defSheet = generateKoalaSheet('#8a8a8a', '#3a3a3a', '#3ECFA0');
    fs.writeFileSync(path.join(OUT_DIR, 'koala-default.png'), defSheet.toBuffer('image/png'));
    console.log('  -> koala-default.png');

    // Particle
    console.log('Generating particle...');
    const particle = generateParticle();
    fs.writeFileSync(path.join(OUT_DIR, 'particle.png'), particle.toBuffer('image/png'));
    console.log('  -> particle.png');

    console.log(`\nDone! ${Object.keys(ROLES).length + 3} files written to ${OUT_DIR}`);
}

main();
