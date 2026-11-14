import { useState } from "react";
import { CheckCircle2, FileText, Play, ThumbsUp, XCircle } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Alert } from "../ui";
import QuoteBuilder from "./QuoteBuilder";

export default function ProviderJobActions({ booking, defaultRate, onChanged }) {
  const [mode, setMode] = useState(null); // "quote" | "decline" | "cancel"
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const can = (a) => booking.allowed_actions.includes(a);

  const run = async (path, body) => {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(`/provider/bookings/${booking.id}/${path}`, body ?? {});
      setMode(null);
      setReason("");
      onChanged?.(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (booking.allowed_actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <Alert>{error}</Alert>

      {mode === "quote" && (
        <QuoteBuilder
          booking={booking}
          defaultRate={defaultRate}
          onCancel={() => setMode(null)}
          onSent={(data) => { setMode(null); onChanged?.(data); }}
        />
      )}

      {(mode === "decline" || mode === "cancel") && (
        <div className="space-y-2 rounded-lg border border-line bg-paper p-3">
          <label className="label" htmlFor={`reason-${booking.id}`}>
            {mode === "decline" ? "Reason for declining (shown to the customer)" : "Reason for cancelling (shown to the customer)"}
          </label>
          <textarea id={`reason-${booking.id}`} className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => run(mode, { reason: reason.trim() })}>
              <XCircle size={16} /> Confirm {mode}
            </button>
            <button className="btn-ghost" onClick={() => setMode(null)}>Back</button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="flex flex-wrap gap-2">
          {can("accept") && (
            <>
              <button className="btn-primary" disabled={busy} onClick={() => setMode("quote")}><FileText size={16} /> Accept &amp; send itemised quote</button>
              <button className="btn-ghost" disabled={busy} onClick={() => run("accept")} title="Sends one labour line from your hourly rate">
                <ThumbsUp size={16} /> Accept at standard rate
              </button>
            </>
          )}
          {can("revise_quote") && <button className="btn-ghost" onClick={() => setMode("quote")}><FileText size={16} /> Revise quote</button>}
          {can("start") && <button className="btn-primary" disabled={busy} onClick={() => run("start")}><Play size={16} /> Start job</button>}
          {can("complete") && <button className="btn-primary" disabled={busy} onClick={() => run("complete")}><CheckCircle2 size={16} /> Mark completed</button>}
          {can("decline") && <button className="btn-danger" disabled={busy} onClick={() => setMode("decline")}>Decline</button>}
          {can("cancel") && <button className="btn-danger" disabled={busy} onClick={() => setMode("cancel")}>Cancel job</button>}
        </div>
      )}
    </div>
  );
}
