import fs from "node:fs";
import zlib from "node:zlib";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/extract-pdf-text.mjs <file.pdf>");
  process.exit(1);
}

const input = fs.readFileSync(file);
const latin = input.toString("latin1");

function decodePdfString(raw) {
  raw = raw.replace(/\\([nrtbf()\\])/g, (_, ch) => {
    return { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[ch];
  });
  raw = raw.replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
  const bytes = Buffer.from(raw, "latin1");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode(bytes.readUInt16BE(i));
    return out;
  }
  return bytes.toString("utf8").replace(/\u0000/g, "");
}

function extractTextFromContent(s) {
  const chunks = [];
  const re = /\((?:\\.|[^\\)])*\)\s*Tj|\[(.*?)\]\s*TJ/gs;
  let m;
  while ((m = re.exec(s))) {
    if (m[0].endsWith("Tj")) {
      const str = m[0].match(/\(((?:\\.|[^\\)])*)\)\s*Tj/s);
      if (str) chunks.push(decodePdfString(str[1]));
    } else if (m[1]) {
      const parts = m[1].match(/\((?:\\.|[^\\)])*\)/gs) || [];
      chunks.push(parts.map((p) => decodePdfString(p.slice(1, -1))).join(""));
    }
  }
  return chunks.join(" ");
}

const outputs = [];
const streamRe = /<<(.*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
let m;
while ((m = streamRe.exec(latin))) {
  const dict = m[1];
  let data = Buffer.from(m[2], "latin1");
  if (/\/FlateDecode/.test(dict)) {
    try {
      data = zlib.inflateSync(data);
    } catch {
      continue;
    }
  }
  const text = data.toString("latin1");
  const extracted = extractTextFromContent(text);
  if (extracted.trim()) outputs.push(extracted);
  const ascii = text.match(/[A-Za-z0-9][A-Za-z0-9 .,;:!?'"()[\]\/%+\-]{8,}/g);
  if (ascii) outputs.push(...ascii);
}

console.log(
  outputs
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
);
