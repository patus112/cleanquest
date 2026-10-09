import {
  emptyState,
  uid,
  type State,
  type RoomCategory,
  type ObjectCategory,
} from "../domain/model";
import { generateTasks } from "./templates";
import { todayIn } from "../domain/calendar";
export interface Setup {
  name: string;
  displayName: string;
  type: "house" | "apartment";
  area: number;
  floors: number;
  residents: number;
  children: boolean;
  pets: boolean;
  template: boolean;
  rooms: RoomCategory[];
  budget: 5 | 10 | 15 | 20 | 30;
  restDays: number[];
  monetary: boolean;
  intensity: "gentle" | "balanced" | "active";
  specialNeeds: string;
}
export function createHousehold(input: Setup, now = new Date()): State {
  const s = emptyState(),
    id = uid(),
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
    day = todayIn(timezone, now);
  s.profiles.push({
    id: uid(),
    displayName: input.displayName || "Ty",
    createdAt: now.toISOString(),
  });
  s.households.push({
    id,
    name: input.name,
    type: input.type,
    totalArea: input.area,
    residentCount: input.residents,
    children: input.children,
    pets: input.pets,
    timezone,
    createdAt: day + "T12:00:00.000Z",
  });
  s.settings.push({
    id: "settings",
    theme: "dark",
    dailyBudget: input.budget,
    restDays: input.restDays,
    intensity: input.intensity,
    energy:
      input.intensity === "gentle" ? 1 : input.intensity === "active" ? 3 : 2,
    monetary: input.monetary,
    weeklyCents: 2000,
    bonusCents: 500,
    haptics: false,
    specialNeeds: input.specialNeeds,
  });
  const count = input.template ? 2 : input.floors;
  for (let i = 0; i < count; i++)
    s.floors.push({
      id: uid(),
      householdId: id,
      name: i === 0 ? "Prízemie" : `${i}. poschodie`,
      order: i,
    });
  const add = (
    name: string,
    category: RoomCategory,
    floor: number,
    flooring: State["rooms"][number]["flooring"],
    objects: ObjectCategory[],
    enabled = true,
  ) => {
    const roomId = uid();
    s.rooms.push({
      id: roomId,
      householdId: id,
      floorId: s.floors[floor].id,
      name,
      category,
      flooring,
      order: s.rooms.length,
      enabled,
      zones: [],
    });
    for (const category of objects)
      s.objects.push({
        id: uid(),
        householdId: id,
        roomId,
        name: objectNames[category],
        category,
        quantity: 1,
        dimensions: "",
        surface: "",
        accessibility: "safe",
        notes: "",
      });
  };
  if (input.template) {
    add("Vstupná chodba", "hallway", 0, "tile", [
      "door",
      "cabinet",
      "bench",
      "wardrobe",
      "floor",
    ]);
    add("Úzka chodba", "hallway", 0, "tile", ["door", "switch", "floor"]);
    add("Dolná kúpeľňa", "bathroom", 0, "tile", [
      "toilet",
      "sink",
      "tap",
      "mirror",
      "cabinet",
      "floor",
    ]);
    add("Kuchyňa", "kitchen", 0, "tile", [
      "island",
      "worktop",
      "cabinet",
      "drawer",
      "sink",
      "tap",
      "hood",
      "hob",
      "fridge",
      "oven",
      "dishwasher",
      "bin",
      "floor",
    ]);
    add("Obývačka", "living", 0, "tile", [
      "sofa",
      "tv",
      "cabinet",
      "table",
      "speaker",
      "floor",
    ]);
    // Total glazed area is informational. Panels must be explicitly configured by the user.
    const living = s.rooms.at(-1)!;
    living.windowArea = 14;
    living.zones = [
      "Zasklenie približne 14 m² – jednotlivé panely pridaj podľa skutočnosti",
    ];
    add("Jedáleň", "dining", 0, "tile", ["table", "chair", "carpet", "floor"]);
    add("Terasa", "terrace", 0, "tile", ["floor"]);
    add("Danteho izba", "child", 1, "laminate", [
      "bed",
      "wardrobe",
      "shelf",
      "toy",
      "floor",
    ]);
    add("Danteho herňa", "playroom", 1, "laminate", [
      "toy",
      "shelf",
      "cabinet",
      "floor",
    ]);
    add("Horná chodba", "hallway", 1, "laminate", ["floor"]);
    add("Spálňa", "bedroom", 1, "carpet", [
      "bed",
      "wardrobe",
      "cabinet",
      "carpet",
      "floor",
    ]);
    add("Horné WC", "toilet", 1, "tile", ["toilet", "floor"]);
    add("Horná kúpeľňa", "bathroom", 1, "tile", [
      "bathtub",
      "sink",
      "tap",
      "mirror",
      "cabinet",
      "washer",
      "dryer",
      "floor",
    ]);
    add("Balkón spálne", "terrace", 1, "other", [], false);
  } else {
    // Quick setup adds only the explicitly selected rooms and their floor surface.
    for (const category of input.rooms)
      add(
        roomNames[category],
        category,
        0,
        category === "bathroom" || category === "kitchen" ? "tile" : "other",
        ["floor"],
      );
  }
  s.tasks.push(...generateTasks(s));
  return s;
}
import {
  objectLabels as objectNames,
  roomLabels as roomNames,
} from "../domain/model";
