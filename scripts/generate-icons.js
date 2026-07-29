#!/usr/bin/env node
/**
 * Generates PromptIt app icons and splash screen using pure Node.js (no dependencies).
 *
 * Icon:     1024×1024 — dark background (#080a0f) with "PI" in cyan (#43f5d5)
 * Splash:   1284×2778 — dark background with "PROMPT IT" centered
 *
 * Usage: node scripts/generate-icons.js
 */
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const BG = [0x08, 0x0a, 0x0f, 0xff]; // #080a0f
const CYAN = [0x43, 0xf5, 0xd5, 0xff]; // #43f5d5
const WHITE = [0xff, 0xff, 0xff, 0xff];
const DIM_WHITE = [0xaa, 0xaa, 0xaa, 0xff];

// --- CRC32 (used in PNG) ---
function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeB, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeB, data, crcVal]);
}

function writePNG(filePath, width, height, pixels) {
  // pixels: array of [r,g,b,a] rows, top to bottom (row-major)

  // Filter byte 0 (None) prepended to each row
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixels[y * width + x];
      const off = 1 + x * 4;
      row[off] = r;
      row[off + 1] = g;
      row[off + 2] = b;
      row[off + 3] = a;
    }
    rawRows.push(row);
  }

  const rawData = Buffer.concat(rawRows);
  const compressed = zlib.deflateSync(rawData, { level: 9 });

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const chunks = [pngChunk("IHDR", ihdr), pngChunk("IDAT", compressed), pngChunk("IEND", Buffer.alloc(0))];

  const png = Buffer.concat([signature, ...chunks]);
  fs.writeFileSync(filePath, png);
  console.log(`  Wrote ${filePath} (${width}×${height}, ${(png.length / 1024).toFixed(1)} KB)`);
}

// --- Pixel helpers ---
function solidColor(w, h, color) {
  const pixels = [];
  for (let i = 0; i < w * h; i++) pixels.push(color);
  return pixels;
}

function blendRGBA(bg, fg, alpha) {
  // fg alpha * alpha multiplier, premultiplied over bg
  const a = (fg[3] * alpha) / 255;
  const invA = 1 - a / 255;
  return [
    Math.round(fg[0] * (a / 255) + bg[0] * invA),
    Math.round(fg[1] * (a / 255) + bg[1] * invA),
    Math.round(fg[2] * (a / 255) + bg[2] * invA),
    255,
  ];
}

function drawText(pixels, width, height, text, fg, scale, offsetY) {
  // Simple 5x7 bitmap font for uppercase letters, digits, and space
  const font = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    G: ["01110", "10001", "10000", "10111", "10001", "10001", "01110"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
    J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    0: ["01110", "10011", "10101", "10101", "10101", "11001", "01110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    3: ["01110", "10001", "00001", "00110", "00001", "10001", "01110"],
    4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00000", "01100"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  };

  const charW = 5;
  const charH = 7;
  const gap = 1;
  const totalCharW = charW + gap;

  const textW = text.length * totalCharW - gap;
  const startX = Math.floor((width - textW * scale) / 2);
  const startY = Math.floor(offsetY - (charH * scale) / 2);

  for (let ci = 0; ci < text.length; ci++) {
    const glyph = font[text[ci]] || font[" "];
    const cx = startX + ci * totalCharW * scale;
    for (let gy = 0; gy < charH; gy++) {
      for (let gx = 0; gx < charW; gx++) {
        if (glyph[gy][gx] === "1") {
          const px = cx + gx * scale;
          const py = startY + gy * scale;
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const idx = (py + dy) * width + (px + dx);
              if (idx >= 0 && idx < pixels.length) {
                pixels[idx] = blendRGBA(pixels[idx], fg, 255);
              }
            }
          }
        }
      }
    }
  }
}

// --- Generate ---
console.log("Generating PromptIt assets...");

// Icon: 1024×1024 with "PI" centered
const iconSize = 1024;
const iconPixels = solidColor(iconSize, iconSize, BG);
drawText(iconPixels, iconSize, iconSize, "PI", CYAN, 80, iconSize / 2 - 20);
writePNG(path.join(__dirname, "..", "assets", "icon.png"), iconSize, iconSize, iconPixels);

// Adaptive icon: same as icon
const adaptivePixels = solidColor(iconSize, iconSize, BG);
drawText(adaptivePixels, iconSize, iconSize, "PI", CYAN, 80, iconSize / 2 - 20);
writePNG(path.join(__dirname, "..", "assets", "adaptive-icon.png"), iconSize, iconSize, adaptivePixels);

// Splash: 1284×2778 with "PROMPT IT" centered
const splashW = 1284;
const splashH = 2778;
const splashPixels = solidColor(splashW, splashH, BG);
drawText(splashPixels, splashW, splashH, "PROMPT IT", CYAN, 50, Math.floor(splashH / 2) - 80);
// Subtitle
drawText(splashPixels, splashW, splashH, "AI PRODUCTION PLATFORM", DIM_WHITE, 13, Math.floor(splashH / 2) + 60);
writePNG(path.join(__dirname, "..", "assets", "splash-icon.png"), splashW, splashH, splashPixels);

// Favicon
const favPixels = solidColor(48, 48, BG);
drawText(favPixels, 48, 48, "PI", CYAN, 5, 24 - 5);
writePNG(path.join(__dirname, "..", "assets", "favicon.png"), 48, 48, favPixels);

console.log("Done.");
