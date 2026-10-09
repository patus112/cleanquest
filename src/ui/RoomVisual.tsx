import { useId, useRef, useState, type PointerEvent } from "react";
import {
  Armchair,
  Bath,
  BedDouble,
  CookingPot,
  DoorOpen,
  Droplets,
  Gamepad2,
  Home,
  Layers,
  Package,
  Refrigerator,
  Shirt,
  Sofa,
  Speaker,
  Sprout,
  Utensils,
  WashingMachine,
  PanelTop,
  Lamp,
  type LucideIcon,
} from "lucide-react";
import {
  type Inventory,
  type Occurrence,
  type Room,
  type RoomCategory,
  type State,
  flooringLabels,
} from "../domain/model";
import { featurePresent } from "../domain/rooms";

const roomIcons: Record<RoomCategory, LucideIcon> = {
  kitchen: CookingPot,
  bathroom: Bath,
  toilet: Droplets,
  bedroom: BedDouble,
  child: BedDouble,
  playroom: Gamepad2,
  living: Sofa,
  dining: Utensils,
  hallway: DoorOpen,
  stairs: Layers,
  terrace: Sprout,
  storage: Package,
  laundry: WashingMachine,
  other: Home,
};
export function RoomIcon({
  category,
  size = 22,
}: {
  category: RoomCategory;
  size?: number;
}) {
  const Icon = roomIcons[category];
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}
export function ObjectIcon({
  category,
  size = 22,
}: {
  category: Inventory["category"];
  size?: number;
}) {
  const Icon =
    (
      {
        bed: BedDouble,
        sofa: Sofa,
        chair: Armchair,
        bathtub: Bath,
        sink: Droplets,
        tap: Droplets,
        shower: Droplets,
        washer: WashingMachine,
        dryer: WashingMachine,
        fridge: Refrigerator,
        speaker: Speaker,
        curtain: Shirt,
        blind: PanelTop,
        glass: PanelTop,
        door: DoorOpen,
        tv: PanelTop,
        hob: CookingPot,
        table: Utensils,
        toy: Gamepad2,
        switch: Lamp,
        floor: Layers,
        carpet: Layers,
      } as Partial<Record<Inventory["category"], LucideIcon>>
    )[category] || Package;
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

/** Top-down pictograms are code-native SVG assets and remain available offline. */
function Furniture({ category }: { category: Inventory["category"] }) {
  switch (category) {
    case "sink":
    case "tap":
      return (
        <>
          <rect x="-27" y="-17" width="54" height="34" rx="7" />
          <ellipse cx="0" cy="2" rx="17" ry="10" />
          <path d="M0 -7v-8h9v6M-10 -13h-6M10 -13h6" />
        </>
      );
    case "bathtub":
    case "shower":
      return (
        <>
          <rect x="-30" y="-19" width="60" height="38" rx="10" />
          <rect x="-24" y="-14" width="48" height="28" rx="11" />
          <circle cx="17" cy="0" r="2" />
          <path d="M28 -4h-6" />
        </>
      );
    case "bed":
      return (
        <>
          <rect x="-25" y="-22" width="50" height="44" rx="5" />
          <rect x="-21" y="-18" width="18" height="11" rx="3" />
          <rect x="3" y="-18" width="18" height="11" rx="3" />
          <path d="M-24 -3h48M-23 18h46" />
        </>
      );
    case "sofa":
    case "bench":
      return (
        <>
          <rect x="-30" y="-17" width="60" height="34" rx="8" />
          <path d="M-22 -8h44v21h-44zM0 -8v21" />
          <rect x="-32" y="-4" width="10" height="21" rx="3" />
          <rect x="22" y="-4" width="10" height="21" rx="3" />
        </>
      );
    case "table":
    case "island":
    case "worktop":
      return (
        <>
          <rect x="-28" y="-14" width="56" height="28" rx="5" />
          <path d="M-18 -14v28M18 -14v28M-15 -20h30M-15 20h30" />
        </>
      );
    case "glass":
    case "blind":
    case "curtain":
      return (
        <>
          <rect x="-30" y="-16" width="60" height="32" rx="3" />
          <path d="M0 -16v32M-26 -11h52M-26 11h52" />
          {category !== "glass" && <path d="M-24 -5h48M-24 2h48M-24 7h48" />}
        </>
      );
    case "wardrobe":
    case "cabinet":
    case "shelf":
    case "drawer":
      return (
        <>
          <rect x="-28" y="-17" width="56" height="34" rx="3" />
          <path d="M0 -17v34M-5 -3v6M5 -3v6" />
        </>
      );
    case "washer":
    case "dryer":
      return (
        <>
          <rect x="-22" y="-21" width="44" height="42" rx="5" />
          <circle r="12" cy="4" />
          <path d="M-22 -12h44M10 -17h5" />
        </>
      );
    case "toilet":
      return (
        <>
          <rect x="-17" y="-21" width="34" height="13" rx="3" />
          <ellipse rx="14" ry="17" cy="8" />
          <ellipse rx="8" ry="11" cy="7" />
        </>
      );
    case "carpet":
    case "floor":
      return (
        <>
          <rect x="-30" y="-18" width="60" height="36" rx="2" />
          <path d="M-24 -12h48v24h-48zM-34 -14h4M-34 -6h4M-34 6h4M-34 14h4M30 -14h4M30 -6h4M30 6h4M30 14h4" />
        </>
      );
    default:
      return (
        <svg x="-20" y="-20" width="40" height="40" viewBox="0 0 40 40">
          <g transform="translate(8 8)">
            <ObjectIcon category={category} size={24} />
          </g>
        </svg>
      );
  }
}

export const sceneHeight = (room: Room, count: number) =>
  Math.max(
    220,
    Math.ceil(count / 4) * 76 + 44,
    room.width && room.length
      ? Math.min(420, (320 * room.length) / room.width)
      : 0,
  );
export const scenePosition = (
  object: Inventory,
  index: number,
  count: number,
  height: number,
) =>
  object.position || {
    x: ((50 + (index % 4) * 80 - 24) / 292) * 100,
    y:
      ((49 +
        Math.floor(index / 4) *
          ((height - 62) / Math.max(3, Math.ceil(count / 4))) -
        30) /
        (height - 76)) *
      100,
  };
export const constrainPosition = (position: { x: number; y: number }) => ({
  x: Math.round(Math.max(8, Math.min(92, position.x)) * 10) / 10,
  y: Math.round(Math.max(5, Math.min(95, position.y)) * 10) / 10,
});

export function RoomScene({
  room,
  objects,
  targetId,
  thumbnail = false,
  editor,
}: {
  room: Room;
  objects: Inventory[];
  targetId?: string;
  thumbnail?: boolean;
  editor?: {
    selectedId?: string;
    onSelect: (id: string) => void;
    onMove: (id: string, position: Inventory["position"]) => void;
  };
}) {
  const drag = useRef<{
    id: string;
    pointerId: number;
    start: { x: number; y: number };
    position: { x: number; y: number };
    original: Inventory["position"];
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string>();
  const pattern = useId().replace(/:/g, ""),
    visible = objects
      .filter((o) => o.roomId === room.id && featurePresent(room, o.category))
      .sort((a, b) => a.id.localeCompare(b.id)),
    // A grid is an honest default; only explicit positions change the arrangement.
    height = sceneHeight(room, visible.length),
    titleId = `${pattern}-title`,
    descId = `${pattern}-desc`;
  const point = (e: PointerEvent<SVGGElement>) => {
    const svg = e.currentTarget.ownerSVGElement,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(matrix.inverse());
  };
  return (
    <svg
      className={`room-scene ${thumbnail ? "thumbnail" : ""} ${editor ? "editable" : ""}`}
      viewBox={`0 0 340 ${height}`}
      role={editor ? "group" : "img"}
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>{room.name} — schematický náhľad</title>
      <desc id={descId}>
        {visible.length
          ? `Nastavené predmety: ${visible.map((o) => o.name).join(", ")}.`
          : "Miestnosť zatiaľ nemá nastavené predmety."}
        {targetId && visible.some((o) => o.id === targetId)
          ? ` Červeným rámom je označený predmet: ${visible.find((o) => o.id === targetId)?.name}.`
          : ""}{" "}
        Rozloženie je približné, nejde o zameraný pôdorys.
      </desc>
      <defs>
        <pattern
          id={pattern}
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          {room.flooring === "tile" ? (
            <path d="M28 0H0v28" />
          ) : room.flooring === "carpet" ? (
            <>
              <circle cx="5" cy="7" r="1" />
              <circle cx="19" cy="21" r="1" />
            </>
          ) : (
            <path d="M0 14h28M14 0v14" />
          )}
        </pattern>
      </defs>
      <rect
        className="scene-floor"
        x="7"
        y="7"
        width="326"
        height={height - 14}
        rx="15"
      />
      <rect
        className="scene-pattern"
        x="8"
        y="8"
        width="324"
        height={height - 16}
        rx="14"
        fill={`url(#${pattern})`}
      />
      <path
        className="scene-door"
        d={`M150 ${height - 7}h40m-40 0v-32a32 32 0 0 1 32 32`}
      />
      {!visible.length && (
        <g className="scene-empty">
          <text x="170" y={height / 2} textAnchor="middle">
            Tvoj priestor na pokoj
          </text>
          <text x="170" y={height / 2 + 22} textAnchor="middle">
            Pridaj vybavenie miestnosti
          </text>
        </g>
      )}
      {visible.map((o, index) => {
        const position = scenePosition(o, index, visible.length, height),
          x = 24 + (position.x / 100) * 292,
          y = 30 + (position.y / 100) * (height - 76),
          target = targetId === o.id;
        return (
          <g
            key={o.id}
            transform={`translate(${x} ${y})`}
            className={`scene-object ${target ? "is-target" : ""} ${editor?.selectedId === o.id ? "is-selected" : ""} ${draggingId === o.id ? "is-dragging" : ""}`}
            data-object-id={o.id}
            data-target={target ? "true" : undefined}
            role={editor ? "button" : undefined}
            tabIndex={editor ? 0 : undefined}
            aria-label={editor ? `Presunúť ${o.name}` : undefined}
            aria-pressed={editor ? editor.selectedId === o.id : undefined}
            onClick={editor ? () => editor.onSelect(o.id) : undefined}
            onPointerDown={
              editor
                ? (e) => {
                    if (e.button !== 0 || !e.isPrimary || drag.current) return;
                    const start = point(e);
                    if (!start) return;
                    e.preventDefault();
                    editor.onSelect(o.id);
                    e.currentTarget.focus();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    drag.current = {
                      id: o.id,
                      pointerId: e.pointerId,
                      start,
                      position,
                      original: o.position,
                    };
                    setDraggingId(o.id);
                  }
                : undefined
            }
            onPointerMove={
              editor
                ? (e) => {
                    const active = drag.current,
                      current = point(e);
                    if (!active || active.pointerId !== e.pointerId || !current)
                      return;
                    editor.onMove(
                      active.id,
                      constrainPosition({
                        x:
                          active.position.x +
                          ((current.x - active.start.x) / 292) * 100,
                        y:
                          active.position.y +
                          ((current.y - active.start.y) / (height - 76)) * 100,
                      }),
                    );
                  }
                : undefined
            }
            onPointerUp={
              editor
                ? (e) => {
                    if (drag.current?.pointerId !== e.pointerId) return;
                    drag.current = null;
                    setDraggingId(undefined);
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  }
                : undefined
            }
            onPointerCancel={
              editor
                ? (e) => {
                    if (drag.current?.pointerId !== e.pointerId) return;
                    editor.onMove(o.id, drag.current.original);
                    drag.current = null;
                    setDraggingId(undefined);
                  }
                : undefined
            }
            onLostPointerCapture={
              editor
                ? () => {
                    drag.current = null;
                    setDraggingId(undefined);
                  }
                : undefined
            }
            onKeyDown={
              editor
                ? (e) => {
                    const directions: Record<string, [number, number]> = {
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                        ArrowUp: [0, -1],
                        ArrowDown: [0, 1],
                      },
                      delta = directions[e.key];
                    if (delta) {
                      e.preventDefault();
                      editor.onSelect(o.id);
                      const step = e.shiftKey ? 1 : 5;
                      editor.onMove(
                        o.id,
                        constrainPosition({
                          x: position.x + delta[0] * step,
                          y: position.y + delta[1] * step,
                        }),
                      );
                    } else if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      editor.onSelect(o.id);
                    }
                  }
                : undefined
            }
          >
            <title>
              {o.name}
              {target ? " · Toto teraz čistíme" : ""}
            </title>
            {editor && (
              <rect
                className="scene-move-handle"
                x="-36"
                y="-27"
                width="72"
                height="66"
                rx="9"
              />
            )}
            {target && (
              <rect
                className="scene-target-ring"
                x="-37"
                y="-28"
                width="74"
                height="62"
                rx="10"
              />
            )}
            <g className="furniture">
              <Furniture category={o.category} />
            </g>
            {!thumbnail && (
              <text textAnchor="middle" y="32">
                {o.name.length > 13 ? o.name.slice(0, 12) + "…" : o.name}
              </text>
            )}
            {target && (
              <circle className="scene-target-dot" cx="30" cy="-22" r="4" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function RoomDetails({ room }: { room: Room }) {
  const materials = [
    ...new Set([
      room.flooring,
      ...(room.floorSurfaces || []).map((s) => s.material),
    ]),
  ];
  return (
    <div className="room-facts">
      {room.area && (
        <span>
          <Layers size={15} />
          {room.area} m²
        </span>
      )}
      {room.width && room.length && (
        <span>
          {room.width} × {room.length} m
        </span>
      )}
      <span>{materials.map((m) => flooringLabels[m]).join(" + ")}</span>
      {room.windowArea !== undefined && (
        <span>
          <PanelTop size={15} />
          Okná {room.windowArea} m²
        </span>
      )}
      {room.curtains !== undefined && (
        <span>Závesy: {room.curtains ? "áno" : "nie"}</span>
      )}
      {room.blinds !== undefined && (
        <span>Žalúzie: {room.blinds ? "áno" : "nie"}</span>
      )}
    </div>
  );
}

export function HouseholdMap({
  s,
  roomId,
  onSelect,
  compact = false,
}: {
  s: State;
  roomId?: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const [floorId, setFloorId] = useState(s.floors[0]?.id),
    selectedRoom = s.rooms.find((r) => r.id === roomId),
    activeFloor = compact && selectedRoom ? selectedRoom.floorId : floorId,
    floors = [...s.floors].sort((a, b) => a.order - b.order),
    rooms = s.rooms
      .filter((r) => r.floorId === activeFloor)
      .sort((a, b) => a.order - b.order);
  return (
    <section
      className={`house-map ${compact ? "compact" : ""}`}
      aria-label="Schematická mapa domácnosti"
    >
      <div className="section-heading">
        <h3>{compact ? "Kde práve čistíme" : "Mapa tvojho domova"}</h3>
        <span className="muted">
          {s.floors.find((f) => f.id === activeFloor)?.name}
        </span>
      </div>
      {!compact && floors.length > 1 && (
        <div className="floor-tabs" aria-label="Podlažia">
          {floors.map((f) => (
            <button
              key={f.id}
              className={activeFloor === f.id ? "active" : ""}
              aria-pressed={activeFloor === f.id}
              onClick={() => setFloorId(f.id)}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      <div className="floor-rooms">
        {rooms.map((room) => {
          const content = (
            <>
              <RoomIcon category={room.category} />
              <span>{room.name}</span>
              {!compact && (
                <small>
                  {room.area ? `${room.area} m²` : "Rozloha nezadaná"}
                </small>
              )}
            </>
          );
          return onSelect ? (
            <button
              key={room.id}
              className={`map-room ${room.id === roomId ? "is-active" : ""}`}
              onClick={() => onSelect(room.id)}
            >
              {content}
            </button>
          ) : (
            <div
              key={room.id}
              className={`map-room ${room.id === roomId ? "is-active" : ""}`}
              aria-current={room.id === roomId ? "location" : undefined}
            >
              {content}
            </div>
          );
        })}
      </div>
      {!rooms.length && <p>Na tomto podlaží zatiaľ nie sú miestnosti.</p>}
      {!compact && (
        <small className="map-caption">
          Schematické rozloženie podľa nastavených miestností. Polohu a rozmery
          predmetov si môžeš doplniť.
        </small>
      )}
    </section>
  );
}

export function TaskLocation({
  s,
  task,
  compact = false,
}: {
  s: State;
  task: Occurrence;
  compact?: boolean;
}) {
  const room = s.rooms.find((r) => r.id === task.roomId),
    objectId = task.objectId,
    object = s.objects.find(
      (o) => o.id === objectId && o.roomId === task.roomId,
    ),
    visibleObject =
      room && object && featurePresent(room, object.category)
        ? object
        : undefined;
  if (!room)
    return (
      <div className="quiet-note">
        {task.roomName} · Miestnosť už nie je v nastavení domácnosti.
      </div>
    );
  return (
    <div className={`task-visual ${compact ? "compact" : ""}`}>
      <RoomScene
        room={room}
        objects={s.objects}
        targetId={visibleObject?.id}
        thumbnail={compact}
      />
      <div className="visual-legend">
        <span>
          <i className="room-dot" />
          {room.name}
        </span>
        {visibleObject && (
          <span>
            <i className="target-dot" />
            {visibleObject.name}
          </span>
        )}
      </div>
      {!compact && <HouseholdMap s={s} roomId={room.id} compact />}
      {!compact && (
        <small>
          {visibleObject
            ? "Označený predmet je tvoj malý krok. "
            : objectId
              ? "Pôvodný predmet už nie je v náhľade. "
              : "Pri tejto úlohe nie je uložený konkrétny predmet. Novým úlohám ho môžeš priradiť v úprave. "}
          Schematický náhľad; rozloženie si nastavíš pri predmetoch.
        </small>
      )}
    </div>
  );
}
