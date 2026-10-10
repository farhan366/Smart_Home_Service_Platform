import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Wrench, Mail, Lock, Phone, UserCheck, ArrowRight, ShieldCheck, CheckCircle2, Zap } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert } from "../components/ui";

export default function Register() {
  const [role, setRole] = useState("customer");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register", {
        ...form,
        role: role,
      });
      // Auto login after registration
      await login(form.email, form.password);
      navigate(role === "provider" ? "/provider/dashboard" : "/");
    } catch (err) {
      setError(errorMessage(err) || "Failed to create account. Please check your data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-stretch bg-white">
      {/* Left Visual & Value Proposition Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 flex-col justify-between p-14 overflow-hidden">
        {/* Subtle Ambient Glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-indigo-300 text-xs font-medium tracking-wide">
            <Zap size={14} className="text-amber-400" />
            <span>Join Verified Network</span>
          </div>
          <h2 className="mt-8 text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {role === "customer" 
              ? "Fast, reliable services right at your doorstep." 
              : "Grow your technical career with verified clients."}
          </h2>
          <p className="mt-4 text-base text-slate-400 max-w-md leading-relaxed">
            {role === "customer"
              ? "Access pre-vetted specialists for electrical, HVAC, plumbing, and home automation in your neighborhood."
              : "Set your own hourly rates, manage weekly schedule slots, and get direct booking requests."}
          </p>
        </div>

        {/* Feature Checkpoints */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-start gap-3 text-slate-300 text-sm">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>Multi-level background checks and technician licensing verification.</span>
          </div>
          <div className="flex items-start gap-3 text-slate-300 text-sm">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>Transparent hourly rates with zero hidden platform charges.</span>
          </div>
          <div className="flex items-start gap-3 text-slate-300 text-sm">
            <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <span>Full schedule control with real-time slot coordination.</span>
          </div>
        </div>

        {/* Bottom Security Footer */}
        <div className="relative z-10 flex items-center gap-6 pt-6 border-t border-white/10 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" /> Safe & Certified Network
          </span>
          <span>© SmartHome Platform</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-16 bg-slate-50/50">
        <div className="w-full max-w-md space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Get Started</span>
            <h1 className="mt-1.5 text-3xl font-extrabold text-slate-900 tracking-tight">Create your account</h1>
            <p className="mt-1.5 text-xs text-slate-500">
              Select your user type to get customized tools.
            </p>
          </div>

          {/* Interactive Role Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRole("customer")}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                role === "customer"
                  ? "border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20"
                  : "border-slate-200 bg-white/60 hover:bg-white text-slate-600"
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${role === "customer" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                <User size={16} />
              </div>
              <h3 className="font-bold text-xs text-slate-900">I need a service</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Find & book verified technicians</p>
            </button>

            <button
              type="button"
              onClick={() => setRole("provider")}
              className={`p-3.5 rounded-2xl border text-left transition-all ${
                role === "provider"
                  ? "border-indigo-600 bg-white shadow-sm ring-2 ring-indigo-500/20"
                  : "border-slate-200 bg-white/60 hover:bg-white text-slate-600"
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${role === "provider" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                <Wrench size={16} />
              </div>
              <h3 className="font-bold text-xs text-slate-900">I offer a service</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">Get discovered by nearby clients</p>
            </button>
          </div>

          {error && <Alert kind="error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="full_name">
                Full Name
              </label>
              <div className="relative">
                <UserCheck size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  placeholder="e.g. Farhan Mahmud"
                  value={form.full_name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="email">
                  Email
                </label>
                <div className="relative">
                  <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="name@mail.com"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="phone">
                  Phone
                </label>
                <div className="relative">
                  <Phone size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters with numbers"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.99] disabled:opacity-50 mt-2"
            >
              <span>{loading ? "Creating Account..." : "Complete Registration"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="text-center text-xs text-slate-500 pt-2">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}