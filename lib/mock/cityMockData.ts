import { mockChatResponse } from "@/lib/mock/mockChatResponse";
import type {
  ChatResponse,
  DisplayCard,
  Itinerary,
  MapData,
  RestaurantCard,
  ScenicCard,
  SuggestedAction,
} from "@/types/agent";

export type SupportedMockCity = "苏州" | "杭州" | "成都";

export type CityMockData = {
  city: SupportedMockCity;
  itinerary: Itinerary;
  routeCard: DisplayCard;
  map: MapData;
  restaurants: RestaurantCard[];
  scenicCards: ScenicCard[];
  displayCards: Array<RestaurantCard | ScenicCard>;
  suggestedActions: SuggestedAction[];
  booking: ChatResponse["booking"];
  uiText: Pick<
    ChatResponse["uiText"],
    | "suggestedItinerary"
    | "suggestedItineraryNote"
    | "mapIntro"
    | "mapDetailReply"
    | "bookingModalTitle"
  >;
};

export type CityMockSelection = {
  data: CityMockData;
  matchedCity: SupportedMockCity;
  requestedCity: string;
  usedFallback: boolean;
};

const suzhouData: CityMockData = {
  city: "苏州",
  itinerary: mockChatResponse.itinerary,
  routeCard: mockChatResponse.routeCard,
  map: mockChatResponse.map,
  restaurants: mockChatResponse.restaurants,
  scenicCards: mockChatResponse.scenicCards,
  displayCards: mockChatResponse.displayCards,
  suggestedActions: mockChatResponse.suggestedActions,
  booking: mockChatResponse.booking,
  uiText: {
    suggestedItinerary: mockChatResponse.uiText.suggestedItinerary,
    suggestedItineraryNote: mockChatResponse.uiText.suggestedItineraryNote,
    mapIntro: mockChatResponse.uiText.mapIntro,
    mapDetailReply: mockChatResponse.uiText.mapDetailReply,
    bookingModalTitle: mockChatResponse.uiText.bookingModalTitle,
  },
};

const hangzhouRestaurants: RestaurantCard[] = [
  {
    id: "restaurant-louwailou-gushan",
    kind: "restaurant",
    restaurantId: "mock-louwailou-gushan",
    title: "楼外楼（孤山店）",
    subtitle: "杭帮菜，人均约 118 元",
    description: "靠近西湖孤山段，适合午餐，主打西湖醋鱼、龙井虾仁等杭帮菜。",
    tags: ["杭帮菜", "可预订"],
    priority: 2,
    icon: "fork",
    visual: {
      tone: "from-[#6f8f63] via-[#d7e7b3] to-[#fff7dd]",
      heartEnabled: true,
    },
    name: "楼外楼（孤山店）",
    cuisine: "杭帮菜",
    rating: 4.5,
    priceLabel: "¥118/人",
    averagePriceCny: 118,
    address: "杭州市西湖区孤山路30号",
    queueMinutesEstimate: 15,
    distanceFromRouteMeters: 160,
    bookingAvailable: true,
  },
];

const hangzhouScenicCards: ScenicCard[] = [
  {
    id: "scenic-westlake-cafe",
    kind: "scenic",
    scenicId: "mock-westlake-cafe",
    title: "西湖·湖畔咖啡",
    subtitle: "湖边休息",
    description: "靠近白堤和孤山，适合 citywalk 中途坐下看湖景。",
    tags: ["湖景", "适合拍照"],
    priority: 1,
    icon: "camera",
    visual: {
      tone: "from-[#8fb9c8] via-[#d9edf2] to-[#f5f8e6]",
      heartEnabled: true,
    },
    name: "西湖·湖畔咖啡",
    rating: 4.6,
    priceLabel: "¥42/人",
    address: "杭州市西湖区白堤沿线",
    queueMinutesEstimate: 8,
  },
  {
    id: "scenic-lingyin-shop",
    kind: "scenic",
    scenicId: "mock-lingyin-shop",
    title: "灵隐寺文创店",
    subtitle: "祈福文创",
    description: "灵隐寺参观后顺路逛文创，适合作为下午休息点。",
    tags: ["文创", "可预约"],
    priority: 3,
    icon: "shop",
    visual: {
      tone: "from-[#d7c4a1] via-[#f5ecd8] to-[#dcebd1]",
      heartEnabled: true,
    },
    name: "灵隐寺文创店",
    rating: 4.7,
    priceLabel: "—",
    address: "杭州市西湖区灵隐路",
    queueMinutesEstimate: 10,
  },
  {
    id: "scenic-hefang-tea",
    kind: "scenic",
    scenicId: "mock-hefang-tea",
    title: "河坊街龙井茶舍",
    subtitle: "茶饮小憩",
    description: "傍晚逛河坊街时适合短暂停留，节奏轻松。",
    tags: ["茶饮", "休闲放松"],
    priority: 4,
    icon: "shop",
    visual: {
      tone: "from-[#7b9f73] via-[#d6ead0] to-[#fff4d9]",
      heartEnabled: true,
    },
    name: "河坊街龙井茶舍",
    rating: 4.5,
    priceLabel: "¥48/人",
    address: "杭州市上城区河坊街",
    queueMinutesEstimate: 6,
  },
];

const hangzhouItinerary: Itinerary = {
  id: "itinerary-hangzhou-westlake-citywalk",
  title: "杭州西湖轻松 Citywalk",
  city: "杭州",
  summary: "从断桥白堤慢逛到孤山午餐，下午去灵隐寺，傍晚收在河坊街。",
  totalDurationMinutes: 520,
  totalWalkMinutes: 82,
  totalDistanceMeters: 14200,
  stops: [
    {
      id: "stop-hangzhou-duanqiao",
      type: "attraction",
      name: "断桥残雪",
      subtitle: "西湖开场",
      description: "从断桥进入西湖，上午人流相对平稳，适合作为第一站。",
      startTime: "09:30",
      endTime: "10:20",
      durationMinutes: 50,
      address: "杭州市西湖区北山街",
      coordinates: {
        lat: 30.259,
        lng: 120.152,
      },
      queueMinutesEstimate: 0,
      tags: ["西湖", "拍照", "citywalk"],
    },
    {
      id: "stop-hangzhou-baidi",
      type: "attraction",
      name: "白堤 / 孤山",
      subtitle: "湖边漫步",
      description: "沿白堤走到孤山，路线顺直，适合慢节奏看湖。",
      startTime: "10:20",
      endTime: "11:20",
      durationMinutes: 60,
      address: "杭州市西湖区白堤",
      coordinates: {
        lat: 30.256,
        lng: 120.145,
      },
      walkMinutesFromPrevious: 12,
      queueMinutesEstimate: 0,
      tags: ["湖景", "慢走", "少绕路"],
    },
    {
      id: "stop-hangzhou-louwailou",
      type: "restaurant",
      name: "楼外楼（孤山店）",
      subtitle: "杭帮菜午餐",
      description: "午餐安排在孤山附近，减少折返，排队预计 15 分钟。",
      startTime: "11:30",
      endTime: "12:45",
      durationMinutes: 75,
      address: "杭州市西湖区孤山路30号",
      coordinates: {
        lat: 30.255,
        lng: 120.143,
      },
      walkMinutesFromPrevious: 6,
      queueMinutesEstimate: 15,
      tags: ["杭帮菜", "午餐", "可预订"],
    },
    {
      id: "stop-hangzhou-lingyin",
      type: "attraction",
      name: "灵隐寺",
      subtitle: "祈福参观",
      description: "下午转到灵隐寺，留出参观和休息时间。",
      startTime: "14:00",
      endTime: "15:50",
      durationMinutes: 110,
      address: "杭州市西湖区灵隐路法云弄1号",
      coordinates: {
        lat: 30.24,
        lng: 120.102,
      },
      walkMinutesFromPrevious: 28,
      queueMinutesEstimate: 12,
      tags: ["寺庙", "文创", "休息"],
    },
    {
      id: "stop-hangzhou-hefang",
      type: "shopping",
      name: "河坊街",
      subtitle: "傍晚小吃",
      description: "傍晚去河坊街和南宋御街，吃点小吃再收尾。",
      startTime: "17:00",
      endTime: "18:30",
      durationMinutes: 90,
      address: "杭州市上城区河坊街",
      coordinates: {
        lat: 30.247,
        lng: 120.171,
      },
      walkMinutesFromPrevious: 36,
      queueMinutesEstimate: 6,
      tags: ["小吃", "夜景", "散步"],
    },
  ],
  legs: [
    {
      id: "leg-duanqiao-baidi",
      fromStopId: "stop-hangzhou-duanqiao",
      toStopId: "stop-hangzhou-baidi",
      mode: "walk",
      durationMinutes: 12,
      distanceMeters: 900,
      instruction: "从断桥沿白堤往孤山方向慢走。",
    },
    {
      id: "leg-baidi-louwailou",
      fromStopId: "stop-hangzhou-baidi",
      toStopId: "stop-hangzhou-louwailou",
      mode: "walk",
      durationMinutes: 6,
      distanceMeters: 400,
      instruction: "孤山段步行到楼外楼午餐，避免额外绕路。",
    },
    {
      id: "leg-louwailou-lingyin",
      fromStopId: "stop-hangzhou-louwailou",
      toStopId: "stop-hangzhou-lingyin",
      mode: "taxi",
      durationMinutes: 28,
      distanceMeters: 6800,
      instruction: "午餐后打车去灵隐寺，节省体力。",
    },
    {
      id: "leg-lingyin-hefang",
      fromStopId: "stop-hangzhou-lingyin",
      toStopId: "stop-hangzhou-hefang",
      mode: "taxi",
      durationMinutes: 36,
      distanceMeters: 6100,
      instruction: "傍晚打车到河坊街，接小吃和夜景。",
    },
  ],
};

const hangzhouMap: MapData = {
  id: "map-hangzhou-westlake",
  title: "推荐路线地图",
  summary: "断桥残雪 → 白堤 / 孤山 → 楼外楼 → 灵隐寺 → 河坊街",
  center: {
    lat: 30.25,
    lng: 120.14,
  },
  zoom: 12,
  markers: [
    {
      id: "marker-hangzhou-duanqiao",
      stopId: "stop-hangzhou-duanqiao",
      title: "断桥残雪",
      type: "attraction",
      coordinates: {
        lat: 30.259,
        lng: 120.152,
      },
      order: 1,
      uiPosition: {
        left: "24%",
        top: "32%",
      },
    },
    {
      id: "marker-hangzhou-baidi",
      stopId: "stop-hangzhou-baidi",
      title: "白堤 / 孤山",
      type: "attraction",
      coordinates: {
        lat: 30.256,
        lng: 120.145,
      },
      order: 2,
      uiPosition: {
        left: "37%",
        top: "39%",
      },
    },
    {
      id: "marker-hangzhou-louwailou",
      stopId: "stop-hangzhou-louwailou",
      title: "楼外楼午餐",
      type: "restaurant",
      coordinates: {
        lat: 30.255,
        lng: 120.143,
      },
      order: 3,
      uiPosition: {
        left: "48%",
        top: "47%",
      },
    },
    {
      id: "marker-hangzhou-lingyin",
      stopId: "stop-hangzhou-lingyin",
      title: "灵隐寺",
      type: "attraction",
      coordinates: {
        lat: 30.24,
        lng: 120.102,
      },
      order: 4,
      uiPosition: {
        left: "63%",
        top: "36%",
      },
    },
    {
      id: "marker-hangzhou-hefang",
      stopId: "stop-hangzhou-hefang",
      title: "河坊街",
      type: "shopping",
      coordinates: {
        lat: 30.247,
        lng: 120.171,
      },
      order: 5,
      uiPosition: {
        left: "78%",
        top: "67%",
      },
    },
  ],
  polyline: [
    {
      lat: 30.259,
      lng: 120.152,
    },
    {
      lat: 30.256,
      lng: 120.145,
    },
    {
      lat: 30.255,
      lng: 120.143,
    },
    {
      lat: 30.24,
      lng: 120.102,
    },
    {
      lat: 30.247,
      lng: 120.171,
    },
  ],
};

const hangzhouData: CityMockData = {
  city: "杭州",
  itinerary: hangzhouItinerary,
  routeCard: {
    id: "card-route-hangzhou",
    kind: "route",
    title: "推荐路线地图",
    subtitle: "西湖到河坊街轻松线",
    description:
      "建议行程：09:30 断桥残雪 → 10:20 白堤 / 孤山 → 11:30 楼外楼午餐 → 14:00 灵隐寺 → 17:00 河坊街。",
    tags: ["西湖", "少绕路", "杭州"],
    priority: 1,
    icon: "dot",
  },
  map: hangzhouMap,
  restaurants: hangzhouRestaurants,
  scenicCards: hangzhouScenicCards,
  displayCards: toDisplayCards(hangzhouScenicCards, hangzhouRestaurants),
  suggestedActions: createSuggestedActions("mock-louwailou-gushan"),
  booking: createBooking("mock-louwailou-gushan", "楼外楼（孤山店）", "11:30", "预计 15 分钟"),
  uiText: {
    suggestedItinerary:
      "建议行程：09:30 断桥残雪 → 10:20 白堤 / 孤山 → 11:30 楼外楼午餐 → 14:00 灵隐寺 → 17:00 河坊街。",
    suggestedItineraryNote: "全程尽量减少折返，西湖段慢走，远距离转场用短程打车。",
    mapIntro: "杭州适合沿西湖慢慢展开，我先帮你按少绕路和好休息来排。",
    mapDetailReply:
      "我先帮你排了一条杭州轻松线：断桥残雪 → 白堤 / 孤山 → 楼外楼午餐 → 灵隐寺 → 河坊街。西湖段以步行为主，去灵隐寺和河坊街用短程打车衔接，午餐优先选可预订、排队可控的杭帮菜。",
    bookingModalTitle: "楼外楼午餐",
  },
};

const chengduRestaurants: RestaurantCard[] = [
  {
    id: "restaurant-chenmapo-kuanzhai",
    kind: "restaurant",
    restaurantId: "mock-chenmapo-kuanzhai",
    title: "陈麻婆豆腐（宽窄巷子店）",
    subtitle: "川菜，人均约 76 元",
    description: "靠近宽窄巷子和人民公园，适合作为午餐点，排队预计 13 分钟。",
    tags: ["川菜", "排队较短"],
    priority: 2,
    icon: "fork",
    visual: {
      tone: "from-[#9b3f25] via-[#e18a44] to-[#ffe8c6]",
      heartEnabled: true,
    },
    name: "陈麻婆豆腐（宽窄巷子店）",
    cuisine: "川菜",
    rating: 4.6,
    priceLabel: "¥76/人",
    averagePriceCny: 76,
    address: "成都市青羊区宽窄巷子片区",
    queueMinutesEstimate: 13,
    distanceFromRouteMeters: 180,
    bookingAvailable: true,
  },
];

const chengduScenicCards: ScenicCard[] = [
  {
    id: "scenic-kuanzhai-tea",
    kind: "scenic",
    scenicId: "mock-kuanzhai-tea",
    title: "宽窄巷子盖碗茶",
    subtitle: "茶馆小坐",
    description: "适合在宽窄巷子慢逛时坐下喝茶，休息节奏好。",
    tags: ["盖碗茶", "适合拍照"],
    priority: 1,
    icon: "camera",
    visual: {
      tone: "from-[#4c6b45] via-[#9fbc7f] to-[#f1e2c4]",
      heartEnabled: true,
    },
    name: "宽窄巷子盖碗茶",
    rating: 4.7,
    priceLabel: "¥39/人",
    address: "成都市青羊区宽窄巷子",
    queueMinutesEstimate: 6,
  },
  {
    id: "scenic-wuhouci-shop",
    kind: "scenic",
    scenicId: "mock-wuhouci-shop",
    title: "武侯祠文创店",
    subtitle: "三国文创",
    description: "武侯祠参观后顺路逛文创店，适合轻量购物。",
    tags: ["文创", "历史"],
    priority: 3,
    icon: "shop",
    visual: {
      tone: "from-[#b85f3d] via-[#f0d0a8] to-[#f6efe4]",
      heartEnabled: true,
    },
    name: "武侯祠文创店",
    rating: 4.8,
    priceLabel: "—",
    address: "成都市武侯区武侯祠大街231号",
    queueMinutesEstimate: 8,
  },
  {
    id: "scenic-jinli-snack",
    kind: "scenic",
    scenicId: "mock-jinli-snack",
    title: "锦里小吃铺",
    subtitle: "夜游小吃",
    description: "傍晚逛锦里时适合补充小吃，作为轻松收尾。",
    tags: ["小吃", "夜景"],
    priority: 4,
    icon: "shop",
    visual: {
      tone: "from-[#733629] via-[#d98b57] to-[#ffe2bd]",
      heartEnabled: true,
    },
    name: "锦里小吃铺",
    rating: 4.5,
    priceLabel: "¥45/人",
    address: "成都市武侯区锦里古街",
    queueMinutesEstimate: 9,
  },
];

const chengduItinerary: Itinerary = {
  id: "itinerary-chengdu-kuanzhai-citywalk",
  title: "成都宽窄巷子慢游线",
  city: "成都",
  summary: "上午宽窄巷子和人民公园，午餐吃川菜，下午武侯祠，傍晚锦里收尾。",
  totalDurationMinutes: 500,
  totalWalkMinutes: 76,
  totalDistanceMeters: 11800,
  stops: [
    {
      id: "stop-chengdu-kuanzhai",
      type: "attraction",
      name: "宽窄巷子",
      subtitle: "巷子慢逛",
      description: "上午先逛宽窄巷子，拍照和茶馆都方便。",
      startTime: "09:30",
      endTime: "10:50",
      durationMinutes: 80,
      address: "成都市青羊区长顺街附近",
      coordinates: {
        lat: 30.669,
        lng: 104.055,
      },
      queueMinutesEstimate: 0,
      tags: ["老街", "拍照", "茶馆"],
    },
    {
      id: "stop-chengdu-people-park",
      type: "attraction",
      name: "人民公园",
      subtitle: "喝茶休息",
      description: "从宽窄巷子顺路到人民公园，喝茶休息，减少连续步行。",
      startTime: "11:00",
      endTime: "11:50",
      durationMinutes: 50,
      address: "成都市青羊区祠堂街9号",
      coordinates: {
        lat: 30.659,
        lng: 104.058,
      },
      walkMinutesFromPrevious: 12,
      queueMinutesEstimate: 0,
      tags: ["公园", "盖碗茶", "休息"],
    },
    {
      id: "stop-chengdu-chenmapo",
      type: "restaurant",
      name: "陈麻婆豆腐（宽窄巷子店）",
      subtitle: "川菜午餐",
      description: "午餐安排川菜，排队预计 13 分钟，离上午路线不远。",
      startTime: "12:10",
      endTime: "13:20",
      durationMinutes: 70,
      address: "成都市青羊区宽窄巷子片区",
      coordinates: {
        lat: 30.666,
        lng: 104.057,
      },
      walkMinutesFromPrevious: 14,
      queueMinutesEstimate: 13,
      tags: ["川菜", "午餐", "少排队"],
    },
    {
      id: "stop-chengdu-wuhouci",
      type: "attraction",
      name: "武侯祠",
      subtitle: "历史参观",
      description: "下午去武侯祠，参观节奏稳定，也方便接锦里。",
      startTime: "14:30",
      endTime: "16:00",
      durationMinutes: 90,
      address: "成都市武侯区武侯祠大街231号",
      coordinates: {
        lat: 30.642,
        lng: 104.049,
      },
      walkMinutesFromPrevious: 24,
      queueMinutesEstimate: 10,
      tags: ["历史", "文创", "经典"],
    },
    {
      id: "stop-chengdu-jinli",
      type: "shopping",
      name: "锦里",
      subtitle: "傍晚夜游",
      description: "傍晚直接从武侯祠接锦里，小吃和夜景作为收尾。",
      startTime: "16:10",
      endTime: "17:40",
      durationMinutes: 90,
      address: "成都市武侯区锦里古街",
      coordinates: {
        lat: 30.644,
        lng: 104.05,
      },
      walkMinutesFromPrevious: 6,
      queueMinutesEstimate: 8,
      tags: ["小吃", "夜景", "散步"],
    },
  ],
  legs: [
    {
      id: "leg-kuanzhai-people-park",
      fromStopId: "stop-chengdu-kuanzhai",
      toStopId: "stop-chengdu-people-park",
      mode: "walk",
      durationMinutes: 12,
      distanceMeters: 900,
      instruction: "从宽窄巷子步行到人民公园，顺路休息。",
    },
    {
      id: "leg-people-park-chenmapo",
      fromStopId: "stop-chengdu-people-park",
      toStopId: "stop-chengdu-chenmapo",
      mode: "taxi",
      durationMinutes: 14,
      distanceMeters: 1800,
      instruction: "短程打车回宽窄巷子片区吃午餐，减少步行。",
    },
    {
      id: "leg-chenmapo-wuhouci",
      fromStopId: "stop-chengdu-chenmapo",
      toStopId: "stop-chengdu-wuhouci",
      mode: "taxi",
      durationMinutes: 24,
      distanceMeters: 5200,
      instruction: "午餐后打车去武侯祠，控制转场时间。",
    },
    {
      id: "leg-wuhouci-jinli",
      fromStopId: "stop-chengdu-wuhouci",
      toStopId: "stop-chengdu-jinli",
      mode: "walk",
      durationMinutes: 6,
      distanceMeters: 450,
      instruction: "武侯祠和锦里相邻，步行衔接即可。",
    },
  ],
};

const chengduMap: MapData = {
  id: "map-chengdu-kuanzhai",
  title: "推荐路线地图",
  summary: "宽窄巷子 → 人民公园 → 陈麻婆豆腐 → 武侯祠 → 锦里",
  center: {
    lat: 30.656,
    lng: 104.054,
  },
  zoom: 12,
  markers: [
    {
      id: "marker-chengdu-kuanzhai",
      stopId: "stop-chengdu-kuanzhai",
      title: "宽窄巷子",
      type: "attraction",
      coordinates: {
        lat: 30.669,
        lng: 104.055,
      },
      order: 1,
      uiPosition: {
        left: "24%",
        top: "34%",
      },
    },
    {
      id: "marker-chengdu-people-park",
      stopId: "stop-chengdu-people-park",
      title: "人民公园",
      type: "attraction",
      coordinates: {
        lat: 30.659,
        lng: 104.058,
      },
      order: 2,
      uiPosition: {
        left: "38%",
        top: "48%",
      },
    },
    {
      id: "marker-chengdu-chenmapo",
      stopId: "stop-chengdu-chenmapo",
      title: "陈麻婆午餐",
      type: "restaurant",
      coordinates: {
        lat: 30.666,
        lng: 104.057,
      },
      order: 3,
      uiPosition: {
        left: "49%",
        top: "38%",
      },
    },
    {
      id: "marker-chengdu-wuhouci",
      stopId: "stop-chengdu-wuhouci",
      title: "武侯祠",
      type: "attraction",
      coordinates: {
        lat: 30.642,
        lng: 104.049,
      },
      order: 4,
      uiPosition: {
        left: "64%",
        top: "58%",
      },
    },
    {
      id: "marker-chengdu-jinli",
      stopId: "stop-chengdu-jinli",
      title: "锦里",
      type: "shopping",
      coordinates: {
        lat: 30.644,
        lng: 104.05,
      },
      order: 5,
      uiPosition: {
        left: "78%",
        top: "69%",
      },
    },
  ],
  polyline: [
    {
      lat: 30.669,
      lng: 104.055,
    },
    {
      lat: 30.659,
      lng: 104.058,
    },
    {
      lat: 30.666,
      lng: 104.057,
    },
    {
      lat: 30.642,
      lng: 104.049,
    },
    {
      lat: 30.644,
      lng: 104.05,
    },
  ],
};

const chengduData: CityMockData = {
  city: "成都",
  itinerary: chengduItinerary,
  routeCard: {
    id: "card-route-chengdu",
    kind: "route",
    title: "推荐路线地图",
    subtitle: "宽窄巷子到锦里慢游线",
    description:
      "建议行程：09:30 宽窄巷子 → 11:00 人民公园喝茶 → 12:10 陈麻婆豆腐午餐 → 14:30 武侯祠 → 16:10 锦里。",
    tags: ["成都", "川菜", "少走路"],
    priority: 1,
    icon: "dot",
  },
  map: chengduMap,
  restaurants: chengduRestaurants,
  scenicCards: chengduScenicCards,
  displayCards: toDisplayCards(chengduScenicCards, chengduRestaurants),
  suggestedActions: createSuggestedActions("mock-chenmapo-kuanzhai"),
  booking: createBooking(
    "mock-chenmapo-kuanzhai",
    "陈麻婆豆腐（宽窄巷子店）",
    "12:10",
    "预计 13 分钟",
  ),
  uiText: {
    suggestedItinerary:
      "建议行程：09:30 宽窄巷子 → 11:00 人民公园喝茶 → 12:10 陈麻婆豆腐午餐 → 14:30 武侯祠 → 16:10 锦里。",
    suggestedItineraryNote: "整体以慢逛和喝茶休息为主，远一点的路段用短程打车衔接。",
    mapIntro: "成都适合慢慢逛、坐下来喝茶，我先按轻松少绕的节奏帮你排。",
    mapDetailReply:
      "我先帮你排了一条成都慢游线：宽窄巷子 → 人民公园 → 陈麻婆豆腐午餐 → 武侯祠 → 锦里。上午巷子和公园步行衔接，午餐后用短程打车去武侯祠，最后步行到锦里收尾。",
    bookingModalTitle: "陈麻婆豆腐午餐",
  },
};

export const cityMockData: Record<SupportedMockCity, CityMockData> = {
  苏州: suzhouData,
  杭州: hangzhouData,
  成都: chengduData,
};

export function selectCityMockData(city?: string): CityMockSelection {
  const requestedCity = city?.trim() ?? "";
  const matchedCity = normalizeMockCity(requestedCity);

  if (matchedCity) {
    return {
      data: cityMockData[matchedCity],
      matchedCity,
      requestedCity,
      usedFallback: false,
    };
  }

  return {
    data: cityMockData["苏州"],
    matchedCity: "苏州",
    requestedCity,
    usedFallback: true,
  };
}

function normalizeMockCity(city: string): SupportedMockCity | undefined {
  if (city.includes("苏州")) {
    return "苏州";
  }

  if (city.includes("杭州")) {
    return "杭州";
  }

  if (city.includes("成都")) {
    return "成都";
  }

  return undefined;
}

function createSuggestedActions(restaurantId: string): SuggestedAction[] {
  return [
    {
      id: "action-change-restaurant",
      label: "换一家餐厅",
      icon: "fork",
      type: "change_restaurant",
      payload: {
        maxQueueMinutes: 10,
      },
    },
    {
      id: "action-photo",
      label: "想拍照",
      icon: "camera",
      type: "refine_route",
      payload: {
        interest: "photo",
      },
    },
    {
      id: "action-lower-budget",
      label: "预算低一点",
      icon: "shop",
      type: "refine_route",
      payload: {
        budget: "lower",
      },
    },
    {
      id: "action-booking",
      label: "帮我预定餐厅",
      icon: "calendar",
      type: "confirm_booking",
      primary: true,
      payload: {
        restaurantId,
        partySize: 2,
      },
    },
    {
      id: "action-lower-map-budget",
      label: "预算想低一点",
      icon: "coin",
      type: "refine_route",
      payload: {
        budget: "lower",
      },
    },
  ];
}

function createBooking(
  restaurantId: string,
  restaurantName: string,
  time: string,
  queueEstimateText: string,
): ChatResponse["booking"] {
  return {
    preview: {
      id: `booking-preview-${restaurantId}`,
      restaurantId,
      restaurantName,
      time,
      partySize: 2,
      queueEstimateText,
      fieldLabels: {
        restaurant: "餐厅",
        time: "时间",
        partySize: "人数",
        queue: "排队",
      },
      actionLabel: "确认预订",
      cancelLabel: "取消",
      disclaimer: "当前仅为本地 mock 预订，不会真实下单或占座。",
    },
    result: {
      status: "confirmed",
      confirmationId: `mock-booking-${restaurantId}`,
      message: "已完成模拟预订确认，不会真实下单或占座。",
    },
  };
}

function toDisplayCards(
  scenicCards: ScenicCard[],
  restaurants: RestaurantCard[],
) {
  return [...scenicCards, ...restaurants].sort(
    (first, second) => first.priority - second.priority,
  );
}
