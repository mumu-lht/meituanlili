export type Coordinates = {
  lat: number;
  lng: number;
};

export type RouteResult = {
  polyline: Coordinates[];
  totalDistanceMeters: number;
  totalDurationMinutes: number;
  legs: Array<{
    from: string;
    to: string;
    mode: "walk" | "taxi" | "bus" | "metro";
    distanceMeters: number;
    durationMinutes: number;
    instruction: string;
    polyline: Coordinates[];
  }>;
};

const BAIDU_DIRECTION_API = "https://api.map.baidu.com/direction/v2";

export async function queryBaiduRoute(
  stops: Array<{ name: string; coordinates: Coordinates }>,
  mode: "driving" | "walking" | "riding" = "driving",
): Promise<RouteResult> {
  const apiKey = process.env.BAIDU_MAP_API_KEY;

  if (!apiKey || stops.length < 2) {
    throw new Error("BAIDU_MAP_API_KEY not configured or insufficient stops");
  }

  const origins = stops.map((s) => `${s.coordinates.lat},${s.coordinates.lng}`).join(";");
  const destination = stops[stops.length - 1];
  const origin = stops[0];

  const url = `${BAIDU_DIRECTION_API}/${mode}?origin=${origin.coordinates.lat},${origin.coordinates.lng}&destination=${destination.coordinates.lat},${destination.coordinates.lng}&ak=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status !== 0) {
    throw new Error(`Baidu API error: ${data.message || data.status}`);
  }

  const route = data.result?.routes?.[0];
  if (!route) {
    throw new Error("No route found");
  }

  const allPoints: Coordinates[] = [];
  type LegMode = "walk" | "taxi" | "bus" | "metro";
  const legMode: LegMode = mode === "driving" ? "taxi" : mode === "walking" ? "walk" : "walk";

  if (route.steps && Array.isArray(route.steps)) {
    for (const step of route.steps) {
      if (step.polyline && Array.isArray(step.polyline)) {
        for (const pt of step.polyline) {
          allPoints.push({ lat: pt.lat, lng: pt.lng });
        }
      }
    }
  }

  const legs = [
    {
      from: origin.name,
      to: destination.name,
      mode: legMode,
      distanceMeters: route.distance,
      durationMinutes: Math.round(route.duration / 60),
      instruction: "",
      polyline: allPoints,
    },
  ];

  return {
    polyline: allPoints,
    totalDistanceMeters: route.distance,
    totalDurationMinutes: Math.round(route.duration / 60),
    legs,
  };
}

function decodePolyline(points: Array<{ lat: number; lng: number }>): Coordinates[] {
  return points.map((p) => ({ lat: p.lat, lng: p.lng }));
}

export function calculateUiPositions(
  polyline: Coordinates[],
  mapCenter: Coordinates,
): Array<{ left: string; top: string }> {
  if (polyline.length === 0) return [];

  const lats = polyline.map((p) => p.lat);
  const lngs = polyline.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;

  return polyline.map((p) => ({
    left: `${((p.lng - minLng) / lngRange) * 80 + 10}%`,
    top: `${((maxLat - p.lat) / latRange) * 80 + 10}%`,
  }));
}
