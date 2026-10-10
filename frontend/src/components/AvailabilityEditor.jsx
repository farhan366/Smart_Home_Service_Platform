import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert } from "./ui";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const hhmm = (t) => t.slice(0, 5);

export default function AvailabilityEditor() {
  const [rules, setRules] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    api.get("/providers/me/availability")
      .then(({ data }) => setRules(data.map((r) => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) }))))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const update = (idx, patch) => setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const add = (day) => setRules((rs) => [...rs, { day_of_week: day, start_time: "09:00", end_time: "17:00", slot_minutes: 60, is_available: true }]);
  const remove = (idx) => setRules((rs) => rs.filter((_, i) => i !== idx));

  const save = async () => {
    setError(""); setSaved("");
    try {
      const body = { rules: rules.map(({ day_of_week, start_time, end_time, slot_minutes, is_available }) => ({ day_of_week, start_time, end_time, slot_minutes: Number(slot_minutes), is_available })) };
      const { data } = await api.put("/providers/me/availability", body);
      setRules(data.map((r) => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) })));
      setSaved("Weekly schedule saved.");
    } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <section className="panel space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Weekly availability</h3>
        <p className="text-sm text-ink/60">Set the hours you work each week. Customers see the open slots generated from these windows.</p>
      </div>
      <Alert>{error}</Alert>
      <Alert kind="ok">{saved}</Alert>
      <div className="space-y-3">
        {DAYS.map((name, day) => {
          const dayRules = rules.map((r, idx) => ({ r, idx })).filter(({ r }) => r.day_of_week === day);
          return (
            <div key={name} className="grid gap-2 border-b border-line pb-3 last:border-0 sm:grid-cols-[110px_1fr]">
              <p className="pt-2 text-sm font-semibold">{name}</p>
              <div className="space-y-2">
                {dayRules.length === 0 && <p className="pt-2 text-sm text-ink/50">Not working</p>}
                {dayRules.map(({ r, idx }) => (
                  <div key={idx} className="flex flex-wrap items-center gap-2">
                    <input type="time" aria-label={`${name} start`} className="input w-auto" value={r.start_time} onChange={(e) => update(idx, { start_time: e.target.value })} />
                    <span className="text-sm text-ink/50">to</span>
                    <input type="time" aria-label={`${name} end`} className="input w-auto" value={r.end_time} onChange={(e) => update(idx, { end_time: e.target.value })} />
                    <select aria-label={`${name} slot length`} className="input w-auto" value={r.slot_minutes} onChange={(e) => update(idx, { slot_minutes: e.target.value })}>
                      {[30, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} min slots</option>)}
                    </select>
                    <label className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={r.is_available} onChange={(e) => update(idx, { is_available: e.target.checked })} /> Open
                    </label>
                    <button type="button" aria-label="Remove window" className="text-ink/40 hover:text-danger" onClick={() => remove(idx)}><Trash2 size={16} /></button>
                  </div>
                ))}
                <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-lagoon hover:underline" onClick={() => add(day)}><Plus size={14} /> Add hours</button>
              </div>
            </div>
          );
        })}
      </div>
      <button className="btn-primary" onClick={save}>Save schedule</button>
    </section>
  );
}
