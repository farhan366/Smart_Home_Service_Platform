import { useState } from "react";
import api, { errorMessage } from "../api/client";
import usePolling from "../hooks/usePolling";
import { Alert } from "../components/ui";
import ProviderTabs from "../components/booking/ProviderTabs";
import ProviderJobCard from "../components/booking/ProviderJobCard";

const TABS = [
  { key: "new", label: "New requests", match: ["pending"], empty: "No new requests right now." },
  { key: "quoted", label: "Awaiting customer", match: ["quoted"], empty: "No quotations waiting on a customer." },
  { key: "upcoming", label: "Upcoming", match: ["confirmed"], empty: "No confirmed jobs yet." },
  { key: "active", label: "In progress", match: ["in_progress"], empty: "No job is in progress." },
  { key: "history", label: "History", match: ["completed", "cancelled"], empty: "Completed and cancelled jobs will appear here." },
];

export default function ProviderJobs() {
  const [jobs, setJobs] = useState(null);
  const [rate, setRate] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("new");

  usePolling(() => {
    api.get("/provider/bookings").then(({ data }) => { setJobs(data); setError(""); }).catch((e) => setError(errorMessage(e)));
    api.get("/providers/me").then(({ data }) => setRate(data.base_hourly_rate)).catch(() => {});
  }, [], 10000);

  const replace = (updated) => setJobs((js) => (js ?? []).map((j) => (j.id === updated.id ? updated : j)));
  const current = TABS.find((t) => t.key === tab);
  const inTab = (t) => (jobs ?? []).filter((j) => t.match.includes(j.status));
  const list = inTab(current);
  const sorted = tab === "history" ? [...list].sort((a, b) => new Date(b.scheduled_start) - new Date(a.scheduled_start)) : list;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Requests &amp; jobs</h1>
        <p className="text-ink/60">Inspect incoming tasks, send itemised quotations and run jobs through to completion.</p>
      </div>
      <ProviderTabs />
      <Alert>{error}</Alert>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const n = inTab(t).length;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${tab === t.key ? "border-lagoon bg-lagoon text-white" : "border-line bg-white text-ink/75 hover:border-lagoon"}`}>
              {t.label}
              {jobs && n > 0 && <span className={`ml-2 rounded-full px-1.5 text-xs ${tab === t.key ? "bg-white/25" : "bg-lagoon-tint text-lagoon-dark"}`}>{n}</span>}
            </button>
          );
        })}
      </div>

      {jobs === null ? (
        <p className="py-10 text-center text-ink/60">Loading jobs…</p>
      ) : sorted.length === 0 ? (
        <div className="panel py-10 text-center text-ink/60">{current.empty}</div>
      ) : (
        <div className="space-y-4">
          {sorted.map((b) => <ProviderJobCard key={b.id} booking={b} defaultRate={rate} onChanged={replace} />)}
        </div>
      )}
    </main>
  );
}
