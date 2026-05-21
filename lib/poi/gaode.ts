export type Coordinates = {
  lat: number;
  lng: number;
};

export type PoiItem = {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
  type: "attraction" | "restaurant" | "cafe" | "shopping";
};

const AMAP_REST_API = "https://restapi.amap.com/v3";

function getAmapKey() {
  return process.env.AMAP_API_KEY;
}

export async function searchAttractions(
  city: string,
  keywords: string = "景点",
): Promise<PoiItem[]> {
  const key = getAmapKey();
  if (!key) throw new Error("AMAP_API_KEY not configured");

  const url = `${AMAP_REST_API}/place/text?key=${key}&keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&citylimit=true&types=风景名胜&offset=10&page=1&extensions=all`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "1" || !data.pois) return [];

  return data.pois.slice(0, 8).map((poi: Record<string, string>) => ({
    id: poi.id,
    name: poi.name,
    address: poi.address || "",
    location: {
      lat: parseFloat(poi.location.split(",")[1] || "0"),
      lng: parseFloat(poi.location.split(",")[0] || "0"),
    },
    type: "attraction" as const,
  }));
}

export async function searchRestaurants(
  city: string,
  keywords: string = "餐厅",
): Promise<PoiItem[]> {
  const key = getAmapKey();
  if (!key) throw new Error("AMAP_API_KEY not configured");

  const url = `${AMAP_REST_API}/place/text?key=${key}&keywords=${encodeURIComponent(keywords)}&city=${encodeURIComponent(city)}&citylimit=true&types=餐饮服务&offset=10&page=1&extensions=all`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "1" || !data.pois) return [];

  return data.pois.slice(0, 6).map((poi: Record<string, string>) => ({
    id: poi.id,
    name: poi.name,
    address: poi.address || "",
    location: {
      lat: parseFloat(poi.location.split(",")[1] || "0"),
      lng: parseFloat(poi.location.split(",")[0] || "0"),
    },
    type: "restaurant" as const,
  }));
}

export async function searchCityCenter(city: string): Promise<Coordinates | null> {
  const key = getAmapKey();
  if (!key) return null;

  const url = `${AMAP_REST_API}/place/text?key=${key}&keywords=${encodeURIComponent(city)}&citylimit=true&types=城市&offset=1&page=1&extensions=all`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "1" || !data.pois || data.pois.length === 0) return null;

  const loc = data.pois[0].location;
  return {
    lat: parseFloat(loc.split(",")[1] || "0"),
    lng: parseFloat(loc.split(",")[0] || "0"),
  };
}
