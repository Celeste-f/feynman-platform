// scripts/genPwaIcons.cjs —— 程序化生成 PWA 图标（第十五次课）
// 纯 Node 手写 PNG（zlib + CRC32），画一个渐变底 + Φ（费曼/希腊phi）图案。
// 用法：node scripts/genPwaIcons.cjs  （生成 public/pwa-192x192.png 和 pwa-512x512.png）
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---------- 最小 PNG 编码器 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, pixelFn) {
  // IHDR：8bit RGBA
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // bit depth, color type RGBA
  // 原始数据：每行前置 filter 字节 0
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    const rowStart = y * (1 + w * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = pixelFn(x, y, w, h);
      const o = rowStart + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Φ 图案：深蓝→紫渐变底 + 圆环 + 竖笔 ----------
function phi(x, y, w, h) {
  const cx = w / 2, cy = h / 2;
  const t = (x + y) / (w + h);
  let r = Math.round(26 + t * (123 - 26));
  let g = Math.round(42 + t * (47 - 42));
  let b = Math.round(110 + t * (247 - 110));
  const d = Math.hypot(x - cx, y - cy) / w;
  const ring = Math.abs(d - 0.26) < 0.045 && Math.abs(y - cy) / h < 0.3; // 圆环（上下开口让竖笔穿过）
  const bar = Math.abs(x - cx) / w < 0.045 && Math.abs(y - cy) / h < 0.34; // 竖笔
  if (ring || bar) return [255, 255, 255, 255];
  // 中心微高光
  const glow = Math.max(0, 0.12 - d) * 260;
  return [Math.min(255, r + glow), Math.min(255, g + glow), Math.min(255, b + glow), 255];
}

const outDir = path.join(__dirname, '..', 'public');
for (const size of [192, 512]) {
  const file = path.join(outDir, `pwa-${size}x${size}.png`);
  fs.writeFileSync(file, encodePng(size, size, phi));
  console.log('✅ 生成', file, `(${size}x${size})`);
}
