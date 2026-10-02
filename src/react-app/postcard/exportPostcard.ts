import type { Map as MapLibreMap } from "maplibre-gl";
import type { Theme } from "./mapStyle";
import type { Neighborhood, Spot } from "./spots";

const FRAME = 14; // matches .pc-face padding
const SCALE = 2;

/**
 * Renders the front of the postcard to a PNG: the live WebGL map plus
 * redrawn pins, title lettering and stamp (DOM overlays can't be captured
 * from a canvas, so they're re-painted here).
 */
export async function renderPostcard(
  map: MapLibreMap,
  hood: Neighborhood,
  tour: Spot[],
  theme: Theme
): Promise<Blob> {
  await Promise.all([
    document.fonts.load('40px "Pacifico"'),
    document.fonts.load('60px "Alfa Slab One"'),
    document.fonts.load('20px "Space Mono"'),
  ]);

  const mapCanvas = map.getCanvas();
  const w = mapCanvas.clientWidth;
  const h = mapCanvas.clientHeight;
  const W = w + FRAME * 2;
  const H = h + FRAME * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // Paper frame
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, W, H);

  // Map
  map.redraw();
  ctx.save();
  roundRect(ctx, FRAME, FRAME, w, h, 6);
  ctx.clip();
  ctx.drawImage(mapCanvas, FRAME, FRAME, w, h);

  // Soft vignette, like a printed card
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(w, h) * 0.35, W / 2, H / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(60,30,10,0.22)");
  ctx.fillStyle = vg;
  ctx.fillRect(FRAME, FRAME, w, h);

  // Pins, back-to-front so nearer pins overlap farther ones
  const placed = tour
    .map((s, i) => ({ s, i, p: map.project([s.lng, s.lat]) }))
    .filter(({ p }) => p.x > -20 && p.x < w + 20 && p.y > -20 && p.y < h + 20)
    .sort((a, b) => a.p.y - b.p.y);
  for (const { s, i, p } of placed) drawPin(ctx, FRAME + p.x, FRAME + p.y, s.emoji, i + 1, theme.pin);
  ctx.restore();

  drawTitle(ctx, hood.name, theme, w);
  drawStamp(ctx, W - FRAME - 18, FRAME + 18, theme, hood);

  // Footer: credit line on the left, brand on the right
  ctx.fillStyle = "#b09a86";
  ctx.font = '600 8px "Space Mono", monospace';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText("© OpenStreetMap · OpenFreeMap · OpenMapTiles", FRAME, H - FRAME / 2);
  ctx.textAlign = "right";
  ctx.fillText("made with forkdis.com", W - FRAME, H - FRAME / 2);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not render postcard"))), "image/png")
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string, n: number, color: string) {
  const R = 19;
  const cy = y - 34;
  // ground shadow
  ctx.fillStyle = "rgba(40,20,10,0.28)";
  ctx.beginPath();
  ctx.ellipse(x, y, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // stem
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, cy + R);
  ctx.lineTo(x, y - 2);
  ctx.stroke();
  // bubble
  ctx.save();
  ctx.shadowColor = "rgba(40,20,10,0.3)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, cy, R - 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = "20px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, cy + 1);
  // number badge
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + R - 3, cy - R + 3, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 10px "Space Mono", monospace';
  ctx.fillText(String(n), x + R - 3, cy - R + 3.5);
}

function drawTitle(ctx: CanvasRenderingContext2D, name: string, theme: Theme, mapWidth: number) {
  const x = FRAME + 20;
  const y = FRAME + 22;
  const big = Math.min(54, Math.max(30, mapWidth * 0.075));

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `${big * 0.5}px "Pacifico", cursive`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#fffdf6";
  ctx.strokeText("Greetings from", x + 4, y);
  ctx.fillStyle = theme.titleShadow;
  ctx.fillText("Greetings from", x + 4, y);

  const ty = y + big * 0.72;
  ctx.font = `${big}px "Alfa Slab One", serif`;
  const label = name.toUpperCase();
  // Stacked offset shadow for the retro block-letter look
  ctx.fillStyle = theme.titleShadow;
  for (let i = 5; i >= 1; i--) ctx.fillText(label, x + i, ty + i);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#fffdf6";
  ctx.strokeText(label, x, ty);
  ctx.fillStyle = theme.title;
  ctx.fillText(label, x, ty);
}

function drawStamp(ctx: CanvasRenderingContext2D, right: number, top: number, theme: Theme, hood: Neighborhood) {
  const sw = 74;
  const sh = 90;
  const x = right - sw;
  const y = top;

  ctx.save();
  ctx.translate(x + sw / 2, y + sh / 2);
  ctx.rotate((4 * Math.PI) / 180);
  ctx.translate(-sw / 2, -sh / 2);

  // perforated edge: white body with scalloped holes punched by the map behind
  ctx.shadowColor = "rgba(40,20,10,0.25)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, sw, sh);
  ctx.shadowColor = "transparent";

  ctx.fillStyle = theme.sky;
  ctx.fillRect(6, 6, sw - 12, sh - 12);
  ctx.fillStyle = theme.park;
  ctx.fillRect(6, sh * 0.62, sw - 12, sh * 0.38 - 6);
  ctx.font = "26px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🍴", sw / 2, sh * 0.42);
  ctx.fillStyle = "#3b2a24";
  ctx.font = 'bold 9px "Space Mono", monospace';
  ctx.fillText("FORKDIS", sw / 2, sh - 16);
  ctx.textAlign = "right";
  ctx.fillText("45¢", sw - 10, 14);
  ctx.restore();

  // Postmark overlapping the stamp
  const px = x - 6;
  const py = y + sh - 14;
  ctx.strokeStyle = "rgba(59,42,36,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(px, py, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px, py, 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(59,42,36,0.6)";
  ctx.font = 'bold 6.5px "Space Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hood.city.toUpperCase().slice(0, 13), px, py - 5);
  ctx.fillText(new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }).toUpperCase(), px, py + 5);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const ly = py - 8 + i * 8;
    ctx.moveTo(px + 28, ly);
    for (let k = 0; k <= 4; k++) ctx.quadraticCurveTo(px + 32 + k * 9, ly + (k % 2 ? 4 : -4), px + 36 + k * 9, ly);
    ctx.stroke();
  }
}
