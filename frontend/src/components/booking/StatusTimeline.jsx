import { Check } from "lucide-react";
import { fmtDateTime } from "../../utils/format";
import { STATUS_LABEL } from "./StatusBadge";

const STEPS = ["pending", "quoted", "confirmed", "in_progress", "completed"];

/** Progress stepper + the audit trail of every status change. */
export default function StatusTimeline({ status, events = [] }) {
  const cancelled = status === "cancelled";
  const current = STEPS.indexOf(status);

  return (
    <div className="space-y-4">
      {cancelled ? (
        <div className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm font-medium text-danger">This booking was cancelled.</div>
      ) : (
        <ol className="flex items-center">
          {STEPS.map((s, i) => {
            const done = i < current || status === "completed";
            const active = i === current && status !== "completed";
            return (
              <li key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full border text-xs font-bold ${
                      done ? "border-lagoon bg-lagoon text-white" : active ? "border-lagoon bg-white text-lagoon ring-4 ring-lagoon/15" : "border-line bg-white text-ink/40"
                    }`}
                  >
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className={`text-[11px] font-medium ${active || done ? "text-ink" : "text-ink/40"}`}>{STATUS_LABEL[s]}</span>
                </div>
                {i < STEPS.length - 1 && <span className={`mx-1 mb-5 h-0.5 flex-1 ${i < current ? "bg-lagoon" : "bg-line"}`} />}
              </li>
            );
          })}
        </ol>
      )}

      {events.length > 0 && (
        <ul className="space-y-2 border-t border-line pt-3">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-lagoon" />
              <div>
                <p className="font-medium">
                  {STATUS_LABEL[e.to_status] ?? e.to_status}
                  <span className="ml-2 text-xs font-normal capitalize text-ink/50">by {e.actor_role}</span>
                </p>
                {e.note && <p className="text-ink/70">{e.note}</p>}
                <p className="text-xs text-ink/45">{fmtDateTime(e.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
