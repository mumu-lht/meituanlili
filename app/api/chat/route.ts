import { mockChatResponse } from "@/lib/mock/mockChatResponse";
import { generateReplyTextWithMeta, parseIntentWithMeta } from "@/lib/llm";
import {
  selectCityMockData,
  cityMockData,
  type CityMockData,
  type CityMockSelection,
} from "@/lib/mock/cityMockData";
import { queryBaiduRoute, calculateUiPositions } from "@/lib/map/baidu";
import { searchAttractions, searchRestaurants } from "@/lib/poi/gaode";
import type {
  ChatHistoryMessage,
  ChatRequest,
  ChatResponse,
  ToolCallLog,
} from "@/types/agent";

const DEFAULT_USER_ID = "local-user";

export async function POST(request: Request) {
  let body: Partial<ChatRequest>;

  try {
    const payload = (await request.json()) as unknown;
    body = payload && typeof payload === "object" ? (payload as ChatRequest) : {};
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = body.message?.trim() || "";
  const hasImage = !!body.image;

  if (!message && !hasImage) {
    return Response.json({ error: "message or image is required" }, { status: 400 });
  }

  const userId = body.userId?.trim() || DEFAULT_USER_ID;
  const conversationId =
    body.conversationId?.trim() ||
    body.sessionId?.trim() ||
    `local-conversation-${userId}`;
  const historyMessages = normalizeHistoryMessages(body.historyMessages);
  const lastResponse = isChatResponse(body.lastResponse)
    ? body.lastResponse
    : undefined;
  const now = new Date().toISOString();
  const intentResult = await parseIntentWithMeta(message, {
    historyMessages,
    lastResponse,
    image: body.image,
  });
  const response = structuredClone(mockChatResponse) as ChatResponse;

  response.sessionId = conversationId;
  response.sampleUserMessage = message;
  response.intent = intentResult.intent;

  if (body.city?.trim() && !response.intent.city) {
    response.intent.city = body.city.trim();
  }

  const shouldUseLastResponse =
    !!lastResponse &&
    (response.intent.intent === "modify_trip" ||
      response.intent.intent === "booking" ||
      response.intent.intent === "general_chat");
  const citySelection = shouldUseLastResponse
    ? undefined
    : selectCityMockData(response.intent.city);
  const fallbackCityNotice = citySelection
    ? buildFallbackCityNotice(citySelection)
    : "";

  if (shouldUseLastResponse && lastResponse) {
    applyPreviousResponseData(response, lastResponse);
    response.reply = buildContextFallbackReply(message, response);
  } else if (citySelection && !citySelection.usedFallback) {
    applyCityMockData(response, citySelection.data);
    response.reply = withFallbackCityNotice(
      buildCityFallbackReply(citySelection.data),
      fallbackCityNotice,
    );
    await enrichWithBaiduMap(response);
  } else if (response.intent.city) {
    const city = response.intent.city.trim();
    const poisResult = await buildItineraryFromPoi(city, response.intent);
    if (poisResult) {
      applyPoiData(response, poisResult);
      response.reply = buildPoiReply(city, poisResult);
      await enrichWithBaiduMap(response);
      response.reply = withFallbackCityNotice(
        response.reply,
        fallbackCityNotice,
      );
    } else {
      applyCityMockData(response, cityMockData["苏州"]);
      response.reply = `抱歉，暂时无法获取 ${city} 的数据，先用苏州示例数据演示。`;
      await enrichWithBaiduMap(response);
    }
  }

  let replyLog: ToolCallLog;
  const usePoiReply = response.reply && response.reply.includes("为你规划了");

  if (usePoiReply) {
    replyLog = {
      id: "tool-llm-generate-reply",
      toolName: "llm_generate_reply",
      status: "skipped",
      mock: false,
      inputSummary: "POI 数据已通过高德获取，使用结构化回复",
      outputSummary: `高德 POI 回复：${response.reply.slice(0, 80)}`,
      latencyMs: 0,
      createdAt: now,
    };
  } else {
    try {
      const replyResult = await generateReplyTextWithMeta({
        message,
        historyMessages,
        lastResponse,
        intent: response.intent,
        itinerary: response.itinerary,
        routeCard: response.routeCard,
        map: response.map,
        cards: response.displayCards,
      });

      response.reply = withFallbackCityNotice(
        replyResult.replyText,
        fallbackCityNotice,
      );
      replyLog = {
        id: "tool-llm-generate-reply",
        toolName: "llm_generate_reply",
        status: "success",
        mock: false,
        inputSummary: "基于用户输入、真实 intent 和 mock 行程数据生成回复",
        outputSummary: `DeepSeek 回复生成成功：${replyResult.replyText.slice(
          0,
          80,
        )}`,
        latencyMs: replyResult.latencyMs,
        createdAt: now,
      };
    } catch (error) {
      replyLog = {
        id: "tool-llm-generate-reply",
        toolName: "llm_generate_reply",
        status: "error",
        mock: true,
        inputSummary: "基于用户输入、真实 intent 和 mock 行程数据生成回复",
        outputSummary: `DeepSeek 回复生成失败，已使用 mock reply。原因：${
          error instanceof Error ? error.message : "unknown"
        }`,
        latencyMs: 0,
        createdAt: now,
      };
    }
  }

  const llmIntentLog: ToolCallLog = {
    id: "tool-llm-intent-parser",
    toolName: "llm_intent_parser",
    status: intentResult.usedFallback ? "error" : "success",
    mock: intentResult.usedFallback,
    inputSummary: `解析用户输入意图：${message.slice(0, 80)}`,
    outputSummary: intentResult.usedFallback
      ? `DeepSeek 解析失败，已使用 fallback intent。原因：${
          intentResult.errorMessage ?? "unknown"
        }`
      : `DeepSeek 解析成功：${intentResult.intent.intent} / ${
          intentResult.intent.city || "未识别城市"
        }`,
    latencyMs: intentResult.latencyMs,
    createdAt: now,
  };

  response.toolCallLogs = [
    llmIntentLog,
    replyLog,
    ...response.toolCallLogs.map((log) => ({
      ...log,
      createdAt: now,
    })),
  ];

  return Response.json(response);
}

function normalizeHistoryMessages(
  messages: ChatRequest["historyMessages"],
): ChatHistoryMessage[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter(
      (message): message is ChatHistoryMessage =>
        !!message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0,
    )
    .slice(-12)
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content.trim(),
      createdAt: message.createdAt,
    }));
}

function isChatResponse(value: unknown): value is ChatResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const response = value as Partial<ChatResponse>;

  return (
    typeof response.sessionId === "string" &&
    typeof response.reply === "string" &&
    !!response.intent &&
    !!response.itinerary &&
    !!response.map &&
    Array.isArray(response.displayCards)
  );
}

function applyPreviousResponseData(
  response: ChatResponse,
  previousResponse: ChatResponse,
) {
  response.itinerary = structuredClone(previousResponse.itinerary);
  response.routeCard = structuredClone(previousResponse.routeCard);
  response.map = structuredClone(previousResponse.map);
  response.restaurants = structuredClone(previousResponse.restaurants);
  response.scenicCards = structuredClone(previousResponse.scenicCards);
  response.displayCards = structuredClone(previousResponse.displayCards);
  response.suggestedActions = structuredClone(previousResponse.suggestedActions);
  response.booking = structuredClone(previousResponse.booking);
  response.uiText = structuredClone(previousResponse.uiText);
  response.userMemory = structuredClone(previousResponse.userMemory);
  response.intent.city ||= previousResponse.intent.city;
  response.intent.travelStyle = previousResponse.intent.travelStyle;
}

function applyCityMockData(response: ChatResponse, data: CityMockData) {
  response.itinerary = structuredClone(data.itinerary);
  response.routeCard = structuredClone(data.routeCard);
  response.map = structuredClone(data.map);
  response.restaurants = structuredClone(data.restaurants);
  response.scenicCards = structuredClone(data.scenicCards);
  response.displayCards = structuredClone(data.displayCards);
  response.suggestedActions = structuredClone(data.suggestedActions);
  response.booking = structuredClone(data.booking);
  response.uiText = {
    ...response.uiText,
    ...data.uiText,
  };
  response.userMemory = {
    ...response.userMemory,
    city: data.city,
    preferredCuisines: data.restaurants.map((restaurant) => restaurant.cuisine),
  };
}

function buildContextFallbackReply(message: string, response: ChatResponse) {
  const city = response.intent.city || response.itinerary.city;
  const coreStops = response.itinerary.stops
    .slice(0, 2)
    .map((stop) => stop.name)
    .join("和");
  const restaurant = response.restaurants[0];

  if (/预算低|便宜|省钱|低一点/.test(message)) {
    return `好的，我会在原来的${city}路线基础上，把餐厅优先换成人均更低、排队更短的选择。当前路线先保留不变，优先调整吃饭和休息点的预算。`;
  }

  if (/不要走|不想走|少走|走太多|轻松/.test(message)) {
    return `明白，我会把原路线压缩成更轻松的版本，减少步行距离，保留${coreStops || "核心景点"}两个核心点。远一点的路段优先用打车或地铁衔接。`;
  }

  if (/换.*餐厅|换一家|餐厅/.test(message)) {
    return `可以，我会在原来的${city}路线附近换一家更合适的餐厅，优先看排队更短、位置不绕路的选择。${
      restaurant ? `当前参考餐厅是 ${restaurant.name}。` : ""
    }`;
  }

  if (/订|预定|预订|预约|占座/.test(message)) {
    return `可以，我会基于当前方案帮你准备${response.booking.preview.restaurantName}的模拟预订确认。当前不会真实下单或占座，需要你点确认后才进入模拟成功状态。`;
  }

  return `收到，我会基于原来的${city}行程继续调整。当前地图和卡片先沿用这版方案，回复会优先围绕你的新要求来改。`;
}

function buildCityFallbackReply(data: CityMockData) {
  const route = data.itinerary.stops
    .map((stop) => stop.name)
    .join(" → ");
  const restaurant = data.restaurants[0];

  return `我先按${data.city}的示例数据帮你排一版：${route}。${data.itinerary.summary}${
    restaurant
      ? ` 午餐优先看 ${restaurant.name}，排队预计 ${restaurant.queueMinutesEstimate} 分钟。`
      : ""
  }`;
}

function buildFallbackCityNotice(selection: CityMockSelection) {
  if (!selection.usedFallback) {
    return "";
  }

  const requestedCity = selection.requestedCity || "你提到的城市";

  return `我暂时还没有${requestedCity}的本地 mock 数据，先用苏州示例城市数据帮你演示规划流程。`;
}

function withFallbackCityNotice(replyText: string, notice: string) {
  if (!notice) {
    return replyText;
  }

  return `${notice}${replyText}`;
}

async function enrichWithBaiduMap(response: ChatResponse) {
  try {
    const stops = response.itinerary.stops.map((stop) => ({
      name: stop.name,
      coordinates: { lat: stop.coordinates.lat, lng: stop.coordinates.lng },
    }));

    if (stops.length < 2) return;

    const routeResult = await queryBaiduRoute(stops, "driving");

    const lats = routeResult.polyline.map((p) => p.lat);
    const lngs = routeResult.polyline.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    response.map.polyline = routeResult.polyline;
    response.map.center = {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2,
    };
    response.map.zoom = 12;

    response.map.markers = response.itinerary.stops.map((stop, index) => {
      const latRange = maxLat - minLat || 0.01;
      const lngRange = maxLng - minLng || 0.01;
      return {
        id: `marker-${stop.id}`,
        stopId: stop.id,
        title: stop.name,
        type: stop.type,
        coordinates: stop.coordinates,
        order: index + 1,
        uiPosition: {
          left: `${((stop.coordinates.lng - minLng) / lngRange) * 80 + 10}%`,
          top: `${((maxLat - stop.coordinates.lat) / latRange) * 80 + 10}%`,
        },
      };
    });

    response.itinerary.totalDistanceMeters = routeResult.totalDistanceMeters;
    response.itinerary.totalWalkMinutes = routeResult.totalDurationMinutes;

    if (routeResult.legs.length > 0) {
      response.itinerary.legs = routeResult.legs.map((leg, index) => ({
        id: `leg-${index}`,
        fromStopId: response.itinerary.stops[index]?.id || "",
        toStopId: response.itinerary.stops[index + 1]?.id || "",
        mode: leg.mode,
        durationMinutes: leg.durationMinutes,
        distanceMeters: leg.distanceMeters,
        instruction: leg.instruction,
      }));
    }
  } catch (error) {
    console.error("Baidu Maps API error:", error);
  }
}

type PoiResult = {
  attractions: import("@/lib/poi/gaode").PoiItem[];
  restaurants: import("@/lib/poi/gaode").PoiItem[];
};

async function buildItineraryFromPoi(
  city: string,
  intent: import("@/types/agent").TripIntent,
): Promise<PoiResult | null> {
  try {
    const keywords = intent.preferences.interests?.[0] || "";
    const cuisine = intent.preferences.cuisines?.[0] || "";

    const [attractions, restaurants] = await Promise.all([
      searchAttractions(city, keywords || "景点"),
      searchRestaurants(city, cuisine || "餐厅"),
    ]);

    if (attractions.length === 0) {
      console.error(`Gaode POI: no attractions found for city=${city}, keyword=${keywords}`);
      return null;
    }

    console.error(`Gaode POI success: city=${city}, attractions=${attractions.length}, restaurants=${restaurants.length}`);

    return { attractions, restaurants };
  } catch (error) {
    console.error("Gaode POI error:", error);
    return null;
  }
}

function applyPoiData(response: ChatResponse, pois: PoiResult) {
  const city = response.intent.city;
  const attractions = pois.attractions.slice(0, 5);
  const restaurants = pois.restaurants.slice(0, 3);

  const stops = [
    ...attractions.map((a, i) => ({
      id: `poi-attraction-${a.id}`,
      type: "attraction" as const,
      name: a.name,
      subtitle: "景点",
      description: a.address,
      startTime: `${9 + i * 2}:00`,
      endTime: `${10 + i * 2}:30`,
      durationMinutes: 90,
      address: a.address,
      coordinates: a.location,
      queueMinutesEstimate: 0,
      walkMinutesFromPrevious: i > 0 ? 15 : undefined,
      tags: ["景点"],
    })),
    ...restaurants.slice(0, 1).map((r, i) => ({
      id: `poi-restaurant-${r.id}`,
      type: "restaurant" as const,
      name: r.name,
      subtitle: "餐饮",
      description: r.address,
      startTime: `${12 + i * 2}:00`,
      endTime: `${13 + i * 2}:00`,
      durationMinutes: 60,
      address: r.address,
      coordinates: r.location,
      queueMinutesEstimate: 15,
      walkMinutesFromPrevious: 10,
      tags: ["餐饮"],
    })),
  ];

  response.itinerary = {
    id: `itinerary-${city}`,
    title: `${city} Citywalk`,
    city,
    summary: `根据你的需求规划了 ${city} 的游览路线`,
    totalDurationMinutes: 480,
    totalWalkMinutes: 60,
    totalDistanceMeters: 5000,
    stops,
    legs: [],
  };

  response.routeCard = {
    id: `card-route-${city}`,
    kind: "route",
    title: "推荐路线",
    subtitle: city,
    description: stops.map((s) => s.name).join(" → "),
    tags: [city, "Citywalk"],
    priority: 1,
    icon: "dot",
  };

  response.map = {
    id: `map-${city}`,
    title: "推荐路线地图",
    summary: stops.map((s) => s.name).join(" → "),
    center: attractions[0]?.location || { lat: 0, lng: 0 },
    zoom: 12,
    markers: [],
    polyline: [],
  };

  response.restaurants = restaurants.map((r, i) => ({
    id: `restaurant-${r.id}`,
    kind: "restaurant" as const,
    restaurantId: r.id,
    title: r.name,
    subtitle: "餐饮",
    description: r.address,
    tags: ["餐饮"],
    priority: i + 1,
    name: r.name,
    cuisine: "本地菜",
    rating: 4.0,
    priceLabel: "¥80/人",
    address: r.address,
    queueMinutesEstimate: 15,
    bookingAvailable: false,
  }));

  response.scenicCards = attractions.slice(0, 5).map((a, i) => ({
    id: `scenic-${a.id}`,
    kind: "scenic" as const,
    scenicId: a.id,
    title: a.name,
    subtitle: "景点",
    description: a.address,
    tags: ["景点"],
    priority: i + 1,
    name: a.name,
    rating: 4.2,
    priceLabel: "—",
    address: a.address,
  }));

  response.displayCards = [...response.scenicCards, ...response.restaurants];

  response.suggestedActions = [
    {
      id: "action-change-restaurant",
      label: "换一家餐厅",
      icon: "fork",
      type: "change_restaurant",
      payload: {},
    },
    {
      id: "action-lower-budget",
      label: "预算低一点",
      icon: "coin",
      type: "refine_route",
      payload: {},
    },
  ];

  response.booking = {
    preview: {
      id: "booking-preview",
      restaurantId: restaurants[0]?.id || "",
      restaurantName: restaurants[0]?.name || "",
      time: "12:00",
      partySize: 2,
      queueEstimateText: "预计 15 分钟",
      fieldLabels: { restaurant: "餐厅", time: "时间", partySize: "人数", queue: "排队" },
      actionLabel: "确认预订",
      cancelLabel: "取消",
      disclaimer: "当前为模拟预订功能",
    },
    result: {
      status: "confirmed",
      confirmationId: "",
      message: "模拟预订成功",
    },
  };
}

function buildPoiReply(city: string, pois: PoiResult): string {
  const topAttractions = pois.attractions.slice(0, 3).map((a) => a.name).join("、");
  const restaurant = pois.restaurants[0]?.name || "餐厅";

  return `为你规划了 ${city} 经典游路线：先去 ${topAttractions}，中午在 ${restaurant} 用餐。全程少绕路，节奏适中。`;
}
