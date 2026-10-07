import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../api/client";
import { Alert } from "../components/ui";

const ROLES = [
  { value: "customer", title: "I need a service", hint: "Find and book trusted professionals" },
  { value: "provider", title: "I offer a service", hint: "Get discovered by customers nearby" },
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "", role: "customer" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const user = await register({ ...form, phone: form.phone || null });
      navigate(user.role === "provider" ? "/provider/dashboard" : "/account/addresses", { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto mt-10 max-w-lg px-4">
      <form onSubmit={submit} className="panel space-y-4">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <Alert>{error}</Alert>
        <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-3">
          {ROLES.map((r) => (
            <button type="button" key={r.value} role="radio" aria-checked={form.role === r.value}
              onClick={() => setForm({ ...form, role: r.value })}
              className={`rounded-lg border p-3 text-left ${form.role === r.value ? "border-lagoon bg-lagoon-tint" : "border-line bg-white"}`}>
              <span className="block text-sm font-semibold">{r.title}</span>
              <span className="text-xs text-ink/60">{r.hint}</span>
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input id="name" required minLength={2} className="input" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" required className="input" value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label" htmlFor="phone">Mobile number</label>
            <input id="phone" inputMode="tel" placeholder="01712345678" className="input" value={form.phone} onChange={set("phone")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="reg-pass">Password</label>
          <input id="reg-pass" type="password" required minLength={8} autoComplete="new-password" className="input" value={form.password} onChange={set("password")} />
          <p className="mt-1 text-xs text-ink/50">At least 8 characters with a letter and a number.</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        <p className="text-center text-sm text-ink/60">Already registered? <Link to="/login" className="font-semibold text-lagoon">Sign in</Link></p>
      </form>
    </main>
  );
}
