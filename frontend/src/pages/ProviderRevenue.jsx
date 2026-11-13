import { useState } from "react";
import api, { errorMessage } from "../api/client";
import usePolling from "../hooks/usePolling";
import { Alert, taka } from "../components/ui";
import ProviderTabs from "../components/booking/ProviderTabs";
import { dayLabel, todayISO } from "../utils/format";

function Stat({ label, value, sub, tone }) {
  return (
    <div className="panel !p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/50">{label}</p>
      <p className={`font-display text-2xl font-bold ${tone ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-ink/55">{sub}</p>}
    </div>
  );
}

function Bars({ points, labelOf, valueOf, height = 140 }) {
  const max = Math.max(1, ...points.map(valueOf));
  return (
    <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: height + 28 }}>
      {points.map((p, i) => {
        const v = valueOf(p);
        return (
          <div key={i} className="flex min-w-[18px] flex-1 flex-col items-center justify-end gap-1" title={`${labelOf(p)}: ${taka(v)}`}>
            <div className={`w-full rounded-t ${v > 0 ? "bg-lagoon" : "bg-line"}`} style={{ height: Math.max(3, (v / max) * height) }} />
            <span className="text-[10px] text-ink/50">{labelOf(p)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProviderRevenue() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  usePolling(() => {
    api.get("/provider/revenue", { params: { month } }).then(({ data: d }) => { setData(d); setError(""); }).catch((e) => setError(errorMessage(e)));
  }, [month], 30000);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Revenue</h1>
          <p className="text-ink/60">Net = job value minus the {data?.commission_percent ?? 10}% platform commission, settled when you mark a job completed.</p>
        </div>
        <div>
          <label className="label" htmlFor="m">Month</label>
          <input id="m" type="month" className="input" max={todayISO().slice(0, 7)} value={month} onChange={(e) => e.target.value && (setData(null), setMonth(e.target.value))} />
        </div>
      </div>
      <ProviderTabs />
      <Alert>{error}</Alert>

      {!data ? (
        <p className="py-10 text-center text-ink/60">Loading revenue…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Net today" value={taka(data.today.net)} sub={`${data.today.jobs} job${data.today.jobs === 1 ? "" : "s"} · gross ${taka(data.today.gross)}`} tone="text-emerald-700" />
            <Stat label={`Net ${data.month_label}`} value={taka(data.month.net)} sub={`${data.month.jobs} jobs completed`} tone="text-emerald-700" />
            <Stat label="Gross / fees" value={taka(data.month.gross)} sub={`Platform fee ${taka(data.month.platform_fee)}`} />
            <Stat label="Average job" value={taka(data.average_ticket)} sub="Per completed job" />
          </div>

          <div className="panel flex flex-wrap items-center justify-between gap-2 !bg-lagoon-tint/50">
            <div>
              <p className="text-sm font-semibold">Pipeline: confirmed &amp; in-progress work</p>
              <p className="text-xs text-ink/60">Earned once the jobs are marked completed.</p>
            </div>
            <p className="text-right text-sm">Gross <b>{taka(data.pipeline_gross)}</b> · Expected net <b className="text-emerald-700">{taka(data.pipeline_net)}</b></p>
          </div>

          <section className="panel space-y-3">
            <h2 className="text-lg font-semibold">Daily net · {data.month_label}</h2>
            {data.daily.length === 0 ? <p className="text-sm text-ink/60">No days to show for this month yet.</p> : (
              <Bars points={data.daily} valueOf={(p) => Number(p.net)} labelOf={(p) => String(Number(p.date.slice(8)))} />
            )}
          </section>

          <section className="panel space-y-3">
            <h2 className="text-lg font-semibold">Last 6 months</h2>
            <Bars points={data.monthly} valueOf={(p) => Number(p.net)} labelOf={(p) => p.month.slice(2)} height={120} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-ink/50"><th className="py-1 font-medium">Month</th><th className="text-right font-medium">Jobs</th><th className="text-right font-medium">Gross</th><th className="text-right font-medium">Fee</th><th className="text-right font-medium">Net</th></tr></thead>
                <tbody>
                  {[...data.monthly].reverse().map((m) => (
                    <tr key={m.month} className="border-t border-line/60">
                      <td className="py-1.5">{m.month}</td><td className="text-right">{m.jobs}</td><td className="text-right">{taka(m.gross)}</td><td className="text-right text-ink/60">{taka(m.platform_fee)}</td><td className="text-right font-semibold">{taka(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel space-y-2">
            <h2 className="text-lg font-semibold">Days with earnings</h2>
            {data.daily.filter((d) => d.jobs > 0).length === 0 ? <p className="text-sm text-ink/60">No completed jobs this month.</p> : (
              <ul className="divide-y divide-line/60 text-sm">
                {[...data.daily].reverse().filter((d) => d.jobs > 0).map((d) => (
                  <li key={d.date} className="flex justify-between py-1.5"><span>{dayLabel(d.date)} · {d.jobs} job{d.jobs > 1 ? "s" : ""}</span><span className="font-semibold">{taka(d.net)}</span></li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
