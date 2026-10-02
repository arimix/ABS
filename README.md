# Forkdis

Tinder for deciding where to eat with friends. One person starts a session
(location, meal time, optional cuisine), shares a link, everyone swipes the
same deck of nearby restaurants, and the moment two people like the same
place it's a live match.

## Stack

- **Cloudflare Workers** ([Hono](https://hono.dev)) for routing and the Google Places API proxy
- **Durable Objects** (SQLite storage + WebSocket hibernation) — one `SwipeSession` object per session code, holding participants, swipes, and matches, and broadcasting live match events over WebSocket
- **Google Places API (New)** — Text Search for the restaurant deck, streamed photos proxied server-side so the API key never reaches the client
- **React + Vite + framer-motion** for the swipe UI, deployed as static assets from the same Worker via `@cloudflare/vite-plugin`
- No accounts — a 6-character session code plus a locally-stored participant id is the only "login"

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Get a [Google Places API key](https://developers.google.com/maps/documentation/places/web-service/get-api-key) with the **Places API (New)** enabled, and set it locally:
   ```bash
   cp .dev.vars.example .dev.vars
   # then edit .dev.vars and paste your real key
   ```
3. Run the app:
   ```bash
   npm run dev
   ```
   This starts a single dev server (Worker + frontend together) at http://localhost:5173.

## Deploy

```bash
npx wrangler secret put GOOGLE_PLACES_API_KEY   # paste your key when prompted
npm run deploy
```

## How matching works

- A session's restaurant deck is built once (server-side, from Google Places Text Search biased by location/meal time/cuisine) and persisted in the session's Durable Object — every participant who joins sees the identical deck in the identical order.
- Swipes are private; only when a restaurant gets **2+ likes** does it become a visible "match", broadcast live to everyone in the session and added to a shared Matches tray with links out to Google Maps, Resy, and OpenTable search (Resy/OpenTable don't offer open booking APIs, so v1 deep-links rather than booking in-app).
- The session keeps going after a match (like real Tinder) so the group ends up with a short list, not just whatever matched first — useful since the first match might not actually have a table.

## Project layout

```
src/
  worker/        Hono app, routes, Google Places integration
  worker/session-do.ts   The SwipeSession Durable Object
  shared/types.ts        Types shared between worker and frontend
  react-app/      Vite React frontend (pages, components, WS client hook)
```
