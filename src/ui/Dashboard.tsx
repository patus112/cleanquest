import { useId, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  Clock,
  Coffee,
  Gift,
  Home,
  Leaf,
  Plus,
  Trophy,
  RefreshCw,
  Sparkles,
  Zap,
  ArrowRight,
  MapPin,
} from "lucide-react";
import {
  Button,
  Progress,
  PageHead,
  LinkAction,
  SectionLabel,
  type ScreenProps,
} from "./components";
import {
  dayOf,
  complete,
  extraOptions,
  postpone,
  setRescue,
  markBasicsOk,
  applyDailyBudget,
} from "../domain/commands";
import {
  dailySession,
  completedIds,
  openTasks,
  taskIsHeld,
} from "../domain/scheduler";
import {
  buildTierContext,
  cleaningProgress,
  rescueHint,
  taskTier,
  tierHint,
} from "../domain/tiers";
import { totalXp, levelFor, streak } from "../domain/rewards";
import { money } from "../domain/model";
import { shiftDay, weekStart, weekday } from "../domain/calendar";
import {
  rhythmLabel,
  rhythmPreviewLimit,
  weekRhythm,
  type RhythmTask,
} from "../domain/weekRhythm";
import { ObjectIcon, RoomIcon, TaskLocation } from "./RoomVisual";
import { HomeGlow, PlantSprig, SunnyWindow, TidyKit } from "./art";
function RhythmGlyph({ task }: { task: RhythmTask }) {
  return task.icon.kind === "object" ? (
    <ObjectIcon category={task.icon.category} size={12} />
  ) : (
    <RoomIcon category={task.icon.category} size={12} />
  );
}
export default function Dashboard({
  s,
  run,
  open,
  navigate,
  reminder = null,
}: ScreenProps & {
  navigate: (page: string) => void;
  reminder?: ReactNode;
}) {
  const hardDayNote = useId();
  const day = dayOf(s),
    plan = s.dailyPlans.find((p) => p.date === day) || {
      occurrences: [],
      timeBudget: s.settings[0].dailyBudget,
    },
    doneIds = completedIds(s),
    rescue = !!s.settings[0].rescue,
    counted = plan.occurrences.filter(
      (occurrence) =>
        doneIds.has(occurrence.id) ||
        occurrence.lead ||
        !taskIsHeld(s, day, occurrence.taskId),
    ),
    done = counted.filter((o) => doneIds.has(o.id)).length,
    total = counted.length,
    progress = total ? done / total : 1,
    task = dailySession(s, day)[0];
  const xp = totalXp(s),
    level = levelFor(xp),
    week = s.weeks.find((w) => w.start === weekStart(day)) || {
      required: [],
      start: weekStart(day),
      rewardCents: s.settings[0].weeklyCents,
      rewardEnabled: s.settings[0].monetary,
      restDays: s.settings[0].restDays,
    },
    weekDone = week.required.filter((o) => doneIds.has(o.id)).length;
  const rest = week.restDays.includes(weekday(day)),
    extras = s.completions.filter(
      (c) => !c.undone && c.day === day && c.type === "extra",
    ),
    // The extra card is hidden while today's plan still has a task. Scoring the
    // whole library here used to block the done dialog for seconds.
    options =
      openTasks(s, day).length || rest ? [] : extraOptions(s, day),
    [extraIndex, setExtraIndex] = useState(0),
    extra = options[extraIndex % Math.max(1, options.length)];
  const rhythm = useMemo(() => weekRhythm(s, day), [s, day]);
  const roomDays = task
    ? (buildTierContext(s, day).rooms.get(task.roomId)?.tier1Days ?? 0)
    : 0;
  const roomHasBasics = task
    ? !!buildTierContext(s, day).rooms.get(task.roomId)?.hasTier1
    : false;
  const hint = rescue ? rescueHint : tierHint(roomDays, roomHasBasics);
  const suggestedTier = task
    ? taskTier(
        s.tasks.find((item) => item.id === task.taskId) || { title: task.title },
      )
    : null;
  const levels = cleaningProgress(rescue, suggestedTier);
  const minutes = s.settings[0].dailyBudget;
  const finish = () => {
    if (!task) return;
    void run(
      (state) =>
        complete(state, task.taskId, "required", task.id, new Date(), 60),
      `Hotovo. +${task.xp} DA ⚡ · dnes ${done + 1} z ${total}.`,
    );
  };
  return (
    <div className="home-screen">
      <div className="session-selector">
        <span>Dnešný krátky blok</span>
        <select
          aria-label="Dnešný časový blok"
          value={minutes}
          onChange={(e) => {
            const next = Number(e.target.value);
            void run((state) => applyDailyBudget(state, next));
          }}
        >
          {[5, 10, 15, 20, 30].map((n) => (
            <option value={n} key={n}>
              {n} min
            </option>
          ))}
        </select>
      </div>
      <PageHead
        eyebrow={new Intl.DateTimeFormat("sk-SK", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date(day + "T12:00:00"))}
        title={
          s.profiles[0].displayName === "Ty"
            ? "Vitaj doma."
            : `Ahoj, ${s.profiles[0].displayName}.`
        }
        text="Malé kroky k pokojnejšiemu domovu."
        icon={Home}
        art={<SunnyWindow />}
        action={
          <div className="page-actions">
            <Button
              variant="secondary compact"
              onClick={() => open({ kind: "task" })}
            >
              <Plus size={18} />
              Pridať úlohu
            </Button>
            <Button
              variant="secondary compact"
              onClick={() => open({ kind: "quick" })}
            >
              <Zap size={18} />
              Rýchla úloha
            </Button>
          </div>
        }
      />
      <section className="daily-card">
        <div className="section-heading">
          <SectionLabel icon={Clock}>Tvoj dnešný rytmus</SectionLabel>
          <span className="tag">
            <Clock size={13} strokeWidth={1.75} />
            {minutes} min denne
          </span>
        </div>
        <div className="daily-body">
        <div className="daily-content">
          <div className="ring">
            <svg viewBox="0 0 150 150" aria-hidden="true">
              <circle cx="75" cy="75" r="65" />
              <circle
                className="ring-value"
                cx="75"
                cy="75"
                r="65"
                strokeDasharray={`${progress * 408} 408`}
              />
            </svg>
            <div>
              <strong>
                {done}
                <small>/{total}</small>
              </strong>
              <span>malých krokov</span>
            </div>
          </div>
          <div>
            <h2>
              {rest
                ? "Dnes máš voľno."
                : done === total
                  ? "Na dnes dobrý pocit."
                  : "Kúsok po kúsku."}
            </h2>
            <p>
              {rest
                ? "Oddych patrí do tvojho plánu."
                : done === total
                  ? "Aj malá pravidelnosť mení domov. Dopraj si pauzu."
                  : "Nemusíš zvládnuť všetko. Začni jednou malou vecou."}
            </p>
            <div className="daily-stats">
              <span>
                <Zap size={16} />
                {xp} DA ⚡
              </span>
              <span>
                <Leaf size={16} />
                Úroveň {level.level}
              </span>
              <span>{streak(s, day)} dní v rytme</span>
            </div>
          </div>
        </div>
          <div className="daily-scene" aria-hidden="true">
            <HomeGlow />
          </div>
        </div>
        <div className="week-strip">
          {rhythm.map((preview) => {
            const shown = preview.tasks.slice(0, rhythmPreviewLimit);
            const extra = preview.tasks.length - shown.length;
            const label = rhythmLabel(preview);
            return (
              <div
                key={preview.date}
                className={preview.isToday ? "today" : ""}
                role="group"
                aria-label={label}
                title={label}
              >
                <span aria-hidden="true">{preview.short}</span>
                <i
                  aria-hidden="true"
                  className={
                    preview.finished ? "finished" : preview.isRest ? "rest" : ""
                  }
                >
                  {preview.finished ? (
                    <Check size={16} />
                  ) : preview.isRest ? (
                    <Coffee size={15} />
                  ) : (
                    <span />
                  )}
                </i>
                {preview.tasks.length > 0 && (
                  <span className="day-tasks" aria-hidden="true">
                    {shown.map((task) => (
                      <span
                        key={task.id}
                        className={`day-task${task.done ? " done" : ""}`}
                        title={
                          task.done ? `${task.title} (hotové)` : task.title
                        }
                      >
                        <RhythmGlyph task={task} />
                      </span>
                    ))}
                    {extra > 0 && <span className="day-more">+{extra}</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <section className="next-card">
        <div className="section-heading">
          <SectionLabel icon={Sparkles}>LEN JEDNA VEC</SectionLabel>
        </div>
        <div className="day-mode">
          <button
            type="button"
            className="switch"
            role="switch"
            aria-checked={rescue}
            aria-describedby={hardDayNote}
            onClick={() =>
              void run(
                (state) => setRescue(state, !rescue),
                rescue
                  ? "Ťažký deň je vypnutý."
                  : "Ťažký deň je zapnutý. Dnes len základ.",
              )
            }
          >
            <span className="switch-label">Ťažký deň</span>
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
            <span className="switch-value">{rescue ? "áno" : "nie"}</span>
          </button>
          <p id={hardDayNote} className="switch-note">
            Záchranný režim
          </p>
          <ol className="level-steps" aria-label="Úrovne upratovania">
            {levels.map((level, index) => (
              <li key={level.name}>
                <span
                  className={`level-step ${level.state}`}
                  aria-current={level.state === "current" ? "step" : undefined}
                >
                  {level.state === "done" ? "✓ " : ""}
                  {level.name}
                  <span className="sr-only">
                    {level.state === "current"
                      ? ", teraz"
                      : level.state === "done"
                        ? ", hotové"
                        : ", neskôr"}
                  </span>
                </span>
                {index < levels.length - 1 && (
                  <span className="level-arrow" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          {task && suggestedTier === 1 && (
            <Button
              variant="secondary compact"
              onClick={() =>
                void run(
                  (state) => markBasicsOk(state, task.roomId),
                  "Základ máme. Ťažký deň sa nemení.",
                )
              }
            >
              Základ máme
            </Button>
          )}
          {suggestedTier === 1 && (
            <p className="basics-note">
              V tejto miestnosti základ vyzerá dobre, takže dnes sa môže ukázať
              ďalšia úroveň. Ťažký deň to nevypne.
            </p>
          )}
        </div>
        {hint && <p className="tier-hint">{hint}</p>}
        {task ? (
          <>
            <span className="room-chip">
              <RoomIcon
                category={
                  s.rooms.find((room) => room.id === task.roomId)?.category ||
                  "other"
                }
                size={15}
              />
              {task.roomName}
            </span>
            <h2>{task.title}</h2>
            <div className="task-meta">
              <span>
                <Clock size={15} />
                {task.duration} min
              </span>
              <span>
                <Zap size={15} />+{task.xp} DA ⚡
              </span>
            </div>
            <p className="today-progress">
              Dnes {done} z {total}. Jedna konkrétna vec.
            </p>
            <TaskLocation s={s} task={task} compact />
            <div className="next-actions">
              <Button onClick={finish}>
                <Check size={18} />
                Hotovo
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void run(
                    (state) => postpone(state, task.id, shiftDay(day, 1)),
                    "Úloha počká do zajtra.",
                  )
                }
              >
                Odložiť na zajtra
              </Button>
              <Button variant="ghost" onClick={() => open({ kind: "focus" })}>
                Začať malý krok
                <ArrowRight size={18} />
              </Button>
            </div>
            <button className="subtle-link" onClick={() => navigate("tasks")}>
              Pozrieť dnešný plán
            </button>
          </>
        ) : (
          <>
            <div className="calm-icon">
              <HomeGlow className="calm-art" />
            </div>
            <h2>Teraz je čas na pokoj.</h2>
            <p>
              {rest
                ? "Dnes nie je nič povinné."
                : "Tvoj krátky blok je hotový. Pokračovať môžeš neskôr."}
            </p>
            <Button variant="secondary" onClick={() => navigate("ideas")}>
              Priestor pre nápady
              <ArrowRight size={18} />
            </Button>
          </>
        )}
      </section>
      {reminder}
      <div className="lower-grid">
        <section className="card reward-preview">
          <PlantSprig className="card-mark" />
          <div className="card-kicker">
            <SectionLabel icon={Gift}>Týždenná odmena</SectionLabel>
          </div>
          <div className="card-title-row">
            <h2>{money(week.rewardCents)}</h2>
            <span className="tag">
              {weekDone} / {week.required.length} krokov
            </span>
          </div>
          <p>
            {week.rewardEnabled
              ? "Tvoja osobná odmena za dohodnutý plán."
              : "Peňažné odmeny máš vypnuté."}
          </p>
          <Progress
            value={week.required.length ? weekDone / week.required.length : 0}
          />
          <LinkAction onClick={() => navigate("rewards")}>
            Môj virtuálny rozpočet
          </LinkAction>
        </section>
        <section className="card quest-preview">
          <TidyKit className="card-mark" />
          <div className="card-kicker">
            <SectionLabel icon={Leaf}>Niečo navyše · dobrovoľné</SectionLabel>
          </div>
          <h3>{s.bonuses.find((b) => b.week === week.start)?.title}</h3>
          <p>Tri malé kroky, keď máš chuť.</p>
          <div className="task-meta">
            <span>+100 DA ⚡</span>
            {s.settings[0].monetary && (
              <span>
                +
                {money(
                  s.bonuses.find((b) => b.week === week.start)?.rewardCents ||
                    0,
                )}
              </span>
            )}
          </div>
          <LinkAction onClick={() => navigate("rewards")}>
            Týždenná výzva
          </LinkAction>
        </section>
        <section className="card mega-preview">
          <SunnyWindow className="card-mark" />
          <div className="card-kicker">
            <SectionLabel icon={Trophy}>Mega výzva · tento mesiac</SectionLabel>
          </div>
          <h3>
            {s.megas.find((m) => m.month === day.slice(0, 7))?.title ||
              "Jedno miesto, ktoré môže fungovať lepšie."}
          </h3>
          <p>Zlepšenie domova vlastným tempom.</p>
          <LinkAction onClick={() => navigate("ideas")}>
            Objaviť malý projekt
          </LinkAction>
        </section>
      </div>
      {!openTasks(s, day).length && !rest && (
        <section className="extra-card">
          <div>
            <SectionLabel icon={Zap}>Ešte mám energiu</SectionLabel>
            <h3>
              {extras.length >= 2
                ? "Na dnes stačí. Pokračujeme zajtra."
                : extra
                  ? extra.title
                  : "Dnes už máš všetko podstatné hotové."}
            </h3>
            <p>
              Najviac dve malé úlohy. Bez DA ⚡ a bez odmien. {extras.length} /
              2 hotové.
            </p>
          </div>
          {extras.length < 2 && extra && (
            <div className="actions">
              <Button
                variant="icon ghost"
                aria-label="Ukázať miesto extra úlohy"
                onClick={() => open({ kind: "location", taskId: extra.id })}
              >
                <MapPin size={18} />
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void run(
                    (state) => complete(state, extra.id, "extra"),
                    "Hotovo. Dopraj si aj oddych.",
                  )
                }
              >
                <Check size={18} />
                Hotovo · {extra.duration} min
              </Button>
              <Button
                variant="icon ghost"
                aria-label="Iná extra úloha"
                onClick={() => setExtraIndex(extraIndex + 1)}
              >
                <RefreshCw size={18} />
              </Button>
            </div>
          )}
        </section>
      )}
      <div className="closing-note">
        <Leaf size={16} />
        <span>Pravidelnosť, nie dokonalosť.</span>
        <ArrowUpRight size={16} />
      </div>
    </div>
  );
}
