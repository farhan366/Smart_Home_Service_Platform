import { useState } from "react";
import { Check, X } from "lucide-react";
import { Alert, taka } from "../ui";
import { fmtDateTime } from "../../utils/format";

const STATE_STYLE = {
  submitted: "bg-sky-50 text-sky-800",
  accepted: "bg-emerald-50 text-emerald-800",
  rejected: "bg-red-50 text-danger",
  withdrawn: "bg-slate-100 text-slate-600",
  expired: "bg-amber-50 text-amber-800",
};

/** Itemised labour / material estimate. Shows accept/reject only when `onAccept`/`onReject` are given. */
export default function QuotationPanel({ quote, onAccept, onReject, busy, error }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  if (!quote) return null;

  const rows = (type) => quote.items.filter((i) => i.item_type === type);
  const Section = ({ title, type, total }) =>
    rows(type).length > 0 && (
      <>
        <tr className="bg-paper text-xs font-semibold uppercase tracking-wide text-ink/60">
          <td className="px-3 py-1.5" colSpan={3}>{title}</td>
          <td className="px-3 py-1.5 text-right">{taka(total)}</td>
        </tr>
        {rows(type).map((i) => (
          <tr key={i.id} className="border-t border-line/60">
            <td className="px-3 py-2">{i.description}</td>
            <td className="px-3 py-2 text-right text-ink/70">{Number(i.quantity)} {i.unit}</td>
            <td className="px-3 py-2 text-right text-ink/70">{taka(i.unit_price)}</td>
            <td className="px-3 py-2 text-right font-medium">{taka(i.line_total)}</td>
          </tr>
        ))}
      </>
    );

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Quotation <span className="text-ink/50">v{quote.version}</span></h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATE_STYLE[quote.status]}`}>{quote.status}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink/50">
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <Section title="Labour" type="labor" total={quote.labor_total} />
            <Section title="Materials" type="material" total={quote.material_total} />
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink/20">
              <td className="px-3 py-2.5 font-semibold" colSpan={3}>Total estimate</td>
              <td className="px-3 py-2.5 text-right text-base font-bold">{taka(quote.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {quote.note && <p className="rounded-lg bg-paper px-3 py-2 text-sm text-ink/80">“{quote.note}”</p>}
      {quote.status === "submitted" && <p className="text-xs text-ink/55">Valid until {fmtDateTime(quote.valid_until)}</p>}
      {quote.status === "rejected" && quote.rejection_reason && <p className="text-sm text-danger">Rejected: {quote.rejection_reason}</p>}

      <Alert>{error}</Alert>

      {quote.status === "submitted" && onAccept && (
        rejecting ? (
          <div className="space-y-2">
            <label className="label" htmlFor="rej">Why are you rejecting this quote? (the technician can send a revision)</label>
            <textarea id="rej" className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Material cost looks high" />
            <div className="flex gap-2">
              <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => onReject(reason.trim())}>
                <X size={16} /> Reject quotation
              </button>
              <button className="btn-ghost" onClick={() => setRejecting(false)}>Back</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={onAccept}><Check size={16} /> Accept &amp; confirm booking</button>
            <button className="btn-ghost" disabled={busy} onClick={() => setRejecting(true)}>Reject</button>
          </div>
        )
      )}
    </section>
  );
}
