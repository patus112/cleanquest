import type { State } from "../domain/model";
import { todayPace, weekPace } from "../domain/progress";

/** Compact points and today's block. The same card sits on Domov and Úlohy. */
export function ProgressHud({ s }: { s: State }) {
  const today = todayPace(s);
  const week = weekPace(s);
  const ratio = today.goalMet
    ? 1
    : today.goalMinutes > 0
      ? Math.min(1, today.usedMinutes / today.goalMinutes)
      : 0;
  const todayFigure = today.rescue
    ? today.goalMet
      ? "Základ máš"
      : "Základ stačí"
    : today.goalMet && !today.timeFull
      ? `${today.usedMinutes} min`
      : `${today.usedMinutes} / ${today.goalMinutes} min`;
  const todayLabel = today.goalMet
    ? "Dnešný cieľ splnený"
    : today.rescue
      ? "Ťažký deň"
      : "Dnešný blok";
  const barMax = today.rescue ? 1 : today.goalMinutes;
  const barNow = today.rescue
    ? today.goalMet
      ? 1
      : 0
    : today.goalMet
      ? today.goalMinutes
      : Math.min(today.goalMinutes, today.usedMinutes);
  return (
    <section className="progress-hud" aria-label="Tvoj pokrok">
      <div className="hud-total">
        <span className="hud-kicker">Spolu</span>
        <strong>{today.totalXp} DA</strong>
      </div>
      <div className="hud-today">
        <div className="progress-label">
          <span>{todayLabel}</span>
          <span>
            {todayFigure}
            <span className="hud-xp"> · DA dnes {today.todayXp}</span>
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={barMax}
          aria-valuenow={barNow}
          aria-label={
            today.rescue ? "Dnešný základ" : "Dnešné odmeňované minúty"
          }
        >
          <i style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        {today.rescue && (
          <p className="hud-soft">Ťažký deň. Stačí základ.</p>
        )}
      </div>
      <p className="hud-week">{week.line}</p>
    </section>
  );
}
