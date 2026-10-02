import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import type { SessionMeta } from "../../shared/types";
import { getSessionMeta, joinSession } from "../api";
import { loadIdentity, saveIdentity } from "../identity";
import { useSwipeSession } from "../useSwipeSession";
import { SwipeCard } from "../components/SwipeCard";
import { MatchesSheet } from "../components/MatchesSheet";
import { MatchCelebration } from "../components/MatchCelebration";
import { TopPicksUnlocked } from "../components/TopPicksUnlocked";

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export function SessionPage() {
  const { code = "" } = useParams<{ code: string }>();
  const upperCode = code.toUpperCase();

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(
    () => loadIdentity(upperCode)?.participantId ?? null
  );
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    getSessionMeta(upperCode)
      .then(setMeta)
      .catch((e) => setMetaError(e instanceof Error ? e.message : "Session not found"));
  }, [upperCode]);

  const session = useSwipeSession(upperCode, participantId);

  const remaining = useMemo(
    () => session.deck.filter((r) => !(r.id in session.yourSwipes)),
    [session.deck, session.yourSwipes]
  );
  const swipedCount = session.deck.length - remaining.length;
  const topCardResolver = useRef<((direction: "like" | "pass") => void) | null>(null);

  async function handleJoin() {
    if (!name.trim()) {
      setJoinError("Enter your name to join.");
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const { participantId: id } = await joinSession(upperCode, name.trim());
      saveIdentity(upperCode, { participantId: id, name: name.trim() });
      setParticipantId(id);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : "Couldn't join session");
      setJoining(false);
    }
  }

  async function shareLink(inviterName: string) {
    const url = `${window.location.origin}/s/${upperCode}`;
    const shareData = {
      title: "Forkdis",
      text: `${inviterName} invites you to pick where to hang out next 🍽️`,
      url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // Clipboard access can be denied by the browser/OS — fall back to a manual
      // copy dialog so the link is never just silently un-shareable.
      window.prompt("Copy this link to share:", url);
    }
  }

  if (metaError) {
    return (
      <div className="screen">
        <div className="empty-state">
          <h2>Session not found</h2>
          <p>Double check the code — it's usually 6 characters, like 7F3KQP.</p>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="screen">
        <p className="hint">Loading session…</p>
      </div>
    );
  }

  if (!participantId) {
    return (
      <div className="screen">
        <div className="lobby-card">
          <h2>{MEAL_LABEL[meta.mealTime]} near {meta.locationLabel}</h2>
          <p className="lobby-meta">
            {meta.cuisines.length > 0 ? meta.cuisines.join(", ") : "Any cuisine"} ·{" "}
            {meta.deckSize} spots to swipe
          </p>
          <p className="lobby-meta">Started by {meta.hostName}</p>
          {meta.participants.length > 0 && (
            <>
              <p className="lobby-meta lobby-already-in">
                Already swiping: {meta.participants.map((p) => p.name).join(", ")}
              </p>
              <div className="avatar-row">
                {meta.participants.map((p) => (
                  <div className="avatar" key={p.id} title={p.name}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {joinError && <div className="error-banner">{joinError}</div>}

        <div className="field">
          <label htmlFor="join-name">Your name</label>
          <input
            id="join-name"
            type="text"
            placeholder="e.g. Sam"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          />
        </div>

        <button className="btn btn-primary" onClick={handleJoin} disabled={joining}>
          {joining ? "Joining…" : "Join & start swiping"}
        </button>
        <button
          className="btn btn-secondary"
          style={{ marginTop: 10 }}
          onClick={() => shareLink(meta.hostName)}
        >
          {linkCopied ? "Link copied!" : "Share"}
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="deck-header">
        <span className="progress-text">
          {swipedCount}/{session.deck.length} swiped
        </span>
        <div className="header-actions">
          <button
            className="btn btn-secondary header-btn"
            onClick={() => shareLink(loadIdentity(upperCode)?.name ?? meta.hostName)}
          >
            {linkCopied ? "Copied!" : "Share"}
          </button>
          <button
            className="btn btn-secondary header-btn matches-btn"
            onClick={() => setShowMatches(true)}
          >
            {session.topPicksUnlocked ? "Top picks" : "Matches"}
            {session.matches.length > 0 && (
              <span className="count">{session.matches.length}</span>
            )}
          </button>
        </div>
      </div>

      {session.participants.length > 1 && (
        <div className="group-progress">
          <div className="group-progress-bar">
            <div
              className="group-progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  (session.finishedCount / session.participants.length) * 100
                )}%`,
              }}
            />
          </div>
          <span className="group-progress-text">
            {session.finishedCount} of {session.participants.length} picked
          </span>
        </div>
      )}

      {session.status === "connecting" && <p className="connection-banner">Connecting…</p>}
      {session.status === "closed" && (
        <p className="connection-banner">Disconnected — reload to reconnect.</p>
      )}

      <div className="deck-area">
        {session.deck.length === 0 ? (
          <p className="hint">Shuffling the deck…</p>
        ) : remaining.length === 0 ? (
          <div className="empty-state">
            <h2>That's everyone!</h2>
            <p>
              {session.matches.length > 0
                ? "Check the matches tray to pick where to go."
                : "No matches yet — send the link to more friends, or wait for them to catch up."}
            </p>
          </div>
        ) : (
          <div className="card-stack">
            <AnimatePresence>
              {remaining.slice(0, 3).map((r, i) => (
                <SwipeCard
                  key={r.id}
                  restaurant={r}
                  isTop={i === 0}
                  stackIndex={i}
                  onResolve={(direction) => session.swipe(r.id, direction)}
                  registerResolver={i === 0 ? (fn) => (topCardResolver.current = fn) : undefined}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {remaining.length > 0 && (
        <div className="swipe-actions">
          <button className="round-btn pass" onClick={() => topCardResolver.current?.("pass")} aria-label="Pass">
            ✕
          </button>
          <button className="round-btn like" onClick={() => topCardResolver.current?.("like")} aria-label="Like">
            ♥
          </button>
        </div>
      )}

      {showMatches && (
        <MatchesSheet
          matches={session.matches}
          onClose={() => setShowMatches(false)}
          ranked={session.topPicksUnlocked}
        />
      )}

      <AnimatePresence>
        {session.latestMatch && !session.justUnlockedTopPicks && (
          <MatchCelebration
            key="match-celebration"
            match={session.latestMatch}
            onDismiss={session.dismissLatestMatch}
          />
        )}
      </AnimatePresence>

      {session.justUnlockedTopPicks && (
        <TopPicksUnlocked
          matches={session.matches}
          finishedCount={session.finishedCount}
          participantCount={session.participants.length}
          onDismiss={session.dismissTopPicksUnlock}
          onShare={() => shareLink(loadIdentity(upperCode)?.name ?? meta.hostName)}
        />
      )}
    </div>
  );
}
