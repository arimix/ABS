import { useEffect } from "react";
import { motion } from "framer-motion";
import type { MatchInfo } from "../../shared/types";
import { fireConfetti } from "../confetti";
import { MatchRow } from "./MatchesSheet";

interface Props {
  matches: MatchInfo[];
  finishedCount: number;
  participantCount: number;
  onDismiss: () => void;
  onShare: () => void;
}

const TOP_PICKS_LIMIT = 5;

export function TopPicksUnlocked({
  matches,
  finishedCount,
  participantCount,
  onDismiss,
  onShare,
}: Props) {
  useEffect(fireConfetti, []);

  const ranked = [...matches]
    .sort((a, b) => b.likedBy.length - a.likedBy.length)
    .slice(0, TOP_PICKS_LIMIT);

  const solo = participantCount <= 1;

  return (
    <motion.div
      className="match-celebration top-picks-celebration"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        className="top-picks-panel"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="headline">{solo ? "Nice picks!" : "Your group has spoken!"}</div>
        <div className="subhead">
          {solo
            ? "Bring friends in and swipe together to find a real match"
            : `${finishedCount} of ${participantCount} have picked — here's what's leading`}
        </div>

        <div className="top-picks-list">
          {ranked.length === 0 ? (
            <p className="hint top-picks-empty">
              {solo
                ? "Once friends join and swipe, your matches will show up here."
                : "Everyone's swiped, but no one's landed on the same place yet — check the Matches tray as more people join."}
            </p>
          ) : (
            ranked.map((m, i) => <MatchRow key={m.restaurant.id} match={m} rank={i + 1} />)
          )}
        </div>

        <button className="btn btn-secondary" onClick={onShare}>
          Share the link with friends
        </button>
        <button className="btn-text-dismiss" onClick={onDismiss}>
          Got it
        </button>
      </motion.div>
    </motion.div>
  );
}
