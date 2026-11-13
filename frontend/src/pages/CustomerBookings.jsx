import { useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, CalendarClock, ChevronRight, MapPin, Plus } from "lucide-react";
import api, { errorMessage } from "../api/client";
import usePolling from "../hooks/usePolling";
import { Alert, taka } from "../components/ui";
import StatusBadge from "../components/booking/StatusBadge";
import { fmtDateTime } from "../utils/format";

const TABS = [
  { key: "active", label: "Active", match: ["pending", "quoted", "confirmed", "in_progress"] },
  { key: "done", label: "Completed", match: ["completed"] },
  { key: "cancelled", label: "Cancelled", match: ["cancelled"] },
];

export default function CustomerBookings() {
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("active");

  // Short-poll so provider actions (quote sent, job started...) appear without a refresh.
  usePolling(() => {
    api.get("/bookings")
      .then(({ data }) => { setBookings(data); setError(""); })
      .catch((e) => setError(errorMessage(e)));
  }, [], 10000);

  const current = TABS.find((t) => t.key === tab);
  const list = (bookings ?? []).filter((b) => current.match.includes(b.status));
  const awaitingYou = (bookings ?? []).filter((b) => b.status === "quoted").length;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">My bookings</h1>
          <p className="text-ink/60">Track every request from quote to completion.</p>
        </div>
        <Link to="/book" className="btn-primary"><Plus size={16} /> New booking</Link>
      </div>

      {awaitingYou > 0 && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900">
          {awaitingYou} quotation{awaitingYou > 1 ? "s are" : " is"} waiting for your decision.
        </div>
      )}
      <Alert>{error}</Alert>

      <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-line" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.key ? "bg-lagoon text-white" : "text-ink/70 hover:bg-lagoon-tint"}`}>
            {t.label} {bookings && <span className="opacity-70">({bookings.filter((b) => t.match.includes(b.status)).length})</span>}
          </button>
        ))}
      </div>

      {bookings === null ? (
        <p className="py-10 text-center text-ink/60">Loading your bookings…</p>
      ) : list.length === 0 ? (
        <div className="panel space-y-2 py-10 text-center">
          <Briefcase className="mx-auto text-ink/30" />
          <p className="font-medium">Nothing here yet.</p>
          <Link to="/book" className="btn-primary">Book a service</Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((b) => (
            <li key={b.id}>
              <Link to={`/bookings/${b.id}`} className="panel flex items-center gap-4 transition-colors hover:border-lagoon">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{b.category?.name ?? "Home service"}</h2>
                    <StatusBadge status={b.status} />
                  </div>
                  <p className="text-sm text-ink/70">{b.provider.headline || b.provider.full_name}</p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
                    <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> {fmtDateTime(b.scheduled_start)}</span>
                    <span className="inline-flex items-center gap-1"><MapPin size={13} /> {b.service_area}</span>
                  </p>
                </div>
                <div className="text-right">
                  {b.status === "quoted" ? (
                    <span className="text-sm font-semibold text-sky-700">Review quote {taka(b.quoted_amount)}</span>
                  ) : (b.final_amount ?? b.quoted_amount) != null ? (
                    <span className="text-base font-bold">{taka(b.final_amount ?? b.quoted_amount)}</span>
                  ) : (
                    <span className="text-xs text-ink/50">Awaiting quote</span>
                  )}
                </div>
                <ChevronRight className="text-ink/30" size={18} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
