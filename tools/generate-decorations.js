#!/usr/bin/env node
/**
 * Generates individual decoration PNGs with natural dimensions.
 * Each item has its own size matching its real-world proportions.
 * Output: ../ui/assets/deco-{name}.png
 */

const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'ui', 'assets');

function save(name, canvas) {
    fs.writeFileSync(path.join(OUT, `deco-${name}.png`), canvas.toBuffer('image/png'));
    console.log(`  deco-${name}.png (${canvas.width}x${canvas.height})`);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function make(w, h) {
    const c = createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    return { c, ctx };
}

// ─── PLANTS ──────────────────────────────────────────

function genPlantSmall() {
    const { c, ctx } = make(28, 40);
    // Pot
    ctx.fillStyle = '#8a5a30';
    ctx.beginPath(); ctx.moveTo(6, 24); ctx.lineTo(4, 40); ctx.lineTo(24, 40); ctx.lineTo(22, 24); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9a6a40'; ctx.fillRect(5, 22, 18, 4);
    // Leaves
    const g = ['#1a7a30', '#2a9a40', '#3aaa50', '#4aba60'];
    g.forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(14 + (i%2?3:-3), 18 - i*5, 10-i, 6-i, 0, 0, Math.PI*2); ctx.fill(); });
    save('plant-small', c);
}

function genPlantLarge() {
    const { c, ctx } = make(44, 56);
    ctx.fillStyle = '#7a5028';
    ctx.beginPath(); ctx.moveTo(10, 34); ctx.lineTo(7, 56); ctx.lineTo(37, 56); ctx.lineTo(34, 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a6038'; ctx.fillRect(8, 32, 28, 4);
    const g = ['#1a6a28', '#2a8a38', '#3a9a48', '#4aaa58', '#5aba68'];
    g.forEach((col, i) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(22 + (i%2?5:-5), 28 - i*6, 16-i*2, 8-i, 0, 0, Math.PI*2); ctx.fill(); });
    ctx.fillStyle = '#6aca78'; ctx.beginPath(); ctx.ellipse(22, 4, 6, 4, 0, 0, Math.PI*2); ctx.fill();
    save('plant-large', c);
}

function genCactus() {
    const { c, ctx } = make(30, 44);
    ctx.fillStyle = '#9a6a38';
    ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(6, 44); ctx.lineTo(24, 44); ctx.lineTo(22, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#aa7a48'; ctx.fillRect(7, 28, 16, 3);
    ctx.fillStyle = '#2a9a38'; roundRect(ctx, 11, 6, 8, 24, 4); ctx.fill();
    ctx.fillStyle = '#3aaa48'; roundRect(ctx, 3, 14, 9, 5, 3); ctx.fill(); ctx.fillRect(11, 14, 3, 5);
    ctx.fillStyle = '#3aaa48'; roundRect(ctx, 18, 10, 9, 5, 3); ctx.fill(); ctx.fillRect(17, 10, 3, 5);
    ctx.globalAlpha = 0.15; ctx.fillStyle = '#fff'; ctx.fillRect(13, 7, 2, 22); ctx.globalAlpha = 1;
    save('cactus', c);
}

// ─── SEATING ─────────────────────────────────────────

function genCouch() {
    const { c, ctx } = make(80, 36);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; roundRect(ctx, 3, 6, 76, 28, 6); ctx.fill();
    ctx.fillStyle = '#4a6088'; roundRect(ctx, 0, 2, 80, 30, 6); ctx.fill();
    ctx.fillStyle = '#5a70a0'; roundRect(ctx, 6, 6, 32, 20, 4); ctx.fill();
    ctx.fillStyle = '#5a70a0'; roundRect(ctx, 42, 6, 32, 20, 4); ctx.fill();
    ctx.fillStyle = '#3a5070'; roundRect(ctx, -2, 4, 10, 26, 5); ctx.fill();
    ctx.fillStyle = '#3a5070'; roundRect(ctx, 72, 4, 10, 26, 5); ctx.fill();
    ctx.globalAlpha = 0.1; ctx.fillStyle = '#fff'; ctx.fillRect(8, 7, 64, 3); ctx.globalAlpha = 1;
    save('couch', c);
}

function genBeanbag() {
    const { c, ctx } = make(36, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.beginPath(); ctx.ellipse(18, 24, 16, 6, 0, 0, Math.PI*2); ctx.fill();
    const grad = ctx.createRadialGradient(18, 14, 2, 18, 14, 16);
    grad.addColorStop(0, '#7a98c0'); grad.addColorStop(1, '#5a7898');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(18, 14, 16, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(12, 8, 6, 5, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    save('beanbag', c);
}

function genChair() {
    const { c, ctx } = make(22, 28);
    ctx.fillStyle = '#3a4a6a'; roundRect(ctx, 2, 10, 18, 14, 4); ctx.fill();
    ctx.fillStyle = '#2a3a5a'; roundRect(ctx, 4, 0, 14, 12, 3); ctx.fill();
    ctx.fillStyle = '#2a2a38'; ctx.fillRect(4, 24, 4, 4); ctx.fillRect(14, 24, 4, 4);
    save('chair', c);
}

// ─── TABLES ──────────────────────────────────────────

function genCoffeeTable() {
    const { c, ctx } = make(44, 28);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; roundRect(ctx, 3, 3, 40, 24, 4); ctx.fill();
    const grad = ctx.createLinearGradient(0, 0, 0, 22);
    grad.addColorStop(0, '#7a6848'); grad.addColorStop(1, '#5a4828');
    ctx.fillStyle = grad; roundRect(ctx, 0, 0, 44, 22, 4); ctx.fill();
    ctx.fillStyle = '#8a7858'; ctx.fillRect(2, 1, 40, 2);
    ctx.fillStyle = '#4a3820'; ctx.fillRect(4, 22, 4, 6); ctx.fillRect(36, 22, 4, 6);
    save('coffee-table', c);
}

function genSmallTable() {
    const { c, ctx } = make(28, 24);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; roundRect(ctx, 2, 2, 26, 22, 3); ctx.fill();
    ctx.fillStyle = '#6a5838'; roundRect(ctx, 0, 0, 28, 20, 3); ctx.fill();
    ctx.fillStyle = '#7a6848'; ctx.fillRect(2, 1, 24, 2);
    ctx.fillStyle = '#4a3820'; ctx.fillRect(3, 20, 3, 4); ctx.fillRect(22, 20, 3, 4);
    save('small-table', c);
}

// ─── APPLIANCES ──────────────────────────────────────

function genCoffeeMachine() {
    const { c, ctx } = make(28, 38);
    ctx.fillStyle = '#505858'; roundRect(ctx, 2, 2, 24, 34, 3); ctx.fill();
    ctx.fillStyle = '#404848'; ctx.fillRect(4, 4, 20, 14);
    ctx.fillStyle = '#ff5030'; ctx.fillRect(6, 8, 5, 4);
    ctx.fillStyle = '#3ECFA0'; ctx.fillRect(14, 8, 5, 4);
    ctx.fillStyle = '#383838'; ctx.fillRect(4, 20, 20, 4);
    ctx.fillStyle = '#e8d8c8'; roundRect(ctx, 8, 26, 12, 8, 2); ctx.fill();
    ctx.fillStyle = '#8a6040'; ctx.fillRect(10, 27, 8, 5);
    // Steam
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff';
    ctx.fillRect(12, 0, 1, 3); ctx.fillRect(15, 1, 1, 2);
    ctx.globalAlpha = 1;
    save('coffee-machine', c);
}

function genWaterCooler() {
    const { c, ctx } = make(24, 42);
    ctx.fillStyle = '#b0b0b0'; roundRect(ctx, 3, 20, 18, 20, 2); ctx.fill();
    ctx.fillStyle = '#78a8d8'; ctx.beginPath(); ctx.ellipse(12, 12, 8, 12, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#88b8e8'; ctx.beginPath(); ctx.ellipse(12, 10, 6, 9, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(9, 6, 3, 4, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#888'; ctx.fillRect(11, 20, 2, 4);
    save('water-cooler', c);
}

function genVending() {
    const { c, ctx } = make(30, 48);
    ctx.fillStyle = '#2e2e58'; roundRect(ctx, 0, 0, 30, 48, 4); ctx.fill();
    ctx.fillStyle = '#1e1e48'; ctx.fillRect(3, 3, 24, 34);
    const cols = ['#ff4848','#48ff48','#4888ff','#ffff48','#ff48ff','#48ffff'];
    for (let r = 0; r < 3; r++) for (let co = 0; co < 2; co++) {
        ctx.fillStyle = cols[r*2+co]; roundRect(ctx, 5+co*12, 5+r*10, 10, 8, 2); ctx.fill();
    }
    ctx.fillStyle = '#888'; ctx.fillRect(12, 40, 4, 5);
    save('vending', c);
}

function genFridge() {
    const { c, ctx } = make(26, 42);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; roundRect(ctx, 2, 2, 24, 40, 3); ctx.fill();
    ctx.fillStyle = '#dcdcdc'; roundRect(ctx, 0, 0, 26, 40, 3); ctx.fill();
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(3, 3, 20, 14);
    ctx.fillStyle = '#c8c8c8'; ctx.fillRect(3, 20, 20, 16);
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(3, 17, 20, 3);
    ctx.fillStyle = '#999'; ctx.fillRect(20, 7, 2, 6);
    ctx.fillStyle = '#999'; ctx.fillRect(20, 24, 2, 6);
    save('fridge', c);
}

function genMicrowave() {
    const { c, ctx } = make(28, 22);
    ctx.fillStyle = '#d0d0d0'; roundRect(ctx, 0, 0, 28, 22, 2); ctx.fill();
    ctx.fillStyle = '#1a1a2a'; ctx.fillRect(2, 2, 18, 14);
    ctx.fillStyle = '#0a2a20'; ctx.fillRect(3, 3, 16, 12);
    ctx.fillStyle = '#888'; ctx.fillRect(22, 4, 4, 3);
    ctx.fillStyle = '#3ECFA0'; ctx.fillRect(23, 10, 2, 2);
    save('microwave', c);
}

// ─── STORAGE ─────────────────────────────────────────

function genBookshelf() {
    const { c, ctx } = make(34, 52);
    ctx.fillStyle = '#5a4020'; roundRect(ctx, 0, 0, 34, 52, 2); ctx.fill();
    ctx.fillStyle = '#6a5030'; ctx.fillRect(2, 1, 30, 50);
    const bk = ['#8a3030','#308a30','#30308a','#8a8a30','#8a308a','#308a8a','#8a5030','#305070'];
    for (let s = 0; s < 4; s++) {
        const sy = 2 + s * 12;
        ctx.fillStyle = '#4a3018'; ctx.fillRect(2, sy + 10, 30, 2);
        for (let i = 0; i < 6; i++) {
            const bh = 7 + (i % 3);
            ctx.fillStyle = bk[(i+s*3)%8]; ctx.fillRect(4+i*5, sy+(10-bh), 4, bh);
            ctx.globalAlpha = 0.15; ctx.fillStyle = '#fff'; ctx.fillRect(4+i*5, sy+(10-bh), 1, bh); ctx.globalAlpha = 1;
        }
    }
    save('bookshelf', c);
}

function genFilingCabinet() {
    const { c, ctx } = make(26, 40);
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; roundRect(ctx, 2, 2, 24, 38, 2); ctx.fill();
    ctx.fillStyle = '#909090'; roundRect(ctx, 0, 0, 26, 38, 2); ctx.fill();
    for (let d = 0; d < 3; d++) {
        const dy = 2 + d * 12;
        ctx.fillStyle = '#808080'; ctx.fillRect(2, dy, 22, 10);
        ctx.fillStyle = '#707070'; ctx.fillRect(9, dy + 4, 8, 2);
    }
    save('filing-cabinet', c);
}

function genServerRack() {
    const { c, ctx } = make(28, 48);
    ctx.fillStyle = '#1a1a22'; roundRect(ctx, 0, 0, 28, 48, 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
        const uy = 3 + i * 7;
        ctx.fillStyle = '#282830'; ctx.fillRect(2, uy, 24, 5);
        ctx.fillStyle = i%2===0 ? '#3ECFA0' : '#ff4040'; ctx.fillRect(4, uy+1, 3, 2);
        ctx.fillStyle = '#222'; for (let v = 0; v < 3; v++) ctx.fillRect(10+v*5, uy+1, 3, 2);
    }
    ctx.fillStyle = '#444'; ctx.fillRect(1, 1, 1, 46); ctx.fillRect(26, 1, 1, 46);
    save('server-rack', c);
}

// ─── DECOR ───────────────────────────────────────────

function genLamp() {
    const { c, ctx } = make(24, 44);
    ctx.fillStyle = '#444'; ctx.beginPath(); ctx.ellipse(12, 40, 7, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#555'; ctx.fillRect(11, 12, 2, 28);
    const grad = ctx.createLinearGradient(2, 2, 22, 2);
    grad.addColorStop(0, '#d8a840'); grad.addColorStop(0.5, '#f8d860'); grad.addColorStop(1, '#d8a840');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(2, 14); ctx.lineTo(22, 14); ctx.lineTo(18, 2); ctx.lineTo(6, 2); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.ellipse(12, 20, 14, 8, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    save('lamp', c);
}

function genPainting() {
    const { c, ctx } = make(38, 28);
    ctx.fillStyle = '#7a6a30'; roundRect(ctx, 0, 0, 38, 28, 2); ctx.fill();
    const grad = ctx.createLinearGradient(2, 2, 2, 26);
    grad.addColorStop(0, '#2a5a8a'); grad.addColorStop(0.6, '#4a8a5a'); grad.addColorStop(1, '#3a6a4a');
    ctx.fillStyle = grad; ctx.fillRect(2, 2, 34, 24);
    ctx.fillStyle = '#f0c848'; ctx.beginPath(); ctx.arc(12, 10, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#2a6a4a'; ctx.beginPath(); ctx.moveTo(2, 26); ctx.lineTo(16, 10); ctx.lineTo(28, 26); ctx.closePath(); ctx.fill();
    save('painting', c);
}

function genClock() {
    const { c, ctx } = make(24, 24);
    ctx.fillStyle = '#e0e0e0'; ctx.beginPath(); ctx.arc(12, 12, 11, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.arc(12, 12, 9, 0, Math.PI*2); ctx.fill();
    for (let i = 0; i < 12; i++) {
        const a = (i/12)*Math.PI*2 - Math.PI/2;
        ctx.fillStyle = '#888'; ctx.fillRect(12+Math.cos(a)*7-0.5, 12+Math.sin(a)*7-0.5, 1, 1);
    }
    ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(12,12); ctx.lineTo(12,5); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(12,12); ctx.lineTo(17,12); ctx.stroke();
    ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(12,12,1.5,0,Math.PI*2); ctx.fill();
    save('clock', c);
}

function genWhiteboard() {
    const { c, ctx } = make(52, 38);
    ctx.fillStyle = '#e8e8e8'; roundRect(ctx, 0, 0, 52, 38, 2); ctx.fill();
    ctx.fillStyle = '#f8f8f8'; ctx.fillRect(3, 3, 46, 28);
    ctx.fillStyle = '#555'; ctx.fillRect(2, 32, 48, 4);
    ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6,8); ctx.lineTo(30,8); ctx.stroke();
    ctx.strokeStyle = '#3060ff'; ctx.beginPath(); ctx.moveTo(6,14); ctx.lineTo(40,14); ctx.stroke();
    ctx.strokeStyle = '#30a030'; ctx.beginPath(); ctx.moveTo(6,20); ctx.lineTo(22,20); ctx.stroke();
    ctx.fillStyle = '#ff4040'; ctx.fillRect(6, 33, 6, 2);
    ctx.fillStyle = '#3060ff'; ctx.fillRect(16, 33, 6, 2);
    ctx.fillStyle = '#30a030'; ctx.fillRect(26, 33, 6, 2);
    save('whiteboard', c);
}

function genRug() {
    const { c, ctx } = make(64, 44);
    ctx.fillStyle = '#3a2848'; roundRect(ctx, 0, 0, 64, 44, 4); ctx.fill();
    ctx.fillStyle = '#4a3858'; roundRect(ctx, 3, 3, 58, 38, 3); ctx.fill();
    ctx.fillStyle = '#5a4868'; roundRect(ctx, 6, 6, 52, 32, 2); ctx.fill();
    ctx.globalAlpha = 0.08; ctx.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) ctx.fillRect(8+i*8, 8, 4, 28);
    ctx.globalAlpha = 1;
    save('rug', c);
}

function genTrashCan() {
    const { c, ctx } = make(16, 22);
    ctx.fillStyle = '#606060';
    ctx.beginPath(); ctx.moveTo(2, 6); ctx.lineTo(0, 22); ctx.lineTo(16, 22); ctx.lineTo(14, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#707070'; ctx.fillRect(1, 4, 14, 3);
    ctx.fillStyle = '#505050'; ctx.fillRect(3, 8, 10, 12);
    save('trash-can', c);
}

function genPingPong() {
    const { c, ctx } = make(72, 44);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; roundRect(ctx, 3, 3, 68, 40, 3); ctx.fill();
    ctx.fillStyle = '#1a6a3a'; roundRect(ctx, 0, 0, 72, 40, 3); ctx.fill();
    ctx.fillStyle = '#2a7a4a'; ctx.fillRect(2, 2, 68, 36);
    ctx.fillStyle = '#e0e0e0'; ctx.fillRect(35, 0, 2, 40);
    ctx.fillStyle = '#e0e0e0'; ctx.fillRect(30, 18, 12, 4);
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(6, 40, 5, 4); ctx.fillRect(61, 40, 5, 4);
    save('ping-pong', c);
}

function genPhotocopier() {
    const { c, ctx } = make(30, 34);
    ctx.fillStyle = '#d0d0d0'; roundRect(ctx, 0, 8, 30, 26, 3); ctx.fill();
    ctx.fillStyle = '#e8e8e8'; ctx.fillRect(4, 2, 22, 8);
    ctx.fillStyle = '#b0b0b0'; ctx.fillRect(2, 10, 26, 18);
    ctx.fillStyle = '#3ECFA0'; ctx.fillRect(22, 12, 4, 3);
    ctx.fillStyle = '#888'; ctx.fillRect(4, 30, 22, 3);
    save('photocopier', c);
}

function genTrophy() {
    const { c, ctx } = make(20, 28);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(6, 8, 8, 10);
    ctx.fillRect(4, 4, 12, 5);
    ctx.fillRect(8, 2, 4, 3);
    ctx.fillRect(2, 6, 4, 4);
    ctx.fillRect(14, 6, 4, 4);
    ctx.fillStyle = '#5a4a20'; ctx.fillRect(4, 18, 12, 3);
    ctx.fillStyle = '#6a5a30'; ctx.fillRect(2, 21, 16, 4);
    ctx.fillStyle = '#7a6a40'; ctx.fillRect(0, 25, 20, 3);
    save('trophy', c);
}

// ─── MAIN ────────────────────────────────────────────

function main() {
    console.log('Generating decoration sprites...');
    genPlantSmall();
    genPlantLarge();
    genCactus();
    genCouch();
    genBeanbag();
    genChair();
    genCoffeeTable();
    genSmallTable();
    genCoffeeMachine();
    genWaterCooler();
    genVending();
    genFridge();
    genMicrowave();
    genBookshelf();
    genFilingCabinet();
    genServerRack();
    genLamp();
    genPainting();
    genClock();
    genWhiteboard();
    genRug();
    genTrashCan();
    genPingPong();
    genPhotocopier();
    genTrophy();
    console.log('Done! 25 decoration sprites generated.');
}

main();
