import { useCallback, useEffect, useState } from "react";
import { LocateFixed, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert } from "./ui";

const EMPTY = { title: "", area: "", city: "Dhaka", street: "", latitude: "", longitude: "", is_default: false };

function AddressForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial, latitude: initial?.latitude ?? "", longitude: initial?.longitude ?? "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(initial?.id);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const useMyLocation = () => {
    if (!navigator.geolocation) return setError("Your browser does not support location.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) })),
      () => setError("Location permission was denied. You can enter coordinates manually.")
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const body = {
      title: form.title, area: form.area, city: form.city, street: form.street, is_default: form.is_default,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
    };
    try {
      const res = editing ? await api.patch(`/addresses/${initial.id}`, body) : await api.post("/addresses", body);
      onSaved(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{editing ? "Edit address" : "Add a new address"}</h3>
        <button type="button" onClick={onCancel} aria-label="Close form" className="text-ink/50 hover:text-ink"><X size={18} /></button>
      </div>
      <Alert>{error}</Alert>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="a-title">Label</label>
          <input id="a-title" className="input" placeholder="Home, Office, Parents' flat" required value={form.title} onChange={set("title")} />
        </div>
        <div>
          <label className="label" htmlFor="a-area">Area / Thana</label>
          <input id="a-area" className="input" placeholder="Savar" required value={form.area} onChange={set("area")} />
        </div>
        <div>
          <label className="label" htmlFor="a-city">City</label>
          <input id="a-city" className="input" required value={form.city} onChange={set("city")} />
        </div>
        <div>
          <label className="label" htmlFor="a-street">Street address</label>
          <input id="a-street" className="input" placeholder="House, road, landmark" required minLength={3} value={form.street} onChange={set("street")} />
        </div>
        <div>
          <label className="label" htmlFor="a-lat">Latitude (optional)</label>
          <input id="a-lat" type="number" step="any" min="-90" max="90" className="input" value={form.latitude} onChange={set("latitude")} />
        </div>
        <div>
          <label className="label" htmlFor="a-lng">Longitude (optional)</label>
          <input id="a-lng" type="number" step="any" min="-180" max="180" className="input" value={form.longitude} onChange={set("longitude")} />
        </div>
      </div>
      <button type="button" className="btn-ghost" onClick={useMyLocation}><LocateFixed size={16} /> Use my current location</button>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_default} onChange={set("is_default")} disabled={initial?.is_default} />
        Use as my default address
      </label>
      <div className="flex gap-3">
        <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save address"}</button>
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function AddressManager() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (new) | address

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/addresses");
      setAddresses(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const makeDefault = async (a) => {
    try { await api.patch(`/addresses/${a.id}`, { is_default: true }); load(); } catch (err) { setError(errorMessage(err)); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    try { await api.delete(`/addresses/${a.id}`); load(); } catch (err) { setError(errorMessage(err)); }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">My addresses</h2>
          <p className="text-sm text-ink/60">Save the places where you need service. Your default is pre-selected when you book.</p>
        </div>
        {!editing && <button className="btn-primary" onClick={() => setEditing({})}><Plus size={16} /> Add address</button>}
      </div>
      <Alert>{error}</Alert>

      {editing && (
        <AddressForm
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {loading ? (
        <p className="text-ink/60">Loading addresses…</p>
      ) : addresses.length === 0 && !editing ? (
        <div className="panel text-center">
          <MapPin className="mx-auto mb-2 text-lagoon" />
          <p className="font-semibold">No saved addresses yet</p>
          <p className="text-sm text-ink/60">Add your home or office so providers know where to come.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className={`panel ${a.is_default ? "border-lagoon" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    {a.title}
                    {a.is_default && <span className="rounded-full bg-lagoon-tint px-2 py-0.5 text-xs font-semibold text-lagoon-dark">Default</span>}
                  </h3>
                  <p className="mt-1 text-sm">{a.street}</p>
                  <p className="text-sm text-ink/60">{a.area}, {a.city}</p>
                  {a.latitude != null && a.longitude != null && (
                    <p className="mt-1 text-xs text-ink/50">{Number(a.latitude).toFixed(4)}, {Number(a.longitude).toFixed(4)}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {!a.is_default && <button className="btn-ghost" onClick={() => makeDefault(a)}><Star size={15} /> Make default</button>}
                <button className="btn-ghost" onClick={() => setEditing(a)}><Pencil size={15} /> Edit</button>
                <button className="btn-danger" onClick={() => remove(a)}><Trash2 size={15} /> Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
