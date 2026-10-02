export type MealTime = "breakfast" | "lunch" | "dinner";

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  openNow?: boolean;
  primaryType?: string;
  photoName?: string;
  mapsUri?: string;
  websiteUri?: string;
}

export interface Participant {
  id: string;
  name: string;
}

export interface MatchInfo {
  restaurant: Restaurant;
  likedBy: string[];
  matchedAt: number;
}

export interface SessionMeta {
  code: string;
  locationLabel: string;
  mealTime: MealTime;
  cuisines: string[];
  hostName: string;
  createdAt: number;
  participantCount: number;
  deckSize: number;
  participants: Participant[];
}

export type SwipeDirection = "like" | "pass";

export type ClientMessage =
  | { type: "hello"; participantId: string }
  | { type: "swipe"; placeId: string; direction: SwipeDirection };

export type ServerMessage =
  | {
      type: "init";
      deck: Restaurant[];
      participants: Participant[];
      matches: MatchInfo[];
      yourSwipes: Record<string, SwipeDirection>;
      finishedCount: number;
      topPicksUnlocked: boolean;
    }
  | { type: "presence"; participants: Participant[] }
  | { type: "match"; match: MatchInfo }
  | { type: "matchUpdate"; match: MatchInfo }
  | { type: "progress"; finishedCount: number }
  | { type: "quorumReached" }
  | { type: "error"; message: string };

export const CUISINE_OPTIONS = [
  "Italian",
  "Mexican",
  "Japanese",
  "Thai",
  "Indian",
  "Chinese",
  "American",
  "Mediterranean",
  "Korean",
  "Vietnamese",
  "French",
  "Pizza",
  "Bars & Pubs",
  "Cafés",
] as const;
