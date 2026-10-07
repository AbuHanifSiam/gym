// Generates the PWA / home-screen icons (a white dumbbell on emerald) as PNGs using only
// Node built-ins. Run: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [5, 150, 105]; // emerald-600
const FG = [255, 255, 255];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Dumbbell in a 64-unit design space (same shape as public/favicon.svg).
const RECTS = [
  [14, 26, 6, 12],
  [44, 26, 6, 12],
  [20, 22, 5, 20],
  [39, 22, 5, 20],
  [25, 30, 14, 4],
];
const inDumbbell = (u, v) =>
  RECTS.some(([x, y, w, h]) => u >= x && u < x + w && v >= y && v < y + h);

/**
 * @param scale  how much of the icon the dumbbell spans (smaller for maskable safe zone)
 * @param round  corner radius as a fraction of size (0 = full-bleed square)
 */
function icon(size, { scale = 1, round = 0.22 } = {}) {
  const r = size * round;
  return png(size, (x, y) => {
    // Rounded-square mask with 2x2 supersampling for smooth corners.
    let cover = 0;
    for (const [dx, dy] of [
      [-0.25, -0.25],
      [0.25, -0.25],
      [-0.25, 0.25],
      [0.25, 0.25],
    ]) {
      const px = x + dx;
      const py = y + dy;
      const cx = Math.min(Math.max(px, r), size - r);
      const cy = Math.min(Math.max(py, r), size - r);
      if (round === 0 || (px - cx) ** 2 + (py - cy) ** 2 <= r * r) cover++;
    }
    if (cover === 0) return [0, 0, 0, 0];
    const u = 32 + ((x / size) * 64 - 32) / scale;
    const v = 32 + ((y / size) * 64 - 32) / scale;
    const [cr, cg, cb] = inDumbbell(u, v) ? FG : BG;
    return [cr, cg, cb, Math.round((cover / 4) * 255)];
  });
}

const out = (name, buf) => writeFileSync(new URL(`../public/${name}`, import.meta.url), buf);
out('icon-192.png', icon(192, { scale: 1.25 }));
out('icon-512.png', icon(512, { scale: 1.25 }));
// Maskable: full-bleed background, artwork inside the central 80% safe zone.
out('icon-maskable-512.png', icon(512, { scale: 1.0, round: 0 }));
// iOS adds its own rounded corners and doesn't support transparency.
out('apple-touch-icon.png', icon(180, { scale: 1.2, round: 0 }));
console.log('Icons written to public/');
