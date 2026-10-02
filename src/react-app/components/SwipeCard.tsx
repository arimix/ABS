import { useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { Restaurant } from "../../shared/types";
import { photoUrl } from "../api";

const PRICE_LABEL: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

interface SwipeCardProps {
  restaurant: Restaurant;
  isTop: boolean;
  stackIndex: number;
  onResolve: (direction: "like" | "pass") => void;
  registerResolver?: (resolve: (direction: "like" | "pass") => void) => void;
}

const SWIPE_THRESHOLD = 120;
const FLY_OUT_DISTANCE = 500;

export function SwipeCard({
  restaurant,
  isTop,
  stackIndex,
  onResolve,
  registerResolver,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const passOpacity = useTransform(x, [-120, -20], [1, 0]);

  const img = photoUrl(restaurant.photoName);
  const price = restaurant.priceLevel ? PRICE_LABEL[restaurant.priceLevel] : undefined;

  useEffect(() => {
    if (!isTop || !registerResolver) return;
    registerResolver((direction) => {
      x.set(direction === "like" ? FLY_OUT_DISTANCE : -FLY_OUT_DISTANCE);
      onResolve(direction);
    });
  }, [isTop, registerResolver, onResolve, x]);

  return (
    <motion.div
      className="swipe-card"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 100 - stackIndex,
        scale: 1 - stackIndex * 0.04,
        top: stackIndex * 10,
      }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={1}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_THRESHOLD) {
          onResolve("like");
        } else if (info.offset.x < -SWIPE_THRESHOLD) {
          onResolve("pass");
        }
      }}
      initial={false}
      animate={{ scale: 1 - stackIndex * 0.04, top: stackIndex * 10, opacity: 1 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.25 } }}
    >
      <div className="photo" style={img ? { backgroundImage: `url(${img})` } : undefined}>
        {restaurant.openNow !== undefined && (
          <span className="badge">{restaurant.openNow ? "Open now" : "Closed now"}</span>
        )}
        {isTop && (
          <>
            <motion.div className="stamp like" style={{ opacity: likeOpacity }}>
              Like
            </motion.div>
            <motion.div className="stamp pass" style={{ opacity: passOpacity }}>
              Pass
            </motion.div>
          </>
        )}
      </div>
      <div className="info">
        <h3>{restaurant.name}</h3>
        <div className="sub">
          {[price, formatType(restaurant.primaryType), formatRating(restaurant)]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
    </motion.div>
  );
}

function formatType(type?: string): string | undefined {
  if (!type) return undefined;
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRating(r: Restaurant): string | undefined {
  if (!r.rating) return undefined;
  return `★ ${r.rating.toFixed(1)}${r.userRatingCount ? ` (${r.userRatingCount})` : ""}`;
}
