import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [pdf, outDir = "pdf-pages", maxWidthArg = "1800"] = process.argv.slice(2);
if (!pdf) {
  console.error("Usage: node tools/extract-pdf-images.mjs <file.pdf> [outDir] [maxWidth]");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
const maxWidth = Number(maxWidthArg);
const s = fs.readFileSync(pdf).toString("latin1");
const re = /(\d+)\s+0\s+obj([\s\S]*?)stream\r?\n([\s\S]*?)\r?\nendstream/g;

function writeBmp(filename, rgb, w, h, outW) {
  const scale = Math.max(1, Math.ceil(w / outW));
  const bw = Math.floor(w / scale);
  const bh = Math.floor(h / scale);
  const rowSize = Math.ceil((bw * 3) / 4) * 4;
  const pixelBytes = rowSize * bh;
  const buf = Buffer.alloc(54 + pixelBytes);
  buf.write("BM", 0);
  buf.writeUInt32LE(54 + pixelBytes, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(bw, 18);
  buf.writeInt32LE(bh, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelBytes, 34);
  for (let y = 0; y < bh; y++) {
    const srcY = y * scale;
    const dstY = bh - 1 - y;
    for (let x = 0; x < bw; x++) {
      const srcX = x * scale;
      const src = (srcY * w + srcX) * 3;
      const dst = 54 + dstY * rowSize + x * 3;
      buf[dst] = rgb[src + 2];
      buf[dst + 1] = rgb[src + 1];
      buf[dst + 2] = rgb[src];
    }
  }
  fs.writeFileSync(filename, buf);
}

let n = 0;
for (const m of s.matchAll(re)) {
  const dict = m[2];
  if (!/\/Subtype\s*\/Image/.test(dict)) continue;
  const w = Number((dict.match(/\/Width\s+(\d+)/) || [])[1]);
  const h = Number((dict.match(/\/Height\s+(\d+)/) || [])[1]);
  if (!w || !h || !/\/DeviceRGB/.test(dict) || !/\/FlateDecode/.test(dict)) continue;
  const data = zlib.inflateSync(Buffer.from(m[3], "latin1"));
  if (data.length < w * h * 3) continue;
  n += 1;
  const name = path.join(outDir, `page-${String(n).padStart(2, "0")}.bmp`);
  writeBmp(name, data, w, h, maxWidth);
  console.log(name);
}
