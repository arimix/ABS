import type { MatchInfo } from "../../shared/types";
import { photoUrl } from "../api";
import { reserveLinks } from "../reserveLinks";

interface Props {
  matches: MatchInfo[];
  onClose: () => void;
  ranked?: boolean;
}

const TOP_PICKS_LIMIT = 5;

export function MatchesSheet({ matches, onClose, ranked = false }: Props) {
  const displayed = ranked
    ? [...matches].sort((a, b) => b.likedBy.length - a.likedBy.length).slice(0, TOP_PICKS_LIMIT)
    : [...matches].reverse();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2>{ranked ? "Top picks" : `Matches (${matches.length})`}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {matches.length === 0 ? (
          <p className="hint">No matches yet — keep swiping, they'll show up here.</p>
        ) : (
          displayed.map((m, i) => (
            <MatchRow key={m.restaurant.id} match={m} rank={ranked ? i + 1 : undefined} />
          ))
        )}
      </div>
    </div>
  );
}

export function MatchRow({ match, rank }: { match: MatchInfo; rank?: number }) {
  const img = photoUrl(match.restaurant.photoName);
  const links = reserveLinks(match.restaurant);
  const likeWord = match.likedBy.length === 1 ? "like" : "likes";

  return (
    <div className="match-item">
      {img ? (
        <img src={img} alt={match.restaurant.name} />
      ) : (
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 12,
            background: "#f2e4de",
            flexShrink: 0,
          }}
        />
      )}
      <div className="details">
        <h4>
          {rank && <span className="rank-badge">#{rank}</span>}
          {match.restaurant.name}
        </h4>
        <div className="liked-by">
          {match.likedBy.length} {likeWord} — {match.likedBy.join(", ")}
        </div>
        <div className="link-row">
          {links.maps && (
            <a href={links.maps} target="_blank" rel="noreferrer">
              Maps
            </a>
          )}
          <a href={links.resy} target="_blank" rel="noreferrer">
            Resy
          </a>
          <a href={links.opentable} target="_blank" rel="noreferrer">
            OpenTable
          </a>
        </div>
      </div>
    </div>
  );
}
