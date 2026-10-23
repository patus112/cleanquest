import type { Day, State } from "../domain/model";
import { levelOverview, tierLabels } from "../domain/tiers";

const statusLabel = {
  done: "hotové",
  waiting: "dnes čaká",
  later: "dnes netreba",
} as const;

/** What counts as Základ, and whether today is already covered. */
export function LevelOverview({ s, day }: { s: State; day: Day }) {
  const groups = levelOverview(s, day);
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
                    <li key={item.id}>
                      <span aria-hidden="true">
                        {item.status === "done" ? "✓" : "○"}
                      </span>
                      <span className="level-task-title">{item.title}</span>
                      <span className="level-task-status">
                        {statusLabel[item.status]}
                      </span>
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
