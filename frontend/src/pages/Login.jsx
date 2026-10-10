import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, ArrowRight, ShieldCheck, Wrench, Zap, Star } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Alert } from "../components/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4.5rem)] flex items-stretch bg-white">
      {/* Left Visual & Branding Panel (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 flex-col justify-between p-14 overflow-hidden">
        {/* Subtle Background Glows */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-indigo-300 text-xs font-medium tracking-wide">
            <Zap size={14} className="text-amber-400" />
            <span>On-Demand Home Infrastructure</span>
          </div>
          <h2 className="mt-8 text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Verified experts for your modern living space.
          </h2>
          <p className="mt-4 text-base text-slate-400 max-w-md leading-relaxed">
            Connect directly with licensed electrical, HVAC, and smart home specialists with guaranteed turnaround times.
          </p>
        </div>

        {/* Live Social Proof / Testimonial Card */}
        <div className="relative z-10 p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-1 text-amber-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} className="fill-amber-400" />
            ))}
          </div>
          <p className="text-sm font-medium text-slate-200 italic leading-relaxed">
            "Booked an electrical diagnostics technician within 10 minutes. Verified certification gave complete peace of mind."
          </p>
          <div className="flex items-center gap-3 pt-2">
            <div className="w-9 h-9 rounded-full bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center font-bold text-white text-xs">
              TR
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Tanvir Rahman</p>
              <p className="text-[11px] text-slate-400">Gulshan-2 Resident</p>
            </div>
          </div>
        </div>

        {/* Bottom Feature Badges */}
        <div className="relative z-10 flex items-center gap-6 pt-6 border-t border-white/10 text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-400" /> Police Verified
          </span>
          <span className="flex items-center gap-2">
            <Wrench size={16} className="text-indigo-400" /> Certified Technicians
          </span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-14 lg:p-16 bg-slate-50/50">
        <div className="w-full max-w-md space-y-8">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">SmartHome Authentication</span>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight">Sign in to account</h1>
            <p className="mt-2 text-sm text-slate-500">
              Welcome back. Enter your credentials to manage appointments.
            </p>
          </div>

          {error && <Alert kind="error">{error}</Alert>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider" htmlFor="password">
                  Password
                </label>
                <a href="#" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-150 active:scale-[0.99] disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Continue"}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Don't have an account yet?{" "}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}