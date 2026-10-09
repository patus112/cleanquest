import type {
  ObjectCategory,
  RoomCategory,
  TaskTemplate,
  State,
  Task,
} from "../domain/model";
import { uid, flooringLabels } from "../domain/model";
import { featurePresent } from "../domain/rooms";
// Every row describes an independent surface or small action, never a whole room.
type Group = [ObjectCategory, RoomCategory[], string, string[]];
const groups: Group[] = [
  [
    "door",
    [],
    "Mäkká utierka; voda",
    [
      "Utrieť jednu kľučku",
      "Utrieť spodný okraj jedných dverí",
      "Očistiť jeden rám dverí",
      "Utrieť jednu stranu dverí",
      "Odstrániť odtlačky pri kľučke",
      "Oprášiť horný okraj dverí",
    ],
  ],
  [
    "cabinet",
    [],
    "Utierka",
    [
      "Utrieť troje dvierka skrinky",
      "Utrieť vrch jednej skrinky",
      "Vytriediť jednu časť skrinky",
      "Očistiť tri úchytky",
      "Utrieť jednu vnútornú policu",
      "Vrátiť päť vecí na miesto",
    ],
  ],
  [
    "drawer",
    [],
    "Utierka; malá nádoba",
    [
      "Vytriediť jednu zásuvku",
      "Utrieť dno jednej zásuvky",
      "Roztriediť päť drobností",
      "Vybrať nepotrebné obaly zo zásuvky",
      "Utrieť čelo jednej zásuvky",
      "Zoskupiť obsah jednej priehradky",
    ],
  ],
  [
    "shelf",
    [],
    "Utierka",
    [
      "Oprášiť jednu policu",
      "Zoradiť knihy na jednej polici",
      "Vybrať tri nepotrebné veci",
      "Utrieť spodnú stranu jednej police",
      "Oprášiť päť dekorácií",
      "Uvoľniť jeden malý úložný priestor",
    ],
  ],
  [
    "bench",
    ["hallway"],
    "Utierka",
    [
      "Utrieť sedadlo lavice",
      "Oprášiť nohy lavice",
      "Upratať tri páry topánok",
      "Vytriediť jednu priehradku na topánky",
      "Utrieť plochu pod lavicou",
      "Zavesiť tri kusy oblečenia",
    ],
  ],
  [
    "toilet",
    ["toilet", "bathroom"],
    "Rukavice; prípravok na WC; samostatná utierka",
    [
      "Očistiť WC sedadlo",
      "Očistiť vonkajšok WC misy",
      "Utrieť splachovacie tlačidlo",
      "Očistiť WC misu kefou",
      "Utrieť držiak toaletného papiera",
      "Utrieť malú plochu za WC",
    ],
  ],
  [
    "sink",
    ["bathroom", "toilet", "kitchen", "laundry"],
    "Utierka; jemný čistič",
    [
      "Očistiť vnútro jedného umývadla",
      "Utrieť okraj jedného umývadla",
      "Vybrať viditeľné nečistoty zo sitka",
      "Utrieť plochu pri dreze",
      "Očistiť zátku umývadla",
      "Utrieť dávkovač mydla",
    ],
  ],
  [
    "tap",
    ["bathroom", "toilet", "kitchen"],
    "Mäkká utierka",
    [
      "Utrieť jednu batériu",
      "Vysušiť kvapky na jednej batérii",
      "Očistiť jednu páčku batérie",
      "Utrieť podstavec batérie",
      "Očistiť viditeľnú časť výtoku",
      "Utrieť viditeľnú stranu jednej batérie",
    ],
  ],
  [
    "mirror",
    ["bathroom", "toilet", "bedroom", "hallway"],
    "Utierka na sklo",
    [
      "Utrieť jedno malé zrkadlo",
      "Očistiť dolnú polovicu zrkadla",
      "Utrieť rám jedného zrkadla",
      "Odstrániť tri odtlačky zo zrkadla",
      "Očistiť jednu bezpečne dostupnú časť zrkadla",
      "Vyleštiť jednu časť zrkadla",
    ],
  ],
  [
    "bathtub",
    ["bathroom"],
    "Jemný čistič; špongia",
    [
      "Očistiť jeden okraj vane",
      "Očistiť jednu časť dna vane",
      "Utrieť jednu bočnú časť vane",
      "Utrieť zátku vane",
      "Odložiť veci z jedného okraja vane",
      "Opláchnuť jednu časť vane",
    ],
  ],
  [
    "shower",
    ["bathroom"],
    "Utierka; stierka",
    [
      "Očistiť jeden sprchový panel",
      "Utrieť jednu časť sprchovej vaničky",
      "Utrieť madlo sprchy",
      "Očistiť jednu poličku v sprche",
      "Utrieť jeden dostupný rám sprchy",
      "Očistiť sitko bez rozoberania odtoku",
    ],
  ],
  [
    "island",
    ["kitchen"],
    "Utierka",
    [
      "Utrieť jednu polovicu ostrovčeka",
      "Odložiť päť vecí z ostrovčeka",
      "Vytriediť malú kôpku papierov",
      "Utrieť jednu bočnú plochu ostrovčeka",
      "Utrieť tri úchytky ostrovčeka",
      "Vytvoriť jedno voľné miesto na ostrovčeku",
    ],
  ],
  [
    "worktop",
    ["kitchen"],
    "Utierka; jemný čistič",
    [
      "Utrieť jeden úsek pracovnej dosky",
      "Očistiť malú časť zásteny",
      "Odložiť tri veci z pracovnej dosky",
      "Utrieť plochu pri varení",
      "Očistiť jeden roh dosky",
      "Utrieť plochu pod jedným ľahkým predmetom",
    ],
  ],
  [
    "hood",
    ["kitchen"],
    "Utierka; návod výrobcu",
    [
      "Utrieť čelo digestora",
      "Očistiť ovládanie digestora",
      "Utrieť dostupný okraj digestora",
      "Skontrolovať filter podľa návodu",
      "Utrieť jednu bočnú plochu digestora",
      "Zapísať termín údržby filtra",
    ],
  ],
  [
    "hob",
    ["kitchen"],
    "Čistič vhodný na povrch",
    [
      "Utrieť jednu vychladnutú varnú zónu",
      "Očistiť ovládanie vypnutej dosky",
      "Odstrániť jednu zaschnutú škvrnu",
      "Utrieť okraj vychladnutej dosky",
      "Utrieť jednu mriežku podľa návodu",
      "Vysušiť jednu čistú varnú zónu",
    ],
  ],
  [
    "fridge",
    ["kitchen"],
    "Utierka; vlažná voda",
    [
      "Očistiť jednu policu chladničky",
      "Skontrolovať jednu priehradku potravín",
      "Utrieť jednu priehradku vo dverách",
      "Utrieť rukoväť chladničky",
      "Očistiť jednu zásuvku na zeleninu",
      "Skontrolovať viditeľné tesnenie dverí",
    ],
  ],
  [
    "oven",
    ["kitchen"],
    "Utierka; návod výrobcu",
    [
      "Utrieť rukoväť studenej rúry",
      "Očistiť ovládanie vypnutej rúry",
      "Utrieť vonkajšie sklo studenej rúry",
      "Očistiť jednu časť studeného plechu",
      "Utrieť dostupný okraj dverí rúry",
      "Skontrolovať odporúčanú údržbu rúry",
    ],
  ],
  [
    "dishwasher",
    ["kitchen"],
    "Utierka; návod výrobcu",
    [
      "Utrieť čelo umývačky",
      "Utrieť rukoväť umývačky",
      "Vyložiť jednu časť riadu",
      "Skontrolovať filter podľa návodu",
      "Utrieť dostupné tesnenie",
      "Doplniť prostriedok podľa návodu",
    ],
  ],
  [
    "microwave",
    ["kitchen"],
    "Utierka; návod výrobcu",
    [
      "Utrieť vnútornú stenu studenej mikrovlnky",
      "Umyť jeden otočný tanier",
      "Utrieť rukoväť mikrovlnky",
      "Očistiť ovládanie vypnutej mikrovlnky",
      "Utrieť vonkajšie dvierka",
      "Očistiť malú plochu pod mikrovlnkou",
    ],
  ],
  [
    "bin",
    [],
    "Rukavice; utierka",
    [
      "Vyniesť jeden malý kôš",
      "Utrieť veko jedného koša",
      "Vymeniť jedno vrecko v koši",
      "Utrieť vonkajšok jedného koša",
      "Vytriediť päť kusov odpadu",
      "Utrieť malú plochu pri koši",
    ],
  ],
  [
    "sofa",
    ["living"],
    "Vysávač; utierka",
    [
      "Povysávať jedno sedadlo pohovky",
      "Upraviť dva vankúše",
      "Očistiť jednu opierku podľa materiálu",
      "Vybrať drobnosti z jednej škáry",
      "Oprášiť jednu nohu pohovky",
      "Zložiť jednu deku",
    ],
  ],
  [
    "tv",
    ["living", "bedroom"],
    "Suchá mikrovláknová utierka",
    [
      "Oprášiť rám vypnutého TV",
      "Utrieť ovládač TV",
      "Oprášiť stojan TV",
      "Usporiadať tri voľné káble bez odpájania",
      "Utrieť jednu časť TV skrinky",
      "Oprášiť obrazovku podľa návodu",
    ],
  ],
  [
    "table",
    ["living", "dining", "kitchen"],
    "Utierka",
    [
      "Utrieť jednu polovicu stola",
      "Odložiť päť vecí zo stola",
      "Očistiť jednu nohu stola",
      "Utrieť jednu časť hrany stola",
      "Vytriediť jednu kôpku papierov",
      "Utrieť miesto pod podložkou",
    ],
  ],
  [
    "speaker",
    ["living"],
    "Suchá jemná utierka",
    [
      "Utrieť reproduktor zhora",
      "Oprášiť bočnú stranu reproduktora",
      "Oprášiť stojan reproduktora",
      "Utrieť plochu okolo reproduktora",
      "Oprášiť mriežku podľa návodu",
      "Utrieť dostupný podstavec reproduktora",
    ],
  ],
  [
    "glass",
    ["living", "terrace", "bedroom", "kitchen", "child"],
    "Stierka; utierka na sklo",
    [
      "Očistiť vnútro jedného skleneného panelu",
      "Utrieť rám jedného panelu",
      "Očistiť jednu časť vodiacej drážky",
      "Utrieť jeden parapet",
      "Odstrániť odtlačky z jedného panelu",
      "Očistiť vonkajšok panelu zo zeme",
    ],
  ],
  [
    "chair",
    ["dining", "kitchen"],
    "Utierka",
    [
      "Utrieť sedadlo jednej stoličky",
      "Očistiť operadlo jednej stoličky",
      "Utrieť nohy jednej stoličky",
      "Oprášiť jednu čalúnenú stoličku",
      "Očistiť plochu pod jednou stoličkou",
      "Utrieť jednu priečku stoličky",
    ],
  ],
  [
    "carpet",
    [],
    "Vysávač",
    [
      "Povysávať jednu časť koberca",
      "Povysávať jeden okraj koberca",
      "Vybrať viditeľné drobnosti z koberca",
      "Skontrolovať jednu škvrnu podľa materiálu",
      "Povysávať malú plochu pod stolom",
      "Povysávať jeden roh koberca",
    ],
  ],
  [
    "bed",
    ["bedroom", "child"],
    "Čistá bielizeň",
    [
      "Vymeniť jednu obliečku vankúša",
      "Ustlať jednu posteľ",
      "Zložiť jednu prikrývku",
      "Vytriediť veci z jednej strany postele",
      "Pripraviť čistú posteľnú bielizeň",
      "Vymeniť jednu plachtu",
    ],
  ],
  [
    "wardrobe",
    ["bedroom", "child", "hallway"],
    "Úložný box",
    [
      "Upratať jednu policu v skrini",
      "Zavesiť päť kusov oblečenia",
      "Zložiť päť tričiek",
      "Vybrať tri kusy na darovanie",
      "Utrieť jednu prázdnu policu",
      "Odložiť jednu dávku čistej bielizne",
    ],
  ],
  [
    "toy",
    ["child", "playroom"],
    "Malý box",
    [
      "Vytriediť jeden box hračiek",
      "Odložiť päť hračiek",
      "Utrieť tri umývateľné hračky",
      "Zoradiť jednu sadu hier",
      "Vybrať poškodené veci z jedného boxu",
      "Usporiadať jednu policu s hračkami",
    ],
  ],
  [
    "washer",
    ["laundry", "bathroom", "kitchen"],
    "Návod výrobcu; utierka",
    [
      "Roztriediť jeden kôš bielizne",
      "Pripraviť jednu dávku prania",
      "Spustiť jednu dávku prania",
      "Vyvesiť jednu malú dávku",
      "Očistiť zásuvku na prací prostriedok",
      "Skontrolovať dostupné tesnenie práčky",
    ],
  ],
  [
    "dryer",
    ["laundry", "bathroom"],
    "Návod výrobcu",
    [
      "Presunúť jednu dávku do sušičky",
      "Spustiť jednu dávku sušenia",
      "Vyčistiť filter sušičky podľa návodu",
      "Poskladať jednu malú dávku bielizne",
      "Utrieť rukoväť sušičky",
      "Skontrolovať údržbu podľa výrobcu",
    ],
  ],
  [
    "rail",
    ["stairs"],
    "Utierka",
    [
      "Utrieť jeden úsek zábradlia",
      "Oprášiť tri schody",
      "Očistiť jednu dostupnú tyčku zábradlia",
      "Utrieť jednu podestu",
      "Odložiť tri veci zo schodov",
      "Utrieť jeden koniec madla",
    ],
  ],
  [
    "floor",
    [],
    "Vysávač; mop vhodný na povrch",
    [
      "Povysávať jeden malý úsek podlahy",
      "Utrieť malú plochu pri dverách",
      "Očistiť jeden úsek sokla",
      "Pozametať jeden roh miestnosti",
      "Utrieť jednu bezpečne dostupnú škvrnu",
      "Povysávať plochu okolo jedného predmetu",
    ],
  ],
  [
    "switch",
    [],
    "Suchá utierka",
    [
      "Utrieť kryt jedného vypínača",
      "Oprášiť jeden dostupný kryt",
      "Odstrániť odtlačky z jedného krytu",
      "Utrieť rám jedného vypínača",
      "Oprášiť jednu prístupnú hranu",
      "Skontrolovať čistotu jedného krytu",
    ],
  ],
];
export const templates: TaskTemplate[] = groups.flatMap(
  ([object, rooms, supplies, titles]) =>
    titles.map((title, i) => ({
      id: `${object}-${i + 1}`,
      title,
      instructions: `${title}. Pracuj iba na tomto jednom malom úseku. Použi prípravok vhodný na daný materiál a riaď sa návodom výrobcu. Po dokončení pomôcky odlož.${["hob", "oven", "microwave", "washer", "dryer", "tv"].includes(object) ? " Spotrebič musí byť v bezpečnom stave; nezasahuj do elektrických častí." : ""}${object === "glass" ? " Pracuj iba zo zeme na bezpečne dostupnom paneli. Pri veľkej ploche zvoľ jednu časť." : ""}${object === "switch" ? " Kryt nerozoberaj a nepoužívaj tekutinu." : ""}`,
      roomTypes: rooms,
      objectTypes: [object],
      duration: i === 0 ? 3 : i === 3 ? 2 : 5,
      recurrence: {
        unit:
          ["washer", "dryer"].includes(object) && i < 4
            ? "day"
            : i < 2
              ? "week"
              : "month",
        interval: ["washer", "dryer"].includes(object) && i < 4 ? 3 : 1,
        strategy: "completion",
      },
      priority: ["toilet", "sink", "tap", "bin", "hob"].includes(object)
        ? 3
        : 2,
      energy: i === 2 ? 2 : 1,
      xp: i === 0 ? 10 : i === 3 ? 10 : 20,
      supplies: supplies.split("; "),
      ...(object === "washer" && i === 2 ? { workflow: "wash" as const } : {}),
    })),
);
templates.push(
  ...[
    [
      "season-wardrobe",
      "Vytriediť päť sezónnych kusov oblečenia",
      "wardrobe",
      ["bedroom", "child", "hallway"],
    ],
    [
      "season-glass",
      "Skontrolovať tesnenie jedného dostupného panelu",
      "glass",
      ["living", "terrace", "bedroom", "kitchen", "child"],
    ],
    ["season-terrace", "Utrieť jeden malý úsek terasy", "floor", ["terrace"]],
    ["laundry-towels", "Vymeniť dva kúpeľňové uteráky", "shelf", ["bathroom"]],
    [
      "laundry-bedding",
      "Pripraviť jednu malú dávku posteľnej bielizne",
      "washer",
      ["laundry", "bathroom"],
    ],
    [
      "washer-maintenance",
      "Zapísať ďalšiu údržbu práčky podľa návodu",
      "washer",
      ["laundry", "bathroom", "kitchen"],
    ],
  ].map(([id, title, object, rooms]) => ({
    id: id as string,
    title: title as string,
    instructions:
      "Venuj sa iba tejto malej časti. Pri údržbe postupuj podľa návodu výrobcu; potrebný dlhý cyklus nie je aktívny čas práce.",
    roomTypes: rooms as RoomCategory[],
    objectTypes: [object as ObjectCategory],
    duration: 3,
    recurrence: {
      unit: "month" as const,
      interval: (id as string).startsWith("season") ? 6 : 1,
      strategy: "completion" as const,
    },
    priority: 1,
    energy: 1,
    xp: 10,
    supplies: ["Utierka", "Návod výrobcu"],
  })),
);
templates.push(
  ...(
    [
      [
        "curtain-dust",
        "Oprášiť spodný okraj jedného závesu",
        "curtain",
        "Použi jemnú kefu alebo nízky výkon vhodný podľa štítku. Venuj sa len spodnému okraju jedného závesu, dostupnému zo zeme.",
        3,
        1,
      ],
      [
        "curtain-label",
        "Skontrolovať štítok jedného závesu",
        "curtain",
        "Prečítaj pokyny na čistenie jedného závesu a zapíš si vhodnú teplotu alebo potrebu profesionálneho čistenia.",
        2,
        6,
      ],
      [
        "curtain-spot",
        "Ošetriť jednu malú škvrnu na závese",
        "curtain",
        "Podľa štítku otestuj vhodný prípravok na skrytom mieste. Ošetri len jednu škvrnu dostupnú zo zeme. Citlivý materiál zver odborníkovi.",
        5,
        3,
      ],
      [
        "curtain-edge",
        "Utrieť dostupný okraj za závesom",
        "curtain",
        "Odsuň jeden záves a jemne utri dostupnú časť parapetu alebo podlahy za ním. Nevystupuj na nábytok.",
        3,
        1,
      ],
      [
        "blind-slats",
        "Oprášiť päť lamiel žalúzie",
        "blind",
        "Nasucho opráš päť dostupných lamiel mäkkou utierkou. Lamely nepritisni a používaj iba postup vhodný pre ich materiál.",
        3,
        1,
      ],
      [
        "blind-reverse",
        "Oprášiť druhú stranu piatich lamiel",
        "blind",
        "Otoč lamely a jemne opráš opačnú stranu piatich dostupných lamiel. Pracuj zo zeme.",
        3,
        1,
      ],
      [
        "blind-control",
        "Utrieť ovládanie jednej žalúzie",
        "blind",
        "Očisti dostupné ovládanie mäkkou utierkou podľa návodu. Nerozoberaj mechanizmus a nemeň polohu bezpečnostných prvkov.",
        2,
        1,
      ],
      [
        "blind-check",
        "Skontrolovať jednu žalúziu zo zeme",
        "blind",
        "Pozri, či dostupné lamely a ovládanie nie sú poškodené. Potrebu opravy si zapíš medzi nápady; mechanizmus nerozoberaj.",
        3,
        3,
      ],
    ] as const
  ).map(([id, title, object, instructions, duration, interval]) => ({
    id,
    title,
    instructions,
    duration,
    roomTypes: [],
    objectTypes: [object],
    recurrence: {
      unit: "month" as const,
      interval,
      strategy: "completion" as const,
    },
    priority: 1,
    energy: 1,
    xp: duration <= 3 ? 10 : 20,
    supplies: ["Mäkká utierka", "Pokyny výrobcu"],
  })),
);
export function generateTasks(s: State, objectId?: string): Task[] {
  const day = s.households[0].createdAt.slice(0, 10);
  const h = s.households[0];
  const generated: Task[] = [];
  for (const object of s.objects.filter(
    (o) => (!objectId || o.id === objectId) && o.accessibility === "safe",
  )) {
    const room = s.rooms.find((r) => r.id === object.roomId);
    if (!room?.enabled || !featurePresent(room, object.category)) continue;
    const relevant = templates.filter(
      (t) =>
        t.objectTypes.includes(object.category) &&
        (!t.roomTypes.length || t.roomTypes.includes(room.category)),
    );
    for (const template of relevant) {
      if (
        template.id === "carpet-5" &&
        !s.objects.some(
          (o) =>
            o.roomId === room.id && ["table", "island"].includes(o.category),
        )
      )
        continue;
      if (
        s.tasks.some(
          (t) => t.objectId === object.id && t.templateId === template.id,
        )
      )
        continue;
      generated.push({
        id: uid(),
        householdId: h.id,
        roomId: room.id,
        objectId: object.id,
        templateId: template.id,
        title: template.title,
        instructions:
          object.category === "floor"
            ? `${template.instructions} Podlaha: ${flooringLabels[room.flooring]}. Použi iba postup vhodný pre tento materiál podľa výrobcu.${room.flooring === "carpet" ? " Koberec nenamáčaj mopom." : ""}`
            : template.instructions,
        duration: template.duration,
        recurrence: { ...template.recurrence, anchor: day },
        priority: template.priority,
        energy: template.energy,
        supplies:
          object.category === "floor" && room.flooring === "carpet"
            ? ["Vysávač", "Pokyny výrobcu"]
            : template.supplies,
        enabled: true,
        nextDue: day,
        acceptedLong: false,
        ...(template.workflow ? { workflow: template.workflow } : {}),
      });
    }
  }
  return generated;
}
