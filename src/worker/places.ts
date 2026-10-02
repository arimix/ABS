import type { MealTime, Restaurant } from "../shared/types";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.currentOpeningHours.openNow",
  "places.photos",
  "places.primaryType",
  "places.googleMapsUri",
  "places.websiteUri",
].join(",");

interface PlacesTextSearchPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean };
  photos?: { name: string }[];
  primaryType?: string;
  googleMapsUri?: string;
  websiteUri?: string;
}

interface PlacesTextSearchResponse {
  places?: PlacesTextSearchPlace[];
}

interface SearchInput {
  apiKey: string;
  query: string;
  lat?: number;
  lng?: number;
  radiusMeters?: number;
  pageSize?: number;
  includedType?: string;
}

async function searchRestaurants(input: SearchInput): Promise<Restaurant[]> {
  const body: Record<string, unknown> = {
    textQuery: input.query,
    includedType: input.includedType ?? "restaurant",
    pageSize: input.pageSize ?? 10,
  };
  if (input.lat !== undefined && input.lng !== undefined) {
    body.locationBias = {
      circle: {
        center: { latitude: input.lat, longitude: input.lng },
        radius: input.radiusMeters ?? 4000,
      },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": input.apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as PlacesTextSearchResponse;
  return (data.places ?? [])
    .filter((p) => p.location && p.displayName)
    .map((p) => ({
      id: p.id,
      name: p.displayName!.text,
      address: p.formattedAddress ?? "",
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      rating: p.rating,
      userRatingCount: p.userRatingCount,
      priceLevel: p.priceLevel,
      openNow: p.currentOpeningHours?.openNow,
      primaryType: p.primaryType,
      photoName: p.photos?.[0]?.name,
      mapsUri: p.googleMapsUri,
      websiteUri: p.websiteUri,
    }));
}

const MEAL_WORD: Record<MealTime, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
};

// These aren't cuisines — they're distinct Google Places venue types, so they need
// their own includedType and phrasing rather than "{name} {meal} restaurants".
const VENUE_TYPE_OVERRIDES: Record<string, { includedType: string; label: string }> = {
  "Bars & Pubs": { includedType: "bar", label: "bars" },
  "Cafés": { includedType: "cafe", label: "cafes" },
};

export interface BuildDeckInput {
  apiKey: string;
  locationLabel: string;
  lat?: number;
  lng?: number;
  mealTime: MealTime;
  cuisines: string[];
  deckSize?: number;
}

export async function buildDeck(params: BuildDeckInput): Promise<Restaurant[]> {
  const mealWord = MEAL_WORD[params.mealTime];
  const searches =
    params.cuisines.length > 0
      ? params.cuisines.slice(0, 4).map((cuisine) => {
          const venue = VENUE_TYPE_OVERRIDES[cuisine];
          if (venue) {
            return { query: `${venue.label} near ${params.locationLabel}`, includedType: venue.includedType };
          }
          return {
            query: `${cuisine} ${mealWord} restaurants near ${params.locationLabel}`,
            includedType: "restaurant",
          };
        })
      : [{ query: `${mealWord} restaurants near ${params.locationLabel}`, includedType: "restaurant" }];

  const results = await Promise.all(
    searches.map(({ query, includedType }) =>
      searchRestaurants({
        apiKey: params.apiKey,
        query,
        includedType,
        lat: params.lat,
        lng: params.lng,
        pageSize: 10,
      }).catch(() => [] as Restaurant[])
    )
  );

  const seen = new Map<string, Restaurant>();
  for (const list of results) {
    for (const restaurant of list) {
      if (!seen.has(restaurant.id)) seen.set(restaurant.id, restaurant);
    }
  }

  const deck = Array.from(seen.values());
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck.slice(0, params.deckSize ?? 20);
}

export interface LocationSuggestion {
  placeId: string;
  text: string;
}

interface AutocompleteResponse {
  suggestions?: {
    placePrediction?: { placeId: string; text?: { text: string } };
  }[];
}

export async function autocompleteLocation(
  apiKey: string,
  input: string,
  sessionToken?: string,
  bias?: { lat: number; lng: number }
): Promise<LocationSuggestion[]> {
  const body: Record<string, unknown> = { input };
  if (sessionToken) body.sessionToken = sessionToken;
  if (bias) {
    // Wide radius: a soft nudge toward the requester's region, not a hard restriction —
    // people often search for a location other than where they currently are.
    body.locationBias = {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 50000 },
    };
  }

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Autocomplete API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as AutocompleteResponse;
  return (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is { placeId: string; text: { text: string } } => !!p?.text)
    .map((p) => ({ placeId: p.placeId, text: p.text.text }));
}
