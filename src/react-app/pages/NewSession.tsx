import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CUISINE_OPTIONS, type MealTime } from "../../shared/types";
import { autocompleteLocation, createSession, type LocationSuggestion } from "../api";
import { saveIdentity } from "../identity";

const MEAL_LABELS: { value: MealTime; label: string }[] = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
];

function defaultMealTime(): MealTime {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

export function NewSession() {
  const navigate = useNavigate();
  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mealTime, setMealTime] = useState<MealTime>(defaultMealTime());
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [hostName, setHostName] = useState("");
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const sessionTokenRef = useRef(crypto.randomUUID());
  const skipNextFetchRef = useRef(false);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    if (locationLabel.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      autocompleteLocation(locationLabel.trim(), sessionTokenRef.current)
        .then((results) => {
          if (!cancelled) {
            setSuggestions(results);
            setShowSuggestions(true);
          }
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationLabel]);

  function selectSuggestion(s: LocationSuggestion) {
    skipNextFetchRef.current = true;
    setLocationLabel(s.text);
    setCoords(null);
    setSuggestions([]);
    setShowSuggestions(false);
    sessionTokenRef.current = crypto.randomUUID();
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser — type a neighborhood instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        skipNextFetchRef.current = true;
        setLocationLabel((prev) => (prev.trim() ? prev : "your current location"));
        setShowSuggestions(false);
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location — type a neighborhood or address instead.");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  }

  function toggleCuisine(c: string) {
    setCuisines((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit() {
    if (!locationLabel.trim() || !hostName.trim()) {
      setError("Add a location and your name to continue.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { code, participantId } = await createSession({
        locationLabel: locationLabel.trim(),
        lat: coords?.lat,
        lng: coords?.lng,
        mealTime,
        cuisines,
        hostName: hostName.trim(),
      });
      saveIdentity(code, { participantId, name: hostName.trim() });
      navigate(`/s/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="screen">
      <div className="hero-copy">
        <h1>New session</h1>
        <p>Set the basics, then invite friends with your link.</p>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="field">
        <label htmlFor="location">Where</label>
        <div className="autocomplete">
          <input
            id="location"
            type="text"
            placeholder="Neighborhood, city, or address"
            autoComplete="off"
            value={locationLabel}
            onChange={(e) => {
              setLocationLabel(e.target.value);
              setCoords(null);
            }}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="suggestion-list">
              {suggestions.map((s) => (
                <li key={s.placeId}>
                  <button type="button" onMouseDown={() => selectSuggestion(s)}>
                    {s.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="location-btn" onClick={useMyLocation} disabled={locating}>
          {locating ? "Locating…" : "📍 Use my current location"}
        </button>
      </div>

      <div className="field">
        <label>When</label>
        <div className="segmented">
          {MEAL_LABELS.map((m) => (
            <button
              key={m.value}
              className={mealTime === m.value ? "active" : ""}
              onClick={() => setMealTime(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Cuisine or vibe (optional)</label>
        <div className="chip-row">
          {CUISINE_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${cuisines.includes(c) ? "active" : ""}`}
              onClick={() => toggleCuisine(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <p className="skip-note">
          Can't agree? Skip this — you'll get a mix of well-rated spots nearby.
        </p>
      </div>

      <div className="field">
        <label htmlFor="host-name">Your name</label>
        <input
          id="host-name"
          type="text"
          placeholder="So your friends know who's who"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Building your deck…" : "Create session"}
      </button>
    </div>
  );
}
