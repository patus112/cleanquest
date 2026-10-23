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
import {
  currentTasks,
  ensurePlans,
  pickTasks,
  snapshot,
  syncTierSuggestions,
} from "./scheduler";
import { balance, reconcile } from "./rewards";
import { featurePresent, syncObjectPlanLocation } from "./rooms";
import {
  buildTierContext,
  canSuggest,
  taskTier,
  zoneOf,
  type CleaningTier,
} from "./tiers";
export const dayOf = (s: State, now = new Date()) =>
  todayIn(s.households[0].timezone, now);
export function complete(
  s: State,
  taskId: string,
  mode: "required" | "extra" | "manual",
  occurrenceId?: string,
  now = new Date(),
  cycleMinutes = 60,
  options?: { allowEarly?: boolean },
) {
  const day = dayOf(s, now);
  ensurePlans(s, day, now.toISOString(), { sync: false });
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
  if (
    mode !== "required" &&
    (!task?.enabled || (task.nextDue > day && !options?.allowEarly))
  )
    throw new Error("Táto úloha ešte nie je splatná.");
  if (task?.eventAt && Date.parse(task.eventAt) > now.getTime())
    throw new Error("Pranie ešte prebieha.");
  if (
    mode === "required" &&
    !options?.allowEarly &&
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
  syncTierSuggestions(s, day);
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
export const noReplacementMessage =
  "Na tento krok teraz nemám inú úlohu rovnakej úrovne. Môžeš ho odložiť na zajtra.";

function writeOccurrence(s: State, next: Occurrence) {
  for (const plan of s.dailyPlans) {
    const index = plan.occurrences.findIndex((item) => item.id === next.id);
    if (index >= 0) plan.occurrences[index] = next;
  }
  for (const week of s.weeks) {
    const index = week.required.findIndex((item) => item.id === next.id);
    if (index >= 0) week.required[index] = structuredClone(next);
  }
}

function occurrenceFromTask(base: Occurrence, task: Task, s: State): Occurrence {
  return {
    ...base,
    taskId: task.id,
    roomId: task.roomId,
    roomName: s.rooms.find((room) => room.id === task.roomId)?.name || "Miestnosť",
    objectId: task.objectId,
    objectName: s.objects.find((object) => object.id === task.objectId)?.name,
    title: task.title,
    instructions: task.instructions,
    duration: task.duration,
    xp: xpFor(task.duration),
  };
}

/** Another step she can do instead. Same level first. Never a higher level, so Ťažký deň and a zone cannot hide the result. */
function chooseReplacement(
  s: State,
  old: Occurrence,
  day: Day,
): { kind: "task"; task: Task } | { kind: "swap"; occurrence: Occurrence } | undefined {
  const settings = s.settings[0];
  const rescue = !!settings?.rescue;
  const source = s.tasks.find((task) => task.id === old.taskId);
  const originalTier = taskTier(source ?? { title: old.title });
  const ceiling = (rescue ? 1 : originalTier) as CleaningTier;
  const budget = settings?.dailyBudget ?? old.duration;
  const energy = settings?.energy ?? 3;
  const ctx = buildTierContext(s, day);
  const doneToday = new Set(
    s.completions
      .filter((completion) => !completion.undone && completion.day === day)
      .map((completion) => completion.taskId),
  );
  const week = s.weeks.find(
    (item) => item.start === weekStart(old.date) && item.end >= old.date,
  );
  const reserved = new Set<string>([
    ...(week?.required.map((item) => item.taskId) ?? []),
    ...s.dailyPlans.flatMap((plan) =>
      plan.date >= (week?.start ?? old.date) && plan.date <= (week?.end ?? old.date)
        ? plan.occurrences.map((item) => item.taskId)
        : [],
    ),
  ]);
  const eligible = (task: Task) => {
    if (!task.enabled || task.id === old.taskId || doneToday.has(task.id))
      return false;
    if (task.duration > budget || task.energy > energy) return false;
    const tier = taskTier(task);
    if (tier > ceiling) return false;
    const room = s.rooms.find((item) => item.id === task.roomId);
    if (!room?.enabled) return false;
    const object = task.objectId
      ? s.objects.find((item) => item.id === task.objectId)
      : undefined;
    if (task.objectId && object?.accessibility !== "safe") return false;
    if (!featurePresent(room, object?.category || "")) return false;
    if (task.eventAt && Date.parse(task.eventAt) > Date.now()) return false;
    const gate = ctx.rooms.get(task.roomId);
    if (!gate || !canSuggest(gate, tier, rescue, zoneOf(ctx, task.roomId)))
      return false;
    return true;
  };
  const rank = (task: Task) => {
    const tier = taskTier(task);
    return [
      tier === originalTier ? 0 : 1,
      task.duration > old.duration ? 1 : 0,
      task.nextDue <= day ? 0 : 1,
      tier,
      Math.abs(task.duration - old.duration),
      -task.priority,
    ];
  };
  const compare = (a: Task, b: Task) => {
    const left = rank(a);
    const right = rank(b);
    for (let index = 0; index < left.length; index++)
      if (left[index] !== right[index]) return left[index] - right[index];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
  const backlog = s.tasks.filter((task) => eligible(task) && !reserved.has(task.id));
  backlog.sort(compare);
  if (backlog[0]) return { kind: "task", task: backlog[0] };
  const swaps = (week?.required ?? []).filter((item) => {
    if (item.id === old.id || item.date === old.date) return false;
    const task = s.tasks.find((candidate) => candidate.id === item.taskId);
    return !!task && eligible(task);
  });
  swaps.sort((a, b) => {
    const taskA = s.tasks.find((task) => task.id === a.taskId)!;
    const taskB = s.tasks.find((task) => task.id === b.taskId)!;
    const byTask = compare(taskA, taskB);
    if (byTask) return byTask;
    const futureA = a.date >= old.date ? 0 : 1;
    const futureB = b.date >= old.date ? 0 : 1;
    if (futureA !== futureB) return futureA - futureB;
    return a.date < b.date ? -1 : 1;
  });
  if (swaps[0]) return { kind: "swap", occurrence: swaps[0] };
  return undefined;
}

export function replaceOccurrence(s: State, id: string, day: Day) {
  const plan = s.dailyPlans.find((item) =>
    item.occurrences.some((occurrence) => occurrence.id === id),
  );
  const old = plan?.occurrences.find((occurrence) => occurrence.id === id);
  if (!old || !plan)
    throw new Error("Túto úlohu v pláne nevidím.");
  if (s.completions.some((completion) => completion.occurrenceId === id && !completion.undone))
    throw new Error("Túto úlohu už máš hotovú. Nahradiť ju netreba.");
  const choice = chooseReplacement(s, old, day);
  if (!choice) throw new Error(noReplacementMessage);
  if (choice.kind === "task") {
    const source = s.tasks.find((task) => task.id === old.taskId);
    writeOccurrence(s, occurrenceFromTask(old, choice.task, s));
    const stillThere = s.weeks
      .filter((week) => week.start === weekStart(old.date))
      .some((week) =>
        week.required.some(
          (item) => item.taskId === old.taskId && item.id !== old.id,
        ),
      );
    if (source && !stillThere && source.nextDue <= day)
      source.nextDue = nextOccurrence(source.recurrence, day);
    return;
  }
  const other = s.dailyPlans
    .flatMap((item) => item.occurrences)
    .find((item) => item.id === choice.occurrence.id);
  const otherTask = s.tasks.find((task) => task.id === choice.occurrence.taskId);
  const oldTask = s.tasks.find((task) => task.id === old.taskId);
  if (!other || !otherTask || !oldTask) throw new Error(noReplacementMessage);
  const nextOld = occurrenceFromTask(old, otherTask, s);
  const nextOther = occurrenceFromTask(other, oldTask, s);
  writeOccurrence(s, nextOld);
  writeOccurrence(s, nextOther);
}

function markedToday(s: State, taskId: string, day: Day) {
  return s.completions.some(
    (item) => !item.undone && item.taskId === taskId && item.day === day,
  );
}

/** A due základ that never fitted into the week still gets a normal completion. */
function placeToday(s: State, task: Task, day: Day): Occurrence {
  const plan = s.dailyPlans.find((item) => item.date === day);
  if (!plan) throw new Error("Dnešný plán sa nepodarilo pripraviť.");
  let occurrence = snapshot(s, task, day);
  const ids = new Set(
    s.dailyPlans.flatMap((item) => item.occurrences.map((row) => row.id)),
  );
  if (ids.has(occurrence.id)) occurrence = { ...occurrence, id: uid() };
  plan.occurrences.unshift(occurrence);
  return occurrence;
}

const basicNotRecorded =
  "Tento základ sa teraz nepodarilo označiť. Skús to ešte raz.";

/** Tick a základ from the room overview. A second tap undoes today. */
export function toggleBasicToday(s: State, taskId: string, now = new Date()) {
  const task = s.tasks.find((item) => item.id === taskId);
  if (!task || taskTier(task) !== 1)
    throw new Error("Tento základ sa nenašiel.");
  const day = dayOf(s, now);
  const existing = s.completions.find(
    (item) => !item.undone && item.taskId === taskId && item.day === day,
  );
  if (existing) {
    undo(s, existing.id);
    return;
  }
  ensurePlans(s, day, now.toISOString(), { sync: false });
  const due = task.nextDue <= day;
  if (due) {
    const open = s.dailyPlans
      .flatMap((plan) => plan.occurrences)
      .filter(
        (item) =>
          item.taskId === taskId &&
          !s.completions.some(
            (completion) =>
              !completion.undone && completion.occurrenceId === item.id,
          ),
      )
      .sort((a, b) => {
        const aNow = a.date <= day ? 0 : 1;
        const bNow = b.date <= day ? 0 : 1;
        if (aNow !== bNow) return aNow - bNow;
        return a.date < b.date ? -1 : 1;
      });
    const chosen = open.find((item) => item.date <= day) ?? open[0];
    if (chosen)
      complete(s, taskId, "required", chosen.id, now, 60, { allowEarly: true });
    // A full minute block used to refuse this as extra manual time and the
    // reason sat off-screen. Due work is a normal completion either way.
    if (!markedToday(s, taskId, day)) {
      const created = placeToday(s, task, day);
      complete(s, taskId, "required", created.id, now, 60, {
        allowEarly: true,
      });
    }
  } else {
    complete(s, taskId, "manual", undefined, now, 60, { allowEarly: true });
  }
  if (!markedToday(s, taskId, day)) throw new Error(basicNotRecorded);
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

const DAILY_MINUTES = [5, 10, 15, 20, 30] as const;

/** One saved daily length. Past days stay as they were; the locked week is not rebuilt. */
export function applyDailyBudget(s: State, minutes: number, now = new Date()) {
  if (
    !s.settings[0] ||
    !DAILY_MINUTES.includes(minutes as (typeof DAILY_MINUTES)[number])
  )
    throw new Error("Denný čas má byť 5, 10, 15, 20 alebo 30 minút.");
  s.settings[0].dailyBudget = minutes as (typeof DAILY_MINUTES)[number];
  ensurePlans(s, dayOf(s, now), now.toISOString());
}

export function setRescue(s: State, on: boolean, now = new Date()) {
  if (!s.settings[0]) return;
  s.settings[0].rescue = on;
  ensurePlans(s, dayOf(s, now), now.toISOString());
}

export function markBasicsOk(s: State, roomId: string, now = new Date()) {
  const room = s.rooms.find((item) => item.id === roomId);
  if (!room) throw new Error("Miestnosť sa nenašla.");
  const day = dayOf(s, now);
  ensurePlans(s, day, now.toISOString(), { sync: false });
  const plan = s.dailyPlans.find((item) => item.date === day);
  if (!plan) return;
  const ids =
    room.openPlan && room.enabled
      ? s.rooms
          .filter(
            (item) =>
              item.enabled && item.openPlan && item.floorId === room.floorId,
          )
          .map((item) => item.id)
      : [roomId];
  const marked = new Set(plan.basicsOk ?? []);
  for (const id of ids) marked.add(id);
  plan.basicsOk = [...marked];
  syncTierSuggestions(s, day);
}

export interface QuickTaskInput {
  title: string;
  roomId: string;
  objectId?: string;
  duration?: number;
  keep?: boolean;
}

/** One-off by default. A recurring task is created only when `keep` is set. */
export function addQuickTask(
  s: State,
  input: QuickTaskInput,
  intent: "now" | "done",
  now = new Date(),
) {
  const title = input.title.trim();
  if (!title) throw new Error("Napíš, čo chceš spraviť.");
  const duration = input.duration ?? 5;
  if (!Number.isInteger(duration) || duration < 1 || duration > 10)
    throw new Error("Rýchla úloha má trvať 1 až 10 minút.");
  const room = s.rooms.find((item) => item.id === input.roomId);
  if (!room) throw new Error("Vyber miestnosť.");
  if (
    input.objectId &&
    !s.objects.some(
      (object) => object.id === input.objectId && object.roomId === room.id,
    )
  )
    throw new Error("Predmet a miestnosť k sebe nepatria.");
  const day = dayOf(s, now);
  ensurePlans(s, day, now.toISOString(), { sync: false });
  const task: Task = {
    id: uid(),
    householdId: s.households[0].id,
    roomId: room.id,
    objectId: input.objectId,
    title,
    instructions:
      "Malý krok, ktorý si vybrala teraz. Stačí jedna konkrétna vec.",
    duration,
    recurrence: input.keep
      ? { unit: "week", interval: 1, strategy: "completion", anchor: day }
      : { unit: "once", interval: 1, strategy: "completion", anchor: day },
    priority: 2,
    energy: 1,
    supplies: [],
    enabled: true,
    nextDue: day,
    acceptedLong: false,
    tier: 1,
  };
  saveTask(s, task);
  if (intent === "done") {
    complete(s, task.id, "manual", undefined, now);
    return { taskId: task.id };
  }
  const plan = s.dailyPlans.find((item) => item.date === day);
  if (!plan) throw new Error("Dnešný plán sa nepodarilo pripraviť.");
  const occurrence = snapshot(s, task, day);
  occurrence.lead = true;
  plan.occurrences = [
    occurrence,
    ...plan.occurrences.filter((item) => item.taskId !== task.id),
  ];
  return { taskId: task.id, occurrenceId: occurrence.id };
}
