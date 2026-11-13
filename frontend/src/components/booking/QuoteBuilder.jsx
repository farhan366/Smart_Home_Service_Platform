import { useMemo, useState } from "react";
import { Plus, Send, Trash2 } from "lucide-react";
import api, { errorMessage } from "../../api/client";
import { Alert, taka } from "../ui";

const HOURS_BY_COMPLEXITY = { 1: 1, 2: 2, 3: 4 };
const blank = (item_type) =>
  item_type === "labor"
    ? { item_type, description: "", quantity: 1, unit: "hr", unit_price: "" }
    : { item_type, description: "", quantity: 1, unit: "pcs", unit_price: "" };

const line = (r) => (Number(r.quantity) || 0) * (Number(r.unit_price) || 0);

/** Itemised labour + material estimate editor. Pre-fills from the standard hourly rate, or from the
 *  previous quotation when revising. */
export default function QuoteBuilder({ booking, defaultRate, onSent, onCancel }) {
  const previous = booking.active_quotation;
  const [rows, setRows] = useState(() =>
    previous
      ? previous.items.map((i) => ({ item_type: i.item_type, description: i.description, quantity: Number(i.quantity), unit: i.unit, unit_price: Number(i.unit_price) }))
      : [{ ...blank("labor"), description: "Service labour", quantity: HOURS_BY_COMPLEXITY[booking.complexity] ?? 2, unit_price: defaultRate ? Number(defaultRate) : "" }]
  );
  const [note, setNote] = useState(previous?.note ?? "");
  const [validHours, setValidHours] = useState(48);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    const sum = (t) => rows.filter((r) => r.item_type === t).reduce((a, r) => a + line(r), 0);
    return { labor: sum("labor"), material: sum("material") };
  }, [rows]);
  const total = totals.labor + totals.material;

  const update = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!rows.some((r) => r.item_type === "labor")) return setError("Add at least one labour line.");
    if (rows.some((r) => r.description.trim().length < 3)) return setError("Every line needs a description (3+ characters).");
    if (rows.some((r) => !(Number(r.quantity) > 0) || r.unit_price === "" || Number(r.unit_price) < 0)) return setError("Check quantities and prices.");
    if (total <= 0) return setError("The total must be greater than zero.");
    setBusy(true);
    try {
      const body = {
        items: rows.map((r) => ({ ...r, description: r.description.trim(), quantity: Number(r.quantity), unit_price: Number(r.unit_price), unit: r.unit.trim() || "pcs" })),
        note: note.trim() || null,
        valid_hours: Number(validHours),
      };
      const { data } = await api.post(`/provider/bookings/${booking.id}/quotation`, body);
      onSent(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const group = (type, title) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setRows((rs) => [...rs, blank(type)])}>
          <Plus size={14} /> Add {type === "labor" ? "labour" : "material"}
        </button>
      </div>
      {rows.map((r, i) =>
        r.item_type !== type ? null : (
          <div key={i} className="grid grid-cols-12 items-center gap-2">
            <input className="input col-span-12 sm:col-span-5" placeholder={type === "labor" ? "e.g. AC gas charging" : "e.g. Capacitor 35µF"} value={r.description} onChange={(e) => update(i, { description: e.target.value })} aria-label="Description" />
            <input className="input col-span-3 sm:col-span-2" type="number" min="0.01" step="0.01" value={r.quantity} onChange={(e) => update(i, { quantity: e.target.value })} aria-label="Quantity" />
            <input className="input col-span-3 sm:col-span-1 !px-2" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} aria-label="Unit" />
            <input className="input col-span-4 sm:col-span-2" type="number" min="0" step="1" placeholder="৳ price" value={r.unit_price} onChange={(e) => update(i, { unit_price: e.target.value })} aria-label="Unit price" />
            <span className="col-span-1 text-right text-sm font-medium sm:col-span-1">{taka(line(r))}</span>
            <button type="button" className="col-span-1 justify-self-end text-ink/40 hover:text-danger" onClick={() => remove(i)} aria-label="Remove line"><Trash2 size={16} /></button>
          </div>
        )
      )}
      {!rows.some((r) => r.item_type === type) && <p className="text-xs text-ink/50">{type === "material" ? "No materials. Add parts you will supply." : "Add at least one labour line."}</p>}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-lagoon/30 bg-lagoon-tint/40 p-4">
      <h3 className="font-semibold">{previous ? `Revise quotation (v${previous.version + 1})` : "Itemised estimate"}</h3>
      <Alert>{error}</Alert>
      {group("labor", "Labour")}
      {group("material", "Materials")}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="qnote">Note to customer (optional)</label>
          <input id="qnote" className="input" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Warranty, what's included, parts brand…" />
        </div>
        <div>
          <label className="label" htmlFor="qvalid">Valid for</label>
          <select id="qvalid" className="input" value={validHours} onChange={(e) => setValidHours(e.target.value)}>
            <option value={12}>12 hours</option>
            <option value={24}>24 hours</option>
            <option value={48}>48 hours</option>
            <option value={72}>3 days</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-sm text-ink/70">
          Labour <b>{taka(totals.labor)}</b> + Materials <b>{taka(totals.material)}</b> = <span className="text-lg font-bold text-ink">{taka(total)}</span>
        </p>
        <div className="flex gap-2">
          <button type="button" className="btn-ghost" onClick={onCancel}>Close</button>
          <button className="btn-primary" disabled={busy}><Send size={16} /> {busy ? "Sending…" : "Send to customer"}</button>
        </div>
      </div>
    </form>
  );
}
