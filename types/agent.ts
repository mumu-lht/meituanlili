export type Coordinates = {
  lat: number;
  lng: number;
};

export type StopType =
  | "attraction"
  | "restaurant"
  | "cafe"
  | "shopping"
  | "transport"
  | "rest";

export type TravelStyle =
  | "citywalk"
  | "family_trip"
  | "food_hunt"
  | "relaxed_trip";

export type MobilityPreference = "low_walk" | "normal" | "high_walk";

export type TripIntentName =
  | "plan_trip"
  | "modify_trip"
  | "booking"
  | "general_chat";

export type SuggestedActionType =
  | "refine_route"
  | "confirm_booking"
  | "change_restaurant"
  | "save_memory";

export type ToolCallStatus = "mocked" | "success" | "skipped" | "error";

export type ToolName =
  | "intent-parser"
  | "llm_intent_parser"
  | "llm_generate_reply"
  | "model"
  | "rag"
  | "map"
  | "xiaohongshu"
  | "meituan"
  | "queue"
  | "memory";

export type ChatRequest = {
  sessionId?: string;
  conversationId?: string;
  message: string;
  image?: string;
  historyMessages?: ChatHistoryMessage[];
  lastResponse?: ChatResponse;
  city?: string;
  userId?: string;
  memoryEnabled?: boolean;
};

export type ChatHistoryMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type ChatResponse = {
  sessionId: string;
  reply: string;
  sampleUserMessage: string;
  assets: ChatAssets;
  home: HomeContent;
  uiText: ChatUiText;
  intent: TripIntent;
  itinerary: Itinerary;
  map: MapData;
  routeCard: DisplayCard;
  displayCards: Array<RestaurantCard | ScenicCard>;
  restaurants: RestaurantCard[];
  scenicCards: ScenicCard[];
  booking: {
    preview: BookingPreview;
    result: BookingResult;
  };
  suggestedActions: SuggestedAction[];
  toolCallLogs: ToolCallLog[];
  userMemory: UserMemory;
};

export type ChatAssets = {
  logoSrc: string;
  mascotSrc: string;
};

export type HomeContent = {
  brandName: string;
  historyTitle: string;
  titlePrefix: string;
  titleName: string;
  subtitle: string;
  inputPlaceholder: string;
  history: HistoryItem[];
  quickActions: QuickAction[];
};

export type HistoryItem = {
  id: string;
  icon: string;
  title: string;
};

export type QuickAction = {
  id: string;
  icon: IconName;
  label: string;
};

export type ChatUiText = {
  thinkingLabel: string;
  followUpPlaceholder: string;
  mapFollowUpPlaceholder: string;
  routeCardTitle: string;
  suggestedItinerary: string;
  suggestedItineraryNote: string;
  mapOverviewTitle: string;
  mapIntro: string;
  mapDetailReply: string;
  backLabel: string;
  clearConversationLabel: string;
  sendLabel: string;
  bookingPreviewTitle: string;
  bookingModalTitle: string;
  bookingSuccessTitle: string;
  bookingDoneLabel: string;
  typewriterDelayMs: number;
  typewriterStepMs: number;
};

export type TripIntent = {
  rawText: string;
  intent: TripIntentName;
  city: string;
  travelStyle: TravelStyle;
  date?: string;
  dateText?: string;
  durationHours?: number;
  companions?: string[];
  avoid?: string[];
  needFood: boolean;
  needBooking: boolean;
  needMap: boolean;
  constraints: {
    avoidDetours?: boolean;
    maxQueueMinutes?: number;
    mobility?: MobilityPreference;
    wantsMeal?: boolean;
    needsBooking?: boolean;
  };
  preferences: {
    cuisines?: string[];
    pace?: "slow" | "balanced" | "compact";
    interests?: string[];
    budget?: "low" | "medium" | "high";
  };
};

export type Itinerary = {
  id: string;
  title: string;
  city: string;
  summary: string;
  totalDurationMinutes: number;
  totalWalkMinutes: number;
  totalDistanceMeters: number;
  stops: ItineraryStop[];
  legs: RouteLeg[];
};

export type ItineraryStop = {
  id: string;
  type: StopType;
  name: string;
  subtitle?: string;
  description: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  address: string;
  coordinates: Coordinates;
  queueMinutesEstimate?: number;
  walkMinutesFromPrevious?: number;
  tags: string[];
  tips?: string[];
};

export type RouteLeg = {
  id: string;
  fromStopId: string;
  toStopId: string;
  mode: "walk" | "taxi" | "metro" | "bus";
  durationMinutes: number;
  distanceMeters: number;
  instruction: string;
};

export type MapData = {
  id: string;
  title: string;
  summary: string;
  center: Coordinates;
  zoom: number;
  markers: MapMarker[];
  polyline: Coordinates[];
};

export type MapMarker = {
  id: string;
  stopId?: string;
  title: string;
  type: StopType;
  coordinates: Coordinates;
  order: number;
  uiPosition: {
    left: string;
    top: string;
  };
};

export type DisplayCard = {
  id: string;
  kind: "route" | "restaurant" | "scenic" | "insight";
  title: string;
  subtitle?: string;
  description: string;
  tags: string[];
  priority: number;
  icon?: IconName;
  visual?: {
    tone: string;
    heartEnabled?: boolean;
  };
};

export type RestaurantCard = DisplayCard & {
  kind: "restaurant";
  restaurantId: string;
  name: string;
  cuisine: string;
  rating: number;
  priceLabel: string;
  averagePriceCny?: number;
  address: string;
  queueMinutesEstimate: number;
  distanceFromRouteMeters?: number;
  bookingAvailable: boolean;
};

export type ScenicCard = DisplayCard & {
  kind: "scenic";
  scenicId: string;
  name: string;
  rating: number;
  priceLabel: string;
  address?: string;
  queueMinutesEstimate?: number;
};

export type BookingPreview = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  time: string;
  partySize: number;
  queueEstimateText: string;
  fieldLabels: {
    restaurant: string;
    time: string;
    partySize: string;
    queue: string;
  };
  actionLabel: string;
  cancelLabel: string;
  disclaimer: string;
};

export type BookingResult = {
  status: "confirmed" | "cancelled" | "failed";
  confirmationId: string;
  message: string;
};

export type SuggestedAction = {
  id: string;
  label: string;
  icon: IconName;
  type: SuggestedActionType;
  primary?: boolean;
  payload?: Record<string, string | number | boolean>;
};

export type ToolCallLog = {
  id: string;
  toolName: ToolName;
  status: ToolCallStatus;
  mock: boolean;
  inputSummary: string;
  outputSummary: string;
  latencyMs: number;
  createdAt: string;
};

export type UserMemory = {
  enabled: boolean;
  city?: string;
  mobility?: MobilityPreference;
  preferredCuisines: string[];
  maxQueueMinutes?: number;
  avoidDetours?: boolean;
  savedFacts: string[];
};

export type IconName =
  | "fork"
  | "camera"
  | "shop"
  | "calendar"
  | "coin"
  | "dot"
  | "triangle"
  | "star"
  | "diamond";
