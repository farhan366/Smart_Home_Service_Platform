import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, CalendarClock, Clock, MapPin, Search, Sparkles, Timer } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert, Rating, taka } from "../components/ui";
import { COMPLEXITY, addDaysISO, dayLabel, fmtDateTime, fmtTime, todayISO } from "../utils/format";

const PCT = (v) => `${Math.round(v * 100)}%`;
const FACTORS = [
  ["proximity", "Area proximity"],
  ["rating", "Rating"],
  ["capability", "Experience & credentials"],
  ["price", "Price"],
  ["availability", "Availability"],
];

function flattenCategories(tree) {
  const out = [];
  tree.forEach((root) => {
    out.push({ id: root.id, label: root.name, root: true });
    (root.children ?? []).forEach((c) => out.push({ id: c.id, label: `${root.name} › ${c.name}` }));
  });
  return out;
}

function MatchCard({ m, onChoose }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="panel space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-lagoon font-display text-sm font-bold text-white">#{m.rank}</span>
          <div>
            <h3 className="text-lg font-semibold leading-tight">{m.headline || m.full_name}</h3>
            <p className="text-sm text-ink/60">{m.full_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Rating value={m.avg_rating} count={m.rating_count} />
              {m.is_credential_verified && <span className="inline-flex items-center gap-1 text-xs font-semibold text-lagoon-dark"><BadgeCheck size={14} /> Verified</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-ink/50">Match score</p>
          <p className="font-display text-3xl font-bold text-lagoon">{Math.round(m.score)}</p>
        </div>
      </div>

      <ul className="grid gap-1 text-sm text-ink/80 sm:grid-cols-2">
        {m.reasons.map((r) => <li key={r} className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-marigold" />{r}</li>)}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="text-sm">
          <span className="text-ink/60">Indicative price </span>
          <b>{taka(m.estimated_price)}</b>
          <span className="text-ink/50"> ({taka(m.hourly_rate)}/hr · ~{m.estimated_hours} hr)</span>
          <p className="text-xs text-ink/50">Final price is the itemised quotation you approve before work starts.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Why this score?"}</button>
          <button className="btn-primary" onClick={() => onChoose(m.provider_id, m.full_name)}>Choose &amp; pick a time</button>
        </div>
      </div>

      {open && (
        <div className="space-y-2 rounded-lg bg-paper p-3">
          {FACTORS.map(([k, label]) => (
            <div key={k} className="flex items-center gap-3 text-xs">
              <span className="w-40 text-ink/70">{label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-lagoon" style={{ width: PCT(m.breakdown[k]) }} /></span>
              <span className="w-10 text-right font-medium">{PCT(m.breakdown[k])}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default function BookService() {
  const { providerId: directId } = useParams();
  const navigate = useNavigate();

  const [tree, setTree] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [direct, setDirect] = useState(null); // provider chosen from a profile page

  const [categoryId, setCategoryId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [complexity, setComplexity] = useState(2);
  const [preferredDate, setPreferredDate] = useState("");
  const [matches, setMatches] = useState(null);
  const [matching, setMatching] = useState(false);

  const [chosen, setChosen] = useState(null); // { id, name }
  const [days, setDays] = useState([]);
  const [dayIdx, setDayIdx] = useState(0);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [lock, setLock] = useState(null); // { id, start, end, expiresAt }
  const [now, setNow] = useState(Date.now());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const booked = useRef(false);
  const lockRef = useRef(null);
  lockRef.current = lock;

  // Reference data
  useEffect(() => {
    api.get("/services/categories").then(({ data }) => setTree(data)).catch((e) => setError(errorMessage(e)));
    api.get("/addresses").then(({ data }) => {
      setAddresses(data);
      const def = data.find((a) => a.is_default) ?? data[0];
      if (def) setAddressId(String(def.id));
    }).catch((e) => setError(errorMessage(e)));
  }, []);

  // Direct booking from a provider profile: skip matching and offer only what they do.
  useEffect(() => {
    if (!directId) return;
    api.get(`/providers/${directId}`)
      .then(({ data }) => {
        setDirect(data);
        setChosen({ id: data.id, name: data.headline || data.full_name });
        if (data.specialties?.length) setCategoryId(String(data.specialties[0].category_id));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [directId]);

  const categories = useMemo(() => {
    const all = flattenCategories(tree);
    if (!direct) return all;
    const mine = new Set(direct.specialties.map((s) => s.category_id));
    return all.filter((c) => mine.has(c.id));
  }, [tree, direct]);

  // Countdown for the held slot
  useEffect(() => {
    if (!lock) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lock]);
  const secondsLeft = lock ? Math.max(0, Math.round((lock.expiresAt - now) / 1000)) : 0;
  const lockExpired = lock && secondsLeft === 0;

  // Release an unused hold when leaving the page.
  useEffect(() => () => {
    if (lockRef.current && !booked.current) api.delete(`/bookings/slot-locks/${lockRef.current.id}`).catch(() => {});
  }, []);

  const loadSlots = useCallback(async (pid) => {
    setLoadingSlots(true);
    setError("");
    try {
      const start = preferredDate || todayISO();
      const { data } = await api.get(`/providers/${pid}/slots`, { params: { start_date: start, days: 7 } });
      setDays(data);
      const first = data.findIndex((d) => d.slots.length > 0);
      setDayIdx(first === -1 ? 0 : first);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingSlots(false);
    }
  }, [preferredDate]);

  useEffect(() => {
    if (chosen) loadSlots(chosen.id);
  }, [chosen, loadSlots]);

  const findMatches = async (e) => {
    e.preventDefault();
    if (direct) return; // booking a specific technician: nothing to match
    setError("");
    setMatching(true);
    setMatches(null);
    setChosen(null);
    setLock(null);
    try {
      const params = { category_id: categoryId, address_id: addressId, complexity };
      if (preferredDate) params.preferred_date = preferredDate;
      const { data } = await api.get("/matching/recommendations", { params });
      setMatches(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setMatching(false);
    }
  };

  const choose = (id, name) => {
    setChosen({ id, name });
    setLock(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const holdSlot = async (slot) => {
    setError("");
    try {
      const { data } = await api.post("/bookings/slot-locks", { provider_id: chosen.id, start: slot.start, end: slot.end });
      setLock({ id: data.id, start: data.start_at, end: data.end_at, expiresAt: Date.now() + data.seconds_left * 1000 });
      setNow(Date.now());
    } catch (err) {
      setLock(null);
      setError(errorMessage(err));
      loadSlots(chosen.id); // someone else may have just taken it: refresh what is free
    }
  };

  const confirm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/bookings", {
        provider_id: chosen.id, category_id: Number(categoryId), address_id: Number(addressId),
        slot_lock_id: lock.id, notes, complexity,
      });
      booked.current = true;
      navigate(`/bookings/${data.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      loadSlots(chosen.id);
    } finally {
      setSubmitting(false);
    }
  };

  const noAddress = addresses.length === 0;
  const activeDay = days[dayIdx];
  const mmss = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-ink/60 hover:text-ink"><ArrowLeft size={14} /> Back</Link>
        <h1 className="mt-2 text-3xl font-bold">{direct ? `Book ${direct.headline || direct.full_name}` : "Book a service"}</h1>
        <p className="text-ink/60">{direct ? "Choose the service, your address and a time. The technician will confirm with an itemised quote." : "Tell us the job and we'll rank the best available technicians near you."}</p>
      </div>

      <Alert>{error}</Alert>

      {/* 1. The job */}
      <form onSubmit={findMatches} className="panel space-y-4">
        <h2 className="text-lg font-semibold">1. Describe the job</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cat">Service</label>
            <select id="cat" className="input" required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select a service…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="addr">Where should the technician come?</label>
            {noAddress ? (
              <p className="rounded-lg border border-marigold/50 bg-marigold-tint px-3 py-2 text-sm">
                You have no saved address. <Link to="/account/addresses" className="font-semibold underline">Add one</Link> first.
              </p>
            ) : (
              <select id="addr" className="input" required value={addressId} onChange={(e) => setAddressId(e.target.value)}>
                {addresses.map((a) => <option key={a.id} value={a.id}>{a.title}: {a.street}, {a.area}</option>)}
              </select>
            )}
          </div>
        </div>

        <fieldset>
          <legend className="label">How complex is the job?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {COMPLEXITY.map((c) => (
              <label key={c.value} className={`cursor-pointer rounded-lg border p-3 text-sm ${complexity === c.value ? "border-lagoon bg-lagoon-tint" : "border-line bg-white hover:border-lagoon/50"}`}>
                <input type="radio" name="complexity" className="sr-only" checked={complexity === c.value} onChange={() => setComplexity(c.value)} />
                <span className="block font-semibold">{c.label}</span>
                <span className="text-xs text-ink/60">{c.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label className="label" htmlFor="pd">Preferred date (optional)</label>
            <input id="pd" type="date" className="input" min={todayISO()} max={addDaysISO(todayISO(), 60)} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} />
          </div>
          {!direct && (
            <button className="btn-primary" disabled={matching || noAddress || !categoryId}><Search size={16} /> {matching ? "Matching…" : "Find best technicians"}</button>
          )}
        </div>
      </form>

      {/* 2. Matches */}
      {!direct && matches && !chosen && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">2. Top matches for {matches.category_name}</h2>
            <p className="text-xs text-ink/55">
              {matches.complexity_label} job · ranked on area proximity {PCT(matches.weights.proximity)}, rating {PCT(matches.weights.rating)}, experience {PCT(matches.weights.capability)}, price {PCT(matches.weights.price)}, availability {PCT(matches.weights.availability)}
            </p>
          </div>
          {matches.results.length === 0 ? (
            <div className="panel text-center text-ink/70">
              No available technician covers {matches.customer_area} for this service{preferredDate ? " on that date" : " in the next 7 days"}. Try another date or a nearby address.
            </div>
          ) : (
            matches.results.map((m) => <MatchCard key={m.provider_id} m={m} onChoose={choose} />)
          )}
        </section>
      )}

      {/* 3. Time slot */}
      {chosen && (
        <section className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{direct ? "2" : "3"}. Pick a time with {chosen.name}</h2>
            {!direct && <button className="btn-ghost !py-1 text-xs" onClick={() => { setChosen(null); setLock(null); }}>Change technician</button>}
          </div>

          {loadingSlots ? (
            <p className="text-sm text-ink/60">Loading availability…</p>
          ) : days.every((d) => d.slots.length === 0) ? (
            <p className="rounded-lg bg-paper px-3 py-2 text-sm">No open slots in this week. Try a different preferred date.</p>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {days.map((d, i) => (
                  <button key={d.date} type="button" onClick={() => setDayIdx(i)} disabled={d.slots.length === 0}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-40 ${i === dayIdx ? "border-lagoon bg-lagoon-tint" : "border-line bg-white hover:border-lagoon/50"}`}>
                    <span className="block font-semibold">{dayLabel(d.date)}</span>
                    <span className="text-xs text-ink/55">{d.slots.length} open</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {(activeDay?.slots ?? []).map((s) => {
                  const selected = lock && new Date(lock.start).getTime() === new Date(s.start).getTime();
                  return (
                    <button key={s.start} type="button" onClick={() => holdSlot(s)}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium ${selected && !lockExpired ? "border-lagoon bg-lagoon text-white" : "border-line bg-white hover:border-lagoon"}`}>
                      {fmtTime(s.start)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}

      {/* 4. Confirm */}
      {chosen && lock && (
        <form onSubmit={confirm} className="panel space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{direct ? "3" : "4"}. Confirm your request</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${lockExpired ? "bg-red-50 text-danger" : secondsLeft < 60 ? "bg-amber-50 text-amber-800" : "bg-lagoon-tint text-lagoon-dark"}`}>
              <Timer size={14} /> {lockExpired ? "Hold expired. Pick the time again" : `Slot held for ${mmss}`}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="flex gap-2"><CalendarClock size={16} className="mt-0.5 text-lagoon" /><div><dt className="text-xs text-ink/50">When</dt><dd className="font-medium">{fmtDateTime(lock.start)}</dd></div></div>
            <div className="flex gap-2"><Clock size={16} className="mt-0.5 text-lagoon" /><div><dt className="text-xs text-ink/50">Duration</dt><dd className="font-medium">{Math.round((new Date(lock.end) - new Date(lock.start)) / 60000)} min</dd></div></div>
            <div className="flex gap-2"><MapPin size={16} className="mt-0.5 text-lagoon" /><div><dt className="text-xs text-ink/50">At</dt><dd className="font-medium">{addresses.find((a) => String(a.id) === addressId)?.area}</dd></div></div>
          </dl>
          <div>
            <label className="label" htmlFor="notes">What needs doing?</label>
            <textarea id="notes" className="input" rows={4} required minLength={5} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1.5 ton split AC is not cooling and makes a buzzing noise. Installed 3 years ago." />
            <p className="mt-1 text-xs text-ink/50">The technician reads this to prepare an itemised labour &amp; material quote. You only pay what you approve.</p>
          </div>
          <button className="btn-primary" disabled={submitting || lockExpired || notes.trim().length < 5}>{submitting ? "Sending request…" : "Send booking request"}</button>
        </form>
      )}
    </main>
  );
}
