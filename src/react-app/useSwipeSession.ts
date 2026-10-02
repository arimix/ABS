import { useEffect, useRef, useState } from "react";
import type {
  ClientMessage,
  MatchInfo,
  Participant,
  Restaurant,
  ServerMessage,
  SwipeDirection,
} from "../shared/types";

export type ConnectionStatus = "connecting" | "open" | "closed";

interface SwipeSessionState {
  status: ConnectionStatus;
  deck: Restaurant[];
  participants: Participant[];
  matches: MatchInfo[];
  yourSwipes: Record<string, SwipeDirection>;
  latestMatch: MatchInfo | null;
  finishedCount: number;
  topPicksUnlocked: boolean;
  justUnlockedTopPicks: boolean;
}

export function useSwipeSession(code: string, participantId: string | null) {
  const [state, setState] = useState<SwipeSessionState>({
    status: "connecting",
    deck: [],
    participants: [],
    matches: [],
    yourSwipes: {},
    latestMatch: null,
    finishedCount: 0,
    topPicksUnlocked: false,
    justUnlockedTopPicks: false,
  });
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!participantId) return;

    let cancelled = false;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/${code}?participantId=${encodeURIComponent(
      participantId
    )}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      if (cancelled) return;
      setState((s) => ({ ...s, status: "open" }));
      const hello: ClientMessage = { type: "hello", participantId };
      ws.send(JSON.stringify(hello));
    });

    ws.addEventListener("message", (event) => {
      if (cancelled) return;
      const payload: ServerMessage = JSON.parse(event.data);
      setState((s) => {
        switch (payload.type) {
          case "init":
            return {
              ...s,
              deck: payload.deck,
              participants: payload.participants,
              matches: payload.matches,
              yourSwipes: payload.yourSwipes,
              finishedCount: payload.finishedCount,
              topPicksUnlocked: payload.topPicksUnlocked,
            };
          case "presence":
            return { ...s, participants: payload.participants };
          case "match":
            return {
              ...s,
              matches: [...s.matches, payload.match],
              latestMatch: payload.match,
            };
          case "matchUpdate":
            return {
              ...s,
              matches: s.matches.map((m) =>
                m.restaurant.id === payload.match.restaurant.id ? payload.match : m
              ),
            };
          case "progress":
            return { ...s, finishedCount: payload.finishedCount };
          case "quorumReached":
            // Absorb any pending single-match celebration — it's already covered
            // by the ranked top-picks list, so don't let it resurface after dismissal.
            return {
              ...s,
              topPicksUnlocked: true,
              justUnlockedTopPicks: true,
              latestMatch: null,
            };
          case "error":
            console.error("Session error:", payload.message);
            return s;
          default:
            return s;
        }
      });
    });

    ws.addEventListener("close", () => {
      if (cancelled) return;
      setState((s) => ({ ...s, status: "closed" }));
    });

    return () => {
      cancelled = true;
      ws.close();
    };
  }, [code, participantId]);

  function swipe(placeId: string, direction: SwipeDirection) {
    setState((s) => ({ ...s, yourSwipes: { ...s.yourSwipes, [placeId]: direction } }));
    const msg: ClientMessage = { type: "swipe", placeId, direction };
    wsRef.current?.send(JSON.stringify(msg));
  }

  function dismissLatestMatch() {
    setState((s) => ({ ...s, latestMatch: null }));
  }

  function dismissTopPicksUnlock() {
    setState((s) => ({ ...s, justUnlockedTopPicks: false }));
  }

  return { ...state, swipe, dismissLatestMatch, dismissTopPicksUnlock };
}
