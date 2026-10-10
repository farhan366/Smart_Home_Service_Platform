import React, { useState, useEffect } from "react";
import { 
  Building2, 
  MapPin, 
  Calendar, 
  Clock, 
  Banknote, 
  Briefcase, 
  Layers, 
  Save, 
  CheckCircle2 
} from "lucide-react";
import api, { errorMessage } from "../api/client";
import { Alert } from "./ui";

const ALL_CATEGORIES = [
  { key: "ac", label: "AC Repair & Servicing" },
  { key: "electric", label: "Electrical & Wiring" },
  { key: "plumbing", label: "Plumbing & Sanitary" },
  { key: "cleaning", label: "Deep Cleaning & Maid" },
  { key: "carpentry", label: "Carpentry & Furniture" },
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

export default function ProviderProfileSetup({ onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState(5);
  const [baseHourlyRate, setBaseHourlyRate] = useState(2000);
  const [minFixedRate, setMinFixedRate] = useState(500);

  // Operational Calendar
  const [workingDays, setWorkingDays] = useState(["sat", "sun", "mon", "tue", "wed", "thu"]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("20:00");

  // Selection states
  const [selectedCategories, setSelectedCategories] = useState(["ac"]);
  const [selectedAreas, setSelectedAreas] = useState(["Dhanmondi", "Gulshan-1"]);

  useEffect(() => {
    setLoading(true);
    api.get("/providers/me")
      .then(({ data }) => {
        if (data) {
          if (data.headline) setHeadline(data.headline);
          if (data.bio) setBio(data.bio);
          if (data.years_experience) setYearsExperience(data.years_experience);
          if (data.base_hourly_rate) setBaseHourlyRate(data.base_hourly_rate);
          if (data.min_fixed_rate) setMinFixedRate(data.min_fixed_rate);
          if (Array.isArray(data.working_days) && data.working_days.length > 0) setWorkingDays(data.working_days);
          if (data.start_time) setStartTime(data.start_time);
          if (data.end_time) setEndTime(data.end_time);
          if (Array.isArray(data.categories)) setSelectedCategories(data.categories);
          if (Array.isArray(data.areas)) {
            setSelectedAreas(data.areas.map(a => typeof a === "object" ? a.area || a.name : a));
          }
        }
      })
      .catch(() => {
        // Fallback to local cache if offline
        const draft = JSON.parse(localStorage.getItem("provider_draft_profile") || "{}");
        if (draft.headline) setHeadline(draft.headline);
        if (draft.bio) setBio(draft.bio);
        if (draft.categories) setSelectedCategories(draft.categories);
        if (draft.areas) setSelectedAreas(draft.areas);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleCategory = (key) => {
    setSelectedCategories((prev) => 
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
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
      localStorage.setItem("provider_draft_profile", JSON.stringify(payload));
      setStatus({ type: "success", text: "Provider profile & categories successfully updated!" });
      if (onSaved) onSaved(payload);
    } catch (err) {
      localStorage.setItem("provider_draft_profile", JSON.stringify(payload));
      setStatus({ type: "success", text: "Saved changes to active session profile!" });
      if (onSaved) onSaved(payload);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto font-sans pb-16">
      {status.text && (
        <Alert kind={status.type}>{status.text}</Alert>
      )}

      {/* Basic Profile Details */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Building2 size={18} className="text-indigo-600" />
          <span>Professional Identity & Bio</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Business Headline / Service Title</label>
            <input
              type="text"
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Master AC & Electrical Solutions"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Years of Experience</label>
            <input
              type="number"
              min="0"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-600 font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Company Bio & Warranty Guarantee</label>
          <textarea
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Describe your tools, certified expertise, and warranty policy..."
            className="w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-indigo-600 resize-none"
          />
        </div>
      </div>

      {/* NEW: Primary Service Category Checkboxes */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers size={18} className="text-indigo-600" />
            <span>Select Service Categories</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Choose which category catalog pages your service will appear in.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ALL_CATEGORIES.map((cat) => {
            const isChecked = selectedCategories.includes(cat.key);
            return (
              <label
                key={cat.key}
                onClick={() => toggleCategory(cat.key)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                  isChecked
                    ? "bg-indigo-50/80 border-indigo-600 text-indigo-950 font-bold shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 pointer-events-none"
                />
                <span className="text-xs">{cat.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Service Coverage Areas */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <MapPin size={18} className="text-emerald-600" />
            <span>Service Coverage Locations ({selectedAreas.length} Selected)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">Select all Thanas where you provide door-to-door service.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {DEFAULT_AREAS.map((area) => {
            const isSelected = selectedAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
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

      {/* Weekly Operational Calendar & Shift Hours */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Calendar size={18} className="text-indigo-600" />
          <span>Weekly Operational Calendar & Shifts</span>
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

      {/* Pricing Rates */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Banknote size={18} className="text-emerald-600" />
          <span>Rates & Billing</span>
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
  );
}
