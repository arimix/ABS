import type { Restaurant } from "../shared/types";

export interface ReserveLinks {
  maps?: string;
  resy: string;
  opentable: string;
}

export function reserveLinks(restaurant: Restaurant): ReserveLinks {
  const query = encodeURIComponent(`${restaurant.name} ${restaurant.address}`);
  return {
    maps: restaurant.mapsUri,
    resy: `https://resy.com/cities/search?query=${query}`,
    opentable: `https://www.opentable.com/s?term=${query}`,
  };
}
