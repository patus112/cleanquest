import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  RotateCcw,
} from "lucide-react";
import type { Inventory } from "../domain/model";
import { featurePresent, saveRoomLayout } from "../domain/rooms";
import { Button, Dialog, Field, type ScreenProps } from "./components";
import {
  RoomScene,
  sceneHeight,
  scenePosition,
  constrainPosition,
} from "./RoomVisual";

export default function RoomLayoutEditor({
  s,
  run,
  open,
  roomId,
}: ScreenProps & { roomId: string }) {
  const room = s.rooms.find((r) => r.id === roomId),
    [draft, setDraft] = useState<Record<string, Inventory["position"]>>({}),
    [selectedId, setSelectedId] = useState(
      s.objects.find(
        (o) => o.roomId === roomId && room && featurePresent(room, o.category),
      )?.id,
    ),
    [saving, setSaving] = useState(false);
  const close = () => open(null);
  if (!room)
    return (
      <Dialog title="Rozloženie miestnosti" onClose={close}>
        <p>Miestnosť už nie je dostupná.</p>
      </Dialog>
    );
  const objects = s.objects.map((o) =>
      Object.hasOwn(draft, o.id) ? { ...o, position: draft[o.id] } : o,
    ),
    visible = objects
      .filter((o) => o.roomId === roomId && featurePresent(room, o.category))
      .sort((a, b) => a.id.localeCompare(b.id)),
    selected = visible.find((o) => o.id === selectedId),
    move = (id: string, position: Inventory["position"]) =>
      setDraft((d) => ({ ...d, [id]: position }));
  const nudge = (x: number, y: number) => {
    if (!selected) return;
    const position = scenePosition(
      selected,
      visible.indexOf(selected),
      visible.length,
      sceneHeight(room, visible.length),
    );
    move(
      selected.id,
      constrainPosition({ x: position.x + x, y: position.y + y }),
    );
  };
  return (
    <Dialog
      title="Rozloženie miestnosti"
      onClose={close}
      footer={
        <div className="layout-save actions">
          <Button
            disabled={saving || !Object.keys(draft).length}
            onClick={() => {
              setSaving(true);
              void run(
                (state) => saveRoomLayout(state, roomId, draft),
                "Rozloženie miestnosti je uložené.",
              )
                .then((ok) => {
                  if (ok) close();
                })
                .finally(() => setSaving(false));
            }}
          >
            <Check size={18} /> {saving ? "Ukladám…" : "Uložiť rozloženie"}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={close}>
            Zrušiť
          </Button>
        </div>
      }
    >
      <div className="layout-editor">
        <h3>{room.name}</h3>
        <p>
          Chyť predmet a potiahni ho prstom alebo myšou. Môžeš ho tiež vybrať a
          posúvať šípkami.
        </p>
        <RoomScene
          room={room}
          objects={objects}
          editor={
            saving
              ? undefined
              : { selectedId, onSelect: setSelectedId, onMove: move }
          }
        />
        {visible.length ? (
          <>
            <Field label="Predmet na presunutie">
              <select
                value={selectedId || ""}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={saving}
              >
                {visible.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="layout-nudge" disabled={saving || !selected}>
              <legend>Posunúť vybraný predmet</legend>
              <Button
                variant="secondary"
                onClick={() => nudge(-5, 0)}
                aria-label="Posunúť doľava"
              >
                <ArrowLeft size={20} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => nudge(0, -5)}
                aria-label="Posunúť hore"
              >
                <ArrowUp size={20} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => nudge(0, 5)}
                aria-label="Posunúť dole"
              >
                <ArrowDown size={20} />
              </Button>
              <Button
                variant="secondary"
                onClick={() => nudge(5, 0)}
                aria-label="Posunúť doprava"
              >
                <ArrowRight size={20} />
              </Button>
            </fieldset>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() =>
                setDraft(
                  Object.fromEntries(visible.map((o) => [o.id, undefined])),
                )
              }
            >
              <RotateCcw size={16} /> Automaticky rozložiť všetko
            </Button>
          </>
        ) : (
          <p>Najprv pridaj predmety do tejto miestnosti.</p>
        )}
        <small>
          Zmeny sa uložia až po potvrdení. Náhľad je schematický, predmety nie
          sú v mierke.
        </small>
      </div>
    </Dialog>
  );
}
