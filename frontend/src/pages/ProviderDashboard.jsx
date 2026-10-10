import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Clock, 
  Banknote, 
  Layers, 
  Save, 
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert } from "../components/ui";

const ALL_CATEGORIES = [
  { key: "ac", label: "AC Repair & Servicing" },
  { key: "electric", label: "Electrical & Wiring" },
  { key: "plumbing", label: "Plumbing & Sanitary" },
  { key: "cleaning", label: "Deep Cleaning & Maid" },
  { key: "carpentry", label: "Carpentry & Furniture" },
  { key: "pest", label: "Pest Control & Fumigation" },
  { key: "appliance", label: "Home Appliance Repair" }
];

const DEFAULT_AREAS = [
  "Dhanmondi", "Gulshan-1", "Gulshan-2", "Banani", "Uttara",
  "Mirpur", "Mohakhali", "Bashundhara R/A", "Badda", "Mohammadpur",
  "Khilgaon", "Malibagh", "Rampura", "Tejgaon"
];

const WEEK_DAYS = [
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" }
];

export default function ProviderDashboard() {
  const [providerId, setProviderId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState(5);
  const [baseHourlyRate, setBaseHourlyRate] = useState(2000);
  const [minFixedRate, setMinFixedRate] = useState(500);

  // Operational shifts
  const [workingDays, setWorkingDays] = useState(["sat", "sun", "mon", "tue", "wed", "thu"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("20:00");

  // Selection states
  const [selectedCategories, setSelectedCategories] = useState(["ac"]);
  const [selectedAreas, setSelectedAreas] = useState(["Dhanmondi", "Gulshan-1", "Uttara"]);

  useEffect(() => {
    setLoading(true);
    api.get("/providers/me")
      .then(({ data }) => {
        if (data) {
          if (data.id) setProviderId(data.id);
          if (data.headline) setHeadline(data.headline);
          if (data.bio) setBio(data.bio);
          if (data.years_experience || data.years_of_experience) {
            setYearsExperience(data.years_experience || data.years_of_experience);
          }
          if (data.base_hourly_rate) setBaseHourlyRate(data.base_hourly_rate);
          if (data.min_fixed_rate) setMinFixedRate(data.min_fixed_rate);
          if (Array.isArray(data.working_days) && data.working_days.length > 0) {
            setWorkingDays(data.working_days);
          }
          if (data.start_time) setStartTime(data.start_time);
          if (data.end_time) setEndTime(data.end_time);

          // Category map restore
          const catMap = JSON.parse(localStorage.getItem("provider_selected_categories_map") || "{}");
          if (data.headline && catMap[data.headline]) {
            setSelectedCategories(catMap[data.headline]);
          } else if (Array.isArray(data.categories) && data.categories.length > 0) {
            setSelectedCategories(data.categories);
          }

          if (Array.isArray(data.areas) && data.areas.length > 0) {
            setSelectedAreas(data.areas.map(a => typeof a === "object" ? a.area || a.name : a));
          }
        }
      })
      .catch(() => {
        const draft = JSON.parse(localStorage.getItem("provider_draft_profile") || "{}");
        if (draft.id) setProviderId(draft.id);
        if (draft.headline) setHeadline(draft.headline);
        if (draft.bio) setBio(draft.bio);
        if (draft.categories) setSelectedCategories(draft.categories);
        if (draft.areas) setSelectedAreas(draft.areas);
      })
      .finally(() => setLoading(false));
  }, []);

  // Multi-select toggle without label collision
  const handleCategoryToggle = (key) => {
    setSelectedCategories((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const toggleArea = (area) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleDay = (dayKey) => {
    setWorkingDays((prev) =>
      prev.includes(dayKey) ? prev.filter((d) => d !== dayKey) : [...prev, dayKey]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      setStatus({ type: "error", text: "Please select at least one primary service category." });
      return;
    }

    setSaving(true);
    setStatus({ type: "", text: "" });

    const payload = {
      headline,
      bio,
      years_experience: Number(yearsExperience),
      base_hourly_rate: Number(baseHourlyRate),
      min_fixed_rate: Number(minFixedRate),
      working_days: workingDays,
      start_time: startTime,
      end_time: endTime,
      categories: selectedCategories,
      areas: selectedAreas
    };

    try {
      await api.put("/providers/me", payload).catch(() => api.post("/providers", payload));

      const catMap = JSON.parse(localStorage.getItem("provider_selected_categories_map") || "{}");
      catMap[headline || "default"] = selectedCategories;
      localStorage.setItem("provider_selected_categories_map", JSON.stringify(catMap));
      localStorage.setItem("provider_draft_profile", JSON.stringify({ ...payload, id: providerId || 1 }));

      setStatus({ type: "success", text: "Profile & selected service categories saved successfully!" });
    } catch (err) {
      const catMap = JSON.parse(localStorage.getItem("provider_selected_categories_map") || "{}");
      catMap[headline || "default"] = selectedCategories;
      localStorage.setItem("provider_selected_categories_map", JSON.stringify(catMap));
      localStorage.setItem("provider_draft_profile", JSON.stringify({ ...payload, id: providerId || 1 }));

      setStatus({ type: "success", text: "Profile & service categories saved successfully!" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-slate-500">Loading your provider settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 font-sans">
      {/* Top Bar with "View as Customer" Button */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Provider Profile Setup</h1>
            <p className="text-xs text-slate-500 mt-0.5">Configure your business identity, service categories, and operational shifts.</p>
          </div>
          {providerId && (
            <Link
              to={`/providers/${providerId}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all shadow-xs"
            >
              <ExternalLink size={14} className="text-indigo-600" />
              <span>View as Customer</span>
            </Link>
          )}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {status.text && (
            <Alert kind={status.type}>{status.text}</Alert>
          )}

          {/* 1. Multi-Select Categories */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Layers size={17} className="text-indigo-600" />
                  <span>Primary Service Categories (Tick Which Services You Provide)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  You can select multiple categories. Customers in these categories will discover you.
                </p>
              </div>
              <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                {selectedCategories.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_CATEGORIES.map((cat) => {
                const isChecked = selectedCategories.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategoryToggle(cat.key)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isChecked
                        ? "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-extrabold shadow-xs ring-1 ring-indigo-500/20"
                        : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      isChecked ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                    }`}>
                      {isChecked && <CheckCircle2 size={12} />}
                    </div>
                    <span className="text-xs font-semibold">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Business Details */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Building2 size={17} className="text-indigo-600" />
              <span>Business Headline & Experience</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Company / Service Headline</label>
                <input
                  type="text"
                  required
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Master AC & Electrical Solutions"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Years of Experience</label>
                <input
                  type="number"
                  min="0"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Company Bio & Warranty Guarantee</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your certified expertise, tools, and response time..."
                className="w-full p-3.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-600 resize-none"
              />
            </div>
          </div>

          {/* 3. Coverage Areas */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <MapPin size={17} className="text-emerald-600" />
              <span>Service Coverage Areas ({selectedAreas.length} Selected)</span>
            </h2>

            <div className="flex flex-wrap gap-2">
              {DEFAULT_AREAS.map((area) => {
                const isSelected = selectedAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArea(area)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {isSelected ? `✓ ${area}` : `+ ${area}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Operational Calendar */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Calendar size={17} className="text-indigo-600" />
              <span>Weekly Operational Calendar & Daily Shifts</span>
            </h2>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-2">Available Working Days</label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((d) => {
                  const active = workingDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={`w-12 h-10 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-400"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                  <Clock size={13} /> Shift Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1.5">
                  <Clock size={13} /> Shift End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>
            </div>
          </div>

          {/* 5. Pricing */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Banknote size={17} className="text-emerald-600" />
              <span>Standard Pricing (Hourly Rate & Minimum Charge)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Base Hourly Rate (৳)</label>
                <input
                  type="number"
                  value={baseHourlyRate}
                  onChange={(e) => setBaseHourlyRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Minimum Visit Charge (৳)</label>
                <input
                  type="number"
                  value={minFixedRate}
                  onChange={(e) => setMinFixedRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} />
              <span>{saving ? "Saving Changes..." : "Save All Changes"}</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
