/**
 * Generates the NSIS installer sidebar bitmap that matches PokeGuide's dark theme.
 * Sidebar (164×314): dark #1e1e1e background, red accent strip, POKEGUIDE pixel
 * text, and a Pokéball illustration.  Run automatically before electron-builder.
 */

'use strict'
const fs   = require('fs')
const path = require('path')

// ── Canvas ────────────────────────────────────────────────────────────────────
function createCanvas(w, h, fill) {
  return { w, h, p: Array.from({length: h}, () => Array.from({length: w}, () => [...fill])) }
}
function px(c, x, y, col) {
  if (x >= 0 && x < c.w && y >= 0 && y < c.h) c.p[y][x] = col
}
function rect(c, x0, y0, x1, y1, col) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(c, x, y, col)
}

// ── Pixel font – 5×7 glyphs for every character in "POKEGUIDE" ───────────────
const G = {
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  G: ['01110','10001','10000','10111','10001','10001','01110'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  I: ['01110','00100','00100','00100','00100','00100','01110'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
}

function textW(str, s) {
  const n = [...str.toUpperCase()].filter(c => G[c]).length
  return n === 0 ? 0 : n * (5 + 1) * s - s
}

function drawText(c, str, sx, sy, col, s = 2) {
  let cx = sx
  for (const ch of str.toUpperCase()) {
    const g = G[ch]; if (!g) { cx += (5+1)*s; continue }
    for (let r = 0; r < 7; r++)
      for (let col2 = 0; col2 < 5; col2++)
        if (g[r][col2] === '1')
          for (let dy = 0; dy < s; dy++)
            for (let dx = 0; dx < s; dx++)
              px(c, cx + col2*s + dx, sy + r*s + dy, col)
    cx += (5+1)*s
  }
}

// ── Pokéball ──────────────────────────────────────────────────────────────────
function pokeball(c, cx, cy, r) {
  for (let y = Math.max(0, cy-r-1); y <= Math.min(c.h-1, cy+r+1); y++) {
    for (let x = Math.max(0, cx-r-1); x <= Math.min(c.w-1, cx+r+1); x++) {
      const dx = x-cx, dy = y-cy, d = Math.sqrt(dx*dx + dy*dy)
      if (d > r) continue

      const outerRing  = d >= r - 3.5
      const midStripe  = Math.abs(dy) < 4.5
      const centerFill = d < r * 0.20
      const centerRing = d >= r * 0.20 && d < r * 0.32

      let col
      if (outerRing || midStripe) {
        col = [0x0d, 0x0d, 0x0d]
      } else if (centerFill) {
        col = [0xe0, 0xe0, 0xe0]
      } else if (centerRing) {
        col = [0x2a, 0x2a, 0x2a]
      } else if (dy < 0) {
        const f = 1 - (d / r) * 0.30
        col = [Math.round(0xcc*f), Math.round(0x22*f), Math.round(0x22*f)]
      } else {
        const f = 1 - (d / r) * 0.30
        const v = Math.round(0xcc * f)
        col = [v, v, v]
      }
      c.p[y][x] = col
    }
  }
}

// ── BMP writer ────────────────────────────────────────────────────────────────
function saveBMP(filePath, c) {
  const rowBytes = Math.ceil((c.w * 3) / 4) * 4
  const buf = Buffer.alloc(54 + rowBytes * c.h, 0)
  buf[0]=0x42; buf[1]=0x4d
  buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(c.w, 18); buf.writeInt32LE(c.h, 22)
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28)
  for (let bmpRow = 0; bmpRow < c.h; bmpRow++) {
    const vy = c.h - 1 - bmpRow
    for (let x = 0; x < c.w; x++) {
      const [r,g,b] = c.p[vy][x], o = 54 + bmpRow*rowBytes + x*3
      buf[o]=b; buf[o+1]=g; buf[o+2]=r
    }
  }
  fs.mkdirSync(path.dirname(filePath), {recursive:true})
  fs.writeFileSync(filePath, buf)
  console.log(`  ${path.basename(filePath)}  (${c.w}×${c.h})`)
}

// ── Colours ───────────────────────────────────────────────────────────────────
const BG   = [0x1e, 0x1e, 0x1e]
const BAND = [0x25, 0x25, 0x25]
const RED  = [0xcc, 0x22, 0x22]
const SEP  = [0x3e, 0x3e, 0x3e]
const WHT  = [0xff, 0xff, 0xff]
const DIM  = [0x55, 0x55, 0x55]

// ── Build sidebar (164 × 314) ─────────────────────────────────────────────────
const s = createCanvas(164, 314, BG)

// Top branding band
rect(s, 0, 0, 163, 92, BAND)
// Separator below band
rect(s, 0, 93, 163, 94, SEP)
// Red left accent strip (full height, drawn last so it's always solid)

// "POKEGUIDE" centred in branding band
const title = 'POKEGUIDE', tScale = 2
const tw = textW(title, tScale)
const tx = Math.round((164 - tw) / 2)
const ty = 34
drawText(s, title, tx, ty, WHT, tScale)

// Thin rule under title
rect(s, tx, ty + 7*tScale + 4, tx + tw, ty + 7*tScale + 5, DIM)

// Pokéball – centred below separator
pokeball(s, 82, 205, 64)

// Subtle version label area (two short grey lines at bottom)
rect(s, 14, 295, 72, 296, [0x35, 0x35, 0x35])
rect(s, 14, 301, 52, 302, [0x2e, 0x2e, 0x2e])

// Red accent strip – paint over everything so it's crisp
rect(s, 0, 0, 4, 313, RED)

saveBMP(path.join(__dirname, '../build/installer-sidebar.bmp'), s)
console.log('Done.')
