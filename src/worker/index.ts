import { Hono } from "hono";
import { SwipeSession } from "./session-do";
import { autocompleteLocation } from "./places";
import type { MealTime } from "../shared/types";

export { SwipeSession };

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I/L)

function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let code = "";
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

interface CreateSessionBody {
  locationLabel: string;
  lat?: number;
  lng?: number;
  mealTime: MealTime;
  cuisines: string[];
  hostName: string;
}

const MEAL_TIMES: MealTime[] = ["breakfast", "lunch", "dinner"];

const CANONICAL_HOST = "forkdis.com";
const REDIRECT_FROM_HOSTS = new Set(["www.forkdis.com"]);

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  if (REDIRECT_FROM_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    return c.redirect(url.toString(), 301);
  }
  await next();
});

app.post("/api/sessions", async (c) => {
  const body = await c.req.json<Partial<CreateSessionBody>>();

  if (
    !body.locationLabel?.trim() ||
    !body.hostName?.trim() ||
    !body.mealTime ||
    !MEAL_TIMES.includes(body.mealTime)
  ) {
    return c.json({ error: "Missing or invalid required fields" }, 400);
  }

  const code = randomCode();
  const stub = c.env.SWIPE_SESSION.getByName(code);
  const { hostParticipantId } = await stub.initSession({
    code,
    locationLabel: body.locationLabel.trim(),
    lat: typeof body.lat === "number" ? body.lat : undefined,
    lng: typeof body.lng === "number" ? body.lng : undefined,
    mealTime: body.mealTime,
    cuisines: Array.isArray(body.cuisines) ? body.cuisines.slice(0, 4) : [],
    hostName: body.hostName.trim().slice(0, 40),
  });

  return c.json({ code, participantId: hostParticipantId });
});

app.get("/api/sessions/:code", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const stub = c.env.SWIPE_SESSION.getByName(code);
  const meta = await stub.getMeta();
  if (!meta) return c.json({ error: "Session not found" }, 404);
  return c.json(meta);
});

app.post("/api/sessions/:code/join", async (c) => {
  const code = c.req.param("code").toUpperCase();
  const body = await c.req.json<{ name?: string }>();
  if (!body.name?.trim()) return c.json({ error: "Name required" }, 400);

  const stub = c.env.SWIPE_SESSION.getByName(code);
  const meta = await stub.getMeta();
  if (!meta) return c.json({ error: "Session not found" }, 404);

  const { participantId } = await stub.join(body.name.trim().slice(0, 40));
  return c.json({ participantId });
});

app.get("/api/places/autocomplete", async (c) => {
  const input = c.req.query("input")?.trim();
  if (!input || input.length < 2) {
    return c.json({ suggestions: [] });
  }
  const sessionToken = c.req.query("sessionToken");
  const cf = c.req.raw.cf;
  const bias =
    typeof cf?.latitude === "string" && typeof cf?.longitude === "string"
      ? { lat: parseFloat(cf.latitude), lng: parseFloat(cf.longitude) }
      : undefined;

  try {
    const suggestions = await autocompleteLocation(
      c.env.GOOGLE_PLACES_API_KEY,
      input,
      sessionToken,
      bias
    );
    return c.json({ suggestions });
  } catch {
    return c.json({ suggestions: [] });
  }
});

app.get("/api/photo", async (c) => {
  const name = c.req.query("name");
  if (!name || !name.startsWith("places/")) {
    return c.json({ error: "Invalid photo name" }, 400);
  }

  const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=900&key=${c.env.GOOGLE_PLACES_API_KEY}`;
  const upstream = await fetch(url);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

app.get("/ws/:code", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.json({ error: "Expected WebSocket upgrade" }, 426);
  }
  const code = c.req.param("code").toUpperCase();
  const stub = c.env.SWIPE_SESSION.getByName(code);
  return stub.fetch(c.req.raw);
});

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
