import {
  type Room,
  type State,
  type Inventory,
  uid,
  objectLabels,
  flooringLabels,
} from "./model";

/** Save room details without changing locked cleaning obligations. */
export function saveRoom(s: State, room: Room) {
  if (
    !s.floors.some(
      (f) => f.id === room.floorId && f.householdId === room.householdId,
    )
  )
    throw new Error("Vyber podlažie tejto domácnosti.");
  const materials = room.floorSurfaces?.map((f) => f.material) || [];
  if (new Set(materials).size !== materials.length)
    throw new Error("Každý materiál podlahy zadaj iba raz.");
  const i = s.rooms.findIndex((r) => r.id === room.id);
  if (i < 0) s.rooms.push(room);
  else s.rooms[i] = room;
  for (const [category, present] of [
    ["floor", true],
    [
      "carpet",
      room.flooring === "carpet" || materials.includes("carpet")
        ? true
        : undefined,
    ],
    ["curtain", room.curtains],
    ["blind", room.blinds],
  ] as const) {
    if (
      present === true &&
      !s.objects.some((o) => o.roomId === room.id && o.category === category)
    )
      s.objects.push({
        id: uid(),
        householdId: room.householdId,
        roomId: room.id,
        name: objectLabels[category],
        category,
        quantity: 1,
        dimensions: "",
        surface: category === "floor" ? flooringLabels[room.flooring] : "",
        area:
          category === "carpet"
            ? room.floorSurfaces?.find((f) => f.material === "carpet")?.area
            : undefined,
        accessibility: "safe",
        notes: "",
      });
    if (present === false) {
      const ids = new Set(
        s.objects
          .filter((o) => o.roomId === room.id && o.category === category)
          .map((o) => o.id),
      );
      for (const task of s.tasks)
        if (task.objectId && ids.has(task.objectId)) task.enabled = false;
    }
  }
}

export function featurePresent(room: Room, category: string): boolean {
  return (
    !(category === "curtain" && room.curtains === false) &&
    !(category === "blind" && room.blinds === false)
  );
}

/** Move related live records together; keep occurrence identities and rewards intact. */
export function moveObject(s: State, objectId: string, roomId: string) {
  const object = s.objects.find((o) => o.id === objectId),
    room = s.rooms.find((r) => r.id === roomId);
  if (!object || !room || object.householdId !== room.householdId)
    throw new Error("Vyber miestnosť tejto domácnosti.");
  if (object.roomId === roomId) return;
  object.roomId = roomId;
  delete object.position;
  for (const task of s.tasks)
    if (task.objectId === objectId) task.roomId = roomId;
  for (const problem of s.problems)
    if (problem.objectId === objectId) problem.roomId = roomId;
  syncObjectPlanLocation(s, objectId);
}

/** Location is editable metadata; completed snapshots retain their historical room. */
export function syncObjectPlanLocation(s: State, objectId: string) {
  const object = s.objects.find((o) => o.id === objectId),
    room = s.rooms.find((r) => r.id === object?.roomId);
  if (!room) return;
  const completed = new Set(
    s.completions.filter((c) => !c.undone).map((c) => c.occurrenceId),
  );
  for (const occurrence of [
    ...s.dailyPlans.flatMap((p) => p.occurrences),
    ...s.weeks.flatMap((w) => w.required),
  ])
    if (occurrence.objectId === objectId && !completed.has(occurrence.id)) {
      occurrence.roomId = room.id;
      occurrence.roomName = room.name;
    }
}

export function saveObject(s: State, value: Inventory) {
  const room = s.rooms.find((r) => r.id === value.roomId),
    existing = s.objects.find((o) => o.id === value.id);
  if (
    !room ||
    room.householdId !== value.householdId ||
    (existing && existing.householdId !== value.householdId)
  )
    throw new Error("Vyber miestnosť tejto domácnosti.");
  if (existing) {
    moveObject(s, value.id, value.roomId);
    Object.assign(existing, value);
  } else s.objects.push(value);
}

/** Apply a draft atomically after confirming every object belongs to this room. */
export function saveRoomLayout(
  s: State,
  roomId: string,
  positions: Record<string, Inventory["position"]>,
) {
  const room = s.rooms.find((r) => r.id === roomId);
  if (!room) throw new Error("Miestnosť už nie je dostupná.");
  const entries = Object.entries(positions).map(([id, position]) => {
    const object = s.objects.find((o) => o.id === id);
    if (
      !object ||
      object.roomId !== roomId ||
      object.householdId !== room.householdId
    )
      throw new Error("Predmet sa medzičasom presunul. Otvor náhľad znova.");
    if (
      position &&
      (![position.x, position.y].every(Number.isFinite) ||
        position.x < 0 ||
        position.x > 100 ||
        position.y < 0 ||
        position.y > 100)
    )
      throw new Error("Poloha musí byť vnútri miestnosti.");
    return { object, position };
  });
  for (const { object, position } of entries) {
    if (position) object.position = { ...position };
    else delete object.position;
  }
}
