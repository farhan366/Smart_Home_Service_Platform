import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api, { errorMessage } from "../api/client";
import usePolling from "../hooks/usePolling";
import { Alert, taka } from "../components/ui";
import ProviderTabs from "../components/booking/ProviderTabs";
import ProviderJobCard from "../components/booking/ProviderJobCard";
import { addDaysISO, dayLabel, todayISO } from "../utils/format";

export default function ProviderSchedule() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [rate, setRate] = useState(null);
  const [error, setError] = useState("");

  usePolling(() => {
    api.get("/provider/schedule", { params: { date } }).then(({ data: d }) => { setData(d); setError(""); }).catch((e) => setError(errorMessage(e)));
  }, [date], 10000);
  usePolling(() => { api.get("/providers/me").then(({ data: d }) => setRate(d.base_hourly_rate)).catch(() => {}); }, [], 120000);

  const go = (iso) => { setData(null); setDate(iso); };
  const s = data?.summary;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Daily schedule</h1>
        <p className="text-ink/60">Your assigned visits, in order. Start and finish jobs right from here.</p>
      </div>
      <ProviderTabs />
      <Alert>{error}</Alert>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-2.5" onClick={() => go(addDaysISO(date, -1))} aria-label="Previous day"><ChevronLeft size={16} /></button>
          <input type="date" className="input !w-auto" value={date} onChange={(e) => e.target.value && go(e.target.value)} />
          <button className="btn-ghost !px-2.5" onClick={() => go(addDaysISO(date, 1))} aria-label="Next day"><ChevronRight size={16} /></button>
          {date !== todayISO() && <button className="btn-ghost" onClick={() => go(todayISO())}>Today</button>}
        </div>
        {data && <p className="text-sm text-ink/70">Net earned this day: <b className="text-emerald-700">{taka(data.day_net_so_far)}</b></p>}
      </div>

      {data && (
        <div className="grid grid-cols-7 gap-1.5">
          {data.overview.map((d) => (
            <button key={d.date} onClick={() => go(d.date)}
              className={`rounded-lg border p-2 text-center ${d.date === date ? "border-lagoon bg-lagoon-tint" : "border-line bg-white hover:border-lagoon/50"}`}>
              <span className="block text-[11px] font-medium text-ink/60">{dayLabel(d.date)}</span>
              <span className="font-display text-lg font-bold">{d.total}</span>
              {d.pending > 0 && <span className="block text-[10px] font-semibold text-amber-700">{d.pending} to answer</span>}
            </button>
          ))}
        </div>
      )}

      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Visits", s.total], ["Awaiting answer", s.pending], ["Confirmed", s.confirmed], ["In progress / done", `${s.in_progress} / ${s.completed}`]].map(([label, v]) => (
            <div key={label} className="panel !p-3"><p className="text-xs text-ink/55">{label}</p><p className="font-display text-2xl font-bold">{v}</p></div>
          ))}
        </div>
      )}

      {data === null ? (
        <p className="py-10 text-center text-ink/60">Loading schedule…</p>
      ) : data.bookings.length === 0 ? (
        <div className="panel py-10 text-center text-ink/60">No visits scheduled for {dayLabel(date)}.</div>
      ) : (
        <div className="space-y-4">
          {data.bookings.map((b) => (
            <ProviderJobCard key={b.id} booking={b} compact defaultRate={rate}
              onChanged={(u) => setData((d) => ({ ...d, bookings: d.bookings.map((x) => (x.id === u.id ? u : x)) }))} />
          ))}
        </div>
      )}
    </main>
  );
}
