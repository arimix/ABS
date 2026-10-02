import type { MealTime, SessionMeta } from "../shared/types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: res.statusText }) as { error?: string });
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function createSession(input: {
  locationLabel: string;
  lat?: number;
  lng?: number;
  mealTime: MealTime;
  cuisines: string[];
  hostName: string;
}): Promise<{ code: string; participantId: string }> {
  return request("/api/sessions", { method: "POST", body: JSON.stringify(input) });
}

export function getSessionMeta(code: string): Promise<SessionMeta> {
  return request(`/api/sessions/${code}`);
}

export function joinSession(
  code: string,
  name: string
): Promise<{ participantId: string }> {
  return request(`/api/sessions/${code}/join`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function photoUrl(photoName?: string): string | undefined {
  if (!photoName) return undefined;
  return `/api/photo?name=${encodeURIComponent(photoName)}`;
}

export interface LocationSuggestion {
  placeId: string;
  text: string;
}

export async function autocompleteLocation(
  input: string,
  sessionToken: string
): Promise<LocationSuggestion[]> {
  const params = new URLSearchParams({ input, sessionToken });
  const { suggestions } = await request<{ suggestions: LocationSuggestion[] }>(
    `/api/places/autocomplete?${params.toString()}`
  );
  return suggestions;
}
