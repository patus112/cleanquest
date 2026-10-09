import { useCallback, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  Home,
  ListChecks,
  Gift,
  Lightbulb,
  UserRound,
  Leaf,
  WifiOff,
  Zap,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { type State, emptyState } from "../domain/model";
import { LocalRepository } from "../persistence/repository";
import { ensurePlans } from "../domain/scheduler";
import { dayOf } from "../domain/commands";
import { totalXp, levelFor } from "../domain/rewards";
import { Button, type ModalType } from "./components";
import Onboarding from "./Onboarding";
import Dashboard from "./Dashboard";
import Tasks from "./Tasks";
import Rewards from "./Rewards";
import Ideas from "./Ideas";
import Profile from "./Profile";
import Forms from "./Forms";
import {
  defaultSafety,
  backupReminderDue,
  type LocalSafety,
} from "../domain/localSafety";
import {
  storageStatus,
  storageConstrained,
  storageError,
  requestPersistentStorage,
  type StorageStatus,
} from "../persistence/storage";
import type { ValidatedBackup } from "../persistence/backup";
const repo = new LocalRepository();
const nav = [
  ["home", "Domov", Home],
  ["tasks", "Úlohy", ListChecks],
  ["rewards", "Odmeny", Gift],
  ["ideas", "Nápady", Lightbulb],
  ["profile", "Profil", UserRound],
] as const;
const pageFromHash = () => {
  const path = location.hash.slice(2).split("?")[0];
  return nav.some((n) => n[0] === path) ? path : "home";
};
export default function App() {
  const [s, setState] = useState<State>(emptyState()),
    [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState(pageFromHash),
    [modal, setModal] = useState<ModalType>(null),
    [offline, setOffline] = useState(!navigator.onLine),
    [sessionBudget, setSessionBudget] = useState(15);
  const [safety, setSafety] = useState<LocalSafety>(defaultSafety),
    [storage, setStorage] = useState<StorageStatus>({
      persistenceSupported: false,
    });
  const refreshStorage = useCallback(
    async () => setStorage(await storageStatus()),
    [],
  );
  const refreshSafety = async () => {
    setSafety((await repo.readSnapshot()).safety);
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cleanquest-changes");
      channel.postMessage("changed");
      channel.close();
    }
  };
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () =>
      setToast(
        "Offline balík sa nepodarilo pripraviť. Skús aplikáciu neskôr obnoviť online.",
      ),
  });
  const navigate = (next: string) => {
    location.hash = `/${next}`;
    setPage(next.split("?")[0]);
    window.scrollTo({ top: 0 });
  };
  const publish = (state: State) => {
    setState(state);
    void repo
      .readSnapshot()
      .then((snapshot) => setSafety(snapshot.safety))
      .catch((err) => setError(storageError(err)));
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("cleanquest-changes");
      channel.postMessage("changed");
      channel.close();
    }
  };
  const run = useCallback(
    async (recipe: (s: State) => void, message?: string) => {
      setBusy(true);
      setError("");
      try {
        const state = await repo.transact(recipe);
        publish(state);
        if (message) {
          setToast(message);
          if (state.settings[0]?.haptics && message.startsWith("Hotovo"))
            navigator.vibrate?.(20);
        }
        return true;
      } catch (err) {
        setError(storageError(err));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  const replace = async (state: State) => {
    setBusy(true);
    setError("");
    try {
      const next = structuredClone(state);
      if (next.households.length) ensurePlans(next, dayOf(next));
      publish(await repo.replace(next));
      setSessionBudget(next.settings[0]?.dailyBudget || 15);
      setModal(null);
      setToast("Údaje sú uložené.");
      navigate("home");
      return true;
    } catch (err) {
      setError(
        storageError(
          err,
          "Obnovenie zlyhalo. Pôvodné údaje zostali zachované.",
        ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const restoreBackup = async (backup: ValidatedBackup) => {
    setBusy(true);
    setError("");
    try {
      const restored = await repo.restore(
        backup.data,
        backup.reminderDays,
        backup.sourceSafety,
      );
      publish(restored);
      setSessionBudget(restored.settings[0]?.dailyBudget || 15);
      setModal(null);
      setToast("Záloha bola obnovená a skontrolovaná.");
      navigate("home");
      return true;
    } catch (err) {
      setError(
        storageError(err, "Obnova zlyhala. Pôvodné údaje zostali zachované."),
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await repo.initialize();
        const next = await repo.transact((state) => {
          if (state.households.length) ensurePlans(state, dayOf(state));
        });
        if (active) {
          setState(next);
          setSafety((await repo.readSnapshot()).safety);
          setSessionBudget(next.settings[0]?.dailyBudget || 15);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setFatal(
            storageError(
              err,
              "Miestne úložisko sa nedá otvoriť. Skontroluj voľné miesto a či prehliadač povoľuje údaje stránok.",
            ),
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    const hash = () => {
      setPage(pageFromHash());
      setModal(null);
    };
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("hashchange", hash);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    if (!s.settings.length) return;
    const preference = s.settings[0].theme;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        preference === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preference);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [s.settings]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("cleanquest-changes")
        : null;
    const reload = () =>
      void repo
        .readSnapshot()
        .then((snapshot) => {
          setState(snapshot.state);
          setSafety(snapshot.safety);
        })
        .catch(() => setError("Údaje sa nepodarilo načítať."));
    if (channel) channel.onmessage = reload;
    return () => channel?.close();
  }, []);
  useEffect(() => {
    if (!s.households.length) return;
    const tick = async () => {
      const latest = await repo.read();
      if (!latest.households.length) return;
      const day = dayOf(latest);
      if (!latest.dailyPlans.some((p) => p.date === day))
        void run((state) => ensurePlans(state, day));
      else setState(latest);
    };
    const timer = setInterval(
      () => void tick().catch(() => setError("Údaje sa nepodarilo obnoviť.")),
      60000,
    );
    const visible = () => {
      if (document.visibilityState === "visible")
        void tick().catch(() => setError("Údaje sa nepodarilo obnoviť."));
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [s.households.length, run]);
  useEffect(() => {
    void refreshStorage();
  }, [safety.revision, refreshStorage]);
  useEffect(() => {
    if (s.households.length)
      void requestPersistentStorage().then(() => refreshStorage());
  }, [s.households.length, refreshStorage]);
  useEffect(() => {
    if (s.households.length && !s.dailyPlans.some((p) => p.date === dayOf(s)))
      void run((state) => ensurePlans(state, dayOf(state)));
  }, [s, run]);
  if (
    loading ||
    (s.households.length && !s.dailyPlans.some((p) => p.date === dayOf(s)))
  )
    return (
      <div className="loading">
        <Leaf />
        <p>Pripravujem tvoj domov…</p>
      </div>
    );
  if (fatal)
    return (
      <main className="loading">
        <p role="alert">{fatal}</p>
        <Button onClick={() => location.reload()}>Skúsiť znova</Button>
      </main>
    );
  if (!s.households.length)
    return (
      <Onboarding
        restore={restoreBackup}
        save={async (state) => {
          await replace(state);
        }}
        error={error}
        busy={busy}
      />
    );
  const level = levelFor(totalXp(s)),
    props = { s, run, open: setModal, sessionBudget };
  const laundry = s.tasks.filter(
    (t) =>
      t.enabled &&
      t.eventAt &&
      Date.parse(t.eventAt) <= Date.now() &&
      t.nextDue <= dayOf(s),
  );
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Preskočiť na obsah
      </a>
      <aside className="sidebar">
        <a className="brand" href="#/home">
          <span>
            <Leaf size={22} />
          </span>
          CleanQuest<small>POKOJ ZAČÍNA DOMA</small>
        </a>
        <div className="sidebar-home">
          <span className="eyebrow">TVOJ DOMOV</span>
          <strong>{s.households[0].name}</strong>
          <small>Každý malý krok sa počíta.</small>
        </div>
        <nav aria-label="Hlavná navigácia">
          {nav.map(([id, label, Icon]) => (
            <a
              key={id}
              href={`#/${id}`}
              aria-current={page === id ? "page" : undefined}
              className={page === id ? "active" : ""}
            >
              <Icon size={20} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">
            {s.profiles[0].displayName.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <strong>
              {s.profiles[0].displayName === "Ty"
                ? "Môj profil"
                : s.profiles[0].displayName}
            </strong>
            <small>
              Úroveň {level.level} · {totalXp(s)} DA ⚡
            </small>
          </div>
          <Leaf size={18} />
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <a className="mobile-brand" href="#/home">
            <Leaf size={20} />
            CleanQuest
          </a>
          <span className="desktop-crumb">
            Tvoj priestor / {nav.find((n) => n[0] === page)?.[1]}
          </span>
          <div>
            <span className="local-dot" />
            {offline ? (
              <>
                <WifiOff size={14} />
                Bez pripojenia
              </>
            ) : (
              "Uložené v zariadení"
            )}
            <span className="level-pill">
              <Zap size={14} />
              Úroveň {level.level}
            </span>
          </div>
        </div>
        <main id="main-content" className="main-content">
          {(needRefresh || offlineReady) && (
            <div className="notice">
              <span>
                {needRefresh
                  ? "Nová verzia CleanQuest je pripravená."
                  : "CleanQuest je pripravený na použitie bez internetu."}
              </span>
              {needRefresh && (
                <Button
                  variant="secondary compact"
                  disabled={busy}
                  onClick={() => void updateServiceWorker(true)}
                >
                  <RefreshCw size={15} />
                  Aktualizovať
                </Button>
              )}
              <Button
                variant="icon ghost"
                aria-label="Zavrieť oznámenie"
                onClick={() => {
                  setNeedRefresh(false);
                  setOfflineReady(false);
                }}
              >
                <X size={16} />
              </Button>
            </div>
          )}
          {!modal && page === "home" && backupReminderDue(safety) && (
            <div className="notice backup-reminder" role="status">
              <span>Údaje sa zmenili. Je vhodný čas uložiť si zálohu.</span>
              <Button
                variant="secondary compact"
                onClick={() => navigate("profile?section=backup")}
              >
                Zálohovať
              </Button>
              <Button
                variant="ghost compact"
                onClick={() =>
                  void repo
                    .updateSafety((meta) => {
                      meta.snoozedUntil = new Date(
                        Date.now() + 7 * 86400000,
                      ).toISOString();
                    })
                    .then(refreshSafety)
                    .catch((err) => setError(storageError(err)))
                }
              >
                O týždeň
              </Button>
              <Button
                variant="icon ghost"
                aria-label="Zavrieť pripomienku zálohy"
                onClick={() =>
                  void repo
                    .updateSafety((meta) => {
                      meta.snoozedUntil = new Date(
                        Date.now() + 86400000,
                      ).toISOString();
                    })
                    .then(refreshSafety)
                    .catch((err) => setError(storageError(err)))
                }
              >
                <X size={16} />
              </Button>
            </div>
          )}
          {!modal && page !== "profile" && storageConstrained(storage) && (
            <div className="notice" role="status">
              <span>
                Úložisko sa zapĺňa. Ulož si zálohu a uvoľni miesto v zariadení.
              </span>
              <Button
                variant="secondary"
                onClick={() => navigate("profile?section=backup")}
              >
                Zálohovanie
              </Button>
            </div>
          )}
          {laundry.length > 0 && page !== "tasks" && (
            <button
              className="laundry-notice"
              onClick={() => navigate("tasks")}
            >
              Pranie má pripravený ďalší krok · {laundry.length}{" "}
              {laundry.length === 1 ? "úloha" : "úlohy"}
            </button>
          )}
          {page === "home" && (
            <>
              <div className="session-selector">
                <span>Dnešný krátky blok</span>
                <select
                  aria-label="Dnešný časový blok"
                  value={sessionBudget}
                  onChange={(e) => setSessionBudget(Number(e.target.value))}
                >
                  {[5, 10, 15, 20, 30].map((n) => (
                    <option value={n} key={n}>
                      {n} min
                    </option>
                  ))}
                </select>
              </div>
              <Dashboard {...props} navigate={navigate} />
            </>
          )}
          {page === "tasks" && <Tasks {...props} />}
          {page === "rewards" && <Rewards {...props} />}
          {page === "ideas" && <Ideas {...props} />}
          {page === "profile" && (
            <Profile
              {...props}
              replace={replace}
              navigate={navigate}
              safety={safety}
              repository={repo}
              refreshSafety={refreshSafety}
              restoreBackup={restoreBackup}
              storage={storage}
              refreshStorage={refreshStorage}
            />
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobilná navigácia">
        {nav.map(([id, label, Icon]) => (
          <a
            key={id}
            href={`#/${id}`}
            aria-current={page === id ? "page" : undefined}
            className={page === id ? "active" : ""}
          >
            <Icon size={21} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      {modal && <Forms key={JSON.stringify(modal)} {...props} modal={modal} />}
      <div className="status-layer" aria-live="polite">
        {toast && (
          <div className="toast">
            <Check size={17} />
            {toast}
          </div>
        )}
      </div>
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <Button
            variant="icon ghost"
            aria-label="Zavrieť chybu"
            onClick={() => setError("")}
          >
            <X size={17} />
          </Button>
        </div>
      )}
      {busy && (
        <div className="saving" role="status">
          Ukladám…
        </div>
      )}
    </div>
  );
}
