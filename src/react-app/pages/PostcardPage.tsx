import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
// MapLibre finds its worker relative to its own module. That works in dev
// (maplibre-gl is excluded from pre-bundling) but not once Vite bundles it,
// so production builds get a Vite-built worker instead.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import "../postcard/postcard.css";
import { NEIGHBORHOODS, type Spot } from "../postcard/spots";
import { THEMES, buildStyle, tourOrder } from "../postcard/mapStyle";
import { renderPostcard } from "../postcard/exportPostcard";

if (!import.meta.env.DEV) setWorkerUrl(maplibreWorkerUrl);

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Caveat:wght@500;700&family=Pacifico&family=Space+Mono:wght@400;700&display=swap";

function useGoogleFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);
}

function createPinElement(spot: Spot, n: number, onClick: () => void): HTMLElement {
  const el = document.createElement("button");
  el.className = "pc-pin";
  el.type = "button";
  el.setAttribute("aria-label", `${n}. ${spot.name}`);
  el.style.setProperty("--delay", `${n * 0.18}s`);
  el.innerHTML = `
    <span class="pc-pin-float">
      <span class="pc-pin-bubble">${spot.emoji}<span class="pc-pin-num">${n}</span></span>
      <span class="pc-pin-stem"></span>
    </span>
    <span class="pc-pin-shadow"></span>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return el;
}

export function PostcardPage() {
  useGoogleFonts();

  const [hoodId, setHoodId] = useState(NEIGHBORHOODS[0].id);
  const [themeId, setThemeId] = useState(THEMES[0].id);
  const [orbit, setOrbit] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hood = NEIGHBORHOODS.find((h) => h.id === hoodId)!;
  const theme = THEMES.find((t) => t.id === themeId)!;
  const tour = useMemo(() => tourOrder(hood.spots), [hood]);
  const active = tour.find((s) => s.id === activeId) ?? null;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const interactingRef = useRef(false);
  const orbitRef = useRef(orbit);
  orbitRef.current = orbit;

  // Create the map once
  useEffect(() => {
    const map = new MapLibreMap({
      container: containerRef.current!,
      style: buildStyle(theme, tour),
      center: [tour[0].lng, tour[0].lat],
      zoom: 13.2,
      pitch: 0,
      maxPitch: 75,
      // Attribution is rendered as a small fixed credit line on the card instead
      attributionControl: false,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    mapRef.current = map;

    const start = () => (interactingRef.current = true);
    const stop = () => (interactingRef.current = false);
    map.on("mousedown", start);
    map.on("touchstart", start);
    map.on("mouseup", stop);
    map.on("touchend", stop);
    map.on("dragend", stop);
    map.on("click", () => setActiveId(null));

    // Slow orbit for the "diorama" feel
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (orbitRef.current && !interactingRef.current && !map.isMoving()) {
        map.setBearing(map.getBearing() + dt * 0.0015);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme or neighborhood change → restyle (route line lives in the style)
  const appliedRef = useRef({ theme, tour });
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (appliedRef.current.theme === theme && appliedRef.current.tour === tour) return;
    appliedRef.current = { theme, tour };
    map.setStyle(buildStyle(theme, tour));
  }, [theme, tour]);

  // Neighborhood change → pins + swoop the camera in
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = tour.map((spot, i) =>
      new Marker({ element: createPinElement(spot, i + 1, () => focusSpot(spot)), anchor: "bottom" })
        .setLngLat([spot.lng, spot.lat])
        .addTo(map)
    );
    setActiveId(null);

    const bounds = new LngLatBounds();
    tour.forEach((s) => bounds.extend([s.lng, s.lat]));
    const fly = () => {
      const cam = map.cameraForBounds(bounds, { padding: 70 });
      map.jumpTo({ center: cam?.center ?? bounds.getCenter(), zoom: 13.2, pitch: 0, bearing: 0 });
      map.flyTo({
        center: cam?.center ?? bounds.getCenter(),
        zoom: Math.min((cam?.zoom ?? 15) + 0.35, 16.6),
        pitch: 68,
        bearing: -24,
        duration: 3200,
        essential: true,
      });
    };
    fly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour]);

  // Highlight the active pin
  useEffect(() => {
    markersRef.current.forEach((m, i) =>
      m.getElement().classList.toggle("is-active", tour[i]?.id === activeId)
    );
  }, [activeId, tour]);

  function focusSpot(spot: Spot) {
    setActiveId(spot.id);
    setFlipped(false);
    mapRef.current?.easeTo({ center: [spot.lng, spot.lat], zoom: 16.8, pitch: 64, duration: 1400 });
  }

  async function save() {
    const map = mapRef.current;
    if (!map) return;
    setSaving(true);
    try {
      const blob = await renderPostcard(map, hood, tour, theme);
      const file = new File([blob], `forkdis-${hood.id}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Greetings from ${hood.name}` }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } finally {
      setSaving(false);
    }
  }

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="pc-page" data-theme-id={theme.id}>
      <header className="pc-header">
        <Link to="/" className="pc-logo">forkdis</Link>
        <span className="pc-tag">postcards · prototype</span>
      </header>

      <div className="pc-controls">
        <div className="pc-seg" role="tablist" aria-label="Neighborhood">
          {NEIGHBORHOODS.map((h) => (
            <button
              key={h.id}
              role="tab"
              aria-selected={h.id === hoodId}
              className={h.id === hoodId ? "on" : ""}
              onClick={() => setHoodId(h.id)}
            >
              {h.name}
            </button>
          ))}
        </div>
        <div className="pc-swatches" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={t.id === themeId ? "on" : ""}
              onClick={() => setThemeId(t.id)}
              title={t.label}
              aria-label={t.label}
              style={{ background: `linear-gradient(135deg, ${t.sky} 0 45%, ${t.buildings[0]} 45% 70%, ${t.park} 70%)` }}
            />
          ))}
        </div>
      </div>

      <div className="pc-stage">
        <div className="pc-ghost pc-ghost-1" />
        <div className="pc-ghost pc-ghost-2" />
        <div className={`pc-card ${flipped ? "is-flipped" : ""}`}>
          {/* FRONT */}
          <div className="pc-face pc-front">
            <div className="pc-map" ref={containerRef} />
            <div className="pc-vignette" />
            <div className="pc-credit">
              © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
              {" · "}
              <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>
              {" · "}
              <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>
            </div>
            <div className="pc-title" style={{ ["--t" as string]: theme.title, ["--ts" as string]: theme.titleShadow }}>
              <span className="pc-greet">Greetings from</span>
              <span className="pc-name">{hood.name}</span>
            </div>
            <div className="pc-stamp" style={{ ["--sky" as string]: theme.sky, ["--park" as string]: theme.park }}>
              <span className="pc-stamp-val">45¢</span>
              <span className="pc-stamp-art">🍴</span>
              <span className="pc-stamp-name">FORKDIS</span>
            </div>
            <div className="pc-postmark">
              <span>{hood.city}</span>
              <span>{new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </div>

            {active && (
              <div className="pc-polaroid" key={active.id}>
                <button className="pc-x" onClick={() => setActiveId(null)} aria-label="Close">×</button>
                <div className="pc-photo" style={{ ["--c1" as string]: theme.sky, ["--c2" as string]: theme.buildings[0] }}>
                  <span>{active.emoji}</span>
                </div>
                <div className="pc-pol-name">{active.name}</div>
                <div className="pc-pol-meta">
                  {active.cuisine} · {active.price} · ★ {active.rating}
                </div>
                <div className="pc-pol-note">“{active.note}”</div>
              </div>
            )}
          </div>

          {/* BACK */}
          <div className="pc-face pc-back">
            <div className="pc-back-note">
              <p className="pc-hand-lg">Hey crew!</p>
              <p className="pc-hand">Tonight's little tour of {hood.name}:</p>
              <ol>
                {tour.map((s) => (
                  <li key={s.id}>
                    <span className="pc-li-emoji">{s.emoji}</span> {s.name}
                    <em> — {s.note.toLowerCase()}</em>
                  </li>
                ))}
              </ol>
              <p className="pc-hand-lg pc-sign">Wish you were here ♥</p>
            </div>
            <div className="pc-back-divider" />
            <div className="pc-back-addr">
              <div className="pc-stamp pc-stamp-back" style={{ ["--sky" as string]: theme.sky, ["--park" as string]: theme.park }}>
                <span className="pc-stamp-val">45¢</span>
                <span className="pc-stamp-art">{tour[0]?.emoji}</span>
                <span className="pc-stamp-name">FORKDIS</span>
              </div>
              <div className="pc-lines">
                <span>To: The Group Chat</span>
                <span>{hood.name}, {hood.city}</span>
                <span>{today}</span>
              </div>
              <span className="pc-postcard-word">POST CARD</span>
            </div>
          </div>
        </div>
      </div>

      <div className="pc-actions">
        <button className={`pc-btn ${orbit ? "on" : ""}`} onClick={() => setOrbit((o) => !o)}>
          {orbit ? "⏸ Pause orbit" : "↻ Orbit"}
        </button>
        <button className="pc-btn" onClick={() => setFlipped((f) => !f)}>
          {flipped ? "↺ Front" : "↻ Flip it"}
        </button>
        <button className="pc-btn pc-primary" onClick={save} disabled={saving || flipped}>
          {saving ? "Developing…" : "✉ Save postcard"}
        </button>
      </div>

      <ol className="pc-spots">
        {tour.map((s, i) => (
          <li key={s.id}>
            <button className={s.id === activeId ? "on" : ""} onClick={() => focusSpot(s)}>
              <span className="pc-spot-num" style={{ background: theme.pin }}>{i + 1}</span>
              <span className="pc-spot-emoji">{s.emoji}</span>
              <span className="pc-spot-name">{s.name}</span>
            </button>
          </li>
        ))}
      </ol>

      <p className="pc-foot">Prototype · sample places, not real restaurants</p>
    </div>
  );
}
