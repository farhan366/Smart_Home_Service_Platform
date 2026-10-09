import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, Upload, X } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert, VerifiedBadges } from "./ui";

const DOC_TYPES = [
  { value: "national_id", label: "National ID" },
  { value: "trade_license", label: "Trade license" },
  { value: "training_certificate", label: "Training certificate" },
  { value: "other", label: "Other" },
];
const STATUS_STYLE = {
  pending: "bg-marigold-tint text-ink",
  approved: "bg-lagoon-tint text-lagoon-dark",
  rejected: "bg-red-50 text-danger",
};

function SpecialtyPicker({ tree, selected, onChange }) {
  const toggle = (id) =>
    onChange(selected.some((s) => s.category_id === id) ? selected.filter((s) => s.category_id !== id) : [...selected, { category_id: id, custom_hourly_rate: "" }]);
  const setRate = (id, rate) => onChange(selected.map((s) => (s.category_id === id ? { ...s, custom_hourly_rate: rate } : s)));

  return (
    <div className="space-y-4">
      {tree.map((parent) => (
        <fieldset key={parent.id}>
          <legend className="mb-2 text-sm font-semibold">{parent.name}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {parent.children.map((child) => {
              const sel = selected.find((s) => s.category_id === child.id);
              return (
                <div key={child.id} className={`rounded-lg border px-3 py-2 ${sel ? "border-lagoon bg-lagoon-tint/50" : "border-line"}`}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(sel)} onChange={() => toggle(child.id)} />
                    {child.name}
                  </label>
                  {sel && (
                    <input
                      type="number" min="1" step="1" className="input mt-2" aria-label={`Custom hourly rate for ${child.name}`}
                      placeholder="Own hourly rate for this service (optional)" value={sel.custom_hourly_rate}
                      onChange={(e) => setRate(child.id, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function AreaInput({ areas, onChange }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const value = draft.trim();
    if (value.length >= 2 && !areas.some((a) => a.area.toLowerCase() === value.toLowerCase())) onChange([...areas, { area: value, city: "Dhaka" }]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className="input" placeholder="Type an area or thana, e.g. Savar" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn-ghost" onClick={add}><Plus size={16} /> Add</button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {areas.map((a) => (
          <li key={a.area} className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
            {a.area}
            <button type="button" aria-label={`Remove ${a.area}`} className="rounded-full p-1 hover:bg-line" onClick={() => onChange(areas.filter((x) => x.area !== a.area))}><X size={13} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DocumentsPanel({ documents, onChanged }) {
  const [docType, setDocType] = useState("trade_license");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return setError("Choose a PDF, PNG or JPG file (max 5 MB).");
    setBusy(true); setError("");
    const body = new FormData();
    body.append("doc_type", docType); body.append("title", title); body.append("file", file);
    try {
      await api.post("/providers/me/documents", body);
      setTitle(""); setFile(null); e.target.reset(); onChanged();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const remove = async (d) => {
    try { await api.delete(`/providers/me/documents/${d.id}`); onChanged(); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>
      {documents.length === 0 ? (
        <p className="text-sm text-ink/60">No documents yet. Upload a trade license or training certificate to earn the credentials badge.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText size={18} className="shrink-0 text-lagoon" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="truncate text-xs text-ink/50">{DOC_TYPES.find((t) => t.value === d.doc_type)?.label} · {d.original_filename}</p>
                {d.status === "rejected" && d.review_note && <p className="text-xs text-danger">Reason: {d.review_note}</p>}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[d.status]}`}>{d.status}</span>
              <button type="button" aria-label={`Delete ${d.title}`} className="text-ink/40 hover:text-danger" onClick={() => remove(d)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={upload} className="grid gap-3 sm:grid-cols-[160px_1fr_auto]">
        <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">
          {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input className="input" placeholder="Document title" required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn-primary" disabled={busy}><Upload size={16} /> {busy ? "Uploading…" : "Upload"}</button>
        <input type="file" accept="application/pdf,image/png,image/jpeg" className="text-sm sm:col-span-3" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </form>
    </div>
  );
}

export default function ProviderProfileSetup() {
  const [tree, setTree] = useState([]);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ headline: "", bio: "", years_experience: 0, base_hourly_rate: "", min_fixed_rate: 0, is_accepting_jobs: true });
  const [specialties, setSpecialties] = useState([]);
  const [areas, setAreas] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [saving, setSaving] = useState(false);

  const hydrate = (p) => {
    setProfile(p);
    setForm({
      headline: p.headline ?? "", bio: p.bio ?? "", years_experience: p.years_experience,
      base_hourly_rate: Number(p.base_hourly_rate) > 0 ? Number(p.base_hourly_rate) : "",
      min_fixed_rate: Number(p.min_fixed_rate), is_accepting_jobs: p.is_accepting_jobs,
    });
    setSpecialties(p.specialties.map((s) => ({ category_id: s.category_id, custom_hourly_rate: s.custom_hourly_rate ?? "" })));
    setAreas(p.service_areas.map((a) => ({ area: a.area, city: a.city })));
  };

  const reload = async () => {
    const { data } = await api.get("/providers/me");
    setProfile(data); // documents/badges refresh without discarding unsaved form edits
    return data;
  };

  useEffect(() => {
    Promise.all([api.get("/services/categories"), api.get("/providers/me")])
      .then(([c, p]) => { setTree(c.data); hydrate(p.data); })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const missing = useMemo(() => (specialties.length === 0 ? "Pick at least one service you offer." : areas.length === 0 ? "Add at least one area you serve." : ""), [specialties, areas]);

  const save = async (e) => {
    e.preventDefault();
    if (missing) return setError(missing);
    setSaving(true); setError(""); setSaved("");
    try {
      const { data } = await api.put("/providers/me", {
        headline: form.headline || null, bio: form.bio || null,
        years_experience: Number(form.years_experience), base_hourly_rate: Number(form.base_hourly_rate),
        min_fixed_rate: Number(form.min_fixed_rate || 0), is_accepting_jobs: form.is_accepting_jobs,
        specialties: specialties.map((s) => ({ category_id: s.category_id, custom_hourly_rate: s.custom_hourly_rate === "" ? null : Number(s.custom_hourly_rate) })),
        service_areas: areas,
      });
      hydrate(data);
      setSaved("Profile saved. You now appear in search results.");
    } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  };

  if (!profile) return <p className="text-ink/60">{error || "Loading your profile…"}</p>;

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Your professional profile</h2>
          <p className="text-sm text-ink/60">Customers see this when they compare providers.</p>
        </div>
        <div className="text-right">
          <VerifiedBadges contact={profile.is_contact_verified} credential={profile.is_credential_verified} />
          {!profile.is_contact_verified && !profile.is_credential_verified && <p className="text-xs text-ink/50">Badges appear after our team reviews your documents.</p>}
        </div>
      </div>
      <Alert>{error}</Alert>
      <Alert kind="ok">{saved}</Alert>

      <section className="panel space-y-4">
        <h3 className="text-lg font-semibold">About you</h3>
        <div>
          <label className="label" htmlFor="headline">Headline</label>
          <input id="headline" className="input" maxLength={160} placeholder="Certified AC technician with 8 years of experience" value={form.headline} onChange={set("headline")} />
        </div>
        <div>
          <label className="label" htmlFor="bio">Bio</label>
          <textarea id="bio" rows={4} maxLength={2000} className="input" placeholder="Tell customers about your training, tools and how you work." value={form.bio} onChange={set("bio")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="exp">Years of experience</label>
            <input id="exp" type="number" min="0" max="60" className="input" value={form.years_experience} onChange={set("years_experience")} />
          </div>
          <div>
            <label className="label" htmlFor="hourly">Base hourly rate (৳)</label>
            <input id="hourly" type="number" min="1" step="1" required className="input" value={form.base_hourly_rate} onChange={set("base_hourly_rate")} />
          </div>
          <div>
            <label className="label" htmlFor="minrate">Minimum charge per visit (৳)</label>
            <input id="minrate" type="number" min="0" step="1" className="input" value={form.min_fixed_rate} onChange={set("min_fixed_rate")} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_accepting_jobs} onChange={set("is_accepting_jobs")} /> I am accepting new jobs
        </label>
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Services you offer</h3>
        <SpecialtyPicker tree={tree} selected={specialties} onChange={setSpecialties} />
      </section>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Areas you serve</h3>
        <AreaInput areas={areas} onChange={setAreas} />
      </section>

      <div><button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>

      <section className="panel space-y-3">
        <h3 className="text-lg font-semibold">Credentials</h3>
        <DocumentsPanel documents={profile.documents} onChanged={reload} />
      </section>
    </form>
  );
}
