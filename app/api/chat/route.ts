import { mockChatResponse } from "@/lib/mock/mockChatResponse";
import { generateReplyTextWithMeta, parseIntentWithMeta } from "@/lib/llm";
import {
  selectCityMockData,
  type CityMockData,
  type CityMockSelection,
} from "@/lib/mock/cityMockData";
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

  const message = body.message?.trim();

  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
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
  let replyLog: ToolCallLog;

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
  } else if (citySelection) {
    applyCityMockData(response, citySelection.data);
    response.reply = withFallbackCityNotice(
      buildCityFallbackReply(citySelection.data),
      fallbackCityNotice,
    );
  }

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
