import { useState } from "react";
import { Check, Clock, RefreshCw, Zap } from "lucide-react";
import { Dialog, Button, Empty, type ScreenProps } from "./components";
import { dayOf, complete, replaceOccurrence } from "../domain/commands";
import { dailySession } from "../domain/scheduler";
import { TaskLocation } from "./RoomVisual";
export default function Focus({ s, run, open, sessionBudget }: ScreenProps) {
  const [feedback, setFeedback] = useState(false),
    [cycle, setCycle] = useState(60);
  const day = dayOf(s),
    task = dailySession(s, day, sessionBudget)[0];
  return (
    <Dialog title="Len jedna vec" onClose={() => open(null)}>
      {feedback ? (
        <div className="focus">
          <div className="success-circle">
            <Check size={40} />
          </div>
          <h2>Malý krok. Hotovo.</h2>
          <p>Aj toto sa počíta. Pokračuj, iba ak chceš.</p>
          <Button onClick={() => setFeedback(false)}>
            Ponúknuť ďalšiu úlohu
          </Button>
          <Button variant="ghost" onClick={() => open(null)}>
            Na dnes si dám pauzu
          </Button>
        </div>
      ) : task ? (
        <div className="focus">
          <span className="tag">{task.roomName}</span>
          <h2>{task.title}</h2>
          <div className="task-meta">
            <span>
              <Clock size={16} />
              {task.duration} min
            </span>
            <span>
              <Zap size={16} />
              {task.xp} DA
            </span>
          </div>
          <div
            className="focus-detail"
            tabIndex={0}
            role="region"
            aria-label="Pokyny a náhľad miestnosti"
          >
            <p>{task.instructions}</p>
            <TaskLocation s={s} task={task} />
          </div>
          {s.tasks.find((t) => t.id === task.taskId)?.workflow === "wash" && (
            <label className="field">
              Dĺžka pracieho cyklu (minúty)
              <input
                type="number"
                min="1"
                max="600"
                value={cycle}
                onChange={(e) => setCycle(Number(e.target.value))}
              />
            </label>
          )}
          <Button
            onClick={() =>
              void run(
                (state) =>
                  complete(
                    state,
                    task.taskId,
                    "required",
                    task.id,
                    new Date(),
                    cycle,
                  ),
                "Hotovo. Malý krok sa počíta.",
              ).then((ok) => {
                if (ok) setFeedback(true);
              })
            }
          >
            <Check size={22} />
            Mám hotovo
          </Button>
          <div className="actions">
            <Button
              variant="ghost"
              onClick={() =>
                void run(
                  (state) => replaceOccurrence(state, task.id, day),
                  "Úloha bola nahradená.",
                )
              }
            >
              <RefreshCw size={16} />
              Iná úloha
            </Button>
            <Button variant="ghost" onClick={() => open(null)}>
              Skončiť
            </Button>
          </div>
        </div>
      ) : (
        <Empty
          title="Teraz si môžeš vydýchnuť."
          text="V tomto krátkom bloku už nie je ďalšia úloha. Pokračovať môžeš neskôr."
          action={<Button onClick={() => open(null)}>Späť domov</Button>}
        />
      )}
    </Dialog>
  );
}
