import { CalendarClock, Lock, MapPin, User } from "lucide-react";
import { taka } from "../ui";
import { complexityLabel, fmtDateTime, fmtTime } from "../../utils/format";
import StatusBadge from "./StatusBadge";
import QuotationPanel from "./QuotationPanel";
import ProviderJobActions from "./ProviderJobActions";

/** One job as the technician sees it: the task description, when/where, the quote, and the next actions. */
export default function ProviderJobCard({ booking: b, defaultRate, onChanged, compact = false }) {
  const revealed = ["confirmed", "in_progress", "completed"].includes(b.status);
  return (
    <article className="panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{b.category?.name ?? "Home service"}</h3>
            <StatusBadge status={b.status} />
            <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-ink/70">{complexityLabel(b.complexity)}</span>
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/65">
            <span className="inline-flex items-center gap-1"><CalendarClock size={14} /> {compact ? `${fmtTime(b.scheduled_start)} – ${fmtTime(b.scheduled_end)}` : fmtDateTime(b.scheduled_start)}</span>
            <span className="inline-flex items-center gap-1"><User size={14} /> {b.customer.full_name}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={14} /> {revealed ? b.address_text : b.service_area}</span>
          </p>
        </div>
        {(b.quoted_amount != null || b.net_amount != null) && (
          <div className="text-right">
            <p className="text-lg font-bold">{taka(b.final_amount ?? b.quoted_amount)}</p>
            {b.net_amount != null && <p className="text-xs text-emerald-700">Net {taka(b.net_amount)}</p>}
          </div>
        )}
      </div>

      <div className="rounded-lg bg-paper px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Task description</p>
        <p className="whitespace-pre-line text-sm">{b.notes}</p>
      </div>

      {!revealed && b.status !== "cancelled" && (
        <p className="flex items-center gap-1.5 text-xs text-ink/50"><Lock size={12} /> Exact address and phone number unlock once the customer accepts your quotation.</p>
      )}
      {revealed && b.customer.phone && <p className="text-sm">Customer phone: <b>{b.customer.phone}</b></p>}
      {b.status === "cancelled" && b.cancel_reason && <p className="text-sm text-danger">Cancelled by the {b.cancelled_by}: {b.cancel_reason}</p>}

      {b.active_quotation && b.status !== "pending" && !compact && <QuotationPanel quote={b.active_quotation} />}
      {b.status === "pending" && b.active_quotation?.status === "rejected" && (
        <p className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger">
          The customer rejected quote v{b.active_quotation.version}: {b.active_quotation.rejection_reason}. You can send a revision.
        </p>
      )}

      <ProviderJobActions booking={b} defaultRate={defaultRate} onChanged={onChanged} />
    </article>
  );
}
