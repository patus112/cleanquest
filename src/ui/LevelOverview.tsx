import { useEffect, useRef, useState } from "react";
import type { Day, State } from "../domain/model";
import { toggleBasicToday } from "../domain/commands";
import { levelOverview, tierLabels } from "../domain/tiers";
import type { ScreenProps } from "./components";

const statusLabel = {
  done: "hotové",
  waiting: "dnes čaká",
  later: "dnes netreba",
} as const;

/** What counts as Základ, and whether today is already covered. */
export function LevelOverview({
  s,
  day,
  run,
}: {
  s: State;
  day: Day;
  run: ScreenProps["run"];
}) {
  const groups = levelOverview(s, day);
  const [reason, setReason] = useState<{ id: string; text: string } | null>(
    null,
  );
  const reasonRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    reasonRef.current?.scrollIntoView({ block: "nearest" });
  }, [reason]);
  if (!groups.length) return null;
  return (
    <section className="level-overview" aria-label="Prehľad úrovní">
      <h2>Prehľad úrovní</h2>
      <p className="level-overview-lead">
        Tu vidíš, čo je základ a ako sa ti darí.
      </p>
      {groups.map((group) => (
        <article className="card level-group" key={group.id}>
          <h3>{group.name}</h3>
          <p className="level-overview-status">
            <span className="level-name">
              Úroveň: {tierLabels[group.level]}
            </span>
            <span>Základ {group.tier1Days}/7 dní</span>
          </p>
          <p className="level-note">{group.note}</p>
          {group.rooms.map((room) => (
            <div className="level-room" key={room.roomId}>
              {group.kind === "zone" && <h4>{room.name}</h4>}
              {group.kind === "zone" && (
                <p className="level-room-days">
                  Základ {room.tier1Days}/7 dní
                </p>
              )}
              {room.basics.length ? (
                <ul aria-label={`Základ v ${room.name}`}>
                  {room.basics.map((item) => (
                    <li key={item.id} className={`level-row is-${item.status}`}>
                      <button
                        type="button"
                        className={`level-toggle${item.status === "done" ? " is-done" : ""}`}
                        aria-pressed={item.status === "done"}
                        aria-label={
                          item.status === "done"
                            ? `Vrátiť: ${item.title}`
                            : `Označiť ako hotové: ${item.title}`
                        }
                        onClick={() => {
                          setReason(null);
                          void run(
                            (state) => toggleBasicToday(state, item.id),
                            item.status === "done"
                              ? "Vrátené. Tento základ znova čaká."
                              : "Hotovo. Tento základ sa počíta.",
                            (text) => setReason({ id: item.id, text }),
                          );
                        }}
                      >
                        <span className="level-mark" aria-hidden="true">
                          {item.status === "done" ? "✓" : ""}
                        </span>
                      </button>
                      <span className="level-task-title">{item.title}</span>
                      <span className="level-task-status">
                        {statusLabel[item.status]}
                      </span>
                      {reason?.id === item.id && (
                        <p className="level-reason" role="alert" ref={reasonRef}>
                          {reason.text}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="level-note">Základné úlohy tu zatiaľ nie sú.</p>
              )}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
