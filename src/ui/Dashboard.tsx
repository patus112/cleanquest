import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock,
  Coffee,
  Leaf,
  Plus,
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
  type ScreenProps,
} from "./components";
import { dayOf, complete, extraOptions } from "../domain/commands";
import { dailySession, completedIds, currentTasks } from "../domain/scheduler";
import { totalXp, levelFor, streak } from "../domain/rewards";
import { money } from "../domain/model";
import { shiftDay, weekStart, weekday } from "../domain/calendar";
import { TaskLocation } from "./RoomVisual";
const shortDays = ["PO", "UT", "ST", "ŠT", "PI", "SO", "NE"];
export default function Dashboard({
  s,
  run,
  open,
  navigate,
  sessionBudget,
}: ScreenProps & { navigate: (page: string) => void }) {
  const day = dayOf(s),
    plan = s.dailyPlans.find((p) => p.date === day) || {
      occurrences: [],
      timeBudget: s.settings[0].dailyBudget,
    },
    doneIds = completedIds(s),
    done = plan.occurrences.filter((o) => doneIds.has(o.id)).length,
    total = plan.occurrences.length,
    progress = total ? done / total : 1,
    task = dailySession(s, day, sessionBudget)[0];
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
    options = extraOptions(s, day),
    [extraIndex, setExtraIndex] = useState(0),
    extra = options[extraIndex % Math.max(1, options.length)];
  return (
    <>
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
        action={
          <Button
            variant="secondary compact"
            onClick={() => open({ kind: "task" })}
          >
            <Plus size={18} />
            Pridať úlohu
          </Button>
        }
      />
      <div className="dashboard-grid">
        <section className="daily-card">
          <div className="section-heading">
            <span className="eyebrow">TVOJ DNEŠNÝ RYTMUS</span>
            <span className="tag">
              <Clock size={13} />
              {plan.timeBudget} min denne
            </span>
          </div>
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
          <div className="week-strip">
            {shortDays.map((name, i) => {
              const d = shiftDay(week.start, i),
                p = s.dailyPlans.find((p) => p.date === d),
                isRest = week.restDays.includes(weekday(d)),
                complete =
                  !!p?.occurrences.length &&
                  p.occurrences.every((o) => doneIds.has(o.id));
              return (
                <div key={name} className={d === day ? "today" : ""}>
                  <span>{name}</span>
                  <i className={complete ? "finished" : isRest ? "rest" : ""}>
                    {complete ? (
                      <Check size={16} />
                    ) : isRest ? (
                      <Coffee size={15} />
                    ) : (
                      <span />
                    )}
                  </i>
                </div>
              );
            })}
          </div>
        </section>
        <section className="next-card">
          <div className="section-heading">
            <span className="eyebrow">LEN JEDNA VEC</span>
            <Sparkles size={20} />
          </div>
          {task ? (
            <>
              <span className="task-location">{task.roomName}</span>
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
              <p>Jedna konkrétna vec. Viditeľný výsledok.</p>
              <TaskLocation s={s} task={task} compact />
              <Button onClick={() => open({ kind: "focus" })}>
                Začať malý krok
                <ArrowRight size={18} />
              </Button>
              <button className="subtle-link" onClick={() => navigate("tasks")}>
                Pozrieť dnešný plán
              </button>
            </>
          ) : (
            <>
              <div className="calm-icon">
                <Leaf size={36} strokeWidth={1.2} />
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
      </div>
      <div className="lower-grid">
        <section className="card reward-preview">
          <span className="eyebrow">TÝŽDENNÁ ODMENA</span>
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
          <span className="eyebrow">NIEČO NAVYŠE · DOBROVOĽNÉ</span>
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
          <span className="eyebrow">MEGA VÝZVA · TENTO MESIAC</span>
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
      {!currentTasks(s, day).length && !rest && (
        <section className="extra-card">
          <div>
            <span className="eyebrow">EŠTE MÁM ENERGIU</span>
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
    </>
  );
}
