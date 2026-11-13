import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, MapPin, Phone, User, XCircle } from "lucide-react";
import api, { errorMessage } from "../api/client";
import usePolling from "../hooks/usePolling";
import { Alert, taka } from "../components/ui";
import StatusBadge from "../components/booking/StatusBadge";
import StatusTimeline from "../components/booking/StatusTimeline";
import QuotationPanel from "../components/booking/QuotationPanel";
import { complexityLabel, fmtDateTime } from "../utils/format";

export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  usePolling(() => {
    api.get(`/bookings/${id}`)
      .then(({ data }) => { setBooking(data); setError(""); })
      .catch((e) => setError(errorMessage(e)));
  }, [id], 8000);

  const act = async (path, body) => {
    setBusy(true);
    setActionError("");
    try {
      const { data } = await api.post(`/bookings/${id}/${path}`, body ?? {});
      setBooking(data);
      setCancelling(false);
      setReason("");
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (error && !booking) {
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 py-16 text-center">
        <Alert>{error}</Alert>
        <Link to="/bookings" className="btn-ghost"><ArrowLeft size={14} /> My bookings</Link>
      </main>
    );
  }
  if (!booking) return <p className="p-10 text-center text-ink/60">Loading booking…</p>;

  const can = (a) => booking.allowed_actions.includes(a);
  const quote = booking.active_quotation;
  const revealed = ["confirmed", "in_progress", "completed"].includes(booking.status);

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link to="/bookings" className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"><ArrowLeft size={14} /> My bookings</Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{booking.category?.name ?? "Home service"}</h1>
          <p className="text-ink/60">Booking #{booking.id} · {complexityLabel(booking.complexity)} job</p>
        </div>
        <StatusBadge status={booking.status} />
      </header>

      <section className="panel"><StatusTimeline status={booking.status} events={booking.events} /></section>

      {booking.status === "pending" && <Alert kind="info">Waiting for {booking.provider.full_name} to review your request and send an itemised quote.</Alert>}
      {booking.status === "cancelled" && booking.cancel_reason && (
        <Alert>Cancelled by the {booking.cancelled_by}: {booking.cancel_reason}</Alert>
      )}

      {quote && (
        <QuotationPanel
          quote={quote}
          busy={busy}
          error={actionError}
          onAccept={can("accept_quote") ? () => act("quotation/accept") : undefined}
          onReject={can("reject_quote") ? (r) => act("quotation/reject", { reason: r }) : undefined}
        />
      )}

      <section className="panel grid gap-4 text-sm sm:grid-cols-2">
        <div className="flex gap-2"><CalendarClock size={16} className="mt-0.5 text-lagoon" /><div><p className="text-xs text-ink/50">Scheduled</p><p className="font-medium">{fmtDateTime(booking.scheduled_start)}</p></div></div>
        <div className="flex gap-2"><MapPin size={16} className="mt-0.5 text-lagoon" /><div><p className="text-xs text-ink/50">Address</p><p className="font-medium">{booking.address_text ?? booking.service_area}</p></div></div>
        <div className="flex gap-2"><User size={16} className="mt-0.5 text-lagoon" /><div><p className="text-xs text-ink/50">Technician</p><p className="font-medium">{booking.provider.full_name}</p><p className="text-ink/60">{booking.provider.headline}</p></div></div>
        <div className="flex gap-2"><Phone size={16} className="mt-0.5 text-lagoon" /><div><p className="text-xs text-ink/50">Contact</p><p className="font-medium">{revealed ? booking.provider.phone ?? "Not provided" : "Shared once you confirm the quote"}</p></div></div>
        <div className="sm:col-span-2"><p className="text-xs text-ink/50">Your description</p><p className="whitespace-pre-line">{booking.notes}</p></div>
        {booking.final_amount != null && <div className="sm:col-span-2 border-t border-line pt-3"><p className="text-xs text-ink/50">Amount payable</p><p className="text-xl font-bold">{taka(booking.final_amount)}</p></div>}
      </section>

      {can("cancel") && (
        <section className="space-y-2">
          {cancelling ? (
            <div className="panel space-y-2">
              <label className="label" htmlFor="cr">Reason for cancelling</label>
              <textarea id="cr" className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              <Alert>{actionError}</Alert>
              <div className="flex gap-2">
                <button className="btn-danger" disabled={busy || reason.trim().length < 3} onClick={() => act("cancel", { reason: reason.trim() })}><XCircle size={16} /> Cancel booking</button>
                <button className="btn-ghost" onClick={() => setCancelling(false)}>Keep booking</button>
              </div>
            </div>
          ) : (
            <button className="btn-danger" onClick={() => setCancelling(true)}>Cancel booking</button>
          )}
        </section>
      )}
    </main>
  );
}
