import {
  Check,
  Plus,
  Trophy,
  Wallet,
  Zap,
  RefreshCw,
  ArrowUpRight,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Button,
  Progress,
  PageHead,
  Empty,
  type ScreenProps,
} from "./components";
import { totalXp, levelFor, balance, reconcile } from "../domain/rewards";
import { completedIds } from "../domain/scheduler";
import { dayOf, replaceBonus } from "../domain/commands";
import { weekStart } from "../domain/calendar";
import { money } from "../domain/model";
export default function Rewards({ s, run, open }: ScreenProps) {
  const day = dayOf(s),
    xp = totalXp(s),
    level = levelFor(xp),
    ids = completedIds(s),
    week = s.weeks.find((w) => w.start === weekStart(day))!,
    done = week.required.filter((o) => ids.has(o.id)).length,
    bonus = s.bonuses.find((b) => b.week === week.start)!,
    available = balance(s);
  return (
    <>
      <PageHead
        eyebrow="POKROK, KTORÝ SA POČÍTA"
        title="Zaslúžené malé radosti."
        text="Odmeny za pravidelnosť. Priestor na niečo pre seba."
      />
      <div className="reward-grid">
        <section className="card level-card">
          <div className="icon-tile">
            <Zap />
          </div>
          <span className="eyebrow">TVOJA ÚROVEŇ</span>
          <h2>
            {level.level}
            <small> · {xp} DA ⚡</small>
          </h2>
          <Progress
            value={level.progress}
            label={`K ďalšej úrovni ${level.remaining} DA ⚡`}
          />
          <p>Každý malý krok tvorí pokojnejší domov.</p>
        </section>
        <section className="wallet-card card">
          <div className="section-heading">
            <span className="eyebrow">VIRTUÁLNY ROZPOČET</span>
            <Wallet size={22} />
          </div>
          <strong className="balance">{money(available)}</strong>
          <p>Dostupné na tvoju osobnú odmenu.</p>
          <Button
            variant="secondary"
            disabled={available <= 0}
            onClick={() => open({ kind: "redeem" })}
          >
            Zaznamenať využitie
            <ArrowUpRight size={17} />
          </Button>
          <small>
            Aplikácia nedrží peniaze ani nevykonáva platby. Nevyužitá suma sa
            prenáša ďalej.
          </small>
          {available < 0 && (
            <p className="error">
              Po vrátení dokončenia vznikol záporný zostatok. Ďalšie odmeny ho
              vyrovnajú.
            </p>
          )}
        </section>
      </div>
      <div className="two-column">
        <section className="card">
          <div className="section-heading">
            <span className="eyebrow">DOHODNUTÝ TÝŽDENNÝ PLÁN</span>
            <span className="tag">{money(week.rewardCents)}</span>
          </div>
          <h3>
            {week.rewardIssuedAt
              ? "Týždeň je hotový."
              : "Krok za krokom k odmene."}
          </h3>
          <p>
            {done} z {week.required.length} povinných krokov · {week.start} –{" "}
            {week.end}
          </p>
          <Progress
            value={week.required.length ? done / week.required.length : 0}
          />
          <small>
            Odmena sa pripíše raz za 100 % plánu. Dni voľna nevyžadujú úlohy.
            Vymazanie úlohy nezruší dohodnutý krok.
          </small>
          <details>
            <summary>Pozrieť dohodnuté kroky</summary>
            {week.required.map((o) => (
              <div className="inventory-row" key={o.id}>
                <span>
                  {o.title}
                  <small>
                    {o.date} · {o.roomName}
                  </small>
                </span>
                {ids.has(o.id) && <Check size={17} />}
              </div>
            ))}
          </details>
        </section>
        <section className="card">
          <div className="section-heading">
            <span className="eyebrow">DOBROVOĽNÁ TÝŽDENNÁ VÝZVA</span>
            <Trophy size={20} />
          </div>
          <h3>{bonus.title}</h3>
          <p>
            +100 DA ⚡
            {bonus.monetaryEnabled && ` · +${money(bonus.rewardCents)}`} ·
            nezávisle od týždenného plánu
          </p>
          <div className="steps">
            {bonus.steps.map((step) => (
              <button
                key={step.id}
                className={`step ${step.done ? "done" : ""}`}
                onClick={() =>
                  void run(
                    (state) => {
                      const b = state.bonuses.find((b) => b.id === bonus.id)!;
                      b.steps.find((st) => st.id === step.id)!.done =
                        !step.done;
                      reconcile(state);
                    },
                    step.done
                      ? "Krok a odmena boli opravené."
                      : "Krok výzvy je hotový.",
                  )
                }
              >
                <i>{step.done ? <Check size={16} /> : null}</i>
                <span>
                  {step.title}
                  <small>{step.duration} min</small>
                </span>
              </button>
            ))}
          </div>
          {!bonus.awarded && !bonus.steps.some((st) => st.done) && (
            <Button
              variant="ghost"
              onClick={() =>
                void run(
                  (state) => replaceBonus(state, day),
                  "Ponúknutá iná výzva.",
                )
              }
            >
              <RefreshCw size={15} />
              Vybrať inú výzvu
            </Button>
          )}
          {bonus.awarded && (
            <span className="tag success">
              <Check size={15} />
              Výzva dokončená
            </span>
          )}
        </section>
      </div>
      <div className="section-heading spaced">
        <h2>Malé radosti na zozname</h2>
        <Button variant="secondary" onClick={() => open({ kind: "wish" })}>
          <Plus size={17} />
          Pridať želanie
        </Button>
      </div>
      {s.wishes.length ? (
        <div className="room-grid">
          {s.wishes.map((w) => (
            <section key={w.id} className="card">
              <div className="section-heading">
                <h3>{w.title}</h3>
                <div className="actions">
                  <Button
                    variant="icon ghost"
                    aria-label={`Upraviť želanie ${w.title}`}
                    onClick={() => open({ kind: "wish", id: w.id })}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="icon ghost"
                    aria-label={`Odstrániť želanie ${w.title}`}
                    onClick={() =>
                      open({ kind: "delete", entity: "wish", id: w.id })
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <p>
                {money(w.redeemedCents)} využitých z {money(w.cents)}
              </p>
              <Progress
                value={
                  w.cents
                    ? Math.min(
                        1,
                        (w.redeemedCents + Math.max(0, available)) / w.cents,
                      )
                    : 1
                }
              />
              <Button
                variant="ghost"
                disabled={available <= 0}
                onClick={() => open({ kind: "redeem", wishId: w.id })}
              >
                Využiť časť odmeny
              </Button>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="Na čo sa tešíš?"
          text="Kniha, dobrá káva alebo malá radosť. Pridaj si vlastné želanie."
        />
      )}
      <div className="section-heading spaced">
        <h2>Milé míľniky</h2>
      </div>
      <div className="achievement-list">
        {s.achievements.length ? (
          s.achievements.map((a) => (
            <div className="achievement" key={a.id}>
              <Trophy size={22} />
              <div>
                <strong>{a.title}</strong>
                <small>
                  {new Date(a.unlockedAt).toLocaleDateString("sk-SK")}
                </small>
              </div>
            </div>
          ))
        ) : (
          <p>Prvý míľnik príde s prvým dokončeným krokom.</p>
        )}
      </div>
      <section className="card spaced">
        <h3>História virtuálnych odmien</h3>
        {s.rewards.length ? (
          [...s.rewards].reverse().map((r) => (
            <div className="inventory-row" key={r.id}>
              <span>
                {r.description}
                <small>
                  {new Date(r.createdAt).toLocaleDateString("sk-SK")}
                </small>
              </span>
              <strong className={r.cents > 0 ? "accent" : ""}>
                {r.cents > 0 ? "+" : ""}
                {money(r.cents)}
              </strong>
            </div>
          ))
        ) : (
          <p>Tu sa zobrazia získané a využité odmeny.</p>
        )}
      </section>
    </>
  );
}
