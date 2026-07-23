const fs = require("node:fs");
const path = require("node:path");

const outDir = path.resolve(process.env.ARCHMIND_ASSET_OUT || path.resolve(__dirname, "..", "apps", "desktop", "assets"));
const primaryColor = process.env.ARCHMIND_ASSET_COLOR || "#7C3AED";
const assistantIcon = process.env.ARCHMIND_ASSET_ICON || "Bot";
fs.mkdirSync(outDir, { recursive: true });

function hexToRgb(hex, fallback = [124, 58, 237]) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!match) return fallback;
  const value = match[1];
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function makeCanvas(width, height, primary = "#7C3AED") {
  const [r, g, b] = hexToRgb(primary);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = (x / Math.max(1, width - 1)) * 0.65 + (y / Math.max(1, height - 1)) * 0.35;
      pixels[i] = mix(r, 18, t);
      pixels[i + 1] = mix(g, 24, t);
      pixels[i + 2] = mix(b, 38, t);
      pixels[i + 3] = 255;
    }
  }
  return { width, height, pixels };
}

function putPixel(canvas, x, y, rgba) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const i = (y * canvas.width + x) * 4;
  canvas.pixels[i] = rgba[0];
  canvas.pixels[i + 1] = rgba[1];
  canvas.pixels[i + 2] = rgba[2];
  canvas.pixels[i + 3] = rgba[3] ?? 255;
}

function drawCircle(canvas, cx, cy, radius, rgba) {
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) putPixel(canvas, x, y, rgba);
    }
  }
}

function drawLine(canvas, x0, y0, x1, y1, rgba, thickness = 3) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    drawCircle(canvas, x, y, thickness, rgba);
  }
}

function drawRect(canvas, x0, y0, x1, y1, rgba) {
  for (let y = Math.round(y0); y <= Math.round(y1); y++) {
    for (let x = Math.round(x0); x <= Math.round(x1); x++) putPixel(canvas, x, y, rgba);
  }
}

function drawRing(canvas, cx, cy, outer, inner, rgba) {
  for (let y = Math.floor(cy - outer); y <= Math.ceil(cy + outer); y++) {
    for (let x = Math.floor(cx - outer); x <= Math.ceil(cx + outer); x++) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d <= outer ** 2 && d >= inner ** 2) putPixel(canvas, x, y, rgba);
    }
  }
}

function decorate(canvas, scale = 1) {
  const w = canvas.width;
  const h = canvas.height;
  const s = Math.min(w, h);
  const white = [255, 255, 255, 248];
  const dark = [20, 24, 38, 255];
  const accent = [96, 165, 250, 255];
  const icon = assistantIcon === "Sparkles" ? "Bot" : assistantIcon;
  drawCircle(canvas, w * 0.5, h * 0.5, s * 0.29, white);
  if (icon === "LifeBuoy") {
    drawRing(canvas, w * 0.5, h * 0.5, s * 0.21, s * 0.12, dark);
    drawLine(canvas, w * 0.5, h * 0.28, w * 0.5, h * 0.40, accent, Math.max(2, 5 * scale));
    drawLine(canvas, w * 0.5, h * 0.60, w * 0.5, h * 0.72, accent, Math.max(2, 5 * scale));
    drawLine(canvas, w * 0.28, h * 0.5, w * 0.40, h * 0.5, accent, Math.max(2, 5 * scale));
    drawLine(canvas, w * 0.60, h * 0.5, w * 0.72, h * 0.5, accent, Math.max(2, 5 * scale));
  } else if (icon === "MessageCircle" || icon === "Headphones") {
    drawCircle(canvas, w * 0.5, h * 0.48, s * 0.18, dark);
    drawRect(canvas, w * 0.35, h * 0.57, w * 0.45, h * 0.69, dark);
    if (icon === "Headphones") {
      drawRing(canvas, w * 0.5, h * 0.49, s * 0.25, s * 0.22, accent);
      drawRect(canvas, w * 0.26, h * 0.48, w * 0.34, h * 0.62, accent);
      drawRect(canvas, w * 0.66, h * 0.48, w * 0.74, h * 0.62, accent);
    }
  } else if (icon === "FileText" || icon === "BookOpen") {
    drawRect(canvas, w * 0.36, h * 0.30, w * 0.64, h * 0.70, dark);
    drawLine(canvas, w * 0.42, h * 0.44, w * 0.58, h * 0.44, white, Math.max(1, 2 * scale));
    drawLine(canvas, w * 0.42, h * 0.54, w * 0.58, h * 0.54, white, Math.max(1, 2 * scale));
  } else if (icon === "Brain" || icon === "Bot") {
    drawRect(canvas, w * 0.35, h * 0.38, w * 0.65, h * 0.62, dark);
    drawCircle(canvas, w * 0.43, h * 0.50, s * 0.035, accent);
    drawCircle(canvas, w * 0.57, h * 0.50, s * 0.035, accent);
    drawLine(canvas, w * 0.45, h * 0.66, w * 0.55, h * 0.66, dark, Math.max(1, 2 * scale));
    drawLine(canvas, w * 0.50, h * 0.31, w * 0.50, h * 0.22, dark, Math.max(1, 3 * scale));
  } else {
    drawCircle(canvas, w * 0.5, h * 0.5, s * 0.19, dark);
    drawLine(canvas, w * 0.36, h * 0.52, w * 0.5, h * 0.34, white, Math.max(2, 4 * scale));
    drawLine(canvas, w * 0.5, h * 0.34, w * 0.65, h * 0.55, white, Math.max(2, 4 * scale));
    drawLine(canvas, w * 0.36, h * 0.52, w * 0.65, h * 0.55, white, Math.max(2, 4 * scale));
  }
}

function writeBmp(file, canvas) {
  const rowBytes = Math.ceil((canvas.width * 3) / 4) * 4;
  const pixelSize = rowBytes * canvas.height;
  const headerSize = 54;
  const out = Buffer.alloc(headerSize + pixelSize);
  out.write("BM", 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(headerSize, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(canvas.width, 18);
  out.writeInt32LE(canvas.height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(pixelSize, 34);
  for (let y = 0; y < canvas.height; y++) {
    const sourceY = canvas.height - 1 - y;
    for (let x = 0; x < canvas.width; x++) {
      const src = (sourceY * canvas.width + x) * 4;
      const dst = headerSize + y * rowBytes + x * 3;
      out[dst] = canvas.pixels[src + 2];
      out[dst + 1] = canvas.pixels[src + 1];
      out[dst + 2] = canvas.pixels[src];
    }
  }
  fs.writeFileSync(file, out);
}

function writeIco(file, canvas) {
  const width = canvas.width;
  const height = canvas.height;
  const xorSize = width * height * 4;
  const andStride = Math.ceil(width / 32) * 4;
  const andSize = andStride * height;
  const dibSize = 40 + xorSize + andSize;
  const out = Buffer.alloc(6 + 16 + dibSize);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(1, 4);
  out[6] = width === 256 ? 0 : width;
  out[7] = height === 256 ? 0 : height;
  out[8] = 0;
  out[9] = 0;
  out.writeUInt16LE(1, 10);
  out.writeUInt16LE(32, 12);
  out.writeUInt32LE(dibSize, 14);
  out.writeUInt32LE(22, 18);
  const dib = 22;
  out.writeUInt32LE(40, dib);
  out.writeInt32LE(width, dib + 4);
  out.writeInt32LE(height * 2, dib + 8);
  out.writeUInt16LE(1, dib + 12);
  out.writeUInt16LE(32, dib + 14);
  out.writeUInt32LE(xorSize, dib + 20);
  const pixels = dib + 40;
  for (let y = 0; y < height; y++) {
    const sourceY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const src = (sourceY * width + x) * 4;
      const dst = pixels + (y * width + x) * 4;
      out[dst] = canvas.pixels[src + 2];
      out[dst + 1] = canvas.pixels[src + 1];
      out[dst + 2] = canvas.pixels[src];
      out[dst + 3] = canvas.pixels[src + 3];
    }
  }
  fs.writeFileSync(file, out);
}

const icon = makeCanvas(256, 256, primaryColor);
decorate(icon, 1);
writeIco(path.join(outDir, "archmind-assistant.ico"), icon);

const header = makeCanvas(150, 57, primaryColor);
decorate(header, 0.32);
writeBmp(path.join(outDir, "installer-header.bmp"), header);

const sidebar = makeCanvas(164, 314, primaryColor);
decorate(sidebar, 0.7);
writeBmp(path.join(outDir, "installer-sidebar.bmp"), sidebar);

console.log(`Generated desktop assets in ${outDir}`);
