#!/usr/bin/env node
/**
 * Generates a complete office background as a single PNG.
 * No tiles, no spritesheets — one cohesive pre-rendered scene.
 *
 * Output: ../ui/assets/office-bg.png (768 x 576)
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const W = 768;
const H = 576;
const OUT = path.join(__dirname, '..', 'ui', 'assets', 'office-bg.png');

function generate() {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // ── Helpers ──────────────────────────────────────

    function roundRect(x, y, w, h, r) {
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

    function drawWoodFloor(x, y, w, h, baseColor, plankH) {
        ctx.fillStyle = baseColor;
        ctx.fillRect(x, y, w, h);
        const colors = ['#7a6850', '#6e5c44', '#82705a', '#74644e'];
        for (let py = y; py < y + h; py += plankH) {
            ctx.fillStyle = colors[Math.floor((py - y) / plankH) % colors.length];
            ctx.fillRect(x, py, w, plankH - 1);
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(x, py + plankH - 1, w, 1);
            // Plank seams (offset every other row)
            const offset = ((py - y) / plankH) % 2 === 0 ? 0 : w / 3;
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            for (let sx = offset; sx < w; sx += w / 3 * 2) {
                ctx.fillRect(x + sx, py, 1, plankH);
            }
        }
        // Subtle grain
        ctx.globalAlpha = 0.03;
        ctx.fillStyle = '#000';
        for (let gx = x; gx < x + w; gx += 5) ctx.fillRect(gx, y, 1, h);
        ctx.globalAlpha = 1;
    }

    function drawTileFloor(x, y, w, h) {
        ctx.fillStyle = '#5a7070';
        ctx.fillRect(x, y, w, h);
        const tileSize = 24;
        for (let ty = y; ty < y + h; ty += tileSize) {
            for (let tx = x; tx < x + w; tx += tileSize) {
                const odd = ((tx - x + ty - y) / tileSize) % 2 === 0;
                ctx.fillStyle = odd ? '#627878' : '#527070';
                ctx.fillRect(tx + 1, ty + 1, tileSize - 2, tileSize - 2);
                // Shine
                ctx.globalAlpha = 0.06;
                ctx.fillStyle = '#fff';
                ctx.fillRect(tx + 2, ty + 2, 4, 2);
                ctx.globalAlpha = 1;
            }
        }
    }

    function drawCarpet(x, y, w, h) {
        ctx.fillStyle = '#3a4878';
        ctx.fillRect(x, y, w, h);
        for (let cy = y; cy < y + h; cy += 3) {
            ctx.fillStyle = cy % 6 === 0 ? '#425088' : '#344068';
            ctx.fillRect(x, cy, w, 2);
        }
        // Border
        ctx.strokeStyle = '#4a5898';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    }

    function drawWall(x, y, w, h, color) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, color || '#2a2a48');
        grad.addColorStop(1, lighter(color || '#2a2a48', 15));
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, w, h);
        // Baseboard
        ctx.fillStyle = lighter(color || '#2a2a48', 30);
        ctx.fillRect(x, y + h - 4, w, 4);
        ctx.fillStyle = lighter(color || '#2a2a48', 40);
        ctx.fillRect(x, y + h - 2, w, 2);
    }

    function lighter(hex, pct) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const f = 1 + pct / 100;
        return `rgb(${Math.min(255, r * f | 0)},${Math.min(255, g * f | 0)},${Math.min(255, b * f | 0)})`;
    }

    function drawDesk(x, y) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        roundRect(x + 3, y + 3, 52, 28, 3);
        ctx.fill();
        // Desktop surface
        const grad = ctx.createLinearGradient(x, y, x, y + 26);
        grad.addColorStop(0, '#8a7058');
        grad.addColorStop(1, '#705840');
        ctx.fillStyle = grad;
        roundRect(x, y, 52, 26, 3);
        ctx.fill();
        // Edge highlight
        ctx.fillStyle = '#9a8068';
        ctx.fillRect(x + 2, y + 1, 48, 2);
        // Legs
        ctx.fillStyle = '#504030';
        ctx.fillRect(x + 4, y + 24, 4, 10);
        ctx.fillRect(x + 44, y + 24, 4, 10);
        // Monitor
        ctx.fillStyle = '#1a1a24';
        roundRect(x + 14, y - 16, 24, 18, 2);
        ctx.fill();
        // Screen
        const screenGrad = ctx.createRadialGradient(x + 26, y - 8, 2, x + 26, y - 8, 12);
        screenGrad.addColorStop(0, '#1a5040');
        screenGrad.addColorStop(1, '#0a3028');
        ctx.fillStyle = screenGrad;
        ctx.fillRect(x + 16, y - 14, 20, 14);
        // Screen glow
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = '#3ECFA0';
        ctx.fillRect(x + 16, y - 14, 20, 14);
        ctx.globalAlpha = 1;
        // Stand
        ctx.fillStyle = '#1a1a24';
        ctx.fillRect(x + 24, y - 1, 4, 4);
        ctx.fillRect(x + 20, y + 1, 12, 2);
        // Keyboard
        ctx.fillStyle = '#2a2a38';
        roundRect(x + 16, y + 6, 16, 6, 1);
        ctx.fill();
        // Mouse
        ctx.fillStyle = '#2a2a38';
        ctx.fillRect(x + 36, y + 8, 5, 4);
        // LED on monitor
        ctx.fillStyle = '#3ECFA0';
        ctx.fillRect(x + 25, y - 15, 2, 1);
    }

    function drawChair(x, y) {
        // Seat
        ctx.fillStyle = '#3a4a6a';
        roundRect(x, y, 18, 14, 4);
        ctx.fill();
        // Back
        ctx.fillStyle = '#2a3a5a';
        roundRect(x + 2, y - 8, 14, 10, 3);
        ctx.fill();
        // Wheels
        ctx.fillStyle = '#2a2a38';
        ctx.fillRect(x + 2, y + 14, 4, 2);
        ctx.fillRect(x + 12, y + 14, 4, 2);
    }

    function drawPlant(x, y, size) {
        // Pot
        ctx.fillStyle = '#8a5a30';
        ctx.beginPath();
        ctx.moveTo(x - size * 0.4, y);
        ctx.lineTo(x - size * 0.3, y + size * 0.5);
        ctx.lineTo(x + size * 0.3, y + size * 0.5);
        ctx.lineTo(x + size * 0.4, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#9a6a40';
        ctx.fillRect(x - size * 0.45, y - 2, size * 0.9, 4);
        // Leaves
        const greens = ['#2a8a40', '#3aaa50', '#4aba60', '#5aca70'];
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = greens[i];
            ctx.beginPath();
            ctx.ellipse(x + (i % 2 ? 4 : -4), y - 8 - i * 6, size * 0.5 - i * 1, size * 0.35 - i * 1, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawCouch(x, y, w) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        roundRect(x + 2, y + 2, w, 24, 5);
        ctx.fill();
        // Seat
        ctx.fillStyle = '#4a6088';
        roundRect(x, y, w, 22, 5);
        ctx.fill();
        // Cushions
        ctx.fillStyle = '#5a70a0';
        roundRect(x + 4, y + 4, w / 2 - 5, 14, 3);
        ctx.fill();
        roundRect(x + w / 2 + 1, y + 4, w / 2 - 5, 14, 3);
        ctx.fill();
        // Arms
        ctx.fillStyle = '#3a5070';
        roundRect(x - 4, y + 2, 8, 18, 4);
        ctx.fill();
        roundRect(x + w - 4, y + 2, 8, 18, 4);
        ctx.fill();
    }

    function drawBookshelf(x, y) {
        // Frame
        ctx.fillStyle = '#5a4020';
        roundRect(x, y, 28, 40, 2);
        ctx.fill();
        ctx.fillStyle = '#6a5030';
        ctx.fillRect(x + 2, y + 1, 24, 38);
        // Books on shelves
        const colors = ['#8a3030', '#308a30', '#30308a', '#8a8a30', '#8a308a', '#308a8a'];
        for (let shelf = 0; shelf < 3; shelf++) {
            const sy = y + 3 + shelf * 13;
            ctx.fillStyle = '#4a3018';
            ctx.fillRect(x + 2, sy + 10, 24, 2);
            for (let b = 0; b < 5; b++) {
                const bh = 7 + (b % 3);
                ctx.fillStyle = colors[(b + shelf * 2) % colors.length];
                ctx.fillRect(x + 4 + b * 5, sy + (10 - bh), 4, bh);
                ctx.globalAlpha = 0.15;
                ctx.fillStyle = '#fff';
                ctx.fillRect(x + 4 + b * 5, sy + (10 - bh), 1, bh);
                ctx.globalAlpha = 1;
            }
        }
    }

    function drawCoffeeMachine(x, y) {
        ctx.fillStyle = '#505858';
        roundRect(x, y, 22, 28, 3);
        ctx.fill();
        ctx.fillStyle = '#404848';
        ctx.fillRect(x + 3, y + 3, 16, 12);
        ctx.fillStyle = '#ff5030';
        ctx.fillRect(x + 5, y + 6, 4, 3);
        ctx.fillStyle = '#3ECFA0';
        ctx.fillRect(x + 11, y + 6, 4, 3);
        // Cup
        ctx.fillStyle = '#e8d8c8';
        roundRect(x + 6, y + 18, 10, 8, 2);
        ctx.fill();
        ctx.fillStyle = '#8a6040';
        ctx.fillRect(x + 8, y + 19, 6, 5);
    }

    function drawWindow(x, y, w, h) {
        // Frame
        ctx.fillStyle = '#4a4a68';
        ctx.fillRect(x, y, w, h);
        // Glass
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, '#1a3050');
        grad.addColorStop(0.5, '#2a4868');
        grad.addColorStop(1, '#1a3858');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        // Cross bars
        ctx.fillStyle = '#4a4a68';
        ctx.fillRect(x + w / 2 - 1, y + 2, 2, h - 4);
        ctx.fillRect(x + 2, y + h / 2 - 1, w - 4, 2);
        // Reflection
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + 14, y + 4);
        ctx.lineTo(x + 4, y + 16);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawDoor(x, y, w, h) {
        ctx.fillStyle = '#6a5030';
        roundRect(x, y, w, h, 2);
        ctx.fill();
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, '#7a6040');
        grad.addColorStop(0.5, '#8a7050');
        grad.addColorStop(1, '#6a5030');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        // Handle
        ctx.fillStyle = '#d4a830';
        ctx.beginPath();
        ctx.arc(x + w - 8, y + h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawServerRack(x, y) {
        ctx.fillStyle = '#1a1a22';
        roundRect(x, y, 24, 38, 2);
        ctx.fill();
        for (let i = 0; i < 5; i++) {
            const uy = y + 3 + i * 7;
            ctx.fillStyle = '#282830';
            ctx.fillRect(x + 2, uy, 20, 5);
            ctx.fillStyle = i % 2 === 0 ? '#3ECFA0' : '#ff4040';
            ctx.fillRect(x + 4, uy + 1, 3, 2);
            ctx.fillStyle = '#222';
            for (let v = 0; v < 3; v++) ctx.fillRect(x + 10 + v * 4, uy + 1, 2, 2);
        }
    }

    function drawWaterCooler(x, y) {
        ctx.fillStyle = '#b0b0b0';
        roundRect(x, y + 14, 18, 18, 2);
        ctx.fill();
        ctx.fillStyle = '#78a8d8';
        ctx.beginPath();
        ctx.ellipse(x + 9, y + 8, 7, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#88b8e8';
        ctx.beginPath();
        ctx.ellipse(x + 9, y + 6, 5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(x + 7, y + 4, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawFilingCabinet(x, y) {
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        roundRect(x + 2, y + 2, 22, 34, 2);
        ctx.fill();
        ctx.fillStyle = '#909090';
        roundRect(x, y, 22, 32, 2);
        ctx.fill();
        for (let d = 0; d < 3; d++) {
            const dy = y + 2 + d * 10;
            ctx.fillStyle = '#808080';
            ctx.fillRect(x + 2, dy, 18, 8);
            ctx.fillStyle = '#707070';
            ctx.fillRect(x + 8, dy + 3, 6, 2);
        }
    }

    function drawLamp(x, y) {
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.ellipse(x, y + 28, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#555';
        ctx.fillRect(x - 1, y + 8, 2, 20);
        const grad = ctx.createLinearGradient(x - 10, y, x + 10, y);
        grad.addColorStop(0, '#d8a840');
        grad.addColorStop(0.5, '#f8d860');
        grad.addColorStop(1, '#d8a840');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - 10, y + 10);
        ctx.lineTo(x + 10, y + 10);
        ctx.lineTo(x + 7, y);
        ctx.lineTo(x - 7, y);
        ctx.closePath();
        ctx.fill();
        // Light glow
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffe080';
        ctx.beginPath();
        ctx.ellipse(x, y + 14, 14, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawPainting(x, y) {
        ctx.fillStyle = '#7a6a30';
        roundRect(x, y, 30, 22, 2);
        ctx.fill();
        const grad = ctx.createLinearGradient(x + 2, y + 2, x + 2, y + 20);
        grad.addColorStop(0, '#2a5a8a');
        grad.addColorStop(0.6, '#4a8a5a');
        grad.addColorStop(1, '#3a6a4a');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, 26, 18);
        ctx.fillStyle = '#f0c848';
        ctx.beginPath();
        ctx.arc(x + 10, y + 8, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawClock(x, y) {
        ctx.fillStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2a';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y);
        ctx.stroke();
        ctx.fillStyle = '#ff4040';
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBeanbag(x, y) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.ellipse(x, y + 6, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        const grad = ctx.createRadialGradient(x, y, 2, x, y, 14);
        grad.addColorStop(0, '#7a98c0');
        grad.addColorStop(1, '#5a7898');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(x, y, 13, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(x - 4, y - 4, 5, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    function drawVending(x, y) {
        ctx.fillStyle = '#2e2e58';
        roundRect(x, y, 24, 36, 3);
        ctx.fill();
        ctx.fillStyle = '#1e1e48';
        ctx.fillRect(x + 3, y + 3, 18, 24);
        const colors = ['#ff4848', '#48ff48', '#4888ff', '#ffff48', '#ff48ff', '#48ffff'];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 2; c++) {
                ctx.fillStyle = colors[r * 2 + c];
                roundRect(x + 5 + c * 9, y + 5 + r * 7, 7, 5, 1);
                ctx.fill();
            }
        }
        ctx.fillStyle = '#888';
        ctx.fillRect(x + 10, y + 29, 3, 4);
    }

    // ── DRAW THE OFFICE ──────────────────────────────

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);

    // ── Manager Room (top section, y: 0-160) ─────
    const mgrY = 0, mgrH = 160;
    drawWoodFloor(8, 28, W - 16, mgrH - 32, '#5a4e3a', 10);

    // Top wall
    drawWall(0, 0, W, 28, '#2a2a48');
    // Windows on top wall
    for (let wx = 60; wx < W - 60; wx += 120) {
        drawWindow(wx, 2, 40, 22);
    }

    // Paintings between windows
    drawPainting(160, 2);
    drawPainting(400, 2);
    drawClock(560, 14);

    // Glass partition (bottom of manager room)
    ctx.fillStyle = 'rgba(62,207,160,0.06)';
    ctx.fillRect(8, mgrH - 6, W - 16, 12);
    ctx.fillStyle = '#3a3a58';
    ctx.fillRect(8, mgrH - 2, W - 16, 1);
    ctx.fillRect(8, mgrH + 3, W - 16, 1);
    ctx.fillStyle = 'rgba(62,207,160,0.15)';
    ctx.fillRect(8, mgrH - 1, W - 16, 4);
    // Door in glass
    drawDoor(W / 2 - 14, mgrH - 6, 28, 12);

    // Manager desk (center)
    drawDesk(W / 2 - 50, 70);
    drawDesk(W / 2 + 2, 70);
    drawChair(W / 2 - 8, 100);

    // Plants
    drawPlant(30, 50, 14);
    drawPlant(W - 40, 50, 14);

    // ── Side walls ───────────────────────────────
    ctx.fillStyle = '#2a2a48';
    ctx.fillRect(0, 0, 8, H);
    ctx.fillRect(W - 8, 0, 8, H);
    ctx.fillRect(0, H - 8, W, 8);

    // ── Main Work Area (left, y: 168-568) ────────
    const workX = 8, workY = 168, workW = 480, workH = H - 168 - 8;
    drawWoodFloor(workX, workY, workW, workH, '#6a5540', 10);

    // Divider wall between work area and break room
    ctx.fillStyle = '#2e2e50';
    ctx.fillRect(workX + workW, workY, 8, workH);
    ctx.fillStyle = '#3e3e60';
    ctx.fillRect(workX + workW, workY, 8, 2);
    // Door in divider
    drawDoor(workX + workW - 2, workY + workH / 2 - 16, 12, 32);

    // Work desks (3 rows of 2-3)
    const deskRows = [
        [{ x: 40, y: workY + 30 }, { x: 180, y: workY + 30 }, { x: 320, y: workY + 30 }],
        [{ x: 40, y: workY + 140 }, { x: 180, y: workY + 140 }, { x: 320, y: workY + 140 }],
        [{ x: 40, y: workY + 250 }, { x: 180, y: workY + 250 }],
    ];
    deskRows.forEach(row => {
        row.forEach(d => {
            drawDesk(d.x, d.y);
            drawChair(d.x + 18, d.y + 36);
        });
    });

    // Bookshelf against left wall
    drawBookshelf(14, workY + 100);
    drawBookshelf(14, workY + 200);

    // Server rack
    drawServerRack(440, workY + 80);

    // Filing cabinet
    drawFilingCabinet(440, workY + 180);

    // Lamp
    drawLamp(440, workY + 260);

    // ── Break Room (right top, y: 168-370) ───────
    const breakX = workX + workW + 8, breakY = workY, breakW = W - breakX - 8, breakH = 200;
    drawTileFloor(breakX, breakY, breakW, breakH);

    // Divider between break room and lounge
    ctx.fillStyle = '#2e2e50';
    ctx.fillRect(breakX, breakY + breakH, breakW, 6);
    drawDoor(breakX + breakW / 2 - 14, breakY + breakH - 2, 28, 10);

    // Coffee machine
    drawCoffeeMachine(breakX + 20, breakY + 20);

    // Water cooler
    drawWaterCooler(breakX + 60, breakY + 20);

    // Vending machine
    drawVending(breakX + 120, breakY + 20);

    // Small table
    ctx.fillStyle = '#7a6848';
    roundRect(breakX + 60, breakY + 90, 50, 30, 4);
    ctx.fill();
    ctx.fillStyle = '#8a7858';
    ctx.fillRect(breakX + 62, breakY + 91, 46, 2);

    // Chairs around table
    drawChair(breakX + 50, breakY + 130);
    drawChair(breakX + 90, breakY + 130);
    drawChair(breakX + 70, breakY + 75);

    // Plant
    drawPlant(breakX + breakW - 30, breakY + 30, 12);

    // ── Lounge (right bottom, y: 374-568) ────────
    const loungeX = breakX, loungeY = breakY + breakH + 6, loungeW = breakW, loungeH = H - loungeY - 8;
    drawCarpet(loungeX, loungeY, loungeW, loungeH);

    // Couches
    drawCouch(loungeX + 15, loungeY + 20, 60);
    drawCouch(loungeX + 15, loungeY + 80, 60);

    // Bean bags
    drawBeanbag(loungeX + 120, loungeY + 40);
    drawBeanbag(loungeX + 150, loungeY + 80);

    // Coffee table
    ctx.fillStyle = '#5a4a30';
    roundRect(loungeX + 85, loungeY + 40, 28, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#6a5a40';
    ctx.fillRect(loungeX + 87, loungeY + 41, 24, 2);

    // Plant in lounge
    drawPlant(loungeX + loungeW - 30, loungeY + loungeH - 40, 12);

    // ── Room labels ──────────────────────────────
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('MANAGER OFFICE', W / 2 - 50, 46);
    ctx.fillText('WORKSPACE', 200, workY + 18);
    ctx.fillText('BREAK ROOM', breakX + 40, breakY + breakH - 10);
    ctx.fillText('LOUNGE', loungeX + 50, loungeY + loungeH - 10);

    // Save
    fs.writeFileSync(OUT, canvas.toBuffer('image/png'));
    console.log('Office background written to', OUT, `(${W}x${H})`);
}

generate();
