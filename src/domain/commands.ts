import {
  type State,
  type Task,
  type Occurrence,
  type Day,
  type Problem,
  uid,
  xpFor,
} from "./model";
import { nextOccurrence, todayIn, weekStart, shiftDay } from "./calendar";
import { currentTasks, ensurePlans, pickTasks, snapshot } from "./scheduler";
import { balance, reconcile } from "./rewards";
import { syncObjectPlanLocation } from "./rooms";
export const dayOf = (s: State, now = new Date()) =>
  todayIn(s.households[0].timezone, now);
export function complete(
  s: State,
  taskId: string,
  mode: "required" | "extra" | "manual",
  occurrenceId?: string,
  now = new Date(),
  cycleMinutes = 60,
) {
  const day = dayOf(s, now);
  ensurePlans(s, day, now.toISOString());
  const task = s.tasks.find((t) => t.id === taskId);
  if (
    task?.objectId &&
    s.objects.some(
      (o) => o.id === task.objectId && o.accessibility === "unsafe",
    )
  )
    throw new Error(
      "Tento predmet vyžaduje bezpečný prístup alebo odborníka. Vyber inú úlohu.",
    );
  const occurrence = s.dailyPlans
    .flatMap((p) => p.occurrences)
    .find((o) => o.id === occurrenceId);
  if (mode === "required" && (!occurrence || occurrence.taskId !== taskId))
    throw new Error("Úloha nie je súčasťou plánu.");
  const key = mode === "required" ? occurrence!.id : `${mode}:${taskId}@${day}`;
  if (s.completions.some((c) => c.occurrenceId === key && !c.undone)) return;
  if (
    s.completions.some((c) => !c.undone && c.taskId === taskId && c.day === day)
  )
    throw new Error("Túto úlohu už máš dnes hotovú. Ďalšie opakovanie počká.");
  if (mode !== "required" && (!task?.enabled || task.nextDue > day))
    throw new Error("Táto úloha ešte nie je splatná.");
  if (task?.eventAt && Date.parse(task.eventAt) > now.getTime())
    throw new Error("Pranie ešte prebieha.");
  if (
    mode === "required" &&
    (occurrence!.date > day ||
      (occurrence!.deferredTo && occurrence!.deferredTo > day))
  )
    throw new Error("Táto úloha je naplánovaná neskôr.");
  if (mode === "manual") {
    const scheduled = currentTasks(s, day).find((o) => o.taskId === taskId);
    if (scheduled)
      return complete(s, taskId, "required", scheduled.id, now, cycleMinutes);
    const used = s.completions
      .filter((c) => !c.undone && c.day === day && c.type !== "extra")
      .reduce((n, c) => n + c.duration, 0);
    const budget = s.dailyPlans.find((p) => p.date === day)!.timeBudget;
    if (used + task!.duration > budget)
      throw new Error(
        "Dnešný čas na odmeňované úlohy je naplnený. Dopraj si pauzu.",
      );
  }
  const extras = s.completions.filter(
    (c) => !c.undone && c.type === "extra" && c.day === day,
  );
  if (mode === "extra") {
    const todayPlan = s.dailyPlans.find((p) => p.date === day)!;
    if (
      !todayPlan.occurrences.every((o) =>
        s.completions.some(
          (c) => !c.undone && c.type === "required" && c.occurrenceId === o.id,
        ),
      ) ||
      currentTasks(s, day).length
    )
      throw new Error("Najprv dokonči svoj denný plán.");
    if (
      extras.length >= 2 ||
      extras.reduce((n, c) => n + c.duration, 0) + (task?.duration || 0) > 10 ||
      (task?.duration || 0) > 5
    )
      throw new Error("Na dnes stačí. Pokračujeme zajtra.");
    if (
      s.completions.some(
        (c) => !c.undone && c.day === day && c.taskId === taskId,
      )
    )
      throw new Error("Táto úloha je už dnes hotová.");
    if (
      s.weeks.some(
        (w) =>
          w.start === weekStart(day) &&
          w.required.some(
            (o) =>
              o.taskId === taskId &&
              !s.completions.some((c) => c.occurrenceId === o.id && !c.undone),
          ),
      )
    )
      throw new Error("Táto úloha je rezervovaná v týždennom pláne.");
  }
  const title = occurrence?.title || task!.title,
    duration = occurrence?.duration || task!.duration;
  const previousDue = task?.nextDue || day,
    nextDue = task ? nextOccurrence(task.recurrence, day) : "9999-12-31";
  const completion = {
    id: uid(),
    householdId: s.households[0].id,
    taskId,
    occurrenceId: key,
    title,
    roomName:
      occurrence?.roomName ||
      s.rooms.find((r) => r.id === task?.roomId)?.name ||
      "Miestnosť",
    duration,
    completedAt: now.toISOString(),
    day,
    type: mode,
    xp:
      mode === "extra"
        ? 0
        : mode === "required"
          ? occurrence!.xp
          : xpFor(duration),
    previousDue,
    nextDue,
    undone: false,
  };
  s.completions.push(completion);
  if (task) {
    task.nextDue = nextDue;
    task.lastCompleted = day;
  }
  if (task?.workflow === "wash") {
    if (
      !Number.isInteger(cycleMinutes) ||
      cycleMinutes < 1 ||
      cycleMinutes > 600
    )
      throw new Error("Zadaj dĺžku cyklu od 1 do 600 minút.");
    if (!s.tasks.some((t) => t.parentCompletionId === completion.id)) {
      const dryer = s.objects.find(
        (o) => o.category === "dryer" && o.accessibility === "safe",
      );
      s.tasks.push({
        id: uid(),
        householdId: task.householdId,
        roomId: dryer?.roomId || task.roomId,
        objectId: dryer?.id,
        title: dryer
          ? "Presunúť jednu dávku do sušičky"
          : "Vyvesiť jednu dávku bielizne",
        instructions:
          "Po skončení cyklu vyber bielizeň. Dodrž návod výrobcu a symboly na oblečení.",
        duration: 5,
        recurrence: {
          unit: "once",
          interval: 1,
          strategy: "completion",
          anchor: day,
        },
        priority: 3,
        energy: 1,
        supplies: [],
        enabled: true,
        nextDue: day,
        eventAt: new Date(now.getTime() + cycleMinutes * 60000).toISOString(),
        parentCompletionId: completion.id,
        acceptedLong: false,
      });
    }
  }
  reconcile(s, now.toISOString());
}
export function undo(s: State, completionId: string) {
  const c = s.completions.find((c) => c.id === completionId);
  if (!c || c.undone) return;
  const children = s.tasks.filter((t) => t.parentCompletionId === c.id);
  if (
    children.some((t) =>
      s.completions.some((x) => x.taskId === t.id && !x.undone),
    )
  )
    throw new Error("Najprv vráť dokončenie nadväzujúcej úlohy prania.");
  c.undone = true;
  s.tasks = s.tasks.filter((t) => t.parentCompletionId !== c.id);
  const task = s.tasks.find((t) => t.id === c.taskId);
  if (task) {
    const latest = s.completions
      .filter((x) => x.taskId === c.taskId && !x.undone)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
    task.nextDue = latest?.nextDue || c.previousDue;
    task.lastCompleted = latest?.day;
  }
  const original = s.dailyPlans
    .flatMap((p) => p.occurrences)
    .find((o) => o.id === c.occurrenceId);
  if (original?.objectId) syncObjectPlanLocation(s, original.objectId);
  reconcile(s);
}
export function extraOptions(s: State, day: Day): Task[] {
  const reserved = s.weeks
    .filter((w) => w.start === weekStart(day))
    .flatMap((w) => w.required.map((o) => o.taskId));
  const done = s.completions
    .filter((c) => !c.undone && c.day === day)
    .map((c) => c.taskId);
  const choices: Task[] = [];
  const excluded = [...reserved, ...done];
  for (let i = 0; i < 10; i++) {
    const next = pickTasks(s, day, s.tasks, 5, excluded)[0];
    if (!next) break;
    choices.push(next);
    excluded.push(next.id);
  }
  return choices;
}
export function postpone(s: State, id: string, date: Day) {
  const o = s.dailyPlans.flatMap((p) => p.occurrences).find((o) => o.id === id);
  if (!o) return;
  if (date <= o.date) throw new Error("Vyber neskorší dátum.");
  o.deferredTo = date;
}
export function replaceOccurrence(s: State, id: string, day: Day) {
  const plan = s.dailyPlans.find((p) => p.occurrences.some((o) => o.id === id));
  const old = plan?.occurrences.find((o) => o.id === id);
  if (!old || !plan) return;
  if (s.completions.some((c) => c.occurrenceId === id && !c.undone))
    throw new Error("Hotovú úlohu nemožno nahradiť.");
  const excluded = s.weeks
    .filter((w) => w.start === weekStart(old.date))
    .flatMap((w) => w.required.map((o) => o.taskId));
  const candidate = pickTasks(s, day, s.tasks, old.duration, excluded)[0];
  if (!candidate) throw new Error("Momentálne nemáme vhodnú náhradu.");
  const next = snapshot(s, candidate, old.date);
  next.id = old.id;
  // Replacement retains the agreed time and required occurrence identity.
  plan.occurrences[plan.occurrences.indexOf(old)] = next;
  const week = s.weeks.find((w) => w.required.some((o) => o.id === id));
  if (week)
    week.required[week.required.findIndex((o) => o.id === id)] =
      structuredClone(next);
}
export function saveTask(s: State, task: Task) {
  if (task.duration > 10 && !task.acceptedLong)
    throw new Error(
      "Rozdeľ úlohu na kroky do 10 minút alebo výslovne povoľ výnimku.",
    );
  if (
    task.duration < 1 ||
    !Number.isInteger(task.duration) ||
    task.duration > 120
  )
    throw new Error("Dĺžka úlohy musí byť od 1 do 120 minút.");
  if (
    !s.rooms.some((r) => r.id === task.roomId) ||
    task.householdId !== s.households[0].id ||
    (task.objectId &&
      !s.objects.some(
        (o) => o.id === task.objectId && o.roomId === task.roomId,
      ))
  )
    throw new Error("Predmet a miestnosť k sebe nepatria.");
  const index = s.tasks.findIndex((t) => t.id === task.id);
  if (index < 0) s.tasks.push(task);
  else s.tasks[index] = task;
}
export function duplicateTask(s: State, id: string) {
  const task = s.tasks.find((t) => t.id === id);
  if (task)
    s.tasks.push({
      ...structuredClone(task),
      id: uid(),
      title: task.title + " (kópia)",
    });
}
export function splitTask(s: State, id: string, titles: string[]) {
  const task = s.tasks.find((t) => t.id === id);
  if (!task) return;
  if (titles.length < 2 || titles.some((t) => !t.trim()))
    throw new Error("Zadaj aspoň dva konkrétne kroky.");
  const duration = Math.ceil(task.duration / titles.length);
  if (duration > 10)
    throw new Error("Pridaj viac krokov, aby každý trval najviac 10 minút.");
  task.enabled = false;
  for (const title of titles)
    saveTask(s, {
      ...structuredClone(task),
      id: uid(),
      title: title.trim(),
      duration,
      enabled: true,
      acceptedLong: false,
    });
}
export function deleteTask(s: State, id: string) {
  s.tasks = s.tasks.filter((t) => t.id !== id);
}
export function deleteRoom(s: State, id: string) {
  s.rooms = s.rooms.filter((r) => r.id !== id);
  s.objects = s.objects.filter((o) => o.roomId !== id);
  s.tasks = s.tasks.filter((t) => t.roomId !== id);
  for (const p of s.problems.filter((p) => p.roomId === id)) {
    p.roomId = s.rooms[0]?.id || "";
    delete p.objectId;
  }
}
export function redeem(
  s: State,
  cents: number,
  title: string,
  wishId?: string,
) {
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > balance(s))
    throw new Error("Suma musí byť kladná a nesmie prekročiť dostupnú odmenu.");
  s.rewards.push({
    id: uid(),
    householdId: s.households[0].id,
    type: "redemption",
    cents: -cents,
    sourceId: wishId || uid(),
    createdAt: new Date().toISOString(),
    description: title || "Využitá osobná odmena",
  });
  const wish = s.wishes.find((w) => w.id === wishId);
  if (wish) wish.redeemedCents += cents;
}
export function propose(p: Pick<Problem, "title" | "category">) {
  const dangerous =
    /elektr|zásuvk.*(iskr|prúd)|plyn|nosn|strech|výšk|potrub|rozvod/i.test(
      p.title,
    );
  if (dangerous)
    return {
      solution:
        "Zaznamenaj problém a objednaj kvalifikovaného odborníka. Do technických rozvodov ani práce vo výške sa nepúšťaj.",
      titles: [
        "Spísať prejavy problému",
        "Nájsť kontakt na odborníka",
        "Dohodnúť odbornú obhliadku",
      ],
    };
  const titles =
    p.category === "Zorganizovať"
      ? [
          "Pozrieť, ktoré veci sa hromadia",
          "Vybrať existujúci box alebo zásuvku",
          "Premiestniť jednu malú skupinu vecí",
          "Overiť, či nové miesto funguje",
        ]
      : p.category === "Vymeniť"
        ? [
            "Zapísať rozmery a potreby",
            "Overiť možnosť opravy alebo existujúcej náhrady",
            "Porovnať dve možnosti v rozpočte",
            "Naplánovať výmenu",
          ]
        : [
            "Opísať požadovaný výsledok",
            "Vybrať jedno malé bezpečné zlepšenie",
            "Pripraviť potrebné pomôcky",
            "Urobiť prvý malý krok",
            "Overiť výsledok",
          ];
  return {
    solution:
      "Začni tým, čo už doma máš. Uprav jednu malú časť a potom vyhodnoť, či riešenie pomáha.",
    titles,
  };
}
export function createMega(s: State, problemId: string, day: Day) {
  const month = day.slice(0, 7);
  if (s.megas.some((m) => m.month === month))
    throw new Error("Tento mesiac už máš Mega výzvu.");
  const p = s.problems.find((p) => p.id === problemId);
  if (!p) throw new Error("Nápad sa nenašiel.");
  const solution = propose(p);
  if (!p.steps.length)
    p.steps = solution.titles.map((title) => ({
      id: uid(),
      title,
      duration: 5,
      done: false,
    }));
  if (p.steps.length < 3 || p.steps.length > 7)
    throw new Error("Mega výzva potrebuje 3 až 7 malých krokov.");
  s.megas.push({
    id: uid(),
    householdId: p.householdId,
    month,
    problemId,
    title: p.title,
    problem: p.description || p.title,
    result: "Malé zlepšenie, ktoré uľahčí každodenný život.",
    solution: p.solution || solution.solution,
    materials: "Najprv použi existujúce pomôcky a úložné priestory.",
    budgetCents: p.budgetCents,
    steps: structuredClone(p.steps),
    awarded: false,
    before: p.photos[0],
  });
  p.status = "Rozpracované";
}
export function replaceBonus(s: State, day: Day) {
  const b = s.bonuses.find((b) => b.week === weekStart(day));
  if (!b || b.awarded || b.steps.some((st) => st.done))
    throw new Error("Rozpracovanú výzvu už nemožno nahradiť.");
  b.variant++;
  b.title =
    b.variant % 2
      ? "Jeden úložný box v poriadku"
      : "Jedna polica, viac priestoru";
  b.steps = (
    b.variant % 2
      ? [
          "Pozrieť obsah jedného boxu",
          "Vytriediť päť nepotrebných vecí",
          "Uložiť zvyšok prehľadne",
        ]
      : [
          "Vybrať veci z jednej police",
          "Utrieť prázdnu policu",
          "Odložiť veci, ktoré sem patria",
        ]
  ).map((title, i) => ({ id: `step-${i}`, title, duration: 5, done: false }));
}
export const tomorrow = (s: State) => shiftDay(dayOf(s), 1);
export const plannedFor = (s: State, day: Day): Occurrence[] =>
  s.dailyPlans.find((p) => p.date === day)?.occurrences || [];
