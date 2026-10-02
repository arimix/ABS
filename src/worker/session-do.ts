import { DurableObject } from "cloudflare:workers";
import { buildDeck } from "./places";
import type {
  ClientMessage,
  MatchInfo,
  MealTime,
  Participant,
  Restaurant,
  ServerMessage,
  SwipeDirection,
} from "../shared/types";

interface SessionMetaStored {
  code: string;
  locationLabel: string;
  mealTime: MealTime;
  cuisines: string[];
  hostName: string;
  createdAt: number;
}

interface WsAttachment {
  participantId: string;
  name: string;
}

const MATCH_THRESHOLD = 2;

export class SwipeSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        joined_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS swipes (
        participant_id TEXT NOT NULL,
        place_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (participant_id, place_id)
      );
      CREATE TABLE IF NOT EXISTS matches (
        place_id TEXT PRIMARY KEY,
        matched_at INTEGER NOT NULL
      );
    `);
  }

  async initSession(input: {
    code: string;
    locationLabel: string;
    lat?: number;
    lng?: number;
    mealTime: MealTime;
    cuisines: string[];
    hostName: string;
  }): Promise<{ hostParticipantId: string }> {
    const existing = await this.ctx.storage.get<SessionMetaStored>("meta");
    if (existing) {
      const host = this.ctx.storage.sql
        .exec<{ id: string }>("SELECT id FROM participants ORDER BY joined_at ASC LIMIT 1")
        .toArray()[0];
      return { hostParticipantId: host?.id ?? "" };
    }

    const deck = await buildDeck({
      apiKey: this.env.GOOGLE_PLACES_API_KEY,
      locationLabel: input.locationLabel,
      lat: input.lat,
      lng: input.lng,
      mealTime: input.mealTime,
      cuisines: input.cuisines,
    });

    const meta: SessionMetaStored = {
      code: input.code,
      locationLabel: input.locationLabel,
      mealTime: input.mealTime,
      cuisines: input.cuisines,
      hostName: input.hostName,
      createdAt: Date.now(),
    };

    await this.ctx.storage.put("meta", meta);
    await this.ctx.storage.put("deck", deck);

    const hostId = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO participants (id, name, joined_at) VALUES (?, ?, ?)",
      hostId,
      input.hostName,
      Date.now()
    );

    return { hostParticipantId: hostId };
  }

  async getMeta(): Promise<
    | (SessionMetaStored & {
        participantCount: number;
        deckSize: number;
        participants: Participant[];
      })
    | null
  > {
    const meta = await this.ctx.storage.get<SessionMetaStored>("meta");
    if (!meta) return null;
    const deck = (await this.ctx.storage.get<Restaurant[]>("deck")) ?? [];
    const participants = this.listParticipants();
    return {
      ...meta,
      participantCount: participants.length,
      deckSize: deck.length,
      participants,
    };
  }

  async join(name: string): Promise<{ participantId: string }> {
    const meta = await this.ctx.storage.get<SessionMetaStored>("meta");
    if (!meta) throw new Error("Session not found");

    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      "INSERT INTO participants (id, name, joined_at) VALUES (?, ?, ?)",
      id,
      name,
      Date.now()
    );
    this.broadcastPresence();
    return { participantId: id };
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const participantId = url.searchParams.get("participantId") ?? "";
    const participant = this.ctx.storage.sql
      .exec<{ id: string; name: string }>(
        "SELECT id, name FROM participants WHERE id = ?",
        participantId
      )
      .toArray()[0];

    if (!participant) {
      return new Response("Unknown participant", { status: 404 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      participantId: participant.id,
      name: participant.name,
    } satisfies WsAttachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (!attachment) return;

    if (parsed.type === "hello") {
      await this.sendInitState(ws, attachment.participantId);
      this.broadcastPresence();
      return;
    }

    if (parsed.type === "swipe") {
      await this.handleSwipe(attachment, parsed.placeId, parsed.direction);
    }
  }

  async webSocketClose(): Promise<void> {
    this.broadcastPresence();
  }

  private async sendInitState(ws: WebSocket, participantId: string): Promise<void> {
    const deck = (await this.ctx.storage.get<Restaurant[]>("deck")) ?? [];
    const participants = this.listParticipants();
    const matches = await this.listMatches(deck);

    const rows = this.ctx.storage.sql
      .exec<{ place_id: string; direction: string }>(
        "SELECT place_id, direction FROM swipes WHERE participant_id = ?",
        participantId
      )
      .toArray();

    const yourSwipes: Record<string, SwipeDirection> = {};
    for (const row of rows) yourSwipes[row.place_id] = row.direction as SwipeDirection;

    const finishedCount = this.finishedCount(deck);
    const topPicksUnlocked = (await this.ctx.storage.get<boolean>("topPicksUnlocked")) ?? false;

    const payload: ServerMessage = {
      type: "init",
      deck,
      participants,
      matches,
      yourSwipes,
      finishedCount,
      topPicksUnlocked,
    };
    ws.send(JSON.stringify(payload));
  }

  private async handleSwipe(
    attachment: WsAttachment,
    placeId: string,
    direction: SwipeDirection
  ): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO swipes (participant_id, place_id, direction, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (participant_id, place_id) DO UPDATE SET direction = excluded.direction, created_at = excluded.created_at`,
      attachment.participantId,
      placeId,
      direction,
      Date.now()
    );

    const deck = (await this.ctx.storage.get<Restaurant[]>("deck")) ?? [];
    await this.checkProgress(deck);

    if (direction !== "like") return;

    const likeCount = this.ctx.storage.sql
      .exec<{ c: number }>(
        "SELECT COUNT(*) as c FROM swipes WHERE place_id = ? AND direction = 'like'",
        placeId
      )
      .one().c;

    if (likeCount < MATCH_THRESHOLD) return;

    const restaurant = deck.find((r) => r.id === placeId);
    if (!restaurant) return;

    const existing = this.ctx.storage.sql
      .exec<{ matched_at: number }>(
        "SELECT matched_at FROM matches WHERE place_id = ?",
        placeId
      )
      .toArray()[0];

    if (existing) {
      const match: MatchInfo = {
        restaurant,
        likedBy: this.likersFor(placeId),
        matchedAt: existing.matched_at,
      };
      this.broadcast({ type: "matchUpdate", match });
      return;
    }

    const matchedAt = Date.now();
    this.ctx.storage.sql.exec(
      "INSERT INTO matches (place_id, matched_at) VALUES (?, ?)",
      placeId,
      matchedAt
    );

    const match: MatchInfo = {
      restaurant,
      likedBy: this.likersFor(placeId),
      matchedAt,
    };
    this.broadcast({ type: "match", match });
  }

  private finishedCount(deck: Restaurant[]): number {
    if (deck.length === 0) return 0;
    return this.ctx.storage.sql
      .exec<{ c: number }>(
        `SELECT COUNT(*) as c FROM (
           SELECT participant_id FROM swipes GROUP BY participant_id HAVING COUNT(*) >= ?
         ) t`,
        deck.length
      )
      .one().c;
  }

  private async checkProgress(deck: Restaurant[]): Promise<void> {
    const finishedCount = this.finishedCount(deck);
    this.broadcast({ type: "progress", finishedCount });

    if (deck.length === 0) return;
    const alreadyUnlocked = (await this.ctx.storage.get<boolean>("topPicksUnlocked")) ?? false;
    if (alreadyUnlocked) return;

    const participantCount = this.listParticipants().length;
    if (finishedCount > 0 && finishedCount * 2 > participantCount) {
      await this.ctx.storage.put("topPicksUnlocked", true);
      this.broadcast({ type: "quorumReached" });
    }
  }

  private likersFor(placeId: string): string[] {
    return this.ctx.storage.sql
      .exec<{ name: string }>(
        `SELECT p.name as name FROM swipes s
         JOIN participants p ON p.id = s.participant_id
         WHERE s.place_id = ? AND s.direction = 'like'
         ORDER BY s.created_at ASC`,
        placeId
      )
      .toArray()
      .map((r) => r.name);
  }

  private listParticipants(): Participant[] {
    return this.ctx.storage.sql
      .exec<{ id: string; name: string }>(
        "SELECT id, name FROM participants ORDER BY joined_at ASC"
      )
      .toArray();
  }

  private async listMatches(deck: Restaurant[]): Promise<MatchInfo[]> {
    const byId = new Map(deck.map((r) => [r.id, r]));
    const rows = this.ctx.storage.sql
      .exec<{ place_id: string; matched_at: number }>(
        "SELECT place_id, matched_at FROM matches ORDER BY matched_at ASC"
      )
      .toArray();

    const matches: MatchInfo[] = [];
    for (const row of rows) {
      const restaurant = byId.get(row.place_id);
      if (!restaurant) continue;
      matches.push({
        restaurant,
        likedBy: this.likersFor(row.place_id),
        matchedAt: row.matched_at,
      });
    }
    return matches;
  }

  private broadcastPresence(): void {
    this.broadcast({ type: "presence", participants: this.listParticipants() });
  }

  private broadcast(payload: ServerMessage): void {
    const message = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
      } catch {
        // socket already closing; ignore
      }
    }
  }
}
