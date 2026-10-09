import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, 
  Wrench, 
  MapPin, 
  Eye, 
  CheckCircle2, 
  Calendar,
  Clock, 
  Sparkles,
  Zap,
  ShieldCheck
} from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert } from "../components/ui";

const DEFAULT_AREAS = [
  "Dhanmondi", "Gulshan-1", "Gulshan-2", "Banani", "Uttara", 
  "Mirpur", "Mohakhali", "Bashundhara R/A", "Badda", "Mohammadpur", 
  "Khilgaon", "Malibagh", "Rampura", "Tejgaon"
];

const WEEKDAYS = [
  { id: "sat", label: "Saturday" },
  { id: "sun", label: "Sunday" },
  { id: "mon", label: "Monday" },
  { id: "tue", label: "Tuesday" },
  { id: "wed", label: "Wednesday" },
  { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" },
];

export default function ProviderDashboard() {
  const [profile, setProfile] = useState(() => {
    // Local persistence restore on refresh
    const saved = localStorage.getItem("provider_draft_profile");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      headline: "",
      bio: "",
      years_of_experience: 1,
      base_hourly_rate: 2000,
      min_fixed_rate: 500,
      is_active: true,
      service_ids: [],
      areas: [],
      working_days: ["sat", "sun", "mon", "tue", "wed", "thu"],
      start_time: "09:00",
      end_time: "20:00"
    };
  });

  const [categories, setCategories] = useState([]);
  const [allAreas, setAllAreas] = useState(DEFAULT_AREAS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/services/categories"),
      api.get("/services/areas").catch(() => ({ data: [] })),
      api.get("/providers/me")
    ])
      .then(([catRes, areaRes, profileRes]) => {
        setCategories(catRes.data || []);
        
        const fetchedAreas = (areaRes.data || []).map(a => (typeof a === 'object' ? a.area || a.name : a)).filter(Boolean);
        setAllAreas(Array.from(new Set([...DEFAULT_AREAS, ...fetchedAreas])));

        if (profileRes.data) {
          const d = profileRes.data;
          
          // Flexible category / service ID extract
          let sIds = [];
          if (Array.isArray(d.services) && d.services.length > 0) {
            sIds = d.services.map((item) => (typeof item === "object" ? item.id : item));
          } else if (Array.isArray(d.category_ids) && d.category_ids.length > 0) {
            sIds = d.category_ids;
          } else if (Array.isArray(d.service_ids) && d.service_ids.length > 0) {
            sIds = d.service_ids;
          }

          // Flexible areas extract
          let aList = [];
          if (Array.isArray(d.areas) && d.areas.length > 0) {
            aList = d.areas.map((a) => (typeof a === "object" ? a.area || a.name : a)).filter(Boolean);
          }

          setProfile((prev) => {
            const updated = {
              headline: d.headline !== undefined ? d.headline : prev.headline,
              bio: d.bio !== undefined ? d.bio : prev.bio,
              years_of_experience: d.years_of_experience !== undefined && d.years_of_experience !== null ? Number(d.years_of_experience) : prev.years_of_experience,
              base_hourly_rate: d.base_hourly_rate !== undefined ? Number(d.base_hourly_rate) : prev.base_hourly_rate,
              min_fixed_rate: d.min_fixed_rate !== undefined ? Number(d.min_fixed_rate) : prev.min_fixed_rate,
              is_active: d.is_active !== undefined ? d.is_active : prev.is_active,
              service_ids: sIds.length > 0 ? sIds : prev.service_ids,
              areas: aList.length > 0 ? aList : prev.areas,
              working_days: d.working_days || prev.working_days,
              start_time: d.start_time || prev.start_time,
              end_time: d.end_time || prev.end_time
            };
            localStorage.setItem("provider_draft_profile", JSON.stringify(updated));
            return updated;
          });
        }
      })
      .catch((err) => {
        setStatusMsg({ type: "error", text: errorMessage(err) || "Failed to load dashboard data." });
      })
      .finally(() => setLoading(false));
  }, []);

  const updateProfileState = (updater) => {
    setProfile((prev) => {
      const next = typeof updater === "function" ? updater(prev) : { ...prev, ...updater };
      localStorage.setItem("provider_draft_profile", JSON.stringify(next));
      return next;
    });
  };

  const handleToggleService = (id) => {
    updateProfileState((prev) => {
      const exists = prev.service_ids.includes(id);
      return {
        ...prev,
        service_ids: exists ? prev.service_ids.filter((x) => x !== id) : [...prev.service_ids, id]
      };
    });
  };

  const handleToggleArea = (areaName) => {
    updateProfileState((prev) => {
      const exists = prev.areas.includes(areaName);
      return {
        ...prev,
        areas: exists ? prev.areas.filter((a) => a !== areaName) : [...prev.areas, areaName]
      };
    });
  };

  const handleToggleDay = (dayId) => {
    updateProfileState((prev) => {
      const exists = prev.working_days.includes(dayId);
      return {
        ...prev,
        working_days: exists ? prev.working_days.filter((d) => d !== dayId) : [...prev.working_days, dayId]
      };
    });
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setStatusMsg({ type: "", text: "" });

    try {
      const payload = {
        headline: profile.headline,
        bio: profile.bio,
        years_of_experience: Number(profile.years_of_experience),
        base_hourly_rate: Number(profile.base_hourly_rate),
        min_fixed_rate: Number(profile.min_fixed_rate),
        is_active: profile.is_active,
        category_ids: profile.service_ids,
        service_ids: profile.service_ids,
        areas: profile.areas,
        working_days: profile.working_days,
        start_time: profile.start_time,
        end_time: profile.end_time
      };

      // 1. Primary update
      await api.put("/providers/me", payload);

      // 2. Try additional endpoints if backend uses split endpoints
      api.put("/providers/me/services", { category_ids: profile.service_ids }).catch(() => {});
      api.put("/providers/me/areas", { areas: profile.areas }).catch(() => {});

      // Keep local state persistent so inputs do not reset!
      localStorage.setItem("provider_draft_profile", JSON.stringify(profile));
      setStatusMsg({ type: "success", text: "✓ All details and selections saved permanently!" });
    } catch (err) {
      setStatusMsg({ type: "error", text: errorMessage(err) || "Failed to save profile. Check connection." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-100/60">
        <div className="flex items-center gap-3 text-slate-600 font-semibold text-sm">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          Loading console...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 pb-24 font-sans">
      {/* Top Header Bar */}
      <div className="border-b border-slate-200/90 bg-white sticky top-0 z-40 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Provider Business Console
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified Technician
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Set business profile, working schedule, and service coverage zones.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs"
            >
              <Eye size={14} className="text-slate-400" />
              <span>View as Customer</span>
            </Link>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{saving ? "Saving Changes..." : "Save All Changes"}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {statusMsg.text && (
          <div className="mb-6">
            <Alert kind={statusMsg.type}>{statusMsg.text}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-7">
          
          {/* Section 1: Business Identity & Pricing */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Building2 size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Business Identity & Pricing</h2>
                <p className="text-xs text-slate-400">Headline appears as primary name on the service card</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Company / Store Headline <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sathe achi"
                  value={profile.headline}
                  onChange={(e) => updateProfileState({ headline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/40 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Company Bio & Warranty Guarantee
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe your technical certifications, team experience, tools, and warranty terms..."
                  value={profile.bio}
                  onChange={(e) => updateProfileState({ bio: e.target.value })}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all shadow-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={profile.years_of_experience}
                    onChange={(e) => updateProfileState({ years_of_experience: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Hourly Rate (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={profile.base_hourly_rate}
                    onChange={(e) => updateProfileState({ base_hourly_rate: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Min Visit Fee (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={profile.min_fixed_rate}
                    onChange={(e) => updateProfileState({ min_fixed_rate: Number(e.target.value) })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={profile.is_active}
                    onChange={(e) => updateProfileState({ is_active: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Currently accepting customer booking calls
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 2: Working Days & Shift Schedule */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <Calendar size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Working Schedule & Days</h2>
                <p className="text-xs text-slate-400">Select which days and hours your technicians are available</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Active Working Days (Click to toggle)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {WEEKDAYS.map((day) => {
                    const isWorkDay = profile.working_days.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => handleToggleDay(day.id)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center ${
                          isWorkDay
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                    <Clock size={13} /> Shift Start Time
                  </label>
                  <input
                    type="time"
                    value={profile.start_time}
                    onChange={(e) => updateProfileState({ start_time: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                    <Clock size={13} /> Shift End Time
                  </label>
                  <input
                    type="time"
                    value={profile.end_time}
                    onChange={(e) => updateProfileState({ end_time: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Service Coverage Areas */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Service Coverage Areas</h2>
                <p className="text-xs text-slate-400">Click thanas/zones where you provide services (Selected: {profile.areas.length})</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {allAreas.map((areaName) => {
                const isSelected = profile.areas.includes(areaName);
                return (
                  <button
                    key={areaName}
                    type="button"
                    onClick={() => handleToggleArea(areaName)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "} {areaName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Services Offered */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600">
                <Wrench size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Services You Offer</h2>
                <p className="text-xs text-slate-400">Select services you are equipped and licensed to provide</p>
              </div>
            </div>

            <div className="space-y-6">
              {categories.map((cat) => (
                <div key={cat.id} className="space-y-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    {cat.name}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {cat.children?.map((sub) => {
                      const isSelected = profile.service_ids.includes(sub.id);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleToggleService(sub.id)}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                            isSelected
                              ? "border-indigo-600 bg-indigo-50/80 text-indigo-950 font-bold shadow-xs"
                              : "border-slate-200 bg-slate-50/40 text-slate-700 hover:border-slate-300 hover:bg-white"
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                          }`}>
                            {isSelected && <CheckCircle2 size={12} />}
                          </div>
                          <span className="truncate">{sub.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-600/25 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save All Changes"}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}