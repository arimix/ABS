import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import type { Spot } from "./spots";

export interface Theme {
  id: string;
  label: string;
  land: string;
  park: string;
  water: string;
  road: string;
  roadCasing: string;
  minorRoad: string;
  path: string;
  labelColor: string;
  labelHalo: string;
  buildings: [string, string, string];
  sky: string;
  horizon: string;
  fog: string;
  route: string;
  pin: string;
  title: string;
  titleShadow: string;
}

export const THEMES: Theme[] = [
  {
    id: "golden",
    label: "Golden hour",
    land: "#f6e7cf",
    park: "#c5dba0",
    water: "#8ecfd6",
    road: "#fffaf0",
    roadCasing: "#e6c99c",
    minorRoad: "#fdf3e1",
    path: "#d9b98a",
    labelColor: "#8a6a4f",
    labelHalo: "#fff6e6",
    buildings: ["#f7b89c", "#f3d29a", "#efa3a0"],
    sky: "#ffbf8a",
    horizon: "#ffe6c4",
    fog: "#fbe3c8",
    route: "#e8574f",
    pin: "#e8574f",
    title: "#e8574f",
    titleShadow: "#2b5f6b",
  },
  {
    id: "riviera",
    label: "Riviera",
    land: "#eef3e4",
    park: "#b4dfae",
    water: "#5fc0d6",
    road: "#ffffff",
    roadCasing: "#c9ddd2",
    minorRoad: "#f7fbf4",
    path: "#9cc7b4",
    labelColor: "#3f6f73",
    labelHalo: "#f4faf2",
    buildings: ["#a8dadc", "#fdf6e3", "#ffd6a5"],
    sky: "#7fcdf2",
    horizon: "#e3f6ff",
    fog: "#dcf1f5",
    route: "#ff6b5a",
    pin: "#ff6b5a",
    title: "#1d6f8c",
    titleShadow: "#ffb703",
  },
  {
    id: "dusk",
    label: "Dusk",
    land: "#2f2b4d",
    park: "#3b5160",
    water: "#1d3a5e",
    road: "#57507e",
    roadCasing: "#3c3660",
    minorRoad: "#47416c",
    path: "#6c63a0",
    labelColor: "#d8d0f2",
    labelHalo: "#2f2b4d",
    buildings: ["#6c5b9e", "#8a6fb5", "#c27ba0"],
    sky: "#2a1d4a",
    horizon: "#f29e8e",
    fog: "#4a3a6a",
    route: "#ffd166",
    pin: "#ff8fab",
    title: "#ffd166",
    titleShadow: "#e76f51",
  },
];

/** Nearest-neighbour walk from the first spot, so the dotted route reads like a tour. */
export function tourOrder(spots: Spot[]): Spot[] {
  if (spots.length === 0) return [];
  const rest = spots.slice(1);
  const ordered = [spots[0]];
  while (rest.length) {
    const last = ordered[ordered.length - 1];
    let best = 0;
    let bestDist = Infinity;
    rest.forEach((s, i) => {
      const d = (s.lng - last.lng) ** 2 + (s.lat - last.lat) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    ordered.push(rest.splice(best, 1)[0]);
  }
  return ordered;
}

const MAJOR = ["motorway", "trunk", "primary", "secondary", "tertiary"];
const MINOR = ["minor", "service", "track"];

export function buildStyle(theme: Theme, tour: Spot[]): StyleSpecification {
  const notTunnel: ExpressionSpecification = ["!=", ["get", "brunnel"], "tunnel"];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      omt: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      },
      route: {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: tour.map((s) => [s.lng, s.lat]) },
        },
      },
    },
    sky: {
      "sky-color": theme.sky,
      "horizon-color": theme.horizon,
      "fog-color": theme.fog,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.6,
      "atmosphere-blend": 0.5,
    },
    light: { anchor: "viewport", position: [1.3, 210, 35], intensity: 0.35, color: "#ffffff" },
    layers: [
      { id: "land", type: "background", paint: { "background-color": theme.land } },
      {
        id: "landcover",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        filter: ["in", ["get", "class"], ["literal", ["grass", "wood", "farmland"]]],
        paint: { "fill-color": theme.park, "fill-opacity": 0.8 },
      },
      {
        id: "park",
        type: "fill",
        source: "omt",
        "source-layer": "park",
        paint: { "fill-color": theme.park },
      },
      {
        id: "water",
        type: "fill",
        source: "omt",
        "source-layer": "water",
        paint: { "fill-color": theme.water },
      },
      {
        id: "waterway",
        type: "line",
        source: "omt",
        "source-layer": "waterway",
        paint: { "line-color": theme.water, "line-width": 2 },
      },
      {
        id: "paths",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["==", ["get", "class"], "path"],
        paint: { "line-color": theme.path, "line-width": 1.2, "line-dasharray": [2, 2] },
      },
      {
        id: "minor-roads",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["all", ["in", ["get", "class"], ["literal", MINOR]], notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": theme.minorRoad,
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 13, 1, 18, 14],
        },
      },
      {
        id: "major-casing",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["all", ["in", ["get", "class"], ["literal", MAJOR]], notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": theme.roadCasing,
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 12, 2, 18, 26],
        },
      },
      {
        id: "major-roads",
        type: "line",
        source: "omt",
        "source-layer": "transportation",
        filter: ["all", ["in", ["get", "class"], ["literal", MAJOR]], notTunnel],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": theme.road,
          "line-width": ["interpolate", ["exponential", 1.6], ["zoom"], 12, 1, 18, 20],
        },
      },
      {
        id: "buildings",
        type: "fill-extrusion",
        source: "omt",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": [
            "match",
            ["%", ["round", ["to-number", ["get", "render_height"], 0]], 3],
            0,
            theme.buildings[0],
            1,
            theme.buildings[1],
            theme.buildings[2],
          ],
          "fill-extrusion-height": ["to-number", ["get", "render_height"], 6],
          "fill-extrusion-base": ["to-number", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.93,
        },
      },
      {
        id: "route-glow",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.55, "line-blur": 2 },
      },
      {
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": theme.route, "line-width": 6, "line-dasharray": [0.1, 2] },
      },
      {
        id: "street-names",
        type: "symbol",
        source: "omt",
        "source-layer": "transportation_name",
        minzoom: 15,
        filter: ["in", ["get", "class"], ["literal", ["primary", "secondary", "tertiary"]]],
        layout: {
          "symbol-placement": "line",
          "text-field": ["coalesce", ["get", "name:latin"], ["get", "name"]],
          "text-font": ["Noto Sans Italic"],
          "text-size": 11,
          "text-letter-spacing": 0.04,
        },
        paint: {
          "text-color": theme.labelColor,
          "text-halo-color": theme.labelHalo,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
