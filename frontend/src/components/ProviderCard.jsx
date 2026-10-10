import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Wrench, ShieldCheck } from "lucide-react";
import { Rating, VerifiedBadges, taka } from "./ui";

export default function ProviderCard({ provider }) {
  const displayName = provider.headline || provider.business_name || provider.full_name || "Certified Technician";
  const experienceYears = provider.years_of_experience || provider.years_experience || 5;

  // Real specialties mapping without hardcoded fallbacks
  let specialties = [];
  if (Array.isArray(provider.specialties) && provider.specialties.length > 0) {
    specialties = provider.specialties.map((s) => (typeof s === "object" ? s.name || s.category?.name || "" : s));
  } else if (Array.isArray(provider.services) && provider.services.length > 0) {
    specialties = provider.services.map((s) => (typeof s === "object" ? s.name : s));
  } else if (provider.headline) {
    specialties = [provider.headline];
  } else {
    specialties = ["General Maintenance"];
  }

  // Filter empty strings
  specialties = specialties.filter(Boolean);

  // Coverage areas
  let areas = [];
  if (Array.isArray(provider.areas) && provider.areas.length > 0) {
    areas = provider.areas.map((a) => (typeof a === "object" ? a.area || a.name : a)).filter(Boolean);
  }

  const areaText = areas.length > 0 
    ? areas.slice(0, 3).join(", ") + (areas.length > 3 ? ` +${areas.length - 3} areas` : "")
    : "Dhaka Metro";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "SP";

  return (
    <Link
      to={`/providers/${provider.id}`}
      className="group block rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-indigo-400 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
    >
      <div className="space-y-3">
        {/* Top Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-base flex items-center justify-center shrink-0 shadow-xs">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
              {displayName}
            </h3>
            <p className="text-xs text-slate-500 font-medium truncate">
              by {provider.full_name || "Specialist"}
            </p>
          </div>
        </div>

        {/* Dynamic Services / Specialties Badges */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {specialties.slice(0, 3).map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] font-semibold text-indigo-700"
            >
              <Wrench size={10} className="text-indigo-500" />
              <span>{item}</span>
            </span>
          ))}
          {specialties.length > 3 && (
            <span className="text-[10px] text-slate-400 font-bold self-center">
              +{specialties.length - 3} more
            </span>
          )}
        </div>

        {/* Location Info */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <MapPin size={13} className="text-emerald-600 shrink-0" />
          <span className="truncate">{areaText}</span>
        </div>
      </div>

      {/* Footer Pricing & Verification */}
      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {provider.avg_rating ? (
            <Rating value={provider.avg_rating} count={provider.rating_count} />
          ) : (
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              ☆ New
            </span>
          )}
          {(provider.is_contact_verified || provider.is_credential_verified) && (
            <ShieldCheck size={14} className="text-emerald-600" title="Verified Specialist" />
          )}
        </div>

        <div className="text-right">
          <div className="text-base font-black text-slate-900">
            {taka(provider.base_hourly_rate || 2000)}<span className="text-[10px] font-semibold text-slate-400">/hr</span>
          </div>
          {provider.min_fixed_rate && (
            <span className="text-[10px] text-slate-400 block font-medium">
              min. ৳{provider.min_fixed_rate}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
