import OpenAI from "openai";
import type {
  ChatHistoryMessage,
  ChatResponse,
  DisplayCard,
  Itinerary,
  MapData,
  MobilityPreference,
  RestaurantCard,
  ScenicCard,
  TravelStyle,
  TripIntent,
  TripIntentName,
} from "@/types/agent";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

type IntentPayload = {
  intent?: unknown;
  city?: unknown;
  date?: unknown;
  durationHours?: unknown;
  companions?: unknown;
  preferences?: unknown;
  avoid?: unknown;
  needFood?: unknown;
  needBooking?: unknown;
  needMap?: unknown;
  travelStyle?: unknown;
};

export type IntentParseResult = {
  intent: TripIntent;
  usedFallback: boolean;
  errorMessage?: string;
  latencyMs: number;
  model: string;
  attempts: number;
};

export type LlmConversationContext = {
  historyMessages?: ChatHistoryMessage[];
  lastResponse?: ChatResponse;
  image?: string;
};

export type GenerateReplyTextInput = {
  message: string;
  historyMessages?: ChatHistoryMessage[];
  lastResponse?: ChatResponse;
  intent: TripIntent;
  itinerary: Itinerary;
  routeCard: DisplayCard;
  map: MapData;
  cards: Array<RestaurantCard | ScenicCard>;
};

export type GenerateReplyTextResult = {
  replyText: string;
  latencyMs: number;
  model: string;
};

const systemPrompt = `
你是美团粒粒的本地短时出游规划意图解析器。
请把用户自然语言需求解析成 JSON。
只能输出 JSON，不要解释，不要 Markdown，不要代码块。

JSON 字段必须包含：
{
  "intent": "plan_trip" | "modify_trip" | "booking" | "general_chat",
  "city": string,
  "date": string,
  "durationHours": number | null,
  "companions": string[],
  "preferences": {
    "cuisines": string[],
    "pace": "slow" | "balanced" | "compact",
    "interests": string[],
    "budget": "low" | "medium" | "high" | null
  },
  "avoid": string[],
  "needFood": boolean,
  "needBooking": boolean,
  "needMap": boolean,
  "travelStyle": "citywalk" | "family_trip" | "food_hunt" | "relaxed_trip"
}

解析原则：
- 如果用户在规划行程或路线，intent 使用 plan_trip。
- 如果用户是在已有方案上调整，intent 使用 modify_trip。
- 如果用户主要要订餐厅/占座/预约，intent 使用 booking。
- 如果和出游规划无关，intent 使用 general_chat。
- 如果有历史对话或上一轮行程，且用户说“预算低一点”“不要走太多路”“换一家餐厅”“调整一下”等，intent 必须使用 modify_trip。
- 如果有历史对话或上一轮行程，且用户说“帮我预订餐厅”“订这个”“确认预订”等，intent 必须使用 booking。
- 如果用户没有明确说新的城市或新的完整行程，优先沿用 lastResponse 里的城市。
- city 不确定时返回空字符串。
- durationHours 不确定时返回 null。
`.trim();

const systemPromptWithImage = `
你是美团粒粒的本地短时出游规划意图解析器。
用户上传了一张图片，请先分析图片内容，然后结合文字描述解析出 JSON 意图。
只能输出 JSON，不要解释，不要 Markdown，不要代码块。

图片分析要求：
- 图片是什么类型？（风景照、美食图、地图截图、行程单、餐厅照片、门票、活动海报等）
- 图片中包含哪些旅行相关信息？（地点/城市、景点名称、餐厅名、时间、人数、菜系、交通方式等）
- 分析出的信息用于填充 JSON 字段

JSON 字段必须包含：
{
  "intent": "plan_trip" | "modify_trip" | "booking" | "general_chat",
  "city": string,
  "date": string,
  "durationHours": number | null,
  "companions": string[],
  "preferences": {
    "cuisines": string[],
    "pace": "slow" | "balanced" | "compact",
    "interests": string[],
    "budget": "low" | "medium" | "high" | null
  },
  "avoid": string[],
  "needFood": boolean,
  "needBooking": boolean,
  "needMap": boolean,
  "travelStyle": "citywalk" | "family_trip" | "food_hunt" | "relaxed_trip"
}

解析原则：
- 如果图片显示或暗示是在规划行程/路线，intent 使用 plan_trip。
- 如果图片是美食但用户文字没有明确要求，needFood 优先设为 true。
- 如果图片中有明确地点，优先识别城市和具体景点。
- 如果图片显示时间、人数等信息，应该体现在 date、companions 等字段。
- 如果图片与旅行无关或无法判断，intent 使用 general_chat。
- city 不确定时返回空字符串。
- durationHours 不确定时返回 null。
`.trim();

const replySystemPrompt = `
你是“美团粒粒”，一个亲切、简洁、靠谱的本地出行规划搭子。
你要根据用户真实输入、已解析出的意图，以及传入的 mock 行程/地图/卡片数据生成自然语言回复。

硬性规则：
- 只能基于传入的数据回答。
- 不要编造传入数据中不存在的地点、餐厅、景点、时间、价格、评分或路线。
- 不要生成完整 JSON，不要 Markdown，不要列表标题。
- 回复 2 到 4 句话，语气自然，像在聊天。
- 可以提到路线节奏、少绕路、餐厅排队/可预订等信息，但必须来自传入数据。
- 如果 intent 是 modify_trip，要明确表示是在“原来的路线/原方案基础上”调整；目前不要声称已经真正重排地图。
- 如果 intent 是 booking，要说明是基于当前方案的模拟预订确认，不要声称真实下单或占座。
`.trim();

export async function parseIntent(
  message: string,
  context: LlmConversationContext = {},
): Promise<TripIntent> {
  const result = await parseIntentWithMeta(message, context);
  return result.intent;
}

export async function generateReplyText(
  input: GenerateReplyTextInput,
): Promise<string> {
  const result = await generateReplyTextWithMeta(input);
  return result.replyText;
}

export async function generateReplyTextWithMeta(
  input: GenerateReplyTextInput,
): Promise<GenerateReplyTextResult> {
  const startedAt = Date.now();
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.45,
    messages: [
      {
        role: "system",
        content: replySystemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(buildReplyPromptData(input)),
      },
    ],
  });

  const replyText = completion.choices[0]?.message?.content?.trim();

  if (!replyText) {
    throw new Error("DeepSeek returned an empty reply");
  }

  return {
    replyText,
    latencyMs: Date.now() - startedAt,
    model,
  };
}

function buildReplyPromptData(input: GenerateReplyTextInput) {
  return {
    task: "基于这些限定数据生成美团粒粒的中文回复",
    userMessage: input.message,
    contextualGuidance: buildContextualReplyGuidance(input),
    historyMessages: summarizeHistoryMessages(input.historyMessages),
    lastResponse: summarizeLastResponse(input.lastResponse),
    intent: input.intent,
    itinerary: {
      title: input.itinerary.title,
      city: input.itinerary.city,
      summary: input.itinerary.summary,
      totalDurationMinutes: input.itinerary.totalDurationMinutes,
      totalWalkMinutes: input.itinerary.totalWalkMinutes,
      stops: input.itinerary.stops.map((stop) => ({
        name: stop.name,
        subtitle: stop.subtitle,
        startTime: stop.startTime,
        endTime: stop.endTime,
        type: stop.type,
        queueMinutesEstimate: stop.queueMinutesEstimate,
        tags: stop.tags,
      })),
      legs: input.itinerary.legs.map((leg) => ({
        mode: leg.mode,
        durationMinutes: leg.durationMinutes,
        distanceMeters: leg.distanceMeters,
        instruction: leg.instruction,
      })),
    },
    routeCard: {
      title: input.routeCard.title,
      description: input.routeCard.description,
      tags: input.routeCard.tags,
    },
    map: {
      title: input.map.title,
      summary: input.map.summary,
      markers: input.map.markers.map((marker) => marker.title),
    },
    cards: input.cards.map((card) => ({
      kind: card.kind,
      name: card.name,
      tags: card.tags,
      rating: card.rating,
      priceLabel: card.priceLabel,
      queueMinutesEstimate: card.queueMinutesEstimate,
      bookingAvailable:
        card.kind === "restaurant" ? card.bookingAvailable : undefined,
    })),
  };
}

function buildContextualReplyGuidance(input: GenerateReplyTextInput) {
  if (!input.lastResponse || input.intent.intent !== "modify_trip") {
    return undefined;
  }

  const city = input.intent.city || input.itinerary.city;
  const coreStops = input.itinerary.stops
    .slice(0, 2)
    .map((stop) => stop.name)
    .join("和");

  if (/预算低|低一点|便宜|省钱/.test(input.message)) {
    return `用户是在修改原方案。回复要表达：好的，会在原来的${city}路线基础上，把餐厅优先换成人均更低、排队更短的选择。`;
  }

  if (/不要走|不想走|少走|走太多|轻松/.test(input.message)) {
    return `用户是在修改原方案。回复要表达：明白，会把原路线压缩成更轻松的版本，减少步行距离，保留${coreStops || "核心景点"}等核心点。`;
  }

  if (/换.*餐厅|换一家|餐厅/.test(input.message)) {
    return `用户是在修改原方案。回复要表达：会在原来的${city}路线附近换一家排队更短、位置不绕路的餐厅。`;
  }

  return `用户是在已有方案上继续追问或调整。回复要明确基于原来的${city}路线继续处理。`;
}

function buildIntentPromptData(
  message: string,
  context: LlmConversationContext,
) {
  return {
    currentMessage: message,
    historyMessages: summarizeHistoryMessages(context.historyMessages),
    lastResponse: summarizeLastResponse(context.lastResponse),
  };
}

function summarizeHistoryMessages(messages?: ChatHistoryMessage[]) {
  return (messages ?? []).slice(-12).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function summarizeLastResponse(response?: ChatResponse) {
  if (!response) {
    return undefined;
  }

  return {
    intent: response.intent,
    itinerary: {
      city: response.itinerary.city,
      title: response.itinerary.title,
      summary: response.itinerary.summary,
      stops: response.itinerary.stops.map((stop) => ({
        name: stop.name,
        subtitle: stop.subtitle,
        type: stop.type,
        startTime: stop.startTime,
        queueMinutesEstimate: stop.queueMinutesEstimate,
      })),
    },
    restaurants: response.restaurants.map((restaurant) => ({
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      rating: restaurant.rating,
      priceLabel: restaurant.priceLabel,
      queueMinutesEstimate: restaurant.queueMinutesEstimate,
      bookingAvailable: restaurant.bookingAvailable,
    })),
    bookingPreview: {
      restaurantName: response.booking.preview.restaurantName,
      time: response.booking.preview.time,
      partySize: response.booking.preview.partySize,
      queueEstimateText: response.booking.preview.queueEstimateText,
    },
  };
}

export async function parseIntentWithMeta(
  message: string,
  context: LlmConversationContext = {},
): Promise<IntentParseResult> {
  const startedAt = Date.now();
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return {
      intent: fallbackIntent(message, context),
      usedFallback: true,
      errorMessage: "DEEPSEEK_API_KEY is not configured",
      latencyMs: Date.now() - startedAt,
      model,
      attempts: 0,
    };
  }

  const client = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const userContent = context.image
        ? [
            { type: "text" as const, text: JSON.stringify(buildIntentPromptData(message, context)) },
            { type: "image_url" as const, image_url: { url: context.image } },
          ]
        : JSON.stringify(buildIntentPromptData(message, context));

      const completion = await client.chat.completions.create({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: context.image ? systemPromptWithImage : systemPrompt,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error("DeepSeek returned an empty message");
      }

      return {
        intent: normalizeIntent(
          JSON.parse(content) as IntentPayload,
          message,
          context,
        ),
        usedFallback: false,
        latencyMs: Date.now() - startedAt,
        model,
        attempts: attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    intent: fallbackIntent(message, context),
    usedFallback: true,
    errorMessage:
      lastError instanceof Error ? lastError.message : "Unknown DeepSeek error",
    latencyMs: Date.now() - startedAt,
    model,
    attempts: 2,
  };
}

function normalizeIntent(
  payload: IntentPayload,
  message: string,
  context: LlmConversationContext,
): TripIntent {
  let intent = normalizeIntentName(payload.intent);
  const date = normalizeString(payload.date);
  const preferences = normalizePreferences(payload.preferences);
  const needFood = normalizeBoolean(payload.needFood);
  const needBooking =
    normalizeBoolean(payload.needBooking) || /订|预定|预订|预约|占座/.test(message);
  const messageMentionsMap =
    /路线|地图|怎么走|citywalk|行程|规划|攻略/.test(message);
  const payloadNeedMap =
    typeof payload.needMap === "boolean" ? payload.needMap : undefined;
  const fallbackIntentName = inferIntentName(
    message,
    needBooking,
    payloadNeedMap ?? messageMentionsMap,
  );

  if (
    context.lastResponse &&
    (fallbackIntentName === "modify_trip" || fallbackIntentName === "booking")
  ) {
    intent = fallbackIntentName;
  }
  const needMap =
    payloadNeedMap ?? (intent === "plan_trip" || intent === "modify_trip");
  const lastIntent = context.lastResponse?.intent;
  const city =
    normalizeString(payload.city) ??
    lastIntent?.city ??
    context.lastResponse?.itinerary.city ??
    "";

  return {
    rawText: message,
    intent,
    city,
    travelStyle: normalizeTravelStyle(
      payload.travelStyle,
      lastIntent?.travelStyle,
    ),
    date,
    dateText: date,
    durationHours: normalizeNumber(payload.durationHours),
    companions: normalizeStringArray(payload.companions),
    avoid: normalizeStringArray(payload.avoid),
    needFood,
    needBooking,
    needMap,
    constraints: {
      avoidDetours: normalizeStringArray(payload.avoid).some((item) =>
        item.includes("绕"),
      ),
      wantsMeal: needFood,
      needsBooking: needBooking,
      mobility: inferMobility(payload.avoid),
    },
    preferences,
  };
}

function fallbackIntent(
  message: string,
  context: LlmConversationContext = {},
): TripIntent {
  const durationMatch = message.match(/(\d+(?:\.\d+)?)\s*(?:个)?小时/);
  const dateMatch = message.match(
    /(今天|明天|后天|周末|周六|周日|星期六|星期日|第一天|第二天)/,
  );
  const cityMatch = message.match(/[去在到]([\u4e00-\u9fa5]{2,8})(?:玩|逛|旅游|citywalk|一日游|两天|半天|吃|看|拍|$)/i);
  const lowWalkRequested = /不想走|不要走|少走|走太多|轻松/.test(message);
  const lowBudgetRequested = /预算低|低一点|便宜|省钱/.test(message);
  const avoid = [
    message.includes("不绕") || message.includes("别绕") ? "路线绕行" : "",
    message.includes("排队") ? "排队太久" : "",
    lowWalkRequested ? "步行过多" : "",
  ].filter(Boolean);
  const needFood = /吃|饭|餐厅|美食|菜|午餐|晚餐/.test(message);
  const needBooking = /订|预定|预订|预约|占座/.test(message);
  const needMap = /路线|地图|怎么走|citywalk|行程|规划|攻略/.test(message);
  const lastIntent = context.lastResponse?.intent;
  const inferredIntent = inferIntentName(message, needBooking, needMap);

  return {
    rawText: message,
    intent: inferredIntent,
    city:
      cityMatch?.[1] ??
      lastIntent?.city ??
      context.lastResponse?.itinerary.city ??
      "",
    travelStyle: message.toLowerCase().includes("citywalk")
      ? "citywalk"
      : lastIntent?.travelStyle ?? "relaxed_trip",
    date: dateMatch?.[1],
    dateText: dateMatch?.[1],
    durationHours: durationMatch ? Number(durationMatch[1]) : undefined,
    companions: inferCompanions(message, lastIntent?.companions),
    avoid,
    needFood: needFood || !!lastIntent?.needFood,
    needBooking,
    needMap: needMap || inferredIntent === "modify_trip",
    constraints: {
      avoidDetours: avoid.includes("路线绕行"),
      mobility: avoid.includes("步行过多") ? "low_walk" : "normal",
      wantsMeal: needFood || !!lastIntent?.needFood,
      needsBooking: needBooking,
    },
    preferences: {
      cuisines: inferCuisines(message, lastIntent?.preferences.cuisines),
      pace: avoid.includes("步行过多") ? "slow" : "balanced",
      interests: inferInterests(message, lastIntent?.preferences.interests),
      budget: lowBudgetRequested ? "low" : "medium",
    },
  };
}

function normalizeIntentName(value: unknown): TripIntentName {
  if (
    value === "plan_trip" ||
    value === "modify_trip" ||
    value === "booking" ||
    value === "general_chat"
  ) {
    return value;
  }

  return "plan_trip";
}

function inferIntentName(
  message: string,
  needBooking: boolean,
  needMap: boolean,
): TripIntentName {
  if (/换|改|调整|重新|预算低|低一点|便宜|省钱|不要走|不想走|少走|走太多|轻松/.test(message)) {
    return "modify_trip";
  }

  if (
    needBooking &&
    (!needMap || !/路线|地图|怎么走|citywalk|行程|规划|攻略/.test(message))
  ) {
    return "booking";
  }

  if (/去|玩|行程|路线|citywalk|旅游|攻略|一日游|两天/.test(message)) {
    return "plan_trip";
  }

  return "general_chat";
}

function normalizeTravelStyle(
  value: unknown,
  fallback: TravelStyle = "relaxed_trip",
): TravelStyle {
  if (
    value === "citywalk" ||
    value === "family_trip" ||
    value === "food_hunt" ||
    value === "relaxed_trip"
  ) {
    return value;
  }

  return fallback;
}

function normalizePreferences(value: unknown): TripIntent["preferences"] {
  if (!value || typeof value !== "object") {
    return {
      cuisines: [],
      pace: "balanced",
      interests: [],
      budget: "medium",
    };
  }

  const payload = value as Record<string, unknown>;

  return {
    cuisines: normalizeStringArray(payload.cuisines),
    pace:
      payload.pace === "slow" ||
      payload.pace === "balanced" ||
      payload.pace === "compact"
        ? payload.pace
        : "balanced",
    interests: normalizeStringArray(payload.interests),
    budget:
      payload.budget === "low" ||
      payload.budget === "medium" ||
      payload.budget === "high"
        ? payload.budget
        : "medium",
  };
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return undefined;
}

function inferMobility(value: unknown): MobilityPreference {
  return normalizeStringArray(value).some((item) => item.includes("走"))
    ? "low_walk"
    : "normal";
}

function inferCompanions(message: string, fallback: string[] = []) {
  const companions = [...fallback];

  if (/爸妈|父母|老人|长辈/.test(message)) {
    companions.push("爸妈/长辈");
  }

  if (/孩子|小孩|亲子/.test(message)) {
    companions.push("孩子");
  }

  if (/朋友|同学|同事/.test(message)) {
    companions.push("朋友");
  }

  const partySizeMatch = message.match(/(\d+)\s*人/);
  if (partySizeMatch) {
    companions.push(`${partySizeMatch[1]}人`);
  }

  return Array.from(new Set(companions));
}

function inferCuisines(message: string, fallback: string[] = []) {
  const cuisines = [...fallback];

  if (/本地菜|当地菜/.test(message)) {
    cuisines.push("本地菜");
  }

  if (/苏帮菜/.test(message)) {
    cuisines.push("苏帮菜");
  }

  if (/川菜/.test(message)) {
    cuisines.push("川菜");
  }

  return Array.from(new Set(cuisines));
}

function inferInterests(message: string, fallback: string[] = []) {
  const interests = [...fallback];

  if (/citywalk/i.test(message)) {
    interests.push("citywalk");
  }

  if (/拍照|打卡/.test(message)) {
    interests.push("拍照打卡");
  }

  if (/博物馆/.test(message)) {
    interests.push("博物馆");
  }

  if (/园林/.test(message)) {
    interests.push("园林");
  }

  return Array.from(new Set(interests));
}
