import { useState } from "react";
import { Check, Lightbulb, Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import {
  Button,
  Empty,
  PageHead,
  Progress,
  PhotoInput,
  photoFrom,
  type ScreenProps,
} from "./components";
import { dayOf, createMega, propose } from "../domain/commands";
import { money, uid } from "../domain/model";
import { reconcile } from "../domain/rewards";
export default function Ideas({ s, run, open }: ScreenProps) {
  const [history, setHistory] = useState(false),
    day = dayOf(s),
    mega = s.megas.find((m) => m.month === day.slice(0, 7)),
    problems = s.problems.filter((p) =>
      history ? p.status === "Vyriešené" : p.status !== "Vyriešené",
    );
  return (
    <>
      <PageHead
        eyebrow="PRIESTOR PRE LEPŠÍ DOMOV"
        title="Toto ma doma štve."
        text="Zachyť nápad teraz. Riešenie môže pokojne počkať."
        action={
          <Button onClick={() => open({ kind: "problem" })}>
            <Plus size={18} />
            Toto ma štve
          </Button>
        }
      />
      {mega ? (
        <section className="card mega-card">
          <div className="section-heading">
            <span className="eyebrow">MESAČNÁ MEGA VÝZVA · +500 DA ⚡</span>
            <Sparkles size={22} />
          </div>
          <h2>{mega.title}</h2>
          <p>{mega.problem}</p>
          <div className="mega-details">
            <div>
              <span className="eyebrow">VÝSLEDOK</span>
              <p>{mega.result}</p>
            </div>
            <div>
              <span className="eyebrow">RIEŠENIE</span>
              <p>{mega.solution}</p>
            </div>
          </div>
          <div className="task-meta">
            <span>
              {mega.steps.reduce((n, st) => n + st.duration, 0)} min celkovo
            </span>
            <span>Rozpočet: {money(mega.budgetCents)}</span>
          </div>
          <p className="muted">{mega.materials}</p>
          <Progress
            value={
              mega.steps.filter((st) => st.done).length / mega.steps.length
            }
          />
          <div className="steps">
            {mega.steps.map((step) => (
              <button
                key={step.id}
                className={`step ${step.done ? "done" : ""}`}
                onClick={() =>
                  void run(
                    (state) => {
                      const m = state.megas.find((m) => m.id === mega.id)!;
                      const st = m.steps.find((st) => st.id === step.id)!;
                      st.done = !st.done;
                      reconcile(state);
                    },
                    step.done ? "Krok bol vrátený." : "Domov je o krok lepší.",
                  )
                }
              >
                <i>{step.done && <Check size={17} />}</i>
                <span>
                  {step.title}
                  <small>
                    {step.duration} min · môžeš pokračovať ďalší deň
                  </small>
                </span>
              </button>
            ))}
          </div>
          <details>
            <summary>Upraviť projekt a fotografie</summary>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                  const before = await photoFrom(f, "before", mega.before),
                    after = await photoFrom(f, "after", mega.after);
                  const titles = String(f.get("steps"))
                    .split("\n")
                    .filter(Boolean);
                  await run((state) => {
                    if (titles.length < 3 || titles.length > 7)
                      throw new Error("Použi 3 až 7 krokov.");
                    const m = state.megas.find((m) => m.id === mega.id)!;
                    m.result = String(f.get("result"));
                    m.solution = String(f.get("solution"));
                    m.materials = String(f.get("materials"));
                    m.budgetCents = Math.round(Number(f.get("budget")) * 100);
                    m.steps = titles.map((title, i) => ({
                      ...(m.steps[i] || {
                        id: uid(),
                        done: false,
                        duration: 5,
                      }),
                      title,
                    }));
                    m.before = before;
                    m.after = after;
                    reconcile(state);
                  }, "Projekt bol upravený.");
                } catch (err) {
                  await run(() => {
                    throw err;
                  });
                }
              }}
            >
              <label className="field">
                Požadovaný výsledok
                <input name="result" defaultValue={mega.result} />
              </label>
              <label className="field">
                Riešenie
                <textarea name="solution" defaultValue={mega.solution} />
              </label>
              <label className="field">
                Pomôcky
                <input name="materials" defaultValue={mega.materials} />
              </label>
              <label className="field">
                Rozpočet (€)
                <input
                  name="budget"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={mega.budgetCents / 100}
                />
              </label>
              <label className="field">
                Kroky
                <textarea
                  name="steps"
                  defaultValue={mega.steps.map((st) => st.title).join("\n")}
                />
              </label>
              <PhotoInput name="before" value={mega.before} />
              <PhotoInput name="after" value={mega.after} />
              <Button type="submit">Uložiť projekt</Button>
            </form>
          </details>
          {mega.awarded && (
            <p className="accent">Vyriešené. +500 DA ⚡ za zlepšenie domova.</p>
          )}
        </section>
      ) : (
        <section className="idea-banner">
          <div className="icon-tile">
            <Lightbulb />
          </div>
          <div>
            <span className="eyebrow">MESAČNÁ MEGA VÝZVA</span>
            <h3>Jedna drobnosť, ktorá zmení každý deň.</h3>
            <p>
              Vyber nápad zo zoznamu a vyrieš ho po malých krokoch. +500 DA ⚡
            </p>
          </div>
        </section>
      )}
      <div className="tabs">
        <button
          className={!history ? "active" : ""}
          onClick={() => setHistory(false)}
        >
          Čakajúce nápady
        </button>
        <button
          className={history ? "active" : ""}
          onClick={() => setHistory(true)}
        >
          Vyriešené
        </button>
      </div>
      {problems.length ? (
        <div className="two-column">
          {problems.map((p) => (
            <section className="card problem-card" key={p.id}>
              <div className="section-heading">
                <span className="tag">{p.category}</span>
                <div className="actions">
                  <Button
                    variant="icon ghost"
                    aria-label={`Upraviť nápad ${p.title}`}
                    onClick={() => open({ kind: "problem", id: p.id })}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="icon ghost"
                    aria-label={`Odstrániť nápad ${p.title}`}
                    onClick={() =>
                      open({ kind: "delete", entity: "problem", id: p.id })
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
              <span className="task-location">
                {s.rooms.find((r) => r.id === p.roomId)?.name || "Domácnosť"} ·{" "}
                {p.status}
              </span>
              <h3>{p.title}</h3>
              {p.description && <p>{p.description}</p>}
              <span className="muted">
                Rozpočet {money(p.budgetCents)} ·{" "}
                {["", "Nízka", "Bežná", "Vysoká"][p.priority]} priorita
              </span>
              {p.photos.map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  className="photo"
                  alt={`Fotografia nápadu ${i + 1}`}
                />
              ))}
              {p.solution && <p>{p.solution}</p>}
              {p.steps.length > 0 && (
                <div className="steps">
                  {p.steps.map((step) => (
                    <button
                      key={step.id}
                      className={`step ${step.done ? "done" : ""}`}
                      onClick={() =>
                        void run((state) => {
                          const problem = state.problems.find(
                            (x) => x.id === p.id,
                          )!;
                          problem.steps.find((x) => x.id === step.id)!.done =
                            !step.done;
                        })
                      }
                    >
                      <i>{step.done && <Check size={15} />}</i>
                      <span>{step.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {p.completedAt && (
                <small>
                  Vyriešené{" "}
                  {new Date(p.completedAt).toLocaleDateString("sk-SK")}
                </small>
              )}
              <div className="actions spaced">
                {!p.solution && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void run((state) => {
                        const problem = state.problems.find(
                          (x) => x.id === p.id,
                        )!;
                        const suggested = propose(problem);
                        problem.solution = suggested.solution;
                        problem.steps = suggested.titles.map((title) => ({
                          id: uid(),
                          title,
                          duration: 5,
                          done: false,
                        }));
                        problem.status = "Pripravené";
                      }, "Pripravený návrh zo šablóny.")
                    }
                  >
                    Navrhnúť malé kroky
                  </Button>
                )}
                {!mega && !history && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      void run(
                        (state) => createMega(state, p.id, day),
                        "Mesačný projekt je pripravený.",
                      )
                    }
                  >
                    <Sparkles size={16} />
                    Vybrať ako Mega výzvu
                  </Button>
                )}
                {!history && (
                  <Button
                    variant="ghost"
                    onClick={() =>
                      void run((state) => {
                        const problem = state.problems.find(
                          (x) => x.id === p.id,
                        )!;
                        problem.status = "Vyriešené";
                        problem.completedAt = new Date().toISOString();
                      }, "Nápad je vyriešený.")
                    }
                  >
                    Označiť vyriešené
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title={
            history
              ? "Každé zlepšenie sa počíta."
              : "Nápad nemusí mať hneď riešenie."
          }
          text={
            history
              ? "Dokončené zlepšenia a ich fotografie nájdeš tu."
              : "Zapíš, čo ti doma prekáža. Vrátiš sa k tomu, keď bude vhodný čas."
          }
          action={
            !history && (
              <Button onClick={() => open({ kind: "problem" })}>
                <Plus size={17} />
                Toto ma štve
              </Button>
            )
          }
        />
      )}
    </>
  );
}
