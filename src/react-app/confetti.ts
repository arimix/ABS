import confetti from "canvas-confetti";

const CONFETTI_COLORS = ["#ff5864", "#ff9966", "#ffffff"];

// Each call gets its own canvas + confetti instance (per the library's documented
// pattern for concurrent confetti bursts) rather than sharing the global default
// instance — overlapping celebrations (e.g. a match landing right as the group's
// top picks unlock) would otherwise race on the same shared canvas and crash.
export function fireConfetti(): () => void {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999";
  document.body.appendChild(canvas);

  const instance = confetti.create(canvas, { resize: true });
  const end = Date.now() + 1200;
  let frame: number;
  let stopped = false;

  (function tick() {
    if (stopped) return;
    instance({
      particleCount: 4,
      angle: 60,
      spread: 55,
      startVelocity: 55,
      origin: { x: 0, y: 1 },
      colors: CONFETTI_COLORS,
    });
    instance({
      particleCount: 4,
      angle: 120,
      spread: 55,
      startVelocity: 55,
      origin: { x: 1, y: 1 },
      colors: CONFETTI_COLORS,
    });
    if (Date.now() < end) frame = requestAnimationFrame(tick);
  })();

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    instance.reset();
    canvas.remove();
  };
}
