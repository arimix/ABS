import { useEffect } from "react";
import { motion } from "framer-motion";
import type { MatchInfo } from "../../shared/types";
import { photoUrl } from "../api";
import { reserveLinks } from "../reserveLinks";
import { fireConfetti } from "../confetti";

interface Props {
  match: MatchInfo;
  onDismiss: () => void;
}

export function MatchCelebration({ match, onDismiss }: Props) {
  const img = photoUrl(match.restaurant.photoName);
  const links = reserveLinks(match.restaurant);

  useEffect(fireConfetti, []);

  return (
    <motion.div
      className="match-celebration"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="headline">It's a match!</div>
        <div className="subhead">
          {match.likedBy.length >= 2
            ? `${match.likedBy.join(" & ")} both want to eat here`
            : "Someone else wants to eat here too"}
        </div>
        {img && <img src={img} alt={match.restaurant.name} />}
        <h3>{match.restaurant.name}</h3>
        <div className="link-row celebration-links">
          {links.maps && (
            <a href={links.maps} target="_blank" rel="noreferrer">
              Maps
            </a>
          )}
          <a href={links.resy} target="_blank" rel="noreferrer">
            Reserve on Resy
          </a>
          <a href={links.opentable} target="_blank" rel="noreferrer">
            Reserve on OpenTable
          </a>
        </div>
        <button className="btn btn-secondary" onClick={onDismiss}>
          Keep swiping
        </button>
      </motion.div>
    </motion.div>
  );
}
